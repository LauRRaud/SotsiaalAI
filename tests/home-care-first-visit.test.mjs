import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { CARE_FIRST_VISIT_OUTCOMES } from '../lib/homeCare/constants.js';
import { firstVisitState, normalizeFirstVisit } from '../lib/homeCare/firstVisits.js';

const TODAY = '2026-10-09';
const WORKER = 'cmv0000000000000000000a1';
const fails = (fn, key) => assert.throws(fn, (error) => error?.messageKey === key, key);

test('esmakäik: käinud töötajal seisu ei ole; käimata töötajal on teatamise tulemus või tühi', () => {
  assert.equal(firstVisitState({ known: true }), null);
  assert.equal(firstVisitState({ known: true, notice: { outcome: 'CALLED' } }), null);
  assert.deepEqual(firstVisitState({ known: false }), { outcome: null, byName: null });
  assert.deepEqual(firstVisitState({ known: false, notice: { outcome: 'CALLED', createdByName: 'Juta Juht' } }), { outcome: 'CALLED', byName: 'Juta Juht' });
});

test('esmakäigu märke sisend: päev aknas „nädal tagasi kuni kuu ette", töötaja ja tulemus kohustuslikud', () => {
  assert.deepEqual(normalizeFirstVisit({ day: '2026-10-10', workerMembershipId: WORKER, outcome: 'called' }, TODAY), { day: '2026-10-10', workerMembershipId: WORKER, outcome: 'CALLED' });
  assert.equal(normalizeFirstVisit({ day: '2026-10-02', workerMembershipId: WORKER, outcome: 'NOT_REACHED' }, TODAY).day, '2026-10-02');
  assert.equal(normalizeFirstVisit({ day: '2026-11-09', workerMembershipId: WORKER, outcome: 'TOLD_BY_REGULAR' }, TODAY).day, '2026-11-09');
  fails(() => normalizeFirstVisit({ workerMembershipId: WORKER, outcome: 'CALLED' }, TODAY), 'home_care.errors.first_visit_day');
  fails(() => normalizeFirstVisit({ day: '2026-10-01', workerMembershipId: WORKER, outcome: 'CALLED' }, TODAY), 'home_care.errors.first_visit_day');
  fails(() => normalizeFirstVisit({ day: '2026-11-10', workerMembershipId: WORKER, outcome: 'CALLED' }, TODAY), 'home_care.errors.first_visit_day');
  fails(() => normalizeFirstVisit({ day: '2026-10-10', outcome: 'CALLED' }, TODAY), 'home_care.errors.first_visit_worker');
  fails(() => normalizeFirstVisit({ day: '2026-10-10', workerMembershipId: WORKER, outcome: 'SMS' }, TODAY), 'home_care.errors.first_visit_outcome');
});

test('esmakäigu tekstid on kolmes keeles', () => {
  for (const locale of ['et', 'en', 'ru']) {
    const catalogue = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).home_care;
    for (const key of ['day_line', 'not_marked', 'my_line', 'my_not_marked']) assert.ok(catalogue.first_visit[key], `${locale} ${key}`);
    for (const outcome of CARE_FIRST_VISIT_OUTCOMES) {
      for (const group of ['outcomes', 'mark', 'my_outcomes']) assert.ok(catalogue.first_visit[group][outcome], `${locale} ${group}.${outcome}`);
    }
    for (const key of ['first_visit_day', 'first_visit_worker', 'first_visit_outcome']) assert.ok(catalogue.errors[key], `${locale} ${key}`);
  }
});
