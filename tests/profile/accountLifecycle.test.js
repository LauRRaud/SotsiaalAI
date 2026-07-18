import assert from "node:assert/strict";
import test from "node:test";
import {
  deleteProfileForUser,
  updateProfileForUser
} from "../../lib/profile/accountLifecycle.js";

function request(ip = "198.51.100.10") {
  return new Request("http://localhost/api/profile", {
    headers: {
      "x-forwarded-for": ip,
      "user-agent": "profile-account-lifecycle-test"
    }
  });
}

function makeDb({
  id = "user-1",
  email = "current@example.test",
  passwordHash = "stored-pin-hash",
  sessionVersion = 4,
  role = "CLIENT",
  emailOwners = {},
  pendingConflict = null
} = {}) {
  const user = { id, email, passwordHash, sessionVersion, role };
  const calls = { findUnique: [], update: [], pendingFindFirst: [] };
  const db = {
    user: {
      async findUnique(args) {
        calls.findUnique.push(args);
        if (args.where.id) return args.where.id === user.id ? { ...user } : null;
        if (args.where.email) {
          if (args.where.email === user.email) return { ...user };
          const ownerId = emailOwners[args.where.email];
          return ownerId ? { id: ownerId, email: args.where.email } : null;
        }
        return null;
      },
      async update(args) {
        calls.update.push(args);
        const { sessionVersion: sv, ...scalar } = args.data;
        Object.assign(user, scalar);
        if (sv?.increment) user.sessionVersion += sv.increment;
        return { email: user.email, role: user.role };
      }
    },
    pendingEmailChange: {
      async findFirst(args) {
        calls.pendingFindFirst.push(args);
        return pendingConflict;
      }
    }
  };
  return { db, user, calls };
}

function verifier(result, calls = []) {
  return async (args) => {
    calls.push(args);
    return result;
  };
}

function pendingSpy(calls = []) {
  return async (args) => {
    calls.push(args);
    return {
      token: `token-for-${args.newEmail}`,
      tokenHash: "hash",
      expiresAt: new Date("2999-01-01T00:00:00.000Z"),
      newEmail: args.newEmail
    };
  };
}

