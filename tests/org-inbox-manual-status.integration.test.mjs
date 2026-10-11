// Asutuse vastuvõtulaud päris andmebaasis: koordinaatori käsitsi seisumuutus ja töö tagasivõtmine.
// Ühiktestid mälukaksikuga on failis tests/org-inbox-manual-status.test.mjs; siin on see, mida
// kaksik ei näita: andmebaasi kitsendused (üks elav määramine töö kohta), auditirida, ruumi
// liikmesus päris tabelites ja võistlus kirje rea luku all.
//
// Käivita isoleeritud proovibaasis:
//   JOURNEY_TEST_DATABASE_URL=postgres://…/…_probe node --import ./scripts/register-node-source-loader.mjs --test tests/org-inbox-manual-status.integration.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { listNotificationEvents } from '../lib/notifications.js';
import { resolveOrgAccessContext } from '../lib/org/accessContext.js';
import { buildOrganizationExport } from '../lib/org/export.js';
import { assignWork, getInboxItem, hadWorkOnInboxItem, handOverWork, listInboxItemPage, respondToAssignment, transitionInboxItem } from '../lib/org/inbox.js';
import { createPreInquiry } from '../lib/preInquiries.js';
import { withOrganizationOutcome } from '../lib/preInquiryOutcome.js';
import { resolveRoomAccess, ROOM_READ, ROOM_WRITE } from '../lib/rooms/accessGuard.js';
import { ensureRoomForPreInquiry } from '../lib/rooms/preInquiryRoom.js';

const url = new URL(process.env.JOURNEY_TEST_DATABASE_URL || 'postgres://invalid/invalid');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.endsWith('_probe')) {
  throw Error('isolated JOURNEY_TEST_DATABASE_URL (localhost, …_probe) required');
}
process.env.ORG_WORKSPACE_ENABLED = '1';
process.env.ORG_INBOX_ENABLED = '1';
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }), log: [] });
test.after(() => db.$disconnect());

const START = new Date('2026-01-01T00:00:00Z');
const FOLLOWS = 'org.errors.inbox_status_follows_assignment';
const noCalls = async () => null;
const quiet = { releaseFromCalls: noCalls, endRoomCall: noCalls };

