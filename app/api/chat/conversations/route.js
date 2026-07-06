import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveSessionRoleState } from "@/lib/authz";
import {
  normalizeConversationRole as normalizeRole,
  resolveConversationListRoleFilter,
  resolveConversationWriteRole
} from "@/lib/chat/conversationRoles";
import { CHAT_NO_STORE_HEADERS, isChatDbOfflineError, isPlausibleChatId, requireChatUser } from "@/lib/chat/routeServerUtils";
import { prisma } from "@/lib/prisma";
import { enforceChatRateLimit, readChatRateLimit } from "@/lib/chat-api-rate-limit";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const CONVERSATION_TTL_DAYS = Number(process.env.CONVERSATION_TTL_DAYS || 90);
const CONVERSATION_TTL_MS = Math.max(1, CONVERSATION_TTL_DAYS) * 24 * 60 * 60 * 1000;
const CHAT_RATE_LIMIT_WINDOW_MS = readChatRateLimit(process.env.CHAT_RATE_LIMIT_WINDOW_MS, 60_000, 1000);
const CHAT_CONVERSATIONS_GET_RATE_LIMIT_MAX = readChatRateLimit(process.env.CHAT_RATE_LIMIT_CONVERSATIONS_GET_MAX, 90);
const CHAT_CONVERSATIONS_POST_RATE_LIMIT_MAX = readChatRateLimit(process.env.CHAT_RATE_LIMIT_CONVERSATIONS_POST_MAX, 30);
const CHAT_CONVERSATIONS_DELETE_RATE_LIMIT_MAX = readChatRateLimit(process.env.CHAT_RATE_LIMIT_CONVERSATIONS_DELETE_MAX, 15);
const CHAT_CONVERSATIONS_BULK_DELETE_MAX = readChatRateLimit(process.env.CHAT_CONVERSATIONS_BULK_DELETE_MAX, 5000);

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

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sanitizeConversationMetadata(value) {
  return isPlainObject(value) ? value : null;
}

function encodeCursor(row) {
  try {
    const pin = row.isPinned ? 1 : 0;
    const ms = row.lastActivityAt instanceof Date ? row.lastActivityAt.getTime() : new Date(row.lastActivityAt).getTime();
    if (!Number.isFinite(ms)) return null;
    return `${pin}:${ms}:${row.id}`;
  } catch {
    return null;
  }
}

function parseCursor(token) {
  if (!token || typeof token !== "string") return null;
  const firstSep = token.indexOf(":");
  if (firstSep <= 0) return null;
  const secondSep = token.indexOf(":", firstSep + 1);
  if (secondSep <= firstSep + 1) return null;
  const pinPart = token.slice(0, firstSep);
  const msPart = token.slice(firstSep + 1, secondSep);
  const id = token.slice(secondSep + 1);
  if (!isPlausibleConversationId(id)) return null;
  const ms = Number(msPart);
  if (!Number.isFinite(ms)) return null;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  const isPinned = pinPart === "1" ? true : pinPart === "0" ? false : null;
  if (isPinned === null) return null;
  return {
    isPinned,
    date,
    id
  };
}

function trimPreview(text = "", max = 160) {
  if (!text) return "";
  const normalized = String(text).replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > max ? `${normalized.slice(0, max - 1)}...` : normalized;
}

function fallbackTitle(text = "") {
  const normalized = trimPreview(text, 160);
  if (!normalized) return null;
  const sentence = normalized.split(/[.!?]/)[0]?.trim();
  if (sentence && sentence.length >= 3) return sentence;
  return normalized;
}

function conversationExpiryDate() {
  return new Date(Date.now() + CONVERSATION_TTL_MS);
}

async function requireUser() {
  return requireChatUser({
    runRetentionCleanup: true,
    includeSession: true,
    includeRole: true,
    normalizeRole
  });
}

function isDbOffline(err) {
  return isChatDbOfflineError(err);
}

