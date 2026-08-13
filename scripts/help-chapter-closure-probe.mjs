#!/usr/bin/env node
/** SOL-HELP-10…13 — durable limiter, deep filtering/cursor and match lifecycle on PostgreSQL. */

import { spawn, spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { PrismaClient } from "../generated/prisma/client.ts";
import { consumeHelpRateLimit } from "../lib/help/rateLimit.js";
import { listPublishedHelpMapEntries } from "../lib/help/mapEntries.js";
import { deleteHelpRequest } from "../lib/help/requests.js";
import {
  closeHelpMatchForArchivedRoom,
  createHelpMatchAndRoom,
  decideHelpMatch,
  markHelpMatchContactedByRoom
} from "../lib/help/matches.js";
import { decodeServiceMapCursor } from "../lib/serviceMap/entriesQueryPolicy.js";

function clientFor(url) {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }), log: [] });
}

if (process.argv.includes("--rate-worker")) {
  const workerDb = clientFor(process.env.HELP_PROBE_DATABASE_URL);
  let allowed = 0;
  try {
    for (let index = 0; index < 70; index += 1) {
      const result = await consumeHelpRateLimit({
        operation: "list:get",
        userId: "shared-worker-user",
        ipAddress: "198.51.100.10"
      }, workerDb);
      if (result.allowed) allowed += 1;
    }
    process.stdout.write(String(allowed));
  } finally {
    await workerDb.$disconnect();
  }
  process.exit(0);
}

