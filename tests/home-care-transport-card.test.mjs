import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { renderTransportCardHtml } from '../lib/homeCare/transportCardDocument.js';
import { normalizeCardLineInput } from '../lib/homeCare/validation.js';

test('püsikaardi rea märge „nähtav autojuhile": võti on olemas ainult selge „jah" korral', () => {
  assert.deepEqual(normalizeCardLineInput({ kind: 'OTHER', text: 'Liigub rulaatoriga', forDriver: true }), { kind: 'OTHER', text: 'Liigub rulaatoriga', forDriver: true });
  assert.deepEqual(normalizeCardLineInput({ kind: 'OTHER', text: 'Liigub rulaatoriga', forDriver: false }), { kind: 'OTHER', text: 'Liigub rulaatoriga' });
  assert.deepEqual(normalizeCardLineInput({ kind: 'OTHER', text: 'Liigub rulaatoriga', forDriver: 'jah' }), { kind: 'OTHER', text: 'Liigub rulaatoriga' });
});

test('transpordikaart: nimi, aadress, autojuhi read ja sõidud; skriptideta ja põgendatud', () => {
  const html = renderTransportCardHtml({
    clientName: 'Linda <Tamm>',
    address: 'Kase 3-12, Haapsalu',
    phone: '+372 5555 1234',
    organizationName: 'Hoolekanne A',
    lines: ['Liigub rulaatoriga, aita trepist alla', 'Naaber <Aino> avab ukse'],
    rides: [
      { wantedOn: '2026-10-16', time: '09:20', destination: 'Perearsti juurde', needs: 'ratastool', arranged: true },
      { wantedOn: '2026-10-20', time: null, destination: 'Apteek', needs: null, arranged: false }
    ],
    issuedOn: '2026-10-09',
    locale: 'et'
  });
  assert.ok(html.startsWith('<!doctype html>'));
  assert.equal(/<script/i.test(html), false);
  assert.ok(html.includes('Content-Security-Policy'));
  /* Pealkirjas ei ole kliendi nime; sisu on põgendatud. */
  assert.ok(html.includes('<title>Transpordikaart</title>'));
  assert.ok(html.includes('Linda &lt;Tamm&gt;'));
  assert.ok(html.includes('Naaber &lt;Aino&gt; avab ukse'));
  assert.equal(html.includes('<Aino>'), false);
  for (const text of ['Kase 3-12, Haapsalu', 'Telefon:</span> +372 5555 1234', 'Mida autojuht peab teadma', '16.10.2026 kell 09:20</span> · Perearsti juurde · ratastool</li>', '20.10.2026</span> · Apteek · ootab korraldamist</li>', 'Hoolekanne A · välja antud 09.10.2026', 'Hävita see pärast sõitu.']) {
    assert.ok(html.includes(text), text);
  }
  /* Ilma ridade, sõitude, aadressi ja telefonita: selgitused, mitte tühjad loendid. */
  const bare = renderTransportCardHtml({ clientName: 'Linda Tamm', address: null, phone: null, organizationName: 'A', lines: [], rides: [], issuedOn: '2026-10-09', locale: 'et' });
  assert.ok(bare.includes('Autojuhile ei ole midagi eraldi märgitud.'));
  assert.ok(bare.includes('Eesolevaid sõite ei ole kirjas.'));
  assert.equal(bare.includes('Telefon:'), false);
  assert.equal(bare.includes('<ul>'), false);
});

test('transpordikaardi tekstid on kolmes keeles', () => {
  const et = JSON.parse(readFileSync(new URL('../messages/et.json', import.meta.url), 'utf8')).home_care;
  for (const locale of ['et', 'en', 'ru']) {
    const catalogue = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).home_care;
    for (const key of Object.keys(et.transport_card.doc)) assert.ok(catalogue.transport_card.doc[key], `${locale} doc.${key}`);
    for (const key of ['for_driver_label', 'for_driver_badge']) assert.ok(catalogue.card[key], `${locale} ${key}`);
    for (const key of ['card_open', 'card_hint']) assert.ok(catalogue.transport[key], `${locale} ${key}`);
    assert.ok(catalogue.errors.card_driver_full, locale);
  }
});
