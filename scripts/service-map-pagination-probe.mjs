#!/usr/bin/env node
/** SOL-SMAP-04/06 — real PostgreSQL cursor traversal and target visibility. */
import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import pg from "pg";
import { PrismaClient } from "../generated/prisma/client.ts";
import { listPublishedServiceMapEntries } from "../lib/serviceProviderProfiles.js";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const sourceUrl = String(process.env.DATABASE_URL || "").trim();
if (!sourceUrl) throw new Error("DATABASE_URL puudub");
const parsed = new URL(sourceUrl);
if (!new Set(["localhost", "127.0.0.1", "::1", "[::1]"]).has(parsed.hostname)) throw new Error("Sond kasutab ainult localhost PostgreSQL-i");
const databaseName = `sotsiaal_ai_service_map_page_probe_${Date.now()}`;
const adminUrl = new URL(parsed); adminUrl.pathname = "/postgres"; adminUrl.search = "";
const probeUrl = new URL(parsed); probeUrl.pathname = `/${databaseName}`;
const admin = new pg.Client({ connectionString: adminUrl.toString() });
const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: probeUrl.toString() }), log: [] });
let passed = 0;
const expect = (label, value) => { if (!value) throw new Error(`PROBE_FAIL ${label}`); passed += 1; console.log(`  PASS  ${label}`); };
const runPrisma = (args) => {
  const result = spawnSync(process.execPath, [prismaCli, ...args], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: probeUrl.toString() }, stdio: "pipe", shell: false });
  if (result.status !== 0) throw new Error(`prisma ${args.join(" ")} failed`);
};

await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  runPrisma(["migrate", "deploy"]);
  await db.serviceMapEntry.createMany({ data: Array.from({ length: 502 }, (_, index) => ({
    id: `page-${String(index).padStart(3, "0")}`,
    type: "KOV_SOCIAL_CONTACT",
    title: index === 501 ? "ZZZ unique needle" : `Equal title ${String(Math.floor(index / 3)).padStart(3, "0")}`,
    description: "Probe",
    status: index === 500 ? "HIDDEN" : "PUBLISHED",
    geocodingStatus: "MATCHED",
    latitude: 59.4,
    longitude: 24.7
  })) });

  const seen = [];
  let cursor = null;
  do {
    const result = await listPublishedServiceMapEntries({ type: "KOV_CONTACT", limit: 37, paged: true, cursor }, db);
    seen.push(...result.entries.map((entry) => entry.id));
    cursor = result.page.hasMore
      ? JSON.parse(Buffer.from(result.page.nextCursor, "base64url").toString("utf8"))
      : null;
  } while (cursor);
  expect("all public rows traverse exactly once across equal sort keys", seen.length === 501 && new Set(seen).size === 501);
  expect("hidden row never enters public traversal", !seen.includes("page-500"));
  const needle = await listPublishedServiceMapEntries({ keyword: "unique needle", type: "KOV_CONTACT", limit: 24, paged: true }, db);
  expect("the 501st source row is found by server-side filtering before take", needle.entries.length === 1 && needle.entries[0].id === "page-501");
  const hiddenTarget = await listPublishedServiceMapEntries({ entryId: "page-500", limit: 1 }, db);
  expect("hidden direct target resolves as missing", hiddenTarget.length === 0);
  console.log(`PROBE_OK ${passed}/${passed}`);
} finally {
  await db.$disconnect().catch(() => null);
  await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1", [databaseName]).catch(() => null);
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => null);
  await admin.end().catch(() => null);
  console.log("CLEANUP_OK temporary_database_removed");
}
