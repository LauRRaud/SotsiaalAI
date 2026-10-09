// KODUTEENUS kiht 2, K2-c — otsus ja maht: sõnastik, seisu reegel ja tähtaegade arvutus.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CARE_DECISION_KINDS,
  CARE_DECISION_STATES,
  CARE_VOLUME_PERIODS,
  HOME_CARE_LIMITS
} from '../lib/homeCare/constants.js';
import { decisionCoverage } from '../lib/homeCare/deadlines.js';
import { daysBetween, decisionState, todayText } from '../lib/homeCare/decisions.js';

const sql = readFileSync(new URL('../prisma/migrations/20261010070000_home_care_decision/migration.sql', import.meta.url), 'utf8');
const list = (text) => [...text.matchAll(/'([A-Z_]+)'/g)].map((match) => match[1]);

test('otsus: koodi sõnastikud ja andmebaasi CHECK-id on täpselt samad', () => {
  assert.deepEqual(list(/"CareDecision_kind_check" CHECK \("kind" IN \(([^)]*)\)\)/.exec(sql)[1]), [...CARE_DECISION_KINDS]);
  const volume = /"CareDecision_volume_check" CHECK \(([\s\S]*?)\n  \);/.exec(sql)[1];
  assert.deepEqual(list(volume), [...CARE_VOLUME_PERIODS]);
  /* Mõlemad väljad koos või mitte kumbki: NULL ei tohi kontrollist läbi lipsata. */
  assert.match(volume, /"volumeMinutes" IS NULL AND "volumePeriod" IS NULL/);
  assert.match(volume, /"volumeMinutes" IS NOT NULL AND "volumePeriod" IS NOT NULL/);
  assert.match(volume, new RegExp(`'WEEK' AND "volumeMinutes" BETWEEN 1 AND ${HOME_CARE_LIMITS.DECISION_WEEK_MINUTES_MAX}\\b`));
  assert.match(volume, new RegExp(`'MONTH' AND "volumeMinutes" BETWEEN 1 AND ${HOME_CARE_LIMITS.DECISION_MONTH_MINUTES_MAX}\\b`));
  assert.equal(HOME_CARE_LIMITS.DECISION_WEEK_MINUTES_MAX, 7 * 24 * 60);
  assert.equal(HOME_CARE_LIMITS.DECISION_MONTH_MINUTES_MAX, 31 * 24 * 60);
  assert.match(sql, /"CareDecision_period_check" CHECK \("validUntil" IS NULL OR "validUntil" >= "validFrom"\)/);
});

test('otsuse seis: tulemas, kehtib, lõppenud, tühistatud; piiripäevad kuuluvad kehtivusse', () => {
  const decision = { validFrom: '2026-09-01', validUntil: '2026-12-31', retractedAt: null };
  assert.equal(decisionState(decision, '2026-08-31'), 'UPCOMING');
  assert.equal(decisionState(decision, '2026-09-01'), 'IN_FORCE');
  assert.equal(decisionState(decision, '2026-12-31'), 'IN_FORCE');
  assert.equal(decisionState(decision, '2027-01-01'), 'ENDED');
  assert.equal(decisionState({ ...decision, validUntil: null }, '2031-01-01'), 'IN_FORCE');
  assert.equal(decisionState({ ...decision, retractedAt: new Date() }, '2026-10-01'), 'RETRACTED');
  assert.deepEqual([...CARE_DECISION_STATES].sort(), ['ENDED', 'IN_FORCE', 'RETRACTED', 'UPCOMING']);
});

test('päevade vahe ja tänane päev asutuse ajavööndis', () => {
  assert.equal(daysBetween('2026-10-09', '2026-10-09'), 0);
  assert.equal(daysBetween('2026-10-09', '2026-11-08'), 30);
  assert.equal(daysBetween('2026-10-09', '2026-10-01'), -8);
  /* Üle kellakeeramise (25.10.2026) ja aastavahetuse on vahe ikka täispäevades. */
  assert.equal(daysBetween('2026-10-24', '2026-10-26'), 2);
  assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1);
  /* Kell 22.30 UTC on Tallinnas juba järgmine päev. */
  assert.equal(todayText(new Date('2026-10-09T22:30:00Z'), 'Europe/Tallinn'), '2026-10-10');
  assert.equal(todayText(new Date('2026-10-09T20:30:00Z'), 'Europe/Tallinn'), '2026-10-09');
});

