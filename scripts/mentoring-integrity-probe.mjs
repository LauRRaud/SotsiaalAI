#!/usr/bin/env node
/** SOL-MENT-01…07 — mentorluse tervikluse päris PostgreSQL-i sond. */

import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import pg from "pg";
import { PrismaClient } from "../generated/prisma/client.ts";
import { upsertOwnMentorProfile, submitOwnMentorProfile } from "../lib/mentoring/profileService.js";
import { reviewMentorProfile, setExternalConsentStatus } from "../lib/mentoring/adminService.js";
import { getCatalogProfile, listMentorCatalog } from "../lib/mentoring/catalogService.js";
import { getMentoringRelation } from "../lib/mentoring/relationService.js";
import { createMentoringMeeting } from "../lib/mentoring/meetingService.js";
import {
  confirmMentoringSummary,
  discardMentoringSummary,
  submitMentoringSummary,
  superseedMentoringSummary
} from "../lib/mentoring/summaryService.js";
import {
  markMentoringPreparationOpened,
  recallMentoringPreparation
} from "../lib/mentoring/preparationService.js";
import { runMentoringSweep } from "../lib/mentoring/sweep.js";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const sourceUrl = String(process.env.DATABASE_URL || "").trim();
if (!sourceUrl) throw new Error("DATABASE_URL puudub");
const parsed = new URL(sourceUrl);
if (!new Set(["localhost", "127.0.0.1", "::1", "[::1]"]).has(parsed.hostname)) {
  throw new Error(`Sond loob ajutise andmebaasi ainult localhostil (host: ${parsed.hostname})`);
}
const databaseName = `sotsiaal_ai_mentoring_integrity_probe_${Date.now()}`;
if (!/^sotsiaal_ai_mentoring_integrity_probe_\d+$/.test(databaseName)) throw new Error("Ebaturvaline andmebaasinimi");
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

async function rejects(label, promise, code) {
  const result = await Promise.resolve(promise).then(() => null, (error) => error);
  expect(label, result?.code === code || (code === "NOT_FOUND" && result?.status === 404));
}

function deploy() {
  const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: probeUrl.toString() }, stdio: "pipe", shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`prisma migrate deploy failed (${result.status})\n${result.stderr}`);
}

