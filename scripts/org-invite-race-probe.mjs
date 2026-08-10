#!/usr/bin/env node
/**
 * SOL-ORG-09 — tühistatud kutse ei anna õigusi, ka mitte ajastusega.
 *
 *   npm run org:invite:probe
 *
 * MIKS SEE ON RANGEM KUI SPONSORLUSE VÕISTLUS (SOL-ORG-06): siin ei ole
 * tagajärjeks ainult vale olek, vaid **liikmesus ja capability-grandid**.
 * Administraatori tühistamisotsus peab olema turvapiir, mitte ajastuse küsimus.
 *
 * LÕPPINVARIANT: `REVOKED` või `DECLINED` kutsel EI OLE sellest kutsest loodud
 * aktiivset liikmesust ega ühtki grandi. Seda mõõdetakse iga stsenaariumi järel.
 *
 * Andmed: ainult `@sol-invite.invalid` sünteetilised kontod; skript koristab lõpus.
 */

import prisma from "../lib/prisma.js";
import { acceptInvite, createInvite, declineInvite, revokeInvite } from "../lib/org/inviteService.js";
import { expectExactlyOneWinner, raceOnLockedRow } from "./probe-race-harness.mjs";

const SUFFIX = "@sol-invite.invalid";
const MARK = "(invite-sünteetiline)";
const NOW = new Date();

let passed = 0;
let failed = 0;
let seq = 0;

