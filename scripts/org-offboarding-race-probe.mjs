#!/usr/bin/env node
/**
 * SOL-ORG-10 — lahkunuks märgitud inimesele ei jää tööd ega kohta.
 *
 *   npm run org:offboard:probe
 *
 * KAKS KÜSIMUST, ÜKS RIDA. Lahkumine küsib „kas sellel inimesel on veel elavat
 * tööd või kohta"; töö määramine ja koha andmine küsivad „kas see liikmesus on
 * veel aktiivne". Ilma ühise lukuta võisid mõlemad vastused olla korraga õiged
 * ja tulemus vale — lahkunuks märgitud inimesele jäi elav juhtum või makstav
 * koht, sest määramine oli aktiivsuse juba lugenud.
 *
 * NELJAS VÕISTLUS ON TEISEST RIDAST: kaks viimast omanikku lahkumas korraga on
 * eri liikmesustel, seega nende enda read ei pane neid järjekorda. Ainus ühine
 * rida on organisatsioon ise — ja ilma selleta võib maja jääda ilma ühegi
 * omanikuta ja muutuda parandamatuks.
 *
 * Andmed: ainult `@sol-offb.invalid` sünteetilised kontod; skript koristab lõpus.
 */

import prisma from "../lib/prisma.js";
import { endMembership } from "../lib/org/members.js";
import { assignSeat, createSeatPlan } from "../lib/org/seats.js";
import { assignWork, deliverPreInquiryToOrganization, handOverWork } from "../lib/org/inbox.js";
import { resolveOrgAccessContext } from "../lib/org/accessContext.js";
import { raceOnLockedRow } from "./probe-race-harness.mjs";

const SUFFIX = "@sol-offb.invalid";
const MARK = "(offb-sünteetiline)";
const NOW = new Date();
const ENV = { ORG_WORKSPACE_ENABLED: "1", ORG_INBOX_ENABLED: "1", ORG_SEATS_ENABLED: "1" };

let passed = 0;
let failed = 0;
let seq = 0;

const ok = (label) => { passed += 1; console.log(`  PASS  ${label}`); };
const bad = (label, detail) => { failed += 1; console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`); };
const expect = (label, cond, detail) => (cond ? ok(label) : bad(label, detail));

const lockMembership = (membershipId) => async (tx) => {
  await tx.$queryRaw`SELECT "id" FROM "OrganizationMembership" WHERE "id" = ${membershipId} FOR UPDATE`;
};
const lockOrganization = (organizationId) => async (tx) => {
  await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId} FOR UPDATE`;
};

async function makeUser(local) {
  seq += 1;
  return prisma.user.create({
    data: { email: `${local}-${seq}${SUFFIX}`, role: "SOCIAL_WORKER", emailVerified: NOW }
  });
}

async function addMember(org, user, capabilities = []) {
  const membership = await prisma.organizationMembership.create({
    data: { organizationId: org.id, userId: user.id, status: "ACTIVE", seatRole: "SOCIAL_WORKER" }
  });
  for (const capability of capabilities) {
    await prisma.organizationCapabilityGrant.create({
      data: {
        membershipId: membership.id,
        capability,
        scopeType: "ORGANIZATION",
        validFrom: new Date(NOW.getTime() - 60_000)
      }
    });
  }
  return membership;
}

/** Maja, kus on koordinaator-määraja, üks töötaja ja üks laual olev pöördumine. */
async function freshOrg({ withInbox = true } = {}) {
  const org = await prisma.organization.create({
    data: {
      displayName: `Lahkumismaja ${MARK}`,
      legalKind: "MUNICIPALITY",
      status: "ACTIVE",
      verifiedAt: NOW,
      activatedAt: NOW
    }
  });
  await prisma.organizationModule.create({
    data: {
      organizationId: org.id,
      moduleKey: "KOV_INTAKE",
      status: "ACTIVE",
      validFrom: new Date(NOW.getTime() - 60_000)
    }
  });

  const admin = await makeUser("admin");
  await addMember(org, admin, ["ORG_OWNER", "INBOX_COORDINATOR", "WORK_ASSIGNER", "MEMBER_ADMIN"]);
  const leaver = await makeUser("leaver");
  const leaverMembership = await addMember(org, leaver);
  const spare = await makeUser("spare");
  const spareMembership = await addMember(org, spare);

  let item = null;
  if (withInbox) {
    const author = await makeUser("author");
    const inquiry = await prisma.preInquiry.create({
      data: {
        authorId: author.id,
        recipientType: "ORGANIZATION_INBOX",
        recipientOrganizationId: org.id,
        situation: `Olukord ${MARK}`,
        status: "SENT",
        sentAt: NOW
      }
    });
    item = await deliverPreInquiryToOrganization(
      { preInquiryId: inquiry.id, organizationId: org.id },
      { db: prisma, now: NOW }
    );
  }

  return {
    org,
    admin,
    adminCtx: await resolveOrgAccessContext(
      { userId: admin.id, requestedOrganizationId: org.id },
      { db: prisma, env: ENV, now: NOW }
    ),
    leaverMembership,
    spareMembership,
    item
  };
}

