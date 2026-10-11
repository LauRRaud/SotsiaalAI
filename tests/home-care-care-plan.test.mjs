// KODUTEENUS kiht 2, K2-b — hoolduskava sõnastik: seisud, sagedus ja tegemise viis.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CARE_ACTIVITY_GROUPS,
  CARE_PLAN_FREQUENCIES,
  CARE_PLAN_MODES,
  CARE_PLAN_STATUSES,
  HOME_CARE_LIMITS
} from '../lib/homeCare/constants.js';

const sql = readFileSync(new URL('../prisma/migrations/20261010050000_home_care_care_plan/migration.sql', import.meta.url), 'utf8');
const list = (text) => [...text.matchAll(/'([A-Z_]+)'/g)].map((match) => match[1]);

test('hoolduskava: koodi sõnastikud ja andmebaasi CHECK-id on täpselt samad', () => {
  assert.deepEqual(list(/"CarePlan_status_check" CHECK \("status" IN \(([^)]*)\)\)/.exec(sql)[1]), [...CARE_PLAN_STATUSES]);
  assert.deepEqual(list(/"CarePlanLine_mode_check" CHECK \("mode" IN \(([^)]*)\)\)/.exec(sql)[1]), [...CARE_PLAN_MODES]);
  assert.deepEqual(list(/"CarePlanLine_activityGroup_check" CHECK \("activityGroup" IN \(([\s\S]*?)\)\);/.exec(sql)[1]), [...CARE_ACTIVITY_GROUPS]);
  /* Sagedus: „vajadusel" ilma arvuta, muu arvuga; arvu ülempiir on sama mis koodis. */
  const frequency = /"CarePlanLine_frequency_check" CHECK \(([\s\S]*?)\n  \);/.exec(sql)[1];
  assert.deepEqual([...new Set(list(frequency))].sort(), [...CARE_PLAN_FREQUENCIES].sort());
  assert.match(frequency, /"frequencyCount" IS NOT NULL/);
  assert.match(frequency, new RegExp(`BETWEEN 1 AND ${HOME_CARE_LIMITS.PLAN_FREQUENCY_MAX}\\b`));
  /* Tegemise viisid on järjekorras iseseisvamast vähem iseseisvani. */
  assert.deepEqual(CARE_PLAN_MODES, ['GUIDE', 'TOGETHER', 'ASSIST', 'FOR']);
});

test('hoolduskava: kliendil on korraga kõige rohkem üks mustand ja üks kehtiv kava', () => {
  assert.match(sql, /CREATE UNIQUE INDEX "CarePlan_clientId_draft_key" ON "CarePlan"\("clientId"\) WHERE "status" = 'DRAFT';/);
  assert.match(sql, /CREATE UNIQUE INDEX "CarePlan_clientId_active_key" ON "CarePlan"\("clientId"\) WHERE "status" = 'ACTIVE';/);
  /* Seis ja ajatemplid käivad koos: kolm haru, igaühes mõlema ajatempli kohta selge nõue. */
  const state = /"CarePlan_state_check" CHECK \(([\s\S]*?)\n  \);/.exec(sql)[1];
  assert.equal((state.match(/"activatedAt" IS (NOT )?NULL/g) || []).length, 3);
  assert.equal((state.match(/"replacedAt" IS (NOT )?NULL/g) || []).length, 3);
});

test('hoolduskava tekstid on kolmes keeles', () => {
  for (const locale of ['et', 'en', 'ru']) {
    const hc = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).home_care;
    for (const value of CARE_PLAN_FREQUENCIES) assert.ok(hc.plan.frequency[value], `${locale} ${value}`);
    for (const value of CARE_PLAN_FREQUENCIES.filter((item) => item !== 'AS_NEEDED')) {
      assert.match(hc.plan.frequency_count[value], /\{count\}/, `${locale} ${value}`);
    }
    for (const value of CARE_PLAN_MODES) assert.ok(hc.plan.modes[value], `${locale} ${value}`);
    for (const key of [
      'plan_activity_required',
      'plan_activity_unknown',
      'plan_activity_repeated',
      'plan_frequency_required',
      'plan_frequency_count_invalid',
      'plan_mode_required',
      'plan_too_many_lines',
      'plan_draft_not_found',
      'plan_empty'
    ]) {
      assert.ok(hc.errors[key], `${locale} ${key}`);
    }
  }
});
