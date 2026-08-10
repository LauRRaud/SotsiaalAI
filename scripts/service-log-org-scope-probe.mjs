#!/usr/bin/env node
/**
 * SOL-ORG-01 — üks töötaja, kaks maja, üks tööpäev.
 *
 *   npm run slog:org:probe
 *
 * MIDA SEE TÕENDAB, mida `npm test` ei saa. Olemasolevad ühiktestid
 * (`tests/serviceLog/visitOrigin.test.js`) mõõdavad filtri OTSUST fake-DB peal:
 * nad annavad ette read ja vaatavad, mida funktsioon nendega teeb. Nad EI SAA
 * öelda, kas päring päris PostgreSQL-i vastu filtreerib samamoodi, kas päritolu
 * jõuab kirjeni ja kas teda saab hiljem üle kirjutada. Fake ei valideeri —
 * seda õppetundi on selles projektis juba korra makstud.
 *
 * Kriteerium sõna-sõnalt: „HTTP/teenusetest peab kasutama üht töötajat kahes
 * organisatsioonis ning tõendama, et kummagi juht ei näe ega muuda teise
 * organisatsiooni ega isiklikke külastusi."
 *
 * Andmed: ainult `@sol-org.invalid` sünteetilised kontod; skript koristab lõpus.
 */

import prisma from "../lib/prisma.js";
import { assignVisit, reassignVisit } from "../lib/serviceLog/dispatchAssign.js";
import { getDispatchBoard } from "../lib/serviceLog/dispatchBoard.js";
import { resolveSelfAssignedOrganizationId } from "../lib/serviceLog/visitOrigin.js";
import { openRoute } from "../lib/serviceLog/dayRoute.js";

const SUFFIX = "@sol-org.invalid";
const MARK = "(org-sünteetiline)";
const ENV = { SERVICE_LOG_ENABLED: "1", SERVICE_LOG_DAY_ROUTE: "1" };
const NOW = new Date();
/* Geokodeerimine on väline register — sondi ei tohi hoida võõra teenuse käes. */
const NO_GEOCODE = async () => null;

let passed = 0;
let failed = 0;

