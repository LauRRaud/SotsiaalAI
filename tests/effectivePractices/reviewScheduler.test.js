import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { createEffectivePracticeService } from "../../lib/effectivePractices.js";

// P1-B: review-deadline + overdue-assignment scheduler — idempotent durable markers.

const NOW = new Date("2026-07-14T12:00:00.000Z");
const daysAgo = (n) => new Date(NOW.getTime() - n * 86_400_000);

function matchDate(actual, cond) {
  if (cond == null) return true;
  if (cond instanceof Date) return new Date(actual).getTime() === cond.getTime();
  if (cond.not === null && actual == null) return false;
  if (cond.lte && !(new Date(actual) <= cond.lte)) return false;
  if (cond.gte && !(new Date(actual) >= cond.gte)) return false;
  return true;
}

function pageRows(rows, cursor, take) {
  const start = cursor?.id ? Math.max(0, rows.findIndex((row) => row.id === cursor.id) + 1) : 0;
  return rows.slice(start, start + take).map((row) => ({ ...row }));
}

function makeDb({ practices = [], assignments = [], audits = [] } = {}) {
  const state = { practices, assignments, audits, lockCalls: 0 };
  let transactionTail = Promise.resolve();
  const client = {
    state,
    effectivePractice: {
      findMany: async ({ where = {}, take = 500, cursor = null } = {}) => pageRows(state.practices
        .filter((p) => (!where.status || p.status === where.status)
          && matchDate(p.nextReviewAt, where.nextReviewAt)), cursor, take)
    },
    effectivePracticeReviewAssignment: {
      findMany: async ({ where = {}, take = 500, cursor = null } = {}) => pageRows(state.assignments
        .filter((a) => (!where.status || a.status === where.status)
          && (where.completedAt !== null || a.completedAt == null)
          && matchDate(a.assignedAt, where.assignedAt)), cursor, take)
    },
    practiceCapability: { findMany: async () => [] },
    effectivePracticeAuditEvent: {
      findFirst: async ({ where = {} } = {}) => state.audits.find((e) =>
        e.practiceId === where.practiceId
        && e.action === where.action
        && (where.contentVersion == null || e.contentVersion === where.contentVersion)
        && matchDate(e.createdAt, where.createdAt)) || null,
      create: async ({ data }) => { const row = { id: `audit-${state.audits.length + 1}`, createdAt: NOW, ...data }; state.audits.push(row); return row; }
    },
    async $executeRaw() { state.lockCalls += 1; },
    async $transaction(cb) {
      const previous = transactionTail;
      let release;
      transactionTail = new Promise((resolve) => { release = resolve; });
      await previous;
      try { return await cb(client); } finally { release(); }
    }
  };
  return client;
}

const service = (db) => createEffectivePracticeService(db, { now: () => NOW });

test("scheduler marks a published practice past its review deadline (REVIEW_DUE)", async () => {
  const db = makeDb({
    practices: [{ id: "p1", publicId: "pub-1", status: "PUBLISHED", contentVersion: 2, publishedVersion: 1, publishedAt: daysAgo(200), nextReviewAt: daysAgo(1) }]
  });
  const result = await service(db).runPracticeReviewSchedulerTick();
  assert.equal(result.reviewsDue, 1);
  assert.equal(db.state.audits.length, 1);
  assert.equal(db.state.audits[0].action, "REVIEW_DUE");
  assert.equal(db.state.audits[0].contentVersion, 2);
  // No candidate text in the durable marker.
  assert.deepEqual(Object.keys(db.state.audits[0].metadata).sort(), ["nextReviewAt", "publishedVersion", "scheduledAt"]);
});

test("scheduler does NOT mark a practice whose deadline has not arrived", async () => {
  const db = makeDb({
    practices: [{ id: "p1", publicId: "pub-1", status: "PUBLISHED", contentVersion: 1, publishedVersion: 1, publishedAt: daysAgo(10), nextReviewAt: new Date(NOW.getTime() + 86_400_000) }]
  });
  const result = await service(db).runPracticeReviewSchedulerTick();
  assert.equal(result.reviewsDue, 0);
  assert.equal(db.state.audits.length, 0);
});

test("scheduler is idempotent — a second tick does not duplicate REVIEW_DUE", async () => {
  const db = makeDb({
    practices: [{ id: "p1", publicId: "pub-1", status: "PUBLISHED", contentVersion: 2, publishedVersion: 1, publishedAt: daysAgo(200), nextReviewAt: daysAgo(1) }]
  });
  await service(db).runPracticeReviewSchedulerTick();
  const second = await service(db).runPracticeReviewSchedulerTick();
  assert.equal(second.reviewsDue, 0);
  assert.equal(db.state.audits.length, 1);
});

