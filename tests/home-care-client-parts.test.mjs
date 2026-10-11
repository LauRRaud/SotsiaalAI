// Kliendi leht osade lauana.
//
// Kliendi leht oli üks pikk keritav leht (proovandmetega 13 000 px, paneel 522).
// Nüüd on iga osa omaette vaade ja leht ise on osade laud: plaadil on osa seis
// andmetest, mille leht niikuinii laeb. Leht avaneb vaatega „Ukse taga". Reeglid
// on puhtas failis components/homeCare/client/clientParts.js; test hoiab, kes
// mida näeb, mis seisab plaadil, mis on ukse taga ees ja et nimed mahuksid
// kiirmenüüsse.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CLIENT_LANDING,
  CLIENT_PARTS,
  DOOR_VIEWS,
  canOpenNoAnswer,
  clientTiles,
  clientViewer,
  doorAlerts,
  doorHandover,
  doorNotices,
  heldCents,
  partVisible,
  reviewItems,
  viewAllowed,
  viewNameKey
} from '../components/homeCare/client/clientParts.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const LANGS = ['et', 'en', 'ru'];
const catalogs = Object.fromEntries(LANGS.map((lang) => [lang, JSON.parse(read(`messages/${lang}.json`))]));
const at = (node, key) => key.split('.').reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), node);
const t = (key, params) => (params ? `${key}:${Object.values(params).join(',')}` : key);
const format = { t, day: (value) => `p${value}`, moment: (value) => `a${value}`, euro: (cents) => `${cents}c`, volume: (decision) => decision.volume || '' };

const access = (patch = {}) => ({ isCoordinator: false, canEditCard: true, canWrite: true, membershipId: 'm1', ...patch });
const page = (patch = {}, accessPatch = {}) => ({ client: { status: 'ACTIVE' }, access: access(accessPatch), team: [], ...patch });
const coordinator = { isCoordinator: true };
const reader = { canEditCard: false };
const keysOf = (tiles) => tiles.map((tile) => tile.key);
const lineOf = (data, part) => clientTiles(clientViewer(data), data, format).find((tile) => tile.key === part);

test('leht avaneb vaatega „Ukse taga” ja see osa on alati olemas', () => {
  assert.equal(CLIENT_LANDING, 'door');
  assert.equal(CLIENT_PARTS[0], 'door');
  for (const data of [page(), page({}, coordinator), page({ client: { status: 'ENDED' } }, { ...reader, canWrite: false })]) {
    assert.equal(partVisible('door', clientViewer(data), data), true);
    assert.equal(viewAllowed(CLIENT_LANDING, clientViewer(data), data), true);
  }
});

test('kes lehte vaatab: õigused loetakse lehe andmetest', () => {
  assert.deepEqual(clientViewer(page()), { isCoordinator: false, isTeam: true, canWrite: true, ended: false, canAddEntry: true, membershipId: 'm1' });
  /* Lõpetatud kliendile kirjutab kirje ainult hooldusjuht. */
  assert.equal(clientViewer(page({ client: { status: 'ENDED' } })).canAddEntry, false);
  assert.equal(clientViewer(page({ client: { status: 'ENDED' } }, coordinator)).canAddEntry, true);
  /* Asutus ei ole kirjutatav: kirjet ei saa keegi lisada. */
  assert.equal(clientViewer(page({}, { ...coordinator, canWrite: false })).canAddEntry, false);
  assert.deepEqual(clientViewer(null), { isCoordinator: false, isTeam: false, canWrite: false, ended: false, canAddEntry: false, membershipId: null });
});

test('hooldusjuhi laual on kõik 14 osa, meeskonna liikmel hooldusjuhi osa ei ole', () => {
  const boss = page({}, coordinator);
  assert.deepEqual(keysOf(clientTiles(clientViewer(boss), boss, format)), [...CLIENT_PARTS]);
  assert.equal(CLIENT_PARTS.length, 14);
  /* Meeskonna liige tühja kliendi juures: võtmeid ja varusid ei ole, neid lisab hooldusjuht. */
  const worker = page();
  assert.deepEqual(keysOf(clientTiles(clientViewer(worker), worker, format)), ['door', 'entry', 'diary', 'plan', 'slots', 'decision', 'safety', 'money', 'transport', 'relatives', 'team']);
  /* Kui võti ja varu on kirjas, näeb neid ka tema. */
  const full = page({ keys: [{ id: 'k1', tag: '14' }], supplies: [{ id: 's1', kind: 'FIREWOOD', state: 'ENOUGH' }] });
  const seen = keysOf(clientTiles(clientViewer(full), full, format));
  assert.ok(seen.includes('keys') && seen.includes('supplies'));
});

