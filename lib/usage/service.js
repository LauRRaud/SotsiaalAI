import { prisma } from "@/lib/prisma";
import { getRolePlanKey } from "@/lib/subscriptionPlans";
import { getUsagePeriodRange } from "@/lib/usage/periods";

const DEFAULT_TIME_ZONE = "Europe/Tallinn";
const MAX_TRANSACTION_ATTEMPTS = 3;

export class UsageServiceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "UsageServiceError";
    this.code = code;
    this.details = details;
  }
}

function positiveBigInt(value, field) {
  let parsed;
  try {
    parsed = typeof value === "bigint" ? value : BigInt(value);
  } catch {
    throw new UsageServiceError("USAGE_INVALID_AMOUNT", `${field} must be a positive integer`);
  }
  if (parsed <= 0n) {
    throw new UsageServiceError("USAGE_INVALID_AMOUNT", `${field} must be a positive integer`);
  }
  return parsed;
}

function nonNegativeBigInt(value, field) {
  let parsed;
  try {
    parsed = typeof value === "bigint" ? value : BigInt(value);
  } catch {
    throw new UsageServiceError("USAGE_INVALID_AMOUNT", `${field} must be a non-negative integer`);
  }
  if (parsed < 0n) {
    throw new UsageServiceError("USAGE_INVALID_AMOUNT", `${field} must be a non-negative integer`);
  }
  return parsed;
}

function requireText(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new UsageServiceError("USAGE_INVALID_INPUT", `${field} is required`);
  return normalized;
}

function requireIdempotencyKey(value) {
  const key = requireText(value, "idempotencyKey");
  if (key.length > 200) {
    throw new UsageServiceError(
      "USAGE_INVALID_INPUT",
      "idempotencyKey cannot exceed 200 characters"
    );
  }
  return key;
}

function eventKey(userId, idempotencyKey, action) {
  return `usage:${userId}:${idempotencyKey}:${action}`;
}

function serializeBucket(bucket) {
  if (!bucket) return null;
  const used = BigInt(bucket.used || 0);
  const reserved = BigInt(bucket.reserved || 0);
  const hardLimit = BigInt(bucket.hardLimit || 0);
  const softLimit = bucket.softLimit == null ? null : BigInt(bucket.softLimit);
  return {
    ...bucket,
    used,
    reserved,
    hardLimit,
    softLimit,
    remaining: hardLimit - used - reserved,
    softLimitReached: softLimit != null && used + reserved >= softLimit,
    hardLimitReached: used + reserved >= hardLimit
  };
}

function sameReservation(existing, metric, amount) {
  return existing.metric === metric && BigInt(existing.reservedAmount) === amount;
}

// A RELEASED reservation means the intent was refunded: the caller failed before the work
// became durable and gave the capacity back. If the same client intent key returns, it must be
// chargeable again — otherwise a stable idempotency key would turn one technical error into a
// permanently dead intent (reserve returns the RELEASED row, commit then rejects it forever).
// Reviving is only correct inside the bucket period the reservation belongs to; a key that comes
// back in a later period would charge the wrong window, so that is a conflict, not a revival.
function bucketPeriodContains(bucket, now) {
  if (!bucket?.periodStart || !bucket?.periodEnd) return false;
  const start = new Date(bucket.periodStart).getTime();
  const end = new Date(bucket.periodEnd).getTime();
  const at = now.getTime();
  return Number.isFinite(start) && Number.isFinite(end) && at >= start && at < end;
}

function shapeReservation(existing, reused = false) {
  return {
    reservation: existing,
    bucket: serializeBucket(existing.bucket),
    reused
  };
}

function normalizeEntitlement(entitlement) {
  if (!entitlement || entitlement.enabled === false) {
    throw new UsageServiceError("USAGE_NOT_ENTITLED", "Usage metric is not enabled");
  }
  if (!entitlement.period || entitlement.hardLimit == null) {
    throw new UsageServiceError("USAGE_NOT_LIMITED", "Usage metric has no enforceable period and hard limit");
  }
  const hardLimit = positiveBigInt(entitlement.hardLimit, "hardLimit");
  const softLimit = entitlement.softLimit == null
    ? null
    : nonNegativeBigInt(entitlement.softLimit, "softLimit");
  if (softLimit != null && softLimit > hardLimit) {
    throw new UsageServiceError("USAGE_INVALID_LIMITS", "softLimit cannot exceed hardLimit");
  }
  return { ...entitlement, hardLimit, softLimit };
}

