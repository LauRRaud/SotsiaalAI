import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createDeletionJobRetryService } from "../../lib/privacy/deletionJobRetryService.js";

function fakeDeletionDb(job, { failTransaction = false } = {}) {
  const state = {
    job: { ...job },
    audits: [],
    practice: { id: job.resourceId, ragSourceId: job.externalRef, ragMetadata: null },
    document: {
      id: job.resourceId,
      agentAllowed: false,
      metadata: { ragRemoval: { jobId: job.id, externalRef: job.externalRef, status: "failed" } }
    }
  };
  const db = {
    state,
    dataDeletionJob: {
      async findUnique() { return { ...state.job }; },
      async update({ data }) {
        if (data.attempts?.increment) state.job.attempts += data.attempts.increment;
        Object.assign(state.job, { ...data, attempts: state.job.attempts });
        return { ...state.job };
      }
    },
    dataAuditLog: {
      async create({ data }) { state.audits.push(data); return data; }
    },
    effectivePractice: {
      async updateMany({ where, data }) {
        if (state.practice.id !== where.id || state.practice.ragSourceId !== where.ragSourceId) return { count: 0 };
        Object.assign(state.practice, data);
        return { count: 1 };
      }
    },
    userDocument: {
      async findUnique() { return { ...state.document }; },
      async update({ data }) {
        Object.assign(state.document, data);
        return { ...state.document };
      }
    },
    async $transaction(callback) {
      if (failTransaction) throw new Error("database_unavailable");
      return callback(db);
    }
  };
  return db;
}

