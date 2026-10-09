import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { statusOnDay } from '../lib/homeCare/monthClose.js';

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
