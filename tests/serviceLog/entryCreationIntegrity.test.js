import test from "node:test";
import assert from "node:assert/strict";

import { createEntry } from "../../lib/serviceLog/entries.js";

const ENV = { SERVICE_LOG_ENABLED: "1" };
const PROFILE = { id: "profile-1", ownershipMode: "SOLO" };

function makeDb({ referral = null, service = null, siblingEntries = [] } = {}) {
  const entries = [];
  return {
    entries,
    serviceProviderProfile: {
      findFirst: async () => PROFILE
    },
    serviceReferral: {
      findFirst: async ({ where }) => {
        if (!referral || where.id !== referral.id) return null;
        return referral;
      }
    },
    serviceProviderService: {
      findFirst: async ({ where }) => {
        if (!service || where.id !== service.id) return null;
        return service;
      }
    },
    serviceEntry: {
      findFirst: async () => null,
      findMany: async ({ cursor, skip = 0, take }) => {
        const cursorIndex = cursor
          ? siblingEntries.findIndex((row) => row.id === cursor.id)
          : -1;
        const start = cursor ? cursorIndex + skip : 0;
        return siblingEntries.slice(start, start + take);
      },
      create: async ({ data }) => {
        const row = {
          ...data,
          id: `entry-${entries.length + 1}`,
          createdAt: new Date("2026-08-12T10:00:00.000Z"),
          updatedAt: new Date("2026-08-12T10:00:00.000Z")
        };
        entries.push(row);
        return row;
      }
    }
  };
}

function entryInput(overrides = {}) {
  return {
    clientDisplayName: "Mari",
    clientExternalRef: "external-a",
    date: "2026-08-12",
    unit: "HOUR",
    quantity: 1,
    ...overrides
  };
}

function activeReferral(overrides = {}) {
  return {
    id: "referral-1",
    clientUserId: null,
    clientDisplayName: "Mari",
    clientExternalRef: "external-a",
    serviceId: null,
    unit: "HOUR",
    status: "ACTIVE",
    periodStart: new Date("2026-08-01T00:00:00.000Z"),
    periodEnd: new Date("2026-08-31T00:00:00.000Z"),
    allocatedQuantity: 10,
    allocationPeriod: "MONTH",
    ...overrides
  };
}

test("SOL-SLOG-06: sama nimi ei luba kasutada teise välisviitega suunamist", async () => {
  const db = makeDb({ referral: activeReferral() });

  const error = await createEntry(
    "user-1",
    entryInput({ referralId: "referral-1", clientExternalRef: "external-b" }),
    { db, env: ENV }
  ).catch((caught) => caught);

  assert.equal(error.status, 400);
  assert.equal(error.messageKey, "service_log.errors.referral_client_mismatch");
  assert.equal(db.entries.length, 0);
});

test("SOL-SLOG-06: suunamise nime ja välisviite sama paar läbib", async () => {
  const db = makeDb({ referral: activeReferral() });

  const entry = await createEntry(
    "user-1",
    entryInput({ referralId: "referral-1" }),
    { db, env: ENV }
  );

  assert.equal(entry.clientExternalRef, "external-a");
  assert.equal(db.entries.length, 1);
});

test("5001. suunamiskirje mõjutab uue kirje ületamishoiatust", async () => {
  const referral = activeReferral({ allocatedQuantity: 5001 });
  const siblingEntries = Array.from({ length: 5001 }, (_, index) => ({
    id: `entry-${String(index + 1).padStart(5, "0")}`,
    referralId: referral.id,
    unit: "HOUR",
    quantity: 1,
    date: new Date("2026-08-12T00:00:00.000Z"),
    status: "FINAL"
  }));
  const db = makeDb({ referral, siblingEntries });

  const result = await createEntry(
    "user-1",
    entryInput({ referralId: referral.id }),
    { db, env: ENV }
  );

  assert.equal(result.overrun.warn, true);
  assert.equal(result.overrun.balance.used, 5001);
  assert.equal(result.overrun.wouldRemain, -1);
});

test("SOL-SLOG-07: teenuseta kirje ei muuda tühja kataloogi vabatekstiks", async () => {
  const db = makeDb();

  const error = await createEntry("user-1", entryInput({ activities: ["suvaline"] }), {
    db,
    env: ENV
  }).catch((caught) => caught);

  assert.equal(error.status, 400);
  assert.equal(error.messageKey, "service_log.errors.activity_not_allowed");
  assert.equal(db.entries.length, 0);
});

test("SOL-SLOG-07: tühi teenusekataloog lubab ainult tühja tegevusmassiivi", async () => {
  const db = makeDb({ service: { id: "service-1", activityCatalog: [] } });

  const error = await createEntry(
    "user-1",
    entryInput({ serviceId: "service-1", activities: ["suvaline"] }),
    { db, env: ENV }
  ).catch((caught) => caught);

  assert.equal(error.status, 400);
  assert.equal(error.messageKey, "service_log.errors.activity_not_allowed");
  assert.equal(db.entries.length, 0);
});

test("SOL-SLOG-07: ainult kataloogi väärtus salvestub", async () => {
  const db = makeDb({ service: { id: "service-1", activityCatalog: ["kodukülastus"] } });

  const entry = await createEntry(
    "user-1",
    entryInput({ serviceId: "service-1", activities: ["kodukülastus"] }),
    { db, env: ENV }
  );

  assert.deepEqual(entry.activities, ["kodukülastus"]);
});