async function resolveEntitlement(tx, { userId, metric, now }) {
  const [user, override, subscription] = await Promise.all([
    tx.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isAdmin: true }
    }),
    tx.userEntitlementOverride.findFirst({
      where: {
        userId,
        metric,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gt: now } }]
      },
      orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }]
    }),
    tx.subscription.findFirst({
      where: {
        userId,
        status: "ACTIVE",
        OR: [{ validUntil: null }, { validUntil: { gt: now } }]
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: { plan: true, planDefinitionId: true }
    })
  ]);

  if (!user) throw new UsageServiceError("USAGE_USER_NOT_FOUND", "User was not found");

  let planDefinition = null;
  if (subscription?.planDefinitionId) {
    planDefinition = await tx.planDefinition.findUnique({
      where: { id: subscription.planDefinitionId }
    });
  } else if (subscription || user.isAdmin || user.role === "ADMIN") {
    const knownPlan = String(subscription?.plan || "").trim().toLowerCase();
    const fallbackKey = getRolePlanKey(user.role);
    const planKey = user.isAdmin || user.role === "ADMIN"
      ? "admin_internal"
      : ["client_monthly", "social_worker_monthly", "service_provider_monthly"].includes(knownPlan)
        ? knownPlan
        : fallbackKey;
    planDefinition = await tx.planDefinition.findFirst({
      where: {
        key: planKey,
        active: true,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }]
      },
      orderBy: { version: "desc" }
    });
  }

  const base = planDefinition
    ? await tx.planEntitlement.findUnique({
        where: {
          planDefinitionId_metric: {
            planDefinitionId: planDefinition.id,
            metric
          }
        }
      })
    : null;

  if (!base && !override) {
    throw new UsageServiceError("USAGE_NOT_ENTITLED", "No active entitlement was found", {
      userId,
      metric
    });
  }

  return normalizeEntitlement({
    enabled: override?.enabled ?? base?.enabled,
    softLimit: override?.softLimit ?? base?.softLimit,
    hardLimit: override?.hardLimit ?? base?.hardLimit,
    period: override?.period ?? base?.period,
    planDefinitionId: planDefinition?.id || null,
    overrideId: override?.id || null
  });
}

async function findExisting(db, userId, idempotencyKey) {
  return db.usageReservation.findUnique({
    where: { userId_idempotencyKey: { userId, idempotencyKey } },
    include: { bucket: true }
  });
}

// Commit body, separated from its transaction so a caller can hand in its own client and make
// the charge atomic with the durable write it belongs to — either both land or neither does.
async function commitWithin(tx, { userId, idempotencyKey, now, actualAmount: requestedAmount, metadata }) {
  const existing = await findExisting(tx, userId, idempotencyKey);
  if (!existing) throw new UsageServiceError("USAGE_RESERVATION_NOT_FOUND", "Reservation was not found");
  if (existing.status === "COMMITTED") return shapeReservation(existing, true);
  if (existing.status !== "RESERVED") {
    throw new UsageServiceError("USAGE_RESERVATION_STATE_CONFLICT", "Reservation is not committable");
  }

  const actualAmount = requestedAmount == null
    ? BigInt(existing.reservedAmount)
    : nonNegativeBigInt(requestedAmount, "actualAmount");
  const rows = await tx.$queryRawUnsafe(
    `UPDATE "UsageBucket"
     SET "reserved" = "reserved" - $1::bigint,
         "used" = "used" + $2::bigint,
         "updatedAt" = CURRENT_TIMESTAMP
     WHERE "id" = $3
       AND "reserved" >= $1::bigint
       AND "used" + "reserved" - $1::bigint + $2::bigint <= "hardLimit"
     RETURNING *`,
    BigInt(existing.reservedAmount).toString(),
    actualAmount.toString(),
    existing.bucketId
  );
  if (!rows[0]) {
    const latest = await findExisting(tx, userId, idempotencyKey);
    if (latest?.status === "COMMITTED") return shapeReservation(latest, true);
    throw new UsageServiceError("USAGE_INVARIANT_VIOLATION", "Commit would violate bucket invariants");
  }

  const reservation = await tx.usageReservation.update({
    where: { id: existing.id },
    data: {
      status: "COMMITTED",
      committedAmount: actualAmount,
      committedAt: now
    }
  });
  await tx.usageEvent.create({
    data: {
      userId,
      bucketId: existing.bucketId,
      reservationId: existing.id,
      metric: existing.metric,
      type: "COMMITTED",
      amount: actualAmount,
      idempotencyKey: eventKey(userId, idempotencyKey, "committed"),
      metadata: metadata || undefined
    }
  });
  return { reservation, bucket: serializeBucket(rows[0]), reused: false };
}