/**
 * LÕPPINVARIANT: lahkunuks märgitud liikmesusel EI OLE elavat tööd ega
 * aktiivset kohta. Kui liikmesus on veel aktiivne, ei ole midagi keelatud.
 */
async function assertOffboardingCoherent(label, membershipId) {
  const membership = await prisma.organizationMembership.findUnique({ where: { id: membershipId } });
  const liveWork = await prisma.organizationWorkAssignment.count({
    where: { assigneeMembershipId: membershipId, status: { in: ["PENDING", "ACCEPTED"] } }
  });
  const liveSeats = await prisma.organizationSeatAssignment.count({
    where: { membershipId, status: "ACTIVE" }
  });

  if (membership.status === "ENDED") {
    expect(`${label}: lahkunul ei ole elavat tööd`, liveWork === 0, `${liveWork}`);
    expect(`${label}: lahkunul ei ole aktiivset kohta`, liveSeats === 0, `${liveSeats}`);
  } else {
    ok(`${label}: liikmesus jäi aktiivseks (lahkumine ei õnnestunud) — invariant ei kehti veel`);
  }
  return membership;
}

async function purge() {
  const orgs = await prisma.organization.findMany({
    where: { displayName: { contains: MARK } },
    select: { id: true }
  });
  const orgIds = orgs.map((row) => row.id);
  if (orgIds.length) {
    const items = await prisma.organizationInboxItem.findMany({
      where: { organizationId: { in: orgIds } },
      select: { id: true }
    });
    const itemIds = items.map((row) => row.id);
    if (itemIds.length) {
      await prisma.organizationWorkAssignment.deleteMany({ where: { inboxItemId: { in: itemIds } } });
      await prisma.organizationInboxItem.deleteMany({ where: { id: { in: itemIds } } });
    }
    const plans = await prisma.organizationSeatPlan.findMany({
      where: { organizationId: { in: orgIds } },
      select: { id: true }
    });
    const planIds = plans.map((row) => row.id);
    if (planIds.length) {
      await prisma.organizationSeatAssignment.deleteMany({ where: { seatPlanId: { in: planIds } } });
      await prisma.organizationSeatPlan.deleteMany({ where: { id: { in: planIds } } });
    }
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  }
  await prisma.preInquiry.deleteMany({ where: { situation: { contains: MARK } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });
}

async function main() {
  console.log("SOL-ORG-10 — lahkumine vs uus töö ja koht\n");
  await purge();

  // === 1. endMembership vs assignWork, mõlemas ajastuses ==================
  for (const order of ["end", "assign"]) {
    const label = order === "end" ? "end→assign" : "assign→end";
    const { org, admin, adminCtx, leaverMembership, item } = await freshOrg();

    const end = () =>
      endMembership(org.id, leaverMembership.id, { actorUserId: admin.id }, { db: prisma, now: NOW });
    const assign = () =>
      assignWork(adminCtx, item.id, { assigneeMembershipId: leaverMembership.id }, { db: prisma, now: NOW });

    const { resultA, resultB } = await raceOnLockedRow({
      prisma,
      lockRow: lockMembership(leaverMembership.id),
      first: order === "end" ? end : assign,
      second: order === "end" ? assign : end,
      label,
      expect
    });
    expect(`${label}: esimene võistleja õnnestub`, !resultA.error, String(resultA.error?.messageKey));
    if (order === "end") {
      expect(
        `${label}: lahkunule ei saa enam tööd määrata`,
        resultB.error?.messageKey === "org.errors.membership_not_found",
        String(resultB.error?.messageKey || resultB.value?.id)
      );
    } else {
      /* SEE ON LEID ISE: elava tööga inimest ei saa vaikselt lahkunuks märkida. */
      expect(
        `${label}: elava tööga inimene ei saa lahkuda`,
        resultB.error?.messageKey === "org.errors.membership_has_live_work",
        String(resultB.error?.messageKey || resultB.value?.status)
      );
    }
    await assertOffboardingCoherent(label, leaverMembership.id);
  }

  // === 2. endMembership vs handover ======================================
  /* Üleandmine on määramine teise nimega — ja lahkuja võib olla ka SAAJA. */
  for (const order of ["end", "handover"]) {
    const label = order === "end" ? "end→handover" : "handover→end";
    const { org, admin, adminCtx, leaverMembership, spareMembership, item } = await freshOrg();
    const assignment = await assignWork(
      adminCtx,
      item.id,
      { assigneeMembershipId: spareMembership.id },
      { db: prisma, now: NOW }
    );

    const end = () =>
      endMembership(org.id, leaverMembership.id, { actorUserId: admin.id }, { db: prisma, now: NOW });
    const handover = () =>
      handOverWork(adminCtx, assignment.id, { toMembershipId: leaverMembership.id }, { db: prisma, now: NOW });

    const { resultA, resultB } = await raceOnLockedRow({
      prisma,
      lockRow: lockMembership(leaverMembership.id),
      first: order === "end" ? end : handover,
      second: order === "end" ? handover : end,
      label,
      expect
    });
    expect(`${label}: esimene võistleja õnnestub`, !resultA.error, String(resultA.error?.messageKey));
    if (order === "end") {
      expect(
        `${label}: lahkunule ei saa tööd üle anda`,
        resultB.error?.messageKey === "org.errors.membership_not_found",
        String(resultB.error?.messageKey || resultB.value?.id)
      );
    } else {
      expect(
        `${label}: äsja saadud tööga ei saa lahkuda`,
        resultB.error?.messageKey === "org.errors.membership_has_live_work",
        String(resultB.error?.messageKey || resultB.value?.status)
      );
    }
    await assertOffboardingCoherent(label, leaverMembership.id);
  }

  // === 3. endMembership vs assignSeat ====================================
  for (const order of ["end", "seat"]) {
    const label = order === "end" ? "end→seat" : "seat→end";
    const { org, admin, leaverMembership } = await freshOrg({ withInbox: false });
    const plan = await createSeatPlan(
      org.id,
      { actorUserId: admin.id, seatRole: "SOCIAL_WORKER", seatLimit: 5 },
      { db: prisma }
    );

    const end = () =>
      endMembership(org.id, leaverMembership.id, { actorUserId: admin.id }, { db: prisma, now: NOW });
    const seat = () =>
      assignSeat(
        org.id,
        { actorUserId: admin.id, seatPlanId: plan.id, membershipId: leaverMembership.id },
        { db: prisma }
      );

    const { resultA, resultB } = await raceOnLockedRow({
      prisma,
      lockRow: lockMembership(leaverMembership.id),
      first: order === "end" ? end : seat,
      second: order === "end" ? seat : end,
      label,
      expect
    });
    expect(`${label}: esimene võistleja õnnestub`, !resultA.error, String(resultA.error?.messageKey));
    if (order === "end") {
      expect(
        `${label}: lahkunule ei anta enam kohta`,
        resultB.error?.messageKey === "org.errors.membership_not_active",
        String(resultB.error?.messageKey || resultB.value?.id)
      );
    } else {
      /* Koht EI BLOKEERI lahkumist, ta lõpetatakse — ja see peab olema tõendatud
         lõppseisus, mitte loodetud. */
      expect(`${label}: lahkumine õnnestub ka äsja antud kohaga`, !resultB.error, String(resultB.error?.messageKey));
    }
    await assertOffboardingCoherent(label, leaverMembership.id);
  }

  // === 4. KAKS VIIMAST OMANIKKU LAHKUMAS KORRAGA =========================
  {
    const { org, admin } = await freshOrg({ withInbox: false });
    const secondOwner = await makeUser("owner-2");
    const secondOwnerMembership = await addMember(org, secondOwner, ["ORG_OWNER"]);
    const adminMembership = await prisma.organizationMembership.findFirst({
      where: { organizationId: org.id, userId: admin.id },
      select: { id: true }
    });

    const { resultA, resultB } = await raceOnLockedRow({
      prisma,
      lockRow: lockOrganization(org.id),
      first: () => endMembership(org.id, adminMembership.id, { actorUserId: admin.id }, { db: prisma, now: NOW }),
      second: () =>
        endMembership(org.id, secondOwnerMembership.id, { actorUserId: secondOwner.id }, { db: prisma, now: NOW }),
      label: "owner×2",
      expect
    });

    const winners = [resultA, resultB].filter((result) => !result.error).length;
    expect("owner×2: täpselt üks omanik saab lahkuda", winners === 1, `lahkujaid ${winners}`);
    expect(
      "owner×2: teine saab vastuse „viimane omanik ei saa lahkuda'",
      resultB.error?.messageKey === "org.errors.last_owner_cannot_leave",
      String(resultB.error?.messageKey)
    );

    const owners = await prisma.organizationCapabilityGrant.count({
      where: {
        capability: "ORG_OWNER",
        revokedAt: null,
        membership: { organizationId: org.id, status: "ACTIVE" }
      }
    });
    expect("owner×2: majja jääb vähemalt üks aktiivne omanik", owners >= 1, `${owners}`);
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
