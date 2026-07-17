import assert from "node:assert/strict";
import test from "node:test";
import {
  confirmEmailChangeByToken,
  createPendingEmailChange
} from "../../lib/profile/emailChange.js";

test("createPendingEmailChange stores only the token hash and returns the raw token", async () => {
  const calls = [];
  const db = {
    pendingEmailChange: {
      async upsert(args) {
        calls.push(args);
        return {};
      }
    }
  };
  const now = () => new Date("2026-07-17T00:00:00.000Z");

  const result = await createPendingEmailChange({
    db,
    userId: "user-1",
    newEmail: "new@example.test",
    request: undefined,
    generateToken: () => "raw-token",
    hashToken: (t) => `sha:${t}`,
    now,
    ttlMs: 60 * 60 * 1000
  });

  assert.equal(result.token, "raw-token");
  assert.equal(result.newEmail, "new@example.test");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].where.userId, "user-1");
  assert.equal(calls[0].create.tokenHash, "sha:raw-token");
  assert.equal(calls[0].create.newEmail, "new@example.test");
  assert.equal(calls[0].update.tokenHash, "sha:raw-token");
  assert.equal(
    calls[0].create.expiresAt.toISOString(),
    "2026-07-17T01:00:00.000Z"
  );
});

function makeConfirmDb({ pending, user, emailOwners = {} }) {
  const state = { pending: pending ? { ...pending } : null, user: user ? { ...user } : null };
  const calls = {
    pendingDeleteMany: [],
    txUserUpdate: [],
    txPendingDelete: [],
    deleteMany: { trustedDevice: 0, session: 0, loginTempToken: 0, emailOtpCode: 0 },
    tx: 0
  };
  const db = {
    pendingEmailChange: {
      async findUnique(args) {
        if (state.pending && state.pending.tokenHash === args.where.tokenHash) {
          return { ...state.pending };
        }
        return null;
      },
      async deleteMany(args) {
        calls.pendingDeleteMany.push(args.where);
        if (state.pending && args.where.id === state.pending.id) state.pending = null;
        return { count: 1 };
      }
    },
    user: {
      async findUnique(args) {
        if (args.where.id) {
          return state.user && state.user.id === args.where.id ? { ...state.user } : null;
        }
        if (args.where.email) {
          if (state.user && state.user.email === args.where.email) return { ...state.user };
          const owner = emailOwners[args.where.email];
          return owner ? { id: owner, email: args.where.email } : null;
        }
        return null;
      }
    },
    async $transaction(fn) {
      calls.tx += 1;
      const tx = {
        user: {
          async update(args) {
            calls.txUserUpdate.push(args);
            if (state.user) {
              const { sessionVersion: sv, ...scalar } = args.data;
              Object.assign(state.user, scalar);
              if (sv?.increment) state.user.sessionVersion = (state.user.sessionVersion || 0) + sv.increment;
            }
            return {};
          }
        },
        pendingEmailChange: {
          async delete(args) {
            calls.txPendingDelete.push(args.where);
            state.pending = null;
            return {};
          }
        },
        trustedDevice: { async deleteMany() { calls.deleteMany.trustedDevice += 1; return { count: 0 }; } },
        session: { async deleteMany() { calls.deleteMany.session += 1; return { count: 0 }; } },
        loginTempToken: { async deleteMany() { calls.deleteMany.loginTempToken += 1; return { count: 0 }; } },
        emailOtpCode: { async deleteMany() { calls.deleteMany.emailOtpCode += 1; return { count: 0 }; } }
      };
      return fn(tx);
    }
  };
  return { db, state, calls };
}

const future = new Date("2999-01-01T00:00:00.000Z");
const past = new Date("2000-01-01T00:00:00.000Z");
const hashToken = (t) => `sha:${t}`;

