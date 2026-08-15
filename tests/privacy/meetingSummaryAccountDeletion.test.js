import assert from "node:assert/strict";
import test from "node:test";
import { runUserDeletionCleanup } from "../../lib/privacy/userDeletionOrchestrator.js";

// T07 E5 contract 6: the meeting-summary <jobId>.json snapshot holds generated summary text, so it
// belongs in the fail-closed account-deletion chain. If its purge fails, the whole account deletion
// must stay pending (user row NOT deleted) rather than reporting a clean erasure that left content.

function baseArgs(overrides = {}) {
  const calls = { deleteUser: 0, purgeUserId: null, removeExportUserId: null };
  const args = {
    targets: { documents: [], materialSubmissions: [], artifacts: [], preInquirySourceIds: [] },
    user: { email: "person@example.com" },
    targetUserId: "user-1",
    deleteRagReference: async () => ({ ok: true }),
    deleteDocumentFile: async () => ({ ok: true }),
    deleteMaterialFile: async () => ({ ok: true }),
    recordArtifact: async () => {},
    deleteVerificationTokens: async () => {},
    deleteChatLogs: async () => {},
    deletePrivatePracticeCandidates: async () => {},
    deletePersonalDomainEvents: async () => ({ count: 0 }),
    purgeMeetingSummarySnapshots: async (userId) => {
      calls.purgeUserId = userId;
      return { ok: true, failures: [] };
    },
    removeDataExports: async (userId) => {
      calls.removeExportUserId = userId;
      return { ok: true, removed: 0 };
    },
    deleteUser: async () => {
      calls.deleteUser += 1;
      return {};
    },
    ...overrides
  };
  return { args, calls };
}

test("account deletion stays pending (fail-closed) when a meeting-summary snapshot purge fails", async () => {
  const { args, calls } = baseArgs({
    purgeMeetingSummarySnapshots: async () => ({ ok: false, failures: [{ jobId: "j1", error: "EPERM" }] })
  });

  const result = await runUserDeletionCleanup(args);

  assert.equal(result.ok, false);
  assert.equal(calls.deleteUser, 0, "the user must NOT be deleted while a content-bearing snapshot remains");
  assert.ok(
    Array.isArray(result.failures) && result.failures.some((f) => f.stage === "snapshot"),
    "the failure is recorded under the snapshot stage"
  );
});

test("account deletion proceeds once the snapshot purge succeeds", async () => {
  const { args, calls } = baseArgs();

  const result = await runUserDeletionCleanup(args);

  assert.equal(result.ok, true);
  assert.equal(calls.deleteUser, 1);
  assert.equal(calls.purgeUserId, "user-1", "the purge is scoped to the deleted user");
  assert.equal(calls.removeExportUserId, "user-1", "data export cleanup precedes the user cascade");
});

test("account deletion stays pending when a data export ZIP cannot be removed", async () => {
  const { args, calls } = baseArgs({
    removeDataExports: async () => ({ ok: false, failures: [{ jobId: "export-1", error: "EPERM" }] })
  });

  const result = await runUserDeletionCleanup(args);

  assert.equal(result.ok, false);
  assert.equal(calls.deleteUser, 0);
  assert.ok(result.failures.some(failure => failure.stage === "data-export"));
});

test("the snapshot purge runs even when the user has no documents (residue is user-scoped)", async () => {
  const { args, calls } = baseArgs();

  await runUserDeletionCleanup(args);

  assert.equal(calls.purgeUserId, "user-1");
});
