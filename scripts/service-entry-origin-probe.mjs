#!/usr/bin/env node
/**
 * SOL-SLOG-04/-05/-21 — idempotentsuse ja lähtekülastuse päris-DB sond.
 *
 *   npm run slog:entry-origin:probe
 */

import prisma from "../lib/prisma.js";
import { createEntry } from "../lib/serviceLog/entries.js";
import { createEntryFromVisit } from "../lib/serviceLog/dayRoute.js";

const SUFFIX = "@slog-entry-origin.invalid";
const MARK = "(slog-entry-origin-sünteetiline)";
const ENV = { SERVICE_LOG_ENABLED: "1", SERVICE_LOG_DAY_ROUTE: "1" };
const DAY = new Date("2026-08-12T00:00:00.000Z");
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

async function purge() {
  const profiles = await prisma.serviceProviderProfile.findMany({
    where: { organizationName: { contains: MARK } },
    select: { id: true }
  });
  const profileIds = profiles.map((row) => row.id);
  if (profileIds.length) {
    await prisma.serviceEntry.deleteMany({ where: { providerProfileId: { in: profileIds } } });
    await prisma.serviceVisit.deleteMany({ where: { providerProfileId: { in: profileIds } } });
    await prisma.serviceWorkRoute.deleteMany({ where: { providerProfileId: { in: profileIds } } });
    await prisma.serviceProviderProfile.deleteMany({ where: { id: { in: profileIds } } });
  }
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });
}

async function makeActor(local) {
  const user = await prisma.user.create({
    data: {
      email: `${local}${SUFFIX}`,
      role: "SERVICE_PROVIDER",
      emailVerified: new Date()
    }
  });
  const profile = await prisma.serviceProviderProfile.create({
    data: {
      ownerId: user.id,
      ownershipMode: "SOLO",
      organizationName: `${local} ${MARK}`,
      status: "PUBLISHED"
    }
  });
  const route = await prisma.serviceWorkRoute.create({
    data: {
      providerProfileId: profile.id,
      workerUserId: user.id,
      date: DAY,
      status: "OPEN",
      startedAt: DAY
    }
  });
  return { user, profile, route };
}

async function makeVisit(actor, overrides = {}) {
  return prisma.serviceVisit.create({
    data: {
      providerProfileId: actor.profile.id,
      routeId: actor.route.id,
      ownerUserId: actor.user.id,
      clientDisplayName: `Mari ${MARK}`,
      clientExternalRef: "external-a",
      status: "COMPLETED",
      arrivedAt: new Date("2026-08-12T10:00:00.000Z"),
      completedAt: new Date("2026-08-12T11:00:00.000Z"),
      ...overrides
    }
  });
}

function entryInput(overrides = {}) {
  return {
    clientDisplayName: `Mari ${MARK}`,
    clientExternalRef: "external-a",
    date: "2026-08-12",
    unit: "HOUR",
    quantity: 1,
    ...overrides
  };
}

