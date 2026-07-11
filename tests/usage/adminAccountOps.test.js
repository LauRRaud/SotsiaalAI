import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createDeletionJobRetryService } from "../../lib/privacy/deletionJobRetryService.js";

function fakeDeletionDb(job) {
  const state = { job: { ...job }, audits: [] };
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
    async $transaction(callback) { return callback(db); }
  };
  return db;
}

test("user suspension is persisted and enforced by every login path", async () => {
  const [schema, migration, auth, loginStep1, resend, route] = await Promise.all([
    readFile(new URL("../../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(new URL("../../prisma/migrations/20260711170000_user_access_suspension/migration.sql", import.meta.url), "utf8"),
    readFile(new URL("../../auth.js", import.meta.url), "utf8"),
    readFile(new URL("../../app/api/auth/login-step1/route.js", import.meta.url), "utf8"),
    readFile(new URL("../../app/api/auth/login-resend-otp/route.js", import.meta.url), "utf8"),
    readFile(new URL("../../app/api/admin/usage/users/route.js", import.meta.url), "utf8")
  ]);
  assert.match(schema, /accessSuspendedAt\s+DateTime\?/);
  assert.match(migration, /ADD COLUMN "accessSuspendedAt"/);
  assert.ok((auth.match(/accessSuspendedAt/g) || []).length >= 4);
  assert.match(auth, /currentUser\.accessSuspendedAt[\s\S]*SESSION_REVOKED/);
  assert.match(loginStep1, /!user\.passwordHash \|\| user\.accessSuspendedAt/);
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
  const [userDeletion, documentDeletion, profileRoute] = await Promise.all([
    readFile(new URL("../../lib/privacy/userDeletion.js", import.meta.url), "utf8"),
    readFile(new URL("../../lib/privacy/documentDeletion.js", import.meta.url), "utf8"),
    readFile(new URL("../../app/api/profile/route.js", import.meta.url), "utf8")
  ]);
  assert.match(userDeletion, /action: "USER_DELETE"/);
  assert.match(userDeletion, /accessSuspendedReason: `deletion_pending:/);
  assert.match(userDeletion, /await tx\.session\.deleteMany/);
  assert.match(userDeletion, /if \(!result\.ok\)[\s\S]*USER_DELETE_PENDING/);
  assert.match(userDeletion, /performUserPrivacyCleanup[\s\S]*prisma\.user\.delete/);
  assert.doesNotMatch(documentDeletion, /RAG_DELETE_ON_DOCUMENT_DELETE/);
  assert.match(profileRoute, /deleteUserWithPrivacyCleanup/);
});
