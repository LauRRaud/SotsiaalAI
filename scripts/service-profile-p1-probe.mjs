#!/usr/bin/env node

/** SOL-SPROF-03…08: ajutine PostgreSQL, täis migratsiooniahel ja üks koondsond. */
import { spawnSync } from "node:child_process";
import path from "node:path";

import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

const sourceUrl = String(process.env.DATABASE_URL || "").trim();
if (!sourceUrl) throw new Error("DATABASE_URL puudub");
const parsed = new URL(sourceUrl);
if (!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
  throw new Error("Service-profile probe creates temporary databases only on localhost");
}
const databaseName = `sol_sprof_p1_probe_${Date.now()}_${process.pid}`;
if (!/^sol_sprof_p1_probe_[0-9_]+$/u.test(databaseName)) throw new Error("Unsafe temporary database name");
const adminUrl = new URL(sourceUrl);
adminUrl.pathname = "/postgres";
adminUrl.search = "";
const probeUrl = new URL(sourceUrl);
probeUrl.pathname = `/${databaseName}`;
const prismaCli = path.resolve("node_modules/prisma/build/index.js");
const worker = path.resolve("scripts/service-profile-p1-probe-worker.mjs");

const creator = new pg.Client({ connectionString: adminUrl.toString() });
await creator.connect();
try {
  await creator.query(`CREATE DATABASE "${databaseName}"`);
  await creator.end();
  const env = {
    ...process.env,
    DATABASE_URL: probeUrl.toString(),
    SERVICE_MAP_SUGGESTION_SECRET: "sol-sprof-probe-only-secret"
  };
  const migrated = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: process.cwd(), env, encoding: "utf8", shell: false
  });
  if (migrated.status !== 0) throw new Error(`prisma migrate deploy failed (${migrated.status})\n${migrated.stderr}`);
  console.log("MIGRATIONS_OK full_chain_deployed");
  const probe = spawnSync(process.execPath, [
    "--conditions=react-server",
    "--import", "./scripts/register-node-test-loader.mjs",
    worker
  ], { cwd: process.cwd(), env, encoding: "utf8", shell: false });
  process.stdout.write(probe.stdout || "");
  process.stderr.write(probe.stderr || "");
  if (probe.status !== 0) throw new Error(`service-profile P1 probe failed (${probe.status})`);
} finally {
  await creator.end().catch(() => null);
  const cleanup = new pg.Client({ connectionString: adminUrl.toString() });
  await cleanup.connect();
  await cleanup.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1", [databaseName]);
  await cleanup.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
  await cleanup.end();
  console.log("CLEANUP_OK temporary_database_removed");
}
