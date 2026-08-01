#!/usr/bin/env node
/**
 * T25 ORG-FUNDING-INBOX-V1 — sünteetiline runtime-kontroll (E12).
 *
 *   node --import ./scripts/register-node-test-loader.mjs scripts/org-funding-runtime-check.mjs
 *
 * Tõendab seda, mida `npm test` fake-Prismaga ei saa: osalisi unikaalindekseid,
 * CHECK-piiranguid, tehinguid, seat-limiidi VÕISTLUST ja eelpöördumise
 * liitekohta päris kirjutustega.
 *
 * Andmed: ainult `@t25-fund.invalid` sünteetilised kontod; skript koristab lõpus.
 */

import prisma from "../lib/prisma.js";
import { hasCapability, resolveOrgAccessContext } from "../lib/org/accessContext.js";
import { activateModule, changeOrganizationStatus, createOrganization } from "../lib/org/organizations.js";
import { createUnit } from "../lib/org/structure.js";
import { endMembership, grantCapability, setPrimaryUnit } from "../lib/org/members.js";
import { acceptInvite, createInvite } from "../lib/org/inviteService.js";
import { assignSeat, createSeatPlan, listSeatPlans, releaseSeat } from "../lib/org/seats.js";
import { acceptClientSponsorship, createClientSponsorship } from "../lib/org/sponsorship.js";
import {
  assignWork,
  getInboxItem,
  handOverWork,
  listInboxItems,
  respondToAssignment
} from "../lib/org/inbox.js";
import { createPreInquiry, recallPreInquiry } from "../lib/preInquiries.js";

const ENV = { ORG_WORKSPACE_ENABLED: "1", ORG_CREATION_ENABLED: "1", ORG_SEATS_ENABLED: "1", ORG_INBOX_ENABLED: "1" };

/* Väravad tuleb panna ka `process.env`-i, mitte ainult süstitud objekti:
   eelpöördumise moodul loeb `isOrgInboxEnabled()` protsessi keskkonnast, sest
   see on serveri-tasemel värav, mitte päringu parameeter. Arenduskava §10 lubab
   sünteetilisel testkeskkonnal värava ajutiselt sisse lülitada. */
Object.assign(process.env, ENV);
const SUFFIX = "@t25-fund.invalid";
const MARK = "(fund-sünteetiline)";

let passed = 0;
let failed = 0;
const created = { userIds: [], organizationIds: [] };

