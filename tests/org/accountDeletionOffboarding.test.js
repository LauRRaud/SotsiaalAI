import assert from "node:assert/strict";
import test from "node:test";

import {
  assertOrganizationAccountDeletionReady,
  offboardOrganizationMembershipsForAccountDeletion
} from "../../lib/org/accountDeletion.js";

function fixture({ status = "ACTIVE", owners = ["membership-1", "membership-2"], liveWork = 0 } = {}) {
  const now = new Date("2026-08-13T01:00:00.000Z");
  const calls = [];
  const membership = {
    id: "membership-1",
    organizationId: "organization-1",
    userId: "user-1",
    status,
    seatRole: "SOCIAL_WORKER"
  };
  const tx = {
    organizationMembership: {
      findMany: async () => [membership],
      findFirst: async () => membership,
      update: async (input) => {
        calls.push({ model: "membership", input });
        Object.assign(membership, input.data);
        return { ...membership };
      }
    },
    organizationCapabilityGrant: {
      findMany: async () => owners.map((membershipId) => ({ membershipId })),
      updateMany: async (input) => {
        calls.push({ model: "grant", input });
        return { count: 1 };
      }
    },
    organizationWorkAssignment: { count: async () => liveWork },
    organizationSeatAssignment: {
      updateMany: async (input) => {
        calls.push({ model: "seat", input });
        return { count: 1 };
      }
    },
    organizationMembershipUnit: {
      updateMany: async (input) => {
        calls.push({ model: "unit", input });
        return { count: 1 };
      }
    },
    dataAuditLog: {
      create: async (input) => {
        calls.push({ model: "audit", input });
        return input.data;
      }
    }
  };
  return { tx, membership, calls, now };
}

test("SOL-ORG-18: viimase omaniku konto kustutus peatub parandatava põhjusega", async () => {
  const { tx, membership, now } = fixture({ owners: ["membership-1"] });
  await assert.rejects(
    () => offboardOrganizationMembershipsForAccountDeletion("user-1", { db: tx, now }),
    (error) => error?.status === 409 && error?.messageKey === "org.errors.last_owner_cannot_leave"
  );
  assert.equal(membership.userId, "user-1");
  assert.equal(membership.status, "ACTIVE");
});

test("SOL-ORG-18: preflight tagastab parandatava konflikti enne konto peatamist", async () => {
  const { tx } = fixture({ owners: ["membership-1"] });
  const db = { $transaction: async (work) => work(tx) };
  await assert.rejects(
    () => assertOrganizationAccountDeletionReady("user-1", { db }),
    (error) => error?.status === 409 && error?.messageKey === "org.errors.last_owner_cannot_leave"
  );
});

test("SOL-ORG-18: elav töö peatab kustutuse enne liikmesuse muutmist", async () => {
  const { tx, membership, now } = fixture({ liveWork: 2 });
  await assert.rejects(
    () => offboardOrganizationMembershipsForAccountDeletion("user-1", { db: tx, now }),
    (error) => error?.status === 409 && error?.details?.liveWork === 2
  );
  assert.equal(membership.userId, "user-1");
});

test("SOL-ORG-18: kahe omaniku puhul lõpetatakse aktiivne seos ja säilib tombstone", async () => {
  const { tx, membership, calls, now } = fixture();
  const result = await offboardOrganizationMembershipsForAccountDeletion("user-1", { db: tx, now });

  assert.equal(result.membershipsEnded, 1);
  assert.equal(result.membershipsErased, 1);
  assert.equal(membership.status, "ENDED");
  assert.equal(membership.userId, null);
  assert.equal(membership.userErasedAt, now);
  assert.equal(calls.filter((call) => ["seat", "grant", "unit"].includes(call.model)).length, 3);
  assert.deepEqual(calls.filter((call) => call.model === "audit").map((call) => call.input.data.action), [
    "org.member_ended",
    "org.member_identity_erased"
  ]);
});

test("SOL-ORG-18: lõpetatud ajalooline liikmesus anonüümitakse ilma tööajaloo kustutamiseta", async () => {
  const { tx, membership, calls, now } = fixture({ status: "ENDED", owners: [] });
  const result = await offboardOrganizationMembershipsForAccountDeletion("user-1", { db: tx, now });

  assert.equal(result.membershipsEnded, 0);
  assert.equal(result.membershipsErased, 1);
  assert.equal(membership.userId, null);
  assert.equal(calls.some((call) => ["seat", "grant", "unit"].includes(call.model)), false);
  assert.deepEqual(calls.filter((call) => call.model === "audit").map((call) => call.input.data.action), [
    "org.member_identity_erased"
  ]);
});
