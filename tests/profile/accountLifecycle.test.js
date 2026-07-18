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
  emailVerified = new Date("2026-01-01T00:00:00.000Z"),
  sessionVersion = 4,
  role = "CLIENT"
} = {}) {
  const user = { id, email, passwordHash, emailVerified, sessionVersion, role };
  const calls = { findUnique: [], update: [] };
  const db = {
    user: {
      async findUnique(args) {
        calls.findUnique.push(args);
        if (args.where.id) return args.where.id === user.id ? { ...user } : null;
        if (args.where.email) return args.where.email === user.email ? { ...user } : null;
        return null;
      },
      async update(args) {
        calls.update.push(args);
        const { sessionVersion: sessionVersionUpdate, ...scalarData } = args.data;
        Object.assign(user, scalarData);
        if (sessionVersionUpdate?.increment) {
          user.sessionVersion += sessionVersionUpdate.increment;
        }
        return { email: user.email, role: user.role };
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

test("actual email change requires a current PIN before any update or verification mail", async () => {
  const fixture = makeDb();
  const reauthCalls = [];
  const emailCalls = [];

  const result = await updateProfileForUser({
    db: fixture.db,
    userId: fixture.user.id,
    request: request(),
    nextEmail: "new@example.test",
    currentPassword: undefined,
    verifyCurrentPassword: verifier({ ok: false, reason: "required" }, reauthCalls),
    onEmailChanged: async (email) => emailCalls.push(email)
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.messageKey, "profile.errors.current_pin_required");
  assert.equal(result.error.status, 400);
  assert.equal(reauthCalls.length, 1);
  assert.equal(reauthCalls[0].operation, "put");
  assert.equal(reauthCalls[0].currentPassword, undefined);
  assert.equal(fixture.calls.update.length, 0);
  assert.deepEqual(emailCalls, []);
  assert.equal(fixture.user.email, "current@example.test");
  assert.ok(fixture.user.emailVerified);
  assert.equal(fixture.user.sessionVersion, 4);
});

test("wrong current PIN blocks a real email change without DB or email side effects", async () => {
  const fixture = makeDb();
  const emailCalls = [];

  const result = await updateProfileForUser({
    db: fixture.db,
    userId: fixture.user.id,
    request: request(),
    nextEmail: "new@example.test",
    currentPassword: "0000",
    verifyCurrentPassword: verifier({ ok: false, reason: "invalid" }),
    onEmailChanged: async (email) => emailCalls.push(email)
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.messageKey, "profile.errors.current_pin_invalid");
  assert.equal(result.error.status, 401);
  assert.equal(fixture.calls.update.length, 0);
  assert.deepEqual(emailCalls, []);
  assert.equal(fixture.user.email, "current@example.test");
  assert.ok(fixture.user.emailVerified);
  assert.equal(fixture.user.sessionVersion, 4);
});

test("correct current PIN keeps the existing email-change session and verification flow", async () => {
  const fixture = makeDb();
  const emailCalls = [];

  const result = await updateProfileForUser({
    db: fixture.db,
    userId: fixture.user.id,
    request: request(),
    nextEmail: "new@example.test",
    currentPassword: "1234",
    verifyCurrentPassword: verifier({ ok: true }),
    onEmailChanged: async (email) => emailCalls.push(email)
  });

  assert.equal(result.ok, true);
  assert.equal(result.requiresReauth, true);
  assert.deepEqual(emailCalls, ["new@example.test"]);
  assert.equal(fixture.calls.update.length, 1);
  assert.deepEqual(fixture.calls.update[0].data, {
    email: "new@example.test",
    emailVerified: null,
    emailVerificationSentAt: null,
    sessionVersion: { increment: 1 }
  });
  assert.equal(fixture.user.email, "new@example.test");
  assert.equal(fixture.user.emailVerified, null);
  assert.equal(fixture.user.sessionVersion, 5);
});

test("submitting the current email does not reauthenticate, revoke sessions, or send mail", async () => {
  const fixture = makeDb();
  const reauthCalls = [];
  const emailCalls = [];

  const result = await updateProfileForUser({
    db: fixture.db,
    userId: fixture.user.id,
    request: request(),
    nextEmail: fixture.user.email,
    verifyCurrentPassword: verifier({ ok: false, reason: "invalid" }, reauthCalls),
    onEmailChanged: async (email) => emailCalls.push(email)
  });

  assert.equal(result.ok, true);
  assert.equal(result.requiresReauth, false);
  assert.deepEqual(reauthCalls, []);
  assert.equal(fixture.calls.update.length, 0);
  assert.deepEqual(emailCalls, []);
  assert.equal(fixture.user.sessionVersion, 4);
});

test("PIN change still requires the current PIN and only hashes after it passes", async () => {
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
  assert.equal(rejectedResult.error.messageKey, "profile.errors.current_pin_invalid");
  assert.equal(rejectedHashCalls, 0);
  assert.equal(rejected.calls.update.length, 0);

  const accepted = makeDb();
  const acceptedResult = await updateProfileForUser({
    db: accepted.db,
    userId: accepted.user.id,
    request: request(),
    nextPassword: "5678",
    currentPassword: "1234",
    verifyCurrentPassword: verifier({ ok: true }),
    hashPin: async (pin) => `hash:${pin}`
  });

  assert.equal(acceptedResult.ok, true);
  assert.equal(acceptedResult.requiresReauth, true);
  assert.deepEqual(accepted.calls.update[0].data, {
    passwordHash: "hash:5678",
    sessionVersion: { increment: 1 }
  });
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

test("passwordless user retains the existing profile update path", async () => {
  const fixture = makeDb({ passwordHash: null });
  const reauthCalls = [];
  const emailCalls = [];

  const result = await updateProfileForUser({
    db: fixture.db,
    userId: fixture.user.id,
    request: request(),
    nextEmail: "passwordless-new@example.test",
    verifyCurrentPassword: verifier({ ok: false, reason: "invalid" }, reauthCalls),
    onEmailChanged: async (email) => emailCalls.push(email)
  });

  assert.equal(result.ok, true);
  assert.deepEqual(reauthCalls, []);
  assert.equal(fixture.user.email, "passwordless-new@example.test");
  assert.equal(fixture.user.emailVerified, null);
  assert.equal(fixture.user.sessionVersion, 5);
  assert.deepEqual(emailCalls, ["passwordless-new@example.test"]);
});
