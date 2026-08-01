#!/usr/bin/env node
/**
 * T25 ORG-FOUNDATION-V1 — sünteetiline runtime-kontroll (E12).
 *
 * Käivita:
 *   node --import ./scripts/register-node-test-loader.mjs scripts/org-foundation-runtime-check.mjs
 *
 * Mida see tõendab, mida `npm test` EI SAA tõendada (fake-Prisma, elavat DB-d ei ole):
 *   - migratsioon rakendub ja osalised unikaalindeksid pidavad päriselt kinni;
 *   - CHECK-piirangud (skoobi XOR, sügavus, verifitseeritud aktiveerimine) töötavad;
 *   - tehingud on atomaarsed;
 *   - kahe organisatsiooni eraldatus kehtib PÄRIS päringute peal.
 *
 * ANDMED: ainult sünteetilised `@t25-runtime.invalid` kontod. Skript koristab
 * lõpus TÄPSELT need read, mille ta ise lõi — ja ainult need.
 */

import prisma from "../lib/prisma.js";
import { resolveOrgAccessContext, hasCapability } from "../lib/org/accessContext.js";
import { activateModule, changeOrganizationStatus, createOrganization } from "../lib/org/organizations.js";
import { createUnit } from "../lib/org/structure.js";
import { acceptInvite, createInvite } from "../lib/org/inviteService.js";
import { endMembership, grantCapability } from "../lib/org/members.js";

const ENV = { ORG_WORKSPACE_ENABLED: "1", ORG_CREATION_ENABLED: "1" };
const SUFFIX = "@t25-runtime.invalid";

let passed = 0;
let failed = 0;
const created = { userIds: [], organizationIds: [] };

function ok(label) {
  passed += 1;
  console.log(`  PASS  ${label}`);
}

function bad(label, detail) {
  failed += 1;
  console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
}

async function expectReject(label, promise, predicate) {
  try {
    await promise;
    bad(label, "expected a rejection, got success");
  } catch (error) {
    if (predicate && !predicate(error)) {
      bad(label, `wrong error: ${error?.messageKey || error?.code || error?.message}`);
      return;
    }
    ok(label);
  }
}

function expect(label, condition, detail) {
  if (condition) ok(label);
  else bad(label, detail);
}

async function makeUser(local, role) {
  const user = await prisma.user.create({
    data: { email: `${local}${SUFFIX}`, role, emailVerified: new Date() }
  });
  created.userIds.push(user.id);
  return user;
}

/**
 * Eelmise katkenud jooksu jäänused. Skript peab olema korduvkäivitatav ilma
 * käsitsi koristuseta — aga puutub AINULT sünteetilist nimeruumi.
 */
async function purgeStale() {
  const staleOrgs = await prisma.organization.findMany({
    where: { displayName: { contains: "(sünteetiline)" } },
    select: { id: true }
  });
  for (const organization of staleOrgs) {
    await prisma.dataAuditLog.deleteMany({
      where: { action: { startsWith: "org." }, meta: { path: ["organizationId"], equals: organization.id } }
    });
  }
  const orgs = await prisma.organization.deleteMany({
    where: { displayName: { contains: "(sünteetiline)" } }
  });
  const users = await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });
  if (orgs.count || users.count) {
    console.log(`  purged stale: ${orgs.count} organisations, ${users.count} users\n`);
  }
}

