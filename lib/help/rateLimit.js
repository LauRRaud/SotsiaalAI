import { createHash } from "node:crypto";

import prisma from "../prisma.js";

export const HELP_RATE_LIMIT_POLICIES = Object.freeze({
  "list:get": Object.freeze({ limit: 120, windowMs: 60_000 }),
  "detail:get": Object.freeze({ limit: 60, windowMs: 60_000 }),
  "detail:patch": Object.freeze({ limit: 30, windowMs: 60_000 }),
  "detail:delete": Object.freeze({ limit: 12, windowMs: 60_000 }),
  "address-request": Object.freeze({ limit: 60, windowMs: 60_000 }),
  "address-provider": Object.freeze({ limit: 20, windowMs: 60_000 })
});

function rateLimitKey(operation, userId, ipAddress) {
  return createHash("sha256")
    .update(`${operation}\u0000${userId}\u0000${ipAddress}`)
    .digest("hex");
}
export async function consumeHelpRateLimit({
  operation,
  userId,
  ipAddress,
  now = new Date()
} = {}, prismaClient = prisma) {
  const policy = HELP_RATE_LIMIT_POLICIES[operation];
  if (!policy) throw new Error("HELP_RATE_LIMIT_OPERATION_INVALID");
  const normalizedUserId = String(userId || "").trim();
  const normalizedIp = String(ipAddress || "unknown").trim() || "unknown";
  if (!normalizedUserId) throw new Error("HELP_RATE_LIMIT_USER_REQUIRED");
  if (typeof prismaClient?.$queryRawUnsafe !== "function") throw new Error("HELP_RATE_LIMIT_STORAGE_UNAVAILABLE");

  const current = now instanceof Date ? now : new Date(now);
  const nextResetAt = new Date(current.getTime() + policy.windowMs);
  const [bucket] = await prismaClient.$queryRawUnsafe(
    `INSERT INTO "HelpRateLimitBucket" ("key", "count", "resetAt", "updatedAt")
     VALUES ($1, 1, $2, $3)
     ON CONFLICT ("key") DO UPDATE SET
       "count" = CASE
         WHEN "HelpRateLimitBucket"."resetAt" <= $3 THEN 1
         ELSE "HelpRateLimitBucket"."count" + 1
       END,
       "resetAt" = CASE
         WHEN "HelpRateLimitBucket"."resetAt" <= $3 THEN $2
         ELSE "HelpRateLimitBucket"."resetAt"
       END,
       "updatedAt" = $3
     RETURNING "count", "resetAt"`,
    rateLimitKey(operation, normalizedUserId, normalizedIp),
    nextResetAt,
    current
  );
  const count = Number(bucket?.count || 0);
  const resetAt = bucket?.resetAt instanceof Date ? bucket.resetAt : new Date(bucket?.resetAt || nextResetAt);
  return {
    allowed: count <= policy.limit,
    limit: policy.limit,
    remaining: Math.max(0, policy.limit - count),
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - current.getTime()) / 1000))
  };
}
