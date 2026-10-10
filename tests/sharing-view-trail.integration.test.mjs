// „Kes on vaadanud" päris andmebaasis: saaja lugemine jätab jälje, jagaja näeb kokkuvõtet,
// jagaja enda lugemist ei logita ja jälg kustub koos jagatuga.
//
// Käivita isoleeritud proovibaasis:
//   JOURNEY_TEST_DATABASE_URL=postgres://…/…_probe node --import ./scripts/register-node-source-loader.mjs --test tests/sharing-view-trail.integration.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { collectOwnerSharingHistory, loadMySharings } from '../lib/mySharings.js';
import { computeShareContentHash, markShareOpened } from '../lib/network/share.js';
import { resolveOrgAccessContext } from '../lib/org/accessContext.js';
import { getInboxItem } from '../lib/org/inbox.js';
import { acceptPreInquiry, recordPreInquiryView, updatePreInquiryReceiverWorkflow } from '../lib/preInquiries.js';
import { deleteUserAfterFinalPracticeSweep } from '../lib/privacy/effectivePracticeAccountCleanup.js';
import { eraseServiceLogUserReferencesWithinTransaction } from '../lib/serviceLog/privacyLifecycle.js';
import { confirmShareDelivery, createReportDeliveryToken } from '../lib/serviceLog/reportShare.js';

const url = new URL(process.env.JOURNEY_TEST_DATABASE_URL || process.env.HOME_CARE_TEST_DATABASE_URL || 'postgres://invalid/invalid');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.endsWith('_probe')) {
  throw Error('isolated JOURNEY_TEST_DATABASE_URL (localhost, …_probe) required');
}
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }), log: [] });
test.after(() => db.$disconnect());

const at = (iso) => new Date(iso);
/* Reede 09.10.2026 kell 11.00 Eesti aja järgi ja kaks järgmist päeva. */
const DAY1 = at('2026-10-09T08:00:00Z');
const DAY1_LATER = at('2026-10-09T15:00:00Z');
const DAY2 = at('2026-10-10T08:00:00Z');
const DAY3 = at('2026-10-11T08:00:00Z');

function people(tag) {
  const ids = [];
  const user = async (name, role) => {
    const row = await db.user.create({ data: { email: `sv-${tag}-${name}@example.invalid`, role, profile: { create: { firstName: name, lastName: 'Proov' } } } });
    ids.push(row.id);
    return row;
  };
  return { ids, user };
}

