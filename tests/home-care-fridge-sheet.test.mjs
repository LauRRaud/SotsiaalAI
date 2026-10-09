import test from 'node:test';
import assert from 'node:assert/strict';

import { clockText, firstName, renderFridgeSheetHtml } from '../lib/homeCare/fridgeSheetDocument.js';

test('eesnimi ja kellaaeg lehe jaoks', () => {
  assert.equal(firstName('Anu Hooldaja'), 'Anu');
  assert.equal(firstName('  Mari-Liis   Tamm '), 'Mari-Liis');
  assert.equal(firstName(''), '');
  assert.equal(firstName(null), '');
  assert.equal(clockText(540), '9.00');
  assert.equal(clockText(575), '9.35');
  assert.equal(clockText(0), '0.00');
  /* Üle südaöö ulatuv käik lõpeb järgmise päeva kellaajaga. */
  assert.equal(clockText(1450), '0.10');
});

test('külmkapileht: eesnimi ilma perekonnanimeta, kliendi nimi ainult äralõigataval real, sisu on varjestatud', () => {
  const html = renderFridgeSheetHtml({
    clientName: 'Linda <Tamm>',
    organizationName: 'Hoolekanne & Co',
    visits: [
      { weekday: 1, startMinute: 540, plannedMinutes: 30, workerName: 'Anu Hooldaja' },
      { weekday: 5, startMinute: 780, plannedMinutes: 45, workerName: null }
    ],
    activities: ['Ahju kütmine', 'Poes käimine <script>alert(1)</script>'],
    phone: '+372 5555 1234',
    validFrom: '09.10.2026',
    locale: 'et'
  });
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<h1>Teie koduteenus<\/h1>/);
  assert.match(html, /<span class="day">Esmaspäev<\/span> kell 9\.00–9\.30 · Anu<\/li>/);
  /* Töötaja perekonnanime lehel ei ole; määramata käigul on üldsõna. */
  assert.equal(html.includes('Hooldaja<'), false);
  assert.match(html, /<span class="day">Reede<\/span> kell 13\.00–13\.45 · hooldaja<\/li>/);
  /* Kliendi nimi on ainult äralõigataval real ja pealkirjas (title) seda ei ole. */
  assert.equal((html.match(/Linda/g) || []).length, 1);
  assert.match(html, /<p class="for">Kellele: Linda &lt;Tamm&gt;<\/p>/);
  assert.match(html, /<title>Teie koduteenus<\/title>/);
  /* Sisu on varjestatud ja lehel ei ole skripte. */
  assert.equal(html.includes('<script>'), false);
  assert.match(html, /Poes käimine &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /Hoolekanne &amp; Co · kehtib alates 09\.10\.2026/);
  assert.match(html, /<p class="call">\+372 5555 1234<\/p>/);
  assert.match(html, /Content-Security-Policy/);
});

test('külmkapileht ilma käikude, kava ja telefonita: selged asendustekstid ja joon numbri kirjutamiseks', () => {
  const html = renderFridgeSheetHtml({ clientName: 'Linda Tamm', organizationName: 'Hoolekanne', visits: [], activities: [], phone: null, validFrom: '09.10.2026', locale: 'et' });
  assert.match(html, /Käigud lepime teiega kokku\./);
  assert.match(html, /Selle lepime teiega kokku\./);
  assert.match(html, /<p class="call"><span class="blank">&nbsp;<\/span><\/p>/);
  /* Inglise ja vene keeles on samad võtmed olemas (leht tuleb asutuse keeles). */
  for (const locale of ['en', 'ru']) {
    const other = renderFridgeSheetHtml({ clientName: 'x', organizationName: 'y', visits: [{ weekday: 2, startMinute: 600, plannedMinutes: 60, workerName: 'Anu Hooldaja' }], activities: [], phone: null, validFrom: '09.10.2026', locale });
    assert.equal(/home_care\.|who_title|what_title|call_title/.test(other), false, locale);
  }
});
