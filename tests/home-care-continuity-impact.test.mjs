import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { signalResponseStats } from '../lib/homeCare/changes.js';
import { continuityImpact } from '../lib/homeCare/continuityImpact.js';

test('asenduse mõju püsivusele: ainult töötaja, kes ei ole viimasel neljal nädalal seal käinud', () => {
  assert.deepEqual(continuityImpact(['m1', 'm2'], 'm3'), { count: 3 });
  assert.equal(continuityImpact(['m1', 'm2'], 'm2'), null);
  /* Töötajat ei ole valitud (käik jääb määramata) või kliendil ei olnud sel ajal käike: mõju ei näidata. */
  assert.equal(continuityImpact(['m1'], ''), null);
  assert.equal(continuityImpact([], 'm3'), null);
  assert.equal(continuityImpact(undefined, 'm3'), null);
});

test('märkamiste vastamise näit: vastatud ja ootel arv ning vastamise mediaan täispäevades', () => {
  const at = (iso) => new Date(iso);
  assert.deepEqual(signalResponseStats([]), { opened: 0, handled: 0, waiting: 0, medianDays: null });
  assert.deepEqual(signalResponseStats([{ openedAt: at('2026-10-01T08:00:00Z'), handledAt: null }]), { opened: 1, handled: 0, waiting: 1, medianDays: null });
  const rows = [
    { openedAt: at('2026-10-01T08:00:00Z'), handledAt: at('2026-10-01T15:00:00Z') },
    { openedAt: at('2026-10-02T08:00:00Z'), handledAt: at('2026-10-05T09:00:00Z') },
    { openedAt: at('2026-10-03T08:00:00Z'), handledAt: at('2026-10-13T08:00:00Z') },
    { openedAt: at('2026-10-08T08:00:00Z'), handledAt: null }
  ];
  /* Päevad 0, 3 ja 10: mediaan 3. Paarisarvu korral kahe keskmise keskmine. */
  assert.deepEqual(signalResponseStats(rows), { opened: 4, handled: 3, waiting: 1, medianDays: 3 });
  assert.equal(signalResponseStats(rows.slice(0, 2)).medianDays, 2);
});

test('püsivuse mõju ja märkamiste näidu tekstid on kolmes keeles', () => {
  for (const locale of ['et', 'en', 'ru']) {
    const catalogue = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).home_care;
    assert.ok(catalogue.day.continuity_impact, locale);
    assert.ok(catalogue.month.signals_line, locale);
    assert.ok(catalogue.month.signals_median, locale);
    assert.ok(catalogue.month.signals_median_same_day, locale);
  }
});