test('võrgustikujagamine: saaja iga lugemispäev jätab ühe rea, klient ja töötaja näevad kokkuvõtet', async (t) => {
  const tag = randomUUID().slice(0, 8);
  const { ids, user } = people(tag);
  const client = await user('klient', 'CLIENT');
  const worker = await user('tootaja', 'SOCIAL_WORKER');
  const recipient = await user('saaja', 'SERVICE_PROVIDER');
  const source = await db.preInquiry.create({
    data: { authorId: client.id, recipientOwnerId: worker.id, recipientType: 'KOV_CONTACT', situation: 'Proov.', status: 'SENT', sentAt: at('2026-10-01T08:00:00Z') }
  });
  const fields = { summaryText: 'Klient vajab koduteenust.', purpose: 'Koduteenuse korraldamine.', sharingBoundary: 'Ainult kokkuvõte.', participationEndsOn: at('2027-01-01T00:00:00Z') };
  const hash = computeShareContentHash(fields);
  const make = (extra = {}) =>
    db.networkShare.create({
      data: {
        sourcePreInquiryId: source.id,
        workerId: worker.id,
        clientUserId: client.id,
        recipientUserId: recipient.id,
        ...fields,
        contentHash: hash,
        confirmedContentHash: hash,
        clientConfirmedAt: at('2026-10-02T08:00:00Z'),
        clientConfirmationMethod: 'IN_APP',
        status: 'SENT',
        sentAt: at('2026-10-03T08:00:00Z'),
        ...extra
      }
    });
  const share = await make();
  const unread = await make();
  /* Töötaja adresseeris jagamise iseendale: ta on jagaja, tema lugemist ei logita. */
  const own = await make({ recipientUserId: worker.id });
  /* Avatud juba 5. oktoobril, enne kui jälge üldse peeti. */
  const earlier = await make({ status: 'OPENED', openedAt: at('2026-10-05T08:00:00Z') });
  t.after(async () => {
    await db.networkShare.deleteMany({ where: { sourcePreInquiryId: source.id } });
    await db.preInquiry.deleteMany({ where: { id: source.id } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  });
  const open = (shareId, userId, now) => markShareOpened({ prisma: db, shareId, recipientUserId: userId, now: () => now });
  const trail = (shareId) => db.sharingView.findMany({ where: { networkShareId: shareId }, orderBy: { day: 'asc' } });
  const listed = async (userId, section, shareId = share.id) => (await loadMySharings(userId, { db, sections: [section] }))[section].items.find((item) => item.id === shareId);

  assert.equal((await listed(client.id, 'networkShares')).views, undefined);

  /* Esimene avamine paneb avamise aja ja esimese jäljerea; sama päeva teine lugemine rida ei lisa. */
  assert.equal((await open(share.id, recipient.id, DAY1)).status, 'OPENED');
  await open(share.id, recipient.id, DAY1_LATER);
  assert.deepEqual((await trail(share.id)).map((row) => [row.kind, row.viewerUserId, row.day, row.preInquiryId]), [['NETWORK_SHARE', recipient.id, '2026-10-09', null]]);
  await open(share.id, recipient.id, DAY2);
  await open(share.id, recipient.id, DAY3);
  assert.deepEqual((await trail(share.id)).map((row) => row.day), ['2026-10-09', '2026-10-10', '2026-10-11']);
  const stored = await db.networkShare.findUnique({ where: { id: share.id } });
  assert.deepEqual([stored.status, stored.openedAt.toISOString(), stored.updatedAt.toISOString()], ['OPENED', DAY1.toISOString(), DAY1.toISOString()]);

  /* Klient ja töötaja näevad kokkuvõtet; lugemata jagamisel ja saaja enda lehel seda ei ole. */
  assert.deepEqual((await listed(client.id, 'networkShares')).views, { days: 3, lastDay: '2026-10-11' });
  assert.deepEqual((await listed(worker.id, 'outgoingNetworkShares')).views, { days: 3, lastDay: '2026-10-11' });
  assert.equal((await listed(client.id, 'networkShares', unread.id)).views, undefined);
  /* Enne jälge avatud jagamine: ilma uue lugemiseta lauset ei ole; pärast lugemist loeb avamise päev kaasa. */
  assert.equal((await listed(client.id, 'networkShares', earlier.id)).views, undefined);
  await open(earlier.id, recipient.id, DAY2);
  assert.deepEqual((await trail(earlier.id)).map((row) => row.day), ['2026-10-10']);
  assert.deepEqual((await listed(client.id, 'networkShares', earlier.id)).views, { days: 2, lastDay: '2026-10-10' });
  assert.equal((await loadMySharings(recipient.id, { db, sections: ['networkShares', 'outgoingNetworkShares'] })).networkShares.items.length, 0);

  /* Jagaja enda lugemine ei jäta jälge, kuigi avamine ise toimub. */
  assert.equal((await open(own.id, worker.id, DAY1)).status, 'OPENED');
  assert.deepEqual(await trail(own.id), []);
  /* Võõras ei saa avada ega jäta jälge. */
  await assert.rejects(open(unread.id, client.id, DAY1), (error) => error.code === 'network_share.forbidden');
  assert.deepEqual(await trail(unread.id), []);

  /* Isikuandmete väljavõte: jagaja ajalookirjel on vaatamiste kokkuvõte ainult seal, kus vaatamisi on. */
  const history = (await collectOwnerSharingHistory(client.id, { db })).filter((row) => row.type === 'NETWORK_SHARE_CLIENT');
  const byShare = (rows) => Object.fromEntries(rows.map((row) => [row.origin.id, [row.viewedDays ?? null, row.lastViewedOn ?? null]]));
  const expected = { [share.id]: [3, '2026-10-11'], [earlier.id]: [2, '2026-10-10'], [unread.id]: [null, null], [own.id]: [null, null] };
  assert.deepEqual(byShare(history), expected);
  /* Töötaja väljavõttes on sama kokkuvõte. */
  assert.deepEqual(byShare((await collectOwnerSharingHistory(worker.id, { db })).filter((row) => row.type === 'NETWORK_SHARE_WORKER')), expected);

  /* Jälje päring ei tohi lehte ega väljavõtet rivist välja viia (näiteks tabel puudub enne migratsiooni). */
  const broken = new Proxy(db, {
    get: (target, key) =>
      key === 'sharingView'
        ? { groupBy: async () => { throw Object.assign(new Error('The table `public.SharingView` does not exist'), { code: 'P2021' }); } }
        : target[key]
  });
  const silenced = console.error;
  console.error = () => {};
  try {
    const page = await loadMySharings(client.id, { db: broken, sections: ['networkShares'] });
    assert.equal(page.networkShares.status, 'READY');
    assert.deepEqual(page.networkShares.items.map((item) => [item.id === share.id || item.id === earlier.id || item.id === unread.id || item.id === own.id, item.views]), [[true, undefined], [true, undefined], [true, undefined], [true, undefined]]);
    assert.deepEqual(byShare((await collectOwnerSharingHistory(client.id, { db: broken })).filter((row) => row.type === 'NETWORK_SHARE_CLIENT')), Object.fromEntries(Object.keys(expected).map((id) => [id, [null, null]])));
  } finally {
    console.error = silenced;
  }

  /* Andmebaas hoiab piire ka koodist mööda kirjutades. */
  const raw = { viewerUserId: recipient.id, day: '2026-10-20' };
  await assert.rejects(db.sharingView.create({ data: { ...raw, kind: 'NETWORK_SHARE', networkShareId: share.id, day: '2026-10-09' } }));
  await assert.rejects(db.sharingView.create({ data: { ...raw, kind: 'PRE_INQUIRY', networkShareId: share.id } }));
  await assert.rejects(db.sharingView.create({ data: { ...raw, kind: 'NETWORK_SHARE', networkShareId: share.id, preInquiryId: source.id } }));
  await assert.rejects(db.sharingView.create({ data: { ...raw, kind: 'NETWORK_SHARE', networkShareId: share.id, day: '20.10.2026' } }));
  await assert.rejects(db.sharingView.create({ data: { ...raw, kind: 'ROOM', networkShareId: share.id } }));

  /* Jälg kustub koos jagamisega. */
  await db.networkShare.delete({ where: { id: share.id } });
  assert.equal(await db.sharingView.count({ where: { networkShareId: share.id } }), 0);
  /* Teise jagamise jälg jääb alles, kuni see jagamine või vaataja konto kustub. */
  assert.equal(await db.sharingView.count({ where: { viewerUserId: recipient.id } }), 1);
  await db.user.delete({ where: { id: recipient.id } });
  assert.equal(await db.sharingView.count({ where: { viewerUserId: recipient.id } }), 0);
});

test('asutuse postkasti saadetud eelpöördumine: iga lugeja ja päev jätab rea, autor näeb ainult päevi', async (t) => {
  const tag = randomUUID().slice(0, 8);
  const { ids, user } = people(tag);
  const author = await user('autor', 'CLIENT');
  const first = await user('koordinaator', 'SOCIAL_WORKER');
  const second = await user('kolleeg', 'SOCIAL_WORKER');
  const organization = await db.organization.create({
    data: { displayName: `Vallavalitsus ${tag}`, legalKind: 'COMPANY', status: 'ACTIVE', activatedAt: at('2026-01-01T00:00:00Z'), verifiedAt: at('2026-01-01T00:00:00Z') }
  });
  await db.organizationModule.create({ data: { organizationId: organization.id, moduleKey: 'KOV_INTAKE', status: 'ACTIVE', validFrom: at('2026-01-01T00:00:00Z') } });
  for (const account of [first, second, author]) {
    const membership = await db.organizationMembership.create({
      data: { organizationId: organization.id, userId: account.id, seatRole: 'SOCIAL_WORKER', status: 'ACTIVE', startedAt: at('2026-01-01T00:00:00Z') }
    });
    await db.organizationCapabilityGrant.create({
      data: { membershipId: membership.id, capability: 'INBOX_COORDINATOR', scopeType: 'ORGANIZATION', validFrom: at('2026-01-01T00:00:00Z') }
    });
  }
  const send = async (situation) => {
    const inquiry = await db.preInquiry.create({
      data: {
        authorId: author.id,
        recipientOrganizationId: organization.id,
        recipientType: 'ORGANIZATION_INBOX',
        deliveryChannel: 'INTERNAL',
        topic: 'Koduteenus',
        situation,
        status: 'SENT',
        sentAt: at('2026-10-08T08:00:00Z')
      }
    });
    const item = await db.organizationInboxItem.create({ data: { organizationId: organization.id, sourceType: 'PRE_INQUIRY', sourceId: inquiry.id } });
    return { inquiry, item };
  };
  const sent = await send('Ema ei saa enam ise poes käia.');
  const recalled = await send('Tagasi võetud pöördumine.');
  await db.preInquiry.update({ where: { id: recalled.inquiry.id }, data: { recalledAt: at('2026-10-08T09:00:00Z') } });
  await db.organizationInboxItem.update({ where: { id: recalled.item.id }, data: { status: 'RECALLED' } });
  t.after(async () => {
    await db.organizationInboxItem.deleteMany({ where: { organizationId: organization.id } });
    await db.preInquiry.deleteMany({ where: { id: { in: [sent.inquiry.id, recalled.inquiry.id] } } });
    await db.organization.deleteMany({ where: { id: organization.id } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  });
  const ctx = (account, now) => resolveOrgAccessContext({ userId: account.id, requestedOrganizationId: organization.id }, { db, env: { ORG_WORKSPACE_ENABLED: '1' }, now });
  const read = async (account, entry, now) => getInboxItem(await ctx(account, now), entry.item.id, { db, now });
  const trail = (inquiryId) => db.sharingView.findMany({ where: { preInquiryId: inquiryId }, orderBy: [{ day: 'asc' }, { createdAt: 'asc' }] });
  const listed = async (inquiryId) => (await loadMySharings(author.id, { db, sections: ['preInquiries'] })).preInquiries.items.find((item) => item.id === inquiryId);

  /* Esimene lugeja avab: avamise märge ja esimene jäljerida. */
  const opened = await read(first, sent, DAY1);
  assert.equal(opened.source.situation, 'Ema ei saa enam ise poes käia.');
  const afterOpen = await db.preInquiry.findUnique({ where: { id: sent.inquiry.id } });
  assert.ok(afterOpen.openedAt);
  /* Sama päeva teine lugemine ja kolleegi lugemine; järgmisel päeval loeb esimene uuesti. */
  await read(first, sent, DAY1_LATER);
  await read(second, sent, DAY1_LATER);
  await read(first, sent, DAY2);
  assert.deepEqual((await trail(sent.inquiry.id)).map((row) => [row.kind, row.viewerUserId, row.day, row.networkShareId]), [
    ['PRE_INQUIRY', first.id, '2026-10-09', null],
    ['PRE_INQUIRY', second.id, '2026-10-09', null],
    ['PRE_INQUIRY', first.id, '2026-10-10', null]
  ]);
  /* Autor on sama asutuse koordinaator: tema enda lugemist ei logita. */
  assert.equal((await read(author, sent, DAY3)).source.situation, 'Ema ei saa enam ise poes käia.');
  assert.equal((await trail(sent.inquiry.id)).length, 3);
  /* Tagasi võetud pöördumise sisu ei näidata ja jälge ei teki. */
  assert.equal((await read(first, recalled, DAY1)).source, null);
  assert.deepEqual(await trail(recalled.inquiry.id), []);

  /* Jälg ei puuduta eelpöördumise rida: `updatedAt` on tagasivõtmise ja paranduse lukk. */
  assert.equal((await db.preInquiry.findUnique({ where: { id: sent.inquiry.id } })).updatedAt.toISOString(), afterOpen.updatedAt.toISOString());

  /* Autor näeb päevi (kaks vaatajat samal päeval on üks päev), mitte vaatajaid. */
  const mine = await listed(sent.inquiry.id);
  assert.deepEqual(mine.views, { days: 2, lastDay: '2026-10-10' });
  assert.equal(JSON.stringify(mine).includes(first.id) || JSON.stringify(mine).includes(second.id), false);
  assert.equal((await listed(recalled.inquiry.id)).views, undefined);
  const history = (await collectOwnerSharingHistory(author.id, { db })).find((row) => row.type === 'PRE_INQUIRY' && row.origin.id === sent.inquiry.id);
  assert.deepEqual([history.viewedDays, history.lastViewedOn], [2, '2026-10-10']);

  /* Autori konto kustutamine: pöördumine jääb saajale sisuta alles, jälg kustub. */
  await deleteUserAfterFinalPracticeSweep(author.id, db);
  const kept = await db.preInquiry.findUnique({ where: { id: sent.inquiry.id } });
  assert.deepEqual([kept.authorId, kept.situation], [null, '']);
  assert.deepEqual(await trail(sent.inquiry.id), []);
  /* Autorita rea lugemine uut jälge ei tee: seda ei oleks kellelgi näha. */
  await read(first, sent, DAY3);
  assert.deepEqual(await trail(sent.inquiry.id), []);
});

test('isikule saadetud eelpöördumine: vastuvõtmine ja iga hilisem avamispäev jätab rea, autor näeb päevi', async (t) => {
  const tag = randomUUID().slice(0, 8);
  const { ids, user } = people(tag);
  const author = await user('autor', 'CLIENT');
  const recipient = await user('saaja', 'SOCIAL_WORKER');
  const stranger = await user('vooras', 'SOCIAL_WORKER');
  const inquiryIds = [];
  const send = async (extra = {}) => {
    const row = await db.preInquiry.create({
      data: {
        authorId: author.id,
        recipientOwnerId: recipient.id,
        recipientType: 'KOV_CONTACT',
        deliveryChannel: 'INTERNAL',
        topic: 'Koduteenus',
        situation: 'Ema ei saa enam ise poes käia.',
        status: 'SENT',
        sentAt: at('2026-10-08T08:00:00Z'),
        ...extra
      }
    });
    inquiryIds.push(row.id);
    return row;
  };
  const sent = await send();
  const worked = await send();
  const recalled = await send({ recalledAt: at('2026-10-08T09:00:00Z') });
  /* Saaja kirjutas pöördumise iseendale: ta on ise pöörduja, tema lugemist ei logita. */
  const own = await send({ authorId: recipient.id });
  t.after(async () => {
    await db.preInquiry.deleteMany({ where: { id: { in: inquiryIds } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  });
  const trail = (inquiryId) => db.sharingView.findMany({ where: { preInquiryId: inquiryId }, orderBy: { day: 'asc' } });
  const listed = async (inquiryId) => (await loadMySharings(author.id, { db, sections: ['preInquiries'] })).preInquiries.items.find((item) => item.id === inquiryId);
  const notFound = (error) => error.status === 404 && error.message === 'api.common.not_found';

  /* Enne vastuvõtmist ei jäta avamise teade jälge: pöörduja saab pöördumise veel tagasi võtta. */
  assert.equal(await recordPreInquiryView(recipient.id, sent.id, { db, now: DAY1 }), false);
  assert.deepEqual(await trail(sent.id), []);
  assert.equal((await listed(sent.id)).views, undefined);

  /* Vastuvõtmine paneb avamise aja ja esimese jäljerea. */
  const accepted = await acceptPreInquiry(recipient.id, sent.id, { db, now: DAY1 });
  assert.deepEqual([accepted.status, new Date(accepted.openedAt).toISOString()], ['READY', DAY1.toISOString()]);
  assert.deepEqual((await trail(sent.id)).map((row) => [row.kind, row.viewerUserId, row.day, row.networkShareId]), [['PRE_INQUIRY', recipient.id, '2026-10-09', null]]);
  const afterAccept = await db.preInquiry.findUnique({ where: { id: sent.id } });

  /* Sama päeva uus avamine rida ei lisa; järgmistel päevadel tekib päeva kohta üks rida. */
  assert.equal(await recordPreInquiryView(recipient.id, sent.id, { db, now: DAY1_LATER }), false);
  assert.equal(await recordPreInquiryView(recipient.id, sent.id, { db, now: DAY2 }), true);
  assert.equal(await recordPreInquiryView(recipient.id, sent.id, { db, now: DAY2 }), false);
  assert.equal(await recordPreInquiryView(recipient.id, sent.id, { db, now: DAY3 }), true);
  assert.deepEqual((await trail(sent.id)).map((row) => row.day), ['2026-10-09', '2026-10-10', '2026-10-11']);
  /* Korduv vastuvõtmine (topeltvajutus) ei lisa rida ega muuda pöördumist. */
  await acceptPreInquiry(recipient.id, sent.id, { db, now: DAY3 });
  assert.equal((await trail(sent.id)).length, 3);

  /* Jälg ei puuduta eelpöördumise rida: `updatedAt` on tagasivõtmise ja paranduse lukk. */
  const afterViews = await db.preInquiry.findUnique({ where: { id: sent.id } });
  assert.deepEqual([afterViews.updatedAt.toISOString(), afterViews.openedAt.toISOString(), afterViews.status], [afterAccept.updatedAt.toISOString(), DAY1.toISOString(), 'READY']);

  /* Pöörduja ise, võõras ja tagasi võetud pöördumine: 404, jälge ei teki. */
  await assert.rejects(recordPreInquiryView(author.id, sent.id, { db, now: DAY3 }), notFound);
  await assert.rejects(recordPreInquiryView(stranger.id, sent.id, { db, now: DAY3 }), notFound);
  await assert.rejects(recordPreInquiryView(recipient.id, recalled.id, { db, now: DAY1 }), notFound);
  assert.equal((await trail(sent.id)).length, 3);
  assert.deepEqual(await trail(recalled.id), []);

  /* Iseendale saadetud pöördumine: vastuvõtmine toimub, jälge ei teki. */
  assert.equal((await acceptPreInquiry(recipient.id, own.id, { db, now: DAY1 })).status, 'READY');
  assert.equal(await recordPreInquiryView(recipient.id, own.id, { db, now: DAY2 }), false);
  assert.deepEqual(await trail(own.id), []);

  /* Töömärkme salvestamine on samuti lugemine: see avab pöördumise ja jätab tänase rea. */
  const saved = await updatePreInquiryReceiverWorkflow(recipient.id, worked.id, { receiverNote: 'Helistan homme.', expectedUpdatedAt: worked.updatedAt }, { db });
  assert.ok(saved.openedAt);
  assert.deepEqual((await trail(worked.id)).map((row) => [row.kind, row.viewerUserId]), [['PRE_INQUIRY', recipient.id]]);

  /* Pöörduja näeb oma lehel päevi ja viimast päeva; väljavõttes on sama kokkuvõte. */
  assert.deepEqual((await listed(sent.id)).views, { days: 3, lastDay: '2026-10-11' });
  assert.equal((await listed(recalled.id)).views, undefined);
  const history = (await collectOwnerSharingHistory(author.id, { db })).find((row) => row.type === 'PRE_INQUIRY' && row.origin.id === sent.id);
  assert.deepEqual([history.viewedDays, history.lastViewedOn], [3, '2026-10-11']);

  /* Jälg kustub koos pöördumisega. */
  await db.preInquiry.delete({ where: { id: sent.id } });
  assert.equal(await db.sharingView.count({ where: { preInquiryId: sent.id } }), 0);
});

test('teenusaruande jagamine: saaja iga kinnitatud lugemispäev jätab rea, jagaja näeb päevi', async (t) => {
  const tag = randomUUID().slice(0, 8);
  const { ids, user } = people(tag);
  const owner = await user('tootaja', 'SOCIAL_WORKER');
  const lead = await user('juht', 'SOCIAL_WORKER');
  const organization = await db.organization.create({
    data: { displayName: `Hooldekeskus ${tag}`, legalKind: 'COMPANY', status: 'ACTIVE', activatedAt: at('2026-01-01T00:00:00Z'), verifiedAt: at('2026-01-01T00:00:00Z') }
  });
  const member = (account) =>
    db.organizationMembership.create({ data: { organizationId: organization.id, userId: account.id, seatRole: 'SOCIAL_WORKER', status: 'ACTIVE', startedAt: at('2026-01-01T00:00:00Z') } });
  const ownerMembership = await member(owner);
  const leadMembership = await member(lead);
  const shareIds = [];
  const share = async (extra = {}) => {
    const row = await db.serviceReportShare.create({
      data: {
        documentId: `doc-${tag}-${shareIds.length}`,
        ownerUserId: owner.id,
        organizationId: organization.id,
        recipientMembershipId: leadMembership.id,
        month: '2026-09',
        storagePath: `proov/${tag}-${shareIds.length}.csv`,
        fileName: 'aruanne.csv',
        mime: 'text/csv',
        sizeBytes: 10,
        sha256: 'a'.repeat(64),
        status: 'SENT',
        sentAt: at('2026-10-08T08:00:00Z'),
        retentionEndsAt: at('2027-10-08T08:00:00Z'),
        ...extra
      }
    });
    shareIds.push(row.id);
    return row;
  };
  const sent = await share();
  const unread = await share();
  const recalled = await share({ status: 'RECALLED', recalledAt: at('2026-10-08T09:00:00Z') });
  const erased = await share();
  t.after(async () => {
    await db.dataAuditLog.deleteMany({ where: { resourceId: { in: shareIds } } });
    await db.serviceReportShare.deleteMany({ where: { id: { in: shareIds } } });
    await db.organization.deleteMany({ where: { id: organization.id } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  });
  /* Proovivõti: kinnituse tõend allkirjastatakse ainult selle testi sees. */
  const env = { REPORT_DELIVERY_SECRET: `vaatamiste-jalje-proov-${tag}` };
  const confirm = (row, actor, membership, now) =>
    confirmShareDelivery(
      createReportDeliveryToken({ id: row.id, recipientMembershipId: membership.id, sha256: row.sha256 }, { actorUserId: actor.id, now, env }),
      { membershipIds: [membership.id], actorUserId: actor.id, shareId: row.id },
      { db, now, env }
    );
  const trail = (shareId) => db.sharingView.findMany({ where: { serviceReportShareId: shareId }, orderBy: { day: 'asc' } });
  const listed = async (shareId) => (await loadMySharings(owner.id, { db, sections: ['serviceReportShares'] })).serviceReportShares.items.find((item) => item.id === shareId);
  const notFound = (error) => error.status === 404;

  assert.equal((await listed(sent.id)).views, undefined);

  /* Esimene kinnitus avab jagamise ja jätab esimese rea; vastuses jagaja ID ei ole. */
  const first = await confirm(sent, lead, leadMembership, DAY1);
  assert.deepEqual(first, { id: sent.id, alreadyOpened: false });
  assert.deepEqual((await trail(sent.id)).map((row) => [row.kind, row.viewerUserId, row.day, row.preInquiryId, row.networkShareId]), [['SERVICE_REPORT_SHARE', lead.id, '2026-10-09', null, null]]);
  const afterOpen = await db.serviceReportShare.findUnique({ where: { id: sent.id } });
  assert.deepEqual([afterOpen.status, afterOpen.openedAt.toISOString()], ['OPENED', DAY1.toISOString()]);

  /* Korduv lugemine samal päeval rida ei lisa; järgmistel päevadel tekib päeva kohta üks rida. */
  assert.deepEqual(await confirm(sent, lead, leadMembership, DAY1_LATER), { id: sent.id, alreadyOpened: true });
  await confirm(sent, lead, leadMembership, DAY2);
  await confirm(sent, lead, leadMembership, DAY2);
  await confirm(sent, lead, leadMembership, DAY3);
  assert.deepEqual((await trail(sent.id)).map((row) => row.day), ['2026-10-09', '2026-10-10', '2026-10-11']);
  /* Jälg ei puuduta jagamise rida: `updatedAt` on avamise ja tagasivõtmise lukk. */
  assert.equal((await db.serviceReportShare.findUnique({ where: { id: sent.id } })).updatedAt.toISOString(), afterOpen.updatedAt.toISOString());

  /* Jagaja ise ei ole saaja: tema tõend ei ava ega jäta jälge. Tagasi võetud jagamist ei saa kinnitada. */
  await assert.rejects(confirm(unread, owner, ownerMembership, DAY1), notFound);
  await assert.rejects(confirm(recalled, lead, leadMembership, DAY1), notFound);
  assert.deepEqual([(await trail(unread.id)).length, (await trail(recalled.id)).length], [0, 0]);
  assert.equal((await db.serviceReportShare.findUnique({ where: { id: unread.id } })).status, 'SENT');

  /* Jagaja näeb oma lehel päevi ja viimast päeva; väljavõttes on sama kokkuvõte. */
  assert.deepEqual((await listed(sent.id)).views, { days: 3, lastDay: '2026-10-11' });
  assert.equal((await listed(unread.id)).views, undefined);
  const history = (await collectOwnerSharingHistory(owner.id, { db })).filter((row) => row.type === 'SERVICE_REPORT_SHARE');
  assert.deepEqual(
    Object.fromEntries(history.map((row) => [row.origin.id, [row.viewedDays ?? null, row.lastViewedOn ?? null]])),
    { [sent.id]: [3, '2026-10-11'], [unread.id]: [null, null], [recalled.id]: [null, null], [erased.id]: [null, null] }
  );

  /* Andmebaas hoiab piire ka koodist mööda kirjutades: liik ja veerg käivad koos. */
  const raw = { viewerUserId: lead.id, day: '2026-10-20' };
  await assert.rejects(db.sharingView.create({ data: { ...raw, kind: 'NETWORK_SHARE', serviceReportShareId: sent.id } }));
  await assert.rejects(db.sharingView.create({ data: { ...raw, kind: 'SERVICE_REPORT_SHARE' } }));
  await assert.rejects(db.sharingView.create({ data: { ...raw, kind: 'SERVICE_REPORT_SHARE', serviceReportShareId: sent.id, day: '2026-10-09' } }));

  /* Jagaja konto kustutamine: jagamine jääb omanikuta alles, selle jälg kustub. */
  await confirm(erased, lead, leadMembership, DAY1);
  assert.equal((await trail(erased.id)).length, 1);
  await eraseServiceLogUserReferencesWithinTransaction(owner.id, { db, now: DAY3 });
  assert.equal((await db.serviceReportShare.findUnique({ where: { id: erased.id } })).ownerUserId, null);
  assert.deepEqual([(await trail(erased.id)).length, (await trail(sent.id)).length], [0, 0]);
  /* Omanikuta jagamise lugemine uut jälge ei tee: seda ei oleks kellelgi näha. */
  assert.deepEqual(await confirm(erased, lead, leadMembership, DAY3), { id: erased.id, alreadyOpened: true });
  assert.deepEqual(await trail(erased.id), []);

  /* Jälg kustub koos jagamisega (nii kustutab ka säilitustähtaja puhastus). */
  const kept = await share({ ownerUserId: lead.id, recipientMembershipId: ownerMembership.id });
  await confirm(kept, owner, ownerMembership, DAY1);
  assert.equal((await trail(kept.id)).length, 1);
  await db.serviceReportShare.delete({ where: { id: kept.id } });
  assert.equal(await db.sharingView.count({ where: { serviceReportShareId: kept.id } }), 0);
});
