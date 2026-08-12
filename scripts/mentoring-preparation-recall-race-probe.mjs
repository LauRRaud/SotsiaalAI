#!/usr/bin/env node
/** SOL-SHARE-05 — mentor open versus owner recall on real PostgreSQL. */

import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import pg from "pg";
import { PrismaClient } from "../generated/prisma/client.ts";
import {
  markMentoringPreparationOpened,
  recallMentoringPreparation
} from "../lib/mentoring/preparationService.js";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const sourceUrl = String(process.env.DATABASE_URL || "").trim();
if (!sourceUrl) throw new Error("DATABASE_URL puudub");
const parsed = new URL(sourceUrl);
if (!new Set(["localhost", "127.0.0.1", "::1", "[::1]"]).has(parsed.hostname)) {
  throw new Error(`Sond loob ajutise andmebaasi ainult localhostil (host: ${parsed.hostname})`);
}
const databaseName = `sotsiaal_ai_mentoring_recall_probe_${Date.now()}`;
if (!/^sotsiaal_ai_mentoring_recall_probe_\d+$/.test(databaseName)) throw new Error("Ebaturvaline andmebaasinimi");
const adminUrl = new URL(parsed);
adminUrl.pathname = "/postgres";
adminUrl.search = "";
const probeUrl = new URL(parsed);
probeUrl.pathname = `/${databaseName}`;
const admin = new pg.Client({ connectionString: adminUrl.toString() });
const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: probeUrl.toString() }), log: [] });
let passed = 0;

function expect(label, condition) {
  if (!condition) throw new Error(`PROBE_FAIL ${label}`);
  passed += 1;
  console.log(`  PASS  ${label}`);
}

function deploy() {
  const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: probeUrl.toString() }, stdio: "pipe", shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`prisma migrate deploy failed (${result.status})`);
}

await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  deploy();
  const mentor = await db.user.create({ data: { email: "mentor-race@example.test", role: "SOCIAL_WORKER" } });
  const mentee = await db.user.create({ data: { email: "mentee-race@example.test", role: "SOCIAL_WORKER" } });
  const relation = await db.mentoringRelation.create({
    data: { mentorUserId: mentor.id, menteeUserId: mentee.id, status: "ACTIVE" }
  });
  const MENTOR = { userId: mentor.id, role: "SOCIAL_WORKER" };
  const MENTEE = { userId: mentee.id, role: "SOCIAL_WORKER" };

  for (const [suffix, calls] of [
    ["open-first", (note) => [
      markMentoringPreparationOpened(MENTOR, relation.id, note.id, { db, now: new Date("2026-08-13T10:01:00Z") }),
      recallMentoringPreparation(MENTEE, relation.id, note.id, { db, now: new Date("2026-08-13T10:01:00Z") })
    ]],
    ["recall-first", (note) => [
      recallMentoringPreparation(MENTEE, relation.id, note.id, { db, now: new Date("2026-08-13T10:02:00Z") }),
      markMentoringPreparationOpened(MENTOR, relation.id, note.id, { db, now: new Date("2026-08-13T10:02:00Z") })
    ]]
  ]) {
    const note = await db.mentoringPrivateNote.create({
      data: {
        ownerId: mentee.id,
        relationId: relation.id,
        kind: "PREPARATION",
        content: `private-${suffix}`,
        sharedContent: `frozen-${suffix}`,
        sharedAt: new Date("2026-08-13T10:00:00Z")
      }
    });
    const results = await Promise.allSettled(calls(note));
    const final = await db.mentoringPrivateNote.findUnique({ where: { id: note.id } });
    const auditCount = await db.mentoringAuditEvent.count({
      where: { relationId: relation.id, action: "PREPARATION_RECALLED", meta: { path: ["noteId"], equals: note.id } }
    });
    const notificationCount = await db.notificationEvent.count({ where: { sourceId: note.id } });
    expect(`${suffix}: exactly one transition wins`, results.filter(result => result.status === "fulfilled").length === 1);
    expect(`${suffix}: the loser is rejected`, results.filter(result => result.status === "rejected").length === 1);
    const recalled = Boolean(final.recalledAt);
    expect(`${suffix}: note state is coherent`, recalled
      ? final.openedByOtherAt === null && final.sharedContent === null
      : final.openedByOtherAt !== null && final.sharedContent === `frozen-${suffix}`);
    expect(`${suffix}: audit matches the winning state`, auditCount === (recalled ? 1 : 0));
    expect(`${suffix}: notification matches the winning state`, notificationCount === (recalled ? 1 : 0));
  }
  console.log(`PROBE_OK ${passed}/${passed}`);
} finally {
  await db.$disconnect().catch(() => null);
  await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`, [databaseName]).catch(() => null);
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => null);
  await admin.end().catch(() => null);
  console.log("CLEANUP_OK temporary_database_removed");
}
