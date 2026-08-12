#!/usr/bin/env node
/** SOL-SMAP-01/02 — moderation CAS, source tombstones and source lock. */

import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import pg from "pg";

import { PrismaClient } from "../generated/prisma/client.ts";
import { publishServiceMapEntry } from "../lib/serviceMap/moderation.js";
import { reconcileCompleteServiceMapSource, withServiceMapSourceLock } from "../lib/serviceMap/sourceReconcile.js";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const sourceUrl = String(process.env.DATABASE_URL || "").trim();
if (!sourceUrl) throw new Error("DATABASE_URL puudub");
const parsed = new URL(sourceUrl);
if (!new Set(["localhost", "127.0.0.1", "::1", "[::1]"]).has(parsed.hostname)) throw new Error("Sond kasutab ainult localhost PostgreSQL-i");

const databaseName = `sotsiaal_ai_service_map_probe_${Date.now()}`;
const adminUrl = new URL(parsed); adminUrl.pathname = "/postgres"; adminUrl.search = "";
const probeUrl = new URL(parsed); probeUrl.pathname = `/${databaseName}`;
const admin = new pg.Client({ connectionString: adminUrl.toString() });
const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
const makeDb = () => new PrismaClient({ adapter: new PrismaPg({ connectionString: probeUrl.toString() }), log: [] });
const db = makeDb();
const db2 = makeDb();
let passed = 0;
const expect = (label, value) => { if (!value) throw new Error(`PROBE_FAIL ${label}`); passed += 1; console.log(`  PASS  ${label}`); };
const runPrisma = (args) => {
  const result = spawnSync(process.execPath, [prismaCli, ...args], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: probeUrl.toString() }, stdio: "pipe", shell: false });
  if (result.status !== 0) throw new Error(`prisma ${args.join(" ")} failed`);
};
const createEntry = (id, generation, status = "PUBLISHED") => db.serviceMapEntry.create({ data: {
  id, type: "KOV_SOCIAL_CONTACT", title: id, status, geocodingStatus: "MATCHED",
  sourceNamespace: "PROBE", sourceGeneration: generation, lastSeenAt: new Date()
} });

await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  runPrisma(["migrate", "deploy"]);
  await Promise.all([createEntry("source-a", "g1"), createEntry("source-legacy", null), createEntry("source-b", "g2")]);
  const hidden = await reconcileCompleteServiceMapSource({ db, namespace: "PROBE", generation: "g2" });
  const [a, b] = await Promise.all([db.serviceMapEntry.findUnique({ where: { id: "source-a" } }), db.serviceMapEntry.findUnique({ where: { id: "source-b" } })]);
  const legacy = await db.serviceMapEntry.findUnique({ where: { id: "source-legacy" } });
  expect("complete generation tombstones missing and legacy null-generation rows", hidden === 2 && a.status === "HIDDEN" && legacy.status === "HIDDEN" && b.status === "PUBLISHED");
  const reconcileAudit = await db.dataAuditLog.findFirst({ where: { action: "SERVICE_MAP_SOURCE_RECONCILED", resourceId: "PROBE" } });
  expect("reconcile audit identifies every hidden row without contact content", ["source-a", "source-legacy"].every((id) => reconcileAudit?.meta?.hiddenEntryIds?.includes(id)));

  await createEntry("moderation", "g3", "NEEDS_REVIEW");
  const decisions = await Promise.allSettled([
    publishServiceMapEntry({ db, entryId: "moderation", actorUserId: "admin-a", expectedRevision: 1, reason: "Kontroll A" }),
    publishServiceMapEntry({ db: db2, entryId: "moderation", actorUserId: "admin-b", expectedRevision: 1, reason: "Kontroll B" })
  ]);
  expect("parallel moderation has exactly one winner", decisions.filter((item) => item.status === "fulfilled").length === 1);
  expect("parallel moderation leaves exactly one decision audit", await db.dataAuditLog.count({ where: { action: "SERVICE_MAP_ENTRY_PUBLISHED", resourceId: "moderation" } }) === 1);

  const timings = [];
  await Promise.all([
    withServiceMapSourceLock(db, "LOCK_PROBE", async (tx) => { timings.push("a-start"); await tx.$executeRawUnsafe("SELECT pg_sleep(0.2)"); timings.push("a-end"); }),
    withServiceMapSourceLock(db2, "LOCK_PROBE", async () => { timings.push("b-start"); timings.push("b-end"); })
  ]);
  const serialized = timings.join(",") === "a-start,a-end,b-start,b-end" || timings.join(",") === "b-start,b-end,a-start,a-end";
  expect("same namespace source generations are serialized by PostgreSQL", serialized);
  console.log(`PROBE_OK ${passed}/${passed}`);
} finally {
  await Promise.all([db.$disconnect().catch(() => null), db2.$disconnect().catch(() => null)]);
  await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1", [databaseName]).catch(() => null);
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => null);
  await admin.end().catch(() => null);
  console.log("CLEANUP_OK temporary_database_removed");
}
