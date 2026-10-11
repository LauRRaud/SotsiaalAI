// Asutuse vastuvõtulaua pöördumise vestlusruum päris andmebaasis: töö vastu võtnud töötaja
// avab ruumi ja vastab, pöörduja Teekond näitab vastust, üleandmisel liigub vestlus uuele
// vastutajale ja sulgemisel lõpeb töötaja ligipääs ning ruum jääb kõigile ainult loetavaks.
//
// Käivita isoleeritud proovibaasis:
//   JOURNEY_TEST_DATABASE_URL=postgres://…/…_probe node --import ./scripts/register-node-source-loader.mjs --test tests/org-inbox-room.integration.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { getJourneyDetailForUser } from '../lib/journey/service.js';
import { listNotificationEvents } from '../lib/notifications.js';
import { resolveOrgAccessContext } from '../lib/org/accessContext.js';
import { assignWork, getInboxItem, handOverWork, respondToAssignment, transitionInboxItem } from '../lib/org/inbox.js';
import { createPreInquiry, recallPreInquiry } from '../lib/preInquiries.js';
import { resolveRoomAccess, ROOM_READ, ROOM_WRITE } from '../lib/rooms/accessGuard.js';
import { ensureRoomForPreInquiry, findOrganizationInquiryForWorker, readRoomReadOnlyReason } from '../lib/rooms/preInquiryRoom.js';

const url = new URL(process.env.JOURNEY_TEST_DATABASE_URL || 'postgres://invalid/invalid');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.endsWith('_probe')) {
  throw Error('isolated JOURNEY_TEST_DATABASE_URL (localhost, …_probe) required');
}
process.env.ORG_WORKSPACE_ENABLED = '1';
process.env.ORG_INBOX_ENABLED = '1';
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }), log: [] });
test.after(() => db.$disconnect());

const START = new Date('2026-01-01T00:00:00Z');
const noCalls = async () => null;

