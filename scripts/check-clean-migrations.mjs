#!/usr/bin/env node

import { spawnSync } from "node:child_process";
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
if (!localHosts.has(parsed.hostname) && process.env.MIGRATION_CHECK_ALLOW_REMOTE !== "true") {
  throw new Error("Clean migration check only creates temporary databases on localhost");
}

const databaseName = `sotsiaal_ai_migration_probe_${Date.now()}`;
if (!/^sotsiaal_ai_migration_probe_\d+$/.test(databaseName)) {
  throw new Error("Unsafe temporary database name");
}

const adminUrl = new URL(parsed);
adminUrl.pathname = "/postgres";
adminUrl.search = "";
const probeUrl = new URL(parsed);
probeUrl.pathname = `/${databaseName}`;

const admin = new pg.Client({ connectionString: adminUrl.toString() });
const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));

function runPrisma(args) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: probeUrl.toString() },
    stdio: "inherit",
    shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`prisma ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  console.log(`[db:migrate:check] Created temporary database ${databaseName}`);
  runPrisma(["migrate", "deploy"]);
  runPrisma(["migrate", "status"]);
  console.log("[db:migrate:check] Full migration chain: OK");
} finally {
  await admin.query(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
    [databaseName]
  ).catch(() => {});
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => {});
  await admin.end();
  console.log(`[db:migrate:check] Removed temporary database ${databaseName}`);
}
