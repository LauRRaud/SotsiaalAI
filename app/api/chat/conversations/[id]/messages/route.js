import { NextResponse } from "next/server";
import { CHAT_NO_STORE_HEADERS, isChatDbOfflineError, isPlausibleChatId, requireChatUser } from "@/lib/chat/routeServerUtils";
import { prisma } from "@/lib/prisma";
import { enforceChatRateLimit, readChatRateLimit } from "@/lib/chat-api-rate-limit";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
const CHAT_RATE_LIMIT_WINDOW_MS = readChatRateLimit(process.env.CHAT_RATE_LIMIT_WINDOW_MS, 60_000, 1000);
const CHAT_CONVERSATION_MESSAGES_GET_RATE_LIMIT_MAX = readChatRateLimit(process.env.CHAT_RATE_LIMIT_CONVERSATION_MESSAGES_GET_MAX, 90);

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: CHAT_NO_STORE_HEADERS
  });
}

function errorJson(messageKey, status, extras = {}) {
  return json({
    ok: false,
    messageKey,
    message: messageKey,
    ...extras
  }, status);
}

function isDbOffline(err) {
  return isChatDbOfflineError(err);
}

function parseCursor(token) {
  if (!token || typeof token !== "string") return null;
  const sep = token.indexOf(":");
  if (sep <= 0) return null;
  const msPart = token.slice(0, sep);
  const id = token.slice(sep + 1);
  const ms = Number(msPart);
  if (!Number.isFinite(ms) || !isPlausibleId(id)) return null;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  return {
    date,
    id
  };
}

function encodeCursor(row) {
  try {
    const ms = row.createdAt instanceof Date ? row.createdAt.getTime() : new Date(row.createdAt).getTime();
    if (!Number.isFinite(ms)) return null;
    return `${ms}:${row.id}`;
  } catch {
    return null;
  }
}

function isPlausibleId(id) {
  return isPlausibleChatId(id);
}

function normalizeSources(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

function readDisplayedSources(metadata) {
  if (!metadata || typeof metadata !== "object") return [];
  return normalizeSources(metadata.displayed_sources || metadata.sources || []);
}

async function requireUser() {
  return requireChatUser();
}

export async function GET(req, { params }, deps = {}) {
  const requireUserFn = deps.requireUser || requireUser;
  const enforceRateLimit = deps.enforceChatRateLimit || enforceChatRateLimit;
  const prismaClient = deps.prisma || prisma;

  const auth = await requireUserFn();
  if (!auth.ok) return errorJson(auth.message, auth.status);
  const rateLimitResponse = enforceRateLimit(req, {
    scope: "conversation_messages_get",
    userId: auth.userId,
    limit: CHAT_CONVERSATION_MESSAGES_GET_RATE_LIMIT_MAX,
    windowMs: CHAT_RATE_LIMIT_WINDOW_MS
  });
  if (rateLimitResponse) return rateLimitResponse;

  const resolvedParams = params instanceof Promise ? await params : params;
  const id = resolvedParams?.id ? String(resolvedParams.id).trim() : "";
  if (!isPlausibleId(id)) return errorJson("api.chat.invalid_id", 400);

  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit") || 50);
  const limit = Math.max(1, Math.min(100, Number.isFinite(limitParam) ? limitParam : 50));
  const beforeToken = url.searchParams.get("before");
  const beforeCursor = parseCursor(beforeToken);

  try {
    const conversation = await prismaClient.conversation.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        archivedAt: true
      }
    });
    if (!conversation || conversation.archivedAt) {
      return errorJson("api.chat.not_found", 404);
    }
    if (conversation.userId !== auth.userId) {
      return errorJson("api.common.forbidden", 403);
    }

    const baseWhere = {
      conversationId: id
    };
    const cursorWhere = beforeCursor
      ? {
          OR: [
            {
              createdAt: {
                lt: beforeCursor.date
              }
            },
            {
              AND: [
                { createdAt: beforeCursor.date },
                {
                  id: {
                    lt: beforeCursor.id
                  }
                }
              ]
            }
          ]
        }
      : null;

    const rows = await prismaClient.conversationMessage.findMany({
      where: cursorWhere ? { AND: [baseWhere, cursorWhere] } : baseWhere,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: {
        id: true,
        role: true,
        content: true,
        metadata: true,
        createdAt: true
      }
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const items = [...pageRows].reverse().map(row => {
      const isAssistant = String(row.role || "").toUpperCase() === "ASSISTANT";
      const displayedSources = isAssistant ? readDisplayedSources(row.metadata) : [];
      return {
        id: row.id,
        role: row.role,
        content: row.content,
        metadata: row.metadata,
        ...(isAssistant
          ? {
              sources: displayedSources,
              displayed_sources: displayedSources
            }
          : {}),
        createdAt: row.createdAt
      };
    });
    const oldest = items[0];
    const nextCursor = hasMore && oldest ? encodeCursor(oldest) : null;

    return json({
      ok: true,
      items,
      nextCursor
    });
  } catch (err) {
    if (isDbOffline(err)) {
      return errorJson("api.chat.db_unavailable", 503, {
        degraded: true
      });
    }
    console.error("[chat/conversations/:id/messages GET] failed", safeError(err));
    return errorJson("api.chat.db_error_conversation_messages", 500, {
      code: "DB_ERROR_CONVERSATION_MESSAGES"
    });
  }
}
