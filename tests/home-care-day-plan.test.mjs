// KODUTEENUS kiht 3, K3-b — päevaplaan: mustri read, ühe päeva erandid ja käigu seis.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CARE_PLANNED_STATES, CARE_VISIT_CANCEL_REASONS, CARE_VISIT_CHANGE_KINDS, HOME_CARE_LIMITS } from '../lib/homeCare/constants.js';
import { buildDayPlan } from '../lib/homeCare/dayPlan.js';

const sql = readFileSync(new URL('../prisma/migrations/20261010150000_home_care_visit_changes/migration.sql', import.meta.url), 'utf8');
const list = (text) => [...text.matchAll(/'([A-Z_]+)'/g)].map((match) => match[1]);

const DAY = '2026-10-09';
const slot = (id, clientId, startMinute, workerMembershipId = 'anu', plannedMinutes = 30) => ({ id, clientId, startMinute, plannedMinutes, workerMembershipId, note: null });
const plan = ({ slots, changes = {}, records = {}, day = DAY, today = DAY, nowMinute = 0 }) =>
  buildDayPlan({ slots, changes: new Map(Object.entries(changes)), recordCounts: new Map(Object.entries(records)), day, today, nowMinute });
const view = (visits) => visits.map((visit) => [visit.slotId, visit.startMinute, visit.workerMembershipId, visit.state]);

test('erand: andmebaasi CHECK ja koodi sõnastikud on samad', () => {
  const kind = /"CareVisitChange_kind_check" CHECK \(([\s\S]*?)\n  \);/.exec(sql)[1];
  assert.deepEqual(list(kind).filter((value) => CARE_VISIT_CHANGE_KINDS.includes(value)).sort(), [...CARE_VISIT_CHANGE_KINDS].sort());
  assert.deepEqual(list(kind).filter((value) => !CARE_VISIT_CHANGE_KINDS.includes(value)), [...CARE_VISIT_CANCEL_REASONS]);
  /* Ärajätmisel on põhjus kohustuslik ja töötajat ega aega ei ole; ümbertõstmisel põhjuse koodi ei ole. */
  assert.match(kind, /'CANCELLED' AND "reason" IS NOT NULL/);
  assert.match(kind, /"workerMembershipId" IS NULL AND "startMinute" IS NULL/);
  assert.match(kind, /"kind" = 'MOVED' AND "reason" IS NULL/);
  assert.match(sql, /CREATE UNIQUE INDEX "CareVisitChange_slotId_day_key" ON "CareVisitChange"\("slotId", "day"\);/);
  assert.deepEqual([...CARE_PLANNED_STATES].sort(), ['CANCELLED', 'DONE', 'MISSING', 'PLANNED']);
});

test('käigu seis: kirjed katavad käike kellaaja järjekorras; möödunud päeval on katmata käik kirjeta', () => {
  const slots = [slot('evening', 'linda', 1020), slot('morning', 'linda', 540), slot('other', 'peeter', 600, 'bert')];
  /* Täna hommikul, üks Linda kirje: hommikune käik on tehtud, õhtune ees; Peetril kirjet ei ole. */
  assert.deepEqual(view(plan({ slots, records: { linda: 1 }, nowMinute: 600 })), [
    ['morning', 540, 'anu', 'DONE'],
    ['other', 600, 'bert', 'PLANNED'],
    ['evening', 1020, 'anu', 'PLANNED']
  ]);
  /* Rohkem kirjeid kui käike: kõik on tehtud. */
  assert.deepEqual(view(plan({ slots, records: { linda: 5 } })).map((row) => row[3]), ['DONE', 'PLANNED', 'DONE']);
  /* Möödunud päev: kirjeta käik on „kirje puudub". Tulevane päev: kõik on ees. */
  assert.deepEqual(view(plan({ slots, records: { linda: 1 }, day: '2026-10-02' })).map((row) => row[3]), ['DONE', 'MISSING', 'MISSING']);
  assert.deepEqual(view(plan({ slots, day: '2026-10-16' })).map((row) => row[3]), ['PLANNED', 'PLANNED', 'PLANNED']);
});

