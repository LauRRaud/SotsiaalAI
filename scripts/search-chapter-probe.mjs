#!/usr/bin/env node
/** SOL-SEARCH-01/-03/-06 — real PostgreSQL pagination and cross-process boundaries. */

import { spawn, spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { PrismaClient } from "../generated/prisma/client.ts";
import { searchPersonalObjects } from "../lib/search/personalSearch.js";
import { consumePersonalSearchRateLimit } from "../lib/search/rateLimit.js";
import { runRetentionMaintenanceWithSharedLock } from "../lib/search/retentionMaintenance.js";

function clientFor(url) {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }), log: [] });
}

if (process.argv.includes("--limit-worker")) {
  const db = clientFor(process.env.SEARCH_PROBE_DATABASE_URL);
  let allowed = 0;
  try {
    for (let index = 0; index < 20; index += 1) {
      const decision = await consumePersonalSearchRateLimit({
        prisma: db,
        request: { headers: new Headers({ "x-forwarded-for": `203.0.113.${index}` }) },
        userId: "shared-search-user",
        limit: 30,
        windowMs: 60_000
      });
      if (decision.allowed) allowed += 1;
    }
    process.stdout.write(String(allowed));
  } finally {
    await db.$disconnect();
  }
  process.exit(0);
}

if (process.argv.includes("--retention-worker")) {
  const outcome = await runRetentionMaintenanceWithSharedLock({
    databaseUrl: process.env.SEARCH_PROBE_DATABASE_URL,
    retryAfterSeconds: 2,
    run: async () => {
      const client = new pg.Client({ connectionString: process.env.SEARCH_PROBE_DATABASE_URL });
      await client.connect();
      try {
        await client.query("INSERT INTO search_retention_runs DEFAULT VALUES");
        await client.query("SELECT pg_sleep(1)");
      } finally {
        await client.end();
      }
      return { ok: true };
    }
  });
  process.stdout.write(JSON.stringify(outcome));
  process.exit(0);
}

const DEFAULT_LOCAL_URL = "postgresql://sotsiaal_user:sotsiaalai@localhost:5432/sotsiaal_ai?schema=public";
const parsed = new URL(String(process.env.DATABASE_URL || DEFAULT_LOCAL_URL).trim());
if (!new Set(["localhost", "127.0.0.1", "::1", "[::1]"]).has(parsed.hostname)) {
  throw new Error(`SEARCH sond loob ajutise andmebaasi ainult localhostil (host=${parsed.hostname})`);
}
const databaseName = `sotsiaal_ai_search_probe_${Date.now()}`;
if (!/^sotsiaal_ai_search_probe_\d+$/.test(databaseName)) throw new Error("Ebaturvaline ajutise andmebaasi nimi");
const adminUrl = new URL(parsed); adminUrl.pathname = "/postgres"; adminUrl.search = "";
const probeUrl = new URL(parsed); probeUrl.pathname = `/${databaseName}`;
const admin = new pg.Client({ connectionString: adminUrl.toString() });
const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
const db = clientFor(probeUrl.toString());
let passed = 0;

function check(label, condition) {
  if (!condition) throw new Error(`PROBE_FAIL ${label}`);
  passed += 1;
  console.log(`  PASS  ${label}`);
}

function migrate() {
  const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: probeUrl.toString() }, stdio: "pipe", shell: false
  });
  if (result.status !== 0) throw new Error(`prisma migrate deploy failed: ${result.stderr}`);
}

function worker(mode) {
  return new Promise((resolve, reject) => {
    const loader = new URL("./register-node-test-loader.mjs", import.meta.url).href;
    const child = spawn(process.execPath, ["--import", loader, fileURLToPath(import.meta.url), mode], {
      cwd: process.cwd(),
      env: { ...process.env, SEARCH_PROBE_DATABASE_URL: probeUrl.toString(), TRUSTED_PROXY_IP_HEADER: "" },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || `worker exit ${code}`)));
  });
}

