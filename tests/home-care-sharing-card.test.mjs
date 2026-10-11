import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { sharingLevelNow, sharingReviewBy } from '../lib/homeCare/relatives.js';
import { renderSharingCardHtml } from '../lib/homeCare/sharingCardDocument.js';

test('jagamisaste praegu: kahtluse korral kõige kitsam; üleküsimise päev vanima kinnituse järgi', () => {
  assert.equal(sharingLevelNow(3, false), 3);
  assert.equal(sharingLevelNow(3, true), 1);
  assert.equal(sharingLevelNow(1, true), 1);
  /* Vanim kinnitus pluss 183 päeva; ilma lähedasteta väljaandmise päev pluss 183 päeva. */
  assert.equal(sharingReviewBy(['2026-09-01', '2026-03-01', '2026-06-15'], '2026-10-09'), '2026-08-31');
  assert.equal(sharingReviewBy([], '2026-10-09'), '2027-04-10');
});

test('jagamiskaart: kliendi sõnadega, skriptideta, tühjad read käsitsi lisamiseks', () => {
  const html = renderSharingCardHtml({
    clientName: 'Linda <Tamm>',
    organizationName: 'Hoolekanne A',
    relatives: [
      { name: 'Mari Tamm', relation: 'tütar', level: 2, noTell: 'rahaasjad', agreedOn: '2026-10-01' },
      { name: 'Jaan Naaber', relation: null, level: 1, noTell: null, agreedOn: '2026-09-15' },
      { name: 'Peep Poeg', relation: 'poeg', level: 3, noTell: null, agreedOn: '2026-10-05' }
    ],
    issuedOn: '2026-10-09',
    reviewBy: '2027-03-17',
    locale: 'et'
  });
  assert.ok(html.startsWith('<!doctype html>'));
  assert.equal(/<script/i.test(html), false);
  assert.ok(html.includes('Content-Security-Policy'));
  /* Pealkirjas ei ole nimesid; sisu on põgendatud. */
  assert.ok(html.includes('<title>Kellele ja mida võib minu kohta rääkida</title>'));
  assert.ok(html.includes('Linda &lt;Tamm&gt;, selle lehe leppisime kokku koos.'));
  assert.equal(html.includes('<Tamm>'), false);
  for (const text of [
    'Mari Tamm (tütar)',
    'Talle võib öelda, kas hooldaja käis ja mida koos tegime.',
    'Sellest ei räägi: rahaasjad',
    'Kokku lepitud 01.10.2026',
    '<p class="name">Jaan Naaber</p>',
    'Talle võib öelda, kas hooldaja käis.',
    'võtab hooldusjuht temaga ühendust',
    'Küsime selle teilt üle hiljemalt 17.03.2027.',
    'Klient:',
    'Hoolekanne A · välja antud 09.10.2026'
  ]) {
    assert.ok(html.includes(text), text);
  }
  /* Astme numbrit kaardil ei ole: klient loeb lauset, mitte koodi. */
  assert.equal(/aste [123]/.test(html), false);
  /* Kolm lähedast ja kaks tühja rida. */
  assert.equal((html.match(/<div class="person">/g) || []).length, 5);

  const empty = renderSharingCardHtml({ clientName: 'Linda Tamm', organizationName: 'A', relatives: [], issuedOn: '2026-10-09', reviewBy: '2027-04-10', locale: 'et' });
  assert.ok(empty.includes('Praegu ei ole kokku lepitud, et kellelegi midagi räägitakse.'));
  assert.equal((empty.match(/<div class="person">/g) || []).length, 2);
});

test('jagamiskaardi ja kahtluse tekstid on kolmes keeles', () => {
  const et = JSON.parse(readFileSync(new URL('../messages/et.json', import.meta.url), 'utf8')).home_care;
  for (const locale of ['et', 'en', 'ru']) {
    const catalogue = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).home_care;
    for (const key of Object.keys(et.sharing_card.doc)) assert.ok(catalogue.sharing_card.doc[key], `${locale} doc.${key}`);
    for (const key of ['doubt_flag', 'doubt_line', 'card_open', 'card_hint']) assert.ok(catalogue.relatives[key], `${locale} ${key}`);
    assert.ok(catalogue.home.matched_relative_doubt, locale);
    assert.ok(catalogue.deadlines.relatives_doubt_line, locale);
  }
});
