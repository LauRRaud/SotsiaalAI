import test from "node:test";
import assert from "node:assert/strict";

import { endReferral, updateReferral } from "../../lib/serviceLog/referrals.js";

const ENV = { SERVICE_LOG_ENABLED: "1" };

function makeReferral(overrides = {}) {
  return {
    id: "referral-1",
    providerProfileId: "profile-1",
    kovName: "KOV A",
    referralNumber: "A-1",
    serviceId: null,
    clientUserId: null,
    clientDisplayName: "Mari",
    clientExternalRef: null,
    periodStart: new Date("2026-08-01T00:00:00.000Z"),
    periodEnd: new Date("2026-08-31T00:00:00.000Z"),
    unit: "HOUR",
    allocatedQuantity: 10,
    allocationPeriod: "MONTH",
    goalsText: null,
    status: "ACTIVE",
    createdAt: new Date("2026-08-01T08:00:00.000Z"),
    updatedAt: new Date("2026-08-01T08:00:00.000Z"),
    ...overrides
  };
}

function makeDb({ usedCount = 0, orphanedCount = 0, referral = makeReferral() } = {}) {
  let row = { ...referral };
  const locks = [];
  const db = {
    locks,
    serviceProviderProfile: { findFirst: async () => ({ id: "profile-1", ownershipMode: "SOLO" }) },
    serviceReferral: {
      findFirst: async ({ where }) =>
        where.id === row.id && where.providerProfileId === row.providerProfileId ? { ...row } : null,
      update: async ({ data }) => {
        row = { ...row, ...data, updatedAt: new Date(row.updatedAt.getTime() + 1) };
        return { ...row };
      }
    },
    serviceEntry: {
      count: async ({ where }) => {
        if (where.OR) return orphanedCount;
        return usedCount;
      }
    },
    $queryRaw: async () => {
      locks.push(row.id);
      return [{ id: row.id }];
    },
    $transaction: async (work) => work(db)
  };
  return db;
}

test("SOL-SLOG-J-02: kasutamata suunamise otsusevälju saab muuta", async () => {
  const db = makeDb();
  const changed = await updateReferral(
    "user-1",
    "referral-1",
    {
      kovName: "KOV B",
      referralNumber: "B-2",
      unit: "SESSION",
      allocationPeriod: "TOTAL",
      allocatedQuantity: 12,
      goalsText: "Uus eesmärk"
    },
    { db, env: ENV }
  );

  assert.equal(changed.kovName, "KOV B");
  assert.equal(changed.referralNumber, "B-2");
  assert.equal(changed.unit, "SESSION");
  assert.equal(changed.allocationPeriod, "TOTAL");
  assert.deepEqual(db.locks, ["referral-1"]);
});

test("SOL-SLOG-J-02: kasutatud suunamise identiteeti ei kirjutata tagasiulatuvalt ümber", async () => {
  const db = makeDb({ usedCount: 1 });
  const error = await updateReferral(
    "user-1",
    "referral-1",
    { kovName: "Teine KOV", unit: "DAY" },
    { db, env: ENV }
  ).catch((caught) => caught);

  assert.equal(error.status, 409);
  assert.equal(error.messageKey, "service_log.errors.referral_locked_by_entries");
});

test("SOL-SLOG-J-02: perioodi kitsendamine ei jäta olemasolevat kirjet otsusest välja", async () => {
  const db = makeDb({ orphanedCount: 1 });
  const error = await updateReferral(
    "user-1",
    "referral-1",
    { periodStart: "2026-08-10" },
    { db, env: ENV }
  ).catch((caught) => caught);

  assert.equal(error.status, 409);
  assert.equal(error.messageKey, "service_log.errors.period_excludes_entries");
});

test("SOL-SLOG-J-02: lõpetamine on teadlik ühekordne olekumuutus", async () => {
  const db = makeDb();
  const ended = await endReferral("user-1", "referral-1", { db, env: ENV });
  const second = await endReferral("user-1", "referral-1", { db, env: ENV }).catch(
    (error) => error
  );

  assert.equal(ended.status, "ENDED");
  assert.equal(second.status, 409);
  assert.equal(second.messageKey, "service_log.errors.referral_already_ended");
  assert.deepEqual(db.locks, ["referral-1", "referral-1"]);
});
