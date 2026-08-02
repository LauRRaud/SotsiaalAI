#!/usr/bin/env node
/**
 * T25 ORG-PROFILE-SUPPORT-V1 — sünteetiline runtime-kontroll (E12).
 *
 *   node --conditions=react-server --import ./scripts/register-node-test-loader.mjs \
 *        scripts/org-profile-support-runtime-check.mjs
 *
 * `--conditions=react-server` on KOHUSTUSLIK: skript impordib
 * `lib/serviceProviderProfiles.js`, mis toob kaasa `server-only` paketi. See
 * pakett VISKAB, kui teda laaditakse ilma serverikonditsioonita — ja just see
 * import on siin vajalik, sest me tõendame PÄRIS solo-raja funktsiooniga
 * (`getServiceProviderProfileForOwner`), mitte selle koopiaga.
 *
 * Tõendab viilu C kolme raskeimat kohta:
 *   1. tööheaolu toeavalduse PRIVAATSUSPIIR (saaja ei jõua lähtekirjeni);
 *   2. teenuseprofiili omandirežiimi migratsioon (solo jääb tööle, konto
 *      kustutamine ei hävita org-profiili);
 *   3. tugikontaktide ja juhiseose invariandid.
 */

import prisma from "../lib/prisma.js";
import { resolveOrgAccessContext } from "../lib/org/accessContext.js";
import { activateModule, changeOrganizationStatus, createOrganization } from "../lib/org/organizations.js";
import { grantCapability } from "../lib/org/members.js";
import { acceptInvite, createInvite } from "../lib/org/inviteService.js";
import {
  addSupportContact,
  assertAlternateSupportExists,
  endSupportContact,
  listSupportRecipients,
  setReportingLine
} from "../lib/org/support.js";
import {
  closeSupportShare,
  correctSupportShare,
  listReceivedSupportShares,
  openSupportShare,
  recallSupportShare,
  sanitizeSnapshot,
  sendSupportShare,
  toRecipientView
} from "../lib/org/supportShare.js";
import { convertProfileToOrganization, toPublicProfileProjection } from "../lib/org/serviceProfile.js";
import { getServiceProviderProfileForOwner } from "../lib/serviceProviderProfiles.js";

const ENV = {
  ORG_WORKSPACE_ENABLED: "1",
  ORG_CREATION_ENABLED: "1",
  ORG_SEATS_ENABLED: "1",
  ORG_INBOX_ENABLED: "1"
};
Object.assign(process.env, ENV);

const SUFFIX = "@t25-prof.invalid";
const MARK = "(prof-sünteetiline)";

let passed = 0;
let failed = 0;
const created = { userIds: [], organizationIds: [], profileIds: [] };

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
    data: { email: `${local}${SUFFIX}`, role, emailVerified: new Date() }
  });
  created.userIds.push(user.id);
  return user;
}

const ctx = (userId, organizationId) =>
  resolveOrgAccessContext(
    { userId, requestedOrganizationId: organizationId, productRole: "SOCIAL_WORKER" },
    { env: ENV }
  );