test('otsuste kate: kehtiv, järgnev, tähtajatu ja lünk', () => {
  const today = '2026-10-09';
  const d = (validFrom, validUntil, extra = {}) => ({ validFrom, validUntil, retractedAt: null, ...extra });

  /* Otsust ei ole üldse. */
  assert.deepEqual(decisionCoverage([], today), { inForce: false, lastEndedOn: null, nextFrom: null, coveredUntil: null });
  /* Lõppenud otsus ja tulemas uus: täna kehtivat ei ole. */
  assert.deepEqual(decisionCoverage([d('2026-01-01', '2026-09-30'), d('2026-11-01', null)], today), {
    inForce: false,
    lastEndedOn: '2026-09-30',
    nextFrom: '2026-11-01',
    coveredUntil: null
  });
  /* Kehtiv tähtajaline: kate lõpeb selle lõpuga. */
  assert.equal(decisionCoverage([d('2026-01-01', '2026-11-08')], today).coveredUntil, '2026-11-08');
  /* Kehtiv tähtajaline ja juba sisestatud järgmine: kate ulatub järgmise lõpuni. */
  assert.equal(decisionCoverage([d('2026-01-01', '2026-11-08'), d('2026-11-09', '2027-11-08')], today).coveredUntil, '2027-11-08');
  /* Tähtajatu (kehtiv või tulemas): tähtaega ei ole. */
  assert.equal(decisionCoverage([d('2026-01-01', null)], today).coveredUntil, null);
  assert.equal(decisionCoverage([d('2026-01-01', '2026-11-08'), d('2026-11-09', null)], today).coveredUntil, null);
  assert.equal(decisionCoverage([d('2026-01-01', null)], today).inForce, true);
  /* Tühistatud otsus ei loe: ainus kehtiv otsus on tühistatud. */
  assert.equal(decisionCoverage([d('2026-01-01', null, { retractedAt: new Date() })], today).inForce, false);
  /* Täna lõppev otsus kehtib veel täna. */
  assert.deepEqual(decisionCoverage([d('2026-01-01', today)], today), { inForce: true, lastEndedOn: null, nextFrom: null, coveredUntil: today });
});

test('otsuse ja tähtaegade tekstid on kolmes keeles', () => {
  for (const locale of ['et', 'en', 'ru']) {
    const hc = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).home_care;
    for (const value of CARE_DECISION_KINDS) assert.ok(hc.decision.kinds[value], `${locale} ${value}`);
    for (const value of CARE_DECISION_STATES) assert.ok(hc.decision.states[value], `${locale} ${value}`);
    for (const value of CARE_VOLUME_PERIODS) {
      assert.match(hc.decision.volume[value], /\{amount\}/, `${locale} ${value}`);
      assert.ok(hc.decision.periods[value], `${locale} ${value}`);
    }
    for (const key of ['decisions_ending', 'no_decision', 'plans_due', 'no_plan']) {
      assert.ok(hc.deadlines[`${key}_title`], `${locale} ${key}`);
      assert.ok(hc.deadlines[`${key}_empty`], `${locale} ${key}`);
    }
    for (const key of ['today', 'tomorrow', 'in', 'yesterday', 'ago']) assert.ok(hc.deadlines.days[key], `${locale} ${key}`);
    for (const key of [
      'decision_kind_required',
      'decision_valid_from_required',
      'decision_period_invalid',
      'decision_volume_invalid',
      'decision_volume_period_required',
      'decision_not_found',
      'decision_retracted',
      'decision_too_many'
    ]) {
      assert.ok(hc.errors[key], `${locale} ${key}`);
    }
  }
});
