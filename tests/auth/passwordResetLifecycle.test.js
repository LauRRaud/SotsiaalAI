import assert from "node:assert/strict";
import test from "node:test";
import { resetPasswordWithToken } from "../../lib/auth/passwordResetLifecycle.js";

function makeDb({
  identifier = "password-reset:user@example.test",
  token = "valid-token",
  expires = new Date("2999-01-01T00:00:00.000Z"),
  user = { id: "user-1", email: "user@example.test", sessionVersion: 3, passwordHash: "old-hash" }
} = {}) {
  const state = {
    verificationToken: token ? { identifier, token, expires } : null,
    user: user ? { ...user } : null
  };
  const calls = {
    txRuns: 0,
    userUpdate: [],
    tokenDelete: [],
    deleteMany: { trustedDevice: [], session: [], loginTempToken: [], emailOtpCode: [] }
  };

  function recordTokenDelete(args) {
    calls.tokenDelete.push(args.where.identifier_token);
    state.verificationToken = null;
    return {};
  }

  const db = {
    verificationToken: {
      async findFirst() {
        return state.verificationToken ? { ...state.verificationToken } : null;
      },
      async delete(args) {
        return recordTokenDelete(args);
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
          async delete(args) {
            return recordTokenDelete(args);
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
    token: "valid-token",
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

  // one-time token consumed inside the transaction
  assert.equal(fixture.calls.tokenDelete.length, 1);
  assert.equal(fixture.state.verificationToken, null);
});

test("missing token is rejected without touching the account", async () => {
  const fixture = makeDb({ token: null });
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

test("expired token is consumed and rejected, with no session change", async () => {
  const fixture = makeDb({ expires: new Date("2000-01-01T00:00:00.000Z") });
  const result = await resetPasswordWithToken({
    db: fixture.db,
    token: "valid-token",
    pin: "5678",
    hashPin: async () => "unused"
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.messageKey, "api.auth.reset.token_expired");
  assert.equal(result.error.status, 410);
  assert.equal(fixture.calls.txRuns, 0);
  assert.equal(fixture.calls.tokenDelete.length, 1);
  assert.equal(fixture.state.verificationToken, null);
});

test("token pointing at a missing user is consumed and rejected", async () => {
  const fixture = makeDb({ user: null });
  const result = await resetPasswordWithToken({
    db: fixture.db,
    token: "valid-token",
    pin: "5678",
    hashPin: async () => "unused"
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.messageKey, "api.auth.reset.user_not_found");
  assert.equal(result.error.status, 404);
  assert.equal(fixture.calls.txRuns, 0);
  assert.equal(fixture.calls.tokenDelete.length, 1);
});

test("only tokens in the password-reset namespace are accepted", async () => {
  const fixture = makeDb();
  let seenWhere = null;
  fixture.db.verificationToken.findFirst = async (args) => {
    seenWhere = args.where;
    return { identifier: "password-reset:user@example.test", token: "valid-token", expires: new Date("2999-01-01T00:00:00.000Z") };
  };

  await resetPasswordWithToken({
    db: fixture.db,
    token: "valid-token",
    pin: "5678",
    hashPin: async () => "hashed"
  });

  assert.deepEqual(seenWhere, {
    token: "valid-token",
    identifier: { startsWith: "password-reset:" }
  });
});