async function purgeStale() {
  const orgs = await prisma.organization.findMany({
    where: { displayName: { contains: MARK } },
    select: { id: true }
  });
  for (const org of orgs) {
    await prisma.dataAuditLog.deleteMany({
      where: { action: { startsWith: "org." }, meta: { path: ["organizationId"], equals: org.id } }
    });
    await prisma.notificationEvent.deleteMany({ where: { workspaceId: org.id } });
  }
  await prisma.serviceProviderProfile.deleteMany({ where: { owner: { email: { endsWith: SUFFIX } } } });
  await prisma.organization.deleteMany({ where: { displayName: { contains: MARK } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });
}

async function main() {
  console.log("T25 ORG-PROFILE-SUPPORT-V1 synthetic runtime\n");
  await purgeStale();

  const owner = await makeUser("owner", "SERVICE_PROVIDER");
  const worker = await makeUser("worker", "SOCIAL_WORKER");
  const manager = await makeUser("manager", "SOCIAL_WORKER");
  const helper = await makeUser("helper", "SOCIAL_WORKER");
  const outsider = await makeUser("outsider", "SOCIAL_WORKER");

  const { organization: org } = await createOrganization({
    userId: owner.id,
    productRole: "SERVICE_PROVIDER",
    displayName: `Y teenus ${MARK}`,
    legalKind: "COMPANY"
  });
  created.organizationIds.push(org.id);
  await changeOrganizationStatus(org.id, { actorUserId: owner.id, toStatus: "PENDING_VERIFICATION" });
  await changeOrganizationStatus(org.id, { actorUserId: owner.id, isPlatformAdmin: true, toStatus: "ACTIVE" });
  await activateModule(org.id, { actorUserId: owner.id, moduleKey: "PROFESSIONAL_SUPPORT" });
  await activateModule(org.id, { actorUserId: owner.id, moduleKey: "SERVICE_DELIVERY" });

  const memberships = {};
  for (const [key, user] of [["worker", worker], ["manager", manager], ["helper", helper]]) {
    const invite = await createInvite(org.id, {
      actorUserId: owner.id,
      email: user.email,
      seatRole: "SOCIAL_WORKER",
      capabilityTemplate: "MEMBER"
    });
    const joined = await acceptInvite(invite.rawToken, { userId: user.id, userEmail: user.email });
    memberships[key] = joined.membership;
  }
  const ownerMembership = await prisma.organizationMembership.findFirst({
    where: { organizationId: org.id, userId: owner.id, status: "ACTIVE" }
  });

  // --- 1. Juhiseos ja tugikontaktid -------------------------------------
  await expectReject(
    "nobody can be their own manager",
    setReportingLine(org.id, {
      actorUserId: owner.id,
      memberMembershipId: memberships.worker.id,
      managerMembershipId: memberships.worker.id
    }),
    (e) => e.messageKey === "org.errors.reporting_self"
  );

  await setReportingLine(org.id, {
    actorUserId: owner.id,
    memberMembershipId: memberships.worker.id,
    managerMembershipId: memberships.manager.id
  });

  await expectReject(
    "the professional-support module demands an alternate route",
    assertAlternateSupportExists(org.id),
    (e) => e.messageKey === "org.errors.alternate_support_required"
  );

  const alternate = await addSupportContact(org.id, {
    actorUserId: owner.id,
    membershipId: memberships.helper.id,
    contactType: "ALTERNATE_SUPPORT"
  });
  expect("an alternate support route can be added", Boolean(alternate));
  await assertAlternateSupportExists(org.id);
  ok("the alternate-support gate passes once a route exists");

  await expectReject(
    "the LAST alternate route cannot be removed while the module is active",
    endSupportContact(org.id, alternate.id, { actorUserId: owner.id }),
    (e) => e.messageKey === "org.errors.last_alternate_support"
  );

  const recipients = await listSupportRecipients(org.id, memberships.worker.id);
  expect(
    "the worker is offered BOTH the manager and the alternate route",
    recipients.some((r) => r.contactType === "DIRECT_MANAGER") &&
      recipients.some((r) => r.contactType === "ALTERNATE_SUPPORT"),
    JSON.stringify(recipients.map((r) => r.contactType))
  );

  // --- 2. Toeavaldus: privaatsuspiir ------------------------------------
  await expectReject(
    "a share without explicit confirmation is refused",
    sendSupportShare({
      ownerUserId: worker.id,
      organizationId: org.id,
      recipientMembershipId: memberships.manager.id,
      snapshot: { summary: "x" },
      userConfirmed: false
    }),
    (e) => e.messageKey === "org.errors.share_requires_confirmation"
  );

  await expectReject(
    "a share to an arbitrary colleague is refused — support is not a message rail",
    sendSupportShare({
      ownerUserId: worker.id,
      organizationId: org.id,
      recipientMembershipId: ownerMembership.id,
      snapshot: { summary: "x" },
      userConfirmed: true
    }),
    (e) => e.messageKey === "org.errors.share_recipient_not_allowed"
  );

  /* Snapshot'i valge nimekiri: skoorimisväljad EI TOHI läbi minna. */
  const sanitized = sanitizeSnapshot({
    summary: "Vajan töökorralduslikku tuge.",
    needs: ["fookusaeg", "asendus"],
    computedSignal: { red: 3 },
    riskMarkers: ["burnout"],
    loadFactors: { hours: 60 }
  });
  expect(
    "the snapshot whitelist drops every scoring field",
    !("computedSignal" in sanitized) && !("riskMarkers" in sanitized) && !("loadFactors" in sanitized),
    JSON.stringify(Object.keys(sanitized))
  );

  const { share, recipientUserId } = await sendSupportShare({
    ownerUserId: worker.id,
    organizationId: org.id,
    recipientMembershipId: memberships.manager.id,
    snapshot: {
      summary: "Vajan töökorralduslikku tuge.",
      needs: ["fookusaeg"],
      computedSignal: { red: 3 }
    },
    userConfirmed: true,
    sourceRecordId: "wb_record_synthetic",
    sourceDraftId: "wb_draft_synthetic"
  });
  expect("the share reaches the chosen recipient", recipientUserId === manager.id);

  const stored = await prisma.wellbeingSupportShare.findUnique({ where: { id: share.id } });
  expect(
    "the stored snapshot contains no scoring field",
    !JSON.stringify(stored.sharedSnapshotJson).includes("computedSignal")
  );

  const recipientView = toRecipientView(stored);
  const viewBlob = JSON.stringify(recipientView);
  expect("the recipient view hides the source record id", !viewBlob.includes("wb_record_synthetic"));
  expect("the recipient view hides the source draft id", !viewBlob.includes("wb_draft_synthetic"));
  expect("the recipient view hides the owner", !viewBlob.includes(worker.id));

  const received = await listReceivedSupportShares(memberships.manager.id);
  expect("the recipient sees exactly one share", received.length === 1);
  expect(
    "the recipient list is also free of source references",
    !JSON.stringify(received).includes("wb_record_synthetic")
  );

  const othersInbox = await listReceivedSupportShares(memberships.helper.id);
  expect("a different support contact sees nothing", othersInbox.length === 0);

  /* Organisatsioon ei näe vormi KASUTAMISE fakti — ainult talle saadetut. */
  const orgWide = await prisma.wellbeingSupportShare.count({ where: { organizationId: org.id } });
  expect("only the sent share exists org-wide", orgWide === 1);

  // --- 3. Toeavalduse elutsükkel ---------------------------------------
  const opened = await openSupportShare(share.id, { recipientMembershipId: memberships.manager.id });
  expect("opening stamps openedAt", Boolean(opened.openedAt));

  await expectReject(
    "after opening, recall is no longer possible",
    recallSupportShare(share.id, { ownerUserId: worker.id }),
    (e) => e.messageKey === "org.errors.support_share_already_opened"
  );

  const correction = await correctSupportShare(share.id, {
    ownerUserId: worker.id,
    snapshot: { summary: "Täpsustan: vajan asendust kahel päeval." },
    userConfirmed: true
  });
  expect("a correction is a NEW share pointing at the original", correction.supersedesShareId === share.id);
  const originalAfter = await prisma.wellbeingSupportShare.findUnique({ where: { id: share.id } });
  expect("the original is marked CORRECTED, not rewritten", originalAfter.status === "CORRECTED");
  expect(
    "the original snapshot text is untouched",
    JSON.stringify(originalAfter.sharedSnapshotJson).includes("töökorralduslikku")
  );

  await closeSupportShare(correction.id, {
    recipientMembershipId: memberships.manager.id,
    actorUserId: manager.id
  });
  const closed = await prisma.wellbeingSupportShare.findUnique({ where: { id: correction.id } });
  expect("the recipient can close the share", closed.status === "CLOSED");

  /* Teine avaldus, mis jääb avamata — tõendame tagasivõtmist ENNE avamist. */
  const second = await sendSupportShare({
    ownerUserId: worker.id,
    organizationId: org.id,
    recipientMembershipId: memberships.helper.id,
    snapshot: { summary: "Teine avaldus tagasivõtmise kontrolliks." },
    userConfirmed: true
  });
  const recalled = await recallSupportShare(second.share.id, { ownerUserId: worker.id });
  expect("an unopened share can be recalled", recalled.status === "RECALLED");
  const afterRecall = await listReceivedSupportShares(memberships.helper.id);
  expect("a recalled share disappears from the recipient's list", afterRecall.length === 0);

  await expectReject(
    "a recalled share cannot be opened",
    openSupportShare(second.share.id, { recipientMembershipId: memberships.helper.id }),
    (e) => e.status === 404
  );

  // --- 4. Teenuseprofiil: migratsioon ei lõhkunud solo-rada -------------
  const soloProfile = await prisma.serviceProviderProfile.create({
    data: { ownerId: outsider.id, organizationName: `Solo ${MARK}`, ownershipMode: "SOLO" }
  });
  created.profileIds.push(soloProfile.id);
  const fetched = await getServiceProviderProfileForOwner(outsider.id);
  expect("an existing solo profile still loads after the migration", fetched?.id === soloProfile.id);
  expect("a solo profile has no organisation", fetched?.organizationId === null);
  expect("a solo profile defaults to SOLO mode", fetched?.ownershipMode === "SOLO");

  const ownerProfile = await prisma.serviceProviderProfile.create({
    data: { ownerId: owner.id, organizationName: `Y teenus ${MARK}`, ownershipMode: "SOLO", publicSlug: `y-teenus-${owner.id.slice(-8)}` }
  });
  created.profileIds.push(ownerProfile.id);

  const ownerCtx = await ctx(owner.id, org.id);
  await expectReject(
    "conversion refuses without the profile owner's confirmation",
    convertProfileToOrganization(ownerCtx, { profileId: ownerProfile.id, ownerConfirmed: false }),
    (e) => e.messageKey === "org.errors.profile_owner_confirmation_required"
  );

  const workerCtx = await ctx(worker.id, org.id);
  await expectReject(
    "conversion refuses without ORG_OWNER",
    convertProfileToOrganization(workerCtx, { profileId: ownerProfile.id, ownerConfirmed: true }),
    (e) => e.status === 403
  );

  const converted = await convertProfileToOrganization(ownerCtx, {
    profileId: ownerProfile.id,
    ownerConfirmed: true
  });
  expect("the profile now belongs to the organisation", converted.ownershipMode === "ORGANIZATION");
  expect("the public slug survives conversion", converted.publicSlug === ownerProfile.publicSlug);
  expect("the creator stays recorded as provenance", converted.ownerId === owner.id);

  const publicView = toPublicProfileProjection(converted);
  expect(
    "the public projection leaks neither ownership mode nor organisation id",
    !("ownershipMode" in publicView) && !("organizationId" in publicView)
  );

  /* Sama inimene saab pärast üleandmist teha uue SOLO-profiili: osaline
     unikaalindeks kehtib ainult SOLO-režiimis. */
  const newSolo = await prisma.serviceProviderProfile.create({
    data: { ownerId: owner.id, organizationName: `Uus solo ${MARK}`, ownershipMode: "SOLO" }
  });
  created.profileIds.push(newSolo.id);
  ok("the former owner can create a fresh solo profile afterwards");

  await expectReject(
    "two SOLO profiles for one owner are impossible",
    prisma.serviceProviderProfile.create({
      data: { ownerId: owner.id, organizationName: `Kolmas ${MARK}`, ownershipMode: "SOLO" }
    }),
    (e) => e.code === "P2002"
  );

  await expectReject(
    "a SOLO profile cannot carry an organisation (CHECK constraint)",
    prisma.serviceProviderProfile.create({
      data: {
        ownerId: helper.id,
        organizationName: `Vigane ${MARK}`,
        ownershipMode: "SOLO",
        organizationId: org.id
      }
    }),
    (e) => String(e?.message || "").includes("ServiceProviderProfile_ownership_chk")
  );

  /* KÕIGE OLULISEM E8 TÕEND: konto kustutamine EI HÄVITA org-profiili.
     Enne seda viilu oli seos Cascade ja profiil kadus koos kontoga. */
  const profileIdBeforeDelete = converted.id;
  await prisma.user.delete({ where: { id: owner.id } });
  created.userIds = created.userIds.filter((id) => id !== owner.id);
  const survivor = await prisma.serviceProviderProfile.findUnique({
    where: { id: profileIdBeforeDelete }
  });
  expect("the organisation profile SURVIVES the creator's account deletion", Boolean(survivor));
  expect("its owner reference is cleared, not dangling", survivor?.ownerId === null);
  expect("it still belongs to the organisation", survivor?.organizationId === org.id);
}

async function cleanup() {
  console.log("\ncleanup");
  for (const organizationId of created.organizationIds) {
    await prisma.dataAuditLog.deleteMany({
      where: { action: { startsWith: "org." }, meta: { path: ["organizationId"], equals: organizationId } }
    });
    await prisma.notificationEvent.deleteMany({ where: { workspaceId: organizationId } });
    await prisma.serviceProviderProfile.deleteMany({ where: { organizationId } });
  }
  await prisma.notificationEvent.deleteMany({ where: { userId: { in: created.userIds } } });
  const profiles = await prisma.serviceProviderProfile.deleteMany({
    where: { OR: [{ id: { in: created.profileIds } }, { organizationName: { contains: MARK } }] }
  });
  const orgs = created.organizationIds.length
    ? await prisma.organization.deleteMany({ where: { id: { in: created.organizationIds } } })
    : { count: 0 };
  const users = await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });
  console.log(`  removed ${orgs.count} organisations, ${users.count} users, ${profiles.count} profiles`);
  console.log(
    `  leftovers: ${await prisma.organization.count({ where: { displayName: { contains: MARK } } })} organisations, ` +
      `${await prisma.serviceProviderProfile.count({ where: { organizationName: { contains: MARK } } })} profiles, ` +
      `${await prisma.wellbeingSupportShare.count()} support shares`
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
