// KODUTEENUS kiht 3, K3-g — töö iseloom kliendi juures: sõnastik, andmebaasi piirid, nädala loendur ja tekstid.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CARE_WORK_NATURE_KINDS, HOME_CARE_LIMITS } from '../lib/homeCare/constants.js';
import { buildDayPlan, buildWeekLoad } from '../lib/homeCare/dayPlan.js';

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const sql = source('../prisma/migrations/20261010210000_home_care_work_nature/migration.sql');

test('töö iseloom: andmebaasi CHECK ja koodi sõnastik on samad; üks kehtiv märge kliendi kohta', () => {
  const listed = [.../ARRAY\[([^\]]*)\]::TEXT\[\]/.exec(sql)[1].matchAll(/'([A-Z_]+)'/g)].map((match) => match[1]);
  assert.deepEqual(listed, [...CARE_WORK_NATURE_KINDS]);
  assert.deepEqual([...CARE_WORK_NATURE_KINDS], ['PHYSICAL', 'MENTAL', 'ENVIRONMENT', 'PAIR_ONLY']);
  /* CHECK laseb NULL-i läbi, seega peab `IS NOT NULL` olema kirjas. */
  assert.match(sql, /"kinds" IS NOT NULL\s+AND cardinality\("kinds"\) BETWEEN 1 AND 4/);
  assert.match(sql, /CREATE UNIQUE INDEX "CareWorkNature_current_key" ON "CareWorkNature"\("clientId"\) WHERE "endedAt" IS NULL;/);
  assert.match(sql, new RegExp(`char_length\\(btrim\\("reason"\\)\\) BETWEEN 1 AND ${HOME_CARE_LIMITS.WORK_NATURE_REASON_MAX}`));
  assert.match(sql, /^SET lock_timeout = '5s';\r?\nSET statement_timeout = '30s';/m);
  /* Märge on kliendi küljes ja kirjeldab tööd: töötajale viitavat välja peale märkija ja lõpetaja jälje ei ole. */
  const table = /CREATE TABLE "CareWorkNature" \(([\s\S]*?)\r?\n\);/.exec(sql)[1];
  assert.doesNotMatch(table, /"(membershipId|workerMembershipId)"/);
});

test('teenus ei muuda ega kustuta märke rida: uus märge lõpetab eelmise', () => {
  const service = source('../lib/homeCare/workNature.js');
  assert.doesNotMatch(service, /careWorkNature\.(delete|deleteMany|update)\(/);
  assert.match(service, /await endCurrent\(tx, context, id, now\);\s+const created = await tx\.careWorkNature\.create/);
});

test('nädala koormus: raske töö märgiga kliendi käigud loetakse töötaja real eraldi; katmata ja ära jäetud käiku ei loeta', () => {
  const slot = (id, clientId, startMinute, workerMembershipId) => ({ id, clientId, startMinute, plannedMinutes: 30, workerMembershipId, priority: 'B', note: null });
  const slots = [slot('a1', 'linda', 540, 'anu'), slot('a2', 'peeter', 720, 'anu'), slot('b1', 'linda', 600, 'bert'), slot('b2', 'linda', 900, 'bert')];
  const plan = (day, changes = new Map(), absent = new Set()) => buildDayPlan({ slots, changes, recordCounts: new Map(), day, today: '2026-10-12', nowMinute: 0, absent });
  const absentByDay = new Map([['2026-10-12', new Set()], ['2026-10-13', new Set(['bert'])]]);
  const days = new Map([
    ['2026-10-12', plan('2026-10-12', new Map([['b2', { kind: 'CANCELLED', reason: 'CLIENT_AWAY' }]]))],
    ['2026-10-13', plan('2026-10-13', new Map(), absentByDay.get('2026-10-13'))]
  ]);
  const load = buildWeekLoad(days, absentByDay, new Set(['linda']));
  const row = (id) => load.workers.find((worker) => worker.membershipId === id);
  /* Anu: kummalgi päeval üks käik Linda (märgiga) ja üks Peetri juures. */
  assert.deepEqual([row('anu').visits, row('anu').heavy], [4, 2]);
  /* Bert: esmaspäeval üks käik Linda juures (teine jäi ära); teisipäeval puudub, tema käigud on katmata. */
  assert.deepEqual([row('bert').visits, row('bert').heavy, row('bert').uncovered], [1, 1, 2]);
  /* Ilma märgiga klientideta on loendur null. */
  assert.deepEqual(buildWeekLoad(days, absentByDay).workers.map((worker) => worker.heavy), [0, 0]);
});

test('töö iseloomu tekstid on kolmes keeles', () => {
  for (const locale of ['et', 'en', 'ru']) {
    const hc = JSON.parse(source(`../messages/${locale}.json`)).home_care;
    for (const kind of CARE_WORK_NATURE_KINDS) assert.ok(hc.work_nature.kinds[kind], `${locale} ${kind}`);
    assert.match(hc.work_nature.heavy_visits, /\{count\}/, locale);
    assert.match(hc.work_nature.worker_option, /\{name\}[\s\S]*\{count\}[\s\S]*\{heavy\}/, locale);
    assert.match(hc.work_nature.review_on, /\{date\}/, locale);
    assert.match(hc.work_nature.set_by, /\{name\}/, locale);
    for (const key of ['title', 'none', 'kinds_label', 'kinds_hint', 'reason_label', 'reason_hint', 'review_label', 'add', 'edit', 'save', 'cancel', 'clear']) {
      assert.ok(hc.work_nature[key], `${locale} ${key}`);
    }
    assert.ok(hc.deadlines.work_nature_due_title && hc.deadlines.work_nature_due_empty, locale);
    for (const key of ['work_nature_kinds_required', 'work_nature_reason_required', 'work_nature_review_past', 'work_nature_not_found']) {
      assert.ok(hc.errors[key], `${locale} ${key}`);
    }
  }
});