test('tänane kirjeta käik: „kirje puudub" alles siis, kui plaanitud lõpust on üle lubatud aja', () => {
  const slots = [slot('visit', 'linda', 540, 'anu', 45)];
  const limit = 540 + 45 + HOME_CARE_LIMITS.VISIT_MISSING_GRACE_MIN;
  assert.equal(plan({ slots, nowMinute: limit })[0].state, 'PLANNED');
  assert.equal(plan({ slots, nowMinute: limit + 1 })[0].state, 'MISSING');
  /* Kirje olemasolul ei loe kellaaeg. */
  assert.equal(plan({ slots, records: { linda: 1 }, nowMinute: limit + 300 })[0].state, 'DONE');
});

test('erandid: ümbertõstmine muudab töötajat ja aega, ärajätmine jätab käigu arvestusest välja', () => {
  const slots = [slot('morning', 'linda', 540), slot('evening', 'linda', 1020)];
  /* Ümbertõstmine: teine töötaja ja teine kellaaeg; aeg määrab ka järjekorra ja selle, mille kirje katab. */
  const moved = plan({ slots, changes: { morning: { kind: 'MOVED', workerMembershipId: 'bert', startMinute: 1080 } }, records: { linda: 1 } });
  assert.deepEqual(view(moved), [
    ['evening', 1020, 'anu', 'DONE'],
    ['morning', 1080, 'bert', 'PLANNED']
  ]);
  assert.deepEqual([moved[1].baseWorkerMembershipId, moved[1].baseStartMinute, moved[1].change.kind], ['anu', 540, 'MOVED']);
  /* Ainult töötaja vahetus: aeg jääb mustri omaks. Töötajata ümbertõstmine = sel päeval määramata. */
  assert.deepEqual(view(plan({ slots, changes: { morning: { kind: 'MOVED', workerMembershipId: 'bert', startMinute: null } } }))[0], ['morning', 540, 'bert', 'PLANNED']);
  assert.equal(plan({ slots, changes: { morning: { kind: 'MOVED', workerMembershipId: null, startMinute: null } } })[0].workerMembershipId, null);
  /* Ärajätmine: käik on ära jäetud (jääb mustri töötaja alla) ja päeva kirje katab järgmise käigu. */
  const cancelled = plan({ slots, changes: { morning: { kind: 'CANCELLED', reason: 'CLIENT_AWAY', note: 'Arsti juures' } }, records: { linda: 1 } });
  assert.deepEqual(view(cancelled), [
    ['morning', 540, 'anu', 'CANCELLED'],
    ['evening', 1020, 'anu', 'DONE']
  ]);
  assert.deepEqual(cancelled[0].change, { kind: 'CANCELLED', reason: 'CLIENT_AWAY', note: 'Arsti juures' });
  /* Ära jäetud käik ei muutu möödunud päeval kirjeta käiguks. */
  assert.equal(plan({ slots, changes: { morning: { kind: 'CANCELLED', reason: 'OTHER' } }, day: '2026-10-02' })[0].state, 'CANCELLED');
});

test('päevaplaani tekstid on kolmes keeles', () => {
  for (const locale of ['et', 'en', 'ru']) {
    const hc = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).home_care;
    for (const value of CARE_PLANNED_STATES) assert.ok(hc.day.states[value], `${locale} ${value}`);
    for (const value of CARE_VISIT_CANCEL_REASONS) assert.ok(hc.day.cancel_reasons[value], `${locale} ${value}`);
    assert.match(hc.day.totals, /\{planned\}[\s\S]*\{amount\}[\s\S]*\{done\}[\s\S]*\{missing\}[\s\S]*\{cancelled\}[\s\S]*\{unassigned\}/, locale);
    assert.match(hc.month.cancelled_count, /\{count\}/, locale);
    for (const key of [
      'visit_not_on_day',
      'visit_day_required',
      'visit_day_past',
      'visit_day_far',
      'visit_worker_invalid',
      'visit_cancel_reason_required',
      'visit_change_not_found'
    ]) {
      assert.ok(hc.errors[key], `${locale} ${key}`);
    }
  }
});
