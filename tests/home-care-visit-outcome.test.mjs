// KODUTEENUS kiht 2, K2-f — käigu lõpetamine erandite kaudu: tegemata jäänud toiming põhjusega.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CARE_ACTIVITY_OUTCOMES, CARE_ACTIVITY_SKIP_REASONS } from '../lib/homeCare/constants.js';
import { entryDocumentText } from '../lib/homeCare/chronology.js';
import { isDraftWorthKeeping } from '../lib/homeCare/outbox.js';
import { entryRequestHash, normalizeEntryInput } from '../lib/homeCare/validation.js';

const sql = readFileSync(new URL('../prisma/migrations/20261010110000_home_care_activity_outcome/migration.sql', import.meta.url), 'utf8');
const list = (text) => [...text.matchAll(/'([A-Z_]+)'/g)].map((match) => match[1]);
const NOW = new Date('2026-10-09T08:00:00Z');
const A = 'cmv0aaaaaaaaaaaaaaaaaaaa1';
const B = 'cmv0aaaaaaaaaaaaaaaaaaaa2';
const normalize = (input, base = null) => normalizeEntryInput(input, { now: NOW, base });
const failsWith = (input, key) =>
  assert.throws(
    () => normalize(input),
    (error) => error.status === 400 && error.messageKey === key,
    key
  );

test('toimingu tulemus: andmebaasi CHECK ja koodi sõnastik on samad; tegemata jääb ainult kava toiming', () => {
  assert.deepEqual(list(/"CareEntryActivity_outcome_check" CHECK \("outcome" IN \(([^)]*)\)\)/.exec(sql)[1]), [...CARE_ACTIVITY_OUTCOMES]);
  assert.deepEqual([...CARE_ACTIVITY_SKIP_REASONS], ['REFUSED', 'NOT_NEEDED', 'COULD_NOT']);
  assert.match(sql, /ADD COLUMN "outcome" TEXT NOT NULL DEFAULT 'DONE';/);
  assert.match(sql, /"CareEntryActivity_outcome_plan_check" CHECK \("outcome" = 'DONE' OR NOT "outsidePlan"\)/);
});

test('sisend: tegemata toimingul on põhjus ja tegemise viisi ei küsita; tulemuseta toiming on tehtud', () => {
  const visit = normalize({
    activities: [
      { activityId: A, mode: 'FOR' },
      { activityId: B, outcome: 'refused', mode: 'TOGETHER' }
    ]
  });
  assert.deepEqual(visit.visitActivities, [
    { activityId: A, mode: 'FOR', outcome: 'DONE' },
    /* Tegemata toimingul saadetud viisi ei arvestata: kava rea viisi paneb server. */
    { activityId: B, mode: null, outcome: 'REFUSED' }
  ]);
  /* Ainult tegemata jäänud toimingutega käik on samuti käigu kirje ega vaja teksti. */
  assert.equal(normalize({ activities: [{ activityId: A, outcome: 'NOT_NEEDED' }] }).text, '');
  failsWith({ activities: [{ activityId: A, outcome: 'MAYBE' }] }, 'home_care.errors.visit_outcome_invalid');
  /* Tehtud toimingul on viis endiselt kohustuslik. */
  failsWith({ activities: [{ activityId: A, outcome: 'DONE' }] }, 'home_care.errors.visit_mode_required');
});

test('päringu räsi: tehtud toimingu kuju on sama mis enne tulemuse välja; põhjus muudab räsi', () => {
  const body = { text: 'x', occurredAt: '2026-10-09T07:00:00Z', activities: [{ activityId: A, mode: 'FOR' }] };
  const done = normalize(body);
  /* Seadme järjekorras ootav kirje on normaliseeritud ilma tulemuse väljata: räsi peab olema sama. */
  const legacy = { ...done, visitActivities: done.visitActivities.map(({ activityId, mode }) => ({ activityId, mode })) };
  assert.equal(entryRequestHash('c1', done), entryRequestHash('c1', legacy));
  const refused = normalize({ ...body, activities: [{ activityId: A, outcome: 'REFUSED' }] });
  const notNeeded = normalize({ ...body, activities: [{ activityId: A, outcome: 'NOT_NEEDED' }] });
  assert.equal(new Set([done, refused, notNeeded].map((data) => entryRequestHash('c1', data))).size, 3);
});

test('mustand ja kronoloogia: tegemata toiming on töö, mida hoida, ja dokumendis eraldi lause', () => {
  assert.equal(isDraftWorthKeeping({ text: '', done: {}, skipped: { [A]: '' } }), true);
  assert.equal(isDraftWorthKeeping({ text: '', done: {}, skipped: {} }), false);
  const activities = [
    { activityName: 'Kütmine', mode: 'FOR', outcome: 'DONE' },
    { activityName: 'Pesemine', mode: 'ASSIST', outcome: 'REFUSED' },
    { activityName: 'Pesu', mode: 'FOR', outcome: 'COULD_NOT' }
  ];
  assert.equal(
    entryDocumentText({ text: '', visitMinutes: 30, activities }, 'et'),
    'Käik kestis 30 min. Tehtud: Kütmine (tegin tema eest). Tegemata: Pesemine (keeldus); Pesu (ei saanud teha).'
  );
  /* Ainult tegemata jäänud toimingud: lauset „Tehtud" ei ole. */
  assert.equal(entryDocumentText({ text: 'Ei lasknud tuppa.', visitMinutes: null, activities: [activities[1]] }, 'et'), 'Ei lasknud tuppa.\nTegemata: Pesemine (keeldus).');
  /* Tulemuseta rida (enne seda välja salvestatud) on tehtud. */
  assert.equal(entryDocumentText({ text: '', visitMinutes: null, activities: [{ activityName: 'Kütmine', mode: 'FOR' }] }, 'et'), 'Tehtud: Kütmine (tegin tema eest).');
});

test('tulemuse tekstid on kolmes keeles', () => {
  for (const locale of ['et', 'en', 'ru']) {
    const hc = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).home_care;
    for (const value of CARE_ACTIVITY_OUTCOMES) assert.ok(hc.visit.outcomes[value], `${locale} ${value}`);
    assert.match(hc.visit.mark_rest, /\{count\}/, locale);
    assert.match(hc.visit.doc.not_done, /\{list\}/, locale);
    assert.match(hc.month.not_done, /\{refused\}[\s\S]*\{notNeeded\}[\s\S]*\{couldNot\}/, locale);
    for (const key of ['skip', 'skip_label', 'skip_reason_label', 'reason_missing']) assert.ok(hc.visit[key], `${locale} ${key}`);
    for (const key of ['visit_outcome_invalid', 'visit_outcome_plan_only']) assert.ok(hc.errors[key], `${locale} ${key}`);
  }
});
