import assert from "node:assert/strict";
import test from "node:test";
import {
  SUPPORT_SHARE_RETENTION_POLICY,
  purgeExpiredSupportShares,
  supportShareInternals
} from "../../lib/org/supportShare.js";

test("new support content gets a 30-day deadline and a three-year contentless receipt", () => {
  const now = new Date("2026-08-13T10:00:00.000Z");
  const snapshot = { summary: "Only the confirmed text" };
  const data = supportShareInternals.initialRetentionData({
    ownerUserId: "owner",
    organizationId: "org",
    recipientMembershipId: "recipient",
    recipientRole: "DIRECT_MANAGER",
    snapshot,
    now
  });
  assert.equal(data.contentDeletionDueAt.toISOString(), "2026-09-12T10:00:00.000Z");
  assert.equal(data.receiptRetentionEndsAt.toISOString(), "2029-08-13T10:00:00.000Z");
  assert.equal(data.retentionPolicyVersion, SUPPORT_SHARE_RETENTION_POLICY.version);
  assert.match(data.contentHmac, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(data.ownerPseudonym, "owner");
  assert.notEqual(data.ownerPseudonym, data.recipientPseudonym);
});

test("retention sweep scrubs content before deleting the receipt and honours legal hold", async () => {
  const now = new Date("2026-08-13T10:00:00.000Z");
  const updated = [];
  const deleted = [];
  const reads = [];
  let findCall = 0;
  const db = {
    wellbeingSupportShare: {
      findMany: async (args) => {
        reads.push(args);
        findCall += 1;
        return findCall === 1 ? [{ id: "content-due" }] : [{ id: "receipt-due" }];
      },
      updateMany: async ({ where, data }) => {
        updated.push({ where, data });
        return { count: 1 };
      },
      deleteMany: async ({ where }) => {
        deleted.push(where);
        return { count: 1 };
      }
    }
  };
  const result = await purgeExpiredSupportShares({ db, now });
  assert.deepEqual(result, { scanned: 2, contentPurged: 1, receiptsPurged: 1 });
  assert.equal(updated[0].data.sharedSnapshotJson, null);
  assert.equal(updated[0].data.contentDeletionReason, "RETENTION_EXPIRED");
  assert.equal(updated[0].data.sourceRecordId, null);
  assert.deepEqual(deleted[0], { id: { in: ["receipt-due"] } });
  assert.deepEqual(reads[0].where.OR, [{ legalHoldUntil: null }, { legalHoldUntil: { lte: now } }]);
  assert.deepEqual(reads[1].where.OR, [{ legalHoldUntil: null }, { legalHoldUntil: { lte: now } }]);
});
