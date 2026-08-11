import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  confirmEmailChangeByToken,
  createPendingEmailChange,
  persistPendingEmailChange,
  prepareEmailChangeToken
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

/* SOL-AUTH-06: minting and persisting must be separable, otherwise a resend cannot
   put the letter in the post before it retires the link the user already holds. */
test("prepareEmailChangeToken mints a secret without touching the database", () => {
  const prepared = prepareEmailChangeToken({
    generateToken: () => "raw-token",
    hashToken: (t) => `sha:${t}`,
    now: () => new Date("2026-07-17T00:00:00.000Z"),
    ttlMs: 60 * 60 * 1000
  });

  assert.equal(prepared.token, "raw-token");
  assert.equal(prepared.tokenHash, "sha:raw-token");
  assert.equal(prepared.expiresAt.toISOString(), "2026-07-17T01:00:00.000Z");
  // Synchronous by construction: it cannot await a write, so there is no way for
  // minting to retire the previous link on its own.
  assert.equal(prepareEmailChangeToken.constructor.name, "Function");
  assert.equal(prepared instanceof Promise, false);
});

test("persistPendingEmailChange is the only step that retires the previous link", async () => {
  const calls = [];
  const db = {
    pendingEmailChange: {
      async upsert(args) {
        calls.push(args);
        return {};
      }
    }
  };

  await persistPendingEmailChange({
    db,
    userId: "user-1",
    newEmail: "new@example.test",
    tokenHash: "sha:fresh",
    expiresAt: new Date("2026-07-17T01:00:00.000Z")
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].update.tokenHash, "sha:fresh");
  assert.equal(calls[0].create.tokenHash, "sha:fresh");
});

