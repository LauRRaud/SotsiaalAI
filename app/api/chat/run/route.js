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
const CHAT_RUN_GET_RATE_LIMIT_MAX = readChatRateLimit(process.env.CHAT_RATE_LIMIT_RUN_GET_MAX, 90);
const CHAT_RUN_MESSAGES_MAX = readChatRateLimit(process.env.CHAT_RUN_MESSAGES_MAX, 200);

const noStoreHeaders = {
  ...CHAT_NO_STORE_HEADERS,
  "X-Accel-Buffering": "no",
  Vary: "Authorization"
};

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: noStoreHeaders
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

function isPlausibleId(id) {
  return isPlausibleChatId(id);
}

function normalizeSources(s) {
  if (!s) return [];
  if (Array.isArray(s)) return s;
  return [s];
}

function readDisplayedSources(metadata) {
  if (!metadata || typeof metadata !== "object") return [];
  return normalizeSources(metadata.displayed_sources || metadata.sources || []);
}

function normalizeAttachments(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(item => item && typeof item === "object")
    .map(item => {
      const label = String(item.label || "").trim();
      const url = String(item.url || "").trim();
      const fileName = String(item.fileName || "").trim();
      const format = String(item.format || "").trim();
      if (!url) return null;
      return {
        label: label || "Download file",
        url,
        ...(fileName ? { fileName } : {}),
        ...(format ? { format } : {})
      };
    })
    .filter(Boolean);
}

function normalizeCards(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const title = String(item.title || "").trim();
      const subtitle = String(item.subtitle || "").trim();
      const body = String(item.body || "").trim();
      const meta = String(item.meta || "").trim();
      const hint = String(item.hint || "").trim();
      if (!title && !body) return null;
      return {
        ...(title ? { title } : {}),
        ...(subtitle ? { subtitle } : {}),
        ...(body ? { body } : {}),
        ...(meta ? { meta } : {}),
        ...(hint ? { hint } : {})
      };
    })
    .filter(Boolean);
}

function normalizeWorkflow(value) {
  return value && typeof value === "object" ? value : null;
}

async function requireUser() {
  return requireChatUser();
}

export async function GET(req) {
  const auth = await requireUser();
  if (!auth.ok) return errorJson(auth.message, auth.status);
  const rateLimitResponse = enforceChatRateLimit(req, {
    scope: "run_get",
    userId: auth.userId,
    limit: CHAT_RUN_GET_RATE_LIMIT_MAX,
    windowMs: CHAT_RATE_LIMIT_WINDOW_MS
  });
  if (rateLimitResponse) return rateLimitResponse;

  const url = new URL(req.url);
  const convId = (url.searchParams.get("convId") || "").trim();
  const limitParam = Number(url.searchParams.get("limit") || CHAT_RUN_MESSAGES_MAX);
  const messageLimit = Math.max(
    1,
    Math.min(CHAT_RUN_MESSAGES_MAX, Number.isFinite(limitParam) ? Math.floor(limitParam) : CHAT_RUN_MESSAGES_MAX)
  );
  if (!isPlausibleId(convId)) {
    return errorJson("api.chat.invalid_conv_id", 400);
  }

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: convId },
      select: {
        id: true,
        userId: true,
        role: true,
        summary: true,
        lastActivityAt: true,
        createdAt: true,
        archivedAt: true
      }
    });

    if (!conversation || conversation.archivedAt) {
      return json({
        ok: false,
        notFound: true
      }, 200);
    }
    if (conversation.userId !== auth.userId) {
      return errorJson("api.common.forbidden", 403);
    }

    const [latestMessage, recentMessages] = await Promise.all([
      prisma.conversationMessage.findFirst({
        where: {
          conversationId: convId,
          role: {
            in: ["USER", "ASSISTANT"]
          }
        },
        orderBy: { createdAt: "desc" },
        select: {
          role: true,
          content: true,
          metadata: true,
          createdAt: true
        }
      }),
      prisma.conversationMessage.findMany({
        where: {
          conversationId: convId,
          role: {
            in: ["USER", "ASSISTANT"]
          }
        },
        orderBy: { createdAt: "desc" },
        take: messageLimit + 1,
        select: {
          role: true,
          content: true,
          metadata: true,
          createdAt: true
        }
      })
    ]);

    const messagesTruncated = Array.isArray(recentMessages) && recentMessages.length > messageLimit;
    const messageRows = messagesTruncated ? recentMessages.slice(0, messageLimit) : recentMessages;
    const history = Array.isArray(messageRows)
      ? [...messageRows]
          .reverse()
          .map(msg => {
            const normalizedRole = msg.role === "USER" ? "user" : msg.role === "ASSISTANT" ? "ai" : null;
            if (!normalizedRole) return null;
            return {
              role: normalizedRole,
              text: msg.content || "",
              sources: normalizedRole === "ai" ? readDisplayedSources(msg.metadata) : [],
              attachments: normalizedRole === "ai" ? normalizeAttachments(msg.metadata?.attachments) : [],
              cards: normalizedRole === "ai" ? normalizeCards(msg.metadata?.cards) : [],
              workflow: normalizedRole === "ai" ? normalizeWorkflow(msg.metadata?.workflow) : null,
              createdAt: msg.createdAt
            };
          })
          .filter(Boolean)
      : [];
    const latestTurnRole = String(latestMessage?.role || "").trim().toUpperCase();
    const latestAssistantIsCurrent = latestTurnRole === "ASSISTANT";
    const currentAssistant = latestAssistantIsCurrent ? latestMessage : null;
    const status = latestAssistantIsCurrent
      ? "COMPLETED"
      : latestTurnRole === "USER"
        ? "RUNNING"
        : "IDLE";
    const text = currentAssistant?.content || (!latestMessage ? conversation.summary || "" : "");

    return json({
      ok: true,
      convId: conversation.id,
      status,
      role: conversation.role,
      text,
      sources: readDisplayedSources(currentAssistant?.metadata),
      displayed_sources: readDisplayedSources(currentAssistant?.metadata),
      attachments: normalizeAttachments(currentAssistant?.metadata?.attachments),
      cards: normalizeCards(currentAssistant?.metadata?.cards),
      workflow: normalizeWorkflow(currentAssistant?.metadata?.workflow),
      isCrisis: !!currentAssistant?.metadata?.isCrisis,
      updatedAt: conversation.lastActivityAt,
      createdAt: conversation.createdAt,
      messagesTruncated,
      messages: history
    });
  } catch (err) {
    if (isDbOffline(err)) {
      return errorJson("api.chat.db_unavailable", 503, {
        degraded: true
      });
    }
    console.error("[chat run GET] failed", safeError(err));
    return errorJson("api.chat.db_error_run_read", 500, {
      code: "DB_ERROR_RUN_READ"
    });
  }
}
