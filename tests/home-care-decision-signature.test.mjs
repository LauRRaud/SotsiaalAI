import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { CARE_SIGNED_STATES, CARE_SIGN_STATES } from '../lib/homeCare/constants.js';
import { normalizeSignature, signatureOpen } from '../lib/homeCare/decisions.js';
import { HOME_CARE_EXPORT_READABLE_VERSIONS, HOME_CARE_EXPORT_VERSION } from '../lib/homeCare/exportFormat.js';

const refused = (fn, key) => assert.throws(fn, (error) => error.status === 400 && String(error.messageKey || error.message).includes(key));

test('lepingu allkirja märge: sisendi reeglid', () => {
  const today = '2026-10-09';
  assert.deepEqual(normalizeSignature({}, 'CONTRACT', today), { signState: null, signedOn: null, originalKept: null });
  assert.deepEqual(normalizeSignature({ signState: '', signedOn: '', originalKept: '  ' }, 'ACT', today), { signState: null, signedOn: null, originalKept: null });
  assert.deepEqual(normalizeSignature({ signState: 'PAPER', signedOn: '2026-10-09', originalKept: ' Kaust 3 ' }, 'CONTRACT', today), {
    signState: 'PAPER',
    signedOn: '2026-10-09',
    originalKept: 'Kaust 3'
  });
  for (const state of CARE_SIGN_STATES) assert.equal(normalizeSignature({ signState: state }, 'CONTRACT', today).signState, state);
  /* Originaali koht käib ka haldusaktiga; allkirja märge mitte. */
  assert.equal(normalizeSignature({ originalKept: 'Register 5-2/117' }, 'ACT', today).originalKept, 'Register 5-2/117');
  refused(() => normalizeSignature({ signState: 'PAPER' }, 'ACT', today), 'decision_sign_contract_only');
  refused(() => normalizeSignature({ signState: 'SIGNED' }, 'CONTRACT', today), 'decision_sign_state_invalid');
  /* Päev ainult seisuga, kus keegi alla kirjutas, ja mitte tulevikus. */
  for (const state of CARE_SIGN_STATES.filter((value) => !CARE_SIGNED_STATES.includes(value))) {
    refused(() => normalizeSignature({ signState: state, signedOn: '2026-10-01' }, 'CONTRACT', today), 'decision_signed_on_state');
  }
  refused(() => normalizeSignature({ signedOn: '2026-10-01' }, 'CONTRACT', today), 'decision_signed_on_state');
  refused(() => normalizeSignature({ signState: 'DIGITAL', signedOn: '2026-10-10' }, 'CONTRACT', today), 'decision_signed_on_future');
});

test('lepingu allkirja märge: mis on hooldusjuhi nimekirjas', () => {
  assert.equal(signatureOpen({ kind: 'CONTRACT', signState: null }), 'MISSING');
  assert.equal(signatureOpen({ kind: 'CONTRACT', signState: 'UNSURE' }), 'UNSURE');
  for (const state of ['PAPER', 'DIGITAL', 'REPRESENTATIVE', 'NOT_REQUIRED']) assert.equal(signatureOpen({ kind: 'CONTRACT', signState: state }), null, state);
  assert.equal(signatureOpen({ kind: 'ACT', signState: null }), null);
});

test('lepingu allkirja märge: väljavõtte vorming alates 30 ja tekstid kolmes keeles', () => {
  /* Vorming kasvab iga uue koguga: siin loeb ainult see, et 30 on olemas ja loetav. */
  assert.ok(HOME_CARE_EXPORT_VERSION >= 30);
  assert.ok(HOME_CARE_EXPORT_READABLE_VERSIONS.includes(29) && HOME_CARE_EXPORT_READABLE_VERSIONS.includes(30));
  for (const locale of ['et', 'en', 'ru']) {
    const catalogue = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).home_care;
    for (const state of CARE_SIGN_STATES) assert.ok(catalogue.decision.sign_states[state], `${locale} ${state}`);
    for (const key of ['sign_label', 'sign_hint', 'sign_missing', 'signed_on_label', 'original_label', 'original_hint', 'original_line']) assert.ok(catalogue.decision[key], `${locale} ${key}`);
    for (const key of ['contracts_unsigned_title', 'contracts_unsigned_empty', 'contracts_unsigned_line', 'contracts_unsigned_unsure']) assert.ok(catalogue.deadlines[key], `${locale} ${key}`);
    for (const key of ['decision_sign_state_invalid', 'decision_sign_contract_only', 'decision_signed_on_state', 'decision_signed_on_future']) assert.ok(catalogue.errors[key], `${locale} ${key}`);
  }
});
