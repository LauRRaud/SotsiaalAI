#!/usr/bin/env node
/** Capture/compare Prisma's durable migration state for deploy recovery. */

import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

const [mode, statePath] = process.argv.slice(2);
if (!new Set(["write", "compare"]).has(mode) || !statePath) {
  throw new Error("Usage: prisma-migration-state.mjs <write|compare> <state-file>");
}
const sourceUrl = String(process.env.DATABASE_URL || "").trim();
if (!sourceUrl) throw new Error("DATABASE_URL is required");

const client = new pg.Client({ connectionString: sourceUrl, application_name: "sotsiaalai-migration-state" });
await client.connect();
let current;
try {
  const result = await client.query(`
    SELECT migration_name, checksum, started_at, finished_at, rolled_back_at, applied_steps_count
    FROM "_prisma_migrations"
    ORDER BY started_at, migration_name
  `);
  current = result.rows;
} finally {
  await client.end();
}

if (mode === "write") {
  await writeFile(statePath, JSON.stringify(current), { encoding: "utf8", flag: "wx" });
  console.log(`[migration-state] captured ${current.length} rows`);
} else {
  const previous = JSON.parse(await readFile(statePath, "utf8"));
  if (JSON.stringify(previous) === JSON.stringify(current)) {
    console.log("[migration-state] unchanged");
  } else {
    console.error("[migration-state] database migration state changed during the failed deploy");
    process.exitCode = 2;
  }
}
