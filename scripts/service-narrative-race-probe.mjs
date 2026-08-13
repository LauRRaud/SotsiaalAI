#!/usr/bin/env node
/** SOL-SLOG-J-04 — kuunarratiivi create/update/CAS päris-DB sond. */
import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import pg from "pg";
import { PrismaClient } from "../generated/prisma/client.ts";
import { upsertNarrative } from "../lib/serviceLog/narratives.js";

const ENV = { SERVICE_LOG_ENABLED: "1" };
dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const sourceUrl = String(process.env.DATABASE_URL || "").trim();
if (!sourceUrl) throw new Error("DATABASE_URL puudub");
const parsed = new URL(sourceUrl);
if (!new Set(["localhost", "127.0.0.1", "::1", "[::1]"]).has(parsed.hostname)) {
  throw new Error(`Sond loob ajutise andmebaasi ainult localhostil (host: ${parsed.hostname})`);
}
const databaseName = `sotsiaal_ai_slog_narrative_probe_${Date.now()}`;
if (!/^sotsiaal_ai_slog_narrative_probe_\d+$/.test(databaseName)) throw new Error("Ebaturvaline andmebaasinimi");
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

function input(referralId, bodyText, extra = {}) {
  return { referralId, periodYear: 2026, periodMonth: 8, bodyText, ...extra };
}

async function fixture() {
  const user = await db.user.create({
    data: { email: "owner@slog-narrative-race.invalid", role: "SERVICE_PROVIDER", emailVerified: new Date() }
  });
  const profile = await db.serviceProviderProfile.create({
    data: { ownerId: user.id, ownershipMode: "SOLO", organizationName: "Narratiivi CAS sond", status: "PUBLISHED" }
  });
  const referrals = [];
  for (const number of ["CREATE", "UPDATE", "AI"]) {
    referrals.push(await db.serviceReferral.create({
      data: {
        providerProfileId: profile.id,
        kovName: "Sünteetiline KOV",
        referralNumber: number,
        clientDisplayName: `Sünteetiline klient ${number}`,
        unit: "HOUR",
        allocationPeriod: "MONTH",
        status: "ACTIVE"
      }
    }));
  }
  return { user, profile, referrals };
}

function split(results) {
  return {
    ok: results.filter((result) => result.status === "fulfilled"),
    bad: results.filter((result) => result.status === "rejected")
  };
}

async function main() {
  console.log("SOL-SLOG-J-04 — kuunarratiivi CAS päris-DB sond\n");
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
  const { user, profile, referrals } = await fixture();

  let raced = split(await Promise.allSettled([
    upsertNarrative(user.id, input(referrals[0].id, "Looja A"), { db, env: ENV }),
    upsertNarrative(user.id, input(referrals[0].id, "Looja B"), { db, env: ENV })
  ]));
  expect("create/create annab ühe võitja", raced.ok.length === 1, `${raced.ok.length}`);
  expect("create/create kaotaja saab värske projektsiooniga 409", raced.bad.length === 1 && raced.bad[0].reason?.status === 409 && Boolean(raced.bad[0].reason?.details?.narrative));
  expect("create/create jätab ühe rea", await db.serviceMonthlyNarrative.count({ where: { referralId: referrals[0].id } }) === 1);

  const updateBase = await upsertNarrative(user.id, input(referrals[1].id, "Algtekst"), { db, env: ENV });
  raced = split(await Promise.allSettled([
    upsertNarrative(user.id, input(referrals[1].id, "Muutja A", { expectedUpdatedAt: updateBase.updatedAt }), { db, env: ENV }),
    upsertNarrative(user.id, input(referrals[1].id, "Muutja B", { expectedUpdatedAt: updateBase.updatedAt }), { db, env: ENV })
  ]));
  const updateRow = await db.serviceMonthlyNarrative.findFirst({ where: { referralId: referrals[1].id } });
  expect("update/update annab ühe CAS-võitja", raced.ok.length === 1);
  expect("update/update stale kirjutaja saab 409", raced.bad.length === 1 && raced.bad[0].reason?.status === 409);
  expect("update/update lõpptekst on võitja tekst", raced.ok[0]?.value?.bodyText === updateRow?.bodyText, updateRow?.bodyText);

  const aiBase = await upsertNarrative(user.id, input(referrals[2].id, "AI lähtepunkt", { draftSource: "AI_MUSTAND" }), { db, env: ENV });
  raced = split(await Promise.allSettled([
    upsertNarrative(user.id, input(referrals[2].id, "AI vastus", { expectedUpdatedAt: aiBase.updatedAt, draftSource: "AI_MUSTAND" }), { db, env: ENV }),
    upsertNarrative(user.id, input(referrals[2].id, "Käsitsi täiendus", { expectedUpdatedAt: aiBase.updatedAt, draftSource: "AI_MUSTAND" }), { db, env: ENV })
  ]));
  const aiRow = await db.serviceMonthlyNarrative.findFirst({ where: { referralId: referrals[2].id } });
  expect("AI-vastus vs käsimuudatus annab ühe CAS-võitja", raced.ok.length === 1 && raced.bad.length === 1);
  expect("kaotaja värske projektsioon vastab säilinud tekstile", raced.bad[0]?.reason?.details?.narrative?.bodyText === aiRow?.bodyText);
  expect("AI-st alustatud teksti päritolu säilib", aiRow?.draftSource === "AI_MUSTAND", aiRow?.draftSource);

  await db.serviceMonthlyNarrative.deleteMany({ where: { providerProfileId: profile.id } });
  await db.serviceReferral.deleteMany({ where: { providerProfileId: profile.id } });
  await db.serviceProviderProfile.delete({ where: { id: profile.id } });
  await db.user.delete({ where: { id: user.id } });
  expect("cleanup users=0", await db.user.count({ where: { email: "owner@slog-narrative-race.invalid" } }) === 0);
  console.log(`\n${passed}/${passed + failed} kontrolli läbis.`);
  if (failed) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect().catch(() => null);
    await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1", [databaseName]).catch(() => null);
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => null);
    await admin.end().catch(() => null);
    console.log("CLEANUP_OK temporary_database_removed");
  });
