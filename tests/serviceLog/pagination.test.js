import assert from "node:assert/strict";
import test from "node:test";
import { getMonthlyReport } from "../../lib/serviceLog/monthReport.js";
import { getNarrativeSeed, listNarratives } from "../../lib/serviceLog/narratives.js";
import { findAllById } from "../../lib/serviceLog/pagination.js";
import { getReferralBalance, listReferrals } from "../../lib/serviceLog/referrals.js";

const ENV = { SERVICE_LOG_ENABLED: "1" };
const PROFILE = { id: "profile-1", ownershipMode: "SOLO" };

function pagedModel(rows) {
  return {
    findMany: async ({ cursor, skip = 0, take }) => {
      const cursorIndex = cursor ? rows.findIndex((row) => row.id === cursor.id) : -1;
      const start = cursor ? cursorIndex + skip : 0;
      return rows.slice(start, start + take);
    }
  };
}

function entry(index, overrides = {}) {
  return {
    id: `entry-${String(index).padStart(5, "0")}`,
    providerProfileId: PROFILE.id,
    clientUserId: null,
    clientDisplayName: "Mari",
    clientExternalRef: "external-a",
    serviceId: "service-1",
    referralId: null,
    unit: "HOUR",
    quantity: 1,
    date: new Date("2026-08-12T00:00:00.000Z"),
    status: "FINAL",
    activities: [],
    note: null,
    noteProvenance: null,
    confirmedManually: false,
    updatedAt: new Date(),
    ...overrides
  };
}

test("võtmekursor loeb 5001. rea ja tema väärtus jõuab kuu summasse", async () => {
  const entries = Array.from({ length: 5001 }, (_, index) =>
    entry(index + 1, index === 5000 ? { quantity: 9 } : {})
  );
  const db = {
    serviceProviderProfile: { findFirst: async () => PROFILE },
    serviceEntry: pagedModel(entries),
    serviceReferral: pagedModel([]),
    userDocument: { findMany: async () => [] }
  };
  const report = await getMonthlyReport("user-1", { month: "2026-08" }, { db, env: ENV });

  assert.equal(report.entries.length, 5001);
  assert.equal(report.summary.totalsByUnit[0].final, 5009);
});

test("501. suunamine ei kao nimekirjast", async () => {
  const referrals = Array.from({ length: 501 }, (_, index) => ({
    id: `ref-${String(index + 1).padStart(4, "0")}`,
    providerProfileId: PROFILE.id,
    status: "ACTIVE",
    createdAt: new Date(index),
    unit: "HOUR",
    allocatedQuantity: 10,
    allocationPeriod: "MONTH"
  }));
  const result = await listReferrals(
    "user-1",
    { month: "2026-08" },
    {
      db: {
        serviceProviderProfile: { findFirst: async () => PROFILE },
        serviceReferral: pagedModel(referrals),
        serviceEntry: pagedModel([])
      },
      env: ENV
    }
  );
  assert.equal(result.length, 501);
  assert.ok(result.some((row) => row.id === "ref-0501"));
});

test("5001. suunamiskirje muudab saldot", async () => {
  const referral = {
    id: "ref-1",
    providerProfileId: PROFILE.id,
    unit: "HOUR",
    allocatedQuantity: 6000,
    allocationPeriod: "MONTH"
  };
  const entries = Array.from({ length: 5001 }, (_, index) =>
    entry(index + 1, { referralId: referral.id, quantity: index === 5000 ? 7 : 1 })
  );
  const balance = await getReferralBalance(
    "user-1",
    referral.id,
    { month: "2026-08" },
    {
      db: {
        serviceProviderProfile: { findFirst: async () => PROFILE },
        serviceReferral: { findFirst: async () => referral },
        serviceEntry: pagedModel(entries)
      },
      env: ENV
    }
  );
  assert.equal(balance.entriesCounted, 5001);
  assert.equal(balance.used, 5007);
});

test("2001. narratiivikirje jõuab seedi faktibaasi", async () => {
  const entries = Array.from({ length: 2001 }, (_, index) =>
    entry(index + 1, index === 2000 ? { note: "Piiri taga olev fakt" } : {})
  );
  const seed = await getNarrativeSeed(
    "user-1",
    {
      clientDisplayName: "Mari",
      clientExternalRef: "external-a",
      periodYear: 2026,
      periodMonth: 8
    },
    {
      db: {
        serviceProviderProfile: { findFirst: async () => PROFILE },
        serviceEntry: pagedModel(entries),
        serviceReferral: { findFirst: async () => null }
      },
      env: ENV
    }
  );
  assert.equal(seed.entryCount, 2001);
  assert.equal(seed.notes[0].note, "Piiri taga olev fakt");
});

test("501. kuunarratiiv ei kao listist", async () => {
  const rows = Array.from({ length: 501 }, (_, index) => ({
    id: `narrative-${String(index + 1).padStart(4, "0")}`,
    providerProfileId: PROFILE.id,
    periodYear: 2026,
    periodMonth: 8,
    bodyText: `Lugu ${index + 1}`
  }));
  const result = await listNarratives(
    "user-1",
    { periodYear: 2026, periodMonth: 8 },
    {
      db: {
        serviceProviderProfile: { findFirst: async () => PROFILE },
        serviceMonthlyNarrative: pagedModel(rows)
      },
      env: ENV
    }
  );
  assert.equal(result.length, 501);
});

test("lehekülg seiskub valju veaga, mitte lõputu või pooliku vastusega", async () => {
  const broken = {
    findMany: async () => Array.from({ length: 2 }, () => ({ id: "same" }))
  };
  await assert.rejects(
    () => findAllById(broken, { pageSize: 2 }),
    /SERVICE_LOG_PAGINATION_STALLED/
  );
});
