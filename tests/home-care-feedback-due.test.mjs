// KODUTEENUS K4-d — tagasiside korrapärane küsimine: reegel, tagasisideks loetavad kirjed ja tekstid.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CARE_FEEDBACK_INCIDENT_TYPES, HOME_CARE_LIMITS } from '../lib/homeCare/constants.js';
import { feedbackDue } from '../lib/homeCare/deadlines.js';

test('tagasisidet küsitakse vähemalt kord aastas; uuelt kliendilt esimest korda pärast kolme kuud', () => {
  assert.deepEqual([HOME_CARE_LIMITS.FEEDBACK_EVERY_DAYS, HOME_CARE_LIMITS.FEEDBACK_FIRST_DAYS], [365, 90]);
  const today = '2026-10-09';
  /* Viimasest tagasisidest täpselt aasta: veel ei ole üle; päev hiljem on. */
  assert.deepEqual(feedbackDue({ startedOn: '2024-01-01', lastFeedbackOn: '2025-10-09', today }), { due: false, days: 365 });
  assert.deepEqual(feedbackDue({ startedOn: '2024-01-01', lastFeedbackOn: '2025-10-08', today }), { due: true, days: 366 });
  assert.deepEqual(feedbackDue({ startedOn: '2024-01-01', lastFeedbackOn: '2026-10-01', today }), { due: false, days: 8 });
  /* Tagasisideta klient: 89 päeva teenusel ei ole veel aeg, 90 on. */
  assert.deepEqual(feedbackDue({ startedOn: '2026-07-12', lastFeedbackOn: null, today }), { due: false, days: 89 });
  assert.deepEqual(feedbackDue({ startedOn: '2026-07-11', lastFeedbackOn: null, today }), { due: true, days: 90 });
});

test('tagasisideks loevad kaebus, tänu ja suuline tagasiside', () => {
  assert.deepEqual([...CARE_FEEDBACK_INCIDENT_TYPES], ['COMPLAINT', 'THANKS', 'FEEDBACK']);
});

test('tagasiside nimekirjade tekstid on kolmes keeles', () => {
  for (const locale of ['et', 'en', 'ru']) {
    const deadlines = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).home_care.deadlines;
    assert.match(deadlines.feedback_last, /\{date\}/, locale);
    assert.match(deadlines.feedback_ended_on, /\{date\}/, locale);
    for (const key of ['feedback_hint', 'feedback_overdue_title', 'feedback_overdue_empty', 'feedback_never', 'feedback_at_end_title', 'feedback_at_end_empty']) {
      assert.ok(deadlines[key], `${locale} ${key}`);
    }
  }
});
