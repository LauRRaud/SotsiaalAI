// KODUTEENUS K4-a — eeltingimus enne teenuse algust: sõnastik, andmebaasi piirid, päevade arvutus ja tekstid.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CARE_PRECONDITION_KINDS, CARE_PRECONDITION_OUTCOMES, HOME_CARE_LIMITS } from '../lib/homeCare/constants.js';
import { serializePrecondition } from '../lib/homeCare/preconditions.js';

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const sql = source('../prisma/migrations/20261010230000_home_care_preconditions/migration.sql');
const list = (text) => [...text.matchAll(/'([A-Z_]+)'/g)].map((match) => match[1]);

test('eeltingimus: andmebaasi CHECK-id ja koodi sõnastikud on samad', () => {
  assert.deepEqual(list(/"CarePrecondition_kind_check"\s+CHECK \("kind" IN \(([^)]*)\)\)/.exec(sql)[1]), [...CARE_PRECONDITION_KINDS]);
  assert.deepEqual([...CARE_PRECONDITION_KINDS], ['CLEANING', 'PEST_CONTROL', 'HEATING', 'ELECTRICITY', 'OTHER']);
  assert.deepEqual(list(/"outcome" IN \(([^)]*)\)/.exec(sql)[1]), [...CARE_PRECONDITION_OUTCOMES]);
  assert.match(sql, new RegExp(`char_length\\(btrim\\("note"\\)\\) BETWEEN 1 AND ${HOME_CARE_LIMITS.PRECONDITION_NOTE_MAX}`));
  assert.match(sql, new RegExp(`char_length\\(btrim\\("responsible"\\)\\) BETWEEN 1 AND ${HOME_CARE_LIMITS.PRECONDITION_RESPONSIBLE_MAX}`));
  /* Lahtisel real ei ole tulemust ja lõpetatud real on: mõlemad pooled on `IS NULL` / `IS NOT NULL` kujul kirjas. */
  assert.match(sql, /"closedAt" IS NULL AND "outcome" IS NULL/);
  assert.match(sql, /"closedAt" IS NOT NULL AND "outcome" IS NOT NULL/);
  assert.match(sql, /^SET lock_timeout = '5s';\r?\nSET statement_timeout = '30s';/m);
});

test('teenus ei kustuta eeltingimuse rida', () => {
  const service = source('../lib/homeCare/preconditions.js');
  assert.doesNotMatch(service, /carePrecondition\.(delete|deleteMany)\(/);
});

test('eeltingimuse vaade: tähtajani jäänud päevad tänase suhtes; tähtajata rida ei ole üle tähtaja', () => {
  const row = { id: 'p1', kind: 'CLEANING', note: null, responsible: 'Vald', dueOn: '2026-10-16', createdByName: 'Juta Juht' };
  assert.deepEqual(serializePrecondition(row, '2026-10-09'), {
    id: 'p1',
    kind: 'CLEANING',
    note: null,
    responsible: 'Vald',
    dueOn: '2026-10-16',
    daysLeft: 7,
    overdue: false,
    setByName: 'Juta Juht'
  });
  assert.deepEqual([serializePrecondition(row, '2026-10-16').daysLeft, serializePrecondition(row, '2026-10-16').overdue], [0, false]);
  assert.deepEqual([serializePrecondition(row, '2026-10-17').daysLeft, serializePrecondition(row, '2026-10-17').overdue], [-1, true]);
  const open = serializePrecondition({ ...row, dueOn: null }, '2026-10-09');
  assert.deepEqual([open.dueOn, open.daysLeft, open.overdue], [null, null, false]);
});

test('eeltingimuse tekstid on kolmes keeles', () => {
  for (const locale of ['et', 'en', 'ru']) {
    const hc = JSON.parse(source(`../messages/${locale}.json`)).home_care;
    for (const kind of CARE_PRECONDITION_KINDS) assert.ok(hc.precondition.kinds[kind], `${locale} ${kind}`);
    assert.match(hc.precondition.arranged_by, /\{name\}/, locale);
    assert.match(hc.precondition.due_on, /\{date\}[\s\S]*\{when\}/, locale);
    for (const key of ['title', 'waiting', 'none', 'badge', 'kind_label', 'note_label', 'note_hint', 'responsible_label', 'responsible_hint', 'due_label', 'no_due', 'add', 'save', 'cancel', 'done', 'drop']) {
      assert.ok(hc.precondition[key], `${locale} ${key}`);
    }
    assert.ok(hc.deadlines.preconditions_open_title && hc.deadlines.preconditions_open_empty, locale);
    assert.match(hc.errors.precondition_too_many, /\{limit\}/, locale);
    for (const key of [
      'precondition_kind_required',
      'precondition_note_required',
      'precondition_responsible_required',
      'precondition_not_found',
      'precondition_closed',
      'precondition_outcome_invalid'
    ]) {
      assert.ok(hc.errors[key], `${locale} ${key}`);
    }
  }
});
