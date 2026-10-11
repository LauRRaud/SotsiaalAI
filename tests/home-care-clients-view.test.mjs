// Klientide vaade koduteenuse avalehel.
//
// Otsing, tulemused ja kogu klientide loend seisid pika keritava lehe lõpus.
// Nüüd on vaates üks asi korraga: loendi esimene lehekülg või otsingu tulemused.
// Reeglid on puhtas failis components/homeCare/clients/clientRows.js; test
// hoiab rea sõnu, otsingu selgitust, kõne märkimise luba ja lehekülje suurust.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CLIENTS_PAGE, canNoteCall, clientChips, clientLine, pageOf, resultLine } from '../components/homeCare/clients/clientRows.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const t = (key, params) => (params ? `${key}:${Object.values(params).join(',')}` : key);

test('loendi esimene lehekülg ja „Näita veel”', () => {
  const list = Array.from({ length: 9 }, (_, index) => ({ id: `c${index}` }));
  const first = pageOf(list, CLIENTS_PAGE);
  assert.equal(first.rows.length, CLIENTS_PAGE);
  assert.equal(first.left, 3);
  assert.deepEqual(pageOf(list, CLIENTS_PAGE + 20), { rows: list, left: 0 });
  assert.deepEqual(pageOf(null, CLIENTS_PAGE), { rows: [], left: 0 });
});

test('kliendi rea sõnad: aadress ja, kui klient ei ole teenusel, seisu alus ja selgitus', () => {
  assert.equal(clientLine({ status: 'ACTIVE', address: 'Pikk 4', statusNote: 'vana märkus', statusReason: 'HOSPITAL' }, { t }), 'Pikk 4');
  assert.equal(clientLine({ status: 'AWAY', address: 'Pikk 4', statusReason: 'HOSPITAL', statusNote: 'alates 9.10' }, { t }), 'Pikk 4 · home_care.status_reason.AWAY.HOSPITAL · alates 9.10');
  assert.equal(clientLine({ status: 'ACTIVE' }, { t }), '');
});

test('kliendi rea märgid: ajutiselt ära ja ootab eeltingimust', () => {
  assert.deepEqual(clientChips({ status: 'ACTIVE' }, { t }), []);
  assert.deepEqual(clientChips({ status: 'AWAY', waiting: true }, { t }).map((chip) => chip.key), ['away', 'waiting']);
  assert.ok(clientChips({ status: 'AWAY' }, { t }).every((chip) => chip.wait));
});

test('otsingu tulemus ütleb, mille järgi klient leiti või kuidas leht avaneb', () => {
  assert.equal(resultLine({ status: 'ACTIVE' }, { t }), 'home_care.client.basis.TEAM');
  assert.equal(resultLine({ status: 'ACTIVE', needsReason: true }, { t }), 'home_care.home.needs_reason');
  assert.equal(resultLine({ status: 'ENDED', matchedPhone: true }, { t }), 'home_care.status.ENDED · home_care.home.matched_phone');
  assert.equal(
    resultLine({ status: 'ACTIVE', matchedRelative: { name: 'Reet', relation: 'tütar', level: 2 } }, { t }),
    'home_care.home.matched_relative:Reet (tütar),home_care.relatives.levels.2'
  );
  /* Klient ei mäleta luba: see peab tulemuses kirjas olema. */
  assert.ok(resultLine({ status: 'ACTIVE', matchedRelative: { name: 'Reet', level: 1, doubt: true } }, { t }).endsWith(' · home_care.home.matched_relative_doubt'));
});

test('kõne saab märkida otse tulemusest ainult kliendil, kelle päevikusse tohib kirjutada', () => {
  assert.equal(canNoteCall({ needsReason: true, matchedPhone: true }, 1), false);
  assert.equal(canNoteCall({ matchedPhone: true }, 12), true);
  assert.equal(canNoteCall({ matchedRelative: { name: 'Reet' } }, 12), true);
  /* Nime järgi leitud: ainult siis, kui tulemusi on vähe. */
  assert.equal(canNoteCall({}, 3), true);
  assert.equal(canNoteCall({}, 4), false);
});

test('klientide vaate lingid kliendi lehele ei lae lehte ette', () => {
  const views = read('components/homeCare/clients/ClientsViews.jsx');
  const links = views.match(/<Link\b[^>]*>/g) || [];
  assert.ok(links.length >= 1, `linke ${links.length}`);
  for (const link of links) assert.ok(link.includes('prefetch={false}'), link);
});

test('avalehe vaated ei kanna enam vana kihi lehe ümbrist', () => {
  /* Vanal kihil on avalehel veel ainult kaks väikest osa (seadmes ootavad kirjed, kõne märkimine): need saavad `hc-shell` ümbrise oma vaate sees. */
  assert.ok(!read('components/homeCare/HomeCareHome.jsx').includes('hc-shell'));
  for (const file of ['HomeCareOwnName', 'HomeCareReferrals', 'HomeCareClientForm']) {
    assert.ok(!/className="hc-/.test(read(`components/homeCare/${file}.jsx`)), file);
  }
});
