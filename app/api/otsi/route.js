import { NextResponse } from "next/server";
import { requireChatUser, CHAT_NO_STORE_HEADERS } from "@/lib/chat/routeServerUtils";
import { prisma } from "@/lib/prisma";
import { normalizePersonalSearchQuery, searchPersonalObjects } from "@/lib/search/personalSearch";
import { consumePersonalSearchRateLimit } from "@/lib/search/rateLimit";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const WINDOW_MS = process.env.PERSONAL_SEARCH_RATE_LIMIT_WINDOW_MS;
const MAX_REQUESTS = process.env.PERSONAL_SEARCH_RATE_LIMIT_MAX;

function json(data, status = 200, extraHeaders = {}) {
  return NextResponse.json(data, {
    status,
    headers: { ...CHAT_NO_STORE_HEADERS, ...extraHeaders }
  });
}

export async function GET() {
  return json({ ok: false, messageKey: "api.common.method_not_allowed" }, 405, { Allow: "POST" });
}

export async function POST(request, deps = {}) {
  const requireUser = deps.requireUser || (() => requireChatUser({ includeSession: true }));
  const enforceRateLimit = deps.enforceRateLimit || consumePersonalSearchRateLimit;
  const search = deps.search || searchPersonalObjects;
  const db = deps.prisma || prisma;
  const auth = await requireUser();
  if (!auth?.ok) {
    return json(
      { ok: false, messageKey: auth?.message || "api.common.unauthorized" },
      auth?.status || 401
    );
  }

  try {
    const decision = await enforceRateLimit({
      prisma: db,
      request,
      userId: auth.userId,
      action: "query",
      limit: MAX_REQUESTS,
      windowMs: WINDOW_MS
    });
    if (!decision?.allowed) {
      return json(
        { ok: false, messageKey: "api.common.rate_limited" },
        429,
        { "Retry-After": String(decision?.retryAfterSeconds || 1) }
      );
    }
  } catch (error) {
    console.error("[personal-search] limiter failed", safeError(error));
    return json({ ok: false, messageKey: "api.search.unavailable" }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, messageKey: "api.common.invalid_payload" }, 400);
  }
  const query = normalizePersonalSearchQuery(body?.query);
  if (!query.ok) return json({ ok: false, messageKey: "api.search.query_too_long" }, 400);
  if (!query.query) {
    return json({
      ok: true,
      results: [],
      partial: false,
      unavailableKinds: [],
      pagination: { hasMore: false, nextCursor: { conversation: null, journey: null, document: null } }
    });
  }

  try {
    const result = await search({
      prisma: db,
      userId: auth.userId,
      query: query.query,
      cursor: body?.cursor
    });
    return json({ ok: true, ...result });
  } catch (error) {
    const status = Number(error?.status || 0);
    if (status === 401 || status === 403) {
      return json({ ok: false, messageKey: "api.common.forbidden" }, status);
    }
    console.error("[personal-search] failed", safeError(error));
    return json({ ok: false, messageKey: "api.search.unavailable" }, 500);
  }
}
