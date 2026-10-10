import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { overVolumeStreak } from '../lib/homeCare/monthLock.js';
import { composeMonthSheet, monthSheetState } from '../lib/homeCare/monthSheet.js';

const messages = JSON.parse(readFileSync(new URL('../messages/et.json', import.meta.url), 'utf8'));
/* Tõlkefunktsioon päris eestikeelse kataloogi pealt: test loeb sama teksti, mida fail kannab. */
const t = (key, values = {}) => {
  const text = key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), messages);
  assert.equal(typeof text, 'string', `tõlge puudub: ${key}`);
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in values ? String(values[name]) : match));
};

const page = (lock) => ({
  month: '2026-09',
  today: '2026-10-05',
  totals: { visits: 3, minutes: 105 },
  clients: [
    {
      client: { id: 'c1', displayName: 'Linda Tamm', status: 'ACTIVE' },
      expectedMinutes: 120,
      visits: 2,
      minutes: 60,
      withoutLength: 0,
      missed: 1,
      cancelled: 2,
      notDone: { REFUSED: 2, NOT_NEEDED: 0, COULD_NOT: 1 },
      awayDays: 3
    },
    { client: { id: 'c2', displayName: '=SUM(A1)', status: 'AWAY' }, expectedMinutes: null, visits: 1, minutes: 45, withoutLength: 1, missed: 0, cancelled: 0, notDone: { REFUSED: 0, NOT_NEEDED: 0, COULD_NOT: 0 } },
    { client: { id: 'c3', displayName: null, status: null }, expectedMinutes: 30, visits: 1, minutes: 90, withoutLength: 0, missed: 0, cancelled: 0, notDone: { REFUSED: 0, NOT_NEEDED: 0, COULD_NOT: 0 } }
  ],
  workers: [
    { membershipId: 'm1', name: 'Anu Hooldaja', visits: 4, minutes: 195, heavy: 1, companionVisits: 1, companionMinutes: 30, km: 42, ownKm: 30 },
    /* Sõitudeta töötaja (või varasem lukk, mis kilomeetreid ei kandnud): lahtrid jäävad tühjaks. */
    { membershipId: 'm2', name: 'Bert Hooldaja', visits: 1, minutes: 30, heavy: 0, companionVisits: 0, companionMinutes: 0 }
  ],
  missed: [{ entryId: 'e9', client: { id: 'c1', displayName: 'Linda Tamm' }, occurredAt: '2026-09-12T06:00:00.000Z', type: 'DOOR_NOT_OPENED' }],
  lock
});
const rowsOf = (text) => text.replace(/^\uFEFF/, '').split('\r\n').map((line) => line.split(';'));

test('kuu tabel: lukustatud kuu fail ütleb, et arvud on lukus, ja kannab kolme osa', () => {
  const locked = page({ state: 'LOCKED', snapshotShown: true, lockedAt: '2026-10-05T08:00:00.000Z', lockedByName: 'Juta Juht' });
  assert.equal(monthSheetState(locked), 'LOCKED');
  const text = composeMonthSheet(t, locked, { dateTime: (value) => `[${value}]`, day: (value) => `<${value}>` });
  assert.equal(text.charCodeAt(0), 0xfeff);
  assert.ok(text.endsWith('\r\n'));
  const rows = rowsOf(text);
  assert.deepEqual(rows[0], ['Koduteenuse kuu kokkuvõte', '09.2026']);
  assert.deepEqual(rows[1], ['Seis', 'Lukustatud arvud. Lukustas Juta Juht, [2026-10-05T08:00:00.000Z].']);
  assert.deepEqual(rows[3], ['Kliendi kaupa']);
  assert.equal(rows[4].length, 13);
  /* Linda: 1 tund osutatud, 2 otsustatud, vahe −1 jääb arvuks (ilma ülakomata). */
  assert.deepEqual(rows[5], ['Linda Tamm', 'Aktiivne', '2', '1', '2', '-1', '0', '1', '2', '3', '2', '0', '1']);
  /* Valemina algav nimi saab ülakoma; otsustatud mahuta kliendil on kaks lahtrit tühjad. */
  assert.deepEqual(rows[6].slice(0, 6), ["'=SUM(A1)", 'Ajutiselt ära', '1', '0,8', '', '']);
  /* Klient, keda enam nimekirjas ei ole: selgitus nime asemel, seis tühi, vahe +1 tund. */
  assert.deepEqual(rows[7].slice(0, 6), ['Klienti ei ole enam nimekirjas', '', '1', '1,5', '0,5', '1']);
  /* Kokku: käigud, tunnid ja otsustatud tunnid (ainult neil, kellel maht on); koguvahet ei ole. */
  assert.deepEqual(rows[8], ['Kokku', '', '4', '3,3', '2,5', '', '1', '1', '2', '3', '2', '0', '1']);
  assert.deepEqual(rows[9], ['']);
  assert.deepEqual(rows[10], ['Töötaja kaupa']);
  assert.deepEqual(rows[11].slice(-2), ['Kilomeetreid', 'Sellest isikliku autoga']);
  assert.deepEqual(rows[12], ['Anu Hooldaja', '4', '3,3', '1', '1', '0,5', '42', '30']);
  assert.deepEqual(rows[13], ['Bert Hooldaja', '1', '0,5', '0', '0', '0', '', '']);
  assert.deepEqual(rows[15], ['Ära jäänud käigud']);
  assert.deepEqual(rows[17], ['Linda Tamm', '[2026-09-12T06:00:00.000Z]', 'Uks ei avanenud']);
});

