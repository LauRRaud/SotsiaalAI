// Asutuse vastuvõtulaud päris andmebaasis: postkastikirje seis pärast töö üleandmist.
// Ühiktestid mälukaksikuga on failis tests/org-inbox-handover-status.test.mjs; siin on see,
// mida kaksik ei näita: andmebaasi kitsendused, auditirida, eksport ja võistlus rea luku all.
//
// Käivita isoleeritud proovibaasis:
//   JOURNEY_TEST_DATABASE_URL=postgres://…/…_probe node --import ./scripts/register-node-source-loader.mjs --test tests/org-inbox-handover-status.integration.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { resolveOrgAccessContext } from '../lib/org/accessContext.js';
import { buildOrganizationExport } from '../lib/org/export.js';
import { assignWork, getInboxItem, handOverWork, listInboxItemPage, respondToAssignment, transitionInboxItem } from '../lib/org/inbox.js';
import { createPreInquiry } from '../lib/preInquiries.js';

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

/** Asutus vastuvõtulauaga, koordinaator ja kolm töötajat; pöördumine on laual ja töö Mari käes vastu võetud. */
async function seed(t) {
  const tag = randomUUID().slice(0, 8);
  const ids = [];
  const user = async (name, role) => {
    const row = await db.user.create({ data: { email: `hs-${tag}-${name}@example.invalid`, role, profile: { create: { firstName: name, lastName: 'Proov' } } } });
    ids.push(row.id);
    return row;
  };
  const applicant = await user('pooorduja', 'CLIENT');
  const coordinator = await user('koordinaator', 'SOCIAL_WORKER');
  const mari = await user('mari', 'SOCIAL_WORKER');
  const jyri = await user('jyri', 'SOCIAL_WORKER');
  const tiit = await user('tiit', 'SOCIAL_WORKER');
  const organization = await db.organization.create({
    data: { displayName: `Proovi vald ${tag}`, legalKind: 'COMPANY', status: 'ACTIVE', activatedAt: START, verifiedAt: START }
  });
  await db.organizationModule.create({ data: { organizationId: organization.id, moduleKey: 'KOV_INTAKE', status: 'ACTIVE', validFrom: START } });
  const memberships = {};
  for (const account of [coordinator, mari, jyri, tiit]) {
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
  const first = await assignWork(await ctx(coordinator), item.id, { assigneeMembershipId: memberships[mari.id].id }, { db });
  await respondToAssignment(await ctx(mari), first.id, { accept: true }, { db });

  const row = () => db.organizationInboxItem.findUnique({ where: { id: item.id }, select: { status: true, lastTransitionAt: true, closedAt: true } });
  const live = async () =>
    (await db.organizationWorkAssignment.findMany({ where: { inboxItemId: item.id, status: { in: ['PENDING', 'ACCEPTED'] } }, select: { assigneeMembershipId: true, status: true } }))
      .map((entry) => [entry.assigneeMembershipId, entry.status]);
  const listed = async (account, status) =>
    (await listInboxItemPage(await ctx(account), { db, status })).items.map((entry) => [entry.id, entry.status, entry.assignment?.status || null]);
  return { applicant, coordinator, mari, jyri, tiit, organization, memberships, item, first, ctx, row, live, listed };
}

test('üleandmine: kirje läheb andmebaasis seisu „määratud”, auditirida ütleb kust kuhu ja lugejad näevad sama', async (t) => {
  const world = await seed(t);
  const { coordinator, mari, jyri, organization, memberships, item, first, ctx, row, live, listed } = world;
  const before = await row();
  assert.equal(before.status, 'ACCEPTED');
  assert.deepEqual(await listed(coordinator, 'ACCEPTED'), [[item.id, 'ACCEPTED', 'ACCEPTED']]);

  const second = await handOverWork(await ctx(mari), first.id, { toMembershipId: memberships[jyri.id].id, reason: 'puhkus' }, { db, releaseFromCalls: noCalls });

  /* Kirje ja elav määramine ütlevad sama: töö on määratud ja ootab Jüri vastust. */
  const after = await row();
  assert.equal(after.status, 'ASSIGNED');
  assert.equal(after.closedAt, null);
  assert.ok(after.lastTransitionAt > before.lastTransitionAt);
  assert.deepEqual(await live(), [[memberships[jyri.id].id, 'PENDING']]);

  /* Üks auditirida üleandmise kohta, selles ka kirje siire. */
  const audits = await db.dataAuditLog.findMany({
    where: { action: 'org.work_handed_over', meta: { path: ['inboxItemId'], equals: item.id } },
    select: { resourceId: true, actorUserId: true, targetUserId: true, meta: true }
  });
  assert.deepEqual(audits, [{
    resourceId: second.id,
    actorUserId: mari.id,
    targetUserId: jyri.id,
    meta: {
      organizationId: organization.id,
      inboxItemId: item.id,
      assignmentId: first.id,
      membershipId: memberships[jyri.id].id,
      reason: 'puhkus',
      fromInboxStatus: 'ACCEPTED',
      toInboxStatus: 'ASSIGNED'
    }
  }]);

  /* Loend ja seisufilter: koordinaatorile ja uuele vastutajale „määratud”; endine vastutaja rida ei näe. */
  assert.deepEqual(await listed(coordinator, 'ASSIGNED'), [[item.id, 'ASSIGNED', 'PENDING']]);
  assert.deepEqual(await listed(coordinator, 'ACCEPTED'), []);
  assert.deepEqual(await listed(jyri), [[item.id, 'ASSIGNED', 'PENDING']]);
  assert.deepEqual(await listed(mari), []);
  const seen = await getInboxItem(await ctx(jyri), item.id, { db });
  assert.deepEqual([seen.status, seen.assignment.status, seen.room.canOpen], ['ASSIGNED', 'PENDING', false]);

  /* Eksport kannab sama seisu ja kogu määramiste ahelat. */
  const exported = (await buildOrganizationExport(organization.id, { db })).inboxItems.find((entry) => entry.id === item.id);
  assert.equal(exported.status, 'ASSIGNED');
  assert.deepEqual(exported.assignments.map((entry) => entry.status).sort(), ['HANDED_OVER', 'PENDING']);

  /* Jüri võtab vastu: kirje on jälle „vastu võetud”. */
  await respondToAssignment(await ctx(jyri), second.id, { accept: true }, { db });
  assert.equal((await row()).status, 'ACCEPTED');
  assert.deepEqual(await listed(coordinator, 'ACCEPTED'), [[item.id, 'ACCEPTED', 'ACCEPTED']]);
});

test('üleandmine ja tagasilükkamine: töö ootab uut määramist ja koordinaator saab selle uuesti määrata', async (t) => {
  const { coordinator, jyri, tiit, memberships, item, first, ctx, row, live } = await seed(t);
  const second = await handOverWork(await ctx(coordinator), first.id, { toMembershipId: memberships[jyri.id].id }, { db, releaseFromCalls: noCalls });
  await respondToAssignment(await ctx(jyri), second.id, { accept: false, reason: 'koormus' }, { db });
  assert.equal((await row()).status, 'ASSIGNMENT_PENDING');
  assert.deepEqual(await live(), []);
  await assignWork(await ctx(coordinator), item.id, { assigneeMembershipId: memberships[tiit.id].id }, { db });
  assert.equal((await row()).status, 'ASSIGNED');
  assert.deepEqual(await live(), [[memberships[tiit.id].id, 'PENDING']]);
});

test('kaks samaaegset üleandmist: üks võidab, kirje on „määratud” ja elavaid määramisi on üks', async (t) => {
  const { coordinator, mari, jyri, tiit, memberships, first, ctx, row, live } = await seed(t);
  const [mariContext, coordinatorContext] = [await ctx(mari), await ctx(coordinator)];
  const results = await Promise.allSettled([
    handOverWork(mariContext, first.id, { toMembershipId: memberships[jyri.id].id }, { db, releaseFromCalls: noCalls }),
    handOverWork(coordinatorContext, first.id, { toMembershipId: memberships[tiit.id].id }, { db, releaseFromCalls: noCalls })
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const lost = results.find((result) => result.status === 'rejected');
  assert.deepEqual([lost.reason.status, lost.reason.message], [409, 'org.errors.work_assignment_not_live']);
  assert.equal((await row()).status, 'ASSIGNED');
  const alive = await live();
  assert.equal(alive.length, 1);
  assert.equal(alive[0][1], 'PENDING');
});

test('üleandmine ja sulgemine korraga: kumb ka ei võidaks, töö on suletud ja elavat määramist ei jää', async (t) => {
  const { coordinator, mari, jyri, memberships, item, first, ctx, row, live } = await seed(t);
  const [mariContext, coordinatorContext] = [await ctx(mari), await ctx(coordinator)];
  const [handed, closed] = await Promise.allSettled([
    handOverWork(mariContext, first.id, { toMembershipId: memberships[jyri.id].id }, { db, releaseFromCalls: noCalls }),
    transitionInboxItem(coordinatorContext, item.id, { toStatus: 'CLOSED' }, { db, releaseFromCalls: noCalls })
  ]);
  /* Sulgemine õnnestub mõlemas järjekorras: nii „vastu võetud” kui ka „määratud” seisust. */
  assert.equal(closed.status, 'fulfilled');
  assert.ok(handed.status === 'fulfilled' || (handed.reason.status === 409 && handed.reason.message === 'org.errors.inbox_item_terminal'));
  const end = await row();
  assert.equal(end.status, 'CLOSED');
  assert.ok(end.closedAt);
  assert.deepEqual(await live(), []);
});
