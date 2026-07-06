export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { resolveSessionRoleState } from "@/lib/authz";
import { isChatDbOfflineError } from "@/lib/chat/routeServerUtils";
import { prisma } from "@/lib/prisma";
import { getAnalyzeLimit, utcDayStart, secondsUntilUtcMidnight } from "@/lib/analyzeQuota";
import { enforceChatRateLimit, readChatRateLimit } from "@/lib/chat-api-rate-limit";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { safeError } from "@/lib/privacy/safeError";
function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0"
    }
  });
}
function localeFromRequest(req) {
  const url = new URL(req.url);
  const fromQuery = normalizeServerLocale(url.searchParams.get("locale") || url.searchParams.get("lang"));
  if (fromQuery) return fromQuery;
  const fromHeader =
    normalizeServerLocale(req.headers.get("x-ui-locale")) ||
    normalizeServerLocale(req.headers.get("x-locale")) ||
    normalizeServerLocale(req.headers.get("accept-language"));
  return fromHeader || "en";
}

function errorJson(messageKey, status, locale = "en", extras = {}) {
  const translated = serverT(locale, messageKey, undefined, messageKey);
  return json({
    ok: false,
    messageKey,
    message: translated,
    ...extras
  }, status);
}
const CHAT_RATE_LIMIT_WINDOW_MS = readChatRateLimit(process.env.CHAT_RATE_LIMIT_WINDOW_MS, 60_000, 1000);
const CHAT_ANALYZE_USAGE_GET_RATE_LIMIT_MAX = readChatRateLimit(process.env.CHAT_RATE_LIMIT_ANALYZE_USAGE_GET_MAX, 90);

export async function GET(req) {
  const locale = localeFromRequest(req);
  const session = await getServerSession(authConfig).catch(() => null);
  if (!session?.user?.id) {
    return errorJson("api.common.unauthorized", 401, locale);
  }
  const rateLimitResponse = enforceChatRateLimit(req, {
    scope: "analyze_usage_get",
    userId: session.user.id,
    limit: CHAT_ANALYZE_USAGE_GET_RATE_LIMIT_MAX,
    windowMs: CHAT_RATE_LIMIT_WINDOW_MS
  });
  if (rateLimitResponse) return rateLimitResponse;
  const roleState = resolveSessionRoleState(session, req.cookies);
  const role = roleState.effectiveRole;
  const isAdmin = roleState.isAdmin;
  const limit = getAnalyzeLimit(role, isAdmin);
  const day = utcDayStart();
  try {
    const record = await prisma.analyzeUsage.findUnique({
      where: {
        userId_day: {
          userId: session.user.id,
          day
        }
      },
      select: {
        count: true
      }
    });
    const used = record?.count || 0;
    return json({
      ok: true,
      used,
      limit,
      resetSeconds: secondsUntilUtcMidnight()
    });
  } catch (err) {
    console.error("[chat/analyze-usage GET] failed", safeError(err));
    if (isChatDbOfflineError(err)) {
      return errorJson("api.chat.db_unavailable", 503, locale, {
        degraded: true
      });
    }
    return errorJson("api.chat.db_error_analyze_usage", 500, locale, {
      code: "DB_ERROR_ANALYZE_USAGE"
    });
  }
}
