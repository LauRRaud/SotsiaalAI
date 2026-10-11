// TEENUSEPROFIILI TEATED — kes saab teada, kui profiili kinnitus või avaldamine muutub.
//
// Enne ei saanud keegi midagi teada: asutuse nimel võis profiil avalduda nii, et asutus sellest ei
// kuulnud, ja konto omanik ei saanud teadet, et kinnitus ootab asutuse postkastis. Riskid, mida
// need testid kinni hoiavad:
//   1. kiri läheb aadressile, mis ei ole äriregistris selle registrikoodi kontakt;
//   2. teade läheb valele inimesele (mitte profiili omanikule);
//   3. tavaline salvestus või edasi-tagasi lülitamine täidab postkasti;
//   4. teate ebaõnnestumine lükkab kinnituse või salvestuse tagasi.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  NOTIFICATION_EVENT_TYPES,
  assertNotificationRecipient,
  createNotificationEvent,
  notificationSpec,
  serializeNotificationEvent
} from '../lib/notifications.js';
import {
  NoticeOutcome,
  PUBLISHED_QUIET_MS,
  announceProfilePublished,
  announceRepresentationConfirmed,
  announceRepresentationLinkSent,
  announceRepresentationRevoked,
  readPublicationStatus
} from '../lib/serviceProviderProfileNotices.js';
import {
  OrganizationNoticeKind,
  renderOrganizationNoticeEmail,
  sendOrganizationNoticeEmail
} from '../lib/serviceProviderProfileNoticeMail.js';

const NOW = new Date('2026-10-11T10:00:00.000Z');
const AT = new Date('2026-10-11T09:25:38.728Z');
const LOCALES = ['et', 'en', 'ru'];
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const profileRow = (overrides = {}) => ({
  id: 'p1', ownerId: 'u1', ownershipMode: 'SOLO', organizationName: 'Näidisühing MTÜ', registryCode: '80000001',
  email: 'Info@Naidis.example', status: 'DRAFT', updatedAt: new Date('2026-10-11T09:50:00.000Z'), ...overrides
});

/** Väljamõeldud andmebaas ja püütud kutsed: teavitus, registrikontroll ja kiri. */
function setup(profile = profileRow(), { contact = 'match', recent = null, notifyError = false, mailError = false, dbError = false } = {}) {
  const seen = { profileWhere: [], recentWhere: [], notices: [], checks: [], mails: [] };
  const db = {
    serviceProviderProfile: {
      findFirst: async ({ where }) => {
        if (dbError) throw new Error('db down');
        seen.profileWhere.push(where);
        if (!profile) return null;
        if (where.id) return where.id === profile.id ? { ...profile } : null;
        return where.ownerId === profile.ownerId && where.ownershipMode === profile.ownershipMode ? { ...profile } : null;
      }
    },
    notificationEvent: {
      findFirst: async ({ where }) => { seen.recentWhere.push(where); return recent; }
    }
  };
  const options = {
    db,
    now: NOW,
    notify: async (input) => {
      if (notifyError) throw new Error('notify down');
      seen.notices.push(input);
      return { created: true };
    },
    checkContact: async (code, email) => { seen.checks.push([code, email]); return contact; },
    sendMail: async (input) => {
      if (mailError) throw new Error('mail down');
      seen.mails.push(input);
      return { delivered: true };
    }
  };
  return { seen, options };
}

test('kinnituslink saadetud: konto omanik saab teate, asutusele teist kirja ei lähe', async () => {
  const { seen, options } = setup();
  const result = await announceRepresentationLinkSent({ ownerId: 'u1', sentAt: AT }, options);
  assert.deepEqual(result, { owner: NoticeOutcome.CREATED, organization: NoticeOutcome.NOT_NEEDED });
  assert.deepEqual(seen.notices, [{
    type: NOTIFICATION_EVENT_TYPES.SERVICE_REPRESENTATION_LINK_SENT, userId: 'u1', sourceId: 'p1', targetId: 'p1',
    dedupeSuffix: 'at:2026-10-11T09:25:38.728Z', emailPolicy: 'TRANSACTIONAL'
  }]);
  assert.deepEqual(seen.profileWhere, [{ ownerId: 'u1', ownershipMode: 'SOLO' }]);
  assert.deepEqual(seen.mails, []);
});

