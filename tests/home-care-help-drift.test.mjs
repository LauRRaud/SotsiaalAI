import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { figureLines } from '../lib/homeCare/clientFigures.js';
import { helpDrift, helpDriftDue } from '../lib/homeCare/helpDrift.js';

test('abi rohkem või vähem kui kavas: viis võrreldes kava reaga', () => {
  const row = (mode, planMode) => ({ mode, planMode });
  assert.deepEqual(helpDrift([]), { total: 0, more: 0, less: 0 });
  assert.deepEqual(helpDrift([row('TOGETHER', 'TOGETHER'), row('FOR', 'TOGETHER'), row('ASSIST', 'TOGETHER'), row('GUIDE', 'TOGETHER'), row('FOR', 'FOR')]), { total: 5, more: 2, less: 1 });
  /* Abi astmed: juhendan < koos < aitan osaliselt < teen tema eest. */
  assert.deepEqual(helpDrift([row('TOGETHER', 'GUIDE'), row('ASSIST', 'FOR')]), { total: 2, more: 1, less: 1 });
  /* Tundmatu viis või puuduv kava viis: rida jääb välja. */
  assert.deepEqual(helpDrift([row('FOR', undefined), row('MUU', 'FOR'), row('FOR', 'FOR')]), { total: 1, more: 0, less: 0 });
});

test('abi rohkem kui kavas: märguanne alles siis, kui kordi on piisavalt ja osakaal üle piiri', () => {
  assert.equal(helpDriftDue({ total: 10, more: 4 }), true);
  assert.equal(helpDriftDue({ total: 10, more: 3 }), false);
  assert.equal(helpDriftDue({ total: 20, more: 4 }), false);
  assert.equal(helpDriftDue({ total: 4, more: 4 }), true);
  assert.equal(helpDriftDue({ total: 0, more: 0 }), false);
});

test('abi rohkem kui kavas: rida teate arvudes ja tekstid kolmes keeles', () => {
  const base = { months: [], incidents: { total: 0, byType: {} }, signals: 0, continuity: null };
  assert.ok(figureLines('et', { ...base, helpDrift: { total: 10, more: 4, less: 1 } }).includes('Viimasel neljal nädalal tehti 10 kava toimingust 4 kavast suurema ja 1 väiksema abiga.'));
  /* Kui kõik tehti nagu kavas või näitu ei ole, rida ei ole. */
  for (const drift of [{ total: 6, more: 0, less: 0 }, null, undefined]) {
    assert.equal(figureLines('et', { ...base, helpDrift: drift }).some((line) => line.includes('kava toimingust')), false);
  }
  for (const locale of ['et', 'en', 'ru']) {
    const catalogue = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).home_care;
    for (const key of ['line', 'due_coordinator', 'due_team']) assert.ok(catalogue.help_drift[key], `${locale} ${key}`);
    for (const key of ['help_drift_title', 'help_drift_empty', 'help_drift_line']) assert.ok(catalogue.deadlines[key], `${locale} ${key}`);
    assert.ok(catalogue.notice.doc.figures_help_drift, locale);
  }
});