test("user suspension is persisted and enforced by every login path", async () => {
  const [schema, migration, auth, jwtAuthorization, pinLoginAttempt, resend, route] = await Promise.all([
    readFile(new URL("../../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(new URL("../../prisma/migrations/20260711170000_user_access_suspension/migration.sql", import.meta.url), "utf8"),
    readFile(new URL("../../auth.js", import.meta.url), "utf8"),
    readFile(new URL("../../lib/auth/jwtAuthorization.js", import.meta.url), "utf8"),
    readFile(new URL("../../lib/auth/pinLoginAttempt.js", import.meta.url), "utf8"),
    readFile(new URL("../../app/api/auth/login-resend-otp/route.js", import.meta.url), "utf8"),
    readFile(new URL("../../app/api/admin/usage/users/route.js", import.meta.url), "utf8")
  ]);
  assert.match(schema, /accessSuspendedAt\s+DateTime\?/);
  assert.match(migration, /ADD COLUMN "accessSuspendedAt"/);
  // Sisselogimisrajad (temp-token ja otse-PIN) elavad auth.js-is; JWT
  // värskenduse peatamiskontroll kolis SOL-AUTH-01 parandusega eraldi moodulisse.
  assert.ok((auth.match(/accessSuspendedAt/g) || []).length >= 4);
  assert.match(jwtAuthorization, /currentUser\.accessSuspendedAt[\s\S]*SESSION_REVOKED/);
  assert.match(auth, /refreshTokenAuthorization\(token,[\s\S]*db: prisma/);
  // PIN-katse otsus kolis SOL-AUTH-09/-10 parandusega marsruudist moodulisse: peatatud konto
  // ei anna kasutatavat räsi, seega ta ei saa enam ka õige PIN-iga sisse.
  assert.match(pinLoginAttempt, /user\?\.passwordHash && !user\.accessSuspendedAt/);
  assert.match(pinLoginAttempt, /no_usable_credential/);
  assert.match(resend, /!user\?\.email \|\| user\.accessSuspendedAt/);
  assert.match(route, /sessionVersion: \{ increment: 1 \}/);
  assert.match(route, /tx\.session\.deleteMany/);
  assert.match(route, /USER_ACCESS_SUSPENDED/);
  assert.match(route, /tx\.dataAuditLog\.create/);
});

test("file deletion retry completes and writes an immutable audit entry", async () => {
  const db = fakeDeletionDb({
    id: "job_1", action: "FILE_DELETE", resourceType: "UserDocument",
    storagePath: "u/file.pdf", targetUserId: "user_1", attempts: 1, status: "failed"
  });
  const deleted = [];
  const retry = createDeletionJobRetryService({
    db,
    deleteDocument: async path => deleted.push(path),
    deleteMaterial: async () => {},
    deleteRag: async () => ({ ok: true })
  });
  const result = await retry({ jobId: "job_1", actorUserId: "admin_1" });
  assert.deepEqual(deleted, ["u/file.pdf"]);
  assert.equal(result.status, "done");
  assert.equal(result.attempts, 2);
  assert.equal(db.state.audits[0].action, "DATA_DELETION_JOB_RETRY_DONE");
});

test("unsupported deletion retry remains failed instead of reporting false success", async () => {
  const db = fakeDeletionDb({
    id: "job_2", action: "ARTIFACT_DB_DELETE", resourceType: "AgentArtifact",
    targetUserId: "user_1", attempts: 0, status: "skipped"
  });
  const retry = createDeletionJobRetryService({ db });
  const result = await retry({ jobId: "job_2", actorUserId: "admin_1" });
  assert.equal(result.status, "failed");
  assert.match(result.lastError, /manual_retry_not_supported/);
  assert.equal(db.state.audits[0].action, "DATA_DELETION_JOB_RETRY_FAILED");
});

test("effective-practice RAG retry atomically clears the stale reference when the job becomes done", async () => {
  const db = fakeDeletionDb({
    id: "job_rag_1", action: "RAG_DELETE", resourceType: "EffectivePractice",
    resourceId: "practice-1", externalRef: "effective-practice::p1::v1", attempts: 0, status: "failed"
  });
  const retry = createDeletionJobRetryService({ db, deleteRag: async () => ({ ok: true }) });
  const result = await retry({ jobId: "job_rag_1", actorUserId: "admin-1" });
  assert.equal(result.status, "done");
  assert.equal(db.state.practice.ragSourceId, null);
  assert.equal(db.state.practice.ragMetadata.syncStatus, "removed");
});

test("effective-practice RAG retry stays pending when the atomic final transaction fails", async () => {
  const db = fakeDeletionDb({
    id: "job_rag_2", action: "RAG_DELETE", resourceType: "EffectivePractice",
    resourceId: "practice-2", externalRef: "effective-practice::p2::v1", attempts: 0, status: "failed"
  }, { failTransaction: true });
  const retry = createDeletionJobRetryService({ db, deleteRag: async () => ({ ok: true }) });
  await assert.rejects(retry({ jobId: "job_rag_2", actorUserId: "admin-1" }), /database_unavailable/);
  assert.equal(db.state.job.status, "pending");
  assert.equal(db.state.practice.ragSourceId, "effective-practice::p2::v1");
});

test("document RAG retry moves the recoverable permission-removal state to done", async () => {
  const db = fakeDeletionDb({
    id: "job_doc_rag_1", action: "RAG_DELETE", resourceType: "UserDocument",
    resourceId: "document-1", externalRef: "agent::document-1::sha", attempts: 0, status: "failed"
  });
  const retry = createDeletionJobRetryService({ db, deleteRag: async () => ({ ok: true }) });
  const result = await retry({ jobId: "job_doc_rag_1", actorUserId: "admin-1" });
  assert.equal(result.status, "done");
  assert.equal(db.state.document.metadata.ragRemoval.status, "done");
  assert.equal(db.state.document.metadata.ragRemoval.reason, "durable_deletion_job");
});

test("account deletion retry delegates to the privacy cleanup before completing", async () => {
  const db = fakeDeletionDb({
    id: "job_3", action: "USER_DELETE", resourceType: "User", resourceId: "user_1",
    targetUserId: "user_1", attempts: 1, status: "failed"
  });
  const calls = [];
  const retry = createDeletionJobRetryService({
    db,
    deleteUser: async (job, context) => calls.push({ job, context })
  });
  const result = await retry({
    jobId: "job_3",
    actorUserId: "admin_1",
    ipAddress: "127.0.0.1"
  });
  assert.equal(result.status, "done");
  assert.equal(calls[0].job.targetUserId, "user_1");
  assert.equal(calls[0].context.actorUserId, "admin_1");
  assert.equal(db.state.audits[0].action, "DATA_DELETION_JOB_RETRY_DONE");
});

test("account deletion is suspended first and only completes after external cleanup", async () => {
  const [userDeletion, practiceCleanup, documentDeletion, profileRoute] = await Promise.all([
    readFile(new URL("../../lib/privacy/userDeletion.js", import.meta.url), "utf8"),
    readFile(new URL("../../lib/privacy/effectivePracticeAccountCleanup.js", import.meta.url), "utf8"),
    readFile(new URL("../../lib/privacy/documentDeletion.js", import.meta.url), "utf8"),
    readFile(new URL("../../app/api/profile/route.js", import.meta.url), "utf8")
  ]);
  assert.match(userDeletion, /action: "USER_DELETE"/);
  assert.match(userDeletion, /accessSuspendedReason: `deletion_pending:/);
  assert.match(userDeletion, /await tx\.session\.deleteMany/);
  assert.match(userDeletion, /if \(!result\.ok\)[\s\S]*USER_DELETE_PENDING/);
  assert.match(userDeletion, /deleteUser: userId => deleteUserAfterFinalPracticeSweepPure\(userId, prisma\)/);
  assert.match(practiceCleanup, /FOR UPDATE[\s\S]*scrubOrDeleteEffectivePracticesTx[\s\S]*tx\.user\.delete/);
  assert.doesNotMatch(documentDeletion, /RAG_DELETE_ON_DOCUMENT_DELETE/);
  assert.match(profileRoute, /deleteUserWithPrivacyCleanup/);
});