async function withRetry(work, onConflict) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      lastError = error;
      if (error?.code !== "P2002" && error?.code !== "P2034") throw error;
      const resolved = await onConflict?.(error);
      if (resolved) return resolved;
    }
  }
  throw lastError;
}

export function createUsageService({ prismaClient = prisma, timeZone = DEFAULT_TIME_ZONE } = {}) {
  return {
    async resolveEntitlement(input) {
      return prismaClient.$transaction(tx => resolveEntitlement(tx, {
        ...input,
        now: input?.now instanceof Date ? input.now : new Date(input?.now || Date.now())
      }));
    },

    async reserve(input = {}) {
      const userId = requireText(input.userId, "userId");
      const metric = requireText(input.metric, "metric");
      const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);
      const amount = positiveBigInt(input.amount ?? 1, "amount");
      const now = input.now instanceof Date ? input.now : new Date(input.now || Date.now());

      return withRetry(
        () => prismaClient.$transaction(async tx => {
          const existing = await findExisting(tx, userId, idempotencyKey);
          if (existing) {
            if (!sameReservation(existing, metric, amount)) {
              throw new UsageServiceError(
                "USAGE_IDEMPOTENCY_CONFLICT",
                "Idempotency key was already used with different reservation data"
              );
            }
            if (existing.status === "RESERVED") {
              return shapeReservation(existing, true);
            }
            if (existing.status !== "RELEASED") {
              // reserve() authorizes the caller to start billable work. A terminal reservation
              // may still make commit()/release() retries idempotent, but it must never authorize
              // another operation: client-controlled keys would otherwise replay paid work for
              // free after the first reservation had already been committed.
              throw new UsageServiceError(
                "USAGE_IDEMPOTENCY_CONFLICT",
                "Idempotency key belongs to a completed usage operation"
              );
            }
            if (!bucketPeriodContains(existing.bucket, now)) {
              throw new UsageServiceError(
                "USAGE_IDEMPOTENCY_CONFLICT",
                "Idempotency key belongs to a closed usage period"
              );
            }

            const revivedRows = await tx.$queryRawUnsafe(
              `UPDATE "UsageBucket"
               SET "reserved" = "reserved" + $1::bigint, "updatedAt" = CURRENT_TIMESTAMP
               WHERE "id" = $2
                 AND "used" + "reserved" + $1::bigint <= "hardLimit"
               RETURNING *`,
              amount.toString(),
              existing.bucketId
            );
            const revivedBucket = revivedRows[0];
            if (!revivedBucket) {
              const current = await tx.usageBucket.findUnique({ where: { id: existing.bucketId } });
              throw new UsageServiceError("USAGE_LIMIT_EXCEEDED", "Usage hard limit has been reached", {
                bucket: serializeBucket(current)
              });
            }

            const priorReservedEvents = await tx.usageEvent.count({
              where: { reservationId: existing.id, type: "RESERVED" }
            });
            const revived = await tx.usageReservation.update({
              where: { id: existing.id },
              data: {
                status: "RESERVED",
                releasedAt: null,
                releaseReason: null,
                expiresAt: input.expiresAt || null,
                metadata: input.metadata || undefined
              }
            });
            await tx.usageEvent.create({
              data: {
                userId,
                bucketId: existing.bucketId,
                reservationId: existing.id,
                metric,
                type: "RESERVED",
                amount,
                idempotencyKey: eventKey(
                  userId,
                  idempotencyKey,
                  priorReservedEvents > 0 ? `reserved:${priorReservedEvents + 1}` : "reserved"
                ),
                metadata: input.metadata || undefined
              }
            });

            return {
              reservation: revived,
              bucket: serializeBucket(revivedBucket),
              reused: false
            };
          }

          const entitlement = normalizeEntitlement(
            input.entitlement || await resolveEntitlement(tx, { userId, metric, now })
          );
          const range = getUsagePeriodRange(entitlement.period, now, timeZone);
          const bucket = await tx.usageBucket.upsert({
            where: {
              userId_metric_periodStart_periodEnd: {
                userId,
                metric,
                periodStart: range.start,
                periodEnd: range.end
              }
            },
            create: {
              userId,
              metric,
              period: entitlement.period,
              periodStart: range.start,
              periodEnd: range.end,
              softLimit: entitlement.softLimit,
              hardLimit: entitlement.hardLimit
            },
            update: {}
          });

          const rows = await tx.$queryRawUnsafe(
            `UPDATE "UsageBucket"
             SET "reserved" = "reserved" + $1::bigint, "updatedAt" = CURRENT_TIMESTAMP
             WHERE "id" = $2
               AND "used" + "reserved" + $1::bigint <= "hardLimit"
             RETURNING *`,
            amount.toString(),
            bucket.id
          );
          const updatedBucket = rows[0];
          if (!updatedBucket) {
            const current = await tx.usageBucket.findUnique({ where: { id: bucket.id } });
            throw new UsageServiceError("USAGE_LIMIT_EXCEEDED", "Usage hard limit has been reached", {
              bucket: serializeBucket(current)
            });
          }

          const reservation = await tx.usageReservation.create({
            data: {
              userId,
              bucketId: bucket.id,
              metric,
              idempotencyKey,
              reservedAmount: amount,
              expiresAt: input.expiresAt || null,
              metadata: input.metadata || undefined
            }
          });
          await tx.usageEvent.create({
            data: {
              userId,
              bucketId: bucket.id,
              reservationId: reservation.id,
              metric,
              type: "RESERVED",
              amount,
              idempotencyKey: eventKey(userId, idempotencyKey, "reserved"),
              metadata: input.metadata || undefined
            }
          });

          return {
            reservation,
            bucket: serializeBucket(updatedBucket),
            reused: false
          };
        }),
        async () => {
          const existing = await findExisting(prismaClient, userId, idempotencyKey);
          if (!existing) return null;
          if (!sameReservation(existing, metric, amount)) {
            throw new UsageServiceError("USAGE_IDEMPOTENCY_CONFLICT", "Idempotency key conflict");
          }
          return shapeReservation(existing, true);
        }
      );
    },

    async commit(input = {}) {
      const userId = requireText(input.userId, "userId");
      const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);
      const now = input.now instanceof Date ? input.now : new Date(input.now || Date.now());

      const run = tx => commitWithin(tx, {
        userId,
        idempotencyKey,
        now,
        actualAmount: input.actualAmount,
        metadata: input.metadata
      });

      // `input.tx` lets the caller bind the charge to its own durable write in one transaction.
      return input.tx ? run(input.tx) : prismaClient.$transaction(run);
    },

    async release(input = {}) {
      const userId = requireText(input.userId, "userId");
      const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);
      const reason = String(input.reason || "technical_error").trim();
      const now = input.now instanceof Date ? input.now : new Date(input.now || Date.now());

      const run = async tx => {
        const existing = await findExisting(tx, userId, idempotencyKey);
        if (!existing) throw new UsageServiceError("USAGE_RESERVATION_NOT_FOUND", "Reservation was not found");
        if (existing.status === "RELEASED") return shapeReservation(existing, true);
        // Failure cleanup may follow an already paid RAG search. Its cost remains
        // committed; skipping it must not roll back the owning chat's terminal write.
        if (input.skipCommitted === true && existing.status === "COMMITTED") return shapeReservation(existing, true);
        if (existing.status !== "RESERVED") {
          throw new UsageServiceError("USAGE_RESERVATION_STATE_CONFLICT", "Reservation is not releasable");
        }

        const rows = await tx.$queryRawUnsafe(
          `UPDATE "UsageBucket"
           SET "reserved" = "reserved" - $1::bigint, "updatedAt" = CURRENT_TIMESTAMP
           WHERE "id" = $2 AND "reserved" >= $1::bigint
           RETURNING *`,
          BigInt(existing.reservedAmount).toString(),
          existing.bucketId
        );
        if (!rows[0]) {
          const latest = await findExisting(tx, userId, idempotencyKey);
          if (latest?.status === "RELEASED") return shapeReservation(latest, true);
          throw new UsageServiceError("USAGE_INVARIANT_VIOLATION", "Release would violate bucket invariants");
        }

        const reservation = await tx.usageReservation.update({
          where: { id: existing.id },
          data: {
            status: "RELEASED",
            releasedAt: now,
            releaseReason: reason
          }
        });
        await tx.usageEvent.create({
          data: {
            userId,
            bucketId: existing.bucketId,
            reservationId: existing.id,
            metric: existing.metric,
            type: "RELEASED",
            amount: BigInt(existing.reservedAmount),
            idempotencyKey: eventKey(userId, idempotencyKey, "released"),
            metadata: { reason }
          }
        });
        return { reservation, bucket: serializeBucket(rows[0]), reused: false };
      };

      // Symmetric with `commit`: SOL-CHAT-02 needs the refund of a failed or stopped turn to land
      // in the same transaction as that turn's terminal marker. Without it the two can diverge —
      // marker written, refund lost (or the reverse) — and the only repair was the reaper's TTL.
      return input.tx ? run(input.tx) : prismaClient.$transaction(run);
    }
  };
}

export const usageService = createUsageService();
