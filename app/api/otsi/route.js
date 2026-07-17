import { NextResponse } from "next/server";
import { requireChatUser, CHAT_NO_STORE_HEADERS } from "@/lib/chat/routeServerUtils";
import { enforceChatRateLimit, readChatRateLimit } from "@/lib/chat-api-rate-limit";
import { prisma } from "@/lib/prisma";
import { normalizePersonalSearchQuery, searchPersonalObjects } from "@/lib/search/personalSearch";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const WINDOW_MS = readChatRateLimit(process.env.PERSONAL_SEARCH_RATE_LIMIT_WINDOW_MS, 60_000, 1000);
const MAX_REQUESTS = readChatRateLimit(process.env.PERSONAL_SEARCH_RATE_LIMIT_MAX, 30);

function json(data, status = 200) {
  return NextResponse.json(data, { status, headers: CHAT_NO_STORE_HEADERS });
}

export async function GET(request, deps = {}) {
  const requireUser = deps.requireUser || (() => requireChatUser({ runRetentionCleanup: true, includeSession: true }));
  const enforceRateLimit = deps.enforceRateLimit || enforceChatRateLimit;
  const search = deps.search || searchPersonalObjects;
  const db = deps.prisma || prisma;
  const auth = await requireUser();
  if (!auth?.ok) return json({ ok: false, messageKey: auth?.message || "api.common.unauthorized" }, auth?.status || 401);

  const limited = enforceRateLimit(request, {
    scope: "personal_search",
    userId: auth.userId,
    limit: MAX_REQUESTS,
    windowMs: WINDOW_MS
  });
  if (limited) return limited;

  const query = normalizePersonalSearchQuery(new URL(request.url).searchParams.get("q"));
  if (!query.ok) return json({ ok: false, messageKey: "api.search.query_too_long" }, 400);
  if (!query.query) return json({ ok: true, results: [] });

  try {
    const results = await search({ prisma: db, userId: auth.userId, query: query.query });
    return json({ ok: true, results });
  } catch (error) {
    console.error("[personal-search] failed", safeError(error));
    return json({ ok: false, messageKey: "api.search.unavailable" }, 500);
  }
}