test('plaat ei ava tühja vaadet: osa, kus ei ole midagi näha ega teha, laual ei ole', () => {
  /* Põhjusega avaja loeb: tühja kliendi juures jäävad osad, kus on alati midagi lugeda. */
  const guest = page({}, reader);
  assert.deepEqual(keysOf(clientTiles(clientViewer(guest), guest, format)), ['door', 'entry', 'diary', 'plan', 'slots', 'decision', 'money', 'team']);
  /* Kirjutamata asutus: ka kirje ja raha jäävad ära, kui midagi lugeda ei ole. */
  const frozen = page({}, { ...reader, canWrite: false });
  assert.deepEqual(keysOf(clientTiles(clientViewer(frozen), frozen, format)), ['door', 'diary', 'plan', 'slots', 'decision', 'team']);
  /* Mis on kirjas, seda näeb lugeja ikka. */
  const filled = page(
    { safety: { items: [{ id: 'i1' }] }, relatives: [{ id: 'r1', name: 'Reet Tamm' }], transport: { requests: [{ id: 't1', state: 'ARRANGED' }] }, money: { balanceCents: 0, entries: [{ id: 'm1' }], holders: [] } },
    { ...reader, canWrite: false }
  );
  for (const part of ['safety', 'relatives', 'transport', 'money']) assert.equal(partVisible(part, clientViewer(filled), filled), true, part);
  for (const data of [{ usualState: [{ id: 'u1' }] }, { preconditions: [{ id: 'p1' }] }, { workNature: { id: 'w1' } }, { crisis: { id: 'c1' } }]) {
    const one = page(data, { ...reader, canWrite: false });
    assert.equal(partVisible('safety', clientViewer(one), one), true, Object.keys(data)[0]);
  }
  const represented = page({ representatives: [{ id: 'x1' }] }, { ...reader, canWrite: false });
  assert.equal(partVisible('relatives', clientViewer(represented), represented), true);
  /* Lõpetatud kliendile sõitu ei tellita ja raha rida ei lisata. */
  const ended = page({ client: { status: 'ENDED' } });
  assert.equal(partVisible('transport', clientViewer(ended), ended), false);
  assert.equal(partVisible('money', clientViewer(ended), ended), false);
  assert.equal(partVisible('missing', clientViewer(ended), ended), false);
});

test('vaate tohib avada, kui see on osade laud, nähtav osa või ukse taga alavaade', () => {
  const worker = page();
  const who = clientViewer(worker);
  assert.equal(viewAllowed('', who, worker), true);
  for (const view of DOOR_VIEWS) assert.equal(viewAllowed(view, who, worker), true, view);
  assert.equal(viewAllowed('manage', who, worker), false);
  assert.equal(viewAllowed('entry', who, worker), true);
  /* Kirje vorm oli lahti ja klient lõpetati: vaadet enam ei ole (leht näitab osade lauda). */
  const ended = page({ client: { status: 'ENDED' } });
  assert.equal(viewAllowed('entry', clientViewer(ended), ended), false);
  /* „Kui uks ei avane": sammud on kirjas või inimene saab neid kirja panna või käiku märkida. */
  const frozen = page({}, { ...reader, canWrite: false });
  assert.equal(canOpenNoAnswer(clientViewer(frozen), frozen), false);
  assert.equal(viewAllowed('no_answer', clientViewer(frozen), frozen), false);
  assert.equal(canOpenNoAnswer(clientViewer(frozen), { ...frozen, doorSteps: [{ id: 'd1' }] }), true);
  assert.equal(canOpenNoAnswer(who, worker), true);
});