test('halduri kinnitus: omanik saab teate ja asutus kirja, kui profiili e-post on registris selle koodi kontakt', async () => {
  const { seen, options } = setup();
  const result = await announceRepresentationConfirmed({ profileId: 'p1', method: 'ADMIN', confirmedAt: AT, locale: 'et' }, options);
  assert.deepEqual(result, { owner: NoticeOutcome.CREATED, organization: NoticeOutcome.SENT });
  assert.equal(seen.notices[0].type, NOTIFICATION_EVENT_TYPES.SERVICE_REPRESENTATION_CONFIRMED);
  assert.equal(seen.notices[0].dedupeSuffix, 'at:2026-10-11T09:25:38.728Z');
  // Kontroll ja kiri käivad sama, ühtlustatud aadressiga; kiri kannab ainult asutuse nime ja koodi.
  assert.deepEqual(seen.checks, [['80000001', 'info@naidis.example']]);
  assert.deepEqual(seen.mails, [{
    to: 'info@naidis.example', kind: OrganizationNoticeKind.CONFIRMED_BY_ADMIN, organizationName: 'Näidisühing MTÜ', registryCode: '80000001', locale: 'et'
  }]);
});

test('lingiga kinnitus: omanik saab teate, asutusele kirja ei lähe (asutuse postkast osales ise)', async () => {
  const { seen, options } = setup();
  const result = await announceRepresentationConfirmed({ ownerId: 'u1', method: 'EMAIL_LINK', confirmedAt: AT, locale: 'et' }, options);
  assert.deepEqual(result, { owner: NoticeOutcome.CREATED, organization: NoticeOutcome.NOT_NEEDED });
  assert.deepEqual([seen.checks, seen.mails], [[], []]);
});

test('asutusele ei lähe kirja aadressile, mis ei ole registris selle koodi kontakt', async () => {
  const cases = [
    [profileRow({ email: null }), 'match', NoticeOutcome.NO_ADDRESS],
    [profileRow({ email: 'mitte aadress' }), 'match', NoticeOutcome.NO_ADDRESS],
    [profileRow({ registryCode: null }), 'match', NoticeOutcome.NO_ADDRESS],
    [profileRow({ registryCode: '  ' }), 'match', NoticeOutcome.NO_ADDRESS],
    [profileRow(), 'no_match', NoticeOutcome.NOT_REGISTER_CONTACT],
    [profileRow(), 'unavailable', NoticeOutcome.REGISTER_UNAVAILABLE],
    // Ainult täpne „match" loeb: tundmatu vastus ei ole luba.
    [profileRow(), null, NoticeOutcome.NOT_REGISTER_CONTACT],
    [profileRow(), true, NoticeOutcome.NOT_REGISTER_CONTACT]
  ];
  for (const [row, contact, expected] of cases) {
    const { seen, options } = setup(row, { contact });
    const result = await announceRepresentationConfirmed({ profileId: 'p1', method: 'ADMIN', confirmedAt: AT }, options);
    assert.equal(result.organization, expected, `${row.email} / ${row.registryCode} / ${contact}`);
    assert.deepEqual(seen.mails, []);
    // Omaniku teade ei sõltu sellest, kas asutusele saab kirjutada.
    assert.equal(result.owner, NoticeOutcome.CREATED);
  }
});

test('kinnituse tagasivõtmine: omanik saab teate ja asutus kirja', async () => {
  const { seen, options } = setup(profileRow({ status: 'HIDDEN' }));
  const result = await announceRepresentationRevoked({ profileId: 'p1', locale: 'ru' }, options);
  assert.deepEqual(result, { owner: NoticeOutcome.CREATED, organization: NoticeOutcome.SENT });
  assert.equal(seen.notices[0].type, NOTIFICATION_EVENT_TYPES.SERVICE_REPRESENTATION_REVOKED);
  // Ajata sündmus kannab praegust hetke: iga tagasivõtmine on oma teade.
  assert.equal(seen.notices[0].dedupeSuffix, `at:${NOW.toISOString()}`);
  assert.deepEqual([seen.mails[0].kind, seen.mails[0].locale], [OrganizationNoticeKind.REVOKED, 'ru']);
});

