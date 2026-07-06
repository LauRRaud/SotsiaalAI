import { NextResponse } from "next/server";
import { CHAT_NO_STORE_HEADERS, isChatDbOfflineError, isPlausibleChatId, requireChatUser } from "@/lib/chat/routeServerUtils";
import { prisma } from "@/lib/prisma";
import { enforceChatRateLimit, readChatRateLimit } from "@/lib/chat-api-rate-limit";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const CONVERSATION_TTL_MS = Math.max(1, Number(process.env.CONVERSATION_TTL_DAYS || 90)) * 24 * 60 * 60 * 1000;
const CHAT_RATE_LIMIT_WINDOW_MS = readChatRateLimit(process.env.CHAT_RATE_LIMIT_WINDOW_MS, 60_000, 1000);
const CHAT_CONVERSATION_GET_RATE_LIMIT_MAX = readChatRateLimit(process.env.CHAT_RATE_LIMIT_CONVERSATION_GET_MAX, 90);
const CHAT_CONVERSATION_PUT_RATE_LIMIT_MAX = readChatRateLimit(process.env.CHAT_RATE_LIMIT_CONVERSATION_PUT_MAX, 30);
const CHAT_CONVERSATION_DELETE_RATE_LIMIT_MAX = readChatRateLimit(process.env.CHAT_RATE_LIMIT_CONVERSATION_DELETE_MAX, 30);

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: CHAT_NO_STORE_HEADERS
  });
}

