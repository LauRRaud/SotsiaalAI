import test from "node:test";
import assert from "node:assert/strict";

import { createEffectivePracticeService, DEFAULT_MAX_RAG_INGEST_ATTEMPTS } from "../../lib/effectivePractices.js";

// P1-A: durable RAG ingest recovery — processRagIngest re-ingests the immutable
// published snapshot with the deterministic doc id (idempotent upsert), version
// guarded so a re-reviewed/superseded version is abandoned, with capped backoff.

const NOW = new Date("2026-07-14T12:00:00.000Z");
const DOC = "effective-practice::pub-1::v3";

function applyData(row, data) {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object" && "increment" in value) {
      row[key] = (Number(row[key]) || 0) + value.increment;
    } else {
      row[key] = value;
    }
  }
  return row;
}

function makeIngestDb({ practice, version }) {
  const state = { practice: practice ? { ...practice } : null, version: version ? { ...version } : null, job: null };
  const client = {
    state,
    effectivePractice: {
      findUnique: async ({ where }) => (state.practice && state.practice.id === where.id ? { ...state.practice } : null),
      updateMany: async ({ where = {}, data }) => {
        const p = state.practice;
        if (!p || p.id !== where.id) return { count: 0 };
        if (where.status && p.status !== where.status) return { count: 0 };
        if (where.publishedVersion != null && p.publishedVersion !== where.publishedVersion) return { count: 0 };
        applyData(p, data);
        return { count: 1 };
      }
    },
    effectivePracticeVersion: {
      findFirst: async ({ where }) => (state.version && state.version.version === where.version ? { ...state.version } : null)
    },
    dataDeletionJob: {
      update: async ({ data }) => applyData((state.job ??= {}), data)
    },
    async $transaction(cb) { return cb(client); }
  };
  return client;
}

const practiceRow = (o = {}) => ({ id: "prac-1", publicId: "pub-1", status: "PUBLISHED", publishedVersion: 3, ragSourceId: null, ...o });
const versionRow = (o = {}) => ({ version: 3, publicSnapshot: { publicId: "pub-1", title: "T", version: 3 }, ...o });
const job = (o = {}) => ({ id: "job-1", resourceId: "prac-1", externalRef: DOC, storagePath: "rag_ingest_retry:v3", attempts: 0, maxAttempts: DEFAULT_MAX_RAG_INGEST_ATTEMPTS, ...o });

function makeService(db, { sync, remove } = {}) {
  const calls = [];
  const removals = [];
  const service = createEffectivePracticeService(db, {
    now: () => NOW,
    syncPublishedSnapshot: async (publication) => {
      calls.push(publication);
      return sync ? sync(publication) : { status: "synced", docId: DOC };
    },
    removePublishedSnapshot: async (docId) => {
      removals.push(docId);
      return remove ? remove(docId) : { ok: true };
    }
  });
  return { service, calls, removals };
}

test("processRagIngest: re-ingests the immutable snapshot and links ragSourceId", async () => {
  const db = makeIngestDb({ practice: practiceRow(), version: versionRow() });
  const { service, calls } = makeService(db);
  const result = await service.processRagIngest(job());
  assert.equal(result.status, "ingested");
  assert.equal(db.state.practice.ragSourceId, DOC);
  assert.equal(db.state.job.status, "done");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].version, 3); // the FROZEN version snapshot, not the live practice
});

test("processRagIngest: is idempotent when already linked (no re-ingest)", async () => {
  const db = makeIngestDb({ practice: practiceRow({ ragSourceId: DOC }), version: versionRow() });
  const { service, calls } = makeService(db);
  const result = await service.processRagIngest(job());
  assert.equal(result.status, "already_linked");
  assert.equal(db.state.job.status, "done");
  assert.equal(calls.length, 0);
});

test("processRagIngest: superseded retry removes the possible orphan before becoming done (SOL-P1-1)", async () => {
  for (const practice of [practiceRow({ publishedVersion: 4 }), practiceRow({ status: "RE_REVIEW" }), null]) {
    const db = makeIngestDb({ practice, version: versionRow() });
    const { service, calls, removals } = makeService(db);
    const result = await service.processRagIngest(job());
    assert.equal(result.status, "superseded_cleaned");
    assert.equal(calls.length, 0, "never re-ingests a superseded/gone practice");
    assert.deepEqual(removals, [DOC], "removes the deterministic possible orphan");
    assert.equal(db.state.job.action, "RAG_DELETE");
    assert.equal(db.state.job.status, "done");
    assert.equal(db.state.job.lastErrorCode, null);
  }
});

