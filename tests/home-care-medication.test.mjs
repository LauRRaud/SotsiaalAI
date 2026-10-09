import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { CARE_MEDICATION_ACTIONS } from '../lib/homeCare/constants.js';
import { CareMedicationState, MEDICATION_OPEN_STATES, medicationMonthCounts, medicationState } from '../lib/homeCare/medication.js';
import { entryRequestHash, normalizeEntryInput } from '../lib/homeCare/validation.js';

const NOW = new Date('2026-10-09T08:00:00Z');
const refused = (fn, key) => assert.throws(fn, (error) => error.status === 400 && error.messageKey === key, key);

test('ravimi seis päevaplaanis: kava, märked ja käigu seis', () => {
  const of = (inPlan, marks, visitState) => medicationState({ inPlan, marks, visitState });
  /* Kui kavas ravimitoimingut ei ole, ei näidata midagi, ka siis, kui keegi midagi märkis. */
  assert.equal(of(false, { done: 1, notDone: 0 }, 'DONE'), null);
  assert.equal(of(true, null, 'PLANNED'), 'DUE');
  assert.equal(of(true, { done: 1, notDone: 0 }, 'DONE'), 'MARKED');
  /* Tehtud märge kaalub tegemata märke üles (kaks käiku samal päeval). */
  assert.equal(of(true, { done: 1, notDone: 1 }, 'DONE'), 'MARKED');
  assert.equal(of(true, { done: 0, notDone: 1 }, 'DONE'), 'NOT_DONE');
  /* Käik on kirjas, aga ravimi kohta ei ole midagi: hooldusjuht küsib järele. */
  assert.equal(of(true, null, 'DONE'), 'UNMARKED');
  assert.equal(of(true, { done: 0, notDone: 0 }, 'DONE'), 'UNMARKED');
  assert.equal(of(true, null, 'MISSING'), 'MISSED');
  /* Ära jäetud käigu juures märki ei ole: äraolek ei ole puuduv märge. */
  assert.equal(of(true, null, 'CANCELLED'), null);
  assert.deepEqual([...MEDICATION_OPEN_STATES], [CareMedicationState.UNMARKED, CareMedicationState.MISSED]);
});

test('käigu toimingu sisend: märge ainult tehtud toimingul ja ainult loendist', () => {
  const body = (activity) => ({ kind: 'NOTE', contactMode: 'VISIT', activities: [activity] });
  const done = normalizeEntryInput(body({ activityId: 'act_123456', mode: 'GUIDE', medication: 'REMINDED' }), { now: NOW });
  assert.equal(done.visitActivities[0].medication, 'REMINDED');
  /* Märketa toimingul on väli määramata (parandus jätab siis senise märke alles). */
  assert.equal(normalizeEntryInput(body({ activityId: 'act_123456', mode: 'GUIDE' }), { now: NOW }).visitActivities[0].medication, undefined);
  /* Tegemata toimingul märget ei ole, ka siis, kui see saadeti. */
  assert.equal(normalizeEntryInput(body({ activityId: 'act_123456', outcome: 'REFUSED', medication: 'GAVE' }), { now: NOW }).visitActivities[0].medication, undefined);
  refused(() => normalizeEntryInput(body({ activityId: 'act_123456', mode: 'GUIDE', medication: 'SÜSTISIN' }), { now: NOW }), 'home_care.errors.medication_action_invalid');
});

test('kordussaatmise räsi: märketa toimingu räsi ei muutu, märge muudab räsi', () => {
  const body = (activity) => ({ kind: 'NOTE', contactMode: 'VISIT', occurredAt: '2026-10-09T07:00:00Z', activities: [activity] });
  const plain = entryRequestHash('client_1', normalizeEntryInput(body({ activityId: 'act_123456', mode: 'GUIDE' }), { now: NOW }));
  /* Sama keha nagu enne selle välja tulekut: seadme järjekorras ootav vanem kirje ei tohi konfliktiks muutuda. */
  const before = normalizeEntryInput(body({ activityId: 'act_123456', mode: 'GUIDE' }), { now: NOW });
  for (const item of before.visitActivities) delete item.medication;
  assert.equal(entryRequestHash('client_1', before), plain);
  const hashes = CARE_MEDICATION_ACTIONS.map((action) =>
    entryRequestHash('client_1', normalizeEntryInput(body({ activityId: 'act_123456', mode: 'GUIDE', medication: action }), { now: NOW }))
  );
  assert.equal(new Set([plain, ...hashes]).size, 4);
});

test('märked ja seisud on kolmes keeles; migratsiooni loend klapib koodiga', () => {
  for (const locale of ['et', 'en', 'ru']) {
    const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
    for (const action of CARE_MEDICATION_ACTIONS) assert.ok(messages.home_care.medication.actions[action], `${locale} ${action}`);
    for (const state of Object.values(CareMedicationState)) assert.ok(messages.home_care.medication.states[state], `${locale} ${state}`);
  }
  const sql = readFileSync(new URL('../prisma/migrations/20261011150000_home_care_medication_action/migration.sql', import.meta.url), 'utf8');
  for (const action of CARE_MEDICATION_ACTIONS) assert.ok(sql.includes(`'${action}'`), action);
  assert.match(sql, /^SET lock_timeout = '5s';\r?\nSET statement_timeout = '30s';/m);
});

test('kuu arvud: märked toimingu kaupa, märkimata ja tegemata eraldi, midagi ei ümardata', () => {
  assert.deepEqual(medicationMonthCounts([]), { reminded: 0, sawTaken: 0, gave: 0, unmarked: 0, notDone: 0 });
  assert.deepEqual(
    medicationMonthCounts([
      { outcome: 'DONE', medicationAction: 'REMINDED', count: 12 },
      { outcome: 'DONE', medicationAction: 'SAW_TAKEN', count: 15 },
      { outcome: 'DONE', medicationAction: 'GAVE', count: 2 },
      { outcome: 'DONE', medicationAction: null, count: 1 },
      { outcome: 'REFUSED', medicationAction: null, count: 2 },
      { outcome: 'COULD_NOT', medicationAction: null, count: 1 }
    ]),
    { reminded: 12, sawTaken: 15, gave: 2, unmarked: 1, notDone: 3 }
  );
  for (const locale of ['et', 'en', 'ru']) {
    const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
    for (const key of ['reminded', 'sawTaken', 'gave', 'unmarked', 'notDone']) assert.ok(messages.home_care.month.medication.includes(`{${key}}`), `${locale} ${key}`);
  }
});
