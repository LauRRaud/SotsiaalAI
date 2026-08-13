import { createHash, randomUUID } from "node:crypto";

import prisma from "./prisma.js";

export const SERVICE_PROVIDER_PROFILE_RATE_LIMIT_POLICIES = Object.freeze({
  "profile:read": Object.freeze({ limit: 120, windowMs: 60_000 }),
  "profile:write": Object.freeze({ limit: 20, windowMs: 60_000 }),
  "availability:confirm": Object.freeze({ limit: 30, windowMs: 60_000 }),
  "address:request": Object.freeze({ limit: 60, windowMs: 60_000 }),
  "address:provider": Object.freeze({ limit: 20, windowMs: 60_000 })
});

const PUBLIC_ERROR_KEYS = new Set([
  "api.common.unauthorized",
  "api.common.forbidden",
  "api.common.rate_limited",
  "service_provider_profile.errors.address_query_too_long",
  "service_provider_profile.errors.availability_confirmation_invalid",
  "service_provider_profile.errors.availability_confirmation_failed",
  "service_provider_profile.errors.availability_conflict",
  "service_provider_profile.errors.availability_status_invalid",
  "service_provider_profile.errors.field_too_long",
  "service_provider_profile.errors.idempotency_conflict",
  "service_provider_profile.errors.idempotency_key_required",
  "service_provider_profile.errors.invalid_request",
  "service_provider_profile.errors.organization_name_required",
  "service_provider_profile.errors.profile_conflict",
  "service_provider_profile.errors.publish_contact_required",
  "service_provider_profile.errors.publish_service_required",
  "service_provider_profile.errors.service_not_found",
  "service_provider_profile.errors.too_many_list_items",
  "service_provider_profile.errors.too_many_locations",
  "service_provider_profile.errors.too_many_services"
]);

function bucketKey(operation, userId) {
  return createHash("sha256")
    .update(`service-provider-profile\u0000${operation}\u0000${userId}`)
    .digest("hex");
}

export async function consumeServiceProviderProfileRateLimit({
  operation,
  userId,
  now = new Date()
} = {}, db = prisma) {
  const policy = SERVICE_PROVIDER_PROFILE_RATE_LIMIT_POLICIES[operation];
  const normalizedUserId = String(userId || "").trim();
  if (!policy) throw new Error("SERVICE_PROVIDER_PROFILE_RATE_LIMIT_OPERATION_INVALID");
  if (!normalizedUserId) throw new Error("SERVICE_PROVIDER_PROFILE_RATE_LIMIT_USER_REQUIRED");
  if (typeof db?.$queryRawUnsafe !== "function") {
    throw new Error("SERVICE_PROVIDER_PROFILE_RATE_LIMIT_STORAGE_UNAVAILABLE");
  }

  const current = now instanceof Date ? now : new Date(now);
  const nextResetAt = new Date(current.getTime() + policy.windowMs);
  const [bucket] = await db.$queryRawUnsafe(
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
    bucketKey(operation, normalizedUserId),
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

export function serviceProviderCorrelationId(request) {
  const supplied = String(request?.headers?.get?.("x-request-id") || "").trim();
  return /^[a-zA-Z0-9._:-]{8,120}$/u.test(supplied) ? supplied : randomUUID();
}

export function serviceProviderProfileErrorDescriptor(error, fallbackKey, correlationId) {
  const rawStatus = Number(error?.status) || 500;
  const safeStatus = [400, 401, 403, 404, 409, 413, 429].includes(rawStatus) ? rawStatus : 500;
  const rawKey = String(error?.message || "").trim();
  const messageKey = safeStatus < 500 && PUBLIC_ERROR_KEYS.has(rawKey)
    ? rawKey
    : safeStatus < 500
      ? "service_provider_profile.errors.invalid_request"
      : fallbackKey;
  const extras = safeStatus >= 500
    ? { correlationId }
    : error?.details && typeof error.details === "object"
      ? { details: error.details }
      : {};
  return { status: safeStatus, messageKey, extras };
}

export function normalizeIdempotencyKey(value) {
  const normalized = String(value || "").trim();
  if (!/^[a-zA-Z0-9._:-]{8,160}$/u.test(normalized)) {
    const error = new Error("service_provider_profile.errors.idempotency_key_required");
    error.status = 400;
    throw error;
  }
  return normalized;
}
