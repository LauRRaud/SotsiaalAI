import test from "node:test";
import assert from "node:assert/strict";
import { cleanupDomainEventRetention } from "../../lib/retention.js";
import { runUserDeletionCleanup } from "../../lib/privacy/userDeletionOrchestrator.js";

test("DomainEvent retention applies short30, standard90 and audit_long cutoffs", async () => {
  const calls = [];
  const db = { domainEvent: { async deleteMany(args) { calls.push(args); return { count: 1 }; } } };
  const now = new Date("2026-07-17T12:00:00.000Z");
  assert.deepEqual(await cleanupDomainEventRetention(db, { now, logRetentionDays: 365 }), {
    short30: 1, standard90: 1, auditLong: 1
  });
  assert.equal(calls[0].where.occurredAt.lt.toISOString(), "2026-06-17T12:00:00.000Z");
  assert.equal(calls[1].where.occurredAt.lt.toISOString(), "2026-04-18T12:00:00.000Z");
  assert.equal(calls[2].where.occurredAt.lt.toISOString(), "2025-07-17T12:00:00.000Z");
});

test("account cleanup removes personal source events before deleting the user", async () => {
  const order = [];
  const result = await runUserDeletionCleanup({
    targets: { documents: [], materialSubmissions: [], artifacts: [], preInquirySourceIds: ["inquiry-1"] },
    user: { email: "synthetic@example.invalid" },
    targetUserId: "user-1",
    deleteRagReference: async () => ({ ok: true }),
    deleteDocumentFile: async () => ({ ok: true }),
    deleteMaterialFile: async () => ({ ok: true }),
    recordArtifact: async () => {},
    deleteVerificationTokens: async () => {},
    deleteChatLogs: async () => {},
    deletePersonalDomainEvents: async (ids) => { order.push(["events", ids]); return { count: 2 }; },
    deleteUser: async () => { order.push(["user"]); }
  });
  assert.equal(result.counts.personalDomainEvents, 2);
  assert.deepEqual(order, [["events", ["inquiry-1"]], ["user"]]);
});