test('kuu tabel: lukustamata kuu ja üksuse vaade on failis kirjas', () => {
  const running = page({ state: 'OPEN' });
  assert.equal(monthSheetState(running), 'RUNNING');
  assert.deepEqual(rowsOf(composeMonthSheet(t, running, { day: (value) => `<${value}>` }))[1], ['Seis', 'Kuu ei ole lukus: jooksvad arvud seisuga <2026-10-05>.']);
  const unit = page({ state: 'LOCKED', snapshotShown: false, lockedAt: '2026-10-05T08:00:00.000Z', lockedByName: 'Juta Juht' });
  assert.equal(monthSheetState(unit), 'UNIT');
  assert.match(rowsOf(composeMonthSheet(t, unit))[1][1], /^Kuu on lukus\. Siin on üksuse jooksvad arvud seisuga 2026-10-05\.$/);
  /* Tühi kuu annab ikka kolm pealkirja ja kokku-rea. */
  const empty = rowsOf(composeMonthSheet(t, { month: '2026-09', today: '2026-10-05', clients: [], workers: [], missed: [], lock: { state: 'OPEN' } }));
  assert.deepEqual(empty[5].slice(0, 5), ['Kokku', '', '0', '0', '']);
  assert.equal(monthSheetState({}), 'RUNNING');
});

test('kuu tabeli ja nimekirja tekstid on kolmes keeles', () => {
  for (const locale of ['et', 'en', 'ru']) {
    const catalogue = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).home_care;
    assert.equal(Object.keys(catalogue.month_sheet).length, Object.keys(messages.home_care.month_sheet).length, locale);
    for (const key of Object.keys(messages.home_care.month_sheet)) assert.ok(catalogue.month_sheet[key], `${locale} ${key}`);
    for (const key of ['over_volume_title', 'over_volume_empty', 'over_volume_line']) assert.ok(catalogue.deadlines[key], `${locale} ${key}`);
  }
});

test('üle otsustatud mahu kõigis kuudes: mahuta või puuduv kuu katkestab rea', () => {
  const month = (name, rows) => ({ month: name, snapshot: { clients: rows } });
  const row = (clientId, minutes, expectedMinutes) => ({ clientId, minutes, expectedMinutes });
  const months = [
    month('2026-07', [row('over', 180, 120), row('once', 180, 120), row('equal', 120, 120), row('nodecision', 300, null), row('left', 200, 100)]),
    month('2026-08', [row('over', 130, 120), row('once', 100, 120), row('equal', 120, 120), row('nodecision', 300, 100), row('left', 200, 100)]),
    month('2026-09', [row('over', 121, 120), row('once', 180, 120), row('equal', 121, 120), row('nodecision', 300, 100), row('new', 500, 100)])
  ];
  assert.deepEqual(overVolumeStreak(months), [
    {
      clientId: 'over',
      months: [
        { month: '2026-07', minutes: 180, expectedMinutes: 120 },
        { month: '2026-08', minutes: 130, expectedMinutes: 120 },
        { month: '2026-09', minutes: 121, expectedMinutes: 120 }
      ]
    }
  ]);
  assert.deepEqual(overVolumeStreak([]), []);
  assert.deepEqual(overVolumeStreak([{ month: '2026-07', snapshot: null }]), []);
});
