import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { continuityFigure } from '../lib/homeCare/continuity.js';

test('püsivuse näit: mitu töötajat käis ja mitu neist tegid 80% käikudest', () => {
  assert.equal(continuityFigure([]), null);
  assert.equal(continuityFigure([{ visits: 0 }]), null);
  assert.deepEqual(continuityFigure([{ visits: 12 }]), { visits: 12, workers: 1, topWorkers: 1, topPercent: 100 });
  /* Kava näide: kuus töötajat, kolm neist teevad 80%. */
  assert.deepEqual(continuityFigure([{ visits: 1 }, { visits: 8 }, { visits: 1 }, { visits: 4 }, { visits: 2 }, { visits: 4 }]), {
    visits: 20,
    workers: 6,
    topWorkers: 3,
    topPercent: 80
  });
  /* Võrdselt jagatud töö: 80% katmiseks on vaja nelja viiest. */
  assert.deepEqual(continuityFigure([{ visits: 2 }, { visits: 2 }, { visits: 2 }, { visits: 2 }, { visits: 2 }]), { visits: 10, workers: 5, topWorkers: 4, topPercent: 80 });
  /* Käikudeta rida ei ole töötaja, kes käis. */
  assert.deepEqual(continuityFigure([{ visits: 3 }, { visits: 0 }, { visits: 1 }]), { visits: 4, workers: 2, topWorkers: 2, topPercent: 100 });
});

test('näidu ja ohuridade tekstid on kolmes keeles', () => {
  for (const locale of ['et', 'en', 'ru']) {
    const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
    for (const key of ['one', 'many']) assert.ok(messages.home_care.continuity[key], `${locale} ${key}`);
    for (const key of ['risk_lines_due_title', 'risk_lines_due_empty', 'risk_lines_line']) assert.ok(messages.home_care.deadlines[key], `${locale} ${key}`);
  }
});