const DEFAULT_LOCAL_URL = "postgresql://sotsiaal_user:sotsiaalai@localhost:5432/sotsiaal_ai?schema=public";
const parsed = new URL(String(process.env.DATABASE_URL || DEFAULT_LOCAL_URL).trim());
if (!new Set(["localhost", "127.0.0.1", "::1", "[::1]"]).has(parsed.hostname)) {
  throw new Error(`HELP peatüki sond loob ajutise andmebaasi ainult localhostil (host=${parsed.hostname})`);
}
const databaseName = `sotsiaal_ai_help_close_probe_${Date.now()}`;
if (!/^sotsiaal_ai_help_close_probe_\d+$/.test(databaseName)) throw new Error("Ebaturvaline ajutise andmebaasi nimi");
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
function rateWorker() {
  return new Promise((resolve, reject) => {
    const loader = new URL("./register-node-test-loader.mjs", import.meta.url).href;
    const child = spawn(process.execPath, ["--import", loader, fileURLToPath(import.meta.url), "--rate-worker"], {
      cwd: process.cwd(),
      env: { ...process.env, HELP_PROBE_DATABASE_URL: probeUrl.toString() },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(Number(stdout)) : reject(new Error(stderr || `worker exit ${code}`)));
  });
}

await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  migrate();

  const workerCounts = await Promise.all([rateWorker(), rateWorker()]);
  check("kaks protsessi jagavad üht atomaarset user+IP+operation limiiti", workerCounts[0] + workerCounts[1] === 120);
  const separateOperation = await consumeHelpRateLimit({
    operation: "detail:get", userId: "shared-worker-user", ipAddress: "198.51.100.10"
  }, db);
  check("eri operatsioonil on eraldi kvoot", separateOperation.allowed && separateOperation.remaining === 59);

  const mapUser = await db.user.create({ data: { email: "help-map-probe@sotsiaalai.test" } });
  const mapCategory = await db.helpCategory.create({
    data: { code: "HELP_MAP_PROBE", labelEt: "Sond", labelEn: "Probe", labelRu: "Probe" }
  });
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const oldest = new Date("2026-01-01T00:00:00.000Z");
  await db.helpRequest.createMany({ data: Array.from({ length: 1002 }, (_, index) => ({
    id: `deep-request-${String(index).padStart(4, "0")}`,
    userId: mapUser.id,
    primaryCategoryId: mapCategory.id,
    title: index === 1001 ? "Ainulaadne vana nõel" : `Tavaline kirje ${index}`,
    description: "Sügava filtri sond",
    status: "OPEN",
    expiresAt
  })) });
  await db.helpMapEntry.createMany({ data: Array.from({ length: 1002 }, (_, index) => ({
    id: `deep-map-${String(index).padStart(4, "0")}`,
    kind: "HELP_REQUEST",
    requestId: `deep-request-${String(index).padStart(4, "0")}`,
    mapVisible: true,
    status: "PUBLISHED",
    serviceArea: index === 1001 ? "Võru vald" : "Tallinn",
    geocodingStatus: "MATCHED",
    latitude: 57.84,
    longitude: 27.0,
    expiresAt,
    updatedAt: index === 1001 ? oldest : new Date(oldest.getTime() + (index + 1) * 1000)
  })) });
  const deep = await listPublishedHelpMapEntries({
    keyword: "vana nõel", municipalityName: "Võru", limit: 10, paged: true, includeUnlocated: true
  }, db);
  check("DB-filter leiab üle 1000 uuema rea taga oleva täpse vaste", deep.entries.length === 1 && deep.entries[0].listingId === "deep-request-1001");

  const equalUpdatedAt = new Date("2026-02-01T00:00:00.000Z");
  await db.helpRequest.createMany({ data: Array.from({ length: 27 }, (_, index) => ({
    id: `cursor-request-${String(index).padStart(3, "0")}`,
    userId: mapUser.id, primaryCategoryId: mapCategory.id, title: `Cursor ${index}`,
    description: "võrdne kursor", status: "OPEN", expiresAt
  })) });
  await db.helpMapEntry.createMany({ data: Array.from({ length: 27 }, (_, index) => ({
    id: `cursor-map-${String(index).padStart(3, "0")}`,
    kind: "HELP_REQUEST", requestId: `cursor-request-${String(index).padStart(3, "0")}`,
    mapVisible: true, status: "PUBLISHED", serviceArea: "cursor-equal",
    geocodingStatus: "MATCHED", latitude: 58.0, longitude: 26.0, expiresAt, updatedAt: equalUpdatedAt
  })) });
  const query = { keyword: "cursor-equal", type: "HELP_REQUEST", includeUnlocated: true };
  const seen = [];
  let cursor = null;
  do {
    const page = await listPublishedHelpMapEntries({ ...query, limit: 10, paged: true, cursor }, db);
    seen.push(...page.entries.map((entry) => entry.id));
    cursor = page.page.hasMore ? decodeServiceMapCursor(page.page.nextCursor, query, "help") : null;
  } while (cursor);
  check("võrdse updatedAt-ga 27 rida läbivad kursori täpselt ühe korra", seen.length === 27 && new Set(seen).size === 27);

  const requester = await db.user.create({ data: { email: "help-requester-close@sotsiaalai.test" } });
  const offerer = await db.user.create({ data: { email: "help-offerer-close@sotsiaalai.test" } });
  const category = await db.helpCategory.create({ data: { code: "HELP_CLOSE_PROBE", labelEt: "Abi", labelEn: "Help", labelRu: "Help" } });
  const request = await db.helpRequest.create({ data: { userId: requester.id, primaryCategoryId: category.id, title: "Vajan abi", description: "Vajan abi", status: "OPEN", expiresAt } });
  const offer = await db.helpOffer.create({ data: { userId: offerer.id, primaryCategoryId: category.id, title: "Pakun abi", description: "Pakun abi", status: "OPEN", expiresAt } });
  await db.helpMapEntry.createMany({ data: [
    { kind: "HELP_REQUEST", requestId: request.id, mapVisible: true, status: "PUBLISHED", geocodingStatus: "MATCHED", latitude: 58, longitude: 26 },
    { kind: "HELP_OFFER", offerId: offer.id, mapVisible: true, status: "PUBLISHED", geocodingStatus: "MATCHED", latitude: 58, longitude: 26 }
  ] });
  const pending = await createHelpMatchAndRoom({ requestId: request.id, offerId: offer.id, initiatedByUserId: requester.id }, db);
  await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION "help_match_fail_fn"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'help_match_fail'; END $$`);
  await db.$executeRawUnsafe(`CREATE TRIGGER "help_match_fail" BEFORE UPDATE ON "HelpOffer" FOR EACH ROW WHEN (NEW."status" = 'MATCHED') EXECUTE FUNCTION "help_match_fail_fn"()`);
  let rollbackObserved = false;
  try { await decideHelpMatch({ matchId: pending.id, decidedByUserId: offerer.id, decision: "ACCEPT" }, db); } catch { rollbackObserved = true; }
  const afterFailure = await db.helpMatch.findUnique({ where: { id: pending.id }, include: { request: true, offer: true } });
  check("olekukirjutuse veasüst rollback'ib match'i, allikad ja ruumi", rollbackObserved && afterFailure.status === "PENDING" && afterFailure.request.status === "OPEN" && afterFailure.offer.status === "OPEN" && afterFailure.roomId === null);
  await db.$executeRawUnsafe(`DROP TRIGGER "help_match_fail" ON "HelpOffer"`);
  await db.$executeRawUnsafe(`DROP FUNCTION "help_match_fail_fn"()`);
  const accepted = await decideHelpMatch({ matchId: pending.id, decidedByUserId: offerer.id, decision: "ACCEPT" }, db);
  const matchedSources = await Promise.all([db.helpRequest.findUnique({ where: { id: request.id } }), db.helpOffer.findUnique({ where: { id: offer.id } })]);
  check("ACCEPT seob ruumi, MATCHED allikad ja peidetud kaardikirjed", accepted.status === "ACCEPTED" && Boolean(accepted.roomId) && matchedSources.every((row) => row.status === "MATCHED") && await db.helpMapEntry.count({ where: { OR: [{ requestId: request.id }, { offerId: offer.id }], mapVisible: false, status: "HIDDEN" } }) === 2);
  await markHelpMatchContactedByRoom({ roomId: accepted.roomId }, db);
  check("esimene kontakt viib match'i CONTACTED olekusse", (await db.helpMatch.findUnique({ where: { id: pending.id } })).status === "CONTACTED");
  await closeHelpMatchForArchivedRoom({ roomId: accepted.roomId }, db);
  const closed = await db.helpMatch.findUnique({ where: { id: pending.id }, include: { request: true, offer: true } });
  check("ruumi sulgemine lõpetab match'i ja mõlemad allikad", closed.status === "CLOSED" && closed.request.status === "CLOSED" && closed.offer.status === "CLOSED");
  const deletion = await deleteHelpRequest(request.id, { actorUserId: requester.id }, db);
  check("ruumiga CLOSED match säilib allikakuulutuse kustutussoovi järel tõendina", deletion.disposition === "CLOSED_ACCEPTED_MATCH" && await db.helpMatch.count({ where: { id: pending.id, roomId: accepted.roomId } }) === 1);

  console.log(`PROBE_OK ${passed}/${passed}`);
} finally {
  await db.$disconnect().catch(() => null);
  await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1", [databaseName]).catch(() => null);
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => null);
  await admin.end().catch(() => null);
  console.log("CLEANUP_OK temporary_database_removed");
}
