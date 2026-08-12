#!/usr/bin/env node
/**
 * SOL-SLOG-19…20 — aktiivse külastuse ja päeva sulgemise päris-DB võistlussond.
 *
 *   npm run slog:route-race:probe
 *
 * Fake-prisma ei suuda tõendada PostgreSQL-i `FOR UPDATE` järjekorda. Sond
 * kasutab ainult `@slog-route-race.invalid` sünteetilist kontot ja koristab
 * kõik enda read lõpus.
 */

import prisma from "../lib/prisma.js";
import { closeRoute, transitionVisit } from "../lib/serviceLog/dayRoute.js";

const SUFFIX = "@slog-route-race.invalid";
const MARK = "(slog-route-race-sünteetiline)";
const ENV = { SERVICE_LOG_ENABLED: "1", SERVICE_LOG_DAY_ROUTE: "1" };
const NOW = new Date("2026-08-12T12:00:00.000Z");

let passed = 0;
let failed = 0;

function expect(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function split(results) {
  return {
    fulfilled: results.filter((result) => result.status === "fulfilled"),
    rejected: results.filter((result) => result.status === "rejected")
  };
}

async function purge() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: SUFFIX } },
    select: { id: true }
  });
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
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function makeRoute(profile, owner, offset) {
  return prisma.serviceWorkRoute.create({
    data: {
      providerProfileId: profile.id,
      workerUserId: owner.id,
      date: new Date(NOW.getTime() + offset * 86_400_000),
      status: "OPEN",
      startedAt: new Date(NOW.getTime() + offset * 86_400_000)
    }
  });
}

async function makeVisit(profile, owner, route, name) {
  return prisma.serviceVisit.create({
    data: {
      providerProfileId: profile.id,
      routeId: route.id,
      ownerUserId: owner.id,
      clientDisplayName: `${name} ${MARK}`,
      status: "PLANNED"
    }
  });
}

/** Järgmise stsenaariumi jaoks lõpetab ainult sondi enda eelmise route'i. */
async function retireRoute(routeId) {
  await prisma.$transaction([
    prisma.serviceVisit.updateMany({
      where: { routeId, status: { in: ["EN_ROUTE", "ARRIVED"] } },
      data: { status: "COMPLETED", completedAt: new Date() }
    }),
    prisma.serviceWorkRoute.update({
      where: { id: routeId },
      data: { status: "CLOSED", endedAt: new Date() }
    })
  ]);
}

function expectOneConflict(label, race) {
  expect(`${label}: täpselt üks võitja`, race.fulfilled.length === 1);
  expect(
    `${label}: kaotaja saab 409`,
    race.rejected.length === 1 && race.rejected[0].reason?.status === 409,
    race.rejected[0]?.reason?.status
  );
}

async function main() {
  console.log("SOL-SLOG-19…20 — teekonna võistluste päris-DB sond\n");
  await purge();

  const owner = await prisma.user.create({
    data: {
      email: `owner${SUFFIX}`,
      role: "SERVICE_PROVIDER",
      emailVerified: new Date()
    }
  });
  const profile = await prisma.serviceProviderProfile.create({
    data: {
      ownerId: owner.id,
      ownershipMode: "SOLO",
      organizationName: `Osutaja ${MARK}`,
      status: "PUBLISHED"
    }
  });

  // SOL-SLOG-19: kaks eri külastust ei saa samal route'il korraga aktiivseks.
  const activeRoute = await makeRoute(profile, owner, 0);
  const first = await makeVisit(profile, owner, activeRoute, "Esimene klient");
  const second = await makeVisit(profile, owner, activeRoute, "Teine klient");
  let race = split(
    await Promise.allSettled([
      transitionVisit(owner.id, first.id, "depart", {}, { db: prisma, env: ENV, now: NOW }),
      transitionVisit(owner.id, second.id, "depart", {}, { db: prisma, env: ENV, now: NOW })
    ])
  );
  expectOneConflict("depart/depart", race);
  let rows = await prisma.serviceVisit.findMany({ where: { routeId: activeRoute.id } });
  expect(
    "depart/depart: andmebaasis on täpselt üks aktiivne külastus",
    rows.filter((row) => ["EN_ROUTE", "ARRIVED"].includes(row.status)).length === 1
  );
  await retireRoute(activeRoute.id);

  // SOL-SLOG-20: kui close võidab, jääb visiit PLANNED; kui depart võidab,
  // jääb route OPEN. Mõlemad on koherentsed, CLOSED+EN_ROUTE ei ole.
  const departRoute = await makeRoute(profile, owner, 1);
  const departVisit = await makeVisit(profile, owner, departRoute, "Kolmas klient");
  race = split(
    await Promise.allSettled([
      closeRoute(owner.id, { now: new Date(NOW.getTime() + 86_400_000) }, { db: prisma, env: ENV }),
      transitionVisit(
        owner.id,
        departVisit.id,
        "depart",
        {},
        { db: prisma, env: ENV, now: new Date(NOW.getTime() + 86_400_000) }
      )
    ])
  );
  expectOneConflict("close/depart", race);
  let routeRow = await prisma.serviceWorkRoute.findUnique({ where: { id: departRoute.id } });
  let visitRow = await prisma.serviceVisit.findUnique({ where: { id: departVisit.id } });
  expect(
    "close/depart: lõppseis on koherentne",
    (routeRow.status === "CLOSED" && visitRow.status === "PLANNED") ||
      (routeRow.status === "OPEN" && visitRow.status === "EN_ROUTE"),
    `${routeRow.status}/${visitRow.status}`
  );
  if (routeRow.status === "OPEN") await retireRoute(departRoute.id);

  // Sama võistlus otse PLANNED→ARRIVED lubatud üleminekuga.
  const arriveRoute = await makeRoute(profile, owner, 2);
  const arriveVisit = await makeVisit(profile, owner, arriveRoute, "Neljas klient");
  race = split(
    await Promise.allSettled([
      closeRoute(owner.id, { now: new Date(NOW.getTime() + 2 * 86_400_000) }, { db: prisma, env: ENV }),
      transitionVisit(
        owner.id,
        arriveVisit.id,
        "arrive",
        {},
        { db: prisma, env: ENV, now: new Date(NOW.getTime() + 2 * 86_400_000) }
      )
    ])
  );
  expectOneConflict("close/arrive", race);
  routeRow = await prisma.serviceWorkRoute.findUnique({ where: { id: arriveRoute.id } });
  visitRow = await prisma.serviceVisit.findUnique({ where: { id: arriveVisit.id } });
  expect(
    "close/arrive: lõppseis on koherentne",
    (routeRow.status === "CLOSED" && visitRow.status === "PLANNED") ||
      (routeRow.status === "OPEN" && visitRow.status === "ARRIVED"),
    `${routeRow.status}/${visitRow.status}`
  );

  await purge();
  const leftovers = await prisma.user.count({ where: { email: { endsWith: SUFFIX } } });
  expect("cleanup users=0", leftovers === 0, String(leftovers));

  console.log(`\n${passed}/${passed + failed} kontrolli läbis.`);
  if (failed) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await purge().catch(() => {});
    await prisma.$disconnect();
  });
