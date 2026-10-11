// TEENUSEPROFIIL — kinnituslink asutuse e-postile, mis on äriregistris kirjas.
//
// Teenuseosutaja kirjutab asutuse e-posti; platvorm kontrollib, et paar (registrikood, e-post) on
// äriregistris, ja saadab sinna ühekordse lingi. Lingi peab avama sama konto, mis profiili tegi.
// Platvorm ei hoia aadresse: kontrollfailis on ainult räsid ja profiili reale jääb lingi räsi.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  CONTACT_HASH_BYTES,
  checkRegisterContact,
  collectRegisterContactHashes,
  contactPairHash,
  hashListFrom,
  hashListHas,
  normalizeContactEmail,
  normalizeRegistryCode,
  resetRegisterContactsCache
} from '../lib/businessRegisterContacts.js';
import {
  REPRESENTATION_LINK_DAYS,
  RepresentationLinkError,
  confirmRepresentationByLink,
  describeRepresentationForOwner,
  describeRepresentationLink,
  requestRepresentationLink,
  revokeRepresentationAsAdmin
} from '../lib/serviceProviderRepresentation.js';
import {
  buildRepresentationConfirmUrl,
  renderRepresentationLinkEmail,
  sendRepresentationLinkEmail
} from '../lib/serviceProviderRepresentationMail.js';
import { representationView } from '../components/workspace/serviceProfile/representationRules.js';

const NOW = new Date('2026-10-11T08:00:00.000Z');
const UPDATED = new Date('2026-10-10T10:00:00.000Z');
/* Nimekontroll äriregistri vastu antakse ette nagu kontaktikontroll: need testid käivad kinnituse
   enda kohta. Nime reegleid hoiab tests/business-register-names.test.mjs. */
const nameMatches = async () => ({ result: 'match', registerName: 'Hea Hoolekanne OÜ' });
const TOKEN = 'a'.repeat(64);
/* Räsi ei tohi võtit sisaldada: test kontrollib, et toorvõtit ei salvestata. */
const hashToken = (token) => createHash('sha256').update(`test:${token}`).digest('hex');

/* Äriregistri faili kuju: iga väli omal real, asutus algab kaheksa tühiku taandega. */
function company({ code, status = 'R', contacts = [] }) {
  const lines = [
    '    {',
    `        "ariregistri_kood":${code},`,
    '        "nimi":"Näidis OÜ",',
    '        "yldandmed":{',
    `            "staatus":"${status}",`,
    '            "staatused":[',
    '                {',
    '                    "staatus":"X",',
    '                }',
    '            ],'
  ];
  if (!contacts.length) lines.push('            "sidevahendid":[],');
  else {
    lines.push('            "sidevahendid":[');
    for (const [kind, content, end] of contacts) {
      lines.push('                {', '                    "kirje_id":1,', `                    "liik":"${kind}",`,
        '                    "liik_tekstina":"x",', `                    "sisu":${JSON.stringify(content)},`,
        `                    "lopp_kpv":${end ? JSON.stringify(end) : 'null'}`, '                },');
    }
    lines.push('            ],');
  }
  lines.push('            "teatatud_tegevusalad":[]', '        }', '    },');
  return lines;
}

async function* linesOf(...companies) {
  yield '[';
  for (const lines of companies) for (const line of lines) yield line;
  yield ']';
}

test('registrikood ja e-post võrreldakse ühel kujul', () => {
  assert.equal(normalizeRegistryCode(' 12345678 '), '12345678');
  assert.equal(normalizeRegistryCode(12345678), '12345678');
  assert.equal(normalizeRegistryCode('EE-123'), '');
  assert.equal(normalizeContactEmail('  Info@Näidis.EE '), 'info@näidis.ee');
  for (const bad of ['', 'info', 'info@', 'a@b', 'kaks sõna@x.ee', 'a@x.ee, b@x.ee', '<info@x.ee>']) {
    assert.equal(normalizeContactEmail(bad), '', bad);
  }
  assert.equal(contactPairHash('12345678', 'INFO@x.ee').toString('hex'), contactPairHash(' 12345678', 'info@x.ee ').toString('hex'));
  assert.notEqual(contactPairHash('12345678', 'info@x.ee').toString('hex'), contactPairHash('12345679', 'info@x.ee').toString('hex'));
  assert.equal(contactPairHash('12345678', 'vigane'), null);
  assert.equal(contactPairHash('12345678', 'info@x.ee').length, CONTACT_HASH_BYTES);
});

