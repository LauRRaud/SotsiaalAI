import { NextResponse } from "next/server";
import { CHAT_NO_STORE_HEADERS, isChatDbOfflineError, isPlausibleChatId, requireChatUser } from "@/lib/chat/routeServerUtils";
import { prisma } from "@/lib/prisma";
import { enforceChatRateLimit, readChatRateLimit } from "@/lib/chat-api-rate-limit";
import {
  createPdfBufferFromText,
  createChatDocxBuffer,
  isPdfTextSupported
} from "@/lib/chat/exportDocument";
import { writeDocumentAudit } from "@/lib/documents/audit";
import { DOCX_MIME_TYPE } from "@/lib/documents/constants";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
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

function localeFromRequest(request) {
  const url = request?.url ? new URL(request.url) : null;
  return normalizeServerLocale(
    url?.searchParams?.get("locale") ||
    url?.searchParams?.get("lang") ||
    request?.headers?.get("x-ui-locale") ||
    request?.headers?.get("x-locale") ||
    request?.headers?.get("accept-language")
  ) || "en";
}

function jsonError(request, messageKey, status) {
  const message = serverT(localeFromRequest(request), messageKey, undefined, messageKey);
  return NextResponse.json(
    {
      ok: false,
      messageKey,
      message
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
  if (!auth.ok) return jsonError(req, "api.common.unauthorized", 401);

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
    return jsonError(req, "api.chat.invalid_id", 400);
  }
  if (!format) {
    return jsonError(req, "api.common.invalid_request", 400);
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
      return jsonError(req, "api.chat.not_found", 404);
    }
    if (conversation.userId !== auth.userId) {
      return jsonError(req, "api.common.forbidden", 403);
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
      return jsonError(req, "api.chat.not_found", 404);
    }

    const fileBase = sanitizeFileBase(
      String(url.searchParams.get("fileName") || "")
    );
    /* SOL-CHAT-10 — JÄLG ENNE FAILI, MITTE FAILI KÕRVAL.
       `logDocumentsAudit()` on best-effort: ta neelab `documentAudit.create()` vea täielikult ja
       kaardistamata sündmus lõpetab kirjutamata. Tundliku vestluse faili sai seega alla laadida
       ilma ühegi jäljeta selle kohta, kes, millal ja millises formaadis. Serveri console-rida ei
       ole püsiv ega päritav tõend.

       VALITUD ON FAIL-CLOSED, sama mis SOL-DOC-09-l: `writeDocumentAudit()` viskab nii
       kaardistamata sündmuse kui kirjutuse vea peale, ja siis faili EI ANTA. Kriteerium jätab
       valiku omanikule (fail-closed vs transactional outbox); outbox tähendaks siin, et fail läheb
       välja ja jälg tuleb hiljem — see on ekspordi puhul nõrgem lubadus kui „jälg on olemas".
       Vastupidine valik on üherealine: `writeDocumentAudit` → `logDocumentsAudit`. */
    const writeExportAudit = () => writeDocumentAudit("chat.exported", {
      userId: auth.userId,
      conversationId: convId,
      messageId,
      format
    });

    if (format === "pdf") {
      if (!isPdfTextSupported(msg.content)) {
        return jsonError(req, "api.exports.pdf_content_not_supported", 409);
      }
      const pdf = createPdfBufferFromText(msg.content);
      try {
        await writeExportAudit();
      } catch (auditError) {
        console.error("[chat export] audit write failed", safeError(auditError));
        return jsonError(req, "api.chat.export_audit_failed", 503);
      }
      return new NextResponse(pdf, {
        status: 200,
        headers: buildDownloadHeaders(`${fileBase}.pdf`, "application/pdf")
      });
    }

    const docx = createChatDocxBuffer(msg.content, "SotsiaalAI summary");
    try {
      await writeExportAudit();
    } catch (auditError) {
      console.error("[chat export] audit write failed", safeError(auditError));
      return jsonError(req, "api.chat.export_audit_failed", 503);
    }
    return new NextResponse(docx, {
      status: 200,
      headers: buildDownloadHeaders(`${fileBase}.docx`, DOCX_MIME_TYPE)
    });
  } catch (err) {
    if (err?.code === "PDF_UNSUPPORTED_TEXT") {
      return jsonError(req, "api.exports.pdf_content_not_supported", 409);
    }
    if (isDbOffline(err)) {
      return jsonError(req, "api.chat.db_unavailable", 503);
    }
    console.error("[chat export GET] failed", safeError(err));
    return jsonError(req, "api.common.server_error", 500);
  }
}