const ok = (label) => { passed += 1; console.log(`  PASS  ${label}`); };
const bad = (label, detail) => { failed += 1; console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`); };
const expect = (label, cond, detail) => (cond ? ok(label) : bad(label, detail));

async function expectReject(label, promise, predicate) {
  try {
    await promise;
    bad(label, "expected rejection, got success");
  } catch (error) {
    if (predicate && !predicate(error)) return bad(label, error?.messageKey || error?.code || error?.message);
    ok(label);
  }
}

async function makeUser(local, role) {
  const user = await prisma.user.create({
    data: { email: `${local}${SUFFIX}`, role, emailVerified: new Date(), acceptsPreInquiries: false }
  });
  created.userIds.push(user.id);
  return user;
}

async function ctx(userId, organizationId) {
  return resolveOrgAccessContext(
    { userId, requestedOrganizationId: organizationId, productRole: "SOCIAL_WORKER" },
    { env: ENV }
  );
}

async function purgeStale() {
  const orgs = await prisma.organization.findMany({
    where: { displayName: { contains: MARK } },
    select: { id: true }
  });
  for (const org of orgs) {
    await prisma.dataAuditLog.deleteMany({
      where: { action: { startsWith: "org." }, meta: { path: ["organizationId"], equals: org.id } }
    });
    // Sama Restrict-piirang kui cleanup'is — vt selgitust seal.
    await prisma.organizationWorkAssignment.deleteMany({
      where: { inboxItem: { organizationId: org.id } }
    });
  }
  await prisma.preInquiry.deleteMany({ where: { author: { email: { endsWith: SUFFIX } } } });
  await prisma.organization.deleteMany({ where: { displayName: { contains: MARK } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });
}

async function main() {
  console.log("T25 ORG-FUNDING-INBOX-V1 synthetic runtime\n");
  await purgeStale();

  const owner = await makeUser("owner", "SOCIAL_WORKER");
  const worker = await makeUser("worker", "SOCIAL_WORKER");
  const other = await makeUser("other", "SOCIAL_WORKER");
  const provider = await makeUser("provider", "SERVICE_PROVIDER");
  const citizen = await makeUser("citizen", "CLIENT");

  // --- Alus: aktiivne KOV vastuvõtumooduliga ---------------------------
  const { organization: org } = await createOrganization({
    userId: owner.id,
    productRole: "SOCIAL_WORKER",
    displayName: `X vald ${MARK}`,
    legalKind: "MUNICIPALITY"
  });
  created.organizationIds.push(org.id);
  await changeOrganizationStatus(org.id, { actorUserId: owner.id, toStatus: "PENDING_VERIFICATION" });
  await changeOrganizationStatus(org.id, { actorUserId: owner.id, isPlatformAdmin: true, toStatus: "ACTIVE" });
  await activateModule(org.id, { actorUserId: owner.id, moduleKey: "KOV_INTAKE" });

  const teamA = await createUnit(org.id, { actorUserId: owner.id, name: "Tiim A", type: "TEAM" });
  const teamB = await createUnit(org.id, { actorUserId: owner.id, name: "Tiim B", type: "TEAM" });

  const ownerMembership = await prisma.organizationMembership.findFirst({
    where: { organizationId: org.id, userId: owner.id, status: "ACTIVE" }
  });

  const { rawToken } = await createInvite(org.id, {
    actorUserId: owner.id,
    email: worker.email,
    seatRole: "SOCIAL_WORKER",
    capabilityTemplate: "MEMBER",
    primaryUnitId: teamA.id
  });
  const joined = await acceptInvite(rawToken, { userId: worker.id, userEmail: worker.email });
  const workerMembership = joined.membership;

  const invite2 = await createInvite(org.id, {
    actorUserId: owner.id,
    email: other.email,
    seatRole: "SOCIAL_WORKER",
    capabilityTemplate: "MEMBER",
    primaryUnitId: teamB.id
  });
  const joined2 = await acceptInvite(invite2.rawToken, { userId: other.id, userEmail: other.email });
  const otherMembership = joined2.membership;

  // --- 1. Kohad ---------------------------------------------------------
  const plan = await createSeatPlan(org.id, {
    actorUserId: owner.id,
    seatRole: "SOCIAL_WORKER",
    seatLimit: 1
  });
  expect("a plan defaults to the platform's role price", plan.unitPriceCents === 1499, `${plan.unitPriceCents}`);

  await expectReject(
    "a discount without a reason is refused",
    createSeatPlan(org.id, { actorUserId: owner.id, seatRole: "SERVICE_PROVIDER", seatLimit: 1, unitPriceCents: 500 }),
    (e) => e.messageKey === "org.errors.price_reason_required"
  );

  await expectReject(
    "a second active plan for the same role is refused",
    createSeatPlan(org.id, { actorUserId: owner.id, seatRole: "SOCIAL_WORKER", seatLimit: 5 }),
    (e) => e.status === 409
  );

  await assignSeat(org.id, { actorUserId: owner.id, seatPlanId: plan.id, membershipId: workerMembership.id });

  await expectReject(
    "the seat limit holds — the second seat on a 1-seat plan is refused",
    assignSeat(org.id, { actorUserId: owner.id, seatPlanId: plan.id, membershipId: otherMembership.id }),
    (e) => e.messageKey === "org.errors.seat_limit_reached"
  );

  /* VÕISTLUS: kaks samaaegset kohaandmist viimasele vabale kohale. Ilma
     reaLUKUta näeksid mõlemad `used < limit` ja mõlemad kirjutaksid. */
  const plan2 = await createSeatPlan(org.id, {
    actorUserId: owner.id,
    seatRole: "SERVICE_PROVIDER",
    seatLimit: 1
  });
  const providerInvite = await createInvite(org.id, {
    actorUserId: owner.id,
    email: provider.email,
    seatRole: "SERVICE_PROVIDER",
    capabilityTemplate: "MEMBER"
  });
  const providerJoined = await acceptInvite(providerInvite.rawToken, {
    userId: provider.id,
    userEmail: provider.email
  });
  const races = await Promise.allSettled([
    assignSeat(org.id, { actorUserId: owner.id, seatPlanId: plan2.id, membershipId: providerJoined.membership.id }),
    assignSeat(org.id, { actorUserId: owner.id, seatPlanId: plan2.id, membershipId: providerJoined.membership.id })
  ]);
  expect(
    "two concurrent claims on the last seat produce exactly one seat",
    races.filter((r) => r.status === "fulfilled").length === 1,
    `${races.filter((r) => r.status === "fulfilled").length} succeeded`
  );

  await expectReject(
    "a specialist seat cannot be given to a service-provider membership",
    assignSeat(org.id, { actorUserId: owner.id, seatPlanId: plan.id, membershipId: providerJoined.membership.id }),
    (e) => e.messageKey === "org.errors.seat_role_mismatch"
  );

  const workerCtx = await ctx(worker.id, org.id);
  expect("a seated member reports the organisation as payer", workerCtx.payerSource === "ORGANIZATION");
  expect("a seat grants no capability", !hasCapability(workerCtx, "MEMBER_ADMIN"));

  const otherCtx = await ctx(other.id, org.id);
  expect("an unseated member is not org-funded", otherCtx.payerSource === "SELF");

  const plans = await listSeatPlans(org.id);
  const socialPlan = plans.find((p) => p.seatRole === "SOCIAL_WORKER");
  expect("the funding view counts used and free seats", socialPlan.usedSeats === 1 && socialPlan.freeSeats === 0);
  expect(
    "the funding view carries no usage metric",
    !JSON.stringify(plans).toLowerCase().includes("lastseen") &&
      !JSON.stringify(plans).toLowerCase().includes("messagecount")
  );

  // --- 2. Pöörduja sponsorlus — RUUMITA ---------------------------------
  const roomsBefore = await prisma.room.count();
  const { rawToken: sponsorToken } = await createClientSponsorship(org.id, {
    actorUserId: owner.id,
    email: citizen.email
  });
  await acceptClientSponsorship(sponsorToken, { userId: citizen.id, userEmail: citizen.email });
  const roomsAfter = await prisma.room.count();
  expect("sponsoring a citizen creates no room at all", roomsBefore === roomsAfter);

  const citizenSub = await prisma.subscription.findFirst({ where: { userId: citizen.id } });
  expect("the citizen gets an organisation-funded subscription", citizenSub?.billingSource === "SPONSORED_BY_ORGANIZATION");
  expect("the subscription points at the paying organisation", citizenSub?.sponsorOrganizationId === org.id);
  expect("the citizen is on the CLIENT plan", citizenSub?.plan === "client_monthly");

  const citizenMembership = await prisma.organizationMembership.count({
    where: { organizationId: org.id, userId: citizen.id }
  });
  expect("a sponsored citizen never becomes a member", citizenMembership === 0);
  const citizenSeat = await prisma.organizationSeatAssignment.count({
    where: { membership: { userId: citizen.id } }
  });
  expect("a sponsored citizen never occupies a seat", citizenSeat === 0);

  await expectReject(
    "a sponsored citizen cannot open the organisation workspace",
    ctx(citizen.id, org.id),
    (e) => e.status === 404
  );

  // --- 3. Eelpöördumine organisatsiooni postkasti -----------------------
  await createPreInquiry(citizen.id, {
    recipientOrganizationId: org.id,
    topic: "Eluase",
    situation: "Sünteetiline olukorra kirjeldus runtime-kontrolliks.",
    status: "SENT"
  });

  const inquiry = await prisma.preInquiry.findFirst({ where: { authorId: citizen.id } });
  expect("the pre-inquiry is addressed to the organisation", inquiry?.recipientOrganizationId === org.id);
  expect("an organisation-addressed inquiry has no personal recipient", inquiry?.recipientOwnerId === null);
  expect("the recipient type is the organisation inbox", inquiry?.recipientType === "ORGANIZATION_INBOX");

  const item = await prisma.organizationInboxItem.findFirst({
    where: { organizationId: org.id, sourceId: inquiry.id }
  });
  expect("an inbox item was delivered", Boolean(item));

  // --- 4. Postkasti skoop ----------------------------------------------
  const plainCtx = await ctx(other.id, org.id);
  expect("an ordinary member sees an empty inbox", (await listInboxItems(plainCtx)).length === 0);

  await grantCapability(org.id, workerMembership.id, {
    actorUserId: owner.id,
    capability: "INBOX_COORDINATOR",
    scopeType: "UNIT",
    scopeUnitId: teamA.id
  });
  await grantCapability(org.id, workerMembership.id, {
    actorUserId: owner.id,
    capability: "WORK_ASSIGNER",
    scopeType: "UNIT",
    scopeUnitId: teamA.id
  });
  await prisma.organizationInboxItem.update({ where: { id: item.id }, data: { unitId: teamA.id } });

  const coordCtx = await ctx(worker.id, org.id);
  expect("a unit coordinator sees their unit's item", (await listInboxItems(coordCtx)).length === 1);

  await grantCapability(org.id, otherMembership.id, {
    actorUserId: owner.id,
    capability: "INBOX_COORDINATOR",
    scopeType: "UNIT",
    scopeUnitId: teamB.id
  });
  const siblingCtx = await ctx(other.id, org.id);
  expect(
    "a sibling unit's coordinator does NOT see it",
    (await listInboxItems(siblingCtx)).length === 0
  );

  // --- 5. Sisu projektsioon --------------------------------------------
  const opened = await getInboxItem(coordCtx, item.id);
  expect("the coordinator receives the sender-confirmed package", opened.source?.situation?.includes("Sünteetiline"));
  expect("the journey reference is absent", !JSON.stringify(opened).includes("sourceJourneyId"));
  expect("the author id is absent", !JSON.stringify(opened).includes(citizen.id));

  const afterOpen = await prisma.preInquiry.findUnique({ where: { id: inquiry.id } });
  expect("opening stamps openedAt on the source", Boolean(afterOpen.openedAt));

  await expectReject(
    "the sender can no longer recall after the organisation opened it",
    recallPreInquiry(citizen.id, inquiry.id, { expectedUpdatedAt: afterOpen.updatedAt }),
    (e) => e.status === 409
  );

  // --- 6. Määramine, vastuvõtt, üleandmine ------------------------------
  const assignment = await assignWork(coordCtx, item.id, { assigneeMembershipId: workerMembership.id });
  expect("work is assigned as PENDING", assignment.status === "PENDING");

  await expectReject(
    "a second live assignment on the same item is impossible",
    assignWork(coordCtx, item.id, { assigneeMembershipId: otherMembership.id }),
    (e) => e.status === 409
  );

  await respondToAssignment(coordCtx, assignment.id, { accept: true });
  const acceptedItem = await prisma.organizationInboxItem.findUnique({ where: { id: item.id } });
  expect("accepting the work moves the item to ACCEPTED", acceptedItem.status === "ACCEPTED");

  await setPrimaryUnit(org.id, otherMembership.id, { actorUserId: owner.id, unitId: teamA.id });
  const handover = await handOverWork(coordCtx, assignment.id, { toMembershipId: otherMembership.id });
  expect("handover creates a NEW assignment referencing the old one", handover.supersedesAssignmentId === assignment.id);
  const oldAssignment = await prisma.organizationWorkAssignment.findUnique({ where: { id: assignment.id } });
  expect("the previous assignment is closed, not deleted", oldAssignment.status === "HANDED_OVER");

  const newAssigneeCtx = await ctx(other.id, org.id);
  const handedItem = await getInboxItem(newAssigneeCtx, item.id);
  expect("the new responsible sees exactly the same package", handedItem.source?.situation === opened.source?.situation);
  expect(
    "handover did not widen the sharing scope",
    JSON.stringify(Object.keys(handedItem.source).sort()) ===
      JSON.stringify(Object.keys(opened.source).sort())
  );

  // --- 7. Offboarding ---------------------------------------------------
  await expectReject(
    "live work blocks leaving — work is never silently reassigned",
    endMembership(org.id, otherMembership.id, { actorUserId: owner.id }),
    (e) => e.messageKey === "org.errors.membership_has_live_work"
  );

  await respondToAssignment(newAssigneeCtx, handover.id, { accept: false, reason: "runtime" });
  await endMembership(org.id, otherMembership.id, { actorUserId: owner.id });
  const endedSeats = await prisma.organizationSeatAssignment.count({
    where: { membershipId: otherMembership.id, status: "ACTIVE" }
  });
  expect("leaving releases the seat", endedSeats === 0);

  // --- 8. Koha vabastamine ei puuduta liikmesust ------------------------
  const seat = await prisma.organizationSeatAssignment.findFirst({
    where: { membershipId: workerMembership.id, status: "ACTIVE" }
  });
  await releaseSeat(org.id, seat.id, { actorUserId: owner.id });
  const stillMember = await prisma.organizationMembership.findUnique({ where: { id: workerMembership.id } });
  expect("releasing a seat leaves the membership active", stillMember.status === "ACTIVE");
  const afterRelease = await ctx(worker.id, org.id);
  expect("payer falls back from ORGANIZATION when the seat ends", afterRelease.payerSource !== "ORGANIZATION");
  expect("capabilities survive losing the seat", hasCapability(afterRelease, "INBOX_COORDINATOR", { unitId: teamA.id }));

  expect("owner membership is intact", Boolean(ownerMembership));
}

async function cleanup() {
  console.log("\ncleanup");
  for (const organizationId of created.organizationIds) {
    await prisma.dataAuditLog.deleteMany({
      where: { action: { startsWith: "org." }, meta: { path: ["organizationId"], equals: organizationId } }
    });
    /* `OrganizationWorkAssignment.assignee` on TEADLIKULT `Restrict`: just see
       hoiab ära, et liikmesus (ja seega töö vastutaja) saaks vaikselt kaduda.
       Hind on see, et organisatsiooni PÄRIS kustutamine nõuab määramiste
       eemaldamist eraldi sammuna — see on õige järjekord, mitte takistus. */
    await prisma.organizationWorkAssignment.deleteMany({
      where: { inboxItem: { organizationId } }
    });
  }
  const inquiries = await prisma.preInquiry.deleteMany({
    where: { authorId: { in: created.userIds } }
  });
  const orgs = created.organizationIds.length
    ? await prisma.organization.deleteMany({ where: { id: { in: created.organizationIds } } })
    : { count: 0 };
  const users = created.userIds.length
    ? await prisma.user.deleteMany({ where: { id: { in: created.userIds } } })
    : { count: 0 };
  console.log(`  removed ${orgs.count} organisations, ${users.count} users, ${inquiries.count} pre-inquiries`);
  console.log(
    `  leftovers: ${await prisma.organization.count({ where: { displayName: { contains: MARK } } })} organisations, ` +
      `${await prisma.user.count({ where: { email: { endsWith: SUFFIX } } })} users`
  );
}

try {
  await main();
} catch (error) {
  failed += 1;
  console.error("\nUNCAUGHT", error);
} finally {
  await cleanup();
  await prisma.$disconnect();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
