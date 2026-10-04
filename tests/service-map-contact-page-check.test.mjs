import test from 'node:test';
import assert from 'node:assert/strict';
import { contactPageChecks } from '../lib/admin/rag/contactRegistry/pageCheck.js';

// The weekly contact check, one page at a time. When the page's staff list names the person, the person's own record
// decides the phone and the e-mail; otherwise the older text window decides as before. Fictional values only.
const card = (name, role, email, phone, extra = '') => `<div class="vp-employee"><div class="vp-employee__name"><p>${name}</p><p class="vp-employee__office">${role}</p></div>
  <div class="vp-employee__contact"><p>${email ? `<a href="mailto:${email}" class="vp-employee__email">${email}</a>` : ''}</p><p>${phone}</p></div><div>${extra}</div></div>`;
const page = body => Buffer.from(`<html><body><main><h2>Sotsiaalosakond</h2>${body}</main></body></html>`);
const row = (title, role, phone, email, type = 'KOV_GENERAL_CONTACT') => ({ id: `synthetic-${title}`, type, title, description: role ? `Roll: ${role}` : null, phone, email });
const check = (body, contact) => { const { checks } = contactPageChecks(page(body), [contact]); const { entry: _entry, ...signals } = checks[0]; return signals; };
const twoPeople = card('Mari Maasikas', 'Sotsiaaltööspetsialist', 'mari.maasikas@example.invalid', '5550 0001') + card('Jaan Tamm', 'Sotsiaaltööspetsialist', 'jaan.tamm@example.invalid', '5550 0002');

test('a register row that matches the person\'s own record is confirmed', () => {
  assert.deepEqual(check(twoPeople, row('Mari Maasikas', 'sotsiaaltööspetsialist', '+372 5550 0001', 'mari.maasikas@example.invalid')),
    { verified: true, identityVerified: true, phoneVerified: true, emailVerified: true, stronglyMissing: false, reasons: [], decidedBy: 'staff_record', roleDiffers: false });
});

test('the next person\'s phone does not confirm the row, although it stands right after the name in the page text', () => {
  // Jaan Tamm is not in the register, so the text window of Mari Maasikas runs over his record too.
  const signals = check(twoPeople, row('Mari Maasikas', 'sotsiaaltööspetsialist', '5550 0002', 'mari.maasikas@example.invalid'));
  assert.deepEqual([signals.verified, signals.phoneVerified, signals.emailVerified, signals.decidedBy], [false, false, true, 'staff_record']);
  assert.deepEqual(signals.reasons, ['phone_not_found', 'contact_tuple_not_confirmed']);
});

test('an e-mail the page hides from robots confirms the row', () => {
  const hidden = `<div class="wp-block-columns kontaktimuster"><p class="ankur">Kati Kask</p><p class="ankur">eestkostespetsialist</p><p>kati.kask(ät)example.invalid</p><p>5550 0003</p></div>`;
  assert.equal(check(hidden, row('Kati Kask', 'eestkostespetsialist', '5550 0003', 'kati.kask@example.invalid')).verified, true);
});

test('the role: the same text or one inside the other confirms; another role does not', () => {
  const body = card('Peeter Paju', 'Sotsiaaltöö peaspetsialist', 'peeter.paju@example.invalid', '5550 0004');
  assert.equal(check(body, row('Peeter Paju', 'sotsiaaltöö peaspetsialist asenduskoht', '5550 0004', 'peeter.paju@example.invalid')).verified, true);
  const other = check(body, row('Peeter Paju', 'hooldusjuht', '5550 0004', 'peeter.paju@example.invalid'));
  assert.deepEqual([other.verified, other.identityVerified, other.phoneVerified, other.emailVerified], [false, false, true, true]);
  assert.deepEqual(other.reasons, ['contact_role_not_found', 'contact_tuple_not_confirmed']);
  // One role inside the other counts by whole words: a deputy mayor is not confirmed by "Linnapea".
  const mayor = card('Reet Rebane', 'Linnapea', 'reet.rebane@example.invalid', '5550 0010');
  assert.equal(check(mayor, row('Reet Rebane', 'sotsiaalvaldkonna abilinnapea', '5550 0010', 'reet.rebane@example.invalid')).verified, false);
  assert.equal(check(mayor, row('Reet Rebane', 'Näidise linnapea', '5550 0010', 'reet.rebane@example.invalid')).verified, true);
});

test('the heading above the person confirms a role the register took from it', () => {
  const body = `</main><main><h2>Koduhooldustöötajad</h2>${card('Tiina Teder', 'Imavere piirkond', 'tiina.teder@example.invalid', '5550 0011')}`;
  assert.equal(check(body, row('Tiina Teder', 'koduhooldustöötaja', '5550 0011', 'tiina.teder@example.invalid')).verified, true);
});

