// KODUTEENUS kiht 3, K3-c — töötaja puudumine ja käigu tähtsus: sõnastikud ja päevaplaani reegel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CARE_ABSENCE_KINDS, CARE_VISIT_PRIORITIES } from '../lib/homeCare/constants.js';
import { buildDayPlan } from '../lib/homeCare/dayPlan.js';

const sql = readFileSync(new URL('../prisma/migrations/20261010170000_home_care_absences/migration.sql', import.meta.url), 'utf8');
const list = (text) => [...text.matchAll(/'([A-Z_]+)'/g)].map((match) => match[1]);

test('puudumine ja tähtsus: andmebaasi CHECK-id ja koodi sõnastikud on samad', () => {
  assert.deepEqual(list(/"CareAbsence_kind_check" CHECK \("kind" IN \(([^)]*)\)\)/.exec(sql)[1]), [...CARE_ABSENCE_KINDS]);
  assert.deepEqual(list(/"CareVisitSlot_priority_check" CHECK \("priority" IN \(([^)]*)\)\)/.exec(sql)[1]), [...CARE_VISIT_PRIORITIES]);
  assert.deepEqual([...CARE_VISIT_PRIORITIES], ['A', 'B', 'C']);
  assert.match(sql, /ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'B';/);
  assert.match(sql, /"toDay" >= "fromDay"/);
  /* Põhjuse ega vaba teksti välja tabelis ei ole. */
  const table = /CREATE TABLE "CareAbsence" \(([\s\S]*?)\n\);/.exec(sql)[1];
  assert.doesNotMatch(table, /"(reason|note|text|diagnosis)"/);
});

test('päevaplaan: tegija puudub ainult veel tegemata käigul; tähtsus tuleb mustri realt', () => {
  const day = '2026-10-09';
  const slot = (id, clientId, startMinute, workerMembershipId, priority) => ({ id, clientId, startMinute, plannedMinutes: 30, workerMembershipId, priority, note: null });
  const slots = [
    slot('done', 'linda', 540, 'anu', 'C'),
    slot('ahead', 'linda', 720, 'anu', 'A'),
    slot('gone', 'linda', 1020, 'anu'),
    slot('other', 'peeter', 600, 'bert', 'B'),
    slot('nobody', 'peeter', 840, null, 'A')
  ];
  const plan = buildDayPlan({
    slots,
    changes: new Map([['gone', { kind: 'CANCELLED', reason: 'CLIENT_AWAY' }]]),
    recordCounts: new Map([['linda', 1]]),
    day,
    today: day,
    nowMinute: 600,
    absent: new Set(['anu'])
  });
  assert.deepEqual(
    plan.map((visit) => [visit.slotId, visit.state, visit.priority, visit.workerAbsent]),
    [
      /* Tehtud ja ära jäetud käik ei vaja asendajat, kuigi tegija puudub. */
      ['done', 'DONE', 'C', false],
      ['other', 'PLANNED', 'B', false],
      ['ahead', 'PLANNED', 'A', true],
      /* Määramata käigul ei ole tegijat, kes puududa saaks. */
      ['nobody', 'PLANNED', 'A', false],
      /* Tähtsuseta rida (enne seda välja) on B. */
      ['gone', 'CANCELLED', 'B', false]
    ]
  );
  /* Ilma puudujateta ei ole ükski käik katmata. */
  assert.equal(buildDayPlan({ slots, changes: new Map(), recordCounts: new Map(), day, today: day, nowMinute: 0 }).some((visit) => visit.workerAbsent), false);
  /* Ümber tõstetud käigul loeb selle päeva tegija, mitte mustri oma. */
  const moved = buildDayPlan({
    slots,
    changes: new Map([['ahead', { kind: 'MOVED', workerMembershipId: 'bert', startMinute: null }]]),
    recordCounts: new Map(),
    day,
    today: day,
    nowMinute: 0,
    absent: new Set(['anu'])
  });
  assert.equal(moved.find((visit) => visit.slotId === 'ahead').workerAbsent, false);
});

test('puudumiste ja tähtsuse tekstid on kolmes keeles', () => {
  for (const locale of ['et', 'en', 'ru']) {
    const hc = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).home_care;
    for (const value of CARE_VISIT_PRIORITIES) {
      assert.ok(hc.priority[value], `${locale} ${value}`);
      assert.ok(hc.priority.short[value], `${locale} ${value}`);
    }
    for (const value of CARE_ABSENCE_KINDS) assert.ok(hc.absences.kinds[value], `${locale} ${value}`);
    assert.match(hc.absences.period, /\{from\}[\s\S]*\{to\}[\s\S]*\{days\}/, locale);
    assert.match(hc.day.absent_worker, /\{name\}/, locale);
    assert.match(hc.day.totals, /\{uncovered\}/, locale);
    for (const key of [
      'absence_days_required',
      'absence_period_invalid',
      'absence_from_past',
      'absence_too_long',
      'absence_kind_required',
      'absence_worker_invalid',
      'absence_overlap',
      'absence_not_found',
      'slot_priority_invalid',
      'visit_worker_absent'
    ]) {
      assert.ok(hc.errors[key], `${locale} ${key}`);
    }
  }
});