test("email change requires the current PIN before any pending change or mail", async () => {
  const fixture = makeDb();
  const reauthCalls = [];
  const emailCalls = [];
  const pendingCalls = [];

  const result = await updateProfileForUser({
    db: fixture.db,
    userId: fixture.user.id,
    request: request(),
    nextEmail: "new@example.test",
    verifyCurrentPassword: verifier({ ok: false, reason: "required" }, reauthCalls),
    createPendingChange: pendingSpy(pendingCalls),
    onEmailChangeRequested: async (payload) => emailCalls.push(payload)
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.messageKey, "profile.errors.current_pin_required");
  assert.equal(result.error.status, 400);
  assert.equal(reauthCalls[0].operation, "put");
  assert.equal(pendingCalls.length, 0);
  assert.deepEqual(emailCalls, []);
  assert.equal(fixture.calls.update.length, 0);
  assert.equal(fixture.user.email, "current@example.test");
});

test("wrong current PIN blocks an email change with no pending, mail or session change", async () => {
  const fixture = makeDb();
  const pendingCalls = [];
  const emailCalls = [];

  const result = await updateProfileForUser({
    db: fixture.db,
    userId: fixture.user.id,
    request: request(),
    nextEmail: "new@example.test",
    currentPassword: "0000",
    verifyCurrentPassword: verifier({ ok: false, reason: "invalid" }),
    createPendingChange: pendingSpy(pendingCalls),
    onEmailChangeRequested: async (payload) => emailCalls.push(payload)
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.status, 401);
  assert.equal(pendingCalls.length, 0);
  assert.deepEqual(emailCalls, []);
  assert.equal(fixture.calls.update.length, 0);
  assert.equal(fixture.user.email, "current@example.test");
  assert.equal(fixture.user.sessionVersion, 4);
});

test("verify-then-swap: correct PIN records a pending change and mails the new address only", async () => {
  const fixture = makeDb();
  const emailCalls = [];
  const pendingCalls = [];

  const result = await updateProfileForUser({
    db: fixture.db,
    userId: fixture.user.id,
    request: request(),
    nextEmail: "new@example.test",
    currentPassword: "1234",
    verifyCurrentPassword: verifier({ ok: true }),
    createPendingChange: pendingSpy(pendingCalls),
    onEmailChangeRequested: async (payload) => emailCalls.push(payload)
  });

  assert.equal(result.ok, true);
  assert.equal(result.emailChangeRequested, true);
  assert.equal(result.requiresReauth, false); // login identity not swapped yet
  assert.equal(result.pendingEmail, "new@example.test");

  // login identity, verification and sessions are untouched
  assert.equal(fixture.calls.update.length, 0);
  assert.equal(fixture.user.email, "current@example.test");
  assert.equal(fixture.user.sessionVersion, 4);

  assert.equal(pendingCalls.length, 1);
  assert.equal(pendingCalls[0].newEmail, "new@example.test");
  assert.equal(emailCalls.length, 1);
  assert.equal(emailCalls[0].newEmail, "new@example.test");
  assert.equal(emailCalls[0].token, "token-for-new@example.test");
});

test("submitting the current email does not reauthenticate, record a pending change or mail", async () => {
  const fixture = makeDb();
  const reauthCalls = [];
  const pendingCalls = [];
  const emailCalls = [];

  const result = await updateProfileForUser({
    db: fixture.db,
    userId: fixture.user.id,
    request: request(),
    nextEmail: fixture.user.email,
    verifyCurrentPassword: verifier({ ok: false, reason: "invalid" }, reauthCalls),
    createPendingChange: pendingSpy(pendingCalls),
    onEmailChangeRequested: async (payload) => emailCalls.push(payload)
  });

  assert.equal(result.ok, true);
  assert.equal(result.emailChangeRequested, false);
  assert.equal(result.requiresReauth, false);
  assert.deepEqual(reauthCalls, []);
  assert.equal(pendingCalls.length, 0);
  assert.deepEqual(emailCalls, []);
});

test("a target address already used by another account is rejected before creating a pending change", async () => {
  const fixture = makeDb({ emailOwners: { "taken@example.test": "someone-else" } });
  const pendingCalls = [];

  const result = await updateProfileForUser({
    db: fixture.db,
    userId: fixture.user.id,
    request: request(),
    nextEmail: "taken@example.test",
    currentPassword: "1234",
    verifyCurrentPassword: verifier({ ok: true }),
    createPendingChange: pendingSpy(pendingCalls)
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.messageKey, "profile.email_update.error_email_in_use");
  assert.equal(result.error.status, 409);
  assert.equal(pendingCalls.length, 0);
});

test("a competing pending change on the same target address is rejected", async () => {
  const fixture = makeDb({
    pendingConflict: { id: "other-pending", userId: "someone-else", newEmail: "new@example.test" }
  });
  const pendingCalls = [];

  const result = await updateProfileForUser({
    db: fixture.db,
    userId: fixture.user.id,
    request: request(),
    nextEmail: "new@example.test",
    currentPassword: "1234",
    verifyCurrentPassword: verifier({ ok: true }),
    createPendingChange: pendingSpy(pendingCalls)
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.messageKey, "profile.email_update.error_email_in_use");
  assert.equal(result.error.status, 409);
  assert.equal(pendingCalls.length, 0);
});

test("PIN change requires the current PIN, hashes only after it passes, revokes sessions and notifies", async () => {
  const rejected = makeDb();
  let rejectedHashCalls = 0;
  const rejectedResult = await updateProfileForUser({
    db: rejected.db,
    userId: rejected.user.id,
    request: request(),
    nextPassword: "5678",
    currentPassword: "0000",
    verifyCurrentPassword: verifier({ ok: false, reason: "invalid" }),
    hashPin: async () => {
      rejectedHashCalls += 1;
      return "new-hash";
    }
  });
  assert.equal(rejectedResult.ok, false);
  assert.equal(rejectedResult.error.status, 401);
  assert.equal(rejectedHashCalls, 0);
  assert.equal(rejected.calls.update.length, 0);

  const accepted = makeDb();
  const pinNotices = [];
  const acceptedResult = await updateProfileForUser({
    db: accepted.db,
    userId: accepted.user.id,
    request: request(),
    nextPassword: "5678",
    currentPassword: "1234",
    verifyCurrentPassword: verifier({ ok: true }),
    hashPin: async (pin) => `hash:${pin}`,
    onPinChanged: async (payload) => pinNotices.push(payload)
  });
  assert.equal(acceptedResult.ok, true);
  assert.equal(acceptedResult.requiresReauth, true);
  assert.deepEqual(accepted.calls.update[0].data, {
    passwordHash: "hash:5678",
    sessionVersion: { increment: 1 }
  });
  assert.equal(accepted.user.sessionVersion, 5);
  assert.deepEqual(pinNotices, [{ email: "current@example.test" }]);
});

test("passwordless account cannot change email; it must set up a PIN first (step-up)", async () => {
  const fixture = makeDb({ passwordHash: null });
  const reauthCalls = [];
  const pendingCalls = [];

  const result = await updateProfileForUser({
    db: fixture.db,
    userId: fixture.user.id,
    request: request(),
    nextEmail: "new@example.test",
    verifyCurrentPassword: verifier({ ok: true }, reauthCalls),
    createPendingChange: pendingSpy(pendingCalls)
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.messageKey, "profile.errors.pin_setup_required");
  assert.equal(result.error.status, 409);
  assert.equal(result.error.extras.code, "PIN_SETUP_REQUIRED");
  assert.deepEqual(reauthCalls, []); // no reauth attempted; blocked earlier
  assert.equal(pendingCalls.length, 0);
  assert.equal(fixture.user.email, "current@example.test");
});

test("passwordless account cannot change its PIN without recovery step-up", async () => {
  const fixture = makeDb({ passwordHash: null });
  const result = await updateProfileForUser({
    db: fixture.db,
    userId: fixture.user.id,
    request: request(),
    nextPassword: "5678",
    verifyCurrentPassword: verifier({ ok: true }),
    hashPin: async () => "x"
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.messageKey, "profile.errors.pin_setup_required");
  assert.equal(result.error.status, 409);
  assert.equal(fixture.calls.update.length, 0);
});

test("PUT current-PIN failures are limited before bcrypt and isolate user/IP keys", async () => {
  const limitedUserId = "put-limit-user";
  const limitedIp = "203.0.113.21";
  let compareCalls = 0;
  const attempt = async (userId = limitedUserId, ip = limitedIp) => {
    const fixture = makeDb({ id: userId });
    return updateProfileForUser({
      db: fixture.db,
      userId,
      request: request(ip),
      nextEmail: `new-${userId.replace(/[^a-z0-9]/gi, "-")}@example.test`,
      currentPassword: "0000",
      createPendingChange: pendingSpy(),
      reauthOptions: {
        comparePin: async () => {
          compareCalls += 1;
          return false;
        }
      }
    });
  };

  for (let index = 0; index < 10; index += 1) {
    const result = await attempt();
    assert.equal(result.error.status, 401);
  }
  const limited = await attempt();
  assert.equal(limited.error.status, 429);
  assert.equal(limited.error.messageKey, "api.common.rate_limited");
  assert.equal(compareCalls, 10);

  const differentUser = await attempt("other-put-user");
  const differentIp = await attempt(limitedUserId, "203.0.113.22");
  assert.equal(differentUser.error.status, 401);
  assert.equal(differentIp.error.status, 401);
});

test("DELETE current-PIN failures are rate limited and do not start cleanup", async () => {
  const userId = "delete-limit-user";
  const ip = "203.0.113.31";
  let compareCalls = 0;
  let deletionCalls = 0;
  const attempt = async () => {
    const fixture = makeDb({ id: userId });
    return deleteProfileForUser({
      db: fixture.db,
      userId,
      request: request(ip),
      currentPassword: "0000",
      deleteUser: async () => {
        deletionCalls += 1;
        return { ok: true, pending: false };
      },
      reauthOptions: {
        comparePin: async () => {
          compareCalls += 1;
          return false;
        }
      }
    });
  };

  for (let index = 0; index < 10; index += 1) {
    const result = await attempt();
    assert.equal(result.error.status, 401);
  }
  const limited = await attempt();
  assert.equal(limited.error.status, 429);
  assert.equal(limited.error.messageKey, "api.common.rate_limited");
  assert.equal(compareCalls, 10);
  assert.equal(deletionCalls, 0);
});
