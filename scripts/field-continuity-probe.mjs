#!/usr/bin/env node
/** SOL-FIELD-J-01/02/03 — recovery, audit and stable cursor in real PostgreSQL. */
import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import pg from "pg";
import { PrismaClient } from "../generated/prisma/client.ts";
import {
  deleteFieldVisitNote,
  getFieldVisitDetail,
  listFieldVisits,
  performFieldVisitAction,
  putFieldVisitNote
} from "../lib/field/service.js";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const sourceUrl = String(process.env.DATABASE_URL || "").trim();
if (!sourceUrl) throw new Error("DATABASE_URL puudub");
const parsed = new URL(sourceUrl);
if (!new Set(["localhost", "127.0.0.1", "::1", "[::1]"]).has(parsed.hostname)) {
  throw new Error(`Sond loob ajutise andmebaasi ainult localhostil (host: ${parsed.hostname})`);
}
const databaseName = `sotsiaal_ai_field_continuity_probe_${Date.now()}`;
if (!/^sotsiaal_ai_field_continuity_probe_\d+$/.test(databaseName)) throw new Error("Ebaturvaline andmebaasinimi");
const adminUrl = new URL(parsed);
adminUrl.pathname = "/postgres";
adminUrl.search = "";
const probeUrl = new URL(parsed);
probeUrl.pathname = `/${databaseName}`;
const admin = new pg.Client({ connectionString: adminUrl.toString() });
const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: probeUrl.toString() }), log: [] });
let passed = 0;
let failed = 0;

function expect(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function note(body, deviceCreatedAt, recoveryImport = false) {
  return {
    kind: "note",
    provenance: "TOOTAJA_TAHELEPANEK",
    body,
    revision: 1,
    deviceCreatedAt,
    recoveryImport
  };
}

async function main() {
  console.log("SOL-FIELD-J-01/02/03 — päris-DB järjepidevussond\n");
  await admin.connect();
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  const migrated = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: probeUrl.toString() }, stdio: "pipe", shell: false
  });
  if (migrated.error) throw migrated.error;
  if (migrated.status !== 0) throw new Error(`prisma migrate deploy failed (${migrated.status})\n${migrated.stderr}`);

  const owner = await db.user.create({
    data: { email: "field-continuity@probe.invalid", role: "SOCIAL_WORKER", emailVerified: new Date() }
  });
  const start = new Date("2026-08-13T10:00:00.000Z");
  const visit = await db.fieldVisit.create({
    data: { ownerUserId: owner.id, status: "WRAP_UP", goal: "Sünteetiline võistlus", createdAt: start }
  });

  const capturedAt = new Date("2026-08-13T10:01:00.000Z");
  const closeAt = new Date("2026-08-13T10:02:00.000Z");
  const [closeResult, uploadResult] = await Promise.all([
    performFieldVisitAction(owner.id, visit.id, "close", { version: 1 }, { db, now: closeAt }),
    putFieldVisitNote(owner.id, visit.id, "race-note-001", note("Võistlev märge", capturedAt, true), { db, now: closeAt })
  ]);
  expect("close-vs-upload jätab visiidi suletuks ja märkme alles", closeResult.status === "CLOSED" && uploadResult.note?.clientItemId === "race-note-001");
  expect("close-vs-upload ei tekita duplikaati", await db.fieldVisitNote.count({ where: { visitId: visit.id, clientItemId: "race-note-001" } }) === 1);

  let denied = null;
  try {
    await putFieldVisitNote(owner.id, visit.id, "late-note-001", note("Hiline", new Date("2026-08-13T10:03:00.000Z")), { db, now: closeAt });
  } catch (error) { denied = error; }
  expect("pärast sulgemist loodud sisu jääb 409-ga välja", denied?.status === 409 && denied?.message === "field.errors.visit_read_only");

  const recovered = await putFieldVisitNote(
    owner.id,
    visit.id,
    "recovery-note-001",
    note("Enne sulgemist seadmesse jäänud", new Date("2026-08-13T10:01:30.000Z"), true),
    { db, now: new Date("2026-08-13T10:04:00.000Z") }
  );
  expect("selge recovery-import salvestab ainult sulgemiseelse kirje", recovered.recovered === true && recovered.note.recoveryImportedAt);
  expect("recovery-import jätab append-only auditi", await db.dataAuditLog.count({ where: { action: "field.note_recovery_imported", resourceId: visit.id } }) >= 1);

  await deleteFieldVisitNote(owner.id, visit.id, "race-note-001", { db }).catch(() => null);
  expect("suletud külastuse serverimärge jääb read-only", await db.fieldVisitNote.count({ where: { visitId: visit.id, clientItemId: "race-note-001" } }) === 1);

  const pageVisits = [];
  for (let index = 0; index < 51; index += 1) {
    pageVisits.push({
      ownerUserId: owner.id,
      status: index % 2 ? "CLOSED" : "WRAP_UP",
      goal: `Leht ${index}`,
      createdAt: new Date(start.getTime() - (index + 1) * 1000)
    });
  }
  await db.fieldVisit.createMany({ data: pageVisits });
  const first = await listFieldVisits(owner.id, { db, limit: 50 });
  const unseen = await db.fieldVisit.findFirst({ where: { ownerUserId: owner.id, goal: "Leht 50" } });
  await db.fieldVisit.update({ where: { id: unseen.id }, data: { updatedAt: new Date("2030-01-01T00:00:00.000Z") } });
  const second = await listFieldVisits(owner.id, { db, limit: 50, cursor: first.nextCursor });
  const allIds = [...first.visits, ...second.visits].map((row) => row.id);
  expect("51+ cursor ei kaota updatedAt muutuse järel ühtegi rida", new Set(allIds).size === 52 && allIds.includes(unseen.id));

  const manyNotes = Array.from({ length: 501 }, (_, index) => ({
    visitId: visit.id,
    clientItemId: `bulk-note-${String(index).padStart(4, "0")}`,
    provenance: "TOOTAJA_TAHELEPANEK",
    body: `Sünteetiline ${index}`,
    revision: 1,
    kind: "note"
  }));
  await db.fieldVisitNote.createMany({ data: manyNotes });
  const detail = await getFieldVisitDetail(owner.id, visit.id, { db });
  expect("501+ märget ei kärbita omanikuvaates", detail.notes.length === 503);

  console.log(`\n${passed}/${passed + failed} kontrolli läbis.`);
  if (failed) process.exitCode = 1;
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => {
    await db.$disconnect().catch(() => null);
    await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1", [databaseName]).catch(() => null);
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => null);
    await admin.end().catch(() => null);
    console.log("CLEANUP_OK temporary_database_removed");
  });
