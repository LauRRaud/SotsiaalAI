#!/usr/bin/env node
/**
 * SOL-SLOG-08…10 — teenuskirje elutsükli ja parandusahela päris-DB sond.
 *
 *   npm run slog:entry:probe
 *
 * Fake-prisma ei tõenda tingimusliku update'i võitjat, tehingu rollback'i ega
 * `updatedAt` CAS-i. Sond kasutab ainult `@slog-entry.invalid` sünteetilisi
 * kontosid ja koristab kõik enda read lõpus.
 */

import prisma from "../lib/prisma.js";
import {
  finalizeEntry,
  setManualConfirmation,
  updateEntry,
  voidEntry
} from "../lib/serviceLog/entries.js";

const SUFFIX = "@slog-entry.invalid";
const MARK = "(slog-entry-sünteetiline)";
const ENV = { SERVICE_LOG_ENABLED: "1" };

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

async function makeEntry(profile, owner, overrides = {}) {
  return prisma.serviceEntry.create({
    data: {
      providerProfileId: profile.id,
      ownerUserId: owner.id,
      clientDisplayName: `Mari ${MARK}`,
      clientExternalRef: "external-1",
      date: new Date("2026-08-12T00:00:00.000Z"),
      unit: "HOUR",
      quantity: 1,
      status: "DRAFT",
      ...overrides
    }
  });
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
    await prisma.serviceEntry.deleteMany({ where: { providerProfileId: { in: profileIds } } });
    await prisma.serviceProviderProfile.deleteMany({ where: { id: { in: profileIds } } });
  }
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function main() {
  console.log("SOL-SLOG-08…10 — teenuskirje elutsükli päris-DB sond\n");
  await purge();

  const owner = await prisma.user.create({
    data: {
      email: `owner${SUFFIX}`,
      role: "SERVICE_PROVIDER",
      emailVerified: new Date()
    }
  });
  const platformClient = await prisma.user.create({
    data: { email: `client${SUFFIX}`, role: "CLIENT", emailVerified: new Date() }
  });
  const profile = await prisma.serviceProviderProfile.create({
    data: {
      ownerId: owner.id,
      ownershipMode: "SOLO",
      organizationName: `Osutaja ${MARK}`,
      status: "PUBLISHED"
    }
  });

  // 08: finalize/finalize — üks kirjutus, üks 409.
  const doubleFinalize = await makeEntry(profile, owner);
  let race = split(
    await Promise.allSettled([
      finalizeEntry(owner.id, doubleFinalize.id, { db: prisma, env: ENV }),
      finalizeEntry(owner.id, doubleFinalize.id, { db: prisma, env: ENV })
    ])
  );
  expect("finalize/finalize: täpselt üks võitja", race.fulfilled.length === 1);
  expect(
    "finalize/finalize: kaotaja saab 409",
    race.rejected.length === 1 && race.rejected[0].reason?.status === 409
  );
  let row = await prisma.serviceEntry.findUnique({ where: { id: doubleFinalize.id } });
  expect(
    "finalize/finalize: lõppväljad on kooskõlas",
    row.status === "FINAL" && Boolean(row.finalizedAt) && !row.voidedAt && !row.voidReason
  );

  // 08: finalize/void — kumb võidab, segavälju ei jää.
  const finalizeVoid = await makeEntry(profile, owner);
  race = split(
    await Promise.allSettled([
      finalizeEntry(owner.id, finalizeVoid.id, { db: prisma, env: ENV }),
      voidEntry(owner.id, finalizeVoid.id, { reason: "Vale mustand", db: prisma, env: ENV })
    ])
  );
  expect("finalize/void: täpselt üks võitja", race.fulfilled.length === 1);
  expect(
    "finalize/void: kaotaja saab 409",
    race.rejected.length === 1 && race.rejected[0].reason?.status === 409
  );
  row = await prisma.serviceEntry.findUnique({ where: { id: finalizeVoid.id } });
  const coherentFinal = row.status === "FINAL" && Boolean(row.finalizedAt) && !row.voidedAt && !row.voidReason;
  const coherentVoid =
    row.status === "VOID" && !row.finalizedAt && row.recordedFiscalYear === null && Boolean(row.voidedAt) && Boolean(row.voidReason);
  expect("finalize/void: andmebaasi lõppseis on koherentne", coherentFinal || coherentVoid, row.status);

  // 09: sama välja kaks parandust — ainult üks correction ja värske 409.
  const sameField = await makeEntry(profile, owner, {
    status: "FINAL",
    finalizedAt: new Date(),
    recordedFiscalYear: 2026,
    note: null
  });
  race = split(
    await Promise.allSettled([
      updateEntry(
        owner.id,
        sameField.id,
        { note: "esimene", reason: "Esimene täpsustus", expectedUpdatedAt: sameField.updatedAt },
        { db: prisma, env: ENV }
      ),
      updateEntry(
        owner.id,
        sameField.id,
        { note: "teine", reason: "Teine täpsustus", expectedUpdatedAt: sameField.updatedAt },
        { db: prisma, env: ENV }
      )
    ])
  );
  expect("sama välja parandus: üks võitja", race.fulfilled.length === 1);
  expect(
    "sama välja parandus: stale kaotaja saab värske reaga 409",
    race.rejected.length === 1 &&
      race.rejected[0].reason?.status === 409 &&
      Boolean(race.rejected[0].reason?.details?.entry?.updatedAt)
  );
  let corrections = await prisma.serviceEntryCorrection.findMany({
    where: { entryId: sameField.id }
  });
  expect(
    "sama välja parandus: täpselt üks aus correction",
    corrections.length === 1 && corrections[0].previousValues?.note === null
  );

  // 09: eri väljade võistlus ei kaota samuti üht kirjutust vaikides.
  const differentFields = await makeEntry(profile, owner, {
    status: "FINAL",
    finalizedAt: new Date(),
    recordedFiscalYear: 2026,
    note: null,
    workerName: null
  });
  race = split(
    await Promise.allSettled([
      updateEntry(
        owner.id,
        differentFields.id,
        { note: "märkus", reason: "Märkuse täpsustus", expectedUpdatedAt: differentFields.updatedAt },
        { db: prisma, env: ENV }
      ),
      updateEntry(
        owner.id,
        differentFields.id,
        { workerName: "Töötaja", reason: "Nime täpsustus", expectedUpdatedAt: differentFields.updatedAt },
        { db: prisma, env: ENV }
      )
    ])
  );
  expect("eri väljade parandus: üks võitja ja üks 409", race.fulfilled.length === 1 && race.rejected[0]?.reason?.status === 409);
  corrections = await prisma.serviceEntryCorrection.findMany({
    where: { entryId: differentFields.id }
  });
  expect("eri väljade parandus: correction'e on üks, mitte kaks sama vana lähtega", corrections.length === 1);

  // 10: platvormikliendi eest ei saa paberkinnitust anda.
  const platformEntry = await makeEntry(profile, owner, {
    clientUserId: platformClient.id,
    clientDisplayName: null,
    clientExternalRef: null,
    status: "FINAL",
    finalizedAt: new Date(),
    recordedFiscalYear: 2026
  });
  const blocked = await setManualConfirmation(owner.id, platformEntry.id, {
    confirmed: true,
    db: prisma,
    env: ENV
  }).catch((error) => error);
  row = await prisma.serviceEntry.findUnique({ where: { id: platformEntry.id } });
  corrections = await prisma.serviceEntryCorrection.findMany({
    where: { entryId: platformEntry.id }
  });
  expect("platvormikliendi paberkinnitus on 409", blocked?.status === 409);
  expect("platvormikliendi rida ja audit jäävad muutmata", !row.confirmedManually && corrections.length === 0);

  // 10: väliskliendi märge ja eemaldus on mõlemad auditeeritud.
  const externalEntry = await makeEntry(profile, owner, {
    status: "FINAL",
    finalizedAt: new Date(),
    recordedFiscalYear: 2026
  });
  await setManualConfirmation(owner.id, externalEntry.id, {
    confirmed: true,
    db: prisma,
    env: ENV
  });
  await setManualConfirmation(owner.id, externalEntry.id, {
    confirmed: false,
    db: prisma,
    env: ENV
  });
  row = await prisma.serviceEntry.findUnique({ where: { id: externalEntry.id } });
  corrections = await prisma.serviceEntryCorrection.findMany({
    where: { entryId: externalEntry.id },
    orderBy: { createdAt: "asc" }
  });
  expect("väliskliendi lõppseis peegeldab eemaldust", !row.confirmedManually);
  expect(
    "märkimine ja eemaldus kannavad tegijat, aega ja vana väärtust",
    corrections.length === 2 &&
      corrections.every((item) => item.actorUserId === owner.id && item.createdAt) &&
      corrections[0].previousValues?.confirmedManually === false &&
      corrections[1].previousValues?.confirmedManually === true
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