const ok = (label) => { passed += 1; console.log(`  PASS  ${label}`); };
const bad = (label, detail) => { failed += 1; console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`); };
const expect = (label, cond, detail) => (cond ? ok(label) : bad(label, detail));

async function makeUser(local) {
  seq += 1;
  return prisma.user.create({
    data: { email: `${local}-${seq}${SUFFIX}`, role: "SOCIAL_WORKER", emailVerified: NOW }
  });
}

/** Uus maja, administraator ja üks ootel kutse uuele inimesele. */
async function freshInvite() {
  const org = await prisma.organization.create({
    data: {
      displayName: `Kutsemaja ${MARK}`,
      legalKind: "COMPANY",
      status: "ACTIVE",
      verifiedAt: NOW,
      activatedAt: NOW
    }
  });
  const admin = await makeUser("admin");
  const invitee = await makeUser("invitee");
  /* `MEMBER_ADMIN` on TEADLIK valik: mall annab mitu grandi, seega „kutse ei
     tohi õigusi anda" on mõõdetav rohkem kui ühe rea peal. */
  const { invite, rawToken } = await createInvite(
    org.id,
    {
      actorUserId: admin.id,
      email: invitee.email,
      seatRole: "SOCIAL_WORKER",
      capabilityTemplate: "MEMBER_ADMIN"
    },
    { db: prisma, now: NOW }
  );

  return { org, admin, invitee, invite, rawToken };
}

/**
 * KOHERENTSUSKONTROLL: kutse olek ja väljaantud õigused peavad kirjeldama sama
 * sündmust. Just see paar läks vana koodiga lahku.
 */
async function assertCoherent(label, inviteId, orgId, userId) {
  const invite = await prisma.organizationInvite.findUnique({ where: { id: inviteId } });
  const membership = await prisma.organizationMembership.findFirst({
    where: { organizationId: orgId, userId, status: "ACTIVE" },
    select: { id: true }
  });
  const grants = membership
    ? await prisma.organizationCapabilityGrant.count({ where: { membershipId: membership.id } })
    : 0;

  if (invite.status === "ACCEPTED") {
    expect(`${label}: ACCEPTED kutse all ON aktiivne liikmesus`, Boolean(membership));
    expect(`${label}: liikmesusel on kutse mallist grandid`, grants > 0, `${grants}`);
  } else {
    expect(
      `${label}: ${invite.status} kutse all EI OLE aktiivset liikmesust`,
      !membership,
      JSON.stringify({ status: invite.status, membershipId: membership?.id })
    );
    expect(`${label}: ${invite.status} kutse all ei ole grante`, grants === 0, `${grants}`);
  }
  return invite;
}

async function purge() {
  const orgs = await prisma.organization.findMany({
    where: { displayName: { contains: MARK } },
    select: { id: true }
  });
  const orgIds = orgs.map((row) => row.id);
  if (orgIds.length) {
    await prisma.organizationInvite.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  }
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });
}

const lockInvite = (inviteId) => async (tx) => {
  await tx.$queryRaw`SELECT "id" FROM "OrganizationInvite" WHERE "id" = ${inviteId} FOR UPDATE`;
};

async function main() {
  console.log("SOL-ORG-09 — kutse võistlused päris PostgreSQL-is\n");
  await purge();

  // === 1. ACCEPT vs REVOKE, mõlemas ajastuses ============================
  for (const order of ["accept", "revoke"]) {
    const label = order === "accept" ? "accept→revoke" : "revoke→accept";
    const { org, admin, invitee, invite, rawToken } = await freshInvite();

    const accept = () =>
      acceptInvite(rawToken, { userId: invitee.id, userEmail: invitee.email }, { db: prisma, now: NOW });
    const revoke = () =>
      revokeInvite(org.id, invite.id, { actorUserId: admin.id }, { db: prisma, now: NOW });

    const { resultA, resultB } = await raceOnLockedRow({
      prisma,
      lockRow: lockInvite(invite.id),
      first: order === "accept" ? accept : revoke,
      second: order === "accept" ? revoke : accept,
      label,
      expect
    });
    expectExactlyOneWinner(expect, label, resultA, resultB);
    expect(`${label}: esimene võistleja võidab`, !resultA.error, String(resultA.error?.messageKey));

    const row = await assertCoherent(label, invite.id, org.id, invitee.id);
    expect(
      `${label}: lõppseis on ${order === "accept" ? "ACCEPTED" : "REVOKED"}`,
      row.status === (order === "accept" ? "ACCEPTED" : "REVOKED"),
      row.status
    );
  }

  // === 2. ACCEPT vs DECLINE, mõlemas ajastuses ===========================
  for (const order of ["accept", "decline"]) {
    const label = order === "accept" ? "accept→decline" : "decline→accept";
    const { org, invitee, invite, rawToken } = await freshInvite();

    const accept = () =>
      acceptInvite(rawToken, { userId: invitee.id, userEmail: invitee.email }, { db: prisma, now: NOW });
    const decline = () =>
      declineInvite(rawToken, { userId: invitee.id, userEmail: invitee.email }, { db: prisma, now: NOW });

    const { resultA, resultB } = await raceOnLockedRow({
      prisma,
      lockRow: lockInvite(invite.id),
      first: order === "accept" ? accept : decline,
      second: order === "accept" ? decline : accept,
      label,
      expect
    });
    expectExactlyOneWinner(expect, label, resultA, resultB);

    const row = await assertCoherent(label, invite.id, org.id, invitee.id);
    expect(
      `${label}: lõppseis on ${order === "accept" ? "ACCEPTED" : "DECLINED"}`,
      row.status === (order === "accept" ? "ACCEPTED" : "DECLINED"),
      row.status
    );
  }

  // === 3. REVOKE vs DECLINE — kolmas paar, mida keegi ei oota ============
  {
    const { org, admin, invitee, invite, rawToken } = await freshInvite();
    const { resultA, resultB } = await raceOnLockedRow({
      prisma,
      lockRow: lockInvite(invite.id),
      first: () => revokeInvite(org.id, invite.id, { actorUserId: admin.id }, { db: prisma, now: NOW }),
      second: () => declineInvite(rawToken, { userId: invitee.id, userEmail: invitee.email }, { db: prisma, now: NOW }),
      label: "revoke→decline",
      expect
    });
    expectExactlyOneWinner(expect, "revoke→decline", resultA, resultB);
    const row = await assertCoherent("revoke→decline", invite.id, org.id, invitee.id);
    expect("revoke→decline: lõppseis on REVOKED", row.status === "REVOKED", row.status);
  }

  // === 4. KORDUV ACCEPT ==================================================
  {
    const { org, invitee, invite, rawToken } = await freshInvite();
    const accept = () =>
      acceptInvite(rawToken, { userId: invitee.id, userEmail: invitee.email }, { db: prisma, now: NOW });

    const { resultA, resultB } = await raceOnLockedRow({
      prisma,
      lockRow: lockInvite(invite.id),
      first: accept,
      second: accept,
      label: "accept×2",
      expect
    });
    expectExactlyOneWinner(expect, "accept×2", resultA, resultB);
    await assertCoherent("accept×2", invite.id, org.id, invitee.id);

    const memberships = await prisma.organizationMembership.count({
      where: { organizationId: org.id, userId: invitee.id }
    });
    expect("accept×2: kaks vastuvõtmist ei tee kahte liikmesust", memberships === 1, `${memberships}`);
  }
}

async function cleanup() {
  console.log("\ncleanup");
  await purge();
  const leftUsers = await prisma.user.count({ where: { email: { endsWith: SUFFIX } } });
  const leftOrgs = await prisma.organization.count({ where: { displayName: { contains: MARK } } });
  console.log(`  leftovers: ${leftUsers} users, ${leftOrgs} organizations`);
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
