// KODUTEENUS kiht 3, K3-f — nädalaplaan: nädalanumber, koormuse arvutus ja tekstid.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HOME_CARE_LIMITS } from '../lib/homeCare/constants.js';
import { buildDayPlan, buildWeekLoad, isoWeekOf } from '../lib/homeCare/dayPlan.js';

test('ISO nädalanumber: nädal algab esmaspäevaga ja aasta esimene nädal on see, kus on neljapäev', () => {
  assert.deepEqual(
    ['2026-10-05', '2026-10-09', '2026-10-11', '2026-10-12', '2025-12-29', '2026-01-01', '2026-01-05', '2027-01-03', '2027-01-04', '2020-12-31', '2021-01-03', '2021-01-04'].map(isoWeekOf),
    [41, 41, 41, 42, 1, 1, 2, 53, 1, 53, 53, 1]
  );
});

test('nädala koormus: töötaja ja päeva kaupa; ära jäetud käiku ei loeta, puuduja käik on katmata, määramata on omaette', () => {
  const slot = (id, clientId, startMinute, workerMembershipId, plannedMinutes = 30) => ({ id, clientId, startMinute, plannedMinutes, workerMembershipId, priority: 'B', note: null });
  const slots = [slot('a1', 'linda', 540, 'anu'), slot('a2', 'linda', 720, 'anu', 60), slot('b1', 'peeter', 600, 'bert', 45), slot('u1', 'peeter', 840, null, 20)];
  const plan = (day, { changes = new Map(), absent = new Set(), records = new Map() } = {}) =>
    buildDayPlan({ slots, changes, recordCounts: records, day, today: '2026-10-12', nowMinute: 0, absent });
  const absentByDay = new Map([
    ['2026-10-12', new Set()],
    ['2026-10-13', new Set(['anu'])],
    ['2026-10-14', new Set(['anu'])]
  ]);
  const days = new Map([
    /* Esmaspäev: kõik nagu mustris. */
    ['2026-10-12', plan('2026-10-12')],
    /* Teisipäev: Anu puudub; üks tema käik on tõstetud Berdile, teine on katmata; Berdi oma käik jäi ära. */
    [
      '2026-10-13',
      plan('2026-10-13', {
        absent: absentByDay.get('2026-10-13'),
        changes: new Map([
          ['a1', { kind: 'MOVED', workerMembershipId: 'bert', startMinute: null }],
          ['b1', { kind: 'CANCELLED', reason: 'CLIENT_AWAY' }]
        ])
      })
    ],
    /* Kolmapäev: Anu puudub ja mõlemad tema käigud on katmata. */
    ['2026-10-14', plan('2026-10-14', { absent: absentByDay.get('2026-10-14') })]
  ]);
  const load = buildWeekLoad(days, absentByDay);

  assert.deepEqual(
    load.days.map((day) => [day.day, day.weekday, day.visits, day.minutes, day.unassigned, day.uncovered]),
    [
      ['2026-10-12', 1, 4, 155, 1, 0],
      ['2026-10-13', 2, 3, 110, 1, 1],
      ['2026-10-14', 3, 4, 155, 1, 2]
    ]
  );
  const row = (id) => load.workers.find((worker) => worker.membershipId === id);
  assert.deepEqual([row('anu').visits, row('anu').minutes, row('anu').uncovered], [2, 90, 3]);
  assert.deepEqual(
    row('anu').days.map((day) => [day.visits, day.minutes, day.uncovered, day.absent]),
    [
      [2, 90, 0, false],
      [0, 0, 1, true],
      [0, 0, 2, true]
    ]
  );
  /* Bert: esmaspäeval oma käik, teisipäeval ainult asendus (tema oma jäi ära), kolmapäeval oma käik. */
  assert.deepEqual([row('bert').visits, row('bert').minutes, row('bert').uncovered], [3, 120, 0]);
  assert.deepEqual(row('bert').days.map((day) => [day.visits, day.minutes, day.absent]), [[1, 45, false], [1, 30, false], [1, 45, false]]);
  assert.deepEqual([load.unassigned.visits, load.unassigned.minutes, load.unassigned.days.map((day) => day.visits)], [3, 60, [1, 1, 1]]);
  /* Tühi nädal: ridu ei ole, päevad on nullidega. */
  const empty = buildWeekLoad(new Map([['2026-10-12', []]]));
  assert.deepEqual([empty.workers, empty.unassigned.visits, empty.days[0].visits], [[], 0, 0]);
});

test('nädalaplaani piirid ja tekstid kolmes keeles', () => {
  assert.deepEqual([HOME_CARE_LIMITS.WEEK_PLAN_AHEAD_WEEKS, HOME_CARE_LIMITS.WEEK_PLAN_BACK_WEEKS], [13, 8]);
  for (const locale of ['et', 'en', 'ru']) {
    const week = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).home_care.week;
    assert.match(week.heading, /\{week\}[\s\S]*\{from\}[\s\S]*\{to\}/, locale);
    assert.match(week.totals, /\{visits\}[\s\S]*\{amount\}[\s\S]*\{unassigned\}[\s\S]*\{uncovered\}/, locale);
    assert.match(week.day_cell, /\{day\}[\s\S]*\{visits\}[\s\S]*\{unassigned\}[\s\S]*\{uncovered\}/, locale);
    assert.match(week.cell, /\{day\}[\s\S]*\{visits\}[\s\S]*\{amount\}/, locale);
    assert.match(week.cell_absent, /\{day\}[\s\S]*\{uncovered\}/, locale);
    assert.match(week.open_short, /\{count\}/, locale);
    assert.match(week.worker_total, /\{visits\}[\s\S]*\{amount\}/, locale);
    assert.match(week.worker_uncovered, /\{count\}/, locale);
    for (const key of ['link', 'title', 'intro', 'previous', 'next', 'this_week', 'days_label', 'absent_short', 'empty', 'legend']) {
      assert.ok(week[key], `${locale} ${key}`);
    }
    /* Lahtri sõna peab mahtuma kitsasse lahtrisse. */
    assert.ok(week.absent_short.length <= 6, locale);
  }
});