export async function GET(req, deps = {}) {
  const requireUserFn = deps.requireUser || requireUser;
  const enforceRateLimit = deps.enforceChatRateLimit || enforceChatRateLimit;
  const resolveRoleState = deps.resolveSessionRoleState || resolveSessionRoleState;
  const resolveListRoleFilter = deps.resolveConversationListRoleFilter || resolveConversationListRoleFilter;
  const prismaClient = deps.prisma || prisma;

  const auth = await requireUserFn();
  if (!auth.ok) return errorJson(auth.message, auth.status);
  const rateLimitResponse = enforceRateLimit(req, {
    scope: "conversations_get",
    userId: auth.userId,
    limit: CHAT_CONVERSATIONS_GET_RATE_LIMIT_MAX,
    windowMs: CHAT_RATE_LIMIT_WINDOW_MS
  });
  if (rateLimitResponse) return rateLimitResponse;

  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit") || 30);
  const limit = Math.max(1, Math.min(100, Number.isFinite(limitParam) ? limitParam : 30));
  const cursorToken = url.searchParams.get("cursor");
  const parsedCursor = parseCursor(cursorToken);
  const roleState = resolveRoleState(auth.session, req.cookies);
  const roleParam = url.searchParams.get("role");
  const roleFilter = resolveListRoleFilter(roleParam, roleState.effectiveRole, roleState.isAdmin);

  const baseWhere = {
    userId: auth.userId,
    archivedAt: null,
    OR: [
      { expiresAt: null },
      {
        expiresAt: {
          gt: new Date()
        }
      }
    ],
    ...(roleFilter ? { role: roleFilter } : {})
  };

  let where = baseWhere;
  if (parsedCursor) {
    const cursorFilters = [];
    if (parsedCursor.isPinned) {
      cursorFilters.push({ isPinned: false });
    }
    cursorFilters.push({
      isPinned: parsedCursor.isPinned,
      OR: [
        {
          lastActivityAt: {
            lt: parsedCursor.date
          }
        },
        {
          AND: [
            { lastActivityAt: parsedCursor.date },
            {
              id: {
                lt: parsedCursor.id
              }
            }
          ]
        }
      ]
    });
    where = {
      AND: [
        baseWhere,
        {
          OR: cursorFilters
        }
      ]
    };
  }

  try {
    const rows = await prismaClient.conversation.findMany({
      where,
      orderBy: [{ isPinned: "desc" }, { lastActivityAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: {
        id: true,
        title: true,
        summary: true,
        metadata: true,
        lastActivityAt: true,
        isPinned: true,
        role: true,
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            content: true
          }
        }
      }
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const items = pageRows.map(row => {
      const previewSource = row.messages?.[0]?.content || row.summary || "";
      const preview = trimPreview(previewSource);
      const title = row.title || fallbackTitle(previewSource) || null;
      return {
        id: row.id,
        title,
        preview,
        metadata: sanitizeConversationMetadata(row.metadata),
        lastActivityAt: row.lastActivityAt,
        isPinned: row.isPinned,
        role: row.role
      };
    });
    const last = pageRows.at(-1);
    const nextCursor = hasMore && last ? encodeCursor(last) : null;
    return json({
      ok: true,
      conversations: items,
      nextCursor
    });
  } catch (err) {
    console.error("[chat/conversations GET] failed", safeError(err));
    if (isDbOffline(err)) {
      return json({
        ok: true,
        conversations: [],
        nextCursor: null,
        degraded: true,
        messageKey: "api.chat.db_unavailable",
        message: "api.chat.db_unavailable"
      });
    }
    return errorJson("api.chat.db_error_conversations_list", 500, {
      code: "DB_ERROR_CONVERSATIONS_LIST"
    });
  }
}

export async function POST(req, deps = {}) {
  const requireUserFn = deps.requireUser || requireUser;
  const enforceRateLimit = deps.enforceChatRateLimit || enforceChatRateLimit;
  const resolveRoleState = deps.resolveSessionRoleState || resolveSessionRoleState;
  const resolveWriteRole = deps.resolveConversationWriteRole || resolveConversationWriteRole;
  const generateUuid = deps.randomUUID || randomUUID;
  const prismaClient = deps.prisma || prisma;

  const auth = await requireUserFn();
  if (!auth.ok) return errorJson(auth.message, auth.status);
  const rateLimitResponse = enforceRateLimit(req, {
    scope: "conversations_post",
    userId: auth.userId,
    limit: CHAT_CONVERSATIONS_POST_RATE_LIMIT_MAX,
    windowMs: CHAT_RATE_LIMIT_WINDOW_MS
  });
  if (rateLimitResponse) return rateLimitResponse;

  let body = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  let convId = String(body?.id || "").trim();
  if (convId && !isPlausibleChatId(convId)) {
    return errorJson("api.chat.invalid_conv_id", 400);
  }
  if (!convId) {
    try {
      convId = generateUuid();
    } catch {
      convId = String(Date.now());
    }
  }

  const roleState = resolveRoleState(auth.session, req.cookies);
  const requestedRole =
    body?.role == null || body?.role === ""
      ? null
      : normalizeRole(body?.role);
  const role = resolveWriteRole({
    requestedRole,
    effectiveRole: roleState.effectiveRole,
    isAdmin: auth.isAdmin,
    sessionRole: auth.role
  });
  const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim().slice(0, 160) : null;
  const metadata = sanitizeConversationMetadata(body?.metadata);

  try {
    const existing = await prismaClient.conversation.findUnique({
      where: { id: convId },
      select: {
        userId: true
      }
    });
    if (existing && existing.userId !== auth.userId) {
      return errorJson("api.chat.conversation_exists", 409);
    }

    const now = new Date();
    const expiry = conversationExpiryDate();
    const row = existing
      ? await prismaClient.conversation.update({
          where: { id: convId },
          data: {
            role,
            archivedAt: null,
            lastActivityAt: now,
            expiresAt: expiry,
            ...(metadata ? { metadata } : {}),
            ...(title ? { title } : {})
          },
          select: {
            id: true,
            title: true,
            metadata: true,
            lastActivityAt: true,
            role: true
          }
        })
      : await prismaClient.conversation.create({
          data: {
            id: convId,
            userId: auth.userId,
            role,
            title,
            metadata,
            lastActivityAt: now,
            expiresAt: expiry
          },
          select: {
            id: true,
            title: true,
            metadata: true,
            lastActivityAt: true,
            role: true
          }
        });

    return json({
      ok: true,
      conversation: {
        id: row.id,
        title: row.title || null,
        metadata: sanitizeConversationMetadata(row.metadata),
        lastActivityAt: row.lastActivityAt,
        role: row.role
      }
    });
  } catch (err) {
    console.error("[chat/conversations POST] failed", safeError(err));
    return errorJson("api.chat.db_error_conversation_create", 500, {
      code: "DB_ERROR_CONVERSATION_CREATE"
    });
  }
}

export async function DELETE(req, deps = {}) {
  const requireUserFn = deps.requireUser || requireUser;
  const enforceRateLimit = deps.enforceChatRateLimit || enforceChatRateLimit;
  const prismaClient = deps.prisma || prisma;

  const auth = await requireUserFn();
  if (!auth.ok) return errorJson(auth.message, auth.status);
  const rateLimitResponse = enforceRateLimit(req, {
    scope: "conversations_delete",
    userId: auth.userId,
    limit: CHAT_CONVERSATIONS_DELETE_RATE_LIMIT_MAX,
    windowMs: CHAT_RATE_LIMIT_WINDOW_MS
  });
  if (rateLimitResponse) return rateLimitResponse;

  let body = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const ids = Array.isArray(body?.ids)
    ? Array.from(new Set(body.ids.map(id => String(id || "").trim()).filter(Boolean)))
    : [];
  if (!ids.length) return errorJson("api.chat.invalid_id", 400);
  if (ids.length > CHAT_CONVERSATIONS_BULK_DELETE_MAX) {
    return errorJson("api.chat.too_many_conversations", 400);
  }
  if (ids.some(id => !isPlausibleChatId(id))) {
    return errorJson("api.chat.invalid_id", 400);
  }

  try {
    const now = new Date();
    const result = await prismaClient.conversation.updateMany({
      where: {
        id: {
          in: ids
        },
        userId: auth.userId,
        archivedAt: null
      },
      data: {
        archivedAt: now,
        expiresAt: now
      }
    });

    return json({
      ok: true,
      deleted: result.count,
      ids
    });
  } catch (err) {
    console.error("[chat/conversations DELETE] failed", safeError(err));
    if (isDbOffline(err)) {
      return errorJson("api.chat.db_unavailable", 503, {
        degraded: true
      });
    }
    return errorJson("api.chat.db_error_conversation_delete", 500, {
      code: "DB_ERROR_CONVERSATION_DELETE"
    });
  }
}
