import assert from "node:assert/strict";
import test from "node:test";
import { resetPasswordWithToken } from "../../lib/auth/passwordResetLifecycle.js";
import { hashVerificationToken } from "../../lib/auth/verificationTokens.js";

// Fixed raw secret so the suite is deterministic. It has the shape the issuing
// path produces (64 hex chars); the row stores its hash.
const RAW_TOKEN = "9f".repeat(32);
const STORED_TOKEN = hashVerificationToken(RAW_TOKEN);

function makeDb({
  identifier = "password-reset:user@example.test",
  storedToken = STORED_TOKEN,
  expires = new Date("2999-01-01T00:00:00.000Z"),
  user = { id: "user-1", email: "user@example.test", sessionVersion: 3, passwordHash: "old-hash" }
} = {}) {
  const state = {
    verificationToken: storedToken ? { identifier, token: storedToken, expires } : null,
    user: user ? { ...user } : null
  };
  const calls = {
    txRuns: 0,
    findFirstWhere: [],
    userUpdate: [],
    tokenClaims: [],
    deleteMany: { trustedDevice: [], session: [], loginTempToken: [], emailOtpCode: [] }
  };

  function claimToken(where) {
    calls.tokenClaims.push(where);
    const row = state.verificationToken;
    const hit = row && row.identifier === where.identifier && row.token === where.token;
    if (!hit) return { count: 0 };
    state.verificationToken = null;
    return { count: 1 };
  }

  const db = {
    verificationToken: {
      async findFirst(args) {
        calls.findFirstWhere.push(args.where);
        const row = state.verificationToken;
        if (!row) return null;
        const candidates = args.where?.token?.in || [];
        if (!candidates.includes(row.token)) return null;
        const prefix = args.where?.identifier?.startsWith;
        if (prefix && !row.identifier.startsWith(prefix)) return null;
        return { ...row };
      },
      async deleteMany(args) {
        return claimToken(args.where);
      }
    },
    user: {
      async findUnique(args) {
        if (state.user && state.user.email === args.where.email) return { ...state.user };
        return null;
      }
    },
    async $transaction(fn) {
      calls.txRuns += 1;
      const tx = {
        user: {
          async update(args) {
            calls.userUpdate.push(args);
            if (state.user) {
              if (args.data.passwordHash) state.user.passwordHash = args.data.passwordHash;
              if (args.data.sessionVersion?.increment) {
                state.user.sessionVersion += args.data.sessionVersion.increment;
              }
            }
            return {};
          }
        },
        trustedDevice: {
          async deleteMany(args) {
            calls.deleteMany.trustedDevice.push(args.where);
            return { count: 0 };
          }
        },
        session: {
          async deleteMany(args) {
            calls.deleteMany.session.push(args.where);
            return { count: 0 };
          }
        },
        loginTempToken: {
          async deleteMany(args) {
            calls.deleteMany.loginTempToken.push(args.where);
            return { count: 0 };
          }
        },
        emailOtpCode: {
          async deleteMany(args) {
            calls.deleteMany.emailOtpCode.push(args.where);
            return { count: 0 };
          }
        },
        verificationToken: {
          async deleteMany(args) {
            return claimToken(args.where);
          }
        }
      };
      return fn(tx);
    }
  };

  return { db, state, calls };
}

