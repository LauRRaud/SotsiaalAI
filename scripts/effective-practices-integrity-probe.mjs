#!/usr/bin/env node
/** SOL-PRAC-01/02 — publishing capability revalidation and review-vs-repair PostgreSQL probe. */

import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import pg from "pg";
import { PrismaClient } from "../generated/prisma/client.ts";
import { createEffectivePracticeService } from "../lib/effectivePractices.js";
import { runEffectivePracticeRagRecovery } from "../lib/effectivePracticeRagRecovery.js";
import { reconcileNotificationEvents } from "../lib/notificationReconciler.js";
import { raceOnLockedRow } from "./probe-race-harness.mjs";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const sourceUrl = String(process.env.DATABASE_URL || "").trim();
if (!sourceUrl) throw new Error("DATABASE_URL puudub");
const parsed = new URL(sourceUrl);
if (!new Set(["localhost", "127.0.0.1", "::1", "[::1]"]).has(parsed.hostname)) {
  throw new Error(`Sond loob ajutise andmebaasi ainult localhostil (host: ${parsed.hostname})`);
}
const databaseName = `sotsiaal_ai_practices_integrity_probe_${Date.now()}`;
if (!/^sotsiaal_ai_practices_integrity_probe_\d+$/.test(databaseName)) throw new Error("Ebaturvaline andmebaasinimi");
const adminUrl = new URL(parsed);
adminUrl.pathname = "/postgres";
adminUrl.search = "";
const probeUrl = new URL(parsed);
probeUrl.pathname = `/${databaseName}`;
const admin = new pg.Client({ connectionString: adminUrl.toString() });
const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: probeUrl.toString() }), log: [] });
const NOW = new Date("2026-08-14T01:00:00.000Z");
let passed = 0;

function expect(label, condition, detail = "") {
  if (!condition) throw new Error(`PROBE_FAIL ${label}${detail ? ` (${detail})` : ""}`);
  passed += 1;
  console.log(`  PASS  ${label}`);
}

function deploy() {
  const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: probeUrl.toString() }, stdio: "pipe", shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`prisma migrate deploy failed (${result.status})\n${result.stderr}`);
}

async function user(email, role = "SOCIAL_WORKER") {
  return db.user.create({ data: { email, role } });
}

async function practice(authorId, suffix, overrides = {}) {
  return db.effectivePractice.create({ data: {
    authorId, title: `Generalised practice ${suffix}`, summary: "General professional workflow",
    suitableContext: "KOV", conditions: ["Consent"], limitations: "Not for emergencies", steps: ["Assess"],
    practiceType: "Network", targetGroups: ["Adults"], environments: ["KOV"], topics: ["coordination"],
    sources: "Approved guidance", status: "IN_REVIEW", contentVersion: 1, version: 0,
    ownerConfirmedNoIdentifiersAt: NOW, ownerConfirmedNoIdentifiersVersion: 1, ...overrides
  } });
}

async function capability(userId, type, overrides = {}) {
  return db.practiceCapability.create({ data: {
    userId, type, scope: "", validFrom: new Date("2026-01-01"), validUntil: new Date("2027-01-01"),
    grantBasis: "probe", ...overrides
  } });
}

async function rawReview(assignmentId) {
  return db.$transaction(async (tx) => {
    const updated = await tx.effectivePracticeReviewAssignment.updateMany({
      where: { id: assignmentId, status: "ASSIGNED" }, data: { status: "COMPLETED", completedAt: NOW }
    });
    if (updated.count !== 1) throw Object.assign(new Error("REVIEW_CAS_LOST"), { code: "REVIEW_CAS_LOST" });
    return updated;
  });
}