async function seed(t) {
  /* Ainult tähed: asutuse nimi läheb pöördumise mustandisse ja numbritest koosnevat märgist
     pidas isikuandmete kontroll telefoninumbriks (umbes iga kümnes jooks kukkus sellega). */
  const tag = Array.from(randomBytes(8), (byte) => String.fromCharCode(97 + (byte % 26))).join('');
  const ids = [];
  const user = async (name, role) => {
    const row = await db.user.create({ data: { email: `ir-${tag}-${name}@example.invalid`, role, profile: { create: { firstName: name, lastName: 'Proov' } } } });
    ids.push(row.id);
    return row;
  };
  const applicant = await user('pooorduja', 'CLIENT');
  const coordinator = await user('koordinaator', 'SOCIAL_WORKER');
  const mari = await user('mari', 'SOCIAL_WORKER');
  const jyri = await user('jyri', 'SOCIAL_WORKER');
  const member = await user('liige', 'SOCIAL_WORKER');
  const organization = await db.organization.create({
    data: { displayName: `Proovi vald ${tag}`, legalKind: 'COMPANY', status: 'ACTIVE', activatedAt: START, verifiedAt: START }
  });
  await db.organizationModule.create({ data: { organizationId: organization.id, moduleKey: 'KOV_INTAKE', status: 'ACTIVE', validFrom: START } });
  const memberships = {};
  for (const account of [coordinator, mari, jyri, member]) {
    memberships[account.id] = await db.organizationMembership.create({
      data: { organizationId: organization.id, userId: account.id, seatRole: 'SOCIAL_WORKER', status: 'ACTIVE', startedAt: START }
    });
  }
  for (const capability of ['INBOX_COORDINATOR', 'WORK_ASSIGNER']) {
    await db.organizationCapabilityGrant.create({
      data: { membershipId: memberships[coordinator.id].id, capability, scopeType: 'ORGANIZATION', validFrom: START }
    });
  }
  const journey = await db.journey.create({ data: { ownerUserId: applicant.id, title: 'Ema koduteenus', summary: 'Ema ei saa enam ise poes käia.' } });
  t.after(async () => {
    await db.room.deleteMany({ where: { ownerId: { in: ids } } });
    await db.organizationInboxItem.deleteMany({ where: { organizationId: organization.id } });
    await db.preInquiry.deleteMany({ where: { authorId: applicant.id } });
    await db.organization.deleteMany({ where: { id: organization.id } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  });

  /* Pöörduja saadab pöördumise päris teenuse kaudu: sama rada, mis lehelt. */
  const send = async () => {
    const inquiry = await createPreInquiry(applicant.id, {
      recipientOrganizationId: organization.id,
      recipientType: 'ORGANIZATION_INBOX',
      topic: 'Koduteenus',
      situation: 'Ema ei saa enam ise poes käia.',
      userEditedDraft: 'Palun abi koduteenuse taotlemisel.',
      sourceJourneyId: journey.id,
      status: 'SENT'
    }, { db });
    const item = await db.organizationInboxItem.findFirst({ where: { organizationId: organization.id, sourceId: inquiry.id } });
    return { inquiry, item };
  };
  const ctx = (account) => resolveOrgAccessContext({ userId: account.id, requestedOrganizationId: organization.id }, { db, env: process.env });
  return { applicant, coordinator, mari, jyri, member, organization, memberships, journey, send, ctx };
}

const open = (account, inquiryId) => ensureRoomForPreInquiry({ userId: account.id, inquiry: { id: inquiryId } }, { db });
const refused = (promise, status) => assert.rejects(promise, (error) => error.status === status);
const activeMembers = async (roomId) =>
  (await db.roomMember.findMany({ where: { roomId, leftAt: null }, select: { userId: true, role: true } })).map((row) => `${row.userId}:${row.role}`).sort();
const linkedState = async (world, inquiryId) =>
  (await getJourneyDetailForUser(world.applicant.id, world.journey.id, { db })).linkedPreInquiries.find((row) => row.id === inquiryId);
const canRead = async (account, roomId) => (await resolveRoomAccess({ userId: account.id, userRole: account.role, roomId, intent: ROOM_READ, db })).ok;
/* Kirjutamise värav, sama mille taga on ruumi sõnumid. Tellimus ei ole selle testi teema. */
const write = (account, roomId) =>
  resolveRoomAccess({ userId: account.id, userRole: account.role, roomId, intent: ROOM_WRITE, db, hasActiveSubscription: async () => true });
const READ_ONLY = { ok: false, status: 409, message: 'api.rooms.archived_readonly' };
const roomRow = (roomId) => db.room.findUnique({ where: { id: roomId }, select: { archivedAt: true, originType: true, originId: true } });
const archiveAudits = (roomId) => db.dataAuditLog.findMany({ where: { action: 'ROOM_ARCHIVED', resourceId: roomId }, select: { actorUserId: true, meta: true } });
/* Väline kõneteenus: test kirjutab üles, mis ruumi kõne lõpetati. */
const callHooks = () => {
  const ended = [];
  return { ended, hooks: { endRoomCall: async (input) => ended.push(input), releaseFromCalls: noCalls } };
};

test('asutuse laud: vastutaja avab ruumi ja vastab, Teekond näitab vastust, üleandmisel liigub vestlus kaasa', async (t) => {
  const world = await seed(t);
  const { applicant, coordinator, mari, jyri, member, memberships, send, ctx } = world;
  const { inquiry, item } = await send();
  assert.ok(item, 'pöördumine jõudis asutuse lauale');
  assert.equal(inquiry.recipientOwnerId, null);
  assert.equal((await linkedState(world, inquiry.id)).state, 'SENT');

  /* Koordinaator avab kirje ja määrab töö; enne vastuvõtmist ei ole kellelgi ruumi. */
  const seen = await getInboxItem(await ctx(coordinator), item.id, { db });
  assert.deepEqual(seen.room, { canOpen: false, id: null });
  assert.equal('authorId' in seen.source, false);
  const first = await assignWork(await ctx(coordinator), item.id, { assigneeMembershipId: memberships[mari.id].id }, { db });
  await refused(open(mari, inquiry.id), 403);
  await refused(open(applicant, inquiry.id), 409);
  assert.equal(await findOrganizationInquiryForWorker(mari.id, inquiry.id, { db }), null);
  assert.deepEqual((await getInboxItem(await ctx(mari), item.id, { db })).room, { canOpen: false, id: null });

  await respondToAssignment(await ctx(mari), first.id, { accept: true }, { db });
  assert.deepEqual((await getInboxItem(await ctx(mari), item.id, { db })).room, { canOpen: true, id: null });
  assert.deepEqual(await findOrganizationInquiryForWorker(mari.id, inquiry.id, { db }), { id: inquiry.id, recipientOrganizationId: world.organization.id });

  /* Koordinaator, teine töötaja ja tavaline liige ei ava; vastutaja avab. */
  for (const stranger of [coordinator, jyri, member]) {
    await refused(open(stranger, inquiry.id), 403);
    assert.equal(await findOrganizationInquiryForWorker(stranger.id, inquiry.id, { db }), null);
  }
  assert.equal(await db.room.count({ where: { originId: inquiry.id } }), 0);
  const { room, created } = await open(mari, inquiry.id);
  assert.equal(created, true);
  assert.deepEqual(await activeMembers(room.id), [`${applicant.id}:OWNER`, `${mari.id}:MEMBER`].sort());
  assert.deepEqual(await open(applicant, inquiry.id), { room, created: false });
  assert.deepEqual((await getInboxItem(await ctx(mari), item.id, { db })).room, { canOpen: true, id: room.id });
  assert.deepEqual((await getInboxItem(await ctx(coordinator), item.id, { db })).room, { canOpen: false, id: null });
  for (const stranger of [coordinator, jyri, member]) {
    await refused(open(stranger, inquiry.id), 403);
    assert.equal(await canRead(stranger, room.id), false);
  }
  /* Ruum olemas: pöörduja ei saa pöördumist enam tagasi võtta. */
  const beforeRecall = await db.preInquiry.findUnique({ where: { id: inquiry.id }, select: { updatedAt: true } });
  await refused(recallPreInquiry(applicant.id, inquiry.id, { expectedUpdatedAt: beforeRecall.updatedAt, db }), 409);

  /* Vastus ruumis: pöörduja Teekond näitab „Saaja on vastanud". */
  assert.equal((await linkedState(world, inquiry.id)).state, 'OPENED');
  await db.roomMessage.create({ data: { roomId: room.id, authorId: applicant.id, content: 'Kas on veel midagi vaja?' } });
  assert.equal((await linkedState(world, inquiry.id)).state, 'OPENED');
  await db.roomMessage.create({ data: { roomId: room.id, authorId: mari.id, content: 'Tere! Helistan teile homme.' } });
  const answered = await linkedState(world, inquiry.id);
  assert.deepEqual([answered.state, answered.replyCount], ['ANSWERED', 1]);
  assert.equal((await getJourneyDetailForUser(applicant.id, world.journey.id, { db })).preInquiryFacts.answered, 1);

  /* Üleandmine: Mari lahkub kohe, Jüri ei ole veel liige. */
  const second = await handOverWork(await ctx(mari), first.id, { toMembershipId: memberships[jyri.id].id }, { db, releaseFromCalls: noCalls });
  assert.deepEqual(await activeMembers(room.id), [`${applicant.id}:OWNER`]);
  assert.equal(await canRead(mari, room.id), false);
  await refused(open(mari, inquiry.id), 403);
  await refused(open(jyri, inquiry.id), 403);
  await refused(getInboxItem(await ctx(mari), item.id, { db }), 404);

  /* Jüri võtab vastu: sama ruum, varasem vestlus on tema ees. */
  await respondToAssignment(await ctx(jyri), second.id, { accept: true }, { db });
  assert.deepEqual(await activeMembers(room.id), [`${applicant.id}:OWNER`, `${jyri.id}:MEMBER`].sort());
  assert.deepEqual(await open(jyri, inquiry.id), { room, created: false });
  assert.equal(await canRead(jyri, room.id), true);
  assert.equal(await db.roomMessage.count({ where: { roomId: room.id } }), 2);
  assert.equal(await db.room.count({ where: { originId: inquiry.id } }), 1);
  await refused(open(mari, inquiry.id), 403);
  assert.deepEqual((await getInboxItem(await ctx(jyri), item.id, { db })).room, { canOpen: true, id: room.id });

  /* Enne sulgemist: ruumi saab kirjutada, Teekonna real sulgemise märget ei ole. Jüri jagas
     ruumis kinnitatud kokkuvõtet (kandja `RoomSharedSummary`). */
  assert.equal((await write(applicant, room.id)).ok, true);
  assert.equal(await readRoomReadOnlyReason(await roomRow(room.id), { db }), null);
  assert.equal('workClosedAt' in (await linkedState(world, inquiry.id)), false);
  const summary = await db.roomSharedSummary.create({
    data: { roomId: room.id, artifactId: `art-${inquiry.id}`, sharedByUserId: jyri.id, title: 'Kohtumise kokkuvõte', content: 'Leppisime kokku koduteenuse hindamise.' }
  });

  /* Sulgemine: Jüri ligipääs lõpeb ja ruum jääb kõigile ainult loetavaks. Ajalugu ja vastus
     jäävad pöördujale. */
  const closedAt = new Date();
  const { ended, hooks } = callHooks();
  await transitionInboxItem(await ctx(coordinator), item.id, { toStatus: 'CLOSED' }, { db, now: closedAt, ...hooks });
  assert.deepEqual(await activeMembers(room.id), [`${applicant.id}:OWNER`]);
  await refused(open(jyri, inquiry.id), 403);
  assert.equal(await canRead(jyri, room.id), false);
  assert.deepEqual(await open(applicant, inquiry.id), { room, created: false });
  assert.equal(await canRead(applicant, room.id), true);
  assert.deepEqual(await write(applicant, room.id), READ_ONLY);
  assert.equal((await roomRow(room.id)).archivedAt.getTime(), closedAt.getTime());
  assert.equal(await readRoomReadOnlyReason(await roomRow(room.id), { db }), 'ORG_WORK_CLOSED');
  assert.equal(await db.roomMessage.count({ where: { roomId: room.id } }), 2);
  assert.deepEqual(await archiveAudits(room.id), [{
    actorUserId: coordinator.id,
    meta: { title: 'Eelpöördumine: Koduteenus', originType: 'PRE_INQUIRY', reason: 'ORG_WORK_CLOSED' }
  }]);
  assert.deepEqual(ended, [{ roomId: room.id, actorUserId: coordinator.id }]);

  /* Kokkuvõtte privaatkoopia sai pöörduja sulgemisega samas tehingus; jagajal on originaal. */
  const copies = await db.roomSummaryCopy.findMany({ where: { roomSharedSummaryId: summary.id }, select: { userId: true, savedAnalysisId: true } });
  assert.deepEqual(copies.map((row) => row.userId), [applicant.id]);
  const copy = await db.savedAnalysis.findUnique({ where: { id: copies[0].savedAnalysisId }, select: { ownerId: true, content: true } });
  assert.deepEqual(copy, { ownerId: applicant.id, content: 'Leppisime kokku koduteenuse hindamise.' });

  /* Teekond ütleb pöördujale, et asutus on töö lõpetanud; vastus on endiselt näha. */
  const closedRow = await linkedState(world, inquiry.id);
  assert.deepEqual([closedRow.state, closedRow.replyCount, closedRow.workClosedAt], ['ANSWERED', 1, closedAt.toISOString()]);

  /* Pöörduja sai sulgemise kohta ühe teavituse, mis viib tema pöördumise juurde; töötajad ja
     koordinaator seda ei saanud ega näe. */
  const notices = await db.notificationEvent.findMany({
    where: { type: 'PRE_INQUIRY_WORK_CLOSED', sourceId: inquiry.id },
    select: { userId: true, targetKind: true, targetId: true, dedupeKey: true, workspaceId: true }
  });
  assert.deepEqual(notices, [{
    userId: applicant.id,
    targetKind: 'PRE_INQUIRY',
    targetId: inquiry.id,
    dedupeKey: `PRE_INQUIRY_WORK_CLOSED:${inquiry.id}:${applicant.id}:closed:${item.id}`,
    workspaceId: world.organization.id
  }]);
  const listed = (await listNotificationEvents(applicant.id, { db })).filter((row) => row.type === 'PRE_INQUIRY_WORK_CLOSED');
  assert.deepEqual(listed.map((row) => [row.href, row.labelKey]), [[`/eelpoordumised?openInquiry=${inquiry.id}`, 'notifications.events.pre_inquiry_work_closed']]);
  for (const other of [coordinator, mari, jyri]) {
    assert.equal((await listNotificationEvents(other.id, { db })).some((row) => row.type === 'PRE_INQUIRY_WORK_CLOSED'), false);
  }

  /* Suletud tööd uuesti ei avata. Uus abivajadus on uus pöördumine: uus kirje laual, vana
     ruum jääb suletuks ja uus ruum tekib alles uue töö vastuvõtmisel. */
  await refused(transitionInboxItem(await ctx(coordinator), item.id, { toStatus: 'REVIEWING' }, { db, ...hooks }), 409);
  await refused(assignWork(await ctx(coordinator), item.id, { assigneeMembershipId: memberships[mari.id].id }, { db }), 409);
  const again = await send();
  assert.notEqual(again.inquiry.id, inquiry.id);
  assert.notEqual(again.item.id, item.id);
  assert.equal(again.item.status, 'RECEIVED');
  assert.equal('workClosedAt' in (await linkedState(world, again.inquiry.id)), false);
  await refused(open(applicant, again.inquiry.id), 409);
  assert.deepEqual(await write(applicant, room.id), READ_ONLY);
  await getInboxItem(await ctx(coordinator), again.item.id, { db });
  const third = await assignWork(await ctx(coordinator), again.item.id, { assigneeMembershipId: memberships[mari.id].id }, { db });
  await respondToAssignment(await ctx(mari), third.id, { accept: true }, { db });
  const fresh = await open(mari, again.inquiry.id);
  assert.equal(fresh.created, true);
  assert.notEqual(fresh.room.id, room.id);
  assert.equal((await write(applicant, fresh.room.id)).ok, true);
  /* Uue töö vastutaja ei saa vana, suletud vestlust. */
  assert.equal(await canRead(mari, room.id), false);
});

test('asutuse laud: sulgemisel jääb ruum ainult loetavaks ka kutsutud kolmandale liikmele; ruumita sulgemine ei tee midagi', async (t) => {
  const world = await seed(t);
  const { applicant, coordinator, mari, member, memberships, send, ctx } = world;

  /* Ruumiga töö: pöörduja kutsus ruumi kolmanda inimese (ruumide leht lubab omanikul kutsuda). */
  const { inquiry, item } = await send();
  await getInboxItem(await ctx(coordinator), item.id, { db });
  const first = await assignWork(await ctx(coordinator), item.id, { assigneeMembershipId: memberships[mari.id].id }, { db });
  await respondToAssignment(await ctx(mari), first.id, { accept: true }, { db });
  const { room } = await open(mari, inquiry.id);
  await db.roomMember.create({ data: { roomId: room.id, userId: member.id, role: 'MEMBER', billingSource: 'SELF' } });
  assert.equal((await write(member, room.id)).ok, true);

  const { ended, hooks } = callHooks();
  await transitionInboxItem(await ctx(coordinator), item.id, { toStatus: 'CLOSED' }, { db, ...hooks });
  assert.deepEqual(await activeMembers(room.id), [`${applicant.id}:OWNER`, `${member.id}:MEMBER`].sort());
  for (const reader of [applicant, member]) {
    assert.equal(await canRead(reader, room.id), true);
    assert.deepEqual(await write(reader, room.id), READ_ONLY);
  }
  assert.equal(await canRead(mari, room.id), false);
  assert.equal((await archiveAudits(room.id)).length, 1);
  assert.deepEqual(ended, [{ roomId: room.id, actorUserId: coordinator.id }]);

  /* Ruumita töö: sulgemine ei loo ruumi, ei arhiveeri midagi ega kutsu kõneteenust. Teekond
     näitab sulgemist ikka. */
  const other = await send();
  await getInboxItem(await ctx(coordinator), other.item.id, { db });
  const second = await assignWork(await ctx(coordinator), other.item.id, { assigneeMembershipId: memberships[mari.id].id }, { db });
  await respondToAssignment(await ctx(mari), second.id, { accept: true }, { db });
  const quiet = callHooks();
  await transitionInboxItem(await ctx(coordinator), other.item.id, { toStatus: 'CLOSED' }, { db, ...quiet.hooks });
  assert.equal(await db.room.count({ where: { originId: other.inquiry.id } }), 0);
  assert.deepEqual(quiet.ended, []);
  await refused(open(mari, other.inquiry.id), 403);
  await refused(open(applicant, other.inquiry.id), 409);
  assert.ok((await linkedState(world, other.inquiry.id)).workClosedAt);
});

test('asutuse laud: kaks samaaegset avamist annavad ühe ruumi; üleandmine ja avamine ei jäta endist vastutajat sisse', async (t) => {
  const world = await seed(t);
  const { applicant, coordinator, mari, jyri, memberships, send, ctx } = world;
  const { inquiry, item } = await send();
  await getInboxItem(await ctx(coordinator), item.id, { db });
  const first = await assignWork(await ctx(coordinator), item.id, { assigneeMembershipId: memberships[mari.id].id }, { db });
  await respondToAssignment(await ctx(mari), first.id, { accept: true }, { db });

  const both = await Promise.all([open(mari, inquiry.id), open(applicant, inquiry.id), open(mari, inquiry.id)]);
  assert.equal(new Set(both.map((row) => row.room.id)).size, 1);
  assert.equal(both.filter((row) => row.created).length, 1);
  assert.equal(await db.room.count({ where: { originId: inquiry.id } }), 1);
  const roomId = both[0].room.id;

  /* Üleandmine ja endise vastutaja avamine korraga: kumb ka ei võidaks, lõpuks Mari liige ei ole. */
  const mariContext = await ctx(mari);
  const [handed, reopened] = await Promise.allSettled([
    handOverWork(mariContext, first.id, { toMembershipId: memberships[jyri.id].id }, { db, releaseFromCalls: noCalls }),
    open(mari, inquiry.id)
  ]);
  assert.equal(handed.status, 'fulfilled');
  assert.ok(reopened.status === 'fulfilled' || reopened.reason.status === 403);
  assert.deepEqual(await activeMembers(roomId), [`${applicant.id}:OWNER`]);
});