test('äriregistri failist lähevad arvesse ainult registris oleva asutuse kehtivad e-posti kontaktid', async () => {
  const result = await collectRegisterContactHashes(linesOf(
    company({ code: 10000001, contacts: [['EMAIL', 'Info@Esimene.ee'], ['MOB', '5550000'], ['EMAIL', 'vana@esimene.ee', '01.01.2020']] }),
    company({ code: 10000002, status: 'L', contacts: [['EMAIL', 'info@likvideerimisel.ee']] }),
    company({ code: 10000003 }),
    company({ code: 10000004, contacts: [['WWW', 'www.neljas.ee'], ['EMAIL', 'a@neljas.ee'], ['EMAIL', 'b@neljas.ee']] })
  ));
  assert.equal(result.companies, 4);
  assert.equal(result.registered, 3);
  assert.equal(result.registeredWithEmail, 2);
  assert.equal(result.hashes.size, 3);
  const list = hashListFrom(result.hashes);
  assert.equal(list.length, 3 * CONTACT_HASH_BYTES);
  assert.equal(hashListHas(list, contactPairHash('10000001', 'info@esimene.ee')), true);
  assert.equal(hashListHas(list, contactPairHash('10000004', 'b@neljas.ee')), true);
  /* Lõppenud kontakt, likvideerimisel asutus, telefon ja teise asutuse aadress ei sobi. */
  assert.equal(hashListHas(list, contactPairHash('10000001', 'vana@esimene.ee')), false);
  assert.equal(hashListHas(list, contactPairHash('10000002', 'info@likvideerimisel.ee')), false);
  assert.equal(hashListHas(list, contactPairHash('10000004', 'info@esimene.ee')), false);
  assert.equal(hashListHas(list, null), false);
});

test('kontroll vastab kolmel viisil: on, ei ole, ei tea', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ar-kontakt-'));
  const file = path.join(dir, 'hashes.bin');
  const { hashes } = await collectRegisterContactHashes(linesOf(company({ code: 10000001, contacts: [['EMAIL', 'info@esimene.ee']] })));
  writeFileSync(file, hashListFrom(hashes));
  resetRegisterContactsCache();
  assert.equal(await checkRegisterContact('10000001', 'INFO@esimene.ee', { file }), 'match');
  assert.equal(await checkRegisterContact('10000001', 'muu@esimene.ee', { file }), 'no_match');
  assert.equal(await checkRegisterContact('99999999', 'info@esimene.ee', { file }), 'no_match');
  assert.equal(await checkRegisterContact('10000001', 'vigane', { file }), 'no_match');
  resetRegisterContactsCache();
  assert.equal(await checkRegisterContact('10000001', 'info@esimene.ee', { file: path.join(dir, 'puudub.bin') }), 'unavailable');
  writeFileSync(file, Buffer.alloc(5));
  resetRegisterContactsCache();
  assert.equal(await checkRegisterContact('10000001', 'info@esimene.ee', { file }), 'unavailable');
  resetRegisterContactsCache();
});

test('hoidlas olev kontrollfail on terve: kaheksabaidised kirjed, sorteeritud, päis klapib', () => {
  const list = readFileSync(new URL('../src/server/data/business-register-contact-hashes.bin', import.meta.url));
  const meta = JSON.parse(readFileSync(new URL('../src/server/data/business-register-contact-hashes.meta.json', import.meta.url), 'utf8'));
  assert.equal(list.length % CONTACT_HASH_BYTES, 0);
  assert.equal(list.length / CONTACT_HASH_BYTES, meta.pairs);
  assert.ok(meta.pairs > 300000, String(meta.pairs));
  assert.equal(meta.hashBytes, CONTACT_HASH_BYTES);
  for (let offset = CONTACT_HASH_BYTES; offset < list.length; offset += CONTACT_HASH_BYTES * 997) {
    assert.ok(list.compare(list, offset, offset + CONTACT_HASH_BYTES, offset - CONTACT_HASH_BYTES, offset) < 0, `järjestus kohal ${offset}`);
  }
  /* Failis ei ole loetavat teksti: ei ühtegi @-märgiga aadressi kuju. */
  assert.equal(/[a-z0-9]{3,}@[a-z0-9]{3,}\.[a-z]{2,}/u.test(list.toString('latin1')), false);
});

