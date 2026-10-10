import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { CARE_TRIP_VEHICLES } from '../lib/homeCare/constants.js';
import { composeTripSheet } from '../lib/homeCare/tripSheet.js';
import { normalizeTrip, summarizeTrips, tripKm } from '../lib/homeCare/trips.js';

const TODAY = '2026-10-09';
const fails = (fn, key) => assert.throws(fn, (error) => error?.messageKey === key, key);
const messages = JSON.parse(readFileSync(new URL('../messages/et.json', import.meta.url), 'utf8'));
const t = (key, values = {}) => {
  const text = key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), messages);
  assert.equal(typeof text, 'string', `tõlge puudub: ${key}`);
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in values ? String(values[name]) : match));
};

test('sõidu sisend: kaks näitu, päev täna või kuni kaks kuud tagasi, eesmärk kohustuslik', () => {
  assert.deepEqual(normalizeTrip({ vehicle: 'own', plate: ' 123 abc ', startOdometer: '84 120', endOdometer: 84162, purpose: ' Käigud  linnas ' }, TODAY), {
    day: TODAY,
    vehicle: 'OWN',
    plate: '123 ABC',
    startOdometer: 84120,
    endOdometer: 84162,
    purpose: 'Käigud linnas'
  });
  assert.equal(normalizeTrip({ day: '2026-08-08', vehicle: 'ORG', startOdometer: 5, endOdometer: 5, purpose: 'x' }, TODAY).plate, null);
  const base = { vehicle: 'OWN', startOdometer: 100, endOdometer: 120, purpose: 'x' };
  fails(() => normalizeTrip({ ...base, day: '2026-10-10' }, TODAY), 'home_care.errors.trip_day');
  fails(() => normalizeTrip({ ...base, day: '2026-08-07' }, TODAY), 'home_care.errors.trip_day');
  fails(() => normalizeTrip({ ...base, vehicle: 'BUS' }, TODAY), 'home_care.errors.trip_vehicle');
  fails(() => normalizeTrip({ ...base, endOdometer: 99 }, TODAY), 'home_care.errors.trip_odometer');
  fails(() => normalizeTrip({ ...base, endOdometer: 2101 }, TODAY), 'home_care.errors.trip_odometer');
  fails(() => normalizeTrip({ ...base, startOdometer: '12,5' }, TODAY), 'home_care.errors.trip_odometer');
  fails(() => normalizeTrip({ ...base, startOdometer: '' }, TODAY), 'home_care.errors.trip_odometer');
  fails(() => normalizeTrip({ ...base, startOdometer: -1 }, TODAY), 'home_care.errors.trip_odometer');
  fails(() => normalizeTrip({ ...base, purpose: '  ' }, TODAY), 'home_care.errors.trip_purpose');
  assert.equal(normalizeTrip({ ...base, endOdometer: 2100 }, TODAY).endOdometer, 2100);
});

test('sõidu pikkus on näitude vahe; kuu kokkuvõte töötaja kaupa eristab isikliku auto', () => {
  assert.equal(tripKm({ startOdometer: 84120, endOdometer: 84162 }), 42);
  assert.equal(tripKm({ startOdometer: 10, endOdometer: 5 }), 0);
  const rows = [
    { membershipId: 'm2', workerName: 'Bert Hooldaja', vehicle: 'ORG', startOdometer: 100, endOdometer: 130 },
    { membershipId: 'm1', workerName: 'Anu Hooldaja', vehicle: 'OWN', startOdometer: 10, endOdometer: 52 },
    { membershipId: 'm1', workerName: 'Anu Hooldaja', vehicle: 'ORG', startOdometer: 500, endOdometer: 518 }
  ];
  assert.deepEqual(summarizeTrips(rows), [
    { membershipId: 'm1', name: 'Anu Hooldaja', trips: 2, km: 60, ownKm: 42 },
    { membershipId: 'm2', name: 'Bert Hooldaja', trips: 1, km: 30, ownKm: 0 }
  ]);
  assert.deepEqual(summarizeTrips([]), []);
});

test('sõidupäeviku tabelifail: read, kokkuvõte töötaja kaupa ja valemi kaitse', () => {
  const text = composeTripSheet(
    t,
    {
      month: '2026-10',
      trips: [
        { day: '2026-10-08', workerName: 'Anu Hooldaja', vehicle: 'OWN', plate: '123 ABC', startOdometer: 84120, endOdometer: 84162, km: 42, purpose: 'Käigud; Haapsalus' },
        { day: '2026-10-09', workerName: 'Bert Hooldaja', vehicle: 'ORG', plate: null, startOdometer: 15000, endOdometer: 15030, km: 30, purpose: '=SUM(A1)' }
      ],
      workers: [
        { membershipId: 'm1', name: 'Anu Hooldaja', trips: 1, km: 42, ownKm: 42 },
        { membershipId: 'm2', name: 'Bert Hooldaja', trips: 1, km: 30, ownKm: 0 }
      ]
    },
    { day: (value) => value.split('-').reverse().join('.') }
  );
  assert.equal(text.charCodeAt(0), 0xfeff);
  const lines = text.replace(/^\uFEFF/, '').split('\r\n');
  assert.equal(lines[0], 'Koduteenuse sõidupäevik;10.2026');
  assert.equal(lines[2], 'Kuupäev;Töötaja;Sõiduk;Registreerimisnumber;Algnäit;Lõppnäit;Kilomeetreid;Siht ja eesmärk');
  /* Semikooloniga eesmärk on jutumärkides; valemina algav tekst saab ülakoma; arvud jäävad arvudeks. */
  assert.equal(lines[3], '08.10.2026;Anu Hooldaja;isiklik auto;123 ABC;84120;84162;42;"Käigud; Haapsalus"');
  assert.equal(lines[4], "09.10.2026;Bert Hooldaja;asutuse auto;;15000;15030;30;'=SUM(A1)");
  assert.deepEqual(lines.slice(6, 10), ['Kokku töötaja kaupa', 'Töötaja;Sõite;Kilomeetreid;Sellest isikliku autoga', 'Anu Hooldaja;1;42;42', 'Bert Hooldaja;1;30;0']);
});

test('sõidupäeviku tekstid on kolmes keeles', () => {
  const et = messages.home_care;
  for (const locale of ['et', 'en', 'ru']) {
    const catalogue = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).home_care;
    for (const key of Object.keys(et.trips)) assert.ok(catalogue.trips[key], `${locale} ${key}`);
    for (const vehicle of CARE_TRIP_VEHICLES) assert.ok(catalogue.trips.vehicles[vehicle], `${locale} ${vehicle}`);
    for (const key of Object.keys(et.trip_sheet)) assert.ok(catalogue.trip_sheet[key], `${locale} ${key}`);
    for (const key of Object.keys(et.errors).filter((name) => name.startsWith('trip_'))) assert.ok(catalogue.errors[key], `${locale} ${key}`);
  }
});
