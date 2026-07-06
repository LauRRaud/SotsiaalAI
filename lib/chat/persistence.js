import { prisma } from "@/lib/prisma";
import { safeError } from "@/lib/privacy/safeError";

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

export async function persistDone({
  convId,
  userId,
  status: _status = "COMPLETED",
  finalText,
  sources = [],
  displayedSources = null,
  ragTrace = null,
  attributionDecisions = null,
  attachments = [],
  cards = [],
  metadataExtra = null,
  isCrisis
}) {
  if (!convId || !userId) return;
  const now = new Date();
  const expiry = conversationExpiryDate();
  try {
    const result = await prisma.$transaction(async tx => {
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
      if (finalText) {
        const resolvedDisplayedSources = Array.isArray(displayedSources) ? displayedSources : sources;
        const displayedSourceIds = Array.isArray(ragTrace?.displayed_source_ids)
          ? ragTrace.displayed_source_ids
          : resolvedDisplayedSources
              .map((source, index) => source?.source_id || source?.sourceId || source?.id || source?.key || source?.url || source?.short_ref || source?.title || `source_${index}`)
              .map(value => String(value || "").trim())
              .filter(Boolean);
        const baseMetadata =
          sources?.length ||
          resolvedDisplayedSources?.length ||
          ragTrace ||
          attributionDecisions?.length ||
          attachments?.length ||
          cards?.length ||
          typeof isCrisis !== "undefined"
            ? {
                sources: sources ?? [],
                displayed_sources: resolvedDisplayedSources ?? [],
                displayed_source_ids: displayedSourceIds,
                ...(ragTrace ? { rag_trace: ragTrace } : {}),
                ...(Array.isArray(attributionDecisions) ? { attribution_decisions: attributionDecisions } : {}),
                attachments: attachments ?? [],
                cards: cards ?? [],
                isCrisis: !!isCrisis
              }
            : null;
        const metadata = baseMetadata || metadataExtra
          ? {
              ...(baseMetadata || {}),
              ...(metadataExtra && typeof metadataExtra === "object" ? metadataExtra : {})
            }
          : null;
        const created = await tx.conversationMessage.create({
          data: {
            conversationId: convId,
            role: "ASSISTANT",
            content: finalText,
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
          summary: finalText ? trimText(finalText) : undefined
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