test("processRagIngest: superseded cleanup failure stays visible to the deploy gate", async () => {
  const db = makeIngestDb({ practice: practiceRow({ status: "RE_REVIEW" }), version: versionRow() });
  const { service, calls, removals } = makeService(db, { remove: async () => { throw new Error("network"); } });
  const result = await service.processRagIngest(job());
  assert.equal(result.status, "cleanup_pending");
  assert.equal(result.cleanupStatus, "failed");
  assert.equal(calls.length, 0);
  assert.deepEqual(removals, [DOC]);
  assert.equal(db.state.job.action, "RAG_DELETE");
  assert.equal(db.state.job.status, "failed", "never reports done before cleanup succeeds");
  assert.equal(db.state.job.lastErrorCode, "delete_failed");
});

test("processRagIngest: a transient ingest failure schedules a backed-off retry", async () => {
  const db = makeIngestDb({ practice: practiceRow(), version: versionRow() });
  const { service } = makeService(db, { sync: async () => { throw new Error("network"); } });
  const result = await service.processRagIngest(job({ attempts: 1 }));
  assert.equal(result.status, "retry_scheduled");
  assert.equal(db.state.job.status, "pending");
  assert.equal(db.state.job.lastErrorCode, "ingest_failed");
  assert.ok(db.state.job.nextAttemptAt instanceof Date);
  assert.equal(db.state.practice.ragSourceId, null); // never links on failure
});

test("processRagIngest: exhausting maxAttempts marks the job failed (surfaced to the gate)", async () => {
  const db = makeIngestDb({ practice: practiceRow(), version: versionRow() });
  const { service } = makeService(db, { sync: async () => { throw new Error("network"); } });
  const result = await service.processRagIngest(job({ attempts: DEFAULT_MAX_RAG_INGEST_ATTEMPTS - 1 }));
  assert.equal(result.status, "failed");
  assert.equal(db.state.job.status, "failed");
  assert.equal(db.state.job.nextAttemptAt, null);
});

test("processRagIngest: a doc-id mismatch is a guarded retry, never a bad link", async () => {
  const db = makeIngestDb({ practice: practiceRow(), version: versionRow() });
  const { service } = makeService(db, { sync: async () => ({ status: "synced", docId: "effective-practice::pub-1::v9" }) });
  const result = await service.processRagIngest(job());
  assert.equal(result.status, "retry_scheduled");
  assert.equal(db.state.job.lastErrorCode, "doc_id_mismatch");
  assert.equal(db.state.practice.ragSourceId, null);
});

test("processRagIngest: a missing RAG key keeps the job pending without burning attempts", async () => {
  const db = makeIngestDb({ practice: practiceRow(), version: versionRow() });
  const { service } = makeService(db, { sync: async () => ({ status: "skipped", reason: "rag_key_missing", docId: null }) });
  const result = await service.processRagIngest(job({ attempts: 2 }));
  assert.equal(result.status, "skipped");
  assert.equal(db.state.job.status ?? "pending", "pending");
  assert.equal(db.state.job.lastErrorCode, "rag_key_missing");
  assert.equal(db.state.job.attempts ?? undefined, undefined); // attempts not incremented
});

test("processRagIngest: a missing immutable snapshot fails closed (retryable, no link)", async () => {
  const db = makeIngestDb({ practice: practiceRow(), version: null });
  const { service, calls } = makeService(db);
  const result = await service.processRagIngest(job());
  assert.equal(result.status, "retry_scheduled");
  assert.equal(db.state.job.lastErrorCode, "snapshot_missing");
  assert.equal(calls.length, 0);
  assert.equal(db.state.practice.ragSourceId, null);
});

test("processRagIngest: a malformed job (no version/doc) fails without touching the practice", async () => {
  const db = makeIngestDb({ practice: practiceRow(), version: versionRow() });
  const { service, calls } = makeService(db);
  const result = await service.processRagIngest(job({ storagePath: "no-version", externalRef: "" }));
  assert.equal(result.status, "failed");
  assert.equal(db.state.job.status, "failed");
  assert.equal(calls.length, 0);
  assert.equal(db.state.practice.ragSourceId, null);
});
