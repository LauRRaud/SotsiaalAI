#!/usr/bin/env node
/**
 * SOL-PRISMA-01/02 — real PostgreSQL upgrade probe.
 *
 * Starts from the two relevant legacy schema shapes, seeds both valid and
 * drifted rows, executes the repository migration SQL itself, and verifies
 * semantic backfill plus pg_constraint.convalidated. The database is
 * disposable; no development or production rows are read.
 */

import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

const sourceUrl = String(process.env.DATABASE_URL || "").trim();
if (!sourceUrl) throw new Error("DATABASE_URL is required");

const parsed = new URL(sourceUrl);
const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
if (!localHosts.has(parsed.hostname) && process.env.PRISMA_UPGRADE_PROBE_ALLOW_REMOTE !== "true") {
  throw new Error(`Upgrade probe only creates temporary databases on localhost (host: ${parsed.hostname})`);
}

const databaseName = `sotsiaal_ai_prisma_upgrade_probe_${Date.now()}`;
if (!/^sotsiaal_ai_prisma_upgrade_probe_\d+$/.test(databaseName)) {
  throw new Error("Unsafe temporary database name");
}

const adminUrl = new URL(parsed);
adminUrl.pathname = "/postgres";
adminUrl.search = "";
const probeUrl = new URL(parsed);
probeUrl.pathname = `/${databaseName}`;

const admin = new pg.Client({ connectionString: adminUrl.toString() });
const probe = new pg.Client({ connectionString: probeUrl.toString() });
const checks = [];
const stagedRoot = await mkdtemp(path.join(process.cwd(), ".prisma-upgrade-stage-"));
const stagedPrisma = path.join(stagedRoot, "prisma");
const stagedMigrations = path.join(stagedPrisma, "migrations");
const stagedConfig = path.join(stagedRoot, "prisma.config.mjs");
const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));

function check(label, condition) {
  checks.push({ label, ok: Boolean(condition) });
}

const a4Migration = await readFile(
  new URL("../prisma/migrations/20260805190000_a4_licence_assessment_evidence/migration.sql", import.meta.url),
  "utf8"
);
const integrityMigration = await readFile(
  new URL("../prisma/migrations/20260813235500_sol_prisma_01_02_integrity/migration.sql", import.meta.url),
  "utf8"
);

async function stageLegacyRelease() {
  await mkdir(stagedMigrations, { recursive: true });
  await cp(fileURLToPath(new URL("../prisma/schema.prisma", import.meta.url)), path.join(stagedPrisma, "schema.prisma"));
  await writeFile(stagedConfig, `
    import { defineConfig, env } from "prisma/config";
    export default defineConfig({
      schema: "prisma/schema.prisma",
      migrations: { path: "prisma/migrations" },
      datasource: { url: env("DATABASE_URL") }
    });
  `, "utf8");
  const sourceMigrations = fileURLToPath(new URL("../prisma/migrations", import.meta.url));
  const entries = (await readdir(sourceMigrations, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name <= "20260805170000_a4_mtr_licence_check")
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    await cp(path.join(sourceMigrations, entry.name), path.join(stagedMigrations, entry.name), { recursive: true });
  }
}

