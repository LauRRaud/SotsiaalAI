import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { statusOnDay } from '../lib/homeCare/monthClose.js';
import { awayDaysBetween } from '../lib/homeCare/statusTimeline.js';

test('kliendi seis päeva lõpus seisu ajaloost', () => {
  /* Muutusteta kliendil kehtib tänane seis. */
  assert.equal(statusOnDay([], 'ACTIVE', '2026-10-05'), 'ACTIVE');
  assert.equal(statusOnDay([], 'ENDED', '2026-10-05'), 'ENDED');
  const changes = [
    { day: '2026-10-06', fromStatus: 'ACTIVE', toStatus: 'AWAY' },
    { day: '2026-10-20', fromStatus: 'AWAY', toStatus: 'ACTIVE' },
    { day: '2026-10-28', fromStatus: 'ACTIVE', toStatus: 'ENDED' }
  ];
  /* Enne esimest muutust kehtis selle lähteseis, mitte tänane seis. */
  assert.equal(statusOnDay(changes, 'ENDED', '2026-10-05'), 'ACTIVE');
  /* Muutuse päeval loeb päeva lõpu seis. */
  assert.equal(statusOnDay(changes, 'ENDED', '2026-10-06'), 'AWAY');
  assert.equal(statusOnDay(changes, 'ENDED', '2026-10-19'), 'AWAY');
  assert.equal(statusOnDay(changes, 'ENDED', '2026-10-20'), 'ACTIVE');
  assert.equal(statusOnDay(changes, 'ENDED', '2026-10-27'), 'ACTIVE');
  assert.equal(statusOnDay(changes, 'ENDED', '2026-10-31'), 'ENDED');
  /* Kaks muutust samal päeval: loeb viimane. */
  assert.equal(statusOnDay([{ day: '2026-10-06', fromStatus: 'ACTIVE', toStatus: 'AWAY' }, { day: '2026-10-06', fromStatus: 'AWAY', toStatus: 'ACTIVE' }], 'ACTIVE', '2026-10-06'), 'ACTIVE');
});

test('kuu lahtiste asjade tekstid on kolmes keeles', () => {
  for (const locale of ['et', 'en', 'ru']) {
    const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
    for (const key of ['title', 'clear', 'missing', 'missing_line', 'missing_more', 'incidents', 'signals', 'medication']) assert.ok(messages.home_care.month_open[key], `${locale} ${key}`);
  }
});

test('äraoleku päevad vahemikus: loetakse ainult seis „ära", lõppenud teenust mitte', () => {
  const next = (day) => {
    const date = new Date(`${day}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
  };
  const changes = [
    { day: '2026-10-06', fromStatus: 'ACTIVE', toStatus: 'AWAY' },
    { day: '2026-10-20', fromStatus: 'AWAY', toStatus: 'ACTIVE' },
    { day: '2026-10-28', fromStatus: 'ACTIVE', toStatus: 'ENDED' }
  ];
  /* Ära 06.10 kuni 19.10 (tagasituleku päev 20.10 on teenusel): 14 päeva. */
  assert.equal(awayDaysBetween(changes, 'ENDED', '2026-10-01', '2026-10-31', next), 14);
  /* Vahemik lõikab äraoleku pooleks; kuu vahetus loeb õigesti. */
  assert.equal(awayDaysBetween(changes, 'ENDED', '2026-10-01', '2026-10-09', next), 4);
  assert.equal(awayDaysBetween(changes, 'ENDED', '2026-09-28', '2026-10-06', next), 1);
  /* Muutusteta klient, kes on täna ära, oli ära kogu vahemiku; teenusel olev klient mitte ühtegi päeva. */
  assert.equal(awayDaysBetween([], 'AWAY', '2026-10-01', '2026-10-03', next), 3);
  assert.equal(awayDaysBetween([], 'ACTIVE', '2026-10-01', '2026-10-03', next), 0);
});
