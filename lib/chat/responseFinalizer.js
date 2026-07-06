import { NextResponse } from "next/server";

import { persistInit, persistAppend, persistDone } from "@/lib/chat/persistence";
import { CHAT_NO_STORE_HEADERS } from "@/lib/chat/routeServerUtils";
import { prisma } from "@/lib/prisma";
import { safeError } from "@/lib/privacy/safeError";

function inferDocumentFormats(message = "") {
  const lower = String(message || "").toLowerCase();
  const wantsPdf = /\bpdf\b/.test(lower);
  const wantsWord = /\bdocx?\b/.test(lower) || /\bms\s*word\b/.test(lower) || /\bwordi?\b/.test(lower);
  if (wantsPdf && wantsWord) return ["pdf", "word"];
  if (wantsWord) return ["word"];
  return ["pdf"];
}

async function mergeAssistantMessageMetadata(assistantMessageId, metadataPatch) {
  if (!assistantMessageId || !metadataPatch || typeof metadataPatch !== "object") return;
  try {
    const existing = await prisma.conversationMessage.findUnique({
      where: {
        id: assistantMessageId
      },
      select: {
        metadata: true
      }
    });
    const baseMeta = existing?.metadata && typeof existing.metadata === "object" ? existing.metadata : {};
    await prisma.conversationMessage.update({
      where: {
        id: assistantMessageId
      },
      data: {
        metadata: {
          ...baseMeta,
          ...metadataPatch
        }
      }
    });
  } catch (err) {
    try {
      console.error("[chat] persist.attachments.failed", {
        assistantMessageId,
        err: safeError(err)
      });
    } catch {}
  }
}

async function persistDownloadAttachments(assistantMessageId, attachments) {
  if (!Array.isArray(attachments) || !attachments.length) return;
  await mergeAssistantMessageMetadata(assistantMessageId, { attachments });
}

function buildDownloadAttachments({
  convId,
  assistantMessageId,
  message,
  replyLang
}) {
  if (!convId || !assistantMessageId) return [];
  const labels =
    replyLang === "et"
      ? {
          pdf: "Laadi PDF alla",
          word: "Laadi Word alla"
        }
      : replyLang === "ru"
        ? {
            pdf: "Скачать PDF",
            word: "Скачать Word"
          }
        : {
            pdf: "Download PDF",
            word: "Download Word"
          };
  const formats = inferDocumentFormats(message);
  return formats.map((format) => {
    const ext = format === "word" ? "doc" : "pdf";
    const fileName = `sotsiaalai-summary.${ext}`;
    const qs = new URLSearchParams({
      convId: String(convId),
      messageId: String(assistantMessageId),
      format,
      fileName
    });
    return {
      label: labels[format] || labels.pdf,
      fileName,
      format,
      url: `/api/chat/export?${qs.toString()}`
    };
  });
}

export function buildImmediateChatResponse({
  wantStream = false,
  reply = "",
  sources = [],
  displayedSources = null,
  ragTrace = null,
  ragContract = null,
  attributionDecisions = null,
  attachments = [],
  cards = [],
  workflow = null,
  isCrisis = false,
  convId = null
}) {
  const resolvedDisplayedSources = Array.isArray(displayedSources) ? displayedSources : sources;
  if (!wantStream) {
    return NextResponse.json({
      ok: true,
      reply,
      answer: reply,
      sources,
      displayed_sources: resolvedDisplayedSources,
      ...(ragContract && typeof ragContract === "object" ? ragContract : {}),
      ...(ragTrace ? { rag_trace: ragTrace } : {}),
      ...(Array.isArray(attributionDecisions) ? { attribution_decisions: attributionDecisions } : {}),
      attachments,
      cards,
      workflow,
      isCrisis,
      convId: convId || undefined
    }, {
      headers: CHAT_NO_STORE_HEADERS
    });
  }
  const enc = new TextEncoder();
  const sse = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(enc.encode(`event: meta\ndata: ${JSON.stringify({
          sources,
          displayed_sources: resolvedDisplayedSources,
          ...(ragContract && typeof ragContract === "object" ? ragContract : {}),
          ...(ragTrace ? { rag_trace: ragTrace } : {}),
          ...(Array.isArray(attributionDecisions) ? { attribution_decisions: attributionDecisions } : {}),
          workflow,
          isCrisis
        })}\n\n`));
        controller.enqueue(enc.encode(`event: delta\ndata: ${JSON.stringify({
          t: reply
        })}\n\n`));
        controller.enqueue(enc.encode(`event: done\ndata: ${JSON.stringify({
          attachments,
          cards,
          workflow,
          sources,
          displayed_sources: resolvedDisplayedSources,
          ...(ragContract && typeof ragContract === "object" ? ragContract : {}),
          ...(ragTrace ? { rag_trace: ragTrace } : {}),
          ...(Array.isArray(attributionDecisions) ? { attribution_decisions: attributionDecisions } : {})
        })}\n\n`));
      } finally {
        try {
          controller.close();
        } catch {}
      }
    }
  });
  return new Response(sse, {
    headers: {
      ...CHAT_NO_STORE_HEADERS,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}

export async function finalizeAssistantReply({
  persist = false,
  persistInitialized = false,
  convId = null,
  userId = null,
  role = "CLIENT",
  userMessage = "",
  reply = "",
  sources = [],
  displayedSources = null,
  ragTrace = null,
  attributionDecisions = null,
  attachments = [],
  cards = [],
  metadataExtra = null,
  isCrisis = false,
  wantsDocumentDownload = false,
  replyLang = "et",
  messageForDownload = "",
  roomId = null,
  saveRoomMessage = null
}) {
  let finalAttachments = Array.isArray(attachments) ? attachments : [];
  if (persist && convId && userId) {
    if (!persistInitialized) {
      await persistInit({
        convId,
        userId,
        role,
        userMessage
      });
    }
    await persistAppend({
      convId,
      userId,
      fullText: reply
    });
    const persistResult = await persistDone({
      convId,
      userId,
      status: "COMPLETED",
      finalText: reply,
      sources,
      displayedSources,
      ragTrace,
      attributionDecisions,
      attachments: finalAttachments,
      cards,
      metadataExtra,
      isCrisis
    });
    if (wantsDocumentDownload) {
      const downloadAttachments = buildDownloadAttachments({
        convId,
        assistantMessageId: persistResult?.assistantMessageId,
        message: messageForDownload,
        replyLang
      });
      if (downloadAttachments.length) {
        finalAttachments = [...finalAttachments, ...downloadAttachments];
        await persistDownloadAttachments(persistResult?.assistantMessageId, finalAttachments);
      }
    }
  }
  if (roomId && userId && typeof saveRoomMessage === "function") {
    await saveRoomMessage({
      roomId,
      userId,
      content: reply
    });
  }
  return {
    attachments: finalAttachments
  };
}
