import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { CARE_REPRESENTATIVE_BASES } from '../lib/homeCare/constants.js';
import { HOME_CARE_EXPORT_KEYS, HOME_CARE_EXPORT_VERSION } from '../lib/homeCare/exportFormat.js';
import { normalizeRepresentative, representativeCovers, representativeState, serializeRepresentative } from '../lib/homeCare/representatives.js';

const today = '2026-10-09';
const refused = (input, key) => assert.throws(() => normalizeRepresentative(input, today), (error) => error.status === 400 && error.messageKey === `home_care.errors.${key}`);
const base = { name: 'Mari Tamm', basis: 'POWER_OF_ATTORNEY', scope: 'Lepingu sõlmimine' };

test('esindusõigus: sisendi reeglid', () => {
  assert.deepEqual(normalizeRepresentative(base, today), {
    name: 'Mari Tamm',
    phone: null,
    basis: 'POWER_OF_ATTORNEY',
    scope: 'Lepingu sõlmimine',
    validFrom: null,
    validUntil: null,
    copyKept: null,
    checkedOn: '2026-10-09'
  });
  const full = normalizeRepresentative({ ...base, name: '  Mari   Tamm ', phone: ' 5555 1234 ', validFrom: '2026-01-01', validUntil: '2026-12-31', copyKept: ' Kaust 3 ', checkedOn: '2026-10-01' }, today);
  assert.deepEqual([full.name, full.phone, full.validFrom, full.validUntil, full.copyKept, full.checkedOn], ['Mari Tamm', '5555 1234', '2026-01-01', '2026-12-31', 'Kaust 3', '2026-10-01']);
  for (const basis of CARE_REPRESENTATIVE_BASES) assert.equal(normalizeRepresentative({ ...base, basis }, today).basis, basis);
  refused({ ...base, name: '' }, 'representative_name_required');
  refused({ ...base, basis: 'DAUGHTER' }, 'representative_basis_required');
  refused({ ...base, scope: '   ' }, 'representative_scope_required');
  refused({ ...base, validFrom: '2026-12-31', validUntil: '2026-01-01' }, 'representative_period_invalid');
  refused({ ...base, checkedOn: '2026-10-10' }, 'representative_checked_future');
  refused({ ...base, phone: 'õhtuti' }, 'referral_phone_invalid');
  /* Sama päev alguse ja lõpuna on lubatud. */
  assert.equal(normalizeRepresentative({ ...base, validFrom: '2026-10-09', validUntil: '2026-10-09' }, today).validUntil, '2026-10-09');
});

test('esindusõigus: kas õigus täna kehtib', () => {
  assert.equal(representativeState({}, today), 'VALID');
  assert.equal(representativeState({ validFrom: '2026-10-09', validUntil: '2026-10-09' }, today), 'VALID');
  assert.equal(representativeState({ validUntil: '2026-10-08' }, today), 'EXPIRED');
  assert.equal(representativeState({ validFrom: '2026-10-10' }, today), 'UPCOMING');
  const row = serializeRepresentative({ id: 'r1', name: 'Mari', basis: 'OTHER', scope: 'x', validUntil: '2026-10-01', checkedOn: '2026-01-01', createdByName: 'Lea Juht' }, today);
  assert.deepEqual([row.state, row.daysLeft, row.checkedByName, row.phone, row.copyKept], ['EXPIRED', -8, 'Lea Juht', null, null]);
  assert.equal(serializeRepresentative({ id: 'r2', name: 'M', basis: 'OTHER', scope: 'x', checkedOn: '2026-01-01' }, today).daysLeft, null);
});

test('esindusõigus: väljavõtte vorming alates 31 ja tekstid kolmes keeles', () => {
  /* Vorming kasvab iga uue koguga: siin loeb ainult see, et kogu on olemas alates versioonist 31. */
  assert.ok(HOME_CARE_EXPORT_VERSION >= 31);
  assert.ok(HOME_CARE_EXPORT_KEYS.includes('clientRepresentatives'));
  for (const locale of ['et', 'en', 'ru']) {
    const catalogue = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).home_care;
    for (const basis of CARE_REPRESENTATIVE_BASES) assert.ok(catalogue.representative.bases[basis], `${locale} ${basis}`);
    for (const key of ['title', 'none', 'add', 'form_hint', 'scope_label', 'end', 'end_confirm', 'period_open', 'checked_line', 'copy_line']) assert.ok(catalogue.representative[key], `${locale} ${key}`);
    for (const state of ['UPCOMING', 'EXPIRED']) assert.ok(catalogue.representative.states[state], `${locale} ${state}`);
    for (const key of ['representatives_due_title', 'representatives_due_empty', 'representatives_due_line', 'representatives_due_expired']) assert.ok(catalogue.deadlines[key], `${locale} ${key}`);
  }
});

test('esindusõigus: kas õigus kattis antud päeva', () => {
  const day = '2026-09-02';
  assert.equal(representativeCovers([], day), false);
  assert.equal(representativeCovers(null, day), false);
  assert.equal(representativeCovers([{ validFrom: null, validUntil: null, endedOn: null }], day), true);
  assert.equal(representativeCovers([{ validFrom: '2026-09-02', validUntil: '2026-09-02', endedOn: null }], day), true);
  assert.equal(representativeCovers([{ validFrom: '2026-09-03', validUntil: null, endedOn: null }], day), false);
  assert.equal(representativeCovers([{ validFrom: null, validUntil: '2026-09-01', endedOn: null }], day), false);
  /* Lõpetatud enne seda päeva ei kata; lõpetatud samal päeval või hiljem katab. */
  assert.equal(representativeCovers([{ validFrom: null, validUntil: null, endedOn: '2026-09-01' }], day), false);
  assert.equal(representativeCovers([{ validFrom: null, validUntil: null, endedOn: '2026-09-02' }], day), true);
  /* Piisab ühest katvast reast. */
  assert.equal(representativeCovers([{ validFrom: '2026-10-01', validUntil: null, endedOn: null }, { validFrom: '2026-01-01', validUntil: '2026-12-31', endedOn: null }], day), true);
});