test("scheduler dry-run lists without writing a marker", async () => {
  const db = makeDb({
    practices: [{ id: "p1", publicId: "pub-1", status: "PUBLISHED", contentVersion: 1, publishedVersion: 1, publishedAt: daysAgo(200), nextReviewAt: daysAgo(1) }]
  });
  const result = await service(db).runPracticeReviewSchedulerTick({ dryRun: true });
  assert.equal(result.reviewsDue, 1);
  assert.equal(result.reviews[0].practiceId, "pub-1");
  assert.equal(db.state.audits.length, 0);
});

test("scheduler marks overdue ASSIGNED assignments once per review cycle", async () => {
  const db = makeDb({
    assignments: [
      { id: "a1", practiceId: "p1", contentVersion: 3, status: "ASSIGNED", completedAt: null, assignedAt: daysAgo(30) },
      { id: "a2", practiceId: "p1", contentVersion: 3, status: "ASSIGNED", completedAt: null, assignedAt: daysAgo(20) },
      { id: "a3", practiceId: "p1", contentVersion: 3, status: "COMPLETED", completedAt: daysAgo(1), assignedAt: daysAgo(30) },
      { id: "a4", practiceId: "p1", contentVersion: 3, status: "ASSIGNED", completedAt: null, assignedAt: daysAgo(1) }
    ]
  });
  const result = await service(db).runPracticeReviewSchedulerTick({ overdueDays: 14, batchSize: 1 });
  assert.equal(result.assignmentsOverdue, 1);
  const marker = db.state.audits.find((e) => e.action === "ASSIGNMENT_OVERDUE");
  assert.ok(marker);
  assert.equal(marker.metadata.overdueCount, 2); // a1 + a2; a3 completed, a4 not yet overdue
  assert.deepEqual(marker.metadata.overdueAssignmentIds.sort(), ["a1", "a2"]);

  const second = await service(db).runPracticeReviewSchedulerTick({ overdueDays: 14 });
  assert.equal(second.assignmentsOverdue, 0); // idempotent per cycle
});

test("scheduler scans beyond the first batch so marked rows cannot starve later rows (SOL-P1-2)", async () => {
  const practices = Array.from({ length: 5 }, (_, index) => ({
    id: `p${index + 1}`,
    publicId: `pub-${index + 1}`,
    status: "PUBLISHED",
    contentVersion: 1,
    publishedVersion: 1,
    publishedAt: daysAgo(200),
    nextReviewAt: daysAgo(5 - index)
  }));
  const db = makeDb({ practices });
  const first = await service(db).runPracticeReviewSchedulerTick({ batchSize: 2 });
  assert.equal(first.reviewsDue, 5);
  assert.equal(db.state.audits.filter((row) => row.action === "REVIEW_DUE").length, 5);
  const second = await service(db).runPracticeReviewSchedulerTick({ batchSize: 2 });
  assert.equal(second.reviewsDue, 0);
  assert.equal(db.state.audits.length, 5);
});

test("two parallel scheduler ticks serialize and create one marker (SOL-P1-2)", async () => {
  const db = makeDb({
    practices: [{ id: "p1", publicId: "pub-1", status: "PUBLISHED", contentVersion: 2, publishedVersion: 1, publishedAt: daysAgo(200), nextReviewAt: daysAgo(1) }]
  });
  const [first, second] = await Promise.all([
    service(db).runPracticeReviewSchedulerTick({ batchSize: 1 }),
    service(db).runPracticeReviewSchedulerTick({ batchSize: 1 })
  ]);
  assert.equal(first.reviewsDue + second.reviewsDue, 1);
  assert.equal(db.state.audits.length, 1);
  assert.equal(db.state.lockCalls, 2);
});

test("route: practice-review job is secret-gated with the shared timing-safe pattern", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
  const route = readFileSync(join(root, "app/api/jobs/practice-reviews/route.js"), "utf8");
  assert.match(route, /process\.env\.PRACTICE_REVIEW_JOB_KEY/);
  assert.match(route, /crypto\.timingSafeEqual/);
  assert.match(route, /if \(!JOB_KEY\) return false/);
  assert.match(route, /"unauthorized"/);
  assert.match(route, /runEffectivePracticeReviewScheduler/);
  assert.match(route, /dryRun/);
  const source = readFileSync(join(root, "lib/effectivePractices.js"), "utf8");
  assert.match(source, /pg_advisory_xact_lock/);
  assert.match(source, /cursor: \{ id: practiceCursor \}/);
});