test('a record that shows no role leaves the role to the text window; a record with another role does not', () => {
  // The fold-out caption is not a role, so the record shows none; the role stands in the text after the name.
  const noRole = `<div class="wp-block-columns kontaktimuster"><p class="ankur">Ott Orav</p><p><a href="mailto:ott.orav@example.invalid">ott.orav@example.invalid</a></p><p>5550 0012</p>
    <details><summary>haridus, ametijuhend</summary><p>Teenistuse juht. Vastuvõtt kokkuleppel.</p></details></div>`;
  const kept = check(noRole, row('Ott Orav', 'teenistuse juht', '5550 0012', 'ott.orav@example.invalid'));
  assert.deepEqual([kept.verified, kept.decidedBy], [true, 'staff_record']);
  // The person's own card says "peaspetsialist"; the register's "lastekaitsespetsialist" stands in the next card.
  const promoted = card('Epp Eha', 'Lastekaitse peaspetsialist', 'epp.eha@example.invalid', '5550 0013') + card('Uku Urb', 'Lastekaitsespetsialist', 'uku.urb@example.invalid', '5550 0014');
  assert.equal(check(promoted, row('Epp Eha', 'lastekaitsespetsialist', '5550 0013', 'epp.eha@example.invalid')).verified, false);
});

test('a social contact whose title the page words differently is confirmed and counted; one who left the social field is not', () => {
  const body = card('Epp Eha', 'Lastekaitse peaspetsialist', 'epp.eha@example.invalid', '5550 0013')
    + '<h2>Ehitusosakond</h2>' + card('Kalle Kuusk', 'Ehitusnõunik', 'kalle.kuusk@example.invalid', '5550 0015');
  const stale = check(body, row('Epp Eha', 'lastekaitse vanemspetsialist', '5550 0013', 'epp.eha@example.invalid', 'KOV_SOCIAL_CONTACT'));
  assert.deepEqual([stale.verified, stale.roleDiffers, stale.reasons], [true, true, []]);
  const moved = check(body, row('Kalle Kuusk', 'sotsiaaltööspetsialist', '5550 0015', 'kalle.kuusk@example.invalid', 'KOV_SOCIAL_CONTACT'));
  assert.deepEqual([moved.verified, moved.roleDiffers, moved.reasons], [false, false, ['contact_role_not_found', 'contact_tuple_not_confirmed']]);
});

test('a compound the page writes apart, or whose first part stands in the heading', () => {
  const body = card('Mall Mets', 'Osakonna juhataja', 'mall.mets@example.invalid', '5550 0016') + card('Siim Saar', 'eestkoste spetsialist', 'siim.saar@example.invalid', '5550 0017');
  assert.deepEqual([check(body, row('Mall Mets', 'sotsiaalosakonna juhataja', '5550 0016', 'mall.mets@example.invalid')).verified,
    check(body, row('Mall Mets', 'ehitusosakonna juhataja', '5550 0016', 'mall.mets@example.invalid')).verified,
    check(body, row('Siim Saar', 'eestkostespetsialist', '5550 0017', 'siim.saar@example.invalid')).verified], [true, false, true]);
});

test('two addresses in one register field, and an address the page writes with a diacritic', () => {
  const body = card('Anne Aas', 'Sotsiaal- ja lastekaitsespetsialist', 'sotsiaal@example.invalid', '5550 0005', '<a href="mailto:lastekaitse@example.invalid">lastekaitse@example.invalid</a>')
    + card('Ülle Õun', 'Sotsiaaltöö spetsialist', 'ülle.õun@example.invalid', '5550 0006');
  assert.equal(check(body, row('Anne Aas', 'sotsiaal- ja lastekaitsespetsialist', '5550 0005', 'sotsiaal@example.invalid, lastekaitse@example.invalid')).verified, true);
  assert.equal(check(body, row('Ülle Õun', 'sotsiaaltöö spetsialist', '5550 0006', 'ulle.oun@example.invalid')).verified, true);
});

test('a person the page marks as away is not confirmed', () => {
  const signals = check(card('Leida Lill', 'Spetsialist', 'amet@example.invalid', '', 'ametnik töösuhe peatatud'), row('Leida Lill', 'spetsialist', null, 'amet@example.invalid'));
  assert.deepEqual([signals.verified, signals.reasons], [false, ['contact_away', 'contact_tuple_not_confirmed']]);
});

test('a row with a name and a role only is confirmed by the card', () => {
  const body = `<div class="wp-block-columns"><p class="ankur has-medium-font-size">Tiit Toom</p><p class="ankur has-small-font-size">hooldustöötaja</p></div>`;
  assert.equal(check(body, row('Tiit Toom', 'hooldustöötaja', null, null)).verified, true);
});

test('when the staff list does not name the row, the text window decides as before', () => {
  // The register row is a post, not a person: the page shows the post with its phone.
  const post = `<p>Hooldustöötaja (0,4)<br>Telefon: 5550 0007</p>`;
  const kept = check(post, row('Hooldustöötaja', 'hooldustöötaja', '5550 0007', null));
  assert.deepEqual([kept.verified, kept.decidedBy], [true, 'text_window']);
  const gone = check(twoPeople, row('Rein Rohi', 'sotsiaaltööspetsialist', '5550 0009', 'rein.rohi@example.invalid'));
  assert.deepEqual([gone.verified, gone.stronglyMissing, gone.decidedBy], [false, true, 'text_window']);
});

test('the page reports how many people its staff list holds', () => {
  assert.equal(contactPageChecks(page(twoPeople), []).staffPeople, 2);
  assert.deepEqual(contactPageChecks(Buffer.from(''), [row('Mari Maasikas', null, null, null)]).checks.map(item => item.decidedBy), ['text_window']);
});
