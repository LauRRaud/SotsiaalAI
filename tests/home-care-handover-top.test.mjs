// KODUTEENUS — viimased teated järgmisele kliendi lehe esimeses vaates.
//
// Telefonis oli kliendi leht seitse ekraanitäit pikk ja päevik algas kuuendalt: eelmise hooldaja
// teade („supp on külmkapis") jäi sinna, kuhu järgmine hooldaja enne käiku ei jõua (11.10.2026
// läbimäng). Reegel on puhas funktsioon päeviku esimese lehe peal. Nüüd on kliendi leht osade
// laud ja avaneb vaatega „Ukse taga": seal on ees püsikaart ja viimane teade, varasemad teated
// on ühe vajutuse taga (components/homeCare/client/clientParts.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HOME_CARE_LIMITS } from '../lib/homeCare/constants.js';
import { recentHandoversOf } from '../lib/homeCare/entries.js';
import { CLIENT_LANDING, DOOR_VIEWS, clientViewer, doorHandover, viewAllowed, viewNameKey } from '../components/homeCare/client/clientParts.js';

const NOW = new Date('2026-10-11T08:00:00Z');
const item = (id, patch = {}) => ({ id, kind: 'HANDOVER', isMine: false, retractedAt: null, text: `teade ${id}`, authorName: 'Anu Aas', occurredAt: '2026-10-10T08:00:00.000Z', ...patch });

test('lehe ülaossa lähevad teiste kirjutatud, tühistamata, viimase nädala teated; uuemad ees', () => {
  const rows = recentHandoversOf(
    [
      item('vana', { occurredAt: '2026-10-03T07:59:00.000Z' }),
      item('piiril', { occurredAt: '2026-10-04T08:00:00.000Z' }),
      item('minu', { isMine: true }),
      item('tühistatud', { retractedAt: '2026-10-10T09:00:00.000Z', text: null }),
      item('märkus', { kind: 'NOTE' }),
      item('mure', { kind: 'CONCERN' }),
      item('eile', { occurredAt: '2026-10-10T16:00:00.000Z' }),
      item('täna', { occurredAt: '2026-10-11T06:00:00.000Z' })
    ],
    NOW
  );
  assert.deepEqual(rows.map((row) => row.id), ['täna', 'eile', 'piiril']);
  /* Ülaossa läheb ainult see, mida seal näidatakse: tekst, autor ja aeg. */
  assert.deepEqual(Object.keys(rows[0]).sort(), ['authorName', 'id', 'occurredAt', 'text']);
  assert.deepEqual(rows[0], { id: 'täna', text: 'teade täna', authorName: 'Anu Aas', occurredAt: '2026-10-11T06:00:00.000Z' });
});

test('korraga on ees piiratud arv teateid; tühi ja vigane sisend annab tühja loendi', () => {
  const many = Array.from({ length: 8 }, (_, index) => item(`t${index}`, { occurredAt: `2026-10-10T0${index}:00:00.000Z` }));
  const rows = recentHandoversOf(many, NOW);
  assert.equal(rows.length, HOME_CARE_LIMITS.HANDOVER_TOP_MAX);
  assert.deepEqual(rows.map((row) => row.id), ['t7', 't6', 't5']);
  for (const bad of [null, undefined, {}, 'x', []]) assert.deepEqual(recentHandoversOf(bad, NOW), []);
});

test('kliendi leht avaneb vaatega, kus viimane teade on ees; varasemad on ühe vajutuse taga', () => {
  const rows = recentHandoversOf([item('eile', { occurredAt: '2026-10-10T16:00:00.000Z' }), item('täna', { occurredAt: '2026-10-11T06:00:00.000Z' }), item('piiril', { occurredAt: '2026-10-04T08:00:00.000Z' })], NOW);
  /* Leht avaneb vaatega „Ukse taga"; seal on ees kõige uuem teade ja arv, mitu neid veel on. */
  assert.equal(CLIENT_LANDING, 'door');
  assert.deepEqual(doorHandover({ recentHandovers: rows }), { latest: rows[0], more: 2 });
  assert.equal(doorHandover({ recentHandovers: rows }).latest.id, 'täna');
  assert.deepEqual(doorHandover({ recentHandovers: [] }), { latest: null, more: 0 });
  /* Kõik viimased teated on osa „Ukse taga" alavaade: selle avab igaüks, kes lehte näeb, ka lugeja. */
  assert.ok(DOOR_VIEWS.includes('handovers'));
  const reader = { client: { status: 'ACTIVE' }, access: { isCoordinator: false, canEditCard: false, canWrite: false, membershipId: 'm1' } };
  assert.equal(viewAllowed('handovers', clientViewer(reader), reader), true);
  assert.equal(viewNameKey('handovers'), viewNameKey('door'));
  for (const locale of ['et', 'en', 'ru']) {
    const hc = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).home_care;
    assert.ok(hc.client.handovers_title, `${locale} client.handovers_title`);
    for (const key of ['back', 'more_handovers', 'no_answer', 'write_entry']) assert.ok(hc.door[key], `${locale} door.${key}`);
    assert.ok(hc.card.empty_readonly && hc.no_answer.none_readonly, locale);
    /* Lugejale ei öelda „lisa", kui tal lisamise nuppu ei ole. */
    assert.doesNotMatch(hc.card.empty_readonly + hc.no_answer.none_readonly, /Lisa|Pane kirja|Add |Write |Добав|Запиш/, locale);
  }
});
