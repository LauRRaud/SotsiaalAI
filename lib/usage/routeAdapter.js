import crypto from "node:crypto";

import { usageService } from "@/lib/usage/service";

const MAX_CLIENT_KEY_LENGTH = 150;
const MAX_SCOPE_LENGTH = 40;
const CHAT_RESERVATION_TTL_MS = readPositiveNumber(
  process.env.USAGE_RESERVATION_CHAT_TTL_MS,
  15 * 60 * 1000
);
const LONG_RUNNING_RESERVATION_TTL_MS = readPositiveNumber(
  process.env.USAGE_RESERVATION_LONG_RUNNING_TTL_MS,
  24 * 60 * 60 * 1000
);

function readPositiveNumber(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return numeric;
}

function normalizedText(value) {
  return String(value || "").trim();
}

export function getUsageReservationExpiresAt(scope, now = Date.now()) {
  const normalizedScope = normalizedText(scope).toLowerCase();
  const isLongRunning = normalizedScope.includes("document") || normalizedScope.includes("research");
  const baseTime = now instanceof Date ? now.getTime() : Number(now);
  const safeBaseTime = Number.isFinite(baseTime) ? baseTime : Date.now();
  const ttlMs = isLongRunning ? LONG_RUNNING_RESERVATION_TTL_MS : CHAT_RESERVATION_TTL_MS;
  return new Date(safeBaseTime + ttlMs);
}

function jsonInteger(value) {
  if (value == null) return null;
  const parsed = typeof value === "bigint" ? value : BigInt(value);
  return parsed <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(parsed) : parsed.toString();
}

export function buildUsageIdempotencyKey(request, scope, providedKey = null) {
  const normalizedScope = normalizedText(scope).slice(0, MAX_SCOPE_LENGTH);
  if (!normalizedScope) throw new TypeError("usage scope is required");

  const headerKey = request?.headers?.get?.("idempotency-key") ||
    request?.headers?.get?.("x-idempotency-key");
  const clientKey = normalizedText(providedKey || headerKey);
  if (clientKey.length > MAX_CLIENT_KEY_LENGTH) {
    const error = new TypeError("idempotency key is too long");
    error.code = "USAGE_INVALID_INPUT";
    throw error;
  }

  return `${normalizedScope}:${clientKey || crypto.randomUUID()}`;
}

export async function reserveUsageForRequest({
  request,
  userId,
  metric,
  amount = 1,
  scope,
  idempotencyKey = null,
  metadata = null,
  service = usageService
}) {
  const key = buildUsageIdempotencyKey(request, scope, idempotencyKey);
  const result = await service.reserve({
    userId,
    metric,
    amount,
    idempotencyKey: key,
    expiresAt: getUsageReservationExpiresAt(scope),
    metadata: {
      scope,
      ...(metadata && typeof metadata === "object" ? metadata : {})
    }
  });

  return {
    userId,
    metric,
    amount: BigInt(amount),
    idempotencyKey: key,
    reservationId: result.reservation.id,
    status: result.reservation.status,
    reused: result.reused,
    bucket: result.bucket,
    service
  };
}

export function commitUsageForRequest(handle, options = {}) {
  if (!handle) return null;
  return handle.service.commit({
    userId: handle.userId,
    idempotencyKey: handle.idempotencyKey,
    actualAmount: options.actualAmount ?? handle.amount,
    metadata: options.metadata,
    // Pass a transaction client when the charge must land together with the caller's own
    // durable write; without it the service opens its own transaction as before.
    tx: options.tx
  });
}

export function releaseUsageForRequest(handle, options = {}) {
  if (!handle) return null;
  return handle.service.release({
    userId: handle.userId,
    idempotencyKey: handle.idempotencyKey,
    reason: options.reason || "technical_error",
    skipCommitted: options.skipCommitted === true,
    // Same reason as commit above: the refund may need to belong to the caller's own terminal
    // write, so that a turn cannot end up marked ABORTED/ERROR without its reservation released.
    tx: options.tx
  });
}

export function usageErrorDescriptor(error, scope = "usage") {
  const code = normalizedText(error?.code);
  const bucket = error?.details?.bucket || null;
  const periodEnd = bucket?.periodEnd ? new Date(bucket.periodEnd) : null;
  const retryAfter = periodEnd && !Number.isNaN(periodEnd.getTime())
    ? Math.max(1, Math.ceil((periodEnd.getTime() - Date.now()) / 1000))
    : null;

  if (code === "USAGE_LIMIT_EXCEEDED") {
    return {
      status: 429,
      headers: retryAfter ? { "Retry-After": String(retryAfter) } : {},
      body: {
        ok: false,
        messageKey: "api.common.rate_limited",
        scope,
        usage: {
          metric: bucket?.metric || null,
          used: jsonInteger(bucket?.used),
          reserved: jsonInteger(bucket?.reserved),
          limit: jsonInteger(bucket?.hardLimit),
          remaining: jsonInteger(bucket?.remaining),
          resetAt: periodEnd?.toISOString?.() || null
        }
      }
    };
  }

  if (code === "USAGE_NOT_ENTITLED") {
    return {
      status: 403,
      headers: {},
      body: {
        ok: false,
        messageKey: "api.common.forbidden",
        scope
      }
    };
  }

  if (code === "USAGE_INVALID_INPUT" || code === "USAGE_IDEMPOTENCY_CONFLICT") {
    return {
      status: code === "USAGE_IDEMPOTENCY_CONFLICT" ? 409 : 400,
      headers: {},
      body: {
        ok: false,
        messageKey: "api.common.invalid_request",
        scope
      }
    };
  }

  return {
    status: 503,
    headers: {},
    body: {
      ok: false,
      messageKey: "api.common.service_unavailable",
      scope
    }
  };
}
