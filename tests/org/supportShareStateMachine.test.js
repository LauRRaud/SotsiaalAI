import test from "node:test";
import assert from "node:assert/strict";

import { closeSupportShare, openSupportShare } from "../../lib/org/supportShare.js";

function fakeDb(initial) {
  const state = { row: { ...initial }, updates: 0, audits: 0 };
  const tx = {
    $queryRaw: async () => [{ id: state.row.id }],
    wellbeingSupportShare: {
      findFirst: async ({ where }) => {
        if (where.id !== state.row.id) return null;
        if (where.ownerUserId && where.ownerUserId !== state.row.ownerUserId) return null;
        if (where.recipientMembershipId && where.recipientMembershipId !== state.row.recipientMembershipId) {
          return null;
        }
        return { ...state.row };
      },
      updateMany: async () => {
        state.updates += 1;
        return { count: 1 };
      },
      findUnique: async () => ({ ...state.row, owner: null })
    },
    dataAuditLog: {
      create: async () => {
        state.audits += 1;
        return {};
      }
    }
  };
  return {
    state,
    $transaction: async (callback) => callback(tx)
  };
}

function terminalRow(status) {
  return {
    id: `share_${status}`,
    status,
    openedAt: status === "CLOSED" ? null : new Date("2026-08-12T10:00:00Z"),
    organizationId: "org_1",
    recipientMembershipId: "member_1",
    ownerUserId: "user_1",
    updatedAt: new Date("2026-08-12T10:00:00Z")
  };
}

test("SOL-ORG-15: CLOSED cannot be opened even when openedAt is null", async () => {
  const db = fakeDb(terminalRow("CLOSED"));
  await assert.rejects(
    () => openSupportShare("share_CLOSED", { recipientMembershipId: "member_1" }, { db }),
    (error) => error.status === 409 && error.messageKey === "org.errors.support_share_closed"
  );
  assert.equal(db.state.updates, 0);
  assert.equal(db.state.audits, 0);
});

for (const status of ["RECALLED", "CORRECTED", "CLOSED"]) {
  test(`SOL-ORG-15: ${status} cannot be closed and leaves no audit`, async () => {
    const db = fakeDb(terminalRow(status));
    await assert.rejects(
      () =>
        closeSupportShare(
          `share_${status}`,
          { recipientMembershipId: "member_1", actorUserId: "user_2" },
          { db }
        ),
      (error) => error.status === 409
    );
    assert.equal(db.state.updates, 0);
    assert.equal(db.state.audits, 0);
  });
}
