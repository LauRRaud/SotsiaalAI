import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  LOGIN_ATTEMPT_DEVICE_ISSUED,
  LOGIN_ATTEMPT_SETTLED,
  LoginAttemptClaimError,
  verifyLoginAttempt
} from "../../lib/auth/loginAttemptVerification.js";

const NOW = new Date("2026-08-11T12:00:00.000Z");
const DEVICE_EXPIRES = new Date("2026-09-11T12:00:00.000Z");
const FUTURE = new Date("2026-12-01T00:00:00.000Z");

/**
 * The fake models a real transaction: writes are staged and only applied when the
 * callback returns. Without that, "the loser's device row is rolled back" would be
 * asserted against a fake that never had rollback — a green test proving nothing.
 */
function makeDb({ attempt, devices = [] } = {}) {
  const committed = {
    attempt: { usedAt: null, otpVerifiedAt: null, trustedDeviceId: null, ...attempt },
    devices: devices.map((row) => ({ ...row }))
  };
  const calls = { locks: [], claims: [], txRuns: 0, rollbacks: 0 };
  let seq = 0;

  async function run(fn) {
    calls.txRuns += 1;
    const staged = {
      attempt: { ...committed.attempt },
      devices: committed.devices.map((row) => ({ ...row }))
    };

    const tx = {
      async $executeRaw(strings, ...values) {
        calls.locks.push({ sql: strings.join("?"), values });
        return 1;
      },
      trustedDevice: {
        async deleteMany({ where }) {
          const before = staged.devices.length;
          staged.devices = staged.devices.filter((row) => {
            if (where.id?.in) return !where.id.in.includes(row.id);
            if (where.userId && row.userId !== where.userId) return true;
            if (where.expiresAt?.lte) return !(row.expiresAt <= where.expiresAt.lte);
            return false;
          });
          return { count: before - staged.devices.length };
        },
        async findMany({ where }) {
          return staged.devices.filter(
            (row) => row.userId === where.userId && row.expiresAt > where.expiresAt.gt
          );
        },
        async create({ data }) {
          seq += 1;
          const row = { id: `device-${seq}`, createdAt: NOW, ...data };
          staged.devices.push(row);
          return row;
        }
      },
      loginTempToken: {
        async updateMany({ where, data }) {
          calls.claims.push({ where, data });
          const row = staged.attempt;
          const matches =
            row.id === where.id &&
            (where.usedAt !== null || row.usedAt === null) &&
            !("trustedDeviceId" in where && where.trustedDeviceId === null && row.trustedDeviceId !== null);
          if (!matches) return { count: 0 };
          Object.assign(row, data);
          return { count: 1 };
        }
      }
    };

    try {
      const value = await fn(tx);
      committed.attempt = staged.attempt;
      committed.devices = staged.devices;
      return value;
    } catch (error) {
      calls.rollbacks += 1;
      throw error;
    }
  }

  return { db: { $transaction: run }, committed, calls };
}

const attemptRow = { id: "attempt-1", userId: "user-1", user: { role: "CLIENT", isAdmin: false } };

test("remembering a device issues exactly one, and the claim is what allows it", async () => {
  const fixture = makeDb({ attempt: attemptRow });

  const result = await verifyLoginAttempt({
    db: fixture.db,
    loginToken: attemptRow,
    rememberDevice: true,
    deviceName: "Tööarvuti",
    deviceExpiresAt: DEVICE_EXPIRES,
    now: NOW,
    generateToken: () => "raw-device-token",
    hashToken: (value) => `sha:${value}`
  });

  assert.equal(result.deviceToken, "raw-device-token");
  assert.equal(fixture.committed.devices.length, 1);
  assert.equal(fixture.committed.devices[0].deviceTokenHash, "sha:raw-device-token");
  assert.equal(fixture.committed.attempt.trustedDeviceId, result.trustedDeviceId);

  const claim = fixture.calls.claims[0];
  assert.equal(claim.where.usedAt, null);
  assert.equal(claim.where.trustedDeviceId, null, "the claim must forbid a second device");
  assert.ok(fixture.calls.locks.length === 1, "the per-user limit needs a lock, not hope");
  assert.match(fixture.calls.locks[0].sql, /pg_advisory_xact_lock/);
  assert.ok(fixture.calls.locks[0].values.includes("user-1"));
});