function makeConfirmDb({ pending, user, emailOwners = {} }) {
  const state = { pending: pending ? { ...pending } : null, user: user ? { ...user } : null };
  const calls = {
    order: [],
    lockedWith: [],
    pendingDeleteMany: [],
    txUserUpdate: [],
    deleteMany: { trustedDevice: 0, session: 0, loginTempToken: 0, emailOtpCode: 0 },
    tx: 0
  };

  const pendingModel = {
    async findUnique(args) {
      calls.order.push("read");
      if (state.pending && state.pending.tokenHash === args.where.tokenHash) {
        return { ...state.pending };
      }
      return null;
    },
    // The row is unique per user, so identity is (id, tokenHash) — not id alone.
    async deleteMany(args) {
      calls.order.push("consume");
      calls.pendingDeleteMany.push(args.where);
      const row = state.pending;
      const hit =
        row && row.id === args.where.id && row.tokenHash === args.where.tokenHash;
      if (!hit) return { count: 0 };
      state.pending = null;
      return { count: 1 };
    }
  };

  const userModel = {
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
  };

  const db = {
    pendingEmailChange: pendingModel,
    user: userModel,
    async $transaction(fn) {
      calls.tx += 1;
      const tx = {
        pendingEmailChange: pendingModel,
        user: {
          ...userModel,
          async update(args) {
            calls.order.push("write");
            calls.txUserUpdate.push(args);
            if (state.user) {
              const { sessionVersion: sv, ...scalar } = args.data;
              Object.assign(state.user, scalar);
              if (sv?.increment) state.user.sessionVersion = (state.user.sessionVersion || 0) + sv.increment;
            }
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

  const lockPendingRow = async (_tx, tokenHash) => {
    calls.order.push("lock");
    calls.lockedWith.push(tokenHash);
  };

  return { db, state, calls, lockPendingRow };
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
    now: () => new Date("2026-07-17T12:00:00.000Z"),
    lockPendingRow: fixture.lockPendingRow
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

  assert.equal(fixture.calls.deleteMany.trustedDevice, 1);
  assert.equal(fixture.calls.deleteMany.session, 1);
  assert.equal(fixture.calls.deleteMany.loginTempToken, 1);
  assert.equal(fixture.calls.deleteMany.emailOtpCode, 1);
  assert.equal(fixture.state.user.email, "new@example.test");
  assert.equal(fixture.state.user.sessionVersion, 3);
});

/* SOL-AUTH-05: the checks used to run on an unlocked snapshot. */
test("the row is locked before it is read, and consumed before the identity changes", async () => {
  const fixture = makeConfirmDb({
    pending: { id: "p1", userId: "u1", newEmail: "new@example.test", tokenHash: "sha:raw", expiresAt: future },
    user: { id: "u1", email: "old@example.test", sessionVersion: 2 }
  });

  await confirmEmailChangeByToken({
    db: fixture.db,
    token: "raw",
    hashToken,
    lockPendingRow: fixture.lockPendingRow
  });

  assert.deepEqual(fixture.calls.lockedWith, ["sha:raw"]);
  const order = fixture.calls.order;
  assert.ok(order.indexOf("lock") < order.indexOf("read"), "lock must precede the read");
  assert.ok(order.indexOf("consume") < order.indexOf("write"), "claim must precede the effect");
});

/* SOL-AUTH-05 core: a resend rewrites tokenHash on the SAME row id, so a request
   still holding the old snapshot must lose. Keying the write on id alone let the
   stale request swap to the older address and delete the fresh token's row. */
test("a token replaced by a resend cannot still win", async () => {
  const fixture = makeConfirmDb({
    pending: { id: "p1", userId: "u1", newEmail: "old-target@example.test", tokenHash: "sha:stale", expiresAt: future },
    user: { id: "u1", email: "current@example.test", sessionVersion: 2 }
  });

  // the in-flight request read the row; the resend then rewrote it in place
  const readPending = fixture.db.pendingEmailChange.findUnique;
  fixture.db.pendingEmailChange.findUnique = async (args) => {
    const row = await readPending.call(fixture.db.pendingEmailChange, args);
    fixture.state.pending = {
      id: "p1",
      userId: "u1",
      newEmail: "fresh-target@example.test",
      tokenHash: "sha:fresh",
      expiresAt: future
    };
    return row;
  };

  const result = await confirmEmailChangeByToken({
    db: fixture.db,
    token: "stale",
    hashToken,
    lockPendingRow: fixture.lockPendingRow
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid");
  assert.equal(fixture.calls.txUserUpdate.length, 0, "identity must not change");
  assert.equal(fixture.state.user.email, "current@example.test");
  assert.equal(fixture.state.pending?.tokenHash, "sha:fresh", "the fresh token must survive");
});

test("an unknown / already-used token changes nothing and does not reveal account existence", async () => {
  const fixture = makeConfirmDb({
    pending: { id: "p1", userId: "u1", newEmail: "new@example.test", tokenHash: "sha:real", expiresAt: future },
    user: { id: "u1", email: "old@example.test", sessionVersion: 2 }
  });

  const result = await confirmEmailChangeByToken({
    db: fixture.db,
    token: "wrong",
    hashToken,
    lockPendingRow: fixture.lockPendingRow
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid");
  assert.equal(fixture.calls.txUserUpdate.length, 0);
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
    now: () => new Date("2026-07-17T12:00:00.000Z"),
    lockPendingRow: fixture.lockPendingRow
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "expired");
  assert.equal(fixture.calls.txUserUpdate.length, 0);
  assert.deepEqual(fixture.calls.pendingDeleteMany, [{ id: "p1", tokenHash: "sha:raw" }]);
  assert.equal(fixture.state.user.email, "old@example.test");
});

test("a token whose user no longer exists is consumed and rejected", async () => {
  const fixture = makeConfirmDb({
    pending: { id: "p1", userId: "ghost", newEmail: "new@example.test", tokenHash: "sha:raw", expiresAt: future },
    user: { id: "u1", email: "old@example.test", sessionVersion: 2 }
  });

  const result = await confirmEmailChangeByToken({
    db: fixture.db,
    token: "raw",
    hashToken,
    lockPendingRow: fixture.lockPendingRow
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid");
  assert.equal(fixture.calls.txUserUpdate.length, 0);
  assert.deepEqual(fixture.calls.pendingDeleteMany, [{ id: "p1", tokenHash: "sha:raw" }]);
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
    now: () => new Date("2026-07-17T12:00:00.000Z"),
    lockPendingRow: fixture.lockPendingRow
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "conflict");
  assert.equal(fixture.calls.txUserUpdate.length, 0);
  assert.deepEqual(fixture.calls.pendingDeleteMany, [{ id: "p1", tokenHash: "sha:raw" }]);
  assert.equal(fixture.state.user.email, "old@example.test");
});

/* SOL-AUTH-04: opening the link must not change the account. */
test("confirm route: GET only renders the interstitial, POST performs the change", async () => {
  const source = await readFile(
    new URL("../../app/api/profile/email-change/confirm/route.js", import.meta.url),
    "utf8"
  );

  const get = source.slice(source.indexOf("export async function GET"), source.indexOf("export async function POST"));
  const post = source.slice(source.indexOf("export async function POST"));

  assert.ok(!get.includes("confirmEmailChangeByToken"), "GET must not confirm anything");
  assert.ok(!get.includes("prisma"), "GET must not read the token either — a scanner learns nothing");
  assert.ok(get.includes("postForm"), "GET must render the confirming form");
  assert.ok(post.includes("confirmEmailChangeByToken"), "POST must be the one that confirms");

  // the form must post back to this same route, and the auto-submit must exist
  assert.match(source, /method="POST"/);
  assert.match(source, /document\.getElementById\("email-change-confirm-form"\)\.submit\(\)/);
});

/* SOL-AUTH-06: the letter goes out before the working link is retired. */
test("resend route: delivery happens before the token rotation, and failure is honest", async () => {
  const source = await readFile(
    new URL("../../app/api/profile/email-change/route.js", import.meta.url),
    "utf8"
  );

  const send = source.indexOf("await sendEmailChangeConfirmLink(");
  const persist = source.indexOf("await persistPendingEmailChange(");
  assert.ok(send > 0 && persist > send, "the rotation must come after a delivered letter");

  // the swallow-and-report-success path is gone, not merely supplemented
  assert.ok(!source.includes("await createPendingEmailChange("));
  assert.match(source, /profile\.email_update\.resend_failed", 502/);
  assert.match(source, /delivery: "sent"/);
});