function noContent() {
  return new Response(null, {
    status: 204,
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

function conversationExpiryDate() {
  return new Date(Date.now() + CONVERSATION_TTL_MS);
}

function isPlausibleId(id) {
  return isPlausibleChatId(id);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sanitizeConversationMetadata(value) {
  return isPlainObject(value) ? value : null;
}

function ensureOwned(row, auth) {
  if (!row) return { ok: false, status: 404, message: "api.chat.not_found" };
  if (row.userId !== auth.userId) return { ok: false, status: 403, message: "api.common.forbidden" };
  return { ok: true };
}

async function requireUser() {
  return requireChatUser({
    runRetentionCleanup: true
  });
}

export async function GET(req, { params }, deps = {}) {
  const requireUserFn = deps.requireUser || requireUser;
  const enforceRateLimit = deps.enforceChatRateLimit || enforceChatRateLimit;
  const prismaClient = deps.prisma || prisma;

  const auth = await requireUserFn();
  if (!auth.ok) return errorJson(auth.message, auth.status);
  const rateLimitResponse = enforceRateLimit(req, {
    scope: "conversation_get",
    userId: auth.userId,
    limit: CHAT_CONVERSATION_GET_RATE_LIMIT_MAX,
    windowMs: CHAT_RATE_LIMIT_WINDOW_MS
  });
  if (rateLimitResponse) return rateLimitResponse;

  const resolvedParams = params instanceof Promise ? await params : params;
  const id = resolvedParams?.id ? String(resolvedParams.id).trim() : "";
  if (!isPlausibleId(id)) return errorJson("api.chat.invalid_id", 400);

  try {
    const row = await prismaClient.conversation.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        role: true,
        title: true,
        summary: true,
        metadata: true,
        lastActivityAt: true,
        archivedAt: true
      }
    });
    const gate = ensureOwned(row, auth);
    if (!gate.ok) return errorJson(gate.message, gate.status);

    if (row.archivedAt) {
      return errorJson("api.chat.not_found", 404);
    }

    const previewSource = row.summary || "";
    return json({
      ok: true,
      conversation: {
        id: row.id,
        role: row.role,
        lastActivityAt: row.lastActivityAt,
        title: row.title || null,
        preview: previewSource?.slice?.(0, 160) ?? "",
        metadata: sanitizeConversationMetadata(row.metadata)
      }
    });
  } catch (err) {
    if (isDbOffline(err)) {
      return errorJson("api.chat.db_unavailable", 503, {
        degraded: true
      });
    }
    console.error("[chat/conversations/:id GET] failed", safeError(err));
    return errorJson("api.chat.db_error_conversation_read", 500, {
      code: "DB_ERROR_CONVERSATION_READ"
    });
  }
}

export async function DELETE(req, { params }, deps = {}) {
  const requireUserFn = deps.requireUser || requireUser;
  const enforceRateLimit = deps.enforceChatRateLimit || enforceChatRateLimit;
  const prismaClient = deps.prisma || prisma;

  const auth = await requireUserFn();
  if (!auth.ok) return errorJson(auth.message, auth.status);
  const rateLimitResponse = enforceRateLimit(req, {
    scope: "conversation_delete",
    userId: auth.userId,
    limit: CHAT_CONVERSATION_DELETE_RATE_LIMIT_MAX,
    windowMs: CHAT_RATE_LIMIT_WINDOW_MS
  });
  if (rateLimitResponse) return rateLimitResponse;

  const resolvedParams = params instanceof Promise ? await params : params;
  const id = resolvedParams?.id ? String(resolvedParams.id).trim() : "";
  if (!isPlausibleId(id)) return errorJson("api.chat.invalid_id", 400);

  try {
    const existing = await prismaClient.conversation.findUnique({
      where: { id },
      select: {
        userId: true,
        archivedAt: true
      }
    });
    const gate = ensureOwned(existing, auth);
    if (!gate.ok) return errorJson(gate.message, gate.status);

    if (existing.archivedAt) {
      return noContent();
    }

    await prismaClient.conversation.update({
      where: { id },
      data: {
        archivedAt: new Date(),
        expiresAt: new Date()
      }
    });
    return noContent();
  } catch (err) {
    if (isDbOffline(err)) {
      return errorJson("api.chat.db_unavailable", 503, {
        degraded: true
      });
    }
    console.error("[chat/conversations/:id DELETE] failed", safeError(err));
    return errorJson("api.chat.db_error_conversation_delete", 500, {
      code: "DB_ERROR_CONVERSATION_DELETE"
    });
  }
}

export async function PUT(req, { params }, deps = {}) {
  const requireUserFn = deps.requireUser || requireUser;
  const enforceRateLimit = deps.enforceChatRateLimit || enforceChatRateLimit;
  const prismaClient = deps.prisma || prisma;

  const auth = await requireUserFn();
  if (!auth.ok) return errorJson(auth.message, auth.status);
  const rateLimitResponse = enforceRateLimit(req, {
    scope: "conversation_put",
    userId: auth.userId,
    limit: CHAT_CONVERSATION_PUT_RATE_LIMIT_MAX,
    windowMs: CHAT_RATE_LIMIT_WINDOW_MS
  });
  if (rateLimitResponse) return rateLimitResponse;

  const resolvedParams = params instanceof Promise ? await params : params;
  const id = resolvedParams?.id ? String(resolvedParams.id).trim() : "";
  if (!isPlausibleId(id)) return errorJson("api.chat.invalid_id", 400);

  try {
    const existing = await prismaClient.conversation.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        archivedAt: true,
        role: true,
        lastActivityAt: true,
        metadata: true
      }
    });
    const gate = ensureOwned(existing, auth);
    if (!gate.ok) return errorJson(gate.message, gate.status);

    if (!existing.archivedAt) {
      return json({
        ok: true,
        conversation: {
          id: existing.id,
          role: existing.role,
          lastActivityAt: existing.lastActivityAt,
          metadata: sanitizeConversationMetadata(existing.metadata)
        }
      });
    }

    const row = await prismaClient.conversation.update({
      where: { id },
      data: {
        archivedAt: null,
        expiresAt: conversationExpiryDate()
      },
      select: {
        id: true,
        role: true,
        lastActivityAt: true,
        metadata: true
      }
    });
    return json({
      ok: true,
      conversation: {
        ...row,
        metadata: sanitizeConversationMetadata(row.metadata)
      }
    });
  } catch (err) {
    if (isDbOffline(err)) {
      return errorJson("api.chat.db_unavailable", 503, {
        degraded: true
      });
    }
    console.error("[chat/conversations/:id PUT] failed", safeError(err));
    return errorJson("api.chat.db_error_conversation_restore", 500, {
      code: "DB_ERROR_CONVERSATION_RESTORE"
    });
  }
}
