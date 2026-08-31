import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CHAT_NO_STORE_HEADERS, isChatDbOfflineError, isPlausibleChatId, requireChatUser } from "@/lib/chat/routeServerUtils";
import { enforceChatRateLimit } from "@/lib/chat-api-rate-limit";
import { safeError } from "@/lib/privacy/safeError";
import { buildDiagnosticReport, diagnosticReportMarkdown, DIAGNOSTIC_TURN_LIMIT } from "@/lib/chat/ragDiagnosticReport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const json = (data, status = 200) => NextResponse.json(data, { status, headers: CHAT_NO_STORE_HEADERS });
const failure = (messageKey, status) => json({ ok: false, messageKey }, status);

export async function GET(req, { params }, deps = {}) {
  const auth = await (deps.requireUser || requireChatUser)();
  if (!auth.ok) return failure(auth.message, auth.status);
  // Developer diagnostics are not a new route into other users' conversations.
  if (!auth.isAdmin) return failure("api.common.forbidden", 403);
  const rateLimit = (deps.enforceChatRateLimit || enforceChatRateLimit)(req, { scope: "conversation_diagnostics_get", userId: auth.userId, limit: 30, windowMs: 60000 });
  if (rateLimit) return rateLimit;
  const { id } = await params;
  if (!isPlausibleChatId(id)) return failure("api.chat.invalid_id", 400);
  const db = deps.prisma || prisma;
  try {
    const conversation = await db.conversation.findUnique({ where: { id }, select: { userId: true, archivedAt: true } });
    if (!conversation || conversation.archivedAt) return failure("api.chat.not_found", 404);
    if (conversation.userId !== auth.userId) return failure("api.common.forbidden", 403);
    const [turnRows, messageRows] = await Promise.all([
      db.chatTurn.findMany({ where: { conversationId: id, userId: auth.userId }, orderBy: [{ startedAt: "asc" }, { id: "asc" }], take: DIAGNOSTIC_TURN_LIMIT + 1, select: { id: true, userMessageId: true, assistantMessageId: true, status: true, startedAt: true, updatedAt: true, endedAt: true, attempt: true } }),
      db.conversationMessage.findMany({ where: { conversationId: id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: DIAGNOSTIC_TURN_LIMIT * 2 + 1, select: { id: true, role: true, content: true, metadata: true, createdAt: true } })
    ]);
    const report = buildDiagnosticReport({ conversationId: id, turns: turnRows.slice(0, DIAGNOSTIC_TURN_LIMIT), messages: messageRows.slice(0, DIAGNOSTIC_TURN_LIMIT * 2), hasMore: turnRows.length > DIAGNOSTIC_TURN_LIMIT || messageRows.length > DIAGNOSTIC_TURN_LIMIT * 2 });
    const url = new URL(req.url);
    if (url.searchParams.get("format") === "md") {
      return new Response(diagnosticReportMarkdown(report, url.searchParams.get("lang")), { headers: { ...CHAT_NO_STORE_HEADERS, "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="rag-diagnostics-${id}.md"`, "X-Content-Type-Options": "nosniff" } });
    }
    return json({ ok: true, report });
  } catch (error) {
    console.error("[chat/diagnostics GET] failed", safeError(error));
    return failure(isChatDbOfflineError(error) ? "api.chat.db_unavailable" : "api.chat.db_error_conversation_messages", isChatDbOfflineError(error) ? 503 : 500);
  }
}