function fakeDb(profile) {
  const state = { profile: profile ? { ...profile } : null, entries: [{ providerProfileId: profile?.id, status: 'DRAFT' }], events: [] };
  const matches = (where = {}) => Boolean(state.profile) && Object.entries(where).every(([key, value]) => state.profile[key] === value);
  const tx = {
    serviceProviderProfile: {
      findFirst: async ({ where }) => (matches(where) ? { ...state.profile } : null),
      updateMany: async ({ where, data }) => {
        if (!matches(where)) return { count: 0 };
        Object.assign(state.profile, data);
        return { count: 1 };
      },
      update: async ({ data }) => { Object.assign(state.profile, data); return { ...state.profile }; }
    },
    serviceMapEntry: { updateMany: async () => ({ count: 0 }) },
    domainEvent: { create: async ({ data }) => { state.events.push(data); return data; } }
  };
  return { ...tx, $transaction: async (run) => run(tx), state };
}

const profile = (over = {}) => ({
  id: 'prof_1',
  ownerId: 'user_1',
  ownershipMode: 'SOLO',
  organizationName: 'Hea Hoolekanne OÜ',
  registryCode: '12345678',
  status: 'DRAFT',
  updatedAt: UPDATED,
  representationConfirmedAt: null,
  representationRegistryCode: null,
  representationMethod: null,
  representationConfirmedById: null,
  representationBasis: null,
  representationRequestHash: null,
  representationRequestCode: null,
  representationRequestExpiresAt: null,
  representationRequestSentAt: null,
  ...over
});

const deps = (db, over = {}) => {
  const mails = [];
  return {
    mails,
    options: {
      db,
      now: NOW,
      checkContact: async () => 'match',
      checkName: nameMatches,
      sendMail: async (mail) => { mails.push(mail); },
      prepareToken: () => ({ token: TOKEN, tokenHash: hashToken(TOKEN) }),
      ...over
    }
  };
};

const rejectsWith = (promise, key, status) => assert.rejects(promise, (error) => error.message === key && (!status || error.status === status));

test('taotlus: vigane aadress, puuduv profiil, registrikoodita profiil ja juba kinnitatud asutus saavad oma vastuse', async () => {
  const none = deps(fakeDb(null));
  await rejectsWith(requestRepresentationLink({ ownerId: 'user_1', email: 'vigane' }, none.options), RepresentationLinkError.EMAIL_INVALID, 400);
  await rejectsWith(requestRepresentationLink({ ownerId: 'user_1', email: 'info@x.ee' }, none.options), RepresentationLinkError.PROFILE_REQUIRED, 409);
  await rejectsWith(requestRepresentationLink({ ownerId: '', email: 'info@x.ee' }, none.options), 'api.common.unauthorized', 401);

  const noCode = deps(fakeDb(profile({ registryCode: null })));
  await rejectsWith(requestRepresentationLink({ ownerId: 'user_1', email: 'info@x.ee' }, noCode.options), RepresentationLinkError.PROFILE_REQUIRED, 409);

  const confirmed = deps(fakeDb(profile({ representationConfirmedAt: NOW, representationRegistryCode: '12345678', representationMethod: 'ADMIN' })));
  await rejectsWith(requestRepresentationLink({ ownerId: 'user_1', email: 'info@x.ee' }, confirmed.options), RepresentationLinkError.ALREADY_CONFIRMED, 409);
  assert.equal(none.mails.length + noCode.mails.length + confirmed.mails.length, 0);
});

test('taotlus: aadress, mida registris selle koodi juures ei ole, kirja ei saa; „ei tea” ei ole „ei ole”', async () => {
  const db = fakeDb(profile());
  const wrong = deps(db, { checkContact: async () => 'no_match' });
  await rejectsWith(requestRepresentationLink({ ownerId: 'user_1', email: 'petis@x.ee' }, wrong.options), RepresentationLinkError.EMAIL_NOT_IN_REGISTER, 400);
  const unknown = deps(db, { checkContact: async () => 'unavailable' });
  await rejectsWith(requestRepresentationLink({ ownerId: 'user_1', email: 'info@x.ee' }, unknown.options), RepresentationLinkError.REGISTER_UNAVAILABLE, 503);
  assert.equal(wrong.mails.length + unknown.mails.length, 0);
  assert.equal(db.state.profile.representationRequestHash, null);
});

