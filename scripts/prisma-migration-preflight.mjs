#!/usr/bin/env node
/**
 * SOL-PRISMA-04 — read-only pre-deploy migration risk gate.
 *
 * Only pending migrations are inspected. Risky statements must be explicitly
 * reviewed in the migration, affected relation sizes must be measurable, and
 * large/locked relations stop the deploy. The deploy then applies PostgreSQL
 * lock_timeout and statement_timeout to the actual Prisma migration session.
 */

import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import dotenv from "dotenv";
import pg from "pg";

import { classifyMigrationStatements, createdMigrationTables } from "../lib/prismaMigrationRisk.js";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

const sourceUrl = String(process.env.DATABASE_URL || "").trim();
if (!sourceUrl) throw new Error("DATABASE_URL is required");

const maxBytes = Number(process.env.MIGRATION_PREFLIGHT_MAX_LOCKING_BYTES || 100 * 1024 * 1024);
const maxRows = Number(process.env.MIGRATION_PREFLIGHT_MAX_LOCKING_ROWS || 100_000);
const allowLarge = process.env.MIGRATION_PREFLIGHT_ALLOW_LARGE_LOCKING === "true";
const requireNoPending = process.argv.includes("--require-no-pending");
const migrationsDir = path.resolve("prisma", "migrations");

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

const client = new pg.Client({ connectionString: sourceUrl, application_name: "sotsiaalai-migration-preflight" });
await client.connect();

try {
  const migrationTable = await client.query(`SELECT to_regclass('public._prisma_migrations') AS name`);
  if (!migrationTable.rows[0]?.name) throw new Error("_prisma_migrations is missing; deploy cannot classify pending migrations safely");

  const failed = await client.query(`
    SELECT migration_name
    FROM "_prisma_migrations"
    WHERE finished_at IS NULL AND rolled_back_at IS NULL
  `);
  if (failed.rowCount > 0) {
    throw new Error(`unfinished migrations block deploy: ${failed.rows.map((row) => row.migration_name).join(", ")}`);
  }

  const appliedResult = await client.query(`
    SELECT migration_name
    FROM "_prisma_migrations"
    WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
  `);
  const applied = new Set(appliedResult.rows.map((row) => row.migration_name));
  const entries = (await readdir(migrationsDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const pending = entries.filter((name) => !applied.has(name));
  if (requireNoPending && pending.length > 0) {
    throw new Error(`--skip-build is forbidden while migrations are pending: ${pending.join(", ")}`);
  }

  const longTransactions = await client.query(`
    SELECT pid
    FROM pg_stat_activity
    WHERE datname = current_database()
      AND pid <> pg_backend_pid()
      AND xact_start IS NOT NULL
      AND xact_start < clock_timestamp() - interval '60 seconds'
      AND state <> 'idle'
  `);
  if (longTransactions.rowCount > 0) {
    throw new Error(`${longTransactions.rowCount} long-running transaction(s) block migration preflight`);
  }

  const reports = [];
  const pendingCreatedTables = new Set();
  for (const name of pending) {
    const sql = await readFile(path.join(migrationsDir, name, "migration.sql"), "utf8");
    const risks = classifyMigrationStatements(sql);
    for (const table of createdMigrationTables(sql)) {
      pendingCreatedTables.add(table);
    }
    if (
      risks.some((risk) => risk.destructive) &&
      (!/deploy-risk-reviewed:/i.test(sql) || !/deploy-precondition:/i.test(sql))
    ) {
      throw new Error(`${name} contains destructive SQL without deploy-risk-reviewed and deploy-precondition annotations`);
    }

    const tableReports = new Map();
    for (const risk of risks) {
      if (tableReports.has(risk.table)) continue;
      const relation = await client.query(
        `SELECT to_regclass($1) AS oid`,
        [`public."${risk.table.replaceAll('"', '""')}"`]
      );
      const oid = relation.rows[0]?.oid;
      if (!oid && pendingCreatedTables.has(risk.table)) {
        tableReports.set(risk.table, { bytes: 0, estimatedRows: 0, waitingLocks: 0, pendingCreate: true });
        continue;
      }
      if (!oid) throw new Error(`${name}: cannot measure relation ${risk.table}`);

      const size = await client.query(
        `SELECT pg_total_relation_size($1::regclass)::bigint AS bytes,
                COALESCE(c.reltuples, 0)::bigint AS estimated_rows
         FROM pg_class c WHERE c.oid = $1::regclass`,
        [oid]
      );
      const locks = await client.query(
        `SELECT count(*)::int AS count FROM pg_locks WHERE relation = $1::regclass AND NOT granted`,
        [oid]
      );
      const bytes = Number(size.rows[0]?.bytes || 0);
      let estimatedRows = Number(size.rows[0]?.estimated_rows || 0);
      const waitingLocks = Number(locks.rows[0]?.count || 0);
      if (waitingLocks > 0) throw new Error(`${name}: ${risk.table} has ${waitingLocks} waiting lock(s)`);
      if (bytes > maxBytes && !allowLarge) {
        throw new Error(`${name}: ${risk.table} is too large for an automatic locking migration (bytes=${bytes})`);
      }
      if (estimatedRows < 0) {
        const exact = await client.query(`SELECT count(*)::bigint AS count FROM ${quoteIdentifier(risk.table)}`);
        estimatedRows = Number(exact.rows[0]?.count || 0);
      }
      if (!allowLarge && (bytes > maxBytes || estimatedRows > maxRows)) {
        throw new Error(
          `${name}: ${risk.table} is too large for an automatic locking migration ` +
          `(bytes=${bytes}, estimated_rows=${estimatedRows})`
        );
      }
      tableReports.set(risk.table, { bytes, estimatedRows, waitingLocks });
    }

    reports.push({
      name,
      checksum: createHash("sha256").update(sql).digest("hex").slice(0, 12),
      risks,
      tables: Object.fromEntries(tableReports)
    });
  }

  console.log(JSON.stringify({
    ok: true,
    pending: reports,
    policy: { lockTimeout: "5s", statementTimeout: "15min", maxBytes, maxRows, allowLarge }
  }, null, 2));
} finally {
  await client.end();
}
