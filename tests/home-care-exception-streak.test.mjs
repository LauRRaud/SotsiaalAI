import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { exceptionFreeStreak, hasException } from '../lib/homeCare/exceptionStreak.js';

const done = (mode = 'TOGETHER', planMode = mode) => ({ outcome: 'DONE', outsidePlan: false, mode, planMode });

test('erand käigus: tegemata toiming, kavaväline toiming, teine viis, „täna oli teisiti"', () => {
  assert.equal(hasException({ changeAnswer: 'NO', activities: [done(), done('FOR')] }), false);
  assert.equal(hasException({ changeAnswer: null, activities: [done()] }), false);
  assert.equal(hasException({ changeAnswer: 'YES', activities: [done()] }), true);
  for (const outcome of ['REFUSED', 'NOT_NEEDED', 'COULD_NOT']) assert.equal(hasException({ activities: [done(), { ...done(), outcome }] }), true, outcome);
  assert.equal(hasException({ activities: [{ ...done(), outsidePlan: true, planMode: null }] }), true);
  assert.equal(hasException({ activities: [done('FOR', 'TOGETHER')] }), true);
  assert.equal(hasException({ activities: [done('GUIDE', 'TOGETHER')] }), true);
  /* Kava rida on vahepeal kustunud (viis teadmata): viisi ei saa võrrelda, erandiks ei loeta. */
  assert.equal(hasException({ activities: [{ ...done(), planMode: null }] }), false);
});

test('käigud ilma erandita järjest, alates viimasest', () => {
  const plain = { changeAnswer: 'NO', activities: [done()] };
  const odd = { changeAnswer: 'NO', activities: [{ ...done(), outcome: 'REFUSED' }] };
  assert.equal(exceptionFreeStreak([]), 0);
  assert.equal(exceptionFreeStreak(null), 0);
  assert.equal(exceptionFreeStreak([plain, plain, plain]), 3);
  assert.equal(exceptionFreeStreak([plain, plain, odd, plain]), 2);
  assert.equal(exceptionFreeStreak([odd, plain, plain]), 0);
});

test('käigud ilma erandita: tekst kolmes keeles kannab arvu ja kuupäeva', () => {
  for (const locale of ['et', 'en', 'ru']) {
    const line = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).home_care.exception_streak.line;
    assert.ok(line.includes('{count}') && line.includes('{date}'), locale);
  }
});
