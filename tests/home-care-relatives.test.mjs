import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { CARE_SHARING_LEVELS } from '../lib/homeCare/constants.js';
import { normalizeRelative, relativeReviewState } from '../lib/homeCare/relatives.js';

const TODAY = '2026-10-09';
const refused = (fn, key) => assert.throws(fn, (error) => error.status === 400 && error.messageKey === key, key);

test('lähedase sisend: nimi ja aste kohustuslikud, päev vaikimisi täna', () => {
  assert.deepEqual(normalizeRelative({ name: '  Mari   Tamm ', relation: 'tütar', phone: ' +372 5555 1234 ', level: 2, noTell: ' rahaasjad ' }, TODAY), {
    name: 'Mari Tamm',
    relation: 'tütar',
    phone: '+372 5555 1234',
    level: 2,
    noTell: 'rahaasjad',
    agreedOn: TODAY
  });
  /* Aste võib tulla ka tekstina (vormist); varasem kinnituse päev jääb alles. */
  assert.deepEqual(normalizeRelative({ name: 'Jaan', level: '1', agreedOn: '2026-03-01' }, TODAY), { name: 'Jaan', relation: null, phone: null, level: 1, noTell: null, agreedOn: '2026-03-01' });
  refused(() => normalizeRelative({ level: 1 }, TODAY), 'home_care.errors.relative_name_required');
  refused(() => normalizeRelative({ name: 'Mari' }, TODAY), 'home_care.errors.relative_level_required');
  refused(() => normalizeRelative({ name: 'Mari', level: 4 }, TODAY), 'home_care.errors.relative_level_required');
  refused(() => normalizeRelative({ name: 'Mari', level: 1, phone: 'õhtuti' }, TODAY), 'home_care.errors.referral_phone_invalid');
  refused(() => normalizeRelative({ name: 'Mari', level: 1, agreedOn: '2026-10-10' }, TODAY), 'home_care.errors.relative_day_future');
});

test('kokkulepe küsitakse üle, kui kinnitusest on möödas üle poole aasta', () => {
  assert.deepEqual(relativeReviewState('2026-10-09', TODAY), { days: 0, due: false });
  assert.deepEqual(relativeReviewState('2026-04-09', TODAY), { days: 183, due: false });
  assert.deepEqual(relativeReviewState('2026-04-08', TODAY), { days: 184, due: true });
});

test('astmed on kolmes keeles; migratsioon hoiab astme vahemikku', () => {
  for (const locale of ['et', 'en', 'ru']) {
    const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
    for (const level of CARE_SHARING_LEVELS) assert.ok(messages.home_care.relatives.levels[String(level)], `${locale} ${level}`);
  }
  const sql = readFileSync(new URL('../prisma/migrations/20261011190000_home_care_client_relatives/migration.sql', import.meta.url), 'utf8');
  assert.match(sql, /"level" BETWEEN 1 AND 3/);
  assert.match(sql, /^SET lock_timeout = '5s';\r?\nSET statement_timeout = '30s';/m);
});
