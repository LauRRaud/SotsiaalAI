import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { normalizeClock, normalizeTransportAnswer, normalizeTransportRequest, rideClock } from '../lib/homeCare/transport.js';

const TODAY = '2026-10-09';
const fails = (fn, key) => assert.throws(fn, (error) => error?.messageKey === key, key);

test('transpordi kellaaeg: kujule TT:MM, ka punktiga; tühi on null', () => {
  assert.equal(normalizeClock('9:40'), '09:40');
  assert.equal(normalizeClock('9.40'), '09:40');
  assert.equal(normalizeClock(' 14:05 '), '14:05');
  assert.equal(normalizeClock(''), null);
  assert.equal(normalizeClock(undefined), null);
  for (const bad of ['24:00', '9:60', '940', 'kell 9', '9:4']) fails(() => normalizeClock(bad), 'home_care.errors.transport_time');
});

test('transpordi soovi sisend: päev täna kuni pool aastat ette, sihtkoht kohustuslik', () => {
  assert.deepEqual(normalizeTransportRequest({ wantedOn: '2026-10-14', wantedTime: '9.40', destination: '  Perearsti  juurde ', needs: ' ratastool ' }, TODAY), {
    wantedOn: '2026-10-14',
    wantedTime: '09:40',
    destination: 'Perearsti juurde',
    needs: 'ratastool'
  });
  assert.deepEqual(normalizeTransportRequest({ wantedOn: TODAY, destination: 'Apteek' }, TODAY), { wantedOn: TODAY, wantedTime: null, destination: 'Apteek', needs: null });
  fails(() => normalizeTransportRequest({ destination: 'Apteek' }, TODAY), 'home_care.errors.transport_day');
  fails(() => normalizeTransportRequest({ wantedOn: '2026-10-08', destination: 'Apteek' }, TODAY), 'home_care.errors.transport_day');
  fails(() => normalizeTransportRequest({ wantedOn: '2027-06-01', destination: 'Apteek' }, TODAY), 'home_care.errors.transport_day');
  fails(() => normalizeTransportRequest({ wantedOn: '2026-10-14', destination: '  ' }, TODAY), 'home_care.errors.transport_destination');
  fails(() => normalizeTransportRequest({ wantedOn: '2026-10-14', wantedTime: '25:00', destination: 'Apteek' }, TODAY), 'home_care.errors.transport_time');
});

test('transpordi vastus: korraldatud kellaajaga või ilma; „ei saa" nõuab põhjust ja kellaaega ei hoia', () => {
  assert.deepEqual(normalizeTransportAnswer({ state: 'arranged', pickupTime: '9:20', answerNote: ' Juht helistab ette ' }), { state: 'ARRANGED', pickupTime: '09:20', answerNote: 'Juht helistab ette' });
  assert.deepEqual(normalizeTransportAnswer({ state: 'ARRANGED' }), { state: 'ARRANGED', pickupTime: null, answerNote: null });
  assert.deepEqual(normalizeTransportAnswer({ state: 'DECLINED', pickupTime: '9:20', answerNote: 'Auto on hoolduses' }), { state: 'DECLINED', pickupTime: null, answerNote: 'Auto on hoolduses' });
  fails(() => normalizeTransportAnswer({ state: 'DECLINED' }), 'home_care.errors.transport_decline_reason');
  fails(() => normalizeTransportAnswer({ state: 'WITHDRAWN' }), 'home_care.errors.transport_answer');
  fails(() => normalizeTransportAnswer({}), 'home_care.errors.transport_answer');
  /* Kliendi valmis panemise aeg: auto tuleku aeg, selle puudumisel soovitud aeg. */
  assert.equal(rideClock({ pickupTime: '09:20', wantedTime: '09:40' }), '09:20');
  assert.equal(rideClock({ pickupTime: null, wantedTime: '09:40' }), '09:40');
  assert.equal(rideClock({ pickupTime: null, wantedTime: null }), null);
});

test('transpordi tekstid on kolmes keeles', () => {
  const et = JSON.parse(readFileSync(new URL('../messages/et.json', import.meta.url), 'utf8')).home_care;
  for (const locale of ['et', 'en', 'ru']) {
    const catalogue = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).home_care;
    for (const key of Object.keys(et.transport)) assert.ok(catalogue.transport[key], `${locale} ${key}`);
    for (const key of ['transport_open_title', 'transport_open_empty', 'transport_open_line']) assert.ok(catalogue.deadlines[key], `${locale} ${key}`);
    for (const key of Object.keys(et.errors).filter((name) => name.startsWith('transport_'))) assert.ok(catalogue.errors[key], `${locale} ${key}`);
  }
});