function migrateLegacyRelease() {
  const result = spawnSync(process.execPath, [
    prismaCli,
    "migrate",
    "deploy",
    "--config",
    stagedConfig
  ], {
    cwd: stagedRoot,
    env: { ...process.env, DATABASE_URL: probeUrl.toString() },
    encoding: "utf8",
    shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`legacy migrate deploy failed: ${result.stderr || result.stdout}`);
}

await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  await stageLegacyRelease();
  migrateLegacyRelease();
  await probe.connect();

  await probe.query(`
    INSERT INTO "User" ("id", "email", "updatedAt")
      VALUES ('legacy-profile-owner', 'legacy-profile-owner@sotsiaalai.test', CURRENT_TIMESTAMP);
    INSERT INTO "ServiceProviderProfile" ("id", "ownerId", "organizationName", "updatedAt")
      VALUES ('legacy-profile', 'legacy-profile-owner', 'Legacy profile', CURRENT_TIMESTAMP);
    INSERT INTO "LicenceCheck" (
      "id", "providerProfileId", "registryCode", "result", "reason", "entityResolved", "verifiedAt"
    ) VALUES
      ('legacy-success', 'legacy-profile', '10000001', 'OK', NULL, true, '2026-08-05T10:00:00Z'),
      ('legacy-licence-failure', 'legacy-profile', '10000001', 'UNCONFIRMED', 'LICENCE_TIMEOUT', false, NULL),
      ('legacy-identity-mismatch', 'legacy-profile', '10000001', 'OK', 'ENTITY_NOT_FOUND', false, '2026-08-05T10:02:00Z');
  `);

  const before = await probe.query(`
    SELECT "result", "reason", "entityResolved"
    FROM "LicenceCheck" WHERE "id" = 'legacy-identity-mismatch'
  `);
  check(
    "negative control: legacy row falsely says OK while identity is unresolved",
    before.rows[0]?.result === "OK" && before.rows[0]?.entityResolved === false
  );

  await probe.query(a4Migration);

  const migrated = await probe.query(`
    SELECT "id", "result", "licenceSourceResult", "entitySourceResult",
           "licenceReason", "entityReason", "verifiedAt"
    FROM "LicenceCheck" ORDER BY "id"
  `);
  const byId = new Map(migrated.rows.map((row) => [row.id, row]));
  check("successful legacy row remains fully successful", byId.get("legacy-success")?.result === "OK");
  check("successful legacy identity source is OK", byId.get("legacy-success")?.entitySourceResult === "OK");
  check("licence failure reason is preserved", byId.get("legacy-licence-failure")?.licenceReason === "LICENCE_TIMEOUT");
  check("licence failure is not presented as overall success", byId.get("legacy-licence-failure")?.result === "UNCONFIRMED");
  check("identity mismatch becomes overall UNCONFIRMED", byId.get("legacy-identity-mismatch")?.result === "UNCONFIRMED");
  check("identity mismatch source becomes UNCONFIRMED", byId.get("legacy-identity-mismatch")?.entitySourceResult === "UNCONFIRMED");
  check("identity mismatch reason is preserved", byId.get("legacy-identity-mismatch")?.entityReason === "ENTITY_NOT_FOUND");
  check("false verification timestamp is cleared", byId.get("legacy-identity-mismatch")?.verifiedAt === null);

  await probe.query(`
    INSERT INTO "User" ("id", "updatedAt")
      VALUES ('request-user', CURRENT_TIMESTAMP), ('offer-user', CURRENT_TIMESTAMP);
    INSERT INTO "HelpCategory" ("id", "code", "labelEt", "labelEn", "labelRu", "updatedAt")
      VALUES ('category', 'probe', 'Probe', 'Probe', 'Probe', CURRENT_TIMESTAMP);
    INSERT INTO "HelpRequest" ("id", "userId", "primaryCategoryId", "description", "updatedAt")
      VALUES ('request', 'request-user', 'category', 'probe', CURRENT_TIMESTAMP);
    INSERT INTO "HelpOffer" ("id", "userId", "primaryCategoryId", "description", "updatedAt")
      VALUES ('offer', 'offer-user', 'category', 'probe', CURRENT_TIMESTAMP);

    ALTER TABLE "HelpMatch" DROP CONSTRAINT "HelpMatch_requesterId_fkey";
    ALTER TABLE "HelpMatch" DROP CONSTRAINT "HelpMatch_offererId_fkey";
    INSERT INTO "HelpMatch" (
      "id", "requestId", "offerId", "requesterId", "offererId", "initiatedByUserId", "updatedAt"
    ) VALUES (
      'drifted-match', 'request', 'offer', 'missing-request-user', 'missing-offer-user',
      'request-user', CURRENT_TIMESTAMP
    );
    ALTER TABLE "HelpMatch" ADD CONSTRAINT "HelpMatch_requesterId_fkey"
      FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
    ALTER TABLE "HelpMatch" ADD CONSTRAINT "HelpMatch_offererId_fkey"
      FOREIGN KEY ("offererId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
  `);

  await probe.query(integrityMigration);

  const repaired = await probe.query(`SELECT "requesterId", "offererId" FROM "HelpMatch" WHERE "id" = 'drifted-match'`);
  check("requester drift is repaired from HelpRequest", repaired.rows[0]?.requesterId === "request-user");
  check("offerer drift is repaired from HelpOffer", repaired.rows[0]?.offererId === "offer-user");

  const constraints = await probe.query(`
    SELECT conname, convalidated
    FROM pg_constraint
    WHERE conname IN ('HelpMatch_requesterId_fkey', 'HelpMatch_offererId_fkey')
    ORDER BY conname
  `);
  check("both HelpMatch constraints exist", constraints.rowCount === 2);
  check("both HelpMatch constraints are validated", constraints.rows.every((row) => row.convalidated === true));
} finally {
  await probe.end().catch(() => {});
  await admin.query(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
    [databaseName]
  ).catch(() => {});
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => {});
  const remaining = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName]).catch(() => ({ rowCount: 1 }));
  check("temporary database is removed", remaining.rowCount === 0);
  await admin.end().catch(() => {});
  await rm(stagedRoot, { recursive: true, force: true }).catch(() => {});
}

for (const item of checks) {
  console.log(`${item.ok ? "OK" : "FAIL"} ${item.label}`);
}
const failures = checks.filter((item) => !item.ok);
if (failures.length > 0) {
  throw new Error(`PRISMA upgrade probe failed ${failures.length}/${checks.length}`);
}
console.log(`PROBE_OK ${checks.length}/${checks.length}`);