test('avaldamine: teade läheb ainult üleminekul avaldatuks', async () => {
  const published = profileRow({ status: 'PUBLISHED' });
  for (const previousStatus of ['DRAFT', 'REVIEW', 'HIDDEN', null, undefined]) {
    const { seen, options } = setup(published);
    const result = await announceProfilePublished({ previousStatus, profile: published, locale: 'et' }, options);
    assert.deepEqual(result, { owner: NoticeOutcome.CREATED, organization: NoticeOutcome.SENT }, String(previousStatus));
    assert.deepEqual(seen.notices, [{
      type: NOTIFICATION_EVENT_TYPES.SERVICE_PROFILE_PUBLISHED, userId: 'u1', sourceId: 'p1', targetId: 'p1',
      dedupeSuffix: 'at:2026-10-11T09:50:00.000Z', emailPolicy: 'TRANSACTIONAL'
    }]);
    assert.equal(seen.mails[0].kind, OrganizationNoticeKind.PUBLISHED);
  }
  // Avaldatud profiili tavaline salvestus ja avaldamata profiil ei teavita kedagi.
  for (const [previousStatus, profile] of [['PUBLISHED', published], ['published', published], ['DRAFT', profileRow()], ['PUBLISHED', profileRow({ status: 'HIDDEN' })], ['DRAFT', null], ['DRAFT', {}]]) {
    const { seen, options } = setup(published);
    const result = await announceProfilePublished({ previousStatus, profile }, options);
    assert.deepEqual(result, { owner: NoticeOutcome.NOT_NEEDED, organization: NoticeOutcome.NOT_NEEDED });
    assert.deepEqual([seen.notices, seen.mails, seen.recentWhere], [[], [], []]);
  }
});

test('avaldamine uuesti ööpäeva sees: platvormi teade tuleb, e-kirju ei tule', async () => {
  const published = profileRow({ status: 'PUBLISHED' });
  const { seen, options } = setup(published, { recent: { id: 'n1' } });
  const result = await announceProfilePublished({ previousStatus: 'DRAFT', profile: published }, options);
  assert.deepEqual(result, { owner: NoticeOutcome.CREATED, organization: NoticeOutcome.RECENT });
  assert.equal(seen.notices[0].emailPolicy, 'NONE');
  assert.deepEqual([seen.checks, seen.mails], [[], []]);
  assert.deepEqual(seen.recentWhere, [{
    type: NOTIFICATION_EVENT_TYPES.SERVICE_PROFILE_PUBLISHED, sourceId: 'p1', createdAt: { gt: new Date(NOW.getTime() - PUBLISHED_QUIET_MS) }
  }]);
  assert.equal(PUBLISHED_QUIET_MS, 24 * 60 * 60 * 1000);
});

test('organisatsiooni profiilil ei ole isiklikku adressaati; puuduv profiil ei teavita kedagi', async () => {
  const org = setup(profileRow({ ownershipMode: 'ORGANIZATION' }));
  assert.deepEqual(await announceRepresentationRevoked({ profileId: 'p1' }, org.options), { owner: NoticeOutcome.NO_OWNER, organization: NoticeOutcome.SENT });
  assert.deepEqual(org.seen.notices, []);

  const missing = setup(null);
  assert.deepEqual(await announceRepresentationConfirmed({ profileId: 'p9', method: 'ADMIN' }, missing.options), { owner: NoticeOutcome.NO_PROFILE, organization: NoticeOutcome.NO_PROFILE });
  assert.deepEqual(await announceRepresentationLinkSent({ ownerId: 'u9' }, missing.options), { owner: NoticeOutcome.NO_PROFILE, organization: NoticeOutcome.NOT_NEEDED });

  // Tühi tunnus ei jõua päringusse: Prisma jätaks tühja tingimuse vahele ja leiaks võõra rea.
  const empty = setup();
  assert.deepEqual(await announceRepresentationRevoked({ profileId: '  ' }, empty.options), { owner: NoticeOutcome.NO_PROFILE, organization: NoticeOutcome.NO_PROFILE });
  assert.deepEqual(await announceRepresentationLinkSent({ ownerId: '' }, empty.options), { owner: NoticeOutcome.NO_PROFILE, organization: NoticeOutcome.NOT_NEEDED });
  assert.deepEqual(empty.seen.profileWhere, []);
});

test('teate ebaõnnestumine ei viska: kinnitus ja salvestus jäävad kehtima', async () => {
  const quiet = console.error;
  console.error = () => {};
  try {
    const notify = setup(profileRow(), { notifyError: true });
    assert.deepEqual(await announceRepresentationConfirmed({ profileId: 'p1', method: 'ADMIN' }, notify.options), { owner: NoticeOutcome.FAILED, organization: NoticeOutcome.SENT });
    const mail = setup(profileRow(), { mailError: true });
    assert.deepEqual(await announceRepresentationRevoked({ profileId: 'p1' }, mail.options), { owner: NoticeOutcome.CREATED, organization: NoticeOutcome.FAILED });
    const down = setup(profileRow(), { dbError: true });
    for (const run of [
      () => announceRepresentationLinkSent({ ownerId: 'u1' }, down.options),
      () => announceRepresentationConfirmed({ profileId: 'p1', method: 'ADMIN' }, down.options),
      () => announceRepresentationRevoked({ profileId: 'p1' }, down.options)
    ]) {
      assert.deepEqual(await run(), { owner: NoticeOutcome.FAILED, organization: NoticeOutcome.FAILED });
    }
    // Teadmata eelmine olek loetakse avaldatuks: muidu saadaks iga salvestus teate.
    assert.equal(await readPublicationStatus('u1', { db: down.options.db }), 'PUBLISHED');
  } finally {
    console.error = quiet;
  }
});

