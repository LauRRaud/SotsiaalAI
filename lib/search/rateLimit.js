import { createHash } from "node:crypto";

import { getTrustedRequestIpFromRequest } from "@/lib/request-ip";

function positiveInt(value, fallback, min = 1) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.floor(parsed)) : fallback;
}

function bucketKey(action, userId, trustedIp) {
  return createHash("sha256")
    .update(`personal-search\u0000${action}\u0000${userId}\u0000${trustedIp || "no-trusted-ip"}`)
    .digest("hex");
}

export function personalSearchRateLimitPolicy({ limit, windowMs } = {}) {
  return {
    limit: positiveInt(limit, 30),
    windowMs: positiveInt(windowMs, 60_000, 1000)
  };
}

export async function consumePersonalSearchRateLimit({
  prisma,
  request,
  userId,
  action = "query",
  limit,
  windowMs,
  now = new Date()
} = {}) {
  const ownerId = String(userId || "").trim();
  if (!ownerId) throw new Error("PERSONAL_SEARCH_RATE_LIMIT_USER_REQUIRED");
  if (typeof prisma?.$queryRawUnsafe !== "function") {
    throw new Error("PERSONAL_SEARCH_RATE_LIMIT_STORAGE_UNAVAILABLE");
  }
  const policy = personalSearchRateLimitPolicy({ limit, windowMs });
  const current = now instanceof Date ? now : new Date(now);
  const resetAt = new Date(current.getTime() + policy.windowMs);
  const trustedIp = getTrustedRequestIpFromRequest(request);
  const [bucket] = await prisma.$queryRawUnsafe(
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
    bucketKey(action, ownerId, trustedIp),
    resetAt,
    current
  );
  const count = Number(bucket?.count || 0);
  const storedResetAt = bucket?.resetAt instanceof Date
    ? bucket.resetAt
    : new Date(bucket?.resetAt || resetAt);
  return {
    allowed: count <= policy.limit,
    remaining: Math.max(0, policy.limit - count),
    retryAfterSeconds: Math.max(1, Math.ceil((storedResetAt.getTime() - current.getTime()) / 1000))
  };
}
