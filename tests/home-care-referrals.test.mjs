import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { phoneHref } from '../lib/homeCare/phone.js';
import { normalizeReferralContacts } from '../lib/homeCare/referralContacts.js';

const refused = (fn, key) => assert.throws(fn, (error) => error.status === 400 && error.messageKey === key, key);

test('„kuhu suunata": loendi kuju, tühjad read ja poolik rida', () => {
  assert.deepEqual(
    normalizeReferralContacts([
      { name: '  Valla   sotsiaaltöötaja ', phone: ' 5555 1234 ', note: 'tööpäeviti 8–16' },
      { name: '', phone: '', note: '   ' },
      { name: 'Perearstikeskus' }
    ]),
    [
      { name: 'Valla sotsiaaltöötaja', phone: '5555 1234', note: 'tööpäeviti 8–16' },
      { name: 'Perearstikeskus', phone: null, note: null }
    ]
  );
  assert.deepEqual(normalizeReferralContacts([]), []);
  refused(() => normalizeReferralContacts('loend'), 'home_care.errors.referrals_invalid');
  /* Rida, kus on number, aga nime ei ole, on poolik: seda ei jäeta vaikselt välja. */
  refused(() => normalizeReferralContacts([{ name: ' ', phone: '112' }]), 'home_care.errors.referral_name_required');
  refused(() => normalizeReferralContacts([{ name: 'Nimi', phone: 'helista õhtul' }]), 'home_care.errors.referral_phone_invalid');
  refused(() => normalizeReferralContacts([{ name: 'Nimi', phone: '+ ( ) -' }]), 'home_care.errors.referral_phone_invalid');
  refused(() => normalizeReferralContacts(Array.from({ length: 21 }, (_, index) => ({ name: `Koht ${index}` }))), 'home_care.errors.referrals_too_many');
  refused(() => normalizeReferralContacts([{ name: 'x'.repeat(121) }]), 'home_care.errors.text_too_long');
});

test('helistamise link: ainult numbrid ja algav pluss', () => {
  assert.equal(phoneHref('+372 5555 1234'), 'tel:+37255551234');
  assert.equal(phoneHref('(0) 47-33 123'), 'tel:04733123');
  assert.equal(phoneHref('116 006'), 'tel:116006');
  assert.equal(phoneHref('12'), null);
  assert.equal(phoneHref(''), null);
  assert.equal(phoneHref(null), null);
});

test('tekstid on kolmes keeles ja koodis ei ole ühtegi telefoninumbrit peale 112', () => {
  for (const locale of ['et', 'en', 'ru']) {
    const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
    const texts = JSON.stringify(messages.home_care.referrals);
    assert.ok(messages.home_care.referrals.title, locale);
    /* Loend on asutuse hallata: tekstides ei tohi olla ette kirjutatud numbreid (116 006, 116 123 jms). */
    assert.deepEqual((texts.match(/\d{3,}/g) || []).filter((number) => number !== '112'), [], locale);
  }
  const sql = readFileSync(new URL('../prisma/migrations/20261011130000_home_care_referral_contacts/migration.sql', import.meta.url), 'utf8');
  assert.match(sql, /^SET lock_timeout = '5s';\r?\nSET statement_timeout = '30s';/m);
});
