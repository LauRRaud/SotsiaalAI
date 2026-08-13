import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { runEffectivePracticeRagRecovery } from "../../lib/effectivePracticeRagRecovery.js";

const NOW = new Date("2026-08-14T01:00:00.000Z");

function apply(row, data) {
  for (const [key, value] of Object.entries(data)) {
    row[key] = value && typeof value === "object" && Number.isFinite(value.increment)
      ? Number(row[key] || 0) + value.increment
      : value;
  }
}

function makeDb(jobs) {
  const state = { jobs: jobs.map((row) => ({ attempts: 0, maxAttempts: 3, nextAttemptAt: null, ...row })), locks: 0 };
  const client = {
    state,
    dataDeletionJob: {
      findMany: async ({ take }) => state.jobs.filter((row) => ["pending", "failed", "guard", "processing"].includes(row.status)).slice(0, take).map((row) => ({ ...row })),
      findUnique: async ({ where }) => {
        const row = state.jobs.find((item) => item.id === where.id);
        return row ? { ...row } : null;
      },
      updateMany: async ({ where, data }) => {
        const row = state.jobs.find((item) => item.id === where.id
          && (!where.status || item.status === where.status)
          && (!where.claimToken || item.claimToken === where.claimToken));
        if (!row) return { count: 0 };
        apply(row, data);
        return { count: 1 };
      },
      count: async ({ where }) => state.jobs.filter((row) => (
        row.resourceType === where.resourceType
        && (where.status?.in ? where.status.in.includes(row.status) : row.status === where.status)
      )).length
    },
    async $executeRaw() { state.locks += 1; },
    async $transaction(callback) { return callback(client); }
  };
  return client;
}

test("RAG recovery claims a bounded batch once and reports health counters", async () => {
  const db = makeDb([
    { id: "i1", action: "RAG_INGEST", resourceType: "EffectivePractice", status: "pending" },
    { id: "d1", action: "RAG_DELETE", resourceType: "EffectivePractice", status: "failed" },
    { id: "i2", action: "RAG_INGEST", resourceType: "EffectivePractice", status: "pending" }
  ]);
  const result = await runEffectivePracticeRagRecovery({
    db, now: NOW, batchSize: 2,
    processIngest: async (job) => { apply(db.state.jobs.find((row) => row.id === job.id), { status: "done" }); return { status: "ingested" }; },
    processDelete: async ({ jobId }) => { apply(db.state.jobs.find((row) => row.id === jobId), { status: "done", attempts: { increment: 1 } }); return { status: "done" }; }
  });
  assert.equal(db.state.locks, 1);
  assert.equal(result.claimed, 2);
  assert.equal(result.succeeded, 2);
  assert.equal(result.remaining, 1);
  assert.equal(result.alarm, false);
  assert.equal(db.state.jobs.filter((row) => row.status === "done").length, 2);
});

test("RAG recovery backs off failures and dead-letters an exhausted job", async () => {
  const db = makeDb([
    { id: "retry", action: "RAG_INGEST", resourceType: "EffectivePractice", status: "pending", attempts: 0 },
    { id: "dead", action: "RAG_DELETE", resourceType: "EffectivePractice", status: "failed", attempts: 2 }
  ]);
  const result = await runEffectivePracticeRagRecovery({
    db, now: NOW, batchSize: 10,
    processIngest: async () => { throw new Error("offline"); },
    processDelete: async () => { throw new Error("offline"); }
  });
  const retry = db.state.jobs.find((row) => row.id === "retry");
  const dead = db.state.jobs.find((row) => row.id === "dead");
  assert.equal(retry.status, "failed");
  assert.ok(retry.nextAttemptAt > NOW);
  assert.equal(dead.status, "dead_letter");
  assert.equal(dead.nextAttemptAt, null);
  assert.equal(result.alarm, true);
  assert.equal(result.deadLetter, 1);
});

test("dry-run reports eligibility without claims or mutations", async () => {
  const db = makeDb([{ id: "i1", action: "RAG_INGEST", resourceType: "EffectivePractice", status: "pending" }]);
  const before = structuredClone(db.state.jobs);
  const result = await runEffectivePracticeRagRecovery({ db, now: NOW, dryRun: true });
  assert.equal(result.eligible, 1);
  assert.equal(result.claimed, 0);
  assert.deepEqual(db.state.jobs, before);
});

test("a processor that returns without finishing the durable row cannot strand a claim", async () => {
  const db = makeDb([{ id: "i1", action: "RAG_INGEST", resourceType: "EffectivePractice", status: "pending" }]);
  const result = await runEffectivePracticeRagRecovery({
    db, now: NOW,
    processIngest: async () => ({ status: "failed" }),
    processDelete: async () => ({ status: "done" })
  });
  assert.equal(db.state.jobs[0].status, "failed");
  assert.equal(db.state.jobs[0].claimToken, null);
  assert.equal(db.state.jobs[0].claimedAt, null);
  assert.equal(result.failed, 1);
  assert.equal(result.alarm, true);
});

test("the periodic notification runner is versioned and persistent", async () => {
  const service = await readFile(new URL("../../deploy/systemd/sotsiaalai-notifications.service", import.meta.url), "utf8");
  const timer = await readFile(new URL("../../deploy/systemd/sotsiaalai-notifications.timer", import.meta.url), "utf8");
  assert.match(service, /ExecStart=\/usr\/bin\/npm run notifications:dispatch/);
  assert.match(service, /EnvironmentFile=\/etc\/sotsiaalai\/frontend\.env/);
  assert.match(timer, /OnUnitActiveSec=5min/);
  assert.match(timer, /Persistent=true/);
  assert.match(timer, /WantedBy=timers\.target/);
});
