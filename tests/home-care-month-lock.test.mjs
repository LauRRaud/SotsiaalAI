import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { openItemTotal, snapshotOf, summaryFromSnapshot, totalsDrift } from '../lib/homeCare/monthLock.js';

const summary = () => ({
  month: '2026-09',
  fromDay: '2026-09-01',
  untilDay: '2026-09-30',
  totals: { visits: 3, minutes: 105, withoutLength: 0, missed: 1, cancelled: 0, notDone: 2 },
  clients: [
    {
      client: { id: 'c1', displayName: 'Linda Tamm', status: 'ACTIVE' },
      volumeMinutes: 240,
      volumePeriod: 'MONTH',
      expectedMinutes: 240,
      visits: 2,
      minutes: 60,
      withoutLength: 0,
      missed: 1,
      cancelled: 0,
      notDone: { REFUSED: 2, NOT_NEEDED: 0, COULD_NOT: 0 },
      awayDays: 3
    },
    { client: { id: 'c2', displayName: 'Peeter Põhi', status: 'AWAY' }, volumeMinutes: null, volumePeriod: null, expectedMinutes: null, visits: 1, minutes: 45, withoutLength: 0, missed: 0, cancelled: 0, notDone: { REFUSED: 0, NOT_NEEDED: 0, COULD_NOT: 0 } }
  ],
  workers: [{ membershipId: 'm1', name: 'Anu Hooldaja', visits: 3, minutes: 105, heavy: 0, companionVisits: 0, companionMinutes: 0 }],
  missed: [{ entryId: 'e9', client: { id: 'c1', displayName: 'Linda Tamm' }, occurredAt: '2026-09-12T06:00:00.000Z', type: 'DOOR_NOT_OPENED' }]
});
const openItems = { missingCount: 2, openIncidents: 1, openSignals: 0, medicationUnmarked: 3 };

test('kuu luku hetktõmmis: kliendi ID ja arvud, nime ega seisu ei ole', () => {
  const snapshot = snapshotOf(summary(), openItems);
  const text = JSON.stringify(snapshot);
  assert.equal(text.includes('Linda'), false);
  assert.equal(text.includes('Peeter'), false);
  assert.equal(text.includes('AWAY'), false);
  assert.deepEqual(snapshot.totals, summary().totals);
  assert.deepEqual(snapshot.clients.map((row) => [row.clientId, row.visits, row.minutes, row.expectedMinutes, row.awayDays]), [
    ['c1', 2, 60, 240, 3],
    ['c2', 1, 45, null, undefined]
  ]);
  assert.deepEqual(snapshot.missed, [{ entryId: 'e9', clientId: 'c1', occurredAt: '2026-09-12T06:00:00.000Z', type: 'DOOR_NOT_OPENED' }]);
  assert.deepEqual(snapshot.open, { missing: 2, incidents: 1, signals: 0, medication: 3 });
  assert.deepEqual([snapshot.fromDay, snapshot.untilDay], ['2026-09-01', '2026-09-30']);
  /* Hetktõmmis on koopia: hilisem muudatus kokkuvõttes seda ei muuda. */
  const source = summary();
  const copy = snapshotOf(source, openItems);
  source.totals.visits = 99;
  source.workers[0].visits = 99;
  assert.deepEqual([copy.totals.visits, copy.workers[0].visits], [3, 3]);
});

test('kuu luku hetktõmmisest kokkuvõte: nimi praegusest kliendiloendist, kadunud kliendil null', () => {
  const snapshot = snapshotOf(summary(), openItems);
  const names = new Map([['c1', { displayName: 'Linda Tamm-Kask', status: 'ENDED' }]]);
  const view = summaryFromSnapshot(snapshot, names);
  assert.deepEqual(view.clients.map((row) => [row.client.id, row.client.displayName, row.client.status, row.minutes]), [
    ['c1', 'Linda Tamm-Kask', 'ENDED', 60],
    ['c2', null, null, 45]
  ]);
  assert.equal('clientId' in view.clients[0], false);
  assert.deepEqual(view.missed.map((row) => [row.entryId, row.client.displayName, row.type]), [['e9', 'Linda Tamm-Kask', 'DOOR_NOT_OPENED']]);
  assert.deepEqual(view.totals, summary().totals);
  assert.equal(view.workers[0].name, 'Anu Hooldaja');
  /* Vigane või tühi hetktõmmis lehte katki ei tee. */
  assert.deepEqual(summaryFromSnapshot(null), { totals: {}, clients: [], workers: [], missed: [] });
});

test('kuu luku vahe praeguse seisuga: ainult muutunud arvud, muidu null', () => {
  const locked = summary().totals;
  assert.equal(totalsDrift(locked, { ...locked }), null);
  assert.deepEqual(totalsDrift(locked, { ...locked, visits: 4, minutes: 150 }), { visits: 1, minutes: 45 });
  assert.deepEqual(totalsDrift(locked, { ...locked, missed: 0, notDone: 5 }), { missed: -1, notDone: 3 });
  /* Puuduv arv loetakse nulliks. */
  assert.deepEqual(totalsDrift({}, { visits: 2 }), { visits: 2 });
  assert.equal(openItemTotal(openItems), 6);
  assert.equal(openItemTotal(null), 0);
});

test('kuu luku tekstid on kolmes keeles', () => {
  const keys = [
    'title',
    'badge',
    'intro',
    'not_over',
    'scope_only',
    'open_warning',
    'lock',
    'confirm_hint',
    'confirm',
    'cancel',
    'locked_banner',
    'locked_banner_unit',
    'locked_line',
    'locked_open',
    'unit_hint',
    'no_drift',
    'drift',
    'drift_visits',
    'drift_minutes',
    'drift_without_length',
    'drift_missed',
    'drift_cancelled',
    'drift_not_done',
    'after_title',
    'after_counts',
    'after_occurred',
    'after_more',
    'after_hint',
    'reopen',
    'reopen_reason',
    'reopen_hint',
    'reopen_confirm',
    'history_title',
    'history_line',
    'client_gone'
  ];
  for (const locale of ['et', 'en', 'ru']) {
    const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
    for (const key of keys) assert.ok(messages.home_care.month_lock[key], `${locale} ${key}`);
    for (const kind of ['ADDED', 'CORRECTED', 'RETRACTED']) assert.ok(messages.home_care.month_lock.after_kinds[kind], `${locale} ${kind}`);
    for (const key of ['month_not_over', 'month_already_locked', 'month_not_locked', 'month_changed', 'month_too_large', 'month_reopen_reason']) {
      assert.ok(messages.home_care.errors[key], `${locale} ${key}`);
    }
    for (const key of ['month_changed_title', 'month_changed_empty', 'month_changed_line']) assert.ok(messages.home_care.deadlines[key], `${locale} ${key}`);
  }
});