test('taotlus: kiri läheb registri aadressile, reale jääb ainult lingi räsi ja aadressi ei salvestata', async () => {
  const db = fakeDb(profile());
  const seen = [];
  const { mails, options } = deps(db, { checkContact: async (code, email) => { seen.push([code, email]); return 'match'; } });
  const result = await requestRepresentationLink({ ownerId: 'user_1', email: '  Info@HeaHoolekanne.ee ', locale: 'et' }, options);
  assert.deepEqual(seen, [['12345678', 'info@heahoolekanne.ee']]);
  assert.equal(result.delivery, 'sent');
  assert.equal(result.expiresAt.getTime() - NOW.getTime(), REPRESENTATION_LINK_DAYS * 24 * 60 * 60 * 1000);
  assert.equal(mails.length, 1);
  assert.equal(mails[0].to, 'info@heahoolekanne.ee');
  assert.equal(mails[0].token, TOKEN);
  assert.equal(mails[0].organizationName, 'Hea Hoolekanne OÜ');
  assert.equal(db.state.profile.representationRequestHash, hashToken(TOKEN));
  assert.equal(db.state.profile.representationRequestCode, '12345678');
  assert.equal(db.state.profile.updatedAt, UPDATED);
  /* Ei toorlinki ega aadressi: ei real ega auditis. */
  const stored = JSON.stringify([db.state.profile, db.state.events]);
  assert.equal(stored.includes(TOKEN), false);
  assert.equal(stored.toLowerCase().includes('heahoolekanne.ee'), false);
  assert.equal(db.state.events[0].type, 'SERVICE_PROVIDER_REPRESENTATION_LINK_SENT');
});

test('taotlus: kui kiri teele ei läinud, jääb varasem link kehtima ja uut ei kirjutata', async () => {
  const earlier = { representationRequestHash: 'vana-rasi'.padEnd(40, 'x'), representationRequestCode: '12345678', representationRequestExpiresAt: new Date(NOW.getTime() + 86400000), representationRequestSentAt: NOW };
  const db = fakeDb(profile(earlier));
  const { options } = deps(db, { sendMail: async () => { throw new Error('smtp'); } });
  await rejectsWith(requestRepresentationLink({ ownerId: 'user_1', email: 'info@x.ee' }, options), RepresentationLinkError.MAIL_FAILED, 502);
  assert.equal(db.state.profile.representationRequestHash, earlier.representationRequestHash);
  assert.equal(db.state.events.length, 0);
});

const pending = (over = {}) => profile({
  representationRequestHash: hashToken(TOKEN),
  representationRequestCode: '12345678',
  representationRequestExpiresAt: new Date(NOW.getTime() + 86400000),
  representationRequestSentAt: new Date(NOW.getTime() - 3600000),
  ...over
});

test('lingiga kinnitamine: õige konto ja kehtiv link kinnitavad, link kulub ära', async () => {
  const db = fakeDb(pending());
  assert.deepEqual(await describeRepresentationLink({ ownerId: 'user_1', token: TOKEN }, { db, now: NOW, hashToken }), { valid: true, organizationName: 'Hea Hoolekanne OÜ', registryCode: '12345678' });
  const result = await confirmRepresentationByLink({ ownerId: 'user_1', token: TOKEN }, { db, now: NOW, hashToken, checkName: nameMatches });
  assert.equal(result.confirmed, true);
  assert.equal(result.method, 'EMAIL_LINK');
  assert.equal(db.state.profile.representationRegistryCode, '12345678');
  assert.equal(db.state.profile.representationMethod, 'EMAIL_LINK');
  assert.equal(db.state.profile.representationConfirmedById, 'user_1');
  assert.equal(db.state.profile.representationRequestHash, null);
  assert.equal(db.state.profile.representationRequestExpiresAt, null);
  assert.equal(db.state.profile.updatedAt, UPDATED);
  assert.equal(db.state.events[0].type, 'SERVICE_PROVIDER_REPRESENTATION_CONFIRMED');
  /* Sama link teist korda ei kehti. */
  await rejectsWith(confirmRepresentationByLink({ ownerId: 'user_1', token: TOKEN }, { db, now: NOW, hashToken }), RepresentationLinkError.LINK_INVALID, 400);
});