test("valid reset applies the new PIN and revokes every prior session surface in one transaction", async () => {
  const fixture = makeDb();
  const hashArgs = [];

  const result = await resetPasswordWithToken({
    db: fixture.db,
    token: RAW_TOKEN,
    pin: "5678",
    hashPin: async (pin) => {
      hashArgs.push(pin);
      return `hashed:${pin}`;
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.userId, "user-1");
  assert.equal(result.email, "user@example.test");
  assert.deepEqual(hashArgs, ["5678"]);
  assert.equal(fixture.calls.txRuns, 1);

  assert.equal(fixture.calls.userUpdate.length, 1);
  assert.deepEqual(fixture.calls.userUpdate[0].data, {
    passwordHash: "hashed:5678",
    sessionVersion: { increment: 1 }
  });
  assert.equal(fixture.state.user.sessionVersion, 4);
  assert.equal(fixture.state.user.passwordHash, "hashed:5678");

  assert.deepEqual(fixture.calls.deleteMany.trustedDevice, [{ userId: "user-1" }]);
  assert.deepEqual(fixture.calls.deleteMany.session, [{ userId: "user-1" }]);
  assert.deepEqual(fixture.calls.deleteMany.loginTempToken, [{ userId: "user-1" }]);
  assert.deepEqual(fixture.calls.deleteMany.emailOtpCode, [{ userId: "user-1" }]);

  // one-time token claimed inside the transaction
  assert.equal(fixture.calls.tokenClaims.length, 1);
  assert.equal(fixture.state.verificationToken, null);
});

test("the value stored in the database is not a usable link", async () => {
  const fixture = makeDb();

  const result = await resetPasswordWithToken({
    db: fixture.db,
    token: STORED_TOKEN,
    pin: "5678",
    hashPin: async () => "unused"
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.messageKey, "api.auth.reset.token_invalid");
  assert.equal(fixture.calls.txRuns, 0);
  assert.equal(fixture.calls.userUpdate.length, 0);
  // the row survives: a database reader cannot even burn someone else's token
  assert.notEqual(fixture.state.verificationToken, null);
});

test("the raw secret never appears in the row the issuing path writes", () => {
  assert.notEqual(STORED_TOKEN, RAW_TOKEN);
  assert.ok(STORED_TOKEN.startsWith("v2:"));
  assert.equal(hashVerificationToken(STORED_TOKEN) === STORED_TOKEN, false);
});

test("a legacy row that still holds the raw secret stays consumable", async () => {
  const fixture = makeDb({ storedToken: RAW_TOKEN });

  const result = await resetPasswordWithToken({
    db: fixture.db,
    token: RAW_TOKEN,
    pin: "5678",
    hashPin: async () => "hashed:5678"
  });

  assert.equal(result.ok, true);
  assert.equal(fixture.state.verificationToken, null);
});

test("losing the claim race changes nothing and reports an invalid token", async () => {
  const fixture = makeDb();
  // the winner consumed the row between our read and our claim
  const originalFindFirst = fixture.db.verificationToken.findFirst;
  fixture.db.verificationToken.findFirst = async (args) => {
    const row = await originalFindFirst(args);
    fixture.state.verificationToken = null;
    return row;
  };

  const result = await resetPasswordWithToken({
    db: fixture.db,
    token: RAW_TOKEN,
    pin: "5678",
    hashPin: async () => "hashed:5678"
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.messageKey, "api.auth.reset.token_invalid");
  assert.equal(result.error.status, 400);
  assert.equal(fixture.calls.txRuns, 1);
  assert.equal(fixture.calls.userUpdate.length, 0, "the loser must not touch the account");
  assert.deepEqual(fixture.calls.deleteMany.session, [], "the loser must not end sessions");
});

test("missing token is rejected without touching the account", async () => {
  const fixture = makeDb({ storedToken: null });
  const result = await resetPasswordWithToken({
    db: fixture.db,
    token: "does-not-exist",
    pin: "5678",
    hashPin: async () => "unused"
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.messageKey, "api.auth.reset.token_invalid");
  assert.equal(result.error.status, 400);
  assert.equal(fixture.calls.txRuns, 0);
  assert.equal(fixture.calls.userUpdate.length, 0);
});

test("empty token is rejected before any query runs", async () => {
  const fixture = makeDb();
  const result = await resetPasswordWithToken({
    db: fixture.db,
    token: "   ",
    pin: "5678",
    hashPin: async () => "unused"
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.messageKey, "api.auth.reset.token_invalid");
  assert.equal(fixture.calls.findFirstWhere.length, 0);
});

test("expired token is consumed and rejected, with no session change", async () => {
  const fixture = makeDb({ expires: new Date("2000-01-01T00:00:00.000Z") });
  const result = await resetPasswordWithToken({
    db: fixture.db,
    token: RAW_TOKEN,
    pin: "5678",
    hashPin: async () => "unused"
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.messageKey, "api.auth.reset.token_expired");
  assert.equal(result.error.status, 410);
  assert.equal(fixture.calls.txRuns, 0);
  assert.equal(fixture.calls.tokenClaims.length, 1);
  assert.equal(fixture.state.verificationToken, null);
});

test("token pointing at a missing user is consumed and rejected", async () => {
  const fixture = makeDb({ user: null });
  const result = await resetPasswordWithToken({
    db: fixture.db,
    token: RAW_TOKEN,
    pin: "5678",
    hashPin: async () => "unused"
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.messageKey, "api.auth.reset.user_not_found");
  assert.equal(result.error.status, 404);
  assert.equal(fixture.calls.txRuns, 0);
  assert.equal(fixture.calls.tokenClaims.length, 1);
});

test("only tokens in the password-reset namespace are accepted", async () => {
  const fixture = makeDb();

  await resetPasswordWithToken({
    db: fixture.db,
    token: RAW_TOKEN,
    pin: "5678",
    hashPin: async () => "hashed"
  });

  assert.equal(fixture.calls.findFirstWhere.length, 1);
  const where = fixture.calls.findFirstWhere[0];
  assert.deepEqual(where.identifier, { startsWith: "password-reset:" });
  assert.ok(where.token.in.includes(STORED_TOKEN), "the stored hash must be a candidate");
  assert.ok(
    !where.token.in.some((value) => value.startsWith("v2:") && value !== STORED_TOKEN),
    "no second hashed candidate"
  );
});