async function main() {
  console.log("SOL-SLOG-04/-05/-21 — teenuskirje päritolu päris-DB sond\n");
  await purge();
  const own = await makeActor("owner");
  const foreign = await makeActor("foreign");

  // SOL-SLOG-04: sama võti + sama sisu on replay; erinev sisu 409.
  const first = await createEntry(
    own.user.id,
    entryInput({ clientRequestId: "same-key" }),
    { db: prisma, env: ENV }
  );
  const replay = await createEntry(
    own.user.id,
    entryInput({ clientRequestId: "same-key" }),
    { db: prisma, env: ENV }
  );
  const mismatch = await createEntry(
    own.user.id,
    entryInput({ clientRequestId: "same-key", quantity: 2 }),
    { db: prisma, env: ENV }
  ).catch((error) => error);
  const firstRow = await prisma.serviceEntry.findUnique({ where: { id: first.id } });
  expect("sama võti ja sama sisu tagastab sama rea", replay.id === first.id && replay.replayed);
  expect("sama võti ja eri sisu annab 409", mismatch?.status === 409);
  expect("kanoniseeritud sisendi sha256 on salvestatud", firstRow.clientRequestHash?.length === 64);

  // SOL-SLOG-05: võõras, olematu ja lõpetamata lähtekülastus ei ole tõend.
  const foreignVisit = await makeVisit(foreign);
  const ownVisit = await makeVisit(own);
  const unfinished = await makeVisit(own, {
    status: "ARRIVED",
    completedAt: null
  });
  const foreignError = await createEntry(
    own.user.id,
    entryInput({ sourceFieldVisitId: foreignVisit.id }),
    { db: prisma, env: ENV }
  ).catch((error) => error);
  const missingError = await createEntry(
    own.user.id,
    entryInput({ sourceFieldVisitId: "missing-visit" }),
    { db: prisma, env: ENV }
  ).catch((error) => error);
  const unfinishedError = await createEntry(
    own.user.id,
    entryInput({ sourceFieldVisitId: unfinished.id }),
    { db: prisma, env: ENV }
  ).catch((error) => error);
  const mismatchError = await createEntry(
    own.user.id,
    entryInput({ sourceFieldVisitId: ownVisit.id, clientDisplayName: `Jüri ${MARK}` }),
    { db: prisma, env: ENV }
  ).catch((error) => error);
  expect("võõras ja olematu lähtekülastus on eristamatult 404", foreignError?.status === 404 && missingError?.status === 404);
  expect("lõpetamata lähtekülastus annab 409", unfinishedError?.status === 409);
  expect("lähtekülastusega vastuolus klient annab 400", mismatchError?.status === 400);

  const sourced = await createEntry(
    own.user.id,
    entryInput({ sourceFieldVisitId: ownVisit.id }),
    { db: prisma, env: ENV }
  );
  await prisma.serviceVisit.update({
    where: { id: ownVisit.id },
    data: { serviceEntryId: sourced.id }
  });
  const reused = await createEntry(
    own.user.id,
    entryInput({ sourceFieldVisitId: ownVisit.id, clientRequestId: "other-key" }),
    { db: prisma, env: ENV }
  ).catch((error) => error);
  expect("juba kasutatud lähtekülastus annab 409", reused?.status === 409);

  // SOL-SLOG-21: kliendi kaks eri võtit ei loe — server seob võtme visitId-ga.
  const raceVisit = await makeVisit(own, { clientDisplayName: `Liis ${MARK}`, clientExternalRef: "external-b" });
  const race = await Promise.allSettled([
    createEntryFromVisit(
      own.user.id,
      raceVisit.id,
      { unit: "HOUR", quantity: 1, clientRequestId: "caller-a" },
      { db: prisma, env: ENV }
    ),
    createEntryFromVisit(
      own.user.id,
      raceVisit.id,
      { unit: "HOUR", quantity: 1, clientRequestId: "caller-b" },
      { db: prisma, env: ENV }
    )
  ]);
  const raceRows = await prisma.serviceEntry.findMany({
    where: { providerProfileId: own.profile.id, sourceFieldVisitId: raceVisit.id }
  });
  const linked = await prisma.serviceVisit.findUnique({ where: { id: raceVisit.id } });
  expect(
    "paralleelsed eri kliendivõtmed taastuvad mõlemad sama tulemuseni",
    race.every((result) => result.status === "fulfilled"),
    race
      .filter((result) => result.status === "rejected")
      .map((result) => `${result.reason?.code || result.reason?.status || result.reason?.name}:${result.reason?.messageKey || result.reason?.message}`)
      .join(", ")
  );
  expect("ühest lõpetatud külastusest sündis täpselt üks teenuskirje", raceRows.length === 1);
  expect("külastuse tagasiviide osutab ainsale kirjele", linked.serviceEntryId === raceRows[0]?.id);
  expect("serveri idempotentsusvõti on visitId-st tuletatud", raceRows[0]?.clientRequestId === `visit-entry-${raceVisit.id}`);

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