test('lingiga kinnitamine: võõras konto, aegunud link, muudetud kood ja vigane võti annavad sama vastuse', async () => {
  const cases = [
    [fakeDb(pending()), { ownerId: 'user_2', token: TOKEN }],
    [fakeDb(pending({ representationRequestExpiresAt: new Date(NOW.getTime() - 1000) })), { ownerId: 'user_1', token: TOKEN }],
    [fakeDb(pending({ registryCode: '87654321' })), { ownerId: 'user_1', token: TOKEN }],
    [fakeDb(pending()), { ownerId: 'user_1', token: 'b'.repeat(64) }],
    [fakeDb(pending()), { ownerId: 'user_1', token: 'lühike' }],
    [fakeDb(pending()), { ownerId: 'user_1', token: '' }]
  ];
  for (const [db, input] of cases) {
    assert.deepEqual(await describeRepresentationLink(input, { db, now: NOW, hashToken }), { valid: false });
    await rejectsWith(confirmRepresentationByLink(input, { db, now: NOW, hashToken }), RepresentationLinkError.LINK_INVALID, 400);
    assert.equal(db.state.profile.representationConfirmedAt, null);
    assert.equal(db.state.events.length, 0);
  }
  await rejectsWith(confirmRepresentationByLink({ ownerId: '', token: TOKEN }, { db: fakeDb(pending()), now: NOW, hashToken }), 'api.common.unauthorized', 401);
});

test('halduri tagasivõtmine tühistab ka ootel lingi', async () => {
  const db = fakeDb(pending({ representationConfirmedAt: NOW, representationRegistryCode: '12345678', representationMethod: 'ADMIN' }));
  await revokeRepresentationAsAdmin({ profileId: 'prof_1', adminUserId: 'admin_1' }, { db, now: NOW, checkName: nameMatches });
  assert.equal(db.state.profile.representationRequestHash, null);
  await rejectsWith(confirmRepresentationByLink({ ownerId: 'user_1', token: TOKEN }, { db, now: NOW, hashToken }), RepresentationLinkError.LINK_INVALID);
});

test('teenuseosutaja vaade: seis ja ootel link ilma räsita', async () => {
  assert.deepEqual(await describeRepresentationForOwner('user_1', { db: fakeDb(null), now: NOW }), { hasProfile: false });
  const open = await describeRepresentationForOwner('user_1', { db: fakeDb(pending()), now: NOW, checkName: nameMatches });
  assert.equal(open.required, true);
  assert.equal(open.confirmed, false);
  assert.deepEqual(Object.keys(open.pendingLink).sort(), ['expiresAt', 'sentAt']);
  assert.equal(JSON.stringify(open).includes(hashToken(TOKEN)), false);
  const expired = await describeRepresentationForOwner('user_1', { db: fakeDb(pending({ representationRequestExpiresAt: new Date(NOW.getTime() - 1) })), now: NOW, checkName: nameMatches });
  assert.equal(expired.pendingLink, null);
});

