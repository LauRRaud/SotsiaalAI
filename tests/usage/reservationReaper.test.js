import assert from "node:assert/strict";
import test from "node:test";

import { createUsageService } from "../../lib/usage/service.js";
import { reapExpiredReservations, getExpiredReservationWhere } from "../../lib/usage/reservationReaper.js";

// Fake Prisma: the reserve/commit/release harness from service.test.js, extended with
// usageReservation.findMany + count so the reaper (which scans for expired rows) runs
// against the SAME store the real service mutates.
function createFakePrisma() {
  const state = { buckets: [], reservations: [], events: [] };
  let sequence = 0;
  let transactionTail = Promise.resolve();
  const nextId = (p) => `${p}_${(sequence += 1)}`;
  const bucketKey = (d) =>
    [d.userId, d.metric, new Date(d.periodStart).toISOString(), new Date(d.periodEnd).toISOString()].join(":");
  const withBucket = (row) =>
    row ? { ...row, bucket: { ...state.buckets.find((b) => b.id === row.bucketId) } } : null;

  function matchesReaperWhere(row, where = {}) {
    if (where.status && row.status !== where.status) return false;
    if (where.expiresAt) {
      if (where.expiresAt.not === null && row.expiresAt == null) return false;
      if (where.expiresAt.lt && !(row.expiresAt && new Date(row.expiresAt) < new Date(where.expiresAt.lt))) return false;
    }
    return true;
  }

  const db = {
    state,
    usageBucket: {
      async upsert({ where, create }) {
        const key = bucketKey(where.userId_metric_periodStart_periodEnd);
        let row = state.buckets.find((b) => b.key === key);
        if (!row) {
          row = { id: nextId("bucket"), key, ...create, used: 0n, reserved: 0n, createdAt: new Date(), updatedAt: new Date() };
          state.buckets.push(row);
        }
        return { ...row };
      },
      async findUnique({ where }) {
        const row = state.buckets.find((b) => b.id === where.id);
        return row ? { ...row } : null;
      }
    },
    usageReservation: {
      async findUnique({ where }) {
        const s = where.userId_idempotencyKey;
        return withBucket(state.reservations.find((r) => r.userId === s.userId && r.idempotencyKey === s.idempotencyKey));
      },
      async create({ data }) {
        if (state.reservations.some((r) => r.userId === data.userId && r.idempotencyKey === data.idempotencyKey)) {
          throw Object.assign(new Error("unique"), { code: "P2002" });
        }
        const row = { id: nextId("reservation"), status: "RESERVED", committedAmount: null, ...data, createdAt: new Date(), updatedAt: new Date() };
        state.reservations.push(row);
        return { ...row };
      },
      async update({ where, data }) {
        const row = state.reservations.find((r) => r.id === where.id);
        Object.assign(row, data, { updatedAt: new Date() });
        return { ...row };
      },
      async findMany({ where = {}, orderBy, take } = {}) {
        let rows = state.reservations.filter((r) => matchesReaperWhere(r, where));
        if (orderBy?.expiresAt === "asc") {
          rows = rows.slice().sort((a, b) => new Date(a.expiresAt || 0) - new Date(b.expiresAt || 0));
        }
        if (take) rows = rows.slice(0, take);
        return rows.map((r) => ({ ...r }));
      },
      async count({ where = {} } = {}) {
        return state.reservations.filter((r) => matchesReaperWhere(r, where)).length;
      }
    },
    usageEvent: {
      async create({ data }) {
        if (state.events.some((e) => e.idempotencyKey === data.idempotencyKey)) {
          throw Object.assign(new Error("unique"), { code: "P2002" });
        }
        const row = { id: nextId("event"), ...data, createdAt: new Date() };
        state.events.push(row);
        return { ...row };
      }
    },
    async $queryRawUnsafe(sql, ...args) {
      if (sql.includes('SET "reserved" = "reserved" +')) {
        const [amountText, bucketId] = args;
        const amount = BigInt(amountText);
        const bucket = state.buckets.find((b) => b.id === bucketId);
        if (bucket.used + bucket.reserved + amount > bucket.hardLimit) return [];
        bucket.reserved += amount;
        return [{ ...bucket }];
      }
      if (sql.includes('"used" = "used" +')) {
        const [reservedText, actualText, bucketId] = args;
        const reservedAmount = BigInt(reservedText);
        const actualAmount = BigInt(actualText);
        const bucket = state.buckets.find((b) => b.id === bucketId);
        if (bucket.reserved < reservedAmount) return [];
        bucket.reserved -= reservedAmount;
        bucket.used += actualAmount;
        return [{ ...bucket }];
      }
      const [amountText, bucketId] = args; // release: reserved -= amount
      const amount = BigInt(amountText);
      const bucket = state.buckets.find((b) => b.id === bucketId);
      if (bucket.reserved < amount) return [];
      bucket.reserved -= amount;
      return [{ ...bucket }];
    },
    $transaction(callback) {
      const run = transactionTail.then(() => callback(db));
      transactionTail = run.catch(() => {});
      return run;
    }
  };
  return db;
}