async function main() {
  console.log("T25 ORG-FOUNDATION-V1 synthetic runtime\n");
  await purgeStale();

  const alice = await makeUser("alice", "SOCIAL_WORKER");
  const bob = await makeUser("bob", "SOCIAL_WORKER");
  const mallory = await makeUser("mallory", "SERVICE_PROVIDER");

  // --- 1. Organisatsiooni loomine ja elutsükkel --------------------------
  const { organization: org1 } = await createOrganization({
    userId: alice.id,
    productRole: "SOCIAL_WORKER",
    displayName: "X vald (sünteetiline)",
    legalKind: "MUNICIPALITY"
  });
  created.organizationIds.push(org1.id);
  expect("organisation is created as DRAFT", org1.status === "DRAFT", org1.status);

  await expectReject(
    "DRAFT cannot jump straight to ACTIVE",
    changeOrganizationStatus(org1.id, { actorUserId: alice.id, isPlatformAdmin: true, toStatus: "ACTIVE" }),
    (error) => error.status === 409
  );

  await changeOrganizationStatus(org1.id, { actorUserId: alice.id, toStatus: "PENDING_VERIFICATION" });

  await expectReject(
    "a non-admin cannot verify their own organisation",
    changeOrganizationStatus(org1.id, { actorUserId: alice.id, isPlatformAdmin: false, toStatus: "ACTIVE" }),
    (error) => error.status === 403
  );

  await changeOrganizationStatus(org1.id, {
    actorUserId: alice.id,
    isPlatformAdmin: true,
    toStatus: "ACTIVE"
  });
  const activated = await prisma.organization.findUnique({ where: { id: org1.id } });
  expect("activation stamps the identity check", Boolean(activated.verifiedAt), "verifiedAt is null");

  // DB CHECK: ACTIVE ilma verifitseerimiseta peab olema võimatu ka toorpäringuga.
  await expectReject(
    "raw SQL cannot activate an unverified organisation (CHECK constraint)",
    prisma.$executeRawUnsafe(
      `UPDATE "Organization" SET "status" = 'ACTIVE', "verifiedAt" = NULL WHERE "id" = $1`,
      org1.id
    ),
    (error) => String(error?.message || "").includes("Organization_active_requires_verification_chk")
  );

  await activateModule(org1.id, { actorUserId: alice.id, moduleKey: "KOV_INTAKE" });

  await expectReject(
    "the same module cannot be activated twice",
    activateModule(org1.id, { actorUserId: alice.id, moduleKey: "KOV_INTAKE" }),
    (error) => error.status === 409
  );

  // --- 2. Struktuur -----------------------------------------------------
  const department = await createUnit(org1.id, {
    actorUserId: alice.id,
    name: "Sotsiaalosakond",
    type: "DEPARTMENT"
  });
  const teamA = await createUnit(org1.id, {
    actorUserId: alice.id,
    name: "Lastekaitse tiim",
    type: "TEAM",
    parentUnitId: department.id
  });
  const teamB = await createUnit(org1.id, {
    actorUserId: alice.id,
    name: "Toimetuleku tiim",
    type: "TEAM",
    parentUnitId: department.id
  });
  const level3 = await createUnit(org1.id, {
    actorUserId: alice.id,
    name: "Kolmas tasand",
    type: "TEAM",
    parentUnitId: teamA.id
  });
  expect("three levels are allowed", level3.depth === 3, `depth=${level3.depth}`);

  await expectReject(
    "a fourth level is rejected",
    createUnit(org1.id, {
      actorUserId: alice.id,
      name: "Neljas tasand",
      type: "TEAM",
      parentUnitId: level3.id
    }),
    (error) => error.messageKey === "org.errors.unit_depth_exceeded"
  );

  await expectReject(
    "raw SQL cannot exceed the depth limit either (CHECK constraint)",
    prisma.$executeRawUnsafe(`UPDATE "OrganizationUnit" SET "depth" = 4 WHERE "id" = $1`, level3.id),
    (error) => String(error?.message || "").includes("OrganizationUnit_depth_chk")
  );

  // --- 3. Kutsed --------------------------------------------------------
  const { invite, rawToken } = await createInvite(org1.id, {
    actorUserId: alice.id,
    email: bob.email,
    seatRole: "SOCIAL_WORKER",
    capabilityTemplate: "UNIT_LEAD",
    primaryUnitId: teamA.id
  });

  await expectReject(
    "a second pending invite to the same address is refused",
    createInvite(org1.id, {
      actorUserId: alice.id,
      email: bob.email,
      seatRole: "SOCIAL_WORKER",
      capabilityTemplate: "MEMBER"
    }),
    (error) => error.status === 409
  );

  await expectReject(
    "the wrong person cannot accept an invite",
    acceptInvite(rawToken, { userId: mallory.id, userEmail: mallory.email }),
    (error) => error.status === 404
  );

  await expectReject(
    "an unknown token is refused",
    acceptInvite("not-a-real-token", { userId: bob.id, userEmail: bob.email }),
    (error) => error.status === 404
  );

  const accepted = await acceptInvite(rawToken, { userId: bob.id, userEmail: bob.email });
  expect("the right person joins", Boolean(accepted.membership?.id));

  await expectReject(
    "the same token cannot be reused",
    acceptInvite(rawToken, { userId: bob.id, userEmail: bob.email }),
    (error) => error.status === 404
  );

  const inviteRow = await prisma.organizationInvite.findUnique({ where: { id: invite.id } });
  expect("only the hash is stored, never the token", inviteRow.tokenHash !== rawToken);

  // --- 4. Skoop ja isolatsioon -----------------------------------------
  const bobContext = await resolveOrgAccessContext(
    { userId: bob.id, requestedOrganizationId: org1.id, productRole: "SOCIAL_WORKER" },
    { env: ENV }
  );
  expect(
    "the template granted UNIT_LEAD on the invited unit",
    hasCapability(bobContext, "UNIT_LEAD", { unitId: teamA.id })
  );
  expect(
    "the unit scope reaches the subtree",
    hasCapability(bobContext, "UNIT_LEAD", { unitId: level3.id })
  );
  expect(
    "the unit scope does NOT reach the sibling team",
    !hasCapability(bobContext, "UNIT_LEAD", { unitId: teamB.id })
  );
  expect("a unit lead is not an owner", !hasCapability(bobContext, "ORG_OWNER"));
  expect("a unit lead cannot administer members", !hasCapability(bobContext, "MEMBER_ADMIN"));

  // Teine organisatsioon, sama inimene, teised õigused.
  const { organization: org2 } = await createOrganization({
    userId: bob.id,
    productRole: "SOCIAL_WORKER",
    displayName: "Y vald (sünteetiline)",
    legalKind: "MUNICIPALITY"
  });
  created.organizationIds.push(org2.id);

  const bobInOrg2 = await resolveOrgAccessContext(
    { userId: bob.id, requestedOrganizationId: org2.id, productRole: "SOCIAL_WORKER" },
    { env: ENV }
  );
  expect("the same person is an owner in the other organisation", hasCapability(bobInOrg2, "ORG_OWNER"));

  await expectReject(
    "org 1's owner cannot see org 2 at all",
    resolveOrgAccessContext(
      { userId: alice.id, requestedOrganizationId: org2.id, productRole: "SOCIAL_WORKER" },
      { env: ENV }
    ),
    (error) => error.status === 404
  );

  await expectReject(
    "a platform admin gets the same 404 through the organisation route",
    resolveOrgAccessContext(
      {
        userId: mallory.id,
        requestedOrganizationId: org1.id,
        isPlatformAdmin: true,
        productRole: "SOCIAL_WORKER"
      },
      { env: ENV }
    ),
    (error) => error.status === 404
  );

  await expectReject(
    "with the gate off even a real member gets 404",
    resolveOrgAccessContext(
      { userId: alice.id, requestedOrganizationId: org1.id, productRole: "SOCIAL_WORKER" },
      { env: {} }
    ),
    (error) => error.status === 404
  );

  // --- 5. Andmebaasi invariandid ---------------------------------------
  await expectReject(
    "a duplicate ACTIVE membership is impossible (partial unique index)",
    prisma.organizationMembership.create({
      data: { organizationId: org1.id, userId: bob.id, status: "ACTIVE", seatRole: "SOCIAL_WORKER" }
    }),
    (error) => error.code === "P2002"
  );

  await expectReject(
    "an organisation-scoped grant cannot carry a unit (CHECK constraint)",
    prisma.organizationCapabilityGrant.create({
      data: {
        membershipId: accepted.membership.id,
        capability: "AUDIT_VIEWER",
        scopeType: "ORGANIZATION",
        scopeUnitId: teamA.id
      }
    }),
    (error) => String(error?.message || "").includes("OrganizationCapabilityGrant_scope_xor_chk")
  );

  await expectReject(
    "ORG_OWNER cannot be narrowed to a unit",
    grantCapability(org1.id, accepted.membership.id, {
      actorUserId: alice.id,
      capability: "ORG_OWNER",
      scopeType: "UNIT",
      scopeUnitId: teamA.id
    }),
    (error) => error.messageKey === "org.errors.capability_requires_organization_scope"
  );

  // --- 6. Lahkumine ja offboarding -------------------------------------
  const aliceMembership = await prisma.organizationMembership.findFirst({
    where: { organizationId: org1.id, userId: alice.id, status: "ACTIVE" }
  });
  await expectReject(
    "the last owner cannot leave the organisation ownerless",
    endMembership(org1.id, aliceMembership.id, { actorUserId: alice.id }),
    (error) => error.messageKey === "org.errors.last_owner_cannot_leave"
  );

  await endMembership(org1.id, accepted.membership.id, { actorUserId: alice.id, reason: "runtime" });

  const endedGrants = await prisma.organizationCapabilityGrant.count({
    where: { membershipId: accepted.membership.id, revokedAt: null }
  });
  const endedUnits = await prisma.organizationMembershipUnit.count({
    where: { membershipId: accepted.membership.id, endedAt: null }
  });
  expect("offboarding revokes every capability", endedGrants === 0, `${endedGrants} still live`);
  expect("offboarding closes every unit assignment", endedUnits === 0, `${endedUnits} still open`);

  const bobStillExists = await prisma.user.findUnique({ where: { id: bob.id } });
  expect("the person's account survives leaving", Boolean(bobStillExists));

  const bobOtherOrg = await resolveOrgAccessContext(
    { userId: bob.id, requestedOrganizationId: org2.id, productRole: "SOCIAL_WORKER" },
    { env: ENV }
  );
  expect("leaving one organisation does not touch the other", bobOtherOrg.kind === "organization");

  await expectReject(
    "the ended membership no longer opens org 1",
    resolveOrgAccessContext(
      { userId: bob.id, requestedOrganizationId: org1.id, productRole: "SOCIAL_WORKER" },
      { env: ENV }
    ),
    (error) => error.status === 404
  );

  // --- 7. Audit ---------------------------------------------------------
  const auditRows = await prisma.dataAuditLog.findMany({
    where: { action: { startsWith: "org." }, meta: { path: ["organizationId"], equals: org1.id } }
  });
  expect("administrative actions are audited", auditRows.length >= 8, `${auditRows.length} rows`);
  const leaked = auditRows.filter((row) => JSON.stringify(row.meta || {}).includes(bob.email));
  expect("no audit row stores a full email address", leaked.length === 0, `${leaked.length} rows leak`);
}

async function cleanup() {
  console.log("\ncleanup");
  /* JSON-path filter ei toeta `in`-i — iga organisatsioon eraldi. */
  let auditCount = 0;
  for (const organizationId of created.organizationIds) {
    const removed = await prisma.dataAuditLog.deleteMany({
      where: { action: { startsWith: "org." }, meta: { path: ["organizationId"], equals: organizationId } }
    });
    auditCount += removed.count;
  }
  const auditDeleted = { count: auditCount };
  const orgDeleted = created.organizationIds.length
    ? await prisma.organization.deleteMany({ where: { id: { in: created.organizationIds } } })
    : { count: 0 };
  const userDeleted = created.userIds.length
    ? await prisma.user.deleteMany({ where: { id: { in: created.userIds } } })
    : { count: 0 };
  console.log(`  removed ${orgDeleted.count} organisations, ${userDeleted.count} users, ${auditDeleted.count} audit rows`);

  const strayOrgs = await prisma.organization.count({ where: { displayName: { contains: "(sünteetiline)" } } });
  const strayUsers = await prisma.user.count({ where: { email: { endsWith: SUFFIX } } });
  console.log(`  leftovers: ${strayOrgs} organisations, ${strayUsers} users`);
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