test("valid confirmation swaps to the verified new email and revokes all sessions", async () => {
  const fixture = makeConfirmDb({
    pending: { id: "p1", userId: "u1", newEmail: "new@example.test", tokenHash: "sha:raw", expiresAt: future },
    user: { id: "u1", email: "old@example.test", sessionVersion: 2 }
  });

  const result = await confirmEmailChangeByToken({
    db: fixture.db,
    token: "raw",
    hashToken,
    now: () => new Date("2026-07-17T12:00:00.000Z")
  });

  assert.equal(result.ok, true);
  assert.equal(result.oldEmail, "old@example.test");
  assert.equal(result.newEmail, "new@example.test");

  assert.equal(fixture.calls.tx, 1);
  assert.equal(fixture.calls.txUserUpdate.length, 1);
  const data = fixture.calls.txUserUpdate[0].data;
  assert.equal(data.email, "new@example.test");
  assert.ok(data.emailVerified instanceof Date);
  assert.equal(data.emailVerificationSentAt, null);
  assert.deepEqual(data.sessionVersion, { increment: 1 });

  assert.equal(fixture.calls.txPendingDelete.length, 1);
  assert.equal(fixture.calls.deleteMany.trustedDevice, 1);
  assert.equal(fixture.calls.deleteMany.session, 1);
  assert.equal(fixture.calls.deleteMany.loginTempToken, 1);
  assert.equal(fixture.calls.deleteMany.emailOtpCode, 1);
  assert.equal(fixture.state.user.email, "new@example.test");
  assert.equal(fixture.state.user.sessionVersion, 3);
});

test("an unknown / already-used token changes nothing and does not reveal account existence", async () => {
  const fixture = makeConfirmDb({
    pending: { id: "p1", userId: "u1", newEmail: "new@example.test", tokenHash: "sha:real", expiresAt: future },
    user: { id: "u1", email: "old@example.test", sessionVersion: 2 }
  });

  const result = await confirmEmailChangeByToken({ db: fixture.db, token: "wrong", hashToken });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid");
  assert.equal(fixture.calls.tx, 0);
  assert.equal(fixture.state.user.email, "old@example.test");
  assert.equal(fixture.state.pending?.id, "p1");
});

test("an expired token is consumed and rejected without swapping", async () => {
  const fixture = makeConfirmDb({
    pending: { id: "p1", userId: "u1", newEmail: "new@example.test", tokenHash: "sha:raw", expiresAt: past },
    user: { id: "u1", email: "old@example.test", sessionVersion: 2 }
  });

  const result = await confirmEmailChangeByToken({
    db: fixture.db,
    token: "raw",
    hashToken,
    now: () => new Date("2026-07-17T12:00:00.000Z")
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "expired");
  assert.equal(fixture.calls.tx, 0);
  assert.deepEqual(fixture.calls.pendingDeleteMany, [{ id: "p1" }]);
  assert.equal(fixture.state.user.email, "old@example.test");
});

test("a token whose user no longer exists is consumed and rejected", async () => {
  const fixture = makeConfirmDb({
    pending: { id: "p1", userId: "ghost", newEmail: "new@example.test", tokenHash: "sha:raw", expiresAt: future },
    user: { id: "u1", email: "old@example.test", sessionVersion: 2 }
  });

  const result = await confirmEmailChangeByToken({ db: fixture.db, token: "raw", hashToken });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid");
  assert.equal(fixture.calls.tx, 0);
  assert.deepEqual(fixture.calls.pendingDeleteMany, [{ id: "p1" }]);
});

test("a target address claimed by another account since the request is refused (race)", async () => {
  const fixture = makeConfirmDb({
    pending: { id: "p1", userId: "u1", newEmail: "taken@example.test", tokenHash: "sha:raw", expiresAt: future },
    user: { id: "u1", email: "old@example.test", sessionVersion: 2 },
    emailOwners: { "taken@example.test": "someone-else" }
  });

  const result = await confirmEmailChangeByToken({
    db: fixture.db,
    token: "raw",
    hashToken,
    now: () => new Date("2026-07-17T12:00:00.000Z")
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "conflict");
  assert.equal(fixture.calls.tx, 0);
  assert.deepEqual(fixture.calls.pendingDeleteMany, [{ id: "p1" }]);
  assert.equal(fixture.state.user.email, "old@example.test");
});