test('kiri: link tuleb ainult seadistatud aadressilt ja asutuse nimi läheb HTML-i varjestatult', async () => {
  assert.equal(buildRepresentationConfirmUrl(TOKEN, 'https://sotsiaal.pro/'), `https://sotsiaal.pro/teenuseprofiil/kinnitus?token=${TOKEN}`);
  assert.throws(() => buildRepresentationConfirmUrl(TOKEN, ''), /REPRESENTATION_BASE_URL_MISSING/);
  const mail = renderRepresentationLinkEmail({
    organizationName: '<b>Hea</b> & "Hoolekanne" OÜ',
    registryCode: '12345678',
    confirmUrl: `https://sotsiaal.pro/teenuseprofiil/kinnitus?token=${TOKEN}`,
    locale: 'et'
  });
  assert.match(mail.subject, /Sotsiaal\.pro/);
  assert.ok(mail.text.includes('<b>Hea</b> & "Hoolekanne" OÜ'));
  assert.ok(mail.text.includes('registrikood 12345678'));
  assert.ok(mail.text.includes(`token=${TOKEN}`));
  assert.ok(mail.text.includes(`${REPRESENTATION_LINK_DAYS} päeva`));
  assert.ok(mail.html.includes('&lt;b&gt;Hea&lt;/b&gt; &amp; &quot;Hoolekanne&quot; OÜ'));
  assert.equal(mail.html.includes('<b>Hea</b>'), false);
  for (const part of [mail.subject, mail.text, mail.html]) assert.equal(/\{[a-zA-Z]+\}/u.test(part), false, part.slice(0, 80));

  const sent = [];
  const mailer = { sendMail: async (message) => { sent.push(message); } };
  await sendRepresentationLinkEmail(
    { to: 'info@x.ee', organizationName: 'Hea OÜ', registryCode: '12345678', token: TOKEN, locale: 'en' },
    { mailer, from: 'Sotsiaal.pro <info@sotsiaal.pro>', baseUrl: 'https://sotsiaal.pro', isDev: false }
  );
  assert.equal(sent[0].to, 'info@x.ee');
  assert.match(sent[0].subject, /confirm/i);
  await assert.rejects(
    sendRepresentationLinkEmail({ to: 'info@x.ee', organizationName: 'Hea OÜ', registryCode: '1', token: TOKEN }, { mailer, from: '', baseUrl: 'https://sotsiaal.pro', isDev: false }),
    /REPRESENTATION_EMAIL_FROM_MISSING/
  );
  /* Arenduskeskkonnas päris kirja ei saadeta. */
  const dev = await sendRepresentationLinkEmail({ to: 'info@x.ee', organizationName: 'Hea OÜ', registryCode: '1', token: TOKEN }, { from: '', baseUrl: 'http://localhost:3000', isDev: true });
  assert.deepEqual(dev, { delivered: false, dev: true });
});

test('lehe vaade: sisselogimine ja õigus enne, link otsustab lingiga tulles, seis ilma lingita', () => {
  const base = { session: 'authenticated', loaded: true, forbidden: false, hasToken: false, done: false, state: { hasProfile: true, required: true, confirmed: false }, link: null };
  assert.equal(representationView({ ...base, session: 'loading' }), 'wait');
  assert.equal(representationView({ ...base, loaded: false }), 'wait');
  assert.equal(representationView({ ...base, session: 'unauthenticated' }), 'login');
  assert.equal(representationView({ ...base, forbidden: true }), 'forbidden');
  assert.equal(representationView(base), 'request');
  assert.equal(representationView({ ...base, state: { hasProfile: false } }), 'no_profile');
  assert.equal(representationView({ ...base, state: { hasProfile: true, required: false } }), 'no_profile');
  assert.equal(representationView({ ...base, state: { hasProfile: true, required: true, confirmed: true } }), 'confirmed');
  assert.equal(representationView({ ...base, hasToken: true, link: { valid: true } }), 'link');
  assert.equal(representationView({ ...base, hasToken: true, link: { valid: false } }), 'link_invalid');
  assert.equal(representationView({ ...base, hasToken: true, done: true, link: { valid: false } }), 'done');
  /* Kinnitatud asutuse juures ei pakuta vana lingiga uut kinnitamist. */
  assert.equal(representationView({ ...base, hasToken: true, link: { valid: true }, state: { hasProfile: true, required: true, confirmed: true } }), 'confirmed');
});

test('serveri vealaused ja kirja tekstid on kolmes keeles olemas', () => {
  for (const locale of ['et', 'en', 'ru']) {
    const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
    for (const key of Object.values(RepresentationLinkError)) {
      const text = key.split('.').reduce((node, part) => node?.[part], messages);
      assert.ok(typeof text === 'string' && text.length > 10, `${locale}: ${key}`);
    }
    const mail = messages.email.service_representation;
    for (const part of ['subject', 'text', 'html']) assert.ok(mail[part].includes('Sotsiaal.pro') || part === 'html', `${locale}: ${part}`);
    for (const slot of ['{organizationName}', '{registryCode}', '{confirmUrl}', '{days}']) {
      assert.ok(mail.text.includes(slot), `${locale}: tekst ${slot}`);
      assert.ok(mail.html.includes(slot), `${locale}: html ${slot}`);
    }
    assert.ok(messages.service_provider_profile.representation.link_confirm, locale);
    assert.ok(messages.workspace_feature_pages.service_profile.representation.open, locale);
  }
});