await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  deploy();
  const [author, approver, reviewer, editor, ethics, replacement, erased] = await Promise.all([
    user("prac-author@example.test"), user("prac-approver@example.test"), user("prac-reviewer@example.test"),
    user("prac-editor@example.test"), user("prac-ethics@example.test"), user("prac-replacement@example.test"),
    user("prac-erased@example.test")
  ]);
  await Promise.all([
    capability(approver.id, "APPROVER"), capability(reviewer.id, "REVIEWER"), capability(editor.id, "EDITOR"),
    capability(ethics.id, "ETHICS", { validUntil: new Date("2026-08-13T23:59:59.000Z") }),
    capability(replacement.id, "REVIEWER")
  ]);

  const ready = await practice(author.id, "publish", {
    status: "READY_TO_PUBLISH", version: 4, anonymityCheckedAt: NOW, anonymityCheckedVersion: 1, professionalReviewedAt: NOW
  });
  await db.effectivePracticeReview.createMany({ data: [
    { practiceId: ready.id, reviewerId: reviewer.id, capabilityType: "REVIEWER", reviewedVersion: 1, decision: "APPROVED", decidedAt: NOW },
    { practiceId: ready.id, reviewerId: editor.id, capabilityType: "EDITOR", reviewedVersion: 1, decision: "APPROVED", decidedAt: NOW },
    { practiceId: ready.id, reviewerId: ethics.id, capabilityType: "ETHICS", reviewedVersion: 1, decision: "APPROVED", decidedAt: NOW, privateNotes: "[PRIVACY_DECISION] Probe-safe generalisation" }
  ] });
  const service = createEffectivePracticeService(db, { now: () => NOW });
  const workspaceContract = await service.listWorkspace(
    { userId: reviewer.id, role: "SOCIAL_WORKER" }, { q: "Generalised", sort: "applications", limit: 2 }
  );
  expect("PRAC-03 real PostgreSQL accepts DB-side filters, relation priority and page metadata",
    Array.isArray(workspaceContract.practices) && Number.isInteger(workspaceContract.pageInfo.practices.total));
  const capabilityContract = await service.listCapabilities(
    { userId: approver.id, role: "ADMIN", isAdmin: true }, { limit: 2 }
  );
  expect("PRAC-03 capability cursor contract runs on real PostgreSQL",
    capabilityContract.items.length === 2 && capabilityContract.pageInfo.total === 5 && capabilityContract.pageInfo.hasMore === true);
  const publishError = await service.actionCandidate(
    { userId: approver.id, role: "SOCIAL_WORKER" }, ready.publicId,
    { action: "publish", expectedVersion: 4, nextReviewAt: "2027-08-14" }
  ).then(() => null, (error) => error);
  expect("PRAC-01 expired ETHICS approval cannot publish", publishError?.code === "REVIEW_CHAIN_INCOMPLETE", publishError?.code);
  expect("PRAC-01 rejected publish creates no immutable version", await db.effectivePracticeVersion.count({ where: { practiceId: ready.id } }) === 0);

  const erasedPractice = await practice(author.id, "set-null");
  const erasedAssignment = await db.effectivePracticeReviewAssignment.create({ data: {
    practiceId: erasedPractice.id, reviewerId: erased.id, capabilityType: "REVIEWER", contentVersion: 1, status: "ASSIGNED"
  } });
  await db.user.delete({ where: { id: erased.id } });
  expect("PRAC-02 account deletion leaves the assignment identity null", (await db.effectivePracticeReviewAssignment.findUnique({ where: { id: erasedAssignment.id } })).reviewerId === null);
  const erasedRepair = await service.repairAssignments({ userId: "system", role: "SYSTEM" }, { batchSize: 100 });
  expect("PRAC-02 SetNull assignment is terminally repaired and audited",
    erasedRepair.candidateRepairs >= 1
    && (await db.effectivePracticeReviewAssignment.findUnique({ where: { id: erasedAssignment.id } })).status === "DECLINED"
    && await db.effectivePracticeAuditEvent.count({ where: { practiceId: erasedPractice.id, action: "ASSIGNMENT_REPAIR_APPLIED" } }) === 1);

  async function raceFixture(suffix) {
    const oldReviewer = await user(`prac-old-${suffix}@example.test`);
    await capability(oldReviewer.id, "REVIEWER", { validUntil: new Date("2026-08-13T23:59:59.000Z") });
    const row = await practice(author.id, suffix);
    const assignment = await db.effectivePracticeReviewAssignment.create({ data: {
      practiceId: row.id, reviewerId: oldReviewer.id, capabilityType: "REVIEWER", contentVersion: 1, status: "ASSIGNED"
    } });
    return { row, assignment };
  }
  const reviewFirst = await raceFixture("review-first");
  const firstRace = await raceOnLockedRow({
    prisma: db,
    lockRow: (tx) => tx.$queryRaw`SELECT id FROM "EffectivePracticeReviewAssignment" WHERE id = ${reviewFirst.assignment.id} FOR UPDATE`,
    first: () => rawReview(reviewFirst.assignment.id),
    second: () => service.repairAssignments({ userId: "system", role: "SYSTEM" }, { batchSize: 100 }),
    label: "PRAC-02 review before repair", expect
  });
  expect("PRAC-02 review-first CAS wins", !firstRace.resultA.error && (await db.effectivePracticeReviewAssignment.findUnique({ where: { id: reviewFirst.assignment.id } })).status === "COMPLETED");
  expect("PRAC-02 review-first mints no repair audit", await db.effectivePracticeAuditEvent.count({ where: { practiceId: reviewFirst.row.id, action: "ASSIGNMENT_REPAIR_APPLIED" } }) === 0);

  const repairFirst = await raceFixture("repair-first");
  const secondRace = await raceOnLockedRow({
    prisma: db,
    lockRow: (tx) => tx.$queryRaw`SELECT id FROM "EffectivePracticeReviewAssignment" WHERE id = ${repairFirst.assignment.id} FOR UPDATE`,
    first: () => service.repairAssignments({ userId: "system", role: "SYSTEM" }, { batchSize: 100 }),
    second: () => rawReview(repairFirst.assignment.id),
    label: "PRAC-02 repair before review", expect
  });
  expect("PRAC-02 repair-first CAS rejects the late review", !secondRace.resultA.error && secondRace.resultB.error?.code === "REVIEW_CAS_LOST");
  expect("PRAC-02 repair-first declines, reassigns and audits exactly once",
    (await db.effectivePracticeReviewAssignment.findUnique({ where: { id: repairFirst.assignment.id } })).status === "DECLINED"
    && await db.effectivePracticeReviewAssignment.count({ where: { practiceId: repairFirst.row.id, status: "ASSIGNED" } }) === 1
    && await db.effectivePracticeAuditEvent.count({ where: { practiceId: repairFirst.row.id, action: "ASSIGNMENT_REPAIR_APPLIED" } }) === 1);

  const due = await practice(author.id, "review-due", {
    status: "PUBLISHED", version: 2, publishedVersion: 1, publishedAt: new Date("2026-01-01"),
    nextReviewAt: new Date("2026-08-13T01:00:00.000Z"), ragSourceId: "effective-practice::due::v1"
  });
  const noEthicsTask = await service.runPracticeReviewSchedulerTick({ now: NOW, reviewGraceDays: 14 });
  expect("PRAC-08 expired ETHICS capability creates no invalid task", noEthicsTask.reviewTasksCreated === 0);
  const newEthics = await user("prac-current-ethics@example.test");
  await capability(newEthics.id, "ETHICS");
  const recoveredTask = await service.runPracticeReviewSchedulerTick({ now: NOW, reviewGraceDays: 14 });
  expect("PRAC-08 rerun creates one task after an active ETHICS capability appears", recoveredTask.reviewTasksCreated === 1);
  const idempotentTask = await service.runPracticeReviewSchedulerTick({ now: NOW, reviewGraceDays: 14 });
  expect("PRAC-08 repeated scheduler keeps exactly one current ETHICS task",
    idempotentTask.reviewTasksCreated === 0
    && await db.effectivePracticeReviewAssignment.count({
      where: { practiceId: due.id, contentVersion: 1, capabilityType: "ETHICS", status: "ASSIGNED" }
    }) === 1);
  await reconcileNotificationEvents({ db, now: NOW, batchSize: 100 });
  expect("PRAC-08 due task produces one idempotent ETHICS notification",
    await db.notificationEvent.count({ where: { userId: newEthics.id, type: "PRACTICE_REVIEW_ASSIGNED" } }) === 1);
  await db.effectivePractice.update({ where: { id: due.id }, data: { nextReviewAt: new Date("2026-07-01T00:00:00.000Z") } });
  const grace = await service.runPracticeReviewSchedulerTick({ now: NOW, reviewGraceDays: 14 });
  const dueAfterGrace = await db.effectivePractice.findUnique({ where: { id: due.id } });
  const deletionJob = await db.dataDeletionJob.findFirst({ where: { resourceType: "EffectivePractice", resourceId: due.id, action: "RAG_DELETE" } });
  expect("PRAC-08 grace expiry removes the public state and queues durable RAG deletion",
    grace.movedToReReview === 1 && dueAfterGrace.status === "RE_REVIEW" && deletionJob?.status === "pending");
  expect("PRAC-08 new review cycle has active role assignments",
    await db.effectivePracticeReviewAssignment.count({ where: { practiceId: due.id, contentVersion: 2, status: "ASSIGNED" } }) >= 3);
  expect("PRAC-08 old review-cycle tasks are closed on grace expiry",
    await db.effectivePracticeReviewAssignment.count({ where: { practiceId: due.id, contentVersion: 1, status: "ASSIGNED" } }) === 0);

  const ingestJob = await db.dataDeletionJob.create({ data: {
    action: "RAG_INGEST", resourceType: "EffectivePractice", resourceId: ready.id,
    externalRef: "effective-practice::publish::v1", storagePath: "rag_ingest_retry:v1", status: "pending", maxAttempts: 3
  } });
  const recovery = await runEffectivePracticeRagRecovery({
    db, now: NOW, batchSize: 20,
    processDelete: async ({ jobId }) => {
      const job = await db.dataDeletionJob.update({ where: { id: jobId }, data: { status: "done", attempts: { increment: 1 } } });
      await db.effectivePractice.updateMany({ where: { id: job.resourceId, ragSourceId: job.externalRef }, data: { ragSourceId: null } });
      return { status: "done" };
    },
    processIngest: async (job) => {
      await db.dataDeletionJob.update({ where: { id: job.id }, data: { status: "done", attempts: { increment: 1 } } });
      return { status: "ingested" };
    }
  });
  expect("PRAC-07 periodic worker drains both delete and ingest jobs after recovery",
    recovery.succeeded >= 2
    && (await db.dataDeletionJob.findUnique({ where: { id: deletionJob.id } })).status === "done"
    && (await db.dataDeletionJob.findUnique({ where: { id: ingestJob.id } })).status === "done");
  expect("PRAC-07 confirmed delete clears the stale RAG reference", (await db.effectivePractice.findUnique({ where: { id: due.id } })).ragSourceId === null);

  console.log(`PROBE_OK ${passed}/${passed}`);
} finally {
  await db.$disconnect().catch(() => null);
  await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`, [databaseName]).catch(() => null);
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => null);
  await admin.end().catch(() => null);
  console.log("CLEANUP_OK temporary_database_removed");
}
