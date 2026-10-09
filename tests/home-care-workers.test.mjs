import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { CARE_WORKER_RECORD_KINDS } from '../lib/homeCare/constants.js';
import { normalizeWorkerRecord, workerRecordState } from '../lib/homeCare/workerRecords.js';

const TODAY = '2026-10-09';
const refused = (fn, key) => assert.throws(fn, (error) => error.status === 400 && error.messageKey === key, key);

test('töötaja kaardi rea sisend: koolitusel teema, taustakontrollil vaba teksti ei ole', () => {
  assert.deepEqual(normalizeWorkerRecord({ kind: 'TRAINING', title: '  Esmaabi   16 tundi ', doneOn: '2026-03-01', validUntil: '2029-03-01' }, TODAY), {
    kind: 'TRAINING',
    title: 'Esmaabi 16 tundi',
    doneOn: '2026-03-01',
    validUntil: '2029-03-01'
  });
  /* Taustakontrolli juurde saadetud tekst jäetakse välja: tulemust ega sisu ei hoita. */
  assert.deepEqual(normalizeWorkerRecord({ kind: 'BACKGROUND_CHECK', title: 'karistusi ei ole', doneOn: '2026-10-09' }, TODAY), {
    kind: 'BACKGROUND_CHECK',
    title: null,
    doneOn: '2026-10-09',
    validUntil: null
  });
  refused(() => normalizeWorkerRecord({ doneOn: '2026-03-01' }, TODAY), 'home_care.errors.worker_record_kind_required');
  refused(() => normalizeWorkerRecord({ kind: 'TRAINING', doneOn: '2026-03-01' }, TODAY), 'home_care.errors.worker_record_title_required');
  refused(() => normalizeWorkerRecord({ kind: 'BACKGROUND_CHECK' }, TODAY), 'home_care.errors.worker_record_day_required');
  refused(() => normalizeWorkerRecord({ kind: 'BACKGROUND_CHECK', doneOn: '2026-10-10' }, TODAY), 'home_care.errors.worker_record_day_future');
  refused(() => normalizeWorkerRecord({ kind: 'BACKGROUND_CHECK', doneOn: '2026-03-01', validUntil: '2026-02-01' }, TODAY), 'home_care.errors.worker_record_period_invalid');
  refused(() => normalizeWorkerRecord({ kind: 'BACKGROUND_CHECK', doneOn: '01.03.2026' }, TODAY), 'home_care.errors.invalid_date');
});

test('rea seis: kehtivuseta rida ei aegu; 60 päeva sees on „varsti"', () => {
  assert.deepEqual(workerRecordState({ validUntil: null }, TODAY), { daysLeft: null, expired: false, soon: false });
  assert.deepEqual(workerRecordState({ validUntil: '2026-10-08' }, TODAY), { daysLeft: -1, expired: true, soon: false });
  assert.deepEqual(workerRecordState({ validUntil: '2026-10-09' }, TODAY), { daysLeft: 0, expired: false, soon: true });
  assert.deepEqual(workerRecordState({ validUntil: '2026-12-08' }, TODAY), { daysLeft: 60, expired: false, soon: true });
  assert.deepEqual(workerRecordState({ validUntil: '2026-12-09' }, TODAY), { daysLeft: 61, expired: false, soon: false });
});

test('liigid on kolmes keeles; migratsiooni loend klapib koodiga', () => {
  for (const locale of ['et', 'en', 'ru']) {
    const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
    for (const kind of CARE_WORKER_RECORD_KINDS) assert.ok(messages.home_care.workers.kinds[kind], `${locale} ${kind}`);
  }
  const sql = readFileSync(new URL('../prisma/migrations/20261011170000_home_care_worker_records/migration.sql', import.meta.url), 'utf8');
  for (const kind of CARE_WORKER_RECORD_KINDS) assert.ok(sql.includes(`'${kind}'`), kind);
  assert.match(sql, /^SET lock_timeout = '5s';\r?\nSET statement_timeout = '30s';/m);
});