test('olek enne salvestust: profiili olek suurtähtedes, profiili puudumisel null', async () => {
  assert.equal(await readPublicationStatus('u1', { db: setup(profileRow({ status: 'draft' })).options.db }), 'DRAFT');
  assert.equal(await readPublicationStatus('u1', { db: setup(null).options.db }), null);
  assert.equal(await readPublicationStatus('', { db: setup().options.db }), null);
});

test('asutuse kiri: kolmes keeles, lingita, asutuse nimi HTML-is varjestatud', () => {
  for (const locale of LOCALES) {
    for (const kind of Object.values(OrganizationNoticeKind)) {
      const mail = renderOrganizationNoticeEmail({ kind, organizationName: 'Ühing <b>"X"</b> & Co', registryCode: '80000001', locale });
      for (const part of [mail.subject, mail.text, mail.html]) {
        assert.ok(part.length > 20, `${locale} ${kind}`);
        assert.equal(/\{[a-zA-Z]+\}/u.test(part), false, `${locale} ${kind}: täitmata kohatäide`);
        assert.equal(/email\.service_profile_notice/u.test(part), false, `${locale} ${kind}: toores võti`);
        assert.equal(/https?:\/\//u.test(part), false, `${locale} ${kind}: kirjas ei ole linki`);
      }
      assert.ok(mail.text.includes('Ühing <b>"X"</b> & Co') && mail.text.includes('80000001'));
      assert.ok(mail.html.includes('Ühing &lt;b&gt;&quot;X&quot;&lt;/b&gt; &amp; Co'));
      assert.equal(mail.html.includes('<b>'), false);
      assert.ok(mail.text.includes('info@sotsiaal.pro') && mail.html.includes('info@sotsiaal.pro'));
    }
  }
  assert.throws(() => renderOrganizationNoticeEmail({ kind: 'muu', organizationName: 'X', registryCode: '1', locale: 'et' }), /SERVICE_PROFILE_NOTICE_KIND_UNKNOWN/);
});

test('asutuse kirja saatmine: arenduses ei saadeta; saatjata keeldub; muidu läheb ühe korra', async () => {
  const sent = [];
  const mailer = { sendMail: async (message) => { sent.push(message); } };
  const input = { to: 'info@naidis.example', kind: OrganizationNoticeKind.PUBLISHED, organizationName: 'Näidisühing MTÜ', registryCode: '80000001', locale: 'et' };

  const quiet = console.info;
  console.info = () => {};
  try {
    assert.deepEqual(await sendOrganizationNoticeEmail(input, { from: 'noreply@example.test', isDev: true }), { delivered: false, dev: true });
  } finally {
    console.info = quiet;
  }
  await assert.rejects(sendOrganizationNoticeEmail(input, { mailer, from: '', isDev: false }), /SERVICE_PROFILE_NOTICE_FROM_MISSING/);
  assert.deepEqual(sent, []);

  assert.deepEqual(await sendOrganizationNoticeEmail(input, { mailer, from: 'noreply@example.test', isDev: false }), { delivered: true, dev: false });
  assert.equal(sent.length, 1);
  assert.deepEqual([sent[0].to, sent[0].from], ['info@naidis.example', 'noreply@example.test']);
  assert.ok(sent[0].subject && sent[0].text && sent[0].html);
});

test('neli teavitust: silt kolmes keeles, sihtleht on olemas, adressaat on ainult profiili omanik', async () => {
  const types = {
    SERVICE_REPRESENTATION_LINK_SENT: '/teenuseprofiil/kinnitus',
    SERVICE_REPRESENTATION_CONFIRMED: '/teenuseprofiil',
    SERVICE_REPRESENTATION_REVOKED: '/teenuseprofiil/kinnitus',
    SERVICE_PROFILE_PUBLISHED: '/teenuseprofiil'
  };
  const catalogues = Object.fromEntries(LOCALES.map((locale) => [locale, JSON.parse(read(`../messages/${locale}.json`))]));
  for (const [type, href] of Object.entries(types)) {
    assert.equal(NOTIFICATION_EVENT_TYPES[type], type);
    const spec = notificationSpec(type);
    const shown = serializeNotificationEvent({ id: 'n1', type, targetKind: spec.targetKind, targetId: 'p1', createdAt: NOW });
    assert.deepEqual([shown.href, shown.labelKey, shown.badgeKey, shown.ackMode], [href, `notifications.events.${type.toLowerCase()}`, 'service_profile', 'read']);
    assert.ok(existsSync(new URL(`../app${href}/page.jsx`, import.meta.url)), href);
    for (const locale of LOCALES) {
      const label = catalogues[locale].notifications.events[type.toLowerCase()];
      assert.ok(typeof label === 'string' && label.length > 10, `${locale} ${type}`);
      assert.equal(/\{/u.test(label), false, `${locale} ${type}`);
    }

    const wheres = [];
    const db = { serviceProviderProfile: { findFirst: async ({ where }) => { wheres.push(where); return where.ownerId === 'u1' ? { id: 'p1' } : null; } } };
    await assertNotificationRecipient(db, { type, userId: 'u1', sourceId: 'p1', targetId: 'p1' });
    assert.deepEqual(wheres, [{ id: 'p1', ownerId: 'u1', ownershipMode: 'SOLO' }]);
    await assert.rejects(assertNotificationRecipient(db, { type, userId: 'u2', sourceId: 'p1', targetId: 'p1' }), /api\.common\.not_found/);
    // Allikas ja siht peavad olema sama profiil.
    await assert.rejects(assertNotificationRecipient(db, { type, userId: 'u1', sourceId: 'p2', targetId: 'p1' }), /api\.common\.not_found/);
  }
});

test('teavitus läheb teavituste süsteemi kaudu ka e-kirjana ja sama sündmus ei tekita teist teadet', async () => {
  const rows = [];
  const db = {
    serviceProviderProfile: { findFirst: async () => ({ id: 'p1' }) },
    notificationEvent: {
      create: async ({ data }) => {
        if (rows.some((row) => row.dedupeKey === data.dedupeKey)) throw Object.assign(new Error('unique'), { code: 'P2002' });
        rows.push({ id: `n${rows.length + 1}`, ...data });
        return rows.at(-1);
      },
      findUnique: async ({ where }) => rows.find((row) => row.dedupeKey === where.dedupeKey) || null
    }
  };
  const input = { type: 'SERVICE_REPRESENTATION_LINK_SENT', userId: 'u1', sourceId: 'p1', targetId: 'p1', dedupeSuffix: 'at:2026-10-11T09:25:38.728Z', emailPolicy: 'TRANSACTIONAL' };
  const first = await createNotificationEvent(input, { db, now: NOW });
  assert.equal(first.created, true);
  assert.deepEqual([first.event.emailPolicy, first.event.emailStatus, first.event.targetKind, first.event.sourceType], ['TRANSACTIONAL', 'PENDING', 'SERVICE_PROFILE', 'SERVICE_PROFILE']);
  assert.equal((await createNotificationEvent(input, { db, now: NOW })).created, false);
  assert.equal(rows.length, 1);
});

test('kolm teed kutsuvad teateid pärast õnnestunud tegevust', () => {
  const admin = read('../app/api/admin/service-representation/route.js');
  assert.match(admin, /revokeRepresentationAsAdmin\(\{ profileId, adminUserId: authz\.userId \}\);[\s\S]*?announceRepresentationConfirmed\(\{ profileId: row\.id, method: "ADMIN", confirmedAt: row\.confirmedAt, locale \}\);[\s\S]*?announceRepresentationRevoked\(\{ profileId: row\.id, locale \}\);\s+\}\s+return json\(\{ ok: true, row \}\);/u);

  const link = read('../app/api/service-provider/profile/representation/route.js');
  assert.match(link, /sendMail: sendRepresentationLinkEmail \}\s+\);[\s\S]*?await announceRepresentationLinkSent\(\{ ownerId: auth\.userId, sentAt: result\.sentAt \}\);\s+return json/u);
  assert.match(link, /confirmRepresentationByLink\(\{ ownerId: auth\.userId, token: body\?\.token \}\);\s+await announceRepresentationConfirmed\(\{ ownerId: auth\.userId, method: result\.method, confirmedAt: result\.confirmedAt, locale \}\);/u);

  const profile = read('../app/api/service-provider/profile/route.js');
  assert.match(profile, /const previousStatus = await readPublicationStatus\(auth\.userId\);\s+const profile = await upsertServiceProviderProfileForOwner\([\s\S]*?\}\);\s+await announceProfilePublished\(\{ previousStatus, profile, locale \}\);/u);
});
