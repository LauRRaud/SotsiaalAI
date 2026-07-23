import assert from "node:assert/strict";
import test from "node:test";

import { acceptInviteWithinTx } from "../../lib/invites/acceptInviteCore.js";

/*
  Jagatud kutse-vastuvõtu tuum. Sama loogika kasutavad token-rada
  (app/api/invites/[id]/accept) ja ootel-kutse rada (app/api/invites/pending).
  Fake-tx muster (repo standard) — ei ela DB-d.
*/

function makeInvite(overrides = {}) {
  return {
    id: "inv1",
    roomId: "room1",
    status: "SENT",
    expiresAt: new Date(Date.now() + 3_600_000),
    useCount: 0,
    maxUses: 1,
    inviteeEmail: "guest@example.com",
    paymentMode: "SPONSORED_BY_HOST",
    sponsoredPaidAt: new Date(),
    sponsoredByUserId: "host1",
    sponsoredByOrgId: null,
    sponsoredRole: null,
    sponsoredPlan: null,
    room: { id: "room1", ownerId: "host1" },
    ...overrides
  };
}

function makeTx({ existingMember = null, activeSub = false, existingSub = null } = {}) {
  const calls = { subCreate: [], subUpdate: [], memberUpsert: [], inviteUpdate: [] };
  const tx = {
    subscription: {
      findFirst: async (args) => {
        if (args?.where?.status === "ACTIVE") {
          return activeSub ? { id: "sub-active" } : null;
        }
        return existingSub;
      },
      create: async ({ data }) => {
        calls.subCreate.push(data);
        return { id: "newsub", ...data };
      },
      update: async ({ where, data }) => {
        calls.subUpdate.push({ where, data });
        return { id: where.id, ...data };
      }
    },
    roomMember: {
      findFirst: async () => existingMember,
      count: async () => 0,
      upsert: async ({ where, create, update }) => {
        calls.memberUpsert.push({ where, create, update });
        return {};
      }
    },
    invite: {
      update: async ({ where, data }) => {
        calls.inviteUpdate.push({ where, data });
        return {};
      }
    }
  };
  return { tx, calls };
}

const guestAuth = {
  userId: "guest1",
  role: "CLIENT",
  isAdmin: false,
  email: "guest@example.com"
};

test("sponsored accept activates a fresh subscription with a normalized plan id", async () => {
  const { tx, calls } = makeTx();
  const invite = makeInvite();

  const before = Date.now();
  const result = await acceptInviteWithinTx({
    tx,
    invite,
    auth: guestAuth,
    userEmail: "guest@example.com",
    displayName: "Guest",
    now: new Date()
  });

  assert.equal(result.ok, true);
  assert.equal(result.roomId, "room1");
  assert.equal(result.billing_source, "SPONSORED_BY_HOST");

  assert.equal(calls.subCreate.length, 1, "creates exactly one subscription");
  const sub = calls.subCreate[0];
  assert.equal(sub.status, "ACTIVE");
  assert.equal(sub.billingSource, "SPONSORED_BY_HOST");
  assert.equal(sub.sponsorUserId, "host1");
  assert.equal(sub.inviteId, "inv1");
  assert.equal(sub.nextBilling, null, "sponsor month does not auto-renew");
  assert.ok(sub.planDefinitionId, "writes a normalized plan definition id");
  assert.ok(sub.validUntil instanceof Date, "sets validUntil");
  // +1 kuu aken (umbkaudne — kuu pikkus varieerub)
  assert.ok(sub.validUntil.getTime() > before + 20 * 24 * 3_600_000);

  assert.equal(calls.memberUpsert.length, 1);
  assert.equal(calls.memberUpsert[0].create.billingSource, "SPONSORED_BY_HOST");
  assert.equal(calls.memberUpsert[0].create.displayName, "Guest");
  assert.equal(calls.memberUpsert[0].create.role, "MEMBER");

  assert.equal(calls.inviteUpdate.length, 1);
  assert.equal(calls.inviteUpdate[0].data.useCount, 1);
  assert.equal(calls.inviteUpdate[0].data.status, "ACCEPTED");
  assert.equal(calls.inviteUpdate[0].data.acceptedByUserId, "guest1");
});

test("sponsored accept reactivates an existing subscription instead of creating a new one", async () => {
  const { tx, calls } = makeTx({ existingSub: { id: "oldsub" } });
  const invite = makeInvite();

  const result = await acceptInviteWithinTx({
    tx,
    invite,
    auth: guestAuth,
    userEmail: "guest@example.com",
    displayName: "Guest"
  });

  assert.equal(result.billing_source, "SPONSORED_BY_HOST");
  assert.equal(calls.subCreate.length, 0, "does not create a duplicate subscription");
  assert.equal(calls.subUpdate.length, 1);
  assert.equal(calls.subUpdate[0].where.id, "oldsub");
  assert.equal(calls.subUpdate[0].data.status, "ACTIVE");
  assert.equal(calls.subUpdate[0].data.canceledAt, null, "clears any prior cancellation");
  assert.ok(calls.subUpdate[0].data.planDefinitionId);
});

test("email mismatch is rejected (security gate for the id-based path)", async () => {
  const { tx, calls } = makeTx();
  const invite = makeInvite();

  await assert.rejects(
    () =>
      acceptInviteWithinTx({
        tx,
        invite,
        auth: { ...guestAuth, email: "intruder@example.com" },
        userEmail: "intruder@example.com",
        displayName: "X"
      }),
    (err) => err.code === "INVITE_EMAIL_MISMATCH" && err.status === 403
  );
  assert.equal(calls.subCreate.length, 0);
  assert.equal(calls.memberUpsert.length, 0);
});

test("expired invite is rejected", async () => {
  const { tx } = makeTx();
  const invite = makeInvite({ expiresAt: new Date(Date.now() - 1000) });

  await assert.rejects(
    () =>
      acceptInviteWithinTx({
        tx,
        invite,
        auth: guestAuth,
        userEmail: "guest@example.com"
      }),
    (err) => err.code === "INVITE_EXPIRED" && err.status === 410
  );
});

test("exhausted invite (useCount >= maxUses) is rejected", async () => {
  const { tx } = makeTx();
  const invite = makeInvite({ useCount: 1, maxUses: 1 });

  await assert.rejects(
    () =>
      acceptInviteWithinTx({
        tx,
        invite,
        auth: guestAuth,
        userEmail: "guest@example.com"
      }),
    (err) => err.code === "INVITE_EXHAUSTED"
  );
});

test("sponsored invite without a completed sponsor payment is rejected", async () => {
  const { tx, calls } = makeTx();
  const invite = makeInvite({ sponsoredPaidAt: null });

  await assert.rejects(
    () =>
      acceptInviteWithinTx({
        tx,
        invite,
        auth: guestAuth,
        userEmail: "guest@example.com"
      }),
    (err) => err.code === "INVITE_PAYMENT_PENDING"
  );
  assert.equal(calls.subCreate.length, 0);
});

test("an already-active member short-circuits without touching billing", async () => {
  const { tx, calls } = makeTx({
    existingMember: { billingSource: "SPONSORED_BY_HOST" }
  });
  const invite = makeInvite();

  const result = await acceptInviteWithinTx({
    tx,
    invite,
    auth: guestAuth,
    userEmail: "guest@example.com",
    displayName: "Guest"
  });

  assert.equal(result.ok, true);
  assert.equal(result.billing_source, "SPONSORED_BY_HOST");
  assert.equal(calls.subCreate.length, 0);
  assert.equal(calls.subUpdate.length, 0);
  assert.equal(calls.inviteUpdate.length, 0, "does not re-consume the invite");
});