/** Asutus vastuvõtulauaga, koordinaator ja kaks töötajat; pöördumine on laual ja koordinaator on selle avanud. */
async function seed(t) {
  /* Ainult tähed: asutuse nimi läheb pöördumise mustandisse ja numbritest koosnevat märgist
     pidas isikuandmete kontroll telefoninumbriks. */
  const tag = Array.from(randomBytes(8), (byte) => String.fromCharCode(97 + (byte % 26))).join('');
  const ids = [];
  const user = async (name, role) => {
    const row = await db.user.create({ data: { email: `ms-${tag}-${name}@example.invalid`, role, profile: { create: { firstName: name, lastName: 'Proov' } } } });
    ids.push(row.id);
    return row;
  };
  const applicant = await user('pooorduja', 'CLIENT');
  const coordinator = await user('koordinaator', 'SOCIAL_WORKER');
  const mari = await user('mari', 'SOCIAL_WORKER');
  const jyri = await user('jyri', 'SOCIAL_WORKER');
  const organization = await db.organization.create({
    data: { displayName: `Proovi vald ${tag}`, legalKind: 'COMPANY', status: 'ACTIVE', activatedAt: START, verifiedAt: START }
  });
  await db.organizationModule.create({ data: { organizationId: organization.id, moduleKey: 'KOV_INTAKE', status: 'ACTIVE', validFrom: START } });
  const memberships = {};
  for (const account of [coordinator, mari, jyri]) {
    memberships[account.id] = await db.organizationMembership.create({
      data: { organizationId: organization.id, userId: account.id, seatRole: 'SOCIAL_WORKER', status: 'ACTIVE', startedAt: START }
    });
  }
  for (const capability of ['INBOX_COORDINATOR', 'WORK_ASSIGNER']) {
    await db.organizationCapabilityGrant.create({
      data: { membershipId: memberships[coordinator.id].id, capability, scopeType: 'ORGANIZATION', validFrom: START }
    });
  }
  t.after(async () => {
    await db.room.deleteMany({ where: { ownerId: { in: ids } } });
    await db.dataAuditLog.deleteMany({ where: { meta: { path: ['organizationId'], equals: organization.id } } });
    await db.organizationInboxItem.deleteMany({ where: { organizationId: organization.id } });
    await db.preInquiry.deleteMany({ where: { authorId: applicant.id } });
    await db.organization.deleteMany({ where: { id: organization.id } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  });

  const ctx = (account) => resolveOrgAccessContext({ userId: account.id, requestedOrganizationId: organization.id }, { db, env: process.env });
  const inquiry = await createPreInquiry(applicant.id, {
    recipientOrganizationId: organization.id,
    recipientType: 'ORGANIZATION_INBOX',
    topic: 'Koduteenus',
    situation: 'Ema ei saa enam ise poes käia.',
    userEditedDraft: 'Palun abi koduteenuse taotlemisel.',
    status: 'SENT'
  }, { db });
  const item = await db.organizationInboxItem.findFirst({ where: { organizationId: organization.id, sourceId: inquiry.id } });
  assert.ok(item, 'pöördumine jõudis asutuse lauale');
  await getInboxItem(await ctx(coordinator), item.id, { db });

  const row = () => db.organizationInboxItem.findUnique({ where: { id: item.id }, select: { status: true, lastTransitionAt: true, closedAt: true } });
  const assignments = async () =>
    (await db.organizationWorkAssignment.findMany({ where: { inboxItemId: item.id }, orderBy: { assignedAt: 'asc' }, select: { assigneeMembershipId: true, status: true } }))
      .map((entry) => [entry.assigneeMembershipId, entry.status]);
  const live = async () => (await assignments()).filter(([, status]) => ['PENDING', 'ACCEPTED'].includes(status));
  const manual = async (toStatus, reason) => transitionInboxItem(await ctx(coordinator), item.id, { toStatus, reason }, { db, ...quiet });
  const assign = async (account) => assignWork(await ctx(coordinator), item.id, { assigneeMembershipId: memberships[account.id].id }, { db });
  const respond = async (account, assignmentId, accept) => respondToAssignment(await ctx(account), assignmentId, { accept }, { db });
  return { applicant, coordinator, mari, jyri, organization, memberships, inquiry, item, ctx, row, assignments, live, manual, assign, respond };
}

const refused = (promise, message) => assert.rejects(promise, (error) => error.status === 409 && error.message === message);
const activeMembers = async (roomId) =>
  (await db.roomMember.findMany({ where: { roomId, leftAt: null }, select: { userId: true } })).map((entry) => entry.userId).sort();
const access = (account, roomId, intent) =>
  resolveRoomAccess({ userId: account.id, userRole: account.role, roomId, intent, db, hasActiveSubscription: async () => true });

test('käsitsi „määratud” ja „vastu võetud”: server keeldub ja andmebaasis ei muutu midagi', async (t) => {
  const { mari, memberships, row, assignments, manual, assign, respond } = await seed(t);

  /* Vastutajata kirje: „määratuks” saab ainult määramisega. */
  for (const toStatus of ['ASSIGNED', 'ACCEPTED']) await refused(manual(toStatus), FOLLOWS);
  assert.equal((await row()).status, 'RECEIVED');
  assert.deepEqual(await assignments(), []);

  /* Töö ootab Mari vastust: koordinaator ei saa seda tema eest vastu võtta. */
  const first = await assign(mari);
  const waiting = await row();
  for (const toStatus of ['ACCEPTED', 'ASSIGNED']) await refused(manual(toStatus), FOLLOWS);
  assert.deepEqual(await row(), waiting);
  assert.deepEqual(await assignments(), [[memberships[mari.id].id, 'PENDING']]);

  /* Mari võtab ise vastu; ka siis ei saa kirjet käsitsi „määratuks” tagasi kirjutada. */
  await respond(mari, first.id, true);
  await refused(manual('ASSIGNED'), FOLLOWS);
  assert.equal((await row()).status, 'ACCEPTED');
  assert.deepEqual(await assignments(), [[memberships[mari.id].id, 'ACCEPTED']]);
});

test('töö tagasivõtmine: määramine lõpeb samas tehingus, töötaja lahkub ruumist ja töö saab uuesti määrata', async (t) => {
  const { applicant, coordinator, mari, jyri, organization, memberships, inquiry, item, ctx, row, assignments, live, manual, assign, respond } = await seed(t);
  const first = await assign(mari);
  await respond(mari, first.id, true);
  const { room } = await ensureRoomForPreInquiry({ userId: mari.id, inquiry: { id: inquiry.id } }, { db });
  assert.deepEqual(await activeMembers(room.id), [applicant.id, mari.id].sort());
  const before = await row();

  const updated = await manual('ASSIGNMENT_PENDING');
  assert.equal(updated.status, 'ASSIGNMENT_PENDING');

  /* Kirje ootab uut määramist ja elavat määramist ei ole; ajalukku jääb lõpetatud rida. */
  const after = await row();
  assert.equal(after.status, 'ASSIGNMENT_PENDING');
  assert.equal(after.closedAt, null);
  assert.ok(after.lastTransitionAt > before.lastTransitionAt);
  assert.deepEqual(await assignments(), [[memberships[mari.id].id, 'ENDED']]);
  const ended = await db.organizationWorkAssignment.findUnique({ where: { id: first.id }, select: { endedAt: true } });
  assert.ok(ended.endedAt);

  /* Mari lahkus ruumist; ruum ei ole arhiivis ja pöörduja kirjutab edasi. */
  assert.deepEqual(await activeMembers(room.id), [applicant.id]);
  assert.equal((await db.room.findUnique({ where: { id: room.id }, select: { archivedAt: true } })).archivedAt, null);
  assert.equal((await access(applicant, room.id, ROOM_WRITE)).ok, true);
  assert.equal((await access(mari, room.id, ROOM_READ)).ok, false);
  await assert.rejects(ensureRoomForPreInquiry({ userId: mari.id, inquiry: { id: inquiry.id } }, { db }), (error) => error.status === 403);

  /* Üks auditirida tagasivõtmise kohta: kes, kellelt ja mis määramine. */
  const audits = await db.dataAuditLog.findMany({
    where: { action: 'org.inbox_item_transitioned', meta: { path: ['inboxItemId'], equals: item.id } },
    select: { resourceId: true, actorUserId: true, targetUserId: true, meta: true }
  });
  assert.deepEqual(audits, [{
    resourceId: item.id,
    actorUserId: coordinator.id,
    targetUserId: mari.id,
    meta: {
      organizationId: organization.id,
      inboxItemId: item.id,
      fromInboxStatus: 'ACCEPTED',
      toInboxStatus: 'ASSIGNMENT_PENDING',
      assignmentId: first.id,
      membershipId: memberships[mari.id].id
    }
  }]);

  /* Lugejad: koordinaator näeb vastutajata kirjet, Mari laual seda enam ei ole. */
  const listed = async (account) => (await listInboxItemPage(await ctx(account), { db })).items.map((entry) => [entry.id, entry.status, entry.assignment?.status || null]);
  assert.deepEqual(await listed(coordinator), [[item.id, 'ASSIGNMENT_PENDING', null]]);
  assert.deepEqual(await listed(mari), []);
  await assert.rejects(getInboxItem(await ctx(mari), item.id, { db }), (error) => error.status === 404);

  /* Uus määramine mahub „üks elav määramine töö kohta” kitsenduse alla; Jüri liitub sama ruumiga. */
  const second = await assign(jyri);
  assert.equal((await row()).status, 'ASSIGNED');
  await respond(jyri, second.id, true);
  assert.equal((await row()).status, 'ACCEPTED');
  assert.deepEqual(await live(), [[memberships[jyri.id].id, 'ACCEPTED']]);
  assert.deepEqual(await activeMembers(room.id), [applicant.id, jyri.id].sort());
  assert.equal(await db.room.count({ where: { originId: inquiry.id } }), 1);

  /* Eksport kannab sama seisu ja kogu määramiste ahelat. */
  const exported = (await buildOrganizationExport(organization.id, { db })).inboxItems.find((entry) => entry.id === item.id);
  assert.equal(exported.status, 'ACCEPTED');
  assert.deepEqual(exported.assignments.map((entry) => entry.status).sort(), ['ACCEPTED', 'ENDED']);
});

test('töö tagasivõtmise teated: töötaja saab teada, et töö ei ole enam tema vastutusel, pöörduja saab neutraalse teate', async (t) => {
  const { applicant, coordinator, mari, jyri, organization, memberships, inquiry, item, ctx, manual, assign, respond } = await seed(t);
  const first = await assign(mari);
  await respond(mari, first.id, true);
  const shown = async (account, type) => (await listNotificationEvents(account.id, { db })).filter((row) => row.type === type);
  /* Enne tagasivõtmist on Maril teade „sulle määrati töö”. */
  assert.equal((await shown(mari, 'ORG_WORK_ASSIGNED')).length, 1);
  assert.equal((await shown(mari, 'ORG_WORK_WITHDRAWN')).length, 0);

  await manual('ASSIGNMENT_PENDING');

  /* Töötaja teade: ainult tunnused, allikaks lõppenud määramine, siht sama kirje. */
  const rows = await db.notificationEvent.findMany({
    where: { type: 'ORG_WORK_WITHDRAWN', sourceId: first.id },
    select: { userId: true, sourceType: true, targetKind: true, targetId: true, workspaceId: true, emailPolicy: true, dedupeKey: true }
  });
  assert.deepEqual(rows, [{
    userId: mari.id,
    sourceType: 'ORG_WORK_ASSIGNMENT',
    targetKind: 'ORG_INBOX_ITEM',
    targetId: item.id,
    workspaceId: organization.id,
    emailPolicy: 'OPTIONAL',
    dedupeKey: `ORG_WORK_WITHDRAWN:${first.id}:${mari.id}:v1`
  }]);
  /* Mari loendis on uus teade ja vana „sulle määrati töö” on kadunud, sest töö ei ole enam tema käes. */
  assert.deepEqual((await shown(mari, 'ORG_WORK_WITHDRAWN')).map((row) => [row.href, row.labelKey, row.ackMode]), [
    [`/org/vastuvott/${item.id}`, 'notifications.events.org_work_withdrawn', 'read']
  ]);
  assert.equal((await shown(mari, 'ORG_WORK_ASSIGNED')).length, 0);
  for (const other of [coordinator, jyri, applicant]) assert.equal((await shown(other, 'ORG_WORK_WITHDRAWN')).length, 0);

  /* Teate aadress: Mari kirjet ei ava, suunaja viib ta asutuse vastuvõtulauale. */
  await assert.rejects(getInboxItem(await ctx(mari), item.id, { db }), (error) => error.status === 404);
  assert.equal(await hadWorkOnInboxItem(await ctx(mari), item.id, { db }), true);
  assert.equal(await hadWorkOnInboxItem(await ctx(jyri), item.id, { db }), false);

  /* Pöörduja: sama neutraalne teade mis üleandmisel, viide tema enda pöördumisele. */
  const told = await db.notificationEvent.findMany({
    where: { userId: applicant.id, type: 'PRE_INQUIRY_STATUS_CHANGED' },
    select: { sourceId: true, dedupeKey: true }
  });
  assert.deepEqual(told, [{ sourceId: inquiry.id, dedupeKey: `PRE_INQUIRY_STATUS_CHANGED:${inquiry.id}:${applicant.id}:takeback:${first.id}` }]);
  assert.equal((await shown(applicant, 'PRE_INQUIRY_STATUS_CHANGED')).length, 1);

  /* Töö määratakse Marile uuesti: teade „ei ole enam sinu vastutusel” kaob tema loendist. */
  const again = await assign(mari);
  assert.equal((await shown(mari, 'ORG_WORK_WITHDRAWN')).length, 0);
  assert.ok((await shown(mari, 'ORG_WORK_ASSIGNED')).length >= 1);

  /* Koordinaator annab Mari vastamata töö Jürile: Mari saab uue teate selle määramise kohta,
     Jüri oma ülesande. */
  await handOverWork(await ctx(coordinator), again.id, { toMembershipId: memberships[jyri.id].id }, { db, releaseFromCalls: noCalls });
  assert.equal((await shown(mari, 'ORG_WORK_WITHDRAWN')).length, 2);
  assert.equal((await shown(jyri, 'ORG_WORK_ASSIGNED')).length, 1);
  assert.equal((await shown(jyri, 'ORG_WORK_WITHDRAWN')).length, 0);
});

test('töö ise ära andnud töötaja teadet ei saa', async (t) => {
  const { mari, jyri, memberships, ctx, assign, respond } = await seed(t);
  const first = await assign(mari);
  await respond(mari, first.id, true);
  await handOverWork(await ctx(mari), first.id, { toMembershipId: memberships[jyri.id].id }, { db, releaseFromCalls: noCalls });
  assert.equal(await db.notificationEvent.count({ where: { type: 'ORG_WORK_WITHDRAWN', sourceId: first.id } }), 0);
});

test('tagasivõtmine ja töötaja vastus korraga: kumb ka ei võidaks, töö ootab määramist ja elavat määramist ei jää', async (t) => {
  const { mari, memberships, row, assignments, live, manual, assign, respond } = await seed(t);
  const first = await assign(mari);
  const [answered, taken] = await Promise.allSettled([respond(mari, first.id, true), manual('ASSIGNMENT_PENDING')]);
  /* Tagasivõtmine õnnestub mõlemas järjekorras: nii vastust ootavalt kui ka vastu võetud töölt. */
  assert.equal(taken.status, 'fulfilled');
  assert.ok(answered.status === 'fulfilled' || (answered.reason.status === 409 && answered.reason.message === 'org.errors.work_assignment_not_pending'));
  assert.equal((await row()).status, 'ASSIGNMENT_PENDING');
  assert.deepEqual(await live(), []);
  assert.deepEqual(await assignments(), [[memberships[mari.id].id, 'ENDED']]);
});

test('tagasivõtmine pärast üleandmist: lõpeb uue töötaja vastust ootav määramine', async (t) => {
  const { mari, jyri, memberships, ctx, row, assignments, manual, assign, respond } = await seed(t);
  const first = await assign(mari);
  await respond(mari, first.id, true);
  await handOverWork(await ctx(mari), first.id, { toMembershipId: memberships[jyri.id].id }, { db, releaseFromCalls: noCalls });
  assert.equal((await row()).status, 'ASSIGNED');

  await manual('ASSIGNMENT_PENDING');
  assert.equal((await row()).status, 'ASSIGNMENT_PENDING');
  assert.deepEqual(await assignments(), [[memberships[mari.id].id, 'HANDED_OVER'], [memberships[jyri.id].id, 'ENDED']]);
  /* Jüri leht oli veel lahti: tema vastus saab keeldumise. */
  const second = await db.organizationWorkAssignment.findFirst({ where: { supersedesAssignmentId: first.id }, select: { id: true } });
  await refused(respond(jyri, second.id, true), 'org.errors.work_assignment_not_pending');
  assert.equal((await row()).status, 'ASSIGNMENT_PENDING');
});

test('tagasivõtmine ja üleandmine korraga: töö ei jää kummagi töötaja kätte', async (t) => {
  const { mari, jyri, memberships, ctx, row, live, manual, assign, respond } = await seed(t);
  const first = await assign(mari);
  await respond(mari, first.id, true);
  const mariContext = await ctx(mari);
  const [handed, taken] = await Promise.allSettled([
    handOverWork(mariContext, first.id, { toMembershipId: memberships[jyri.id].id }, { db, releaseFromCalls: noCalls }),
    manual('ASSIGNMENT_PENDING')
  ]);
  assert.equal(taken.status, 'fulfilled');
  assert.ok(handed.status === 'fulfilled' || (handed.reason.status === 409 && handed.reason.message === 'org.errors.work_assignment_not_live'));
  assert.equal((await row()).status, 'ASSIGNMENT_PENDING');
  assert.deepEqual(await live(), []);
});

test('sulgemine käib nagu enne: töö lõpeb, määramine lõpeb ja ruum jääb ainult loetavaks', async (t) => {
  const { applicant, mari, memberships, inquiry, row, assignments, manual, assign, respond } = await seed(t);
  const first = await assign(mari);
  await respond(mari, first.id, true);
  const { room } = await ensureRoomForPreInquiry({ userId: mari.id, inquiry: { id: inquiry.id } }, { db });

  const closed = await manual('CLOSED');
  assert.equal(closed.status, 'CLOSED');
  assert.ok((await row()).closedAt);
  assert.deepEqual(await assignments(), [[memberships[mari.id].id, 'ENDED']]);
  assert.ok((await db.room.findUnique({ where: { id: room.id }, select: { archivedAt: true } })).archivedAt);
  assert.deepEqual(await access(applicant, room.id, ROOM_WRITE), { ok: false, status: 409, message: 'api.rooms.archived_readonly' });
  assert.equal((await access(applicant, room.id, ROOM_READ)).ok, true);
  /* Vastutaja saab teate, et töö ei ole enam tema vastutusel: kirje kadus ka tema laualt. */
  const told = (await listNotificationEvents(mari.id, { db })).filter((entry) => entry.type === 'ORG_WORK_WITHDRAWN');
  assert.deepEqual(told.map((entry) => entry.labelKey), ['notifications.events.org_work_withdrawn']);
  assert.equal(await db.notificationEvent.count({ where: { type: 'ORG_WORK_WITHDRAWN', sourceId: first.id, userId: mari.id } }), 1);
  /* Suletud töö ei liigu enam kuhugi, ka mitte tagasivõtmisega. */
  await refused(manual('ASSIGNMENT_PENDING'), 'org.errors.inbox_item_terminal');
});

test('pöördumise tagasilükkamine: vastutajata pöördumine lõpeb, kaob laua loendist ja pöörduja saab teate', async (t) => {
  const { applicant, coordinator, inquiry, item, ctx, row, assignments, manual } = await seed(t);
  const listed = async (options = {}) => (await listInboxItemPage(await ctx(coordinator), { db, ...options })).items.map((entry) => [entry.id, entry.status]);
  assert.deepEqual(await listed(), [[item.id, 'RECEIVED']]);

  /* Ilma selgituseta server keeldub ja pöördumine jääb lauale. */
  await assert.rejects(manual('REJECTED'), (error) => error.status === 400 && error.message === 'org.errors.inbox_reject_reason_required');
  await assert.rejects(manual('REJECTED', '   '), (error) => error.status === 400);
  assert.deepEqual(await listed(), [[item.id, 'RECEIVED']]);

  /* Sama päring, mille leht saadab nupuga „Lükka pöördumine tagasi”: koos selgitusega pöördujale. */
  const rejected = await manual('REJECTED', '  See ei kuulu meie valla pädevusse. ');
  assert.equal(rejected.status, 'REJECTED');
  assert.ok((await row()).closedAt);
  const stored = await db.organizationInboxItem.findUnique({ where: { id: item.id }, select: { closedReason: true } });
  assert.equal(stored.closedReason, 'See ei kuulu meie valla pädevusse.');
  assert.deepEqual(await assignments(), []);

  /* Laual seda enam ei ole; ajaloost ja seisufiltriga leiab. Koordinaator saab kirje avada. */
  assert.deepEqual(await listed(), []);
  assert.deepEqual(await listed({ includeClosed: true }), [[item.id, 'REJECTED']]);
  assert.deepEqual(await listed({ status: 'REJECTED' }), [[item.id, 'REJECTED']]);
  assert.deepEqual(await listed({ closedOnly: true }), [[item.id, 'REJECTED']]);
  const seen = await getInboxItem(await ctx(coordinator), item.id, { db });
  assert.deepEqual([seen.status, seen.closedReason, Boolean(seen.closedAt)], ['REJECTED', 'See ei kuulu meie valla pädevusse.', true]);

  /* Pöörduja saab tagasilükkamise teate (oma liik ja sõnastus), mitte töö lõpetamise oma. */
  const notices = await db.notificationEvent.findMany({ where: { userId: applicant.id, type: { in: ['PRE_INQUIRY_DECLINED', 'PRE_INQUIRY_WORK_CLOSED'] } }, select: { type: true, sourceId: true } });
  assert.deepEqual(notices, [{ type: 'PRE_INQUIRY_DECLINED', sourceId: inquiry.id }]);
  const noticeRows = (await listNotificationEvents(applicant.id, { db })).filter((entry) => entry.type === 'PRE_INQUIRY_DECLINED');
  assert.deepEqual(noticeRows.map((entry) => [entry.href, entry.labelKey]), [[`/eelpoordumised?openInquiry=${inquiry.id}`, 'notifications.events.pre_inquiry_declined']]);

  /* Pöörduja enda pöördumise real on asutuse otsus ja selgitus; teisele inimesele seda ei lisata. */
  const inquiryRow = { id: inquiry.id, authorId: applicant.id, sentAt: new Date().toISOString(), recalledAt: null, recipientOrganizationId: inquiry.recipientOrganizationId };
  const [own] = await withOrganizationOutcome(applicant.id, [inquiryRow], { db });
  assert.deepEqual([own.organizationOutcome.kind, own.organizationOutcome.note, own.organizationOutcome.hasRoom, typeof own.organizationOutcome.at], ['declined', 'See ei kuulu meie valla pädevusse.', false, 'string']);
  const [foreign] = await withOrganizationOutcome(coordinator.id, [inquiryRow], { db });
  assert.equal('organizationOutcome' in foreign, false);

  /* Tagasi lükatud pöördumine ei liigu enam kuhugi. */
  await refused(manual('REVIEWING'), 'org.errors.inbox_item_terminal');
});
