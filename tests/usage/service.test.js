import assert from "node:assert/strict";
import test from "node:test";

import { resolveRoleBoundSubscriptionPlan } from "../../lib/subscriptionPlans.js";
import { createUsageService } from "../../lib/usage/service.js";

function createFakePrisma() {
  const state = {
    buckets: [],
    reservations: [],
    events: []
  };
  let sequence = 0;
  let transactionTail = Promise.resolve();

  function nextId(prefix) {
    sequence += 1;
    return `${prefix}_${sequence}`;
  }

  function bucketKey(data) {
    return [data.userId, data.metric, new Date(data.periodStart).toISOString(), new Date(data.periodEnd).toISOString()].join(":");
  }

  function reservationWithBucket(row) {
    if (!row) return null;
    return {
      ...row,
      bucket: { ...state.buckets.find(bucket => bucket.id === row.bucketId) }
    };
  }

  const db = {
    state,
    usageBucket: {
      async upsert({ where, create }) {
        const selector = where.userId_metric_periodStart_periodEnd;
        const key = bucketKey(selector);
        let row = state.buckets.find(candidate => candidate.key === key);
        if (!row) {
          row = {
            id: nextId("bucket"),
            key,
            ...create,
            used: 0n,
            reserved: 0n,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          state.buckets.push(row);
        }
        return { ...row };
      },
      async findUnique({ where }) {
        const row = state.buckets.find(candidate => candidate.id === where.id);
        return row ? { ...row } : null;
      }
    },
    usageReservation: {
      async findUnique({ where }) {
        const selector = where.userId_idempotencyKey;
        const row = state.reservations.find(candidate =>
          candidate.userId === selector.userId && candidate.idempotencyKey === selector.idempotencyKey
        );
        return reservationWithBucket(row);
      },
      async create({ data }) {
        if (state.reservations.some(row =>
          row.userId === data.userId && row.idempotencyKey === data.idempotencyKey
        )) {
          const error = new Error("unique constraint");
          error.code = "P2002";
          throw error;
        }
        const row = {
          id: nextId("reservation"),
          status: "RESERVED",
          committedAmount: null,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        state.reservations.push(row);
        return { ...row };
      },
      async update({ where, data }) {
        const row = state.reservations.find(candidate => candidate.id === where.id);
        Object.assign(row, data, { updatedAt: new Date() });
        return { ...row };
      }
    },
    usageEvent: {
      async count({ where } = {}) {
        return state.events.filter(row =>
          (where?.reservationId == null || row.reservationId === where.reservationId) &&
          (where?.type == null || row.type === where.type)
        ).length;
      },
      async create({ data }) {
        if (state.events.some(row => row.idempotencyKey === data.idempotencyKey)) {
          const error = new Error("unique constraint");
          error.code = "P2002";
          throw error;
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
        const bucket = state.buckets.find(row => row.id === bucketId);
        if (bucket.used + bucket.reserved + amount > bucket.hardLimit) return [];
        bucket.reserved += amount;
        bucket.updatedAt = new Date();
        return [{ ...bucket }];
      }

      if (sql.includes('"used" = "used" +')) {
        const [reservedText, actualText, bucketId] = args;
        const reservedAmount = BigInt(reservedText);
        const actualAmount = BigInt(actualText);
        const bucket = state.buckets.find(row => row.id === bucketId);
        if (bucket.reserved < reservedAmount) return [];
        if (bucket.used + bucket.reserved - reservedAmount + actualAmount > bucket.hardLimit) return [];
        bucket.reserved -= reservedAmount;
        bucket.used += actualAmount;
        bucket.updatedAt = new Date();
        return [{ ...bucket }];
      }

      const [amountText, bucketId] = args;
      const amount = BigInt(amountText);
      const bucket = state.buckets.find(row => row.id === bucketId);
      if (bucket.reserved < amount) return [];
      bucket.reserved -= amount;
      bucket.updatedAt = new Date();
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

const entitlement = Object.freeze({
  enabled: true,
  period: "WEEKLY",
  softLimit: 2n,
  hardLimit: 3n
});
const now = new Date("2026-07-08T12:00:00.000Z");

test("entitlement resolver maps a legacy plan by role and applies an active override", async () => {
  const calls = { planKey: null };
  const db = {
    user: {
      async findUnique() {
        return { id: "user_1", role: "CLIENT", isAdmin: false };
      }
    },
    userEntitlementOverride: {
      async findFirst() {
        return {
          id: "override_1",
          enabled: null,
          softLimit: null,
          hardLimit: 6n,
          period: null
        };
      }
    },
    subscription: {
      async findFirst() {
        return { plan: "kuutellimus", planDefinitionId: null };
      }
    },
    planDefinition: {
      async findFirst({ where }) {
        calls.planKey = where.key;
        return { id: "plan_client_v1" };
      }
    },
    planEntitlement: {
      async findUnique() {
        return {
          enabled: true,
          softLimit: 3n,
          hardLimit: 4n,
          period: "WEEKLY"
        };
      }
    },
    $transaction(callback) {
      return callback(db);
    }
  };
  const service = createUsageService({ prismaClient: db });

  const resolved = await service.resolveEntitlement({
    userId: "user_1",
    metric: "FILE_ANALYZE",
    now
  });

  assert.equal(calls.planKey, "client_monthly");
  assert.equal(resolved.softLimit, 3n);
  assert.equal(resolved.hardLimit, 6n);
  assert.equal(resolved.period, "WEEKLY");
  assert.equal(resolved.overrideId, "override_1");
});

test("usage enforcement resolves every role-bound subscription from the stored plan definition", async () => {
  for (const role of ["CLIENT", "SOCIAL_WORKER", "SERVICE_PROVIDER"]) {
    const binding = resolveRoleBoundSubscriptionPlan(role);
    const calls = { definitionId: null };
    const db = {
      user: {
        async findUnique() {
          return { id: `user_${role}`, role, isAdmin: false };
        }
      },
      userEntitlementOverride: {
        async findFirst() {
          return null;
        }
      },
      subscription: {
        async findFirst() {
          return {
            plan: binding.plan,
            planDefinitionId: binding.planDefinitionId
          };
        }
      },
      planDefinition: {
        async findUnique({ where }) {
          calls.definitionId = where.id;
          return { id: binding.planDefinitionId, key: binding.plan };
        },
        async findFirst() {
          assert.fail("canonical subscriptions must resolve by planDefinitionId");
        }
      },
      planEntitlement: {
        async findUnique() {
          return {
            enabled: true,
            softLimit: 5n,
            hardLimit: 10n,
            period: "MONTHLY"
          };
        }
      },
      $transaction(callback) {
        return callback(db);
      }
    };
    const service = createUsageService({ prismaClient: db });
    const resolved = await service.resolveEntitlement({
      userId: `user_${role}`,
      metric: "CHAT_ASSISTANT_REPLY",
      now
    });

    assert.equal(calls.definitionId, binding.planDefinitionId);
    assert.equal(resolved.planDefinitionId, binding.planDefinitionId);
  }
});

test("ten parallel reservations cannot exceed the hard limit", async () => {
  const prisma = createFakePrisma();
  const service = createUsageService({ prismaClient: prisma });

  const results = await Promise.allSettled(
    Array.from({ length: 10 }, (_, index) => service.reserve({
      userId: "user_1",
      metric: "DOCUMENT_GENERATE",
      idempotencyKey: `document_${index}`,
      entitlement,
      now
    }))
  );

  assert.equal(results.filter(result => result.status === "fulfilled").length, 3);
  assert.equal(results.filter(result => result.status === "rejected").length, 7);
  assert.ok(results.filter(result => result.status === "rejected").every(result =>
    result.reason.code === "USAGE_LIMIT_EXCEEDED"
  ));
  assert.equal(prisma.state.buckets[0].reserved, 3n);
  assert.equal(prisma.state.buckets[0].used, 0n);
});

test("retry with the same idempotency key reuses one reservation and event", async () => {
  const prisma = createFakePrisma();
  const service = createUsageService({ prismaClient: prisma });

  const first = await service.reserve({
    userId: "user_1",
    metric: "DOCUMENT_GENERATE",
    idempotencyKey: "same_request",
    entitlement,
    now
  });
  const second = await service.reserve({
    userId: "user_1",
    metric: "DOCUMENT_GENERATE",
    idempotencyKey: "same_request",
    entitlement,
    now
  });

  assert.equal(first.reused, false);
  assert.equal(second.reused, true);
  assert.equal(second.reservation.id, first.reservation.id);
  assert.equal(prisma.state.reservations.length, 1);
  assert.equal(prisma.state.events.length, 1);
  assert.equal(prisma.state.buckets[0].reserved, 1n);
});

test("an idempotency key cannot be reused for different reservation data", async () => {
  const prisma = createFakePrisma();
  const service = createUsageService({ prismaClient: prisma });

  await service.reserve({
    userId: "user_1",
    metric: "DOCUMENT_GENERATE",
    idempotencyKey: "conflicting_request",
    entitlement,
    now
  });

  await assert.rejects(
    () => service.reserve({
      userId: "user_1",
      metric: "DOCUMENT_GENERATE",
      idempotencyKey: "conflicting_request",
      amount: 2,
      entitlement,
      now
    }),
    error => error.code === "USAGE_IDEMPOTENCY_CONFLICT"
  );
});

test("oversized idempotency keys are rejected before touching the database", async () => {
  const prisma = createFakePrisma();
  const service = createUsageService({ prismaClient: prisma });

  await assert.rejects(
    () => service.reserve({
      userId: "user_1",
      metric: "DOCUMENT_GENERATE",
      idempotencyKey: "x".repeat(201),
      entitlement,
      now
    }),
    error => error.code === "USAGE_INVALID_INPUT"
  );
  assert.equal(prisma.state.buckets.length, 0);
});

test("technical failure releases reserved capacity and release is idempotent", async () => {
  const prisma = createFakePrisma();
  const service = createUsageService({ prismaClient: prisma });

  await service.reserve({
    userId: "user_1",
    metric: "DOCUMENT_GENERATE",
    idempotencyKey: "failed_request",
    entitlement,
    now
  });
  const firstRelease = await service.release({
    userId: "user_1",
    idempotencyKey: "failed_request",
    reason: "openai_error",
    now
  });
  const secondRelease = await service.release({
    userId: "user_1",
    idempotencyKey: "failed_request",
    reason: "openai_error",
    now
  });

  assert.equal(firstRelease.bucket.reserved, 0n);
  assert.equal(secondRelease.reused, true);
  assert.equal(prisma.state.buckets[0].reserved, 0n);
  assert.equal(prisma.state.buckets[0].used, 0n);
  assert.deepEqual(prisma.state.events.map(event => event.type), ["RESERVED", "RELEASED"]);
});

test("commit moves the reservation into used exactly once", async () => {
  const prisma = createFakePrisma();
  const service = createUsageService({ prismaClient: prisma });

  await service.reserve({
    userId: "user_1",
    metric: "DOCUMENT_GENERATE",
    idempotencyKey: "successful_request",
    entitlement,
    now
  });
  const firstCommit = await service.commit({
    userId: "user_1",
    idempotencyKey: "successful_request",
    now
  });
  const secondCommit = await service.commit({
    userId: "user_1",
    idempotencyKey: "successful_request",
    now
  });

  assert.equal(firstCommit.bucket.used, 1n);
  assert.equal(firstCommit.bucket.reserved, 0n);
  assert.equal(secondCommit.reused, true);
  assert.equal(prisma.state.buckets[0].used, 1n);
  assert.deepEqual(prisma.state.events.map(event => event.type), ["RESERVED", "COMMITTED"]);
});

test("a committed key cannot reserve capacity for a new operation", async () => {
  const prisma = createFakePrisma();
  const service = createUsageService({ prismaClient: prisma });

  await service.reserve({
    userId: "user_1",
    metric: "CHAT_ASSISTANT_REPLY",
    idempotencyKey: "chat.reply:completed_intent",
    entitlement,
    now
  });
  await service.commit({
    userId: "user_1",
    idempotencyKey: "chat.reply:completed_intent",
    now
  });

  await assert.rejects(
    () => service.reserve({
      userId: "user_1",
      metric: "CHAT_ASSISTANT_REPLY",
      idempotencyKey: "chat.reply:completed_intent",
      entitlement,
      now
    }),
    error => error.code === "USAGE_IDEMPOTENCY_CONFLICT"
  );
  assert.equal(prisma.state.buckets[0].used, 1n);
  assert.equal(prisma.state.buckets[0].reserved, 0n);
  assert.deepEqual(prisma.state.events.map(event => event.type), ["RESERVED", "COMMITTED"]);
});

// SOL-DOC-01. Stabiilne kliendivõti muudab vabastuse tähenduse: RELEASED ei tohi olla
// kavatsuse lõpp, vaid „see kord ei õnnestunud". Ilma alljärgnevata oleks üks ajutine
// tehniline viga muutnud kavatsuse igaveseks surnuks — reserve annaks tagasi vabastatud
// rea ja commit keelduks temast alati.
test("released key is reservable again inside the same period", async () => {
  const prisma = createFakePrisma();
  const service = createUsageService({ prismaClient: prisma });

  await service.reserve({
    userId: "user_1",
    metric: "DOCUMENT_GENERATE",
    idempotencyKey: "documents.generate:intent_1",
    entitlement,
    now
  });
  await service.release({
    userId: "user_1",
    idempotencyKey: "documents.generate:intent_1",
    reason: "paid_result_not_durable",
    now
  });
  assert.equal(prisma.state.buckets[0].reserved, 0n);

  const revived = await service.reserve({
    userId: "user_1",
    metric: "DOCUMENT_GENERATE",
    idempotencyKey: "documents.generate:intent_1",
    entitlement,
    now
  });

  assert.equal(revived.reservation.status, "RESERVED");
  assert.equal(revived.reused, false);
  assert.equal(revived.reservation.releasedAt, null);
  assert.equal(prisma.state.buckets[0].reserved, 1n);
  assert.equal(prisma.state.reservations.length, 1, "revival must not mint a second row");

  const committed = await service.commit({
    userId: "user_1",
    idempotencyKey: "documents.generate:intent_1",
    now
  });

  assert.equal(committed.bucket.used, 1n);
  assert.equal(committed.bucket.reserved, 0n);
  assert.deepEqual(prisma.state.events.map(event => event.type), [
    "RESERVED",
    "RELEASED",
    "RESERVED",
    "COMMITTED"
  ]);
  // Teine RESERVED sündmus vajab oma võtit, muidu kukub ta unikaalsuse otsa.
  const reservedKeys = prisma.state.events.filter(event => event.type === "RESERVED").map(event => event.idempotencyKey);
  assert.equal(new Set(reservedKeys).size, 2);
});

test("revival honours the hard limit like a fresh reservation", async () => {
  const prisma = createFakePrisma();
  const service = createUsageService({ prismaClient: prisma });

  await service.reserve({
    userId: "user_1",
    metric: "DOCUMENT_GENERATE",
    idempotencyKey: "documents.generate:intent_1",
    entitlement,
    now
  });
  await service.release({
    userId: "user_1",
    idempotencyKey: "documents.generate:intent_1",
    reason: "paid_result_not_durable",
    now
  });

  for (const index of [1, 2, 3]) {
    await service.reserve({
      userId: "user_1",
      metric: "DOCUMENT_GENERATE",
      idempotencyKey: `filler_${index}`,
      entitlement,
      now
    });
  }
  assert.equal(prisma.state.buckets[0].reserved, 3n);

  await assert.rejects(
    () => service.reserve({
      userId: "user_1",
      metric: "DOCUMENT_GENERATE",
      idempotencyKey: "documents.generate:intent_1",
      entitlement,
      now
    }),
    error => error.code === "USAGE_LIMIT_EXCEEDED"
  );
  assert.equal(prisma.state.buckets[0].reserved, 3n);
});

test("released key from a closed period is a conflict, not a revival", async () => {
  const prisma = createFakePrisma();
  const service = createUsageService({ prismaClient: prisma });

  await service.reserve({
    userId: "user_1",
    metric: "DOCUMENT_GENERATE",
    idempotencyKey: "documents.generate:intent_1",
    entitlement,
    now
  });
  await service.release({
    userId: "user_1",
    idempotencyKey: "documents.generate:intent_1",
    reason: "paid_result_not_durable",
    now
  });

  // Kolm nädalat hiljem: sama võti kuuluks juba teise arvestusaknasse.
  const laterPeriod = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);
  await assert.rejects(
    () => service.reserve({
      userId: "user_1",
      metric: "DOCUMENT_GENERATE",
      idempotencyKey: "documents.generate:intent_1",
      entitlement,
      now: laterPeriod
    }),
    error => error.code === "USAGE_IDEMPOTENCY_CONFLICT"
  );
  assert.equal(prisma.state.buckets[0].reserved, 0n);
});

test("commit can join the caller's transaction so the charge lands with its own write", async () => {
  const prisma = createFakePrisma();
  const service = createUsageService({ prismaClient: prisma });
  const auditRows = [];

  await service.reserve({
    userId: "user_1",
    metric: "DOCUMENT_REFINE",
    idempotencyKey: "documents.refine:intent_1",
    entitlement,
    now
  });

  await prisma.$transaction(async tx => {
    auditRows.push({ action: "ARTIFACT_REFINE" });
    await service.commit({
      userId: "user_1",
      idempotencyKey: "documents.refine:intent_1",
      now,
      tx
    });
  });

  assert.equal(auditRows.length, 1);
  assert.equal(prisma.state.buckets[0].used, 1n);
  assert.equal(prisma.state.buckets[0].reserved, 0n);
});
