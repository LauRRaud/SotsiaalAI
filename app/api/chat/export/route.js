import { NextResponse } from "next/server";
import { CHAT_NO_STORE_HEADERS, isChatDbOfflineError, isPlausibleChatId, requireChatUser } from "@/lib/chat/routeServerUtils";
import { prisma } from "@/lib/prisma";
import { enforceChatRateLimit, readChatRateLimit } from "@/lib/chat-api-rate-limit";
import {
  createPdfBufferFromText,
  createWordBufferFromText
} from "@/lib/chat/exportDocument";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const CHAT_RATE_LIMIT_WINDOW_MS = readChatRateLimit(process.env.CHAT_RATE_LIMIT_WINDOW_MS, 60_000, 1000);
const CHAT_EXPORT_GET_RATE_LIMIT_MAX = readChatRateLimit(process.env.CHAT_RATE_LIMIT_EXPORT_GET_MAX, 30);

function isPlausibleId(id) {
  return isPlausibleChatId(id);
}

function parseFormat(value) {
  const normalized = String(value || "")
    .toLowerCase()
    .trim();
  if (normalized === "pdf") return "pdf";
  if (normalized === "word" || normalized === "doc") {
    return "word";
  }
  return null;
}

function sanitizeFileBase(value, fallback = "sotsiaalai-summary") {
  const raw = String(value || "")
    .toLowerCase()
    .trim();
  const cleaned = raw
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!cleaned) return fallback;
  return cleaned.slice(0, 80);
}

async function requireUser() {
  return requireChatUser();
}

function isDbOffline(err) {
  return isChatDbOfflineError(err);
}

function jsonError(messageKey, status) {
  return NextResponse.json(
    {
      ok: false,
      messageKey,
      message: messageKey
    },
    {
      status,
      headers: CHAT_NO_STORE_HEADERS
    }
  );
}

function buildDownloadHeaders(fileName, contentType) {
  return {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${fileName}"`,
    "Cache-Control": "private, no-store"
  };
}

export async function GET(req) {
  const auth = await requireUser();
  if (!auth.ok) return jsonError("api.common.unauthorized", 401);

  const rateLimitResponse = enforceChatRateLimit(req, {
    scope: "chat_export_get",
    userId: auth.userId,
    limit: CHAT_EXPORT_GET_RATE_LIMIT_MAX,
    windowMs: CHAT_RATE_LIMIT_WINDOW_MS
  });
  if (rateLimitResponse) return rateLimitResponse;

  const url = new URL(req.url);
  const convId = String(url.searchParams.get("convId") || "").trim();
  const messageId = String(url.searchParams.get("messageId") || "").trim();
  const format = parseFormat(url.searchParams.get("format"));
  if (!isPlausibleId(convId) || !isPlausibleId(messageId)) {
    return jsonError("api.chat.invalid_id", 400);
  }
  if (!format) {
    return jsonError("api.common.invalid_request", 400);
  }

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: convId },
      select: {
        id: true,
        userId: true,
        archivedAt: true
      }
    });
    if (!conversation || conversation.archivedAt) {
      return jsonError("api.chat.not_found", 404);
    }
    if (conversation.userId !== auth.userId) {
      return jsonError("api.common.forbidden", 403);
    }

    const msg = await prisma.conversationMessage.findFirst({
      where: {
        id: messageId,
        conversationId: convId,
        role: "ASSISTANT"
      },
      select: {
        content: true
      }
    });
    if (!msg?.content?.trim()) {
      return jsonError("api.chat.not_found", 404);
    }

    const fileBase = sanitizeFileBase(
      String(url.searchParams.get("fileName") || "")
    );
    if (format === "pdf") {
      const pdf = createPdfBufferFromText(msg.content);
      return new NextResponse(pdf, {
        status: 200,
        headers: buildDownloadHeaders(`${fileBase}.pdf`, "application/pdf")
      });
    }

    const word = createWordBufferFromText(msg.content, "SotsiaalAI summary");
    return new NextResponse(word, {
      status: 200,
      headers: buildDownloadHeaders(`${fileBase}.doc`, "application/msword; charset=utf-8")
    });
  } catch (err) {
    if (isDbOffline(err)) {
      return jsonError("api.chat.db_unavailable", 503);
    }
    console.error("[chat export GET] failed", safeError(err));
    return jsonError("api.common.server_error", 500);
  }
}
