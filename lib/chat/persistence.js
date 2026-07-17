import { prisma } from "@/lib/prisma";
import { safeError } from "@/lib/privacy/safeError";
import { langStrings } from "@/lib/chat/promptBuilder";
import { normalizeCompletionStatus } from "@/lib/chat/turnStatus";

function readPositiveNumber(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return numeric;
}

const CONVERSATION_TTL_DAYS = readPositiveNumber(process.env.CONVERSATION_TTL_DAYS, 90);
const CONVERSATION_TTL_MS = Math.max(1, CONVERSATION_TTL_DAYS) * 24 * 60 * 60 * 1000;
const SUMMARY_MAX = 2000;
const TITLE_MAX = 160;

function conversationExpiryDate() {
  return new Date(Date.now() + CONVERSATION_TTL_MS);
}

function trimText(text = "", max = SUMMARY_MAX) {
  if (!text) return "";
  const normalized = String(text).trim();
  if (!normalized) return "";
  if (normalized.length <= max) return normalized;
  const limit = Math.max(0, max - 3);
  return `${normalized.slice(0, limit)}...`;
}

function autoTitle(text = "") {
  const normalized = trimText(text, TITLE_MAX);
  if (!normalized) return null;
  const sentenceMatch = normalized.match(/^(.{10,160}?[.!?])\s/);
  if (sentenceMatch) return sentenceMatch[1].trim();
  return normalized;
}

export async function persistInit({
  convId,
  userId,
  role,
  userMessage
}) {
  if (!convId || !userId || !userMessage) return;
  const now = new Date();
  const expiry = conversationExpiryDate();
  const titleDraft = autoTitle(userMessage);
  try {
    let conversation = await prisma.conversation.findUnique({
      where: {
        id: convId
      },
      select: {
        id: true,
        userId: true,
        title: true,
        archivedAt: true
      }
    });
    if (conversation && conversation.userId !== userId) return;
    if (conversation?.archivedAt) return;
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          id: convId,
          userId,
          role,
          title: titleDraft,
          summary: trimText(userMessage),
          lastActivityAt: now,
          expiresAt: expiry
        },
        select: {
          id: true,
          title: true
        }
      });
    } else {
      await prisma.conversation.update({
        where: {
          id: convId
        },
        data: {
          role
        }
      });
    }
    const needsTitle = !conversation.title && titleDraft;
    await prisma.$transaction([
      prisma.conversationMessage.create({
        data: {
          conversationId: convId,
          authorId: userId,
          role: "USER",
          content: userMessage
        }
      }),
      prisma.conversation.update({
        where: {
          id: convId
        },
        data: {
          lastActivityAt: now,
          expiresAt: expiry,
          summary: trimText(userMessage),
          ...(needsTitle ? { title: titleDraft } : {})
        }
      })
    ]);
  } catch (err) {
    console.error("[chat] persistInit failed", {
      convId,
      err: safeError(err)
    });
  }
}

export async function persistAppend({
  convId,
  userId,
  fullText
}) {
  if (!convId || !userId || !fullText) return;
  try {
    await prisma.conversation.updateMany({
      where: {
        id: convId,
        userId
      },
      data: {
        summary: trimText(fullText)
      }
    });
  } catch (err) {
    console.error("[chat] persistAppend failed", {
      convId,
      err: safeError(err)
    });
  }
}

// Aus pöörde-elutsükkel (T03 E2): iga lõppseis (COMPLETED/ERROR/ABORTED) kirjutab
// assistendipöörde markeri koos `metadata.completionStatus`-ega, et hüdreerimine ja
// /api/chat/run eristaks lõppseise ega tuletaks aktiivsust „viimane sõnum oli kasutajalt"
// heuristikast. ABORTED puhul salvestatakse ainult juba kuvatud osaline tekst; ERROR/ABORTED
// tühjuse puhul luuakse sisuta marker (klient tõlgib sildi API-võtmena, mitte serveritekstina).
export async function persistDone({
  convId,
  userId,
  status = "COMPLETED",
  completionStatus = null,
  retryOf = null,
  finalText,
  sources = [],
  displayedSources = null,
  ragTrace = null,
  attributionDecisions = null,
  attachments = [],
  cards = [],
  metadataExtra = null,
  isCrisis,
  replyLang = "et"
}, deps = {}) {
  if (!convId || !userId) return;
  const db = deps.prisma || prisma;
  const resolvedStatus = normalizeCompletionStatus(completionStatus || status, "COMPLETED");
  const isTerminalNonCompleted = resolvedStatus === "ERROR" || resolvedStatus === "ABORTED";
  // Kriisi fallback jääb nähtavaks ka tühja katkestuse/vea korral (E1), v.a puhas ERROR ilma tekstita
  // ei asenda kriisitekstiga vaikselt — kriisibänner tuleb determinstlikust UI-kihist.
  const persistedFinalText = isCrisis && !String(finalText ?? "").trim()
    ? langStrings(replyLang).crisisNoCtx
    : (finalText ?? "");
  const shouldCreateMessage = !!String(persistedFinalText).trim() || isTerminalNonCompleted;
  const now = new Date();
  const expiry = conversationExpiryDate();
  try {
    const result = await db.$transaction(async tx => {
      const conversation = await tx.conversation.findUnique({
        where: {
          id: convId
        },
        select: {
          userId: true
        }
      });
      if (!conversation || conversation.userId !== userId) return;
      let assistantMessageId = null;
      if (shouldCreateMessage) {
        const resolvedDisplayedSources = Array.isArray(displayedSources) ? displayedSources : sources;
        const displayedSourceIds = Array.isArray(ragTrace?.displayed_source_ids)
          ? ragTrace.displayed_source_ids
          : resolvedDisplayedSources
              .map((source, index) => source?.source_id || source?.sourceId || source?.id || source?.key || source?.url || source?.short_ref || source?.title || `source_${index}`)
              .map(value => String(value || "").trim())
              .filter(Boolean);
        const baseMetadata = {
          sources: sources ?? [],
          displayed_sources: resolvedDisplayedSources ?? [],
          displayed_source_ids: displayedSourceIds,
          ...(ragTrace ? { rag_trace: ragTrace } : {}),
          ...(Array.isArray(attributionDecisions) ? { attribution_decisions: attributionDecisions } : {}),
          attachments: attachments ?? [],
          cards: cards ?? [],
          isCrisis: !!isCrisis
        };
        const metadata = {
          ...baseMetadata,
          ...(metadataExtra && typeof metadataExtra === "object" ? metadataExtra : {}),
          completionStatus: resolvedStatus,
          ...(retryOf ? { retryOf: String(retryOf) } : {})
        };
        const created = await tx.conversationMessage.create({
          data: {
            conversationId: convId,
            role: "ASSISTANT",
            content: persistedFinalText,
            metadata
          }
        });
        assistantMessageId = created?.id || null;
      }
      await tx.conversation.update({
        where: {
          id: convId
        },
        data: {
          lastActivityAt: now,
          expiresAt: expiry,
          summary: String(persistedFinalText).trim() ? trimText(persistedFinalText) : undefined
        }
      });
      return { assistantMessageId };
    });
    return result || null;
  } catch (err) {
    console.error("[chat] persistDone failed", {
      convId,
      err: safeError(err)
    });
    return null;
  }
}