test('plaadi rida ütleb osa seisu lehe andmetest', () => {
  const data = page({
    latestEntryAt: '2026-10-09T13:40:00.000Z',
    plan: { reviewOn: '2026-12-01' },
    slots: [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
    decision: { volume: '16 h kuus' },
    relatives: [{ id: 'r1', name: 'Reet Tamm' }],
    team: [{ name: 'Mari Mets', active: true }, { name: 'Vana Olija', active: false }, { name: 'Liis Saar', active: true }, { name: 'Peeter Ilves', active: true }]
  });
  assert.equal(lineOf(data, 'diary').line, 'home_care.parts.lines.diary_last:a2026-10-09T13:40:00.000Z');
  assert.equal(lineOf(data, 'plan').line, 'home_care.parts.lines.plan_review:p2026-12-01');
  assert.equal(lineOf(data, 'slots').line, 'home_care.parts.lines.slots:3');
  assert.equal(lineOf(data, 'decision').line, '16 h kuus');
  assert.equal(lineOf(data, 'relatives').line, 'Reet Tamm');
  /* Meeskonnast üks nimi ja mitu on veel; endist liiget ei loeta. */
  assert.equal(lineOf(data, 'team').line, 'home_care.parts.lines.team_more:Mari Mets,2');
  assert.equal(lineOf(page({ team: [{ name: 'Mari Mets', active: true }] }), 'team').line, 'Mari Mets');
  /* Tühi klient: iga rida ütleb, et midagi ei ole. */
  const empty = page({}, coordinator);
  const lines = Object.fromEntries(clientTiles(clientViewer(empty), empty, format).map((tile) => [tile.key, tile.line]));
  assert.equal(lines.diary, 'home_care.parts.lines.diary_none');
  assert.equal(lines.plan, 'home_care.parts.lines.plan_none');
  assert.equal(lines.slots, 'home_care.parts.lines.slots_none');
  assert.equal(lines.decision, 'home_care.parts.lines.decision_none');
  assert.equal(lines.keys, 'home_care.parts.lines.keys_none');
  assert.equal(lines.money, 'home_care.parts.lines.money_none');
  assert.equal(lines.supplies, 'home_care.parts.lines.supplies_none');
  assert.equal(lines.transport, 'home_care.parts.lines.transport_none');
  assert.equal(lines.relatives, 'home_care.parts.lines.relatives_none');
  assert.equal(lines.team, 'home_care.parts.lines.team_none');
  assert.equal(lines.manage, 'home_care.parts.lines.manage');
  assert.equal(lineOf(page({ plan: {} }), 'plan').line, 'home_care.parts.lines.plan_no_review');
  assert.equal(lineOf(page({ decision: {} }), 'decision').line, 'home_care.parts.lines.decision_no_volume');
  assert.equal(lineOf(page({ relatives: [{ id: 'r1', name: 'A' }, { id: 'r2', name: 'B' }] }), 'relatives').line, 'home_care.parts.lines.relatives_count:2');
});

test('võtmete rida: kelle käes võti on', () => {
  const key = (tag, holder) => ({ id: `k${tag}`, tag, holder });
  assert.equal(lineOf(page({ keys: [key('14', { membershipId: 'm1', name: 'Mina' })] }), 'keys').line, 'home_care.parts.lines.key_mine:14');
  assert.equal(lineOf(page({ keys: [key('14', { membershipId: 'm2', name: 'Mari Mets' })] }), 'keys').line, 'home_care.parts.lines.key_held:14,Mari Mets');
  assert.equal(lineOf(page({ keys: [key('14', null)] }), 'keys').line, 'home_care.parts.lines.key_office:14');
  assert.equal(lineOf(page({ keys: [key('14', { membershipId: 'm1' }), key('15', null)] }), 'keys').line, 'home_care.parts.lines.keys_count_mine:2,1');
  assert.equal(lineOf(page({ keys: [key('14', { membershipId: 'm2' }), key('15', null)] }), 'keys').line, 'home_care.parts.lines.keys_count:2');
});

test('raha rida: minu käes, töötajate käes või mitte kellegi käes', () => {
  const holders = [{ membershipId: 'm2', balanceCents: 1240 }, { membershipId: 'm3', balanceCents: 500 }];
  assert.equal(lineOf(page({ money: { balanceCents: 760, entries: [], holders: [] } }), 'money').line, 'home_care.parts.lines.money_mine:760c');
  /* Teiste käes olevat summat näeb plaadil hooldusjuht. */
  assert.equal(lineOf(page({ money: { balanceCents: 0, entries: [], holders } }, coordinator), 'money').line, 'home_care.parts.lines.money_held:1740c');
  assert.equal(lineOf(page({ money: { balanceCents: 0, entries: [], holders } }), 'money').line, 'home_care.parts.lines.money_none');
  assert.equal(heldCents({ money: { holders } }), 1740);
  assert.equal(heldCents(null), 0);
});

test('plaat, kus midagi ootab, on esile tõstetud: lõppev varu, täitmata eeltingimus, vastuseta soov ja märkamine', () => {
  const supply = (kind, state) => ({ id: kind, kind, state });
  /* Kõige halvem seis on ees: otsas enne lõppemist. */
  const out = lineOf(page({ supplies: [supply('WATER', 'LOW'), supply('FIREWOOD', 'OUT')] }), 'supplies');
  assert.deepEqual([out.line, out.wait], ['home_care.parts.lines.supply_state:home_care.supplies.kinds.FIREWOOD,home_care.supplies.states.OUT', true]);
  const low = lineOf(page({ supplies: [supply('WATER', 'LOW'), supply('FOOD', 'ENOUGH')] }), 'supplies');
  assert.deepEqual([low.line, low.wait], ['home_care.parts.lines.supply_state:home_care.supplies.kinds.WATER,home_care.supplies.states.LOW', true]);
  assert.deepEqual([lineOf(page({ supplies: [supply('FOOD', 'ENOUGH')] }), 'supplies').line, lineOf(page({ supplies: [supply('FOOD', 'ENOUGH')] }), 'supplies').wait], ['home_care.parts.lines.supplies_ok', false]);
  assert.equal(lineOf(page({ supplies: [supply('FOOD', null)] }), 'supplies').line, 'home_care.parts.lines.supplies_unmarked');

  const blocked = lineOf(page({ preconditions: [{ id: 'p1' }, { id: 'p2' }] }), 'safety');
  assert.deepEqual([blocked.line, blocked.wait], ['home_care.parts.lines.safety_preconditions:2', true]);
  assert.equal(lineOf(page(), 'safety').wait, false);

  /* Vastuseta soov on hooldusjuhi teha: temal on plaat esile tõstetud, hooldajal mitte. */
  const transport = { requests: [{ id: 't1', state: 'REQUESTED' }], next: { wantedOn: '2026-10-14' } };
  assert.deepEqual([lineOf(page({ transport }, coordinator), 'transport').line, lineOf(page({ transport }, coordinator), 'transport').wait], ['home_care.parts.lines.transport_waiting', true]);
  assert.equal(lineOf(page({ transport }), 'transport').wait, false);
  assert.equal(lineOf(page({ transport: { requests: [{ id: 't1', state: 'ARRANGED' }], next: { wantedOn: '2026-10-14' } } }), 'transport').line, 'home_care.parts.lines.transport_next:p2026-10-14');

  const signals = lineOf(page({ changeSignals: { open: [{ id: 's1' }], handled: [] } }, coordinator), 'manage');
  assert.deepEqual([signals.line, signals.wait], ['home_care.parts.lines.manage_signals:1', true]);
  /* Peatatud kliendil on võti veel asutuse käes: hooldusjuhi osa ütleb, et midagi on lahti. */
  const away = lineOf(page({ client: { status: 'AWAY' }, keys: [{ id: 'k1', tag: '14' }] }, coordinator), 'manage');
  assert.deepEqual([away.line, away.wait], ['home_care.parts.lines.manage_review', true]);
  assert.equal(lineOf(page({ client: { status: 'AWAY' } }, coordinator), 'manage').wait, false);
});

test('peatamisel ja lõpetamisel üle vaadata: mis on kliendi juures veel lahti', () => {
  const open = { keys: [{ id: 'k1' }, { id: 'k2' }], money: { holders: [{ balanceCents: 1240 }] }, slots: [{ id: 's1' }], supplies: [{ id: 'v1' }], preconditions: [{ id: 'p1' }] };
  assert.deepEqual(reviewItems(page(open), format), []);
  assert.deepEqual(reviewItems(page({ ...open, client: { status: 'ENDED' } }), format), [
    { key: 'keys', text: 'home_care.review.keys_return:2' },
    { key: 'money', text: 'home_care.review.money_return:1240c' },
    { key: 'slots', text: 'home_care.review.slots_end:1' },
    { key: 'supplies', text: 'home_care.review.supplies_end:1' },
    { key: 'preconditions', text: 'home_care.review.preconditions_open:1' }
  ]);
  /* Ära oleku ajal: käigud on peatatud (alati), võtmed ja raha, kui neid on. */
  assert.deepEqual(reviewItems(page({ ...open, client: { status: 'AWAY' } }), format), [
    { key: 'paused', text: 'home_care.review.away_paused' },
    { key: 'keys', text: 'home_care.review.away_keys:2' },
    { key: 'money', text: 'home_care.review.money_return:1240c' }
  ]);
  assert.deepEqual(reviewItems(page({ client: { status: 'AWAY' } }), format), [{ key: 'paused', text: 'home_care.review.away_paused' }]);
  assert.deepEqual(reviewItems(page({ client: { status: 'ENDED' } }), format), []);
});

test('ukse taga on ees see, mida enne sisenemist teadma peab', () => {
  const who = clientViewer(page());
  assert.deepEqual(doorNotices(who, page(), format), []);
  const data = page({ client: { status: 'AWAY' }, talkToCoordinator: true, homecoming: { returnedOn: '2026-10-10', awayFrom: '2026-09-28', reason: 'HOSPITAL' } });
  assert.deepEqual(doorNotices(clientViewer(data), data, format).map((notice) => notice.key), ['talk', 'away', 'homecoming']);
  const homecoming = doorNotices(clientViewer(data), data, format).find((notice) => notice.key === 'homecoming').text;
  assert.equal(homecoming, 'home_care.homecoming.notice:p2026-10-10,p2026-09-28 (home_care.status_reason.AWAY.HOSPITAL). home_care.homecoming.first_visit');
  /* Hooldusjuhile lisaks: plaani esimene käik pikem. */
  const boss = page({ homecoming: { returnedOn: '2026-10-10', awayFrom: '2026-09-28' } }, coordinator);
  assert.equal(doorNotices(clientViewer(boss), boss, format)[0].text, 'home_care.homecoming.notice:p2026-10-10,p2026-09-28. home_care.homecoming.first_visit home_care.homecoming.coordinator');
  const closed = page({ client: { status: 'ENDED' } }, { canWrite: false });
  assert.deepEqual(doorNotices(clientViewer(closed), closed, format).map((notice) => notice.key), ['ended', 'read_only']);
});

test('ukse taga: rida viib osasse, kus midagi ootab', () => {
  assert.deepEqual(doorAlerts(clientViewer(page()), page(), format), []);
  /* Täitmata eeltingimus on kõigile: teenust ei alustata enne. */
  const blocked = page({ preconditions: [{ id: 'p1' }], changeSignals: null });
  assert.deepEqual(doorAlerts(clientViewer(blocked), blocked, format), [{ key: 'preconditions', view: 'safety', text: 'home_care.parts.lines.safety_preconditions:1' }]);
  /* Märkamised, mis ootavad vastust, on hooldusjuhi teha. */
  const boss = page({ preconditions: [{ id: 'p1' }], changeSignals: { open: [{ id: 's1' }, { id: 's2' }], handled: [] } }, coordinator);
  assert.deepEqual(doorAlerts(clientViewer(boss), boss, format).map((alert) => [alert.key, alert.view]), [['preconditions', 'safety'], ['signals', 'manage']]);
  /* Iga rida viib vaatesse, mille see inimene tohib avada. */
  for (const alert of doorAlerts(clientViewer(boss), boss, format)) assert.equal(viewAllowed(alert.view, clientViewer(boss), boss), true, alert.key);
});

test('ukse taga on ees viimane teade järgmisele, varasemad on rea taga', () => {
  const list = [{ id: 'h3' }, { id: 'h2' }, { id: 'h1' }];
  assert.deepEqual(doorHandover({ recentHandovers: list }), { latest: { id: 'h3' }, more: 2 });
  assert.deepEqual(doorHandover({ recentHandovers: [{ id: 'h1' }] }), { latest: { id: 'h1' }, more: 0 });
  for (const bad of [null, {}, { recentHandovers: 'x' }, { recentHandovers: [] }]) assert.deepEqual(doorHandover(bad), { latest: null, more: 0 });
});

test('osade ja vaadete sõnad on kolmes keeles olemas', () => {
  const used = new Set();
  const collect = (key) => {
    used.add(key);
    return key;
  };
  const say = { ...format, t: collect };
  const rich = (accessPatch) =>
    page(
      {
        client: { status: 'AWAY' },
        latestEntryAt: '2026-10-09T13:40:00.000Z',
        plan: { reviewOn: '2026-12-01' },
        slots: [{ id: 's1' }],
        decision: {},
        preconditions: [{ id: 'p1' }],
        keys: [{ id: 'k1', tag: '14', holder: { membershipId: 'm1' } }],
        money: { balanceCents: 5, entries: [], holders: [{ balanceCents: 5 }] },
        supplies: [{ id: 'v1', kind: 'FIREWOOD', state: 'OUT' }],
        transport: { requests: [{ id: 't1', state: 'REQUESTED' }] },
        relatives: [{ id: 'r1', name: 'A' }, { id: 'r2', name: 'B' }],
        team: [{ name: 'A', active: true }, { name: 'B', active: true }],
        changeSignals: { open: [{ id: 's1' }], handled: [] },
        talkToCoordinator: true,
        homecoming: { returnedOn: '2026-10-10', awayFrom: '2026-09-28', reason: 'HOSPITAL' }
      },
      accessPatch
    );
  for (const data of [rich(coordinator), rich({}), page({}, coordinator), page({ plan: {}, keys: [{ id: 'k', tag: '1', holder: null }, { id: 'k2', tag: '2', holder: { membershipId: 'm1' } }], supplies: [{ id: 'v', kind: 'FOOD', state: null }], transport: { requests: [], next: { wantedOn: '2026-10-14' } } }, coordinator)]) {
    const who = clientViewer(data);
    for (const tile of clientTiles(who, data, say)) assert.ok(tile.name && tile.line, tile.key);
    doorNotices(who, data, say);
    doorAlerts(who, data, say);
    reviewItems(data, say);
  }
  for (const view of [...CLIENT_PARTS, ...DOOR_VIEWS]) used.add(viewNameKey(view));
  assert.equal(viewNameKey('missing'), '');
  assert.equal(viewNameKey(''), '');
  assert.ok(used.size > 40, `võtmeid ${used.size}`);
  for (const key of used) {
    for (const lang of LANGS) {
      const value = at(catalogs[lang], key);
      assert.ok(typeof value === 'string' && value.trim(), `${lang}: ${key}`);
    }
  }
});

test('osa nimi mahub kiirmenüüsse', () => {
  /* Sama piir mis lehe nimedel (tests/home-care-org-shell.test.mjs): ladina 21, kirillitsas 19 tähte. */
  const limit = { et: 21, en: 21, ru: 19 };
  for (const lang of LANGS) {
    for (const view of [...CLIENT_PARTS, ...DOOR_VIEWS]) {
      const name = at(catalogs[lang], viewNameKey(view));
      assert.ok(typeof name === 'string' && name.length > 0 && name.length <= limit[lang], `${lang}: ${view} „${name}” on ${name?.length} tähte`);
      assert.ok(!/\{\w+\}/.test(name), `${lang}: ${view} ei tohi oodata muutujat`);
    }
    const pageName = at(catalogs[lang], 'home_care.client.page_name');
    assert.ok(pageName.length <= limit[lang], `${lang}: lehe nimi „${pageName}”`);
  }
});
