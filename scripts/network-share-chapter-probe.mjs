#!/usr/bin/env node

/**
 * SOL-NET peatüki päris PostgreSQL-i harness: ajutine DB, kogu migratsiooniahel,
 * koondsond ja vältimatu cleanup. Tootmis- ega arendusandmeid ei kasutata.
 */
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
  throw new Error("Network-share probe creates temporary databases only on localhost");
}
const databaseName = `sol_net_probe_${Date.now()}_${process.pid}`;
if (!/^sol_net_probe_[0-9_]+$/u.test(databaseName)) throw new Error("Unsafe temporary database name");
const probeUrl = new URL(sourceUrl);
probeUrl.pathname = `/${databaseName}`;
const admin = new pg.Client({ connectionString: sourceUrl });
const prismaCli = path.resolve("node_modules/prisma/build/index.js");
const worker = path.resolve("scripts/network-share-race-probe.mjs");

await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  const env = { ...process.env, DATABASE_URL: probeUrl.toString() };
  const migrated = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: process.cwd(), env, encoding: "utf8", shell: false
  });
  if (migrated.status !== 0) throw new Error(`prisma migrate deploy failed (${migrated.status})\n${migrated.stderr}`);
  console.log("MIGRATIONS_OK full_chain_deployed");
  const probe = spawnSync(process.execPath, ["--import", "./scripts/register-node-test-loader.mjs", worker], {
    cwd: process.cwd(), env, encoding: "utf8", shell: false
  });
  process.stdout.write(probe.stdout || "");
  process.stderr.write(probe.stderr || "");
  if (probe.status !== 0) throw new Error(`network-share probe failed (${probe.status})`);
} finally {
  await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1", [databaseName]);
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
  await admin.end();
  console.log("CLEANUP_OK temporary_database_removed");
}
