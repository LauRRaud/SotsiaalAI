import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { CARE_CONTROL_CALL_OUTCOMES, CARE_CONTROL_CALL_PARTIES } from '../lib/homeCare/constants.js';
import { controlCallDue, normalizeControlCall } from '../lib/homeCare/controlCalls.js';
import { HOME_CARE_EXPORT_KEYS, HOME_CARE_EXPORT_VERSION } from '../lib/homeCare/exportFormat.js';

const today = '2026-10-09';
const refused = (input, key) => assert.throws(() => normalizeControlCall(input, today), (error) => error.status === 400 && error.messageKey === `home_care.errors.${key}`);

test('kontrollkõne: sisendi reeglid', () => {
  assert.deepEqual(normalizeControlCall({ outcome: 'MATCHES', spokeWith: 'CLIENT' }, today), { calledOn: '2026-10-09', outcome: 'MATCHES', spokeWith: 'CLIENT', note: null });
  /* „Ei saanud kätte": kellega räägiti, jäetakse kõrvale; märkus on lubatud. */
  assert.deepEqual(normalizeControlCall({ outcome: 'NOT_REACHED', spokeWith: 'CLIENT', note: ' ei vastanud ', calledOn: '2026-10-01' }, today), {
    calledOn: '2026-10-01',
    outcome: 'NOT_REACHED',
    spokeWith: null,
    note: 'ei vastanud'
  });
  assert.equal(normalizeControlCall({ outcome: 'DIFFERS', spokeWith: 'RELATIVE', note: 'Reedel ei käidud.' }, today).note, 'Reedel ei käidud.');
  for (const party of CARE_CONTROL_CALL_PARTIES) assert.equal(normalizeControlCall({ outcome: 'MATCHES', spokeWith: party }, today).spokeWith, party);
  refused({}, 'control_call_outcome_required');
  refused({ outcome: 'OK' }, 'control_call_outcome_required');
  refused({ outcome: 'MATCHES' }, 'control_call_spoke_required');
  refused({ outcome: 'MATCHES', spokeWith: 'CARER' }, 'control_call_spoke_required');
  refused({ outcome: 'DIFFERS', spokeWith: 'CLIENT', note: '  ' }, 'control_call_note_required');
  refused({ outcome: 'MATCHES', spokeWith: 'CLIENT', calledOn: '2026-10-10' }, 'control_call_day_future');
});

test('kontrollkõne: millal on kõne tegemata', () => {
  /* Esimene kõne 90 päeva pärast teenuse algust. */
  assert.deepEqual(controlCallDue({ startedOn: '2026-07-12', lastReachedOn: null, today }), { due: false, days: 89 });
  assert.deepEqual(controlCallDue({ startedOn: '2026-07-11', lastReachedOn: null, today }), { due: true, days: 90 });
  /* Edasi iga kvartal: 92 päeva veel mitte, 93. päeval jah. */
  assert.deepEqual(controlCallDue({ startedOn: '2025-01-01', lastReachedOn: '2026-07-09', today }), { due: false, days: 92 });
  assert.deepEqual(controlCallDue({ startedOn: '2025-01-01', lastReachedOn: '2026-07-08', today }), { due: true, days: 93 });
  assert.deepEqual(controlCallDue({ startedOn: '2025-01-01', lastReachedOn: today, today }), { due: false, days: 0 });
});

test('kontrollkõne: väljavõtte kogu ja tekstid kolmes keeles', () => {
  assert.ok(HOME_CARE_EXPORT_VERSION >= 33);
  assert.ok(HOME_CARE_EXPORT_KEYS.includes('controlCalls'));
  for (const locale of ['et', 'en', 'ru']) {
    const catalogue = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).home_care;
    for (const outcome of CARE_CONTROL_CALL_OUTCOMES) assert.ok(catalogue.control_call.outcomes[outcome], `${locale} ${outcome}`);
    for (const party of CARE_CONTROL_CALL_PARTIES) assert.ok(catalogue.control_call.parties[party], `${locale} ${party}`);
    for (const key of ['title', 'hint', 'last_line', 'never', 'due', 'add', 'day_label', 'outcome_label', 'party_label', 'note_label', 'note_hint', 'retract']) assert.ok(catalogue.control_call[key], `${locale} ${key}`);
    for (const key of ['control_calls_title', 'control_calls_empty', 'control_calls_line', 'control_calls_never']) assert.ok(catalogue.deadlines[key], `${locale} ${key}`);
  }
});