const entitlement = Object.freeze({ enabled: true, period: "WEEKLY", softLimit: 50n, hardLimit: 100n });
const NOW = new Date("2026-07-19T12:00:00.000Z");
const past = (min) => new Date(NOW.getTime() - min * 60 * 1000);
const future = (min) => new Date(NOW.getTime() + min * 60 * 1000);

async function reserve(service, key, { expiresAt, now = past(60) } = {}) {
  return service.reserve({ userId: "u1", metric: "CHAT_MESSAGE", idempotencyKey: key, amount: 1, entitlement, expiresAt, now });
}
const bucketReserved = (db) => db.state.buckets[0].reserved;
const resById = (db, keyPart) => db.state.reservations.find((r) => r.idempotencyKey === keyPart);

test("reaper never releases an expired reservation that can still belong to a live request", async () => {
  const db = createFakePrisma();
  const service = createUsageService({ prismaClient: db });

  await reserve(service, "kA", { expiresAt: past(10) }); // expired
  await reserve(service, "kB", { expiresAt: future(10) }); // not expired
  await reserve(service, "kC", { expiresAt: past(10) }); // expired then committed
  await service.commit({ userId: "u1", idempotencyKey: "kC", now: NOW });
  await reserve(service, "kD", { expiresAt: null }); // no expiry -> never reaped

  // reserved now = A + B + D = 3 (C moved to used on commit)
  assert.equal(bucketReserved(db), 3n);

  const results = await reapExpiredReservations({ db, service, now: NOW, graceMs: 5 * 60 * 1000 });

  assert.equal(results.scanned, 1, "only the expired RESERVED row A is scanned");
  assert.equal(results.released, 0);
  assert.equal(results.deferred, 1);
  assert.equal(bucketReserved(db), 3n, "the expired hold remains owned by its request");
  assert.equal(resById(db, "kA").status, "RESERVED");
  assert.equal(resById(db, "kB").status, "RESERVED");
  assert.equal(resById(db, "kD").status, "RESERVED");
  assert.equal(resById(db, "kC").status, "COMMITTED");

  await service.commit({ userId: "u1", idempotencyKey: "kA", now: NOW });
  assert.equal(resById(db, "kA").status, "COMMITTED");
  assert.equal(bucketReserved(db), 2n, "the live request can still settle normally");
  assert.equal(db.state.buckets[0].used, 2n, "the completed work is charged");
});

test("reaper detection is idempotent and does not mutate the reservation", async () => {
  const db = createFakePrisma();
  const service = createUsageService({ prismaClient: db });
  await reserve(service, "kA", { expiresAt: past(10) });
  await reapExpiredReservations({ db, service, now: NOW });
  const second = await reapExpiredReservations({ db, service, now: NOW });
  assert.equal(second.scanned, 1);
  assert.equal(second.released, 0);
  assert.equal(second.deferred, 1);
});

test("reaper never reaps rows without an expiresAt or still within grace", async () => {
  const db = createFakePrisma();
  const service = createUsageService({ prismaClient: db });
  await reserve(service, "noExpiry", { expiresAt: null });
  await reserve(service, "recent", { expiresAt: past(2) }); // within 5-min grace
  const results = await reapExpiredReservations({ db, service, now: NOW, graceMs: 5 * 60 * 1000 });
  assert.equal(results.scanned, 0);
  assert.equal(bucketReserved(db), 2n);
});

test("getExpiredReservationWhere is fail-safe: status + finite past expiry only", () => {
  const where = getExpiredReservationWhere(NOW, 5 * 60 * 1000);
  assert.equal(where.status, "RESERVED");
  assert.equal(where.expiresAt.not, null);
  assert.ok(where.expiresAt.lt instanceof Date);
  assert.ok(where.expiresAt.lt < NOW);
});
