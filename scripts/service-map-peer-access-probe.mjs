#!/usr/bin/env node
/** SOL-SMAP-08 — anonymous capability does not reveal peer listing existence. */
import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import pg from "pg";
import { PrismaClient } from "../generated/prisma/client.ts";
import { listPublishedHelpMapEntries } from "../lib/help/mapEntries.js";
import { loadPeerServiceMapEntries } from "../lib/serviceMap/peerAccess.js";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const sourceUrl = String(process.env.DATABASE_URL || "").trim();
if (!sourceUrl) throw new Error("DATABASE_URL puudub");
const parsed = new URL(sourceUrl);
if (!new Set(["localhost", "127.0.0.1", "::1", "[::1]"]).has(parsed.hostname)) throw new Error("Sond kasutab ainult localhost PostgreSQL-i");
const databaseName = `sotsiaal_ai_service_map_peer_probe_${Date.now()}`;
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
const load = (options, client) => listPublishedHelpMapEntries(options, client);

await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  runPrisma(["migrate", "deploy"]);
  await db.user.create({ data: { id: "peer-owner", email: "peer-owner@example.invalid" } });
  await db.helpCategory.create({ data: { id: "peer-category", code: "PROBE", labelEt: "Sond", labelEn: "Probe", labelRu: "Проба" } });
  const anonymousBefore = await loadPeerServiceMapEntries({ db, loadHelpEntries: load });
  await db.helpRequest.create({ data: { id: "peer-request", userId: "peer-owner", primaryCategoryId: "peer-category", title: "Safe public title", description: "Private source text" } });
  await db.helpMapEntry.create({ data: { id: "peer-map", kind: "HELP_REQUEST", requestId: "peer-request", mapVisible: true, status: "PUBLISHED", geocodingStatus: "MATCHED", latitude: 59.4, longitude: 24.7 } });
  const anonymousAfter = await loadPeerServiceMapEntries({ db, loadHelpEntries: load });
  expect("anonymous payload is identical before and after a peer row exists", JSON.stringify(anonymousBefore) === JSON.stringify(anonymousAfter));
  expect("anonymous payload contains no peer entry", anonymousAfter.entries.length === 0 && anonymousAfter.peerListingsAvailable === false);
  const authenticated = await loadPeerServiceMapEntries({ userId: "peer-owner", query: { type: "HELP_REQUEST", locale: "et" }, db, loadHelpEntries: load });
  expect("authenticated viewer receives the public projection", authenticated.peerListingsAvailable === true && authenticated.entries.length === 1 && authenticated.entries[0].id === "peer-map");
  await db.helpMapEntry.delete({ where: { id: "peer-map" } });
  const authenticatedZero = await loadPeerServiceMapEntries({ userId: "peer-owner", query: { type: "HELP_REQUEST" }, db, loadHelpEntries: load });
  expect("authenticated capability remains true with zero rows", authenticatedZero.peerListingsAvailable === true && authenticatedZero.entries.length === 0);
  console.log(`PROBE_OK ${passed}/${passed}`);
} finally {
  await db.$disconnect().catch(() => null);
  await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1", [databaseName]).catch(() => null);
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => null);
  await admin.end().catch(() => null);
  console.log("CLEANUP_OK temporary_database_removed");
}