test("the same attempt cannot hand out a second device, and the loser's row is rolled back", async () => {
  const fixture = makeDb({ attempt: attemptRow });

  await verifyLoginAttempt({
    db: fixture.db,
    loginToken: attemptRow,
    rememberDevice: true,
    deviceExpiresAt: DEVICE_EXPIRES,
    now: NOW,
    generateToken: () => "first-token"
  });
  assert.equal(fixture.committed.devices.length, 1);

  await assert.rejects(
    () =>
      verifyLoginAttempt({
        db: fixture.db,
        loginToken: attemptRow,
        rememberDevice: true,
        deviceExpiresAt: DEVICE_EXPIRES,
        now: NOW,
        generateToken: () => "second-token"
      }),
    (error) =>
      error instanceof LoginAttemptClaimError && error.code === LOGIN_ATTEMPT_DEVICE_ISSUED
  );

  assert.equal(fixture.calls.rollbacks, 1);
  assert.equal(fixture.committed.devices.length, 1, "the second device must not survive");
  assert.equal(fixture.committed.devices[0].deviceTokenHash.includes("second-token"), false);
});

test("an already used attempt settles nothing", async () => {
  const fixture = makeDb({ attempt: { ...attemptRow, usedAt: NOW } });

  await assert.rejects(
    () =>
      verifyLoginAttempt({
        db: fixture.db,
        loginToken: attemptRow,
        rememberDevice: false,
        now: NOW
      }),
    (error) => error instanceof LoginAttemptClaimError && error.code === LOGIN_ATTEMPT_SETTLED
  );
  assert.equal(fixture.committed.attempt.otpVerifiedAt, null);
});

test("not remembering creates nothing and never detaches an existing device", async () => {
  const fixture = makeDb({ attempt: { ...attemptRow, trustedDeviceId: "device-earlier" } });

  const result = await verifyLoginAttempt({
    db: fixture.db,
    loginToken: attemptRow,
    rememberDevice: false,
    now: NOW
  });

  assert.equal(result.deviceToken, null);
  assert.equal(fixture.committed.devices.length, 0);
  assert.equal(fixture.calls.locks.length, 0, "no device work, no lock");
  const claim = fixture.calls.claims[0];
  assert.equal("trustedDeviceId" in claim.where, false);
  assert.equal("trustedDeviceId" in claim.data, false, "must not clear the earlier device");
  assert.equal(fixture.committed.attempt.trustedDeviceId, "device-earlier");
});

test("the per-user device limit evicts inside the same locked transaction", async () => {
  const existing = Array.from({ length: 6 }, (_, index) => ({
    id: `old-${index}`,
    userId: "user-1",
    expiresAt: FUTURE,
    createdAt: new Date(2026, 0, index + 1),
    lastUsedAt: new Date(2026, 0, index + 1)
  }));
  const fixture = makeDb({ attempt: attemptRow, devices: existing });

  await verifyLoginAttempt({
    db: fixture.db,
    loginToken: attemptRow,
    rememberDevice: true,
    deviceExpiresAt: DEVICE_EXPIRES,
    now: NOW,
    generateToken: () => "newest"
  });

  assert.ok(
    fixture.committed.devices.length <= existing.length,
    `limiit ei tohi kasvada: ${fixture.committed.devices.length}`
  );
  assert.ok(fixture.committed.devices.some((row) => row.deviceTokenHash));
  assert.ok(fixture.calls.locks.length === 1);
});

/* SOL-AUTH-11: the route must not own this decision any more. */
test("login-step2 delegates the whole issuance and stops clearing a fresh cookie", async () => {
  const source = await readFile(
    new URL("../../app/api/auth/login-step2/route.js", import.meta.url),
    "utf8"
  );

  assert.match(source, /verifyLoginAttempt\(/);
  assert.doesNotMatch(source, /tx\.trustedDevice\.create/);
  assert.doesNotMatch(source, /prisma\.\$transaction/);
  // the cookie is only cleared when this attempt never had a device
  assert.match(source, /else if \(!loginToken\.trustedDeviceId\)/);
});
