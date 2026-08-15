import assert from "node:assert/strict";
import test from "node:test";
import { runUserDeletionCleanup } from "../../lib/privacy/userDeletionOrchestrator.js";
import { cleanupVerificationLinkDispatchRetention } from "../../lib/auth/verificationLinkDispatch.js";

function accountDeletionArgs(overrides = {}) {
  return {
    targets: { documents: [], materialSubmissions: [], artifacts: [], preInquirySourceIds: [] },
    user: { email: "deleted@example.test" },
    targetUserId: "user-1",
    deleteRagReference: async () => ({ ok: true }),
    deleteDocumentFile: async () => ({ ok: true }),
    deleteMaterialFile: async () => ({ ok: true }),
    recordArtifact: async () => {},
    deleteVerificationTokens: async () => {},
    deleteChatLogs: async () => {},
    deleteUser: async () => {},
    ...overrides
  };
}

test("account deletion removes e-mail-derived link dispatch metadata before the user", async () => {
  const order = [];

  const result = await runUserDeletionCleanup(accountDeletionArgs({
    deleteVerificationLinkDispatches: async (email) => {
      order.push(["dispatches", email]);
    },
    deleteUser: async () => {
      order.push(["user"]);
    }
  }));

  assert.equal(result.ok, true);
  assert.deepEqual(order, [
    ["dispatches", "deleted@example.test"],
    ["user"]
  ]);
});

test("retention removes only dispatch claims older than the concurrency lease", async () => {
  const calls = [];
  const db = {
    verificationLinkDispatch: {
      async deleteMany(args) {
        calls.push(args);
        return { count: 2 };
      }
    }
  };
  const now = new Date("2026-08-15T12:00:00.000Z");

  const count = await cleanupVerificationLinkDispatchRetention(db, { now, leaseMs: 120_000 });

  assert.equal(count, 2);
  assert.equal(calls[0].where.claimedAt.lt.toISOString(), "2026-08-15T11:58:00.000Z");
});