await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  migrate();

  const owner = await db.user.create({ data: { email: "search-owner@sotsiaalai.test" } });
  const foreign = await db.user.create({ data: { email: "search-foreign@sotsiaalai.test" } });
  const equalAt = new Date("2026-08-13T08:00:00.000Z");
  for (let index = 0; index < 9; index += 1) {
    await db.conversation.create({ data: {
      id: `search-c-${index}`, userId: owner.id, role: "CLIENT", title: `Probe conversation ${index}`,
      lastActivityAt: equalAt
    } });
    await db.journey.create({ data: {
      id: `search-j-${index}`, ownerUserId: owner.id, title: `Probe journey ${index}`,
      summary: "synthetic", updatedAt: equalAt
    } });
    await db.userDocument.create({ data: {
      id: `search-d-${index}`, ownerId: owner.id, title: `Probe document ${index}`,
      originalName: `probe-${index}.txt`, mime: "text/plain", size: 1,
      sha256: `${index}`.padStart(64, "0"), storagePath: `search-probe/${index}.txt`, updatedAt: equalAt
    } });
  }
  await db.userDocument.create({ data: {
    id: "search-foreign-document", ownerId: foreign.id, title: "Probe foreign document",
    originalName: "foreign.txt", mime: "text/plain", size: 1,
    sha256: "f".repeat(64), storagePath: "search-probe/foreign.txt", updatedAt: equalAt
  } });

  const first = await searchPersonalObjects({ prisma: db, userId: owner.id, query: "Probe" });
  const second = await searchPersonalObjects({
    prisma: db, userId: owner.id, query: "Probe", cursor: first.pagination.nextCursor
  });
  const allTargets = [...first.results, ...second.results].map((item) => `${item.kind}:${item.href}`);
  check("9 võrdse ajaga tulemust liigi kohta läbivad kaks lehte ilma duplikaadita", allTargets.length === 27 && new Set(allTargets).size === 27);
  check("hasMore ja liigikursor on esimese järel aus ning teise järel lõppenud", first.pagination.hasMore && !second.pagination.hasMore);
  check("võõra omaniku dokument ei leki otsingusse", allTargets.every((target) => !target.includes("search-foreign-document")));
  check("dokumendi tulemused viivad eri omaniku kontrollitud detailidesse", new Set(first.results.filter((item) => item.kind === "document").map((item) => item.href)).size === 8);

  const limitCounts = await Promise.all([worker("--limit-worker"), worker("--limit-worker")]);
  check("kaks protsessi ja vahetuvad spoof-päised jagavad üht 30 päringu limiiti", limitCounts.map(Number).reduce((a, b) => a + b, 0) === 30);

  await db.$executeRawUnsafe("CREATE TABLE search_retention_runs (id bigserial PRIMARY KEY)");
  const retentionOutcomes = (await Promise.all([
    worker("--retention-worker"), worker("--retention-worker")
  ])).map(JSON.parse);
  check("kahe protsessi vahel töötab korraga üks retention-sweep", retentionOutcomes.filter((item) => item.ran).length === 1 && await db.$queryRawUnsafe("SELECT count(*)::int AS count FROM search_retention_runs").then((rows) => rows[0].count === 1));
  check("kaotaja saab kontrollitud retry-vastuse", retentionOutcomes.some((item) => !item.ran && item.reason === "already_running" && item.retryAfterSeconds === 2));
  const retry = JSON.parse(await worker("--retention-worker"));
  check("pärast luku vabanemist õnnestub uus sweep", retry.ran === true);

  console.log(`PROBE_OK ${passed}/${passed}`);
} finally {
  await db.$disconnect().catch(() => null);
  await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1", [databaseName]).catch(() => null);
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => null);
  await admin.end().catch(() => null);
  console.log("CLEANUP_OK temporary_database_removed");
}
