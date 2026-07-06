import { NextResponse } from "next/server";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIpFromRequest } from "@/lib/request-ip";
import { CHAT_NO_STORE_HEADERS } from "@/lib/chat/routeServerUtils";

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_LIMIT = 60;

function toPositiveInt(value, fallback, min = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.floor(parsed));
}

export function readChatRateLimit(value, fallback, min = 1) {
  return toPositiveInt(value, fallback, min);
}

export function enforceChatRateLimit(req, {
  scope = "default",
  userId,
  limit = DEFAULT_LIMIT,
  windowMs = DEFAULT_WINDOW_MS,
  messageKey = "api.common.rate_limited"
} = {}) {
  const normalizedLimit = toPositiveInt(limit, DEFAULT_LIMIT, 1);
  const normalizedWindowMs = toPositiveInt(windowMs, DEFAULT_WINDOW_MS, 1000);
  const ip = getRequestIpFromRequest(req);
  const principal = String(userId || "anonymous").trim() || "anonymous";
  const bucket = consumeRateLimit(`chat:${scope}:${principal}:${ip}`, normalizedLimit, normalizedWindowMs);

  if (bucket.allowed) return null;
  return NextResponse.json({
    ok: false,
    messageKey,
    message: messageKey
  }, {
    status: 429,
    headers: {
      ...CHAT_NO_STORE_HEADERS,
      "Retry-After": String(bucket.retryAfterSec)
    }
  });
}
