#!/usr/bin/env node
/**
 * SOL-SLOG-J-02 — suunamise lõpetamise ja kirje loomise päris-DB sond.
 *
 * Lõpetamine ja loomine peavad lukustama sama ServiceReferral rea. Kui
 * lõpetamine jõuab lukujärjekorda esimesena, ei tohi hilisem kirje sündida;
 * kui kirje jõuab esimesena, võib ta valmis saada ja seejärel suunamine lõppeda.
 */
import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import pg from "pg";
import { PrismaClient } from "../generated/prisma/client.ts";
import { createEntry } from "../lib/serviceLog/entries.js";
import { endReferral } from "../lib/serviceLog/referrals.js";
import { raceOnLockedRow } from "./probe-race-harness.mjs";

const SUFFIX = "@slog-referral-race.invalid";
const MARK = "(slog-referral-race-sünteetiline)";
const ENV = { SERVICE_LOG_ENABLED: "1" };
dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const sourceUrl = String(process.env.DATABASE_URL || "").trim();
if (!sourceUrl) throw new Error("DATABASE_URL puudub");
const parsed = new URL(sourceUrl);
if (!new Set(["localhost", "127.0.0.1", "::1", "[::1]"]).has(parsed.hostname)) {
  throw new Error(`Sond loob ajutise andmebaasi ainult localhostil (host: ${parsed.hostname})`);
}
const databaseName = `sotsiaal_ai_slog_referral_probe_${Date.now()}`;
if (!/^sotsiaal_ai_slog_referral_probe_\d+$/.test(databaseName)) throw new Error("Ebaturvaline andmebaasinimi");
const adminUrl = new URL(parsed);
adminUrl.pathname = "/postgres";
adminUrl.search = "";
const probeUrl = new URL(parsed);
probeUrl.pathname = `/${databaseName}`;
const admin = new pg.Client({ connectionString: adminUrl.toString() });
const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: probeUrl.toString() }), log: [] });
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
  const users = await db.user.findMany({ where: { email: { endsWith: SUFFIX } }, select: { id: true } });
  const userIds = users.map((row) => row.id);
  const profiles = await db.serviceProviderProfile.findMany({ where: { organizationName: { contains: MARK } }, select: { id: true } });
  const profileIds = profiles.map((row) => row.id);
  if (profileIds.length) {
    await db.serviceEntryCorrection.deleteMany({ where: { entry: { providerProfileId: { in: profileIds } } } });
    await db.serviceEntry.deleteMany({ where: { providerProfileId: { in: profileIds } } });
    await db.serviceReferral.deleteMany({ where: { providerProfileId: { in: profileIds } } });
    await db.serviceProviderProfile.deleteMany({ where: { id: { in: profileIds } } });
  }
  if (userIds.length) await db.user.deleteMany({ where: { id: { in: userIds } } });
}

async function fixture(name) {
  const user = await db.user.create({
    data: { email: `${name}${SUFFIX}`, role: "SERVICE_PROVIDER", emailVerified: new Date() }
  });
  const profile = await db.serviceProviderProfile.create({
    data: { ownerId: user.id, ownershipMode: "SOLO", organizationName: `${name} ${MARK}`, status: "PUBLISHED" }
  });
  const referral = await db.serviceReferral.create({
    data: {
      providerProfileId: profile.id,
      kovName: "Sünteetiline KOV",
      clientDisplayName: "Sünteetiline klient",
      unit: "HOUR",
      allocationPeriod: "MONTH",
      status: "ACTIVE"
    }
  });
  return { user, profile, referral };
}

function entryInput(referral, requestId) {
  return {
    clientDisplayName: referral.clientDisplayName,
    referralId: referral.id,
    date: "2026-08-13",
    unit: "HOUR",
    quantity: 1,
    note: "Sünteetiline võistluskontroll",
    clientRequestId: requestId
  };
}

async function main() {
  console.log("SOL-SLOG-J-02 — suunamise võistluse päris-DB sond\n");
  await admin.connect();
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  const migrated = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: probeUrl.toString() },
    stdio: "pipe",
    shell: false
  });
  if (migrated.error) throw migrated.error;
  if (migrated.status !== 0) throw new Error(`prisma migrate deploy failed (${migrated.status})`);
  await purge();

  const endFirst = await fixture("end-first");
  let race = await raceOnLockedRow({
    prisma: db,
    lockRow: (tx) => tx.$queryRaw`SELECT "id" FROM "ServiceReferral" WHERE "id" = ${endFirst.referral.id} FOR UPDATE`,
    first: () => endReferral(endFirst.user.id, endFirst.referral.id, { db, env: ENV }),
    second: () => createEntry(endFirst.user.id, entryInput(endFirst.referral, "end-first-entry"), { db, env: ENV }),
    label: "end→create",
    expect
  });
  expect("end→create: lõpetamine võidab", !race.resultA.error, race.resultA.error?.message);
  expect("end→create: hilisem kirje saab 409", race.resultB.error?.status === 409, race.resultB.error?.status);
  expect("end→create: andmebaasi ei tekkinud kirjet", await db.serviceEntry.count({ where: { referralId: endFirst.referral.id } }) === 0);

  const createFirst = await fixture("create-first");
  race = await raceOnLockedRow({
    prisma: db,
    lockRow: (tx) => tx.$queryRaw`SELECT "id" FROM "ServiceReferral" WHERE "id" = ${createFirst.referral.id} FOR UPDATE`,
    first: () => createEntry(createFirst.user.id, entryInput(createFirst.referral, "create-first-entry"), { db, env: ENV }),
    second: () => endReferral(createFirst.user.id, createFirst.referral.id, { db, env: ENV }),
    label: "create→end",
    expect
  });
  expect("create→end: kirje ja sellele järgnev lõpetamine õnnestuvad", !race.resultA.error && !race.resultB.error);
  const [entryCount, ended] = await Promise.all([
    db.serviceEntry.count({ where: { referralId: createFirst.referral.id } }),
    db.serviceReferral.findUnique({ where: { id: createFirst.referral.id }, select: { status: true } })
  ]);
  expect("create→end: üks kirje jääb alles", entryCount === 1, String(entryCount));
  expect("create→end: suunamine jääb ENDED", ended?.status === "ENDED", ended?.status);

  await purge();
  const leftovers = await db.user.count({ where: { email: { endsWith: SUFFIX } } });
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
    await db.$disconnect().catch(() => null);
    await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1", [databaseName]).catch(() => null);
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => null);
    await admin.end().catch(() => null);
    console.log("CLEANUP_OK temporary_database_removed");
  });