const ok = (label) => { passed += 1; console.log(`  PASS  ${label}`); };
const bad = (label, detail) => { failed += 1; console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`); };
const expect = (label, cond, detail) => (cond ? ok(label) : bad(label, detail));

async function makeUser(local) {
  return prisma.user.create({
    data: { email: `${local}${SUFFIX}`, role: "SERVICE_PROVIDER", emailVerified: new Date() }
  });
}

/** Töötajal peab olema SOLO-profiil — päevateekond elab tema küljes. */
async function makeSoloProfile(owner) {
  return prisma.serviceProviderProfile.create({
    data: {
      ownerId: owner.id,
      ownershipMode: "SOLO",
      organizationName: `Osutaja ${MARK}`,
      status: "PUBLISHED"
    }
  });
}

async function makeOrg(name) {
  return prisma.organization.create({
    data: {
      displayName: `${name} ${MARK}`,
      legalKind: "COMPANY",
      status: "ACTIVE",
      /* DB CHECK: `ACTIVE` nõuab kinnitust. Sond peab sündima samadest
         reeglitest, mille all päris organisatsioon elab. */
      verifiedAt: NOW,
      activatedAt: NOW
    }
  });
}

/** Aktiivne liikmesus; `capability` antud korral kogu organisatsiooni skoobis. */
async function addMember(org, user, { capability = null } = {}) {
  const membership = await prisma.organizationMembership.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      status: "ACTIVE",
      seatRole: "SERVICE_PROVIDER"
    }
  });
  if (capability) {
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

function boardClients(board) {
  return (board.workers || []).flatMap((worker) => (worker.visits || []).map((visit) => visit.client));
}

async function purge() {
  const users = await prisma.user.findMany({ where: { email: { endsWith: SUFFIX } }, select: { id: true } });
  const userIds = users.map((row) => row.id);
  const profiles = await prisma.serviceProviderProfile.findMany({
    where: { organizationName: { contains: MARK } },
    select: { id: true }
  });
  const profileIds = profiles.map((row) => row.id);
  if (profileIds.length) {
    await prisma.serviceVisit.deleteMany({ where: { providerProfileId: { in: profileIds } } });
    await prisma.serviceWorkRoute.deleteMany({ where: { providerProfileId: { in: profileIds } } });
    await prisma.serviceProviderProfile.deleteMany({ where: { id: { in: profileIds } } });
  }
  await prisma.organization.deleteMany({ where: { displayName: { contains: MARK } } });
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function main() {
  console.log("SOL-ORG-01 — üks töötaja, kaks maja, üks tööpäev\n");
  await purge();

  const worker = await makeUser("worker");
  const standIn = await makeUser("standin");
  const managerA = await makeUser("manager-a");
  const managerB = await makeUser("manager-b");
  await makeSoloProfile(worker);
  await makeSoloProfile(standIn);

  const orgA = await makeOrg("A maja");
  const orgB = await makeOrg("B maja");

  await addMember(orgA, worker);
  await addMember(orgB, worker);
  await addMember(orgA, standIn);
  await addMember(orgA, managerA, { capability: "ORG_OWNER" });
  await addMember(orgB, managerB, { capability: "ORG_OWNER" });

  // === 1. PÄRITOLU SÜNNIB MÄÄRAMISEGA =====================================
  const visitA = await assignVisit(
    managerA.id,
    { organizationId: orgA.id, workerUserId: worker.id, clientDisplayName: `A maja klient ${MARK}` },
    { db: prisma, env: ENV, now: NOW, geocodeAddress: NO_GEOCODE }
  );
  const visitB = await assignVisit(
    managerB.id,
    { organizationId: orgB.id, workerUserId: worker.id, clientDisplayName: `B maja klient ${MARK}` },
    { db: prisma, env: ENV, now: NOW, geocodeAddress: NO_GEOCODE }
  );

  const rowA = await prisma.serviceVisit.findUnique({ where: { id: visitA.id } });
  const rowB = await prisma.serviceVisit.findUnique({ where: { id: visitB.id } });
  expect("määramine kirjutab päritolu kirje külge", rowA.assignedOrganizationId === orgA.id);
  expect("mõlemad tööd on SAMAL teekonnal — see ongi leiu tingimus", rowA.routeId === rowB.routeId, `${rowA.routeId} vs ${rowB.routeId}`);

  // === 2. ISIKLIK TÖÖ: kaks liikmesust = päritolu ei ole tõendatav =========
  const selfOrg = await resolveSelfAssignedOrganizationId(worker.id, { db: prisma });
  expect("kahes majas töötava inimese enda töö ei saa päritolu", selfOrg === null, String(selfOrg));

  const route = await openRoute(worker.id, { now: NOW }, { db: prisma });
  const personal = await prisma.serviceVisit.create({
    data: {
      providerProfileId: route.providerProfileId,
      routeId: route.id,
      ownerUserId: worker.id,
      assignedOrganizationId: selfOrg,
      clientDisplayName: `Isiklik klient ${MARK}`,
      status: "PLANNED",
      sortOrder: 99
    }
  });

  // === 3. KUMBKI JUHT EI NÄE TEISE MAJA EGA ISIKLIKKU TÖÖD ================
  const boardA = await getDispatchBoard(managerA.id, { organizationId: orgA.id }, { db: prisma, now: NOW });
  const boardB = await getDispatchBoard(managerB.id, { organizationId: orgB.id }, { db: prisma, now: NOW });
  const textA = JSON.stringify(boardA);
  const textB = JSON.stringify(boardB);

  expect("A juht näeb oma maja klienti", boardClients(boardA).some((name) => name?.startsWith("A maja klient")));
  expect("A juht EI näe B maja klienti", !textA.includes("B maja klient"));
  expect("A juht EI näe isiklikku klienti", !textA.includes("Isiklik klient"));
  expect("B juht näeb oma maja klienti", boardClients(boardB).some((name) => name?.startsWith("B maja klient")));
  expect("B juht EI näe A maja klienti", !textB.includes("A maja klient"));
  expect("B juht EI näe isiklikku klienti", !textB.includes("Isiklik klient"));
  /* Töötaja päev ON mõlemal tahvlil — see on tahtlik ja dokumenteeritud: juht
     peab teadma, kas tema liige on alustanud. Kliendi kohta ei ütle see midagi.
     Mõõdame just seda rida, mitte tahvli pikkust: juhid on ka ise oma maja
     liikmed ja ridade arv ei ütleks, KAS TÖÖTAJA seal on. */
  const workerRow = (board) => (board.workers || []).find((row) => row.name === worker.email) || null;
  expect(
    "töötaja päeva seis on mõlemal tahvlil nähtav",
    Boolean(workerRow(boardA)) && Boolean(workerRow(boardB)),
    `A=${Boolean(workerRow(boardA))} B=${Boolean(workerRow(boardB))}`
  );
  expect(
    "kummalgi tahvlil on tema päeval AINULT selle maja töö",
    (workerRow(boardA)?.visits || []).length === 1 && (workerRow(boardB)?.visits || []).length === 1,
    `A=${workerRow(boardA)?.visits?.length} B=${workerRow(boardB)?.visits?.length}`
  );

  // === 4. KUMBKI JUHT EI MUUDA TEISE MAJA EGA ISIKLIKKU TÖÖD ==============
  const rejects = async (label, run, status) => {
    try {
      await run();
      bad(label, "läks läbi");
    } catch (error) {
      expect(label, error?.status === status, `status=${error?.status}`);
    }
  };

  await rejects(
    "A juht ei saa B maja tööd ümber määrata (404, mitte 403)",
    () =>
      reassignVisit(
        managerA.id,
        { organizationId: orgA.id, visitId: visitB.id, toWorkerUserId: standIn.id },
        { db: prisma, env: ENV, now: NOW }
      ),
    404
  );
  await rejects(
    "A juht ei saa isiklikku tööd ümber määrata",
    () =>
      reassignVisit(
        managerA.id,
        { organizationId: orgA.id, visitId: personal.id, toWorkerUserId: standIn.id },
        { db: prisma, env: ENV, now: NOW }
      ),
    404
  );

  // === 5. OMA MAJA TÖÖ LIIGUB — JA PÄRITOLU EI LIIGU KAASA ================
  const moved = await reassignVisit(
    managerA.id,
    { organizationId: orgA.id, visitId: visitA.id, toWorkerUserId: standIn.id },
    { db: prisma, env: ENV, now: NOW }
  );
  const movedRow = await prisma.serviceVisit.findUnique({ where: { id: moved.id } });
  expect("oma maja töö liigub teisele inimesele", movedRow.ownerUserId === standIn.id);
  expect("päritolu EI liigu inimesega kaasa", movedRow.assignedOrganizationId === orgA.id);

  // === 6. PÄRITOLU ON MUUTUMATU — ANDMEBAASI OMA, MITTE LUBADUS ===========
  /* Migratsioon 20260810200000. Ilma selleta oleks „külmutatud loomise hetkel"
     kommentaar: üks `update` vales kohas viiks kliendi nime teise majja. */
  for (const [label, value] of [
    ["teise maja ID-ks", orgB.id],
    ["nulliks", null]
  ]) {
    try {
      await prisma.serviceVisit.update({
        where: { id: visitA.id },
        data: { assignedOrganizationId: value }
      });
      bad(`päritolu ei tohi saada muuta ${label}`, "andmebaas lubas");
    } catch (error) {
      expect(`päritolu ei saa muuta ${label}`, /frozen at creation/.test(String(error?.message)), String(error?.message).slice(0, 80));
    }
  }

  const afterAttempts = await prisma.serviceVisit.findUnique({ where: { id: visitA.id } });
  expect("katse järel on päritolu endine", afterAttempts.assignedOrganizationId === orgA.id);

  /* NEGATIIVKONTROLL: trigger tohib keelata ainult päritolu. Kui ta blokeeriks
     tavalise uuenduse, oleks kogu teenuspäevik lukus ja seda peab sond nägema. */
  const renamed = await prisma.serviceVisit.update({
    where: { id: visitA.id },
    data: { outcomeReason: `muudetud ${MARK}` }
  });
  expect("muud väljad on endiselt muudetavad", renamed.outcomeReason === `muudetud ${MARK}`);
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
