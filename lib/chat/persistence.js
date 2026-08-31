import { prisma } from "@/lib/prisma";
import { safeError } from "@/lib/privacy/safeError";
import { langStrings } from "@/lib/chat/promptBuilder";
import { normalizeCompletionStatus } from "@/lib/chat/turnStatus";
import { closeChatTurn, lockConversationTurn } from "@/lib/chat/turnRegistry";
import { buildRagDiagnostics } from "@/lib/chat/ragDiagnostics";
import { assertRagAttemptOwner, finishRagAttempt, staleAttemptError } from "./ragAttemptStore.js";

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

/* SOL-CHAT-01: püsistuse ebaõnnestumise põhjused. Tagastusleping jääb samaks (`null` = midagi
   püsivat ei tekkinud, vt `persistDone`), aga kutsuja, keda põhjus huvitab, saab ta
   `deps.onFailure` kaudu kätte, ilma et `lib/research/pipeline.js` `!persisted` kontroll murduks. */
export const PERSIST_FAILURE = Object.freeze({
  CONVERSATION_MISSING: "conversation_missing",
  OWNER_MISMATCH: "owner_mismatch",
  ARCHIVED: "archived",
  WRITE_FAILED: "write_failed",
  USAGE_SETTLEMENT_FAILED: "usage_settlement_failed"
});

function reportFailure(deps, reason, error = null) {
  const report = deps?.onFailure;
  if (typeof report !== "function") return;
  try {
    report(reason, error);
  } catch {}
}

/**
 * Vestluse ja kasutaja küsimuse kirjutamine ÜHE tehingu sees.
 *
 * SOL-CHAT-04: sessioonipiiri lugemine ja selle kirjutuse tegemine peavad olema sama tehingu ja
 * sama luku all — muidu mahuvad kaks paralleelset pööret mõlemad viimasesse vabasse kohta. Seepärast
 * võtab see funktsioon `tx`-i väljastpoolt ja `persistInit()` on ainult tema üksikkasutuse ümbris.
 * Kaks koopiat sellest loogikast oleks kaks tõde; siin on üks.
 *
 * @returns `{ ok: true, userMessageId }` või `{ ok: false, reason }`
 */
export async function writeUserTurn(tx, { conversationId, userId, role, userMessage, now = new Date() }) {
  const expiry = conversationExpiryDate();
  const titleDraft = autoTitle(userMessage);
  let conversation = await tx.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, userId: true, title: true, archivedAt: true }
  });
  if (conversation && conversation.userId !== userId) {
    return { ok: false, reason: PERSIST_FAILURE.OWNER_MISMATCH };
  }
  if (conversation?.archivedAt) {
    return { ok: false, reason: PERSIST_FAILURE.ARCHIVED };
  }
  /* Vestlus luuakse enne pöörde saatmist `/api/chat/conversations` kaudu. Siin puuduvat
     kliendi ID-d vaikimisi luues erines tulemus võõrast olemasolevast ID-st (edu vs 409) ning
     muutis `/api/chat` vestluse olemasolu oraakliks. Puuduv ja võõras ID peavad pöörde rajal
     lõppema sama avaliku `CONVERSATION_UNAVAILABLE` tulemusega. */
  if (!conversation) {
    return { ok: false, reason: PERSIST_FAILURE.CONVERSATION_MISSING };
  }
  await tx.conversation.update({
    where: { id: conversationId },
    data: { role }
  });
  const needsTitle = !conversation.title && titleDraft;
  const created = await tx.conversationMessage.create({
    data: {
      conversationId,
      authorId: userId,
      role: "USER",
      content: userMessage
    }
  });
  await tx.conversation.update({
    where: { id: conversationId },
    data: {
      lastActivityAt: now,
      expiresAt: expiry,
      summary: trimText(userMessage),
      ...(needsTitle ? { title: titleDraft } : {})
    }
  });
  return { ok: true, userMessageId: created?.id || null };
}