await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  deploy();
  const now = new Date();
  const mentor = await db.user.create({ data: { email: "mentor-integrity@example.test", role: "SOCIAL_WORKER" } });
  const mentee = await db.user.create({ data: { email: "mentee-integrity@example.test", role: "SOCIAL_WORKER" } });
  const adminUser = await db.user.create({ data: { email: "admin-integrity@example.test", role: "ADMIN", isAdmin: true } });
  const MENTOR = { userId: mentor.id, role: "SOCIAL_WORKER" };
  const MENTEE = { userId: mentee.id, role: "SOCIAL_WORKER" };
  const ADMIN = { userId: adminUser.id, role: "ADMIN" };

  // MENT-01 — kinnitatud snapshot jääb avalikuks, uus tekst läheb ülevaatusele.
  await upsertOwnMentorProfile(MENTOR, {
    displayName: "Approved mentor", bioShort: "Approved bio", fields: ["Approved field"]
  }, { db, now });
  await submitOwnMentorProfile(MENTOR, { db, now });
  let profile = await db.mentorProfile.findUnique({ where: { userId: mentor.id } });
  await reviewMentorProfile(ADMIN, profile.id, "APPROVE", {}, { db, now });
  profile = await db.mentorProfile.findUnique({ where: { id: profile.id } });
  await upsertOwnMentorProfile(MENTOR, {
    expectedVersion: profile.version,
    displayName: "Unreviewed mentor", bioShort: "Unreviewed bio", fields: ["Unreviewed field"]
  }, { db, now: new Date(now.getTime() + 1_000) });
  const publicProfile = await getCatalogProfile(MENTEE, profile.id, { db, now });
  expect("MENT-01 edit returns to review", (await db.mentorProfile.findUnique({ where: { id: profile.id } })).status === "PENDING_REVIEW");
  expect("MENT-01 only approved snapshot is public", publicProfile.displayName === "Approved mentor" && publicProfile.bioShort === "Approved bio");

  // MENT-02 — struktureeritud tõend ja fail-closed aegumine koos adminiteatega.
  const external = await db.mentorProfile.create({
    data: { origin: "ESTA_IMPORT", status: "EXTERNAL_REFERENCE", consentStatus: "PENDING_CONSENT", displayName: "External mentor" }
  });
  await rejects("MENT-02 consent without evidence is rejected",
    setExternalConsentStatus(ADMIN, external.id, { consentStatus: "CONSENTED" }, { db, now }), "CONSENT_EVIDENCE_REQUIRED");
  await setExternalConsentStatus(ADMIN, external.id, {
    consentStatus: "CONSENTED", consentEvidenceType: "WRITTEN", consentEvidenceRef: "probe-proof"
  }, { db, now });
  expect("MENT-02 evidenced consent is catalog-visible", (await listMentorCatalog(MENTEE, {}, { db, now })).some((item) => item.id === external.id));
  await db.mentorProfile.update({
    where: { id: external.id },
    data: { checkedAt: new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds() - 1)) }
  });
  const staleSweep = await runMentoringSweep({ db, now });
  expect("MENT-02 stale consent transitions once", staleSweep.externalConsentsStaled === 1
    && (await db.mentorProfile.findUnique({ where: { id: external.id } })).consentStatus === "STALE");
  expect("MENT-02 admin notification is persisted", await db.notificationEvent.count({
    where: { type: "MENTORING_EXTERNAL_CONSENT_STALE", userId: adminUser.id, sourceId: external.id }
  }) === 1);

  const relation = await db.mentoringRelation.create({
    data: { mentorUserId: mentor.id, menteeUserId: mentee.id, status: "ACTIVE", lastActivityAt: now }
  });

  // MENT-03 — GET ei väljasta sisu enne aatomset avamisnõuet; recall/open võistlusel üks võidab.
  const note = await db.mentoringPrivateNote.create({
    data: {
      ownerId: mentee.id, relationId: relation.id, kind: "PREPARATION", content: "private",
      sharedContent: "frozen", sharedAt: now
    }
  });
  const beforeOpen = await getMentoringRelation(MENTOR, relation.id, { db });
  expect("MENT-03 ordinary GET hides content before claim", beforeOpen.preparations[0]?.sharedContent === null);
  const race = await Promise.allSettled([
    markMentoringPreparationOpened(MENTOR, relation.id, note.id, { db, now: new Date(now.getTime() + 2_000) }),
    recallMentoringPreparation(MENTEE, relation.id, note.id, { db, now: new Date(now.getTime() + 2_000) })
  ]);
  expect("MENT-03 exactly one concurrent transition wins", race.filter((result) => result.status === "fulfilled").length === 1);
  const finalNote = await db.mentoringPrivateNote.findUnique({ where: { id: note.id } });
  expect("MENT-03 persisted state matches winner", Boolean(finalNote.openedByOtherAt) !== Boolean(finalNote.recalledAt));

  // MENT-04 — algne viide tekib alles paranduse teise kinnitusega.
  const original = await db.mentoringSummary.create({
    data: { relationId: relation.id, content: "Original", status: "CONFIRMED", confirmedAt: now, createdByUserId: mentee.id }
  });
  const discarded = await superseedMentoringSummary(MENTOR, relation.id, original.id, { content: "Discard me" }, { db, now });
  expect("MENT-04 correction draft carries origin", discarded.correctionOfId === original.id);
  expect("MENT-04 original remains current during draft", (await db.mentoringSummary.findUnique({ where: { id: original.id } })).supersededById === null);
  await discardMentoringSummary(MENTOR, relation.id, discarded.id, { db, now });
  expect("MENT-04 discard leaves original unchanged", (await db.mentoringSummary.findUnique({ where: { id: original.id } })).supersededById === null);
  const replacement = await superseedMentoringSummary(MENTOR, relation.id, original.id, { content: "Accepted correction" }, { db, now });
  await submitMentoringSummary(MENTOR, relation.id, replacement.id, { expectedVersion: replacement.version }, { db, now });
  await confirmMentoringSummary(MENTOR, relation.id, replacement.id, { db, now });
  expect("MENT-04 first confirmation does not supersede", (await db.mentoringSummary.findUnique({ where: { id: original.id } })).supersededById === null);
  await confirmMentoringSummary(MENTEE, relation.id, replacement.id, { db, now });
  expect("MENT-04 second confirmation links atomically", (await db.mentoringSummary.findUnique({ where: { id: original.id } })).supersededById === replacement.id);

  // MENT-05/06 — ruum on kohustuslik ja mõlemad pooled peavad olema aktiivsed; offsetita aeg ei lähe läbi.
  await rejects("MENT-06 offsetless time is rejected",
    createMentoringMeeting(MENTEE, relation.id, { occurredAt: "2026-07-15T10:30", mode: "EXTERNAL" }, { db, now }),
    "INVALID_MEETING_TIME");
  await rejects("MENT-05 missing room id is rejected",
    createMentoringMeeting(MENTEE, relation.id, { occurredAt: new Date(now.getTime() + 3 * 86_400_000).toISOString(), mode: "PLATFORM_ROOM" }, { db, now }),
    "MEETING_ROOM_REQUIRED");
  const room = await db.room.create({ data: { ownerId: mentee.id, title: "Shared room" } });
  await db.roomMember.create({ data: { roomId: room.id, userId: mentee.id } });
  await rejects("MENT-05 actor-only room is rejected",
    createMentoringMeeting(MENTEE, relation.id, {
      occurredAt: new Date(now.getTime() + 3 * 86_400_000).toISOString(), mode: "PLATFORM_ROOM", roomId: room.id
    }, { db, now }), "NOT_FOUND");
  await db.roomMember.create({ data: { roomId: room.id, userId: mentor.id } });
  const roomMeeting = await createMentoringMeeting(MENTEE, relation.id, {
    occurredAt: new Date(now.getTime() + 3 * 86_400_000).toISOString(), mode: "PLATFORM_ROOM", roomId: room.id
  }, { db, now });
  expect("MENT-05 shared active room is stored", roomMeeting.roomId === room.id);
  await db.roomMember.update({ where: { roomId_userId: { roomId: room.id, userId: mentor.id } }, data: { leftAt: now } });
  await rejects("MENT-05 departed member invalidates room",
    createMentoringMeeting(MENTEE, relation.id, {
      occurredAt: new Date(now.getTime() + 4 * 86_400_000).toISOString(), mode: "PLATFORM_ROOM", roomId: room.id
    }, { db, now }), "NOT_FOUND");

  // MENT-07 — stabiilne (occurredAt,id) lehitsemine läbib 2,5 pakki.
  const rows = Array.from({ length: 125 }, (_, index) => ({
    id: `bulk-${String(index).padStart(3, "0")}`,
    relationId: relation.id,
    occurredAt: new Date(now.getTime() + (index + 1) * 60_000),
    status: "PLANNED",
    mode: "EXTERNAL"
  }));
  await db.mentoringMeeting.createMany({ data: rows });
  const first = await runMentoringSweep({ db, now, batchSize: 50 });
  expect("MENT-07 2.5 batches are all processed", first.meetingsUpcoming === 125 && first.notificationsCreated === 250);
  const second = await runMentoringSweep({ db, now, batchSize: 50 });
  expect("MENT-07 rerun is idempotent", second.meetingsUpcoming === 0 && second.notificationsCreated === 0);
  await db.mentoringMeeting.update({ where: { id: rows[0].id }, data: { occurredAt: new Date(now.getTime() + 45 * 60_000) } });
  const third = await runMentoringSweep({ db, now, batchSize: 50 });
  expect("MENT-07 same-day reschedule emits a new reminder", third.meetingsUpcoming === 1 && third.notificationsCreated === 2);

  console.log(`PROBE_OK ${passed}/${passed}`);
} finally {
  await db.$disconnect().catch(() => null);
  await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`, [databaseName]).catch(() => null);
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => null);
  await admin.end().catch(() => null);
  console.log("CLEANUP_OK temporary_database_removed");
}
