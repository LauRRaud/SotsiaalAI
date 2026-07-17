import assert from "node:assert/strict";
import test from "node:test";

import { markStaleActiveJobsInterrupted } from "../../lib/research/jobStore.js";
import { releaseExpiredUsageReservations } from "../../lib/retention.js";

function matchesStale(row, where) {
  if (where.id && row.id !== where.id) return false;
  if (where.status?.in && !where.status.in.includes(row.status)) return false;
  if (where.status && typeof where.status === "string" && row.status !== where.status) return false;
  if (where.updatedAt?.lt && !(row.updatedAt < where.updatedAt.lt)) return false;
  if (Object.hasOwn(where, "leaseUntil") && row.leaseUntil !== where.leaseUntil) return false;
  if (where.expiresAt?.lt && !(row.expiresAt < where.expiresAt.lt)) return false;
  return true;
}

function createResearchPrisma(rows, { settleBeforeUpdate = false } = {}) {
  let settled = false;
  return {
    researchJob: {
      async findMany({ where }) {
        return rows.filter(row => matchesStale(row, where)).map(row => ({
          id: row.id,
          userId: row.userId,
          payload: row.payload
        }));
      },
      async updateMany({ where, data }) {
        if (settleBeforeUpdate && !settled) {
          settled = true;
          const candidate = rows.find(row => row.id === where.id);
          if (candidate) candidate.status = "done";
        }
        const matching = rows.filter(row => matchesStale(row, where));
        for (const row of matching) Object.assign(row, data);
        return { count: matching.length };
      }
    }
  };
}

test("stale active research job releases its reservation exactly once", async () => {
  const now = new Date("2026-07-17T12:00:00.000Z");
  const rows = [
    {
      id: "stale",
      userId: "user_1",
      payload: { usageIdempotencyKey: "research.run:key_1" },
      status: "queued",
      updatedAt: new Date("2026-07-17T11:40:00.000Z"),
      leaseUntil: null
    },
    {
      id: "fresh",
      userId: "user_1",
      payload: { usageIdempotencyKey: "research.run:key_2" },
      status: "running",
      updatedAt: new Date("2026-07-17T11:50:00.000Z"),
      leaseUntil: null
    }
  ];
  const releases = [];
  const service = {
    async release(input) {
      releases.push(input);
      return { reused: false };
    }
  };
  const prismaClient = createResearchPrisma(rows);

  assert.equal(await markStaleActiveJobsInterrupted({ prismaClient, service, now }), 1);
  assert.equal(rows[0].status, "error");
  assert.deepEqual(releases, [{
    userId: "user_1",
    idempotencyKey: "research.run:key_1",
    reason: "research_interrupted"
  }]);
  assert.equal(await markStaleActiveJobsInterrupted({ prismaClient, service, now }), 0);
  assert.equal(releases.length, 1);
});

test("stale sweep does not release when a terminal transition wins the race", async () => {
  const rows = [{
    id: "race",
    userId: "user_1",
    payload: { usageIdempotencyKey: "research.run:key_race" },
    status: "running",
    updatedAt: new Date("2026-07-17T11:40:00.000Z"),
    leaseUntil: null
  }];
  const releases = [];
  const count = await markStaleActiveJobsInterrupted({
    prismaClient: createResearchPrisma(rows, { settleBeforeUpdate: true }),
    service: { async release(input) { releases.push(input); } },
    now: new Date("2026-07-17T12:00:00.000Z")
  });

  assert.equal(count, 0);
  assert.equal(rows[0].status, "done");
  assert.deepEqual(releases, []);
});

test("reservation reaper only releases expired RESERVED rows and is race-safe", async () => {
  const now = new Date("2026-07-17T12:00:00.000Z");
  const rows = [
    { userId: "user_1", idempotencyKey: "expired", status: "RESERVED", expiresAt: new Date("2026-07-17T11:59:59.000Z") },
    { userId: "user_1", idempotencyKey: "future", status: "RESERVED", expiresAt: new Date("2026-07-17T12:01:00.000Z") },
    { userId: "user_1", idempotencyKey: "committed", status: "COMMITTED", expiresAt: new Date("2026-07-17T11:59:59.000Z") },
    { userId: "user_1", idempotencyKey: "released", status: "RELEASED", expiresAt: new Date("2026-07-17T11:59:59.000Z") }
  ];
  const calls = [];
  const prismaClient = {
    usageReservation: {
      async findMany({ where }) {
        return rows.filter(row => matchesStale(row, where)).map(row => ({
          userId: row.userId,
          idempotencyKey: row.idempotencyKey
        }));
      }
    }
  };
  const service = {
    async release(input) {
      calls.push(input);
      const row = rows.find(candidate => candidate.idempotencyKey === input.idempotencyKey);
      if (row.status !== "RESERVED") {
        const error = new Error("reservation already settled");
        error.code = "USAGE_RESERVATION_STATE_CONFLICT";
        throw error;
      }
      row.status = "RELEASED";
      return { reused: false };
    }
  };

  assert.deepEqual(await releaseExpiredUsageReservations({ now, prismaClient, service }), { released: 1, skipped: 0 });
  assert.deepEqual(await releaseExpiredUsageReservations({ now, prismaClient, service }), { released: 0, skipped: 0 });
  assert.deepEqual(calls, [{ userId: "user_1", idempotencyKey: "expired", reason: "reservation_expired" }]);
  assert.equal(rows[1].status, "RESERVED");
  assert.equal(rows[2].status, "COMMITTED");
  assert.equal(rows[3].status, "RELEASED");
});

test("reservation reaper treats a concurrent terminal settle as a skipped release", async () => {
  const now = new Date("2026-07-17T12:00:00.000Z");
  const prismaClient = {
    usageReservation: {
      async findMany() {
        return [{ userId: "user_1", idempotencyKey: "race" }];
      }
    }
  };
  const service = {
    async release() {
      const error = new Error("reservation already committed");
      error.code = "USAGE_RESERVATION_STATE_CONFLICT";
      throw error;
    }
  };

  assert.deepEqual(await releaseExpiredUsageReservations({ now, prismaClient, service }), { released: 0, skipped: 1 });
});