export async function persistInit({
  convId,
  userId,
  role,
  userMessage
}, deps = {}) {
  if (!convId || !userId || !userMessage) return true;
  const db = deps.prisma || prisma;
  const now = new Date();
  try {
    const result = await db.$transaction(async tx => {
      await lockConversationTurn(tx, convId);
      return writeUserTurn(tx, {
      conversationId: convId,
      userId,
      role,
      userMessage,
      now
      });
    });
    if (!result?.ok) {
      reportFailure(deps, result?.reason || PERSIST_FAILURE.WRITE_FAILED);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[chat] persistInit failed", {
      convId,
      err: safeError(err)
    });
    reportFailure(deps, PERSIST_FAILURE.WRITE_FAILED, err);
    return false;
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
import { sameSourceSelectionBinding, normalizeSourceSelection } from "./sourceSelection.js";

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
  replyLang = "et",
  /* SOL-RES-04/-05: ühe töö ühe katse tunnus. Kui ta on antud, siis ei looda sama tunnusega teist
     sõnumit — kaks workerit või kaks korduskatset ei kirjuta vestlusse kahte raportit. */
  persistKey = null,
  /* SOL-CHAT-01/-02: pöörde ARVELDUS, mis peab kuuluma SAMASSE tehingusse terminalmarkeriga.
     `async tx => …` — kas kasutuse commit (COMPLETED) või release (ERROR/ABORTED). Kui ta viskab,
     kukub kogu tehing: ei jää arvestatud ühikut ilma vestlusse jõudnud vastuseta ega vastust ilma
     arvelduseta. `paidResult.js` teine piir („commit'i viga ei vabasta") ei kehti siin, sest
     püsiv tulemus ja tasu on üks samm — rollback viib mõlemad korraga tagasi. */
  settleUsage = null,
  /* SOL-CHAT-03/-04: pöörde serveripoolne rida. Terminalseis pannakse paika SAMAS tehingus —
     „vestluses on vastus, aga pööre on igavesti RUNNING" ei ole seisund, mida saaks tekkida. */
  turnId = null,
  attemptNumber = null,
  ragAttempt = null,
  sourceSelectionBinding = null
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
      await lockConversationTurn(tx, convId);
      const ownedAttempt = await assertRagAttemptOwner(tx, ragAttempt, now);
      if (!sameSourceSelectionBinding(ownedAttempt?.evidence?.source_selection_binding, sourceSelectionBinding)) throw staleAttemptError();
      if (sourceSelectionBinding || normalizeSourceSelection(metadataExtra?.workflow?.ragRecovery?.sourceSelection)) {
        const latest = await tx.conversationMessage.findFirst({
          where: { conversationId: convId, conversation: { userId } },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, role: true }
        });
        if (!ownedAttempt?.userMessageId || latest?.id !== ownedAttempt.userMessageId || latest.role !== "USER") throw staleAttemptError();
      }
      if (ragAttempt && (ragAttempt.chatTurnId !== turnId || ragAttempt.conversationId !== convId || ragAttempt.userId !== userId)) throw staleAttemptError();
      const conversation = await tx.conversation.findUnique({
        where: {
          id: convId
        },
        select: {
          userId: true
        }
      });
      if (!conversation || conversation.userId !== userId) {
        reportFailure(
          deps,
          conversation ? PERSIST_FAILURE.OWNER_MISMATCH : PERSIST_FAILURE.CONVERSATION_MISSING
        );
        return;
      }

      const idempotencyKey = String(persistKey || "").trim();
      if (idempotencyKey) {
        const existing = await tx.conversationMessage.findFirst({
          where: {
            conversationId: convId,
            role: "ASSISTANT",
            metadata: { path: ["persistKey"], equals: idempotencyKey }
          },
          select: { id: true }
        });
        if (existing) {
          // Sama pöörde teine katse: sõnum on juba olemas, aga arveldus võis eelmisel korral
          // jääda tegemata. Arveldus ise on idempotentne, seega teda korratakse siin.
          if (typeof settleUsage === "function") await settleUsage(tx);
          await finishRagAttempt(tx, ragAttempt, { status: resolvedStatus, assistantMessageId: existing.id, trace: ragTrace, now });
          const closed = await closeChatTurn(tx, {
            turnId,
            attemptNumber,
            status: resolvedStatus,
            assistantMessageId: existing.id,
            now
          });
          if (ragAttempt && !closed) throw staleAttemptError();
          return { assistantMessageId: existing.id, reused: true };
        }
      }

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
          ...(retryOf ? { retryOf: String(retryOf) } : {}),
          ...(String(persistKey || "").trim() ? { persistKey: String(persistKey).trim() } : {})
        };
        const diagnosticTurn = ownedAttempt || (turnId ? await tx.chatTurn.findUnique({
          where: { id: turnId },
          select: { userMessageId: true, attempt: true }
        }) : null);
        metadata.rag_diagnostics = buildRagDiagnostics({
          trace: metadata.rag_trace,
          turnId,
          userMessageId: diagnosticTurn?.userMessageId,
          attempt: diagnosticTurn?.attempt,
          completionStatus: resolvedStatus,
          runtime: metadata.rag_trace?.diagnostic_runtime
        });
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
      if (typeof settleUsage === "function") await settleUsage(tx);
      await finishRagAttempt(tx, ragAttempt, { status: resolvedStatus, assistantMessageId, trace: ragTrace, now });
      const closed = await closeChatTurn(tx, {
        turnId,
        attemptNumber,
        status: resolvedStatus,
        assistantMessageId,
        now
      });
      if (ragAttempt && !closed) throw staleAttemptError();
      return { assistantMessageId, reused: false };
    });
    return result || null;
  } catch (err) {
    console.error("[chat] persistDone failed", {
      convId,
      err: safeError(err)
    });
    reportFailure(
      deps,
      err?.usageSettlementFailure === true
        ? PERSIST_FAILURE.USAGE_SETTLEMENT_FAILED
        : PERSIST_FAILURE.WRITE_FAILED,
      err
    );
    return null;
  }
}
