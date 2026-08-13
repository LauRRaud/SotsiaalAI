#!/usr/bin/env node
/**
 * SOL-JOUR-05 — Journey optimistliku lukustuse päris PostgreSQL-i sond.
 *
 * Fake-Prisma ei tõenda kahe sama `updatedAt` versiooniga kirjutaja võistlust.
 * Sond loob ainult localhosti ajutise andmebaasi, rakendab olemasolevad
 * migratsioonid ning nõuab igas võistluses täpselt üht võitjat.
 */

import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import pg from "pg";

import { PrismaClient } from "../generated/prisma/client.ts";
import { updateJourneyForUser } from "../lib/journey/service.js";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
process.env.U1_OUTBOX_ENABLED = "false";

const sourceUrl = String(process.env.DATABASE_URL || "").trim();
if (!sourceUrl) throw new Error("DATABASE_URL puudub");

const parsed = new URL(sourceUrl);
const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
if (!localHosts.has(parsed.hostname)) {
  throw new Error(`Journey sond loob ajutise andmebaasi ainult localhostil (host: ${parsed.hostname || "tundmatu"})`);
}

const databaseName = `sotsiaal_ai_journey_probe_${Date.now()}`;
if (!/^sotsiaal_ai_journey_probe_\d+$/.test(databaseName)) {
  throw new Error("Ebaturvaline ajutise andmebaasi nimi");
}

const adminUrl = new URL(parsed);
adminUrl.pathname = "/postgres";
adminUrl.search = "";
const probeUrl = new URL(parsed);
probeUrl.pathname = `/${databaseName}`;

const admin = new pg.Client({ connectionString: adminUrl.toString() });
const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: probeUrl.toString() }),
  log: []
});

function runPrisma(args) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: probeUrl.toString() },
    stdio: "pipe",
    shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`prisma ${args.join(" ")} kukkus koodiga ${result.status}`);
  }
}

function synchronizedReadDb(participants = 2) {
  let readers = 0;
  let release;
  const allRead = new Promise((resolve) => { release = resolve; });

  return {
    journey: {
      async findFirst(args) {
        const row = await db.journey.findFirst(args);
        readers += 1;
        if (readers === participants) release();
        await allRead;
        return row;
      }
    },
    preInquiry: db.preInquiry,
    $transaction: (...args) => db.$transaction(...args)
  };
}

async function seedJourney(ownerUserId, suffix) {
  return db.journey.create({
    data: {
      ownerUserId,
      title: `Algne ${suffix}`,
      summary: "Sünteetiline Journey võistlussond",
      status: "ACTIVE",
      sharingStatus: "PRIVATE",
      roleContext: "CLIENT",
      context: { schemaVersion: 1 }
    }
  });
}

async function expectOneWinner(label, ownerUserId, journey, first, second, verifyFinal) {
  const version = journey.updatedAt.toISOString();
  const raceDb = synchronizedReadDb();
  const results = await Promise.allSettled([
    updateJourneyForUser(ownerUserId, journey.id, { ...first, expectedUpdatedAt: version }, { db: raceDb }),
    updateJourneyForUser(ownerUserId, journey.id, { ...second, expectedUpdatedAt: version }, { db: raceDb })
  ]);
  const winners = results.filter((result) => result.status === "fulfilled");
  const losers = results.filter((result) => result.status === "rejected");

  if (winners.length !== 1 || losers.length !== 1 || losers[0].reason?.status !== 409) {
    throw new Error(`${label}: oodati üht võitjat ja üht 409 kaotajat`);
  }

  const finalRow = await db.journey.findUnique({ where: { id: journey.id } });
  if (!verifyFinal(finalRow)) throw new Error(`${label}: lõppseis ei vasta ühe võitja invariandile`);
  process.stdout.write(`OK ${label}: üks võitja, üks 409\n`);
}

await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  runPrisma(["migrate", "deploy"]);

  const owner = await db.user.create({
    data: { email: `journey-probe-${Date.now()}@sotsiaalai.test`, role: "CLIENT" }
  });

  const missingVersion = await seedJourney(owner.id, "missing-version");
  await updateJourneyForUser(owner.id, missingVersion.id, { title: "Keelatud" }, { db })
    .then(() => { throw new Error("Versioonita PATCH võeti vastu"); })
    .catch((error) => {
      if (error.status !== 409 || error.message !== "journeys.errors.version_required") throw error;
    });
  process.stdout.write("OK versioonita PATCH: 409 version_required\n");

  const editVsContinuity = await seedJourney(owner.id, "edit-continuity");
  await expectOneWinner(
    "edit vs continuity",
    owner.id,
    editVsContinuity,
    { title: "Kasutaja parandus" },
    { context: { schemaVersion: 1, serviceContinuity: { serviceName: "Koduteenus" } } },
    (row) => (row.title === "Kasutaja parandus") !== (row.context?.serviceContinuity?.serviceName === "Koduteenus")
  );

  const editVsArchive = await seedJourney(owner.id, "edit-archive");
  await expectOneWinner(
    "edit vs archive",
    owner.id,
    editVsArchive,
    { title: "Kasutaja parandus" },
    { status: "ARCHIVED" },
    (row) => (row.title === "Kasutaja parandus" && row.status === "ACTIVE")
      || (row.title === "Algne edit-archive" && row.status === "ARCHIVED")
  );

  const continuityVsContinuity = await seedJourney(owner.id, "continuity-continuity");
  await expectOneWinner(
    "continuity vs continuity",
    owner.id,
    continuityVsContinuity,
    { context: { schemaVersion: 1, serviceContinuity: { serviceName: "Variant A" } } },
    { context: { schemaVersion: 1, serviceContinuity: { serviceName: "Variant B" } } },
    (row) => ["Variant A", "Variant B"].includes(row.context?.serviceContinuity?.serviceName)
  );
} finally {
  await db.$disconnect().catch(() => {});
  await admin.query(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
    [databaseName]
  ).catch(() => {});
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => {});
  await admin.end().catch(() => {});
}
