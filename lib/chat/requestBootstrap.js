import { NextResponse } from "next/server";

import { requireSubscription, resolveSessionRoleState } from "@/lib/authz";
import { detectCrisis, isGreeting } from "@/lib/chat/safety";
import { pickReplyLang, langStrings } from "@/lib/chat/promptBuilder";
import { buildChatLanguagePlan } from "@/lib/chat/languagePlan";
import { countClarifyingTurns, inferRequestedThoroughness } from "@/lib/chat/orchestrationPolicy";
import { enforceChatRateLimit } from "@/lib/chat-api-rate-limit";
import { CHAT_NO_STORE_HEADERS } from "@/lib/chat/routeServerUtils";
import {
  normalizeEphemeralChunk,
  detectSourcesRequest,
  shouldOfferDocumentDownload,
  normalizeRoomId,
  isPlausibleConversationId
} from "@/lib/chat/requestContext";
import {
  getDocumentWorkflowState,
  isActiveDocumentWorkflowState
} from "@/lib/chat/documentOrchestration";
import { getChatSessionTurnLimit } from "@/lib/chat/guardrails";
import { normalizeClientTurnKey } from "@/lib/chat/turnRegistry";
import { shouldAllowChatWithoutSubscription, isFreeHelpWorkflowEligible } from "@/lib/chat/subscriptionGate";
import { getHelpWorkflowState } from "@/lib/help/chatWorkflow";
import { detectHelpChatIntent } from "@/lib/help/intents";
import { shouldUseHelpWorkflowMode } from "@/lib/chat/workflowModeRouting";
import { isActiveHelpWorkflowState, normalizeHelpWorkflowState } from "@/lib/help/workflowState";
import { shouldBypassPendingWorkflowForSubstantiveQuestion } from "@/lib/chat/modeSelection";
import { evaluateTextPrivacy, privacyConfirmationResponsePayload } from "@/lib/privacy/privacyGuard";
import { normalizeTrustedRagRecovery } from "@/lib/chat/conversationalRecovery";

import { MAX_USER_MESSAGE_CHARS } from "@/lib/chat/messageLimits";

const EXPLICIT_CHAT_MODE_VALUES = new Set(["rag", "document", "help_request", "help_offer"]);

// T03 E3: kasutaja nähtav sõnumipiir (jagatud komposeriga). Üle selle → 413 (enne püsistust
// ja providerikutset). Mudelile ei kärbita teksti kasutaja eest vaikides: lubatud vahemikus
// (<=4000) saab mudel kogu sõnumi; route slice(0, MAX_USER_MESSAGE_CHARS) on ainult turvapiir.
export { MAX_USER_MESSAGE_CHARS };

function toOpenAiMessages(history, options = {}) {
  if (!Array.isArray(history) || history.length === 0) return [];
  const maxItems = Math.max(1, Number(options.maxItems) || 8);
  const maxChars = Math.max(200, Number(options.maxChars) || 800);
  const sourceSummary = (sources) => {
    if (!Array.isArray(sources) || !sources.length) return "";
    const lines = sources.slice(0, 8).map((src, idx) => {
      const label = String(src?.label || src?.title || src?.url || "").trim();
      if (!label) return "";
      const paragraphTitle = String(src?.paragraphTitle || src?.paragraph_title || "").trim();
      const section = paragraphTitle || String(src?.section || "").trim();
      const pages = String(src?.pageRange || "").trim();
      const tail = [section, pages && !/^0+$/.test(pages) ? `lk ${pages}` : ""].filter(Boolean).join(", ");
      return `${idx + 1}. ${tail ? `${label} (${tail})` : label}`;
    }).filter(Boolean);
    if (!lines.length) return "";
    return `\n\nAssistant source metadata for this answer:\n${lines.join("\n")}`;
  };

  return history
    .filter((msg) => msg && (typeof msg.text === "string" || typeof msg.content === "string"))
    .slice(-maxItems)
    .map((msg) => {
      const normalizedRole = String(msg?.role || "").trim().toLowerCase();
      const role = normalizedRole === "ai" || normalizedRole === "assistant"
        ? "assistant"
        : "user";
      const rawContent = typeof msg?.text === "string" ? msg.text : msg?.content;
      const baseContent = String(rawContent || "").slice(0, maxChars);
      return {
        role,
        content: role === "assistant"
          ? `${baseContent}${sourceSummary(msg.sources)}`
          : baseContent
      };
    });
}

async function getServerSessionSafe() {
  const { getServerSession } = await import("next-auth/next");
  let authOptions;
  try {
    ({ authOptions } = await import("@/pages/api/auth/[...nextauth]"));
  } catch {
    try {
      const mod = await import("@/auth");
      authOptions = mod.authConfig || mod.authOptions || mod.default;
    } catch {
      authOptions = undefined;
    }
  }

  try {
    return await getServerSession(authOptions);
  } catch {
    return null;
  }
}

async function getRoomMembership(prisma, userId, roomId) {
  if (!userId || !roomId) return null;
  return prisma.roomMember.findFirst({
    where: {
      roomId,
      userId,
      leftAt: null
    },
    select: {
      billingSource: true,
      sponsorUserId: true
    }
  });
}

async function getPersistedRagRecoveryContext(prisma, conversationId, userId) {
  if (!prisma || !conversationId || !userId) return null;
  const recentMessages = await prisma.conversationMessage.findMany({
    where: {
      conversationId,
      conversation: { userId }
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 2,
    select: {
      id: true,
      role: true,
      content: true,
      metadata: true
    }
  });
  const latestAssistant = recentMessages[0];
  const precedingUser = recentMessages[1];
  if (
    String(latestAssistant?.role || "").toUpperCase() !== "ASSISTANT" ||
    String(precedingUser?.role || "").toUpperCase() !== "USER"
  ) return null;
  const state = normalizeTrustedRagRecovery(latestAssistant?.metadata?.workflow?.ragRecovery);
  if (!state) return null;
  const linkedTurn = await prisma.chatTurn.findFirst({
    where: {
      conversationId,
      userId,
      status: "COMPLETED",
      userMessageId: precedingUser.id,
      assistantMessageId: latestAssistant.id
    },
    select: { id: true, startedAt: true }
  });
  if (!linkedTurn) return null;
  let rootUser = precedingUser;
  let rootTurn = linkedTurn;
  if (state.rootUserMessageId && state.rootUserMessageId !== precedingUser.id) {
    const persistedRootUser = await prisma.conversationMessage.findFirst({
      where: {
        id: state.rootUserMessageId,
        conversationId,
        role: "USER",
        conversation: { userId }
      },
      select: {
        id: true,
        content: true
      }
    });
    if (!persistedRootUser) return null;
    rootTurn = await prisma.chatTurn.findFirst({
      where: {
        conversationId,
        userId,
        status: "COMPLETED",
        userMessageId: persistedRootUser.id
      },
      select: { id: true, startedAt: true }
    });
    if (!rootTurn) return null;
    rootUser = persistedRootUser;
  }
  const chainTurns = await prisma.chatTurn.findMany({
    where: {
      conversationId,
      userId,
      status: "COMPLETED",
      startedAt: {
        gte: rootTurn.startedAt,
        lte: linkedTurn.startedAt
      }
    },
    orderBy: [{ startedAt: "asc" }, { id: "asc" }],
    take: 5,
    select: {
      id: true,
      userMessageId: true,
      assistantMessageId: true
    }
  });
  if (
    !chainTurns.length ||
    chainTurns.length > 4 ||
    chainTurns[0]?.id !== rootTurn.id ||
    chainTurns[chainTurns.length - 1]?.id !== linkedTurn.id ||
    chainTurns.some(turn => !turn.userMessageId || !turn.assistantMessageId)
  ) return null;
  const chainMessageIds = chainTurns.flatMap(turn => [turn.userMessageId, turn.assistantMessageId]);
  const chainMessages = await prisma.conversationMessage.findMany({
    where: {
      id: { in: chainMessageIds },
      conversationId,
      conversation: { userId }
    },
    select: {
      id: true,
      role: true,
      content: true
    }
  });
  const chainMessageMap = new Map(chainMessages.map(message => [message.id, message]));
  const history = [];
  for (const turn of chainTurns) {
    const userMessage = chainMessageMap.get(turn.userMessageId);
    const assistantMessage = chainMessageMap.get(turn.assistantMessageId);
    if (
      String(userMessage?.role || "").toUpperCase() !== "USER" ||
      String(assistantMessage?.role || "").toUpperCase() !== "ASSISTANT"
    ) return null;
    history.push(
      { role: "user", text: String(userMessage.content || "") },
      { role: "ai", text: String(assistantMessage.content || "") }
    );
  }
  if (history[0]?.text !== String(rootUser.content || "")) return null;
  return {
    state,
    assistantMessageId: latestAssistant.id,
    history
  };
}

export async function bootstrapChatRequest({
  req,
  prisma,
  makeError,
  logInfo,
  logEvent,
  limits,
  deps = {}
}) {
  const getServerSession = deps.getServerSessionSafe || getServerSessionSafe;
  const enforceRateLimit = deps.enforceChatRateLimit || enforceChatRateLimit;
  const resolveRoleState = deps.resolveSessionRoleState || resolveSessionRoleState;
  const requireSubscriptionCheck = deps.requireSubscription || requireSubscription;
  const getHelpState = deps.getHelpWorkflowState || getHelpWorkflowState;
  const detectHelpIntent = deps.detectHelpChatIntent || detectHelpChatIntent;
  const allowWithoutSubscription = deps.shouldAllowChatWithoutSubscription || shouldAllowChatWithoutSubscription;
  const getDocState = deps.getDocumentWorkflowState || getDocumentWorkflowState;
  const computeShouldUseHelpWorkflow = deps.shouldUseHelpWorkflowMode || shouldUseHelpWorkflowMode;
  const detectGreeting = deps.isGreeting || isGreeting;
  const detectCrisisSignal = deps.detectCrisis || detectCrisis;
  const chooseReplyLang = deps.pickReplyLang || pickReplyLang;
  const readLangStrings = deps.langStrings || langStrings;
  const countClarifications = deps.countClarifyingTurns || countClarifyingTurns;
  const inferThoroughness = deps.inferRequestedThoroughness || inferRequestedThoroughness;

  const session = await getServerSession();
  const earlyRateLimit = enforceRateLimit(req, {
    scope: "main_post",
    userId: session?.user?.id,
    limit: limits.chatPostRateLimitMax,
    windowMs: limits.chatRateLimitWindowMs
  });
  if (earlyRateLimit) return { response: earlyRateLimit };

  let payload;
  try {
    payload = await req.json();
  } catch {
    return { response: makeError("chat.error.invalid_json") };
  }

  let message = String(payload?.message || "").trim();
  if (!message) return { response: makeError("chat.error.message_required") };
  // T03 E3: jõusta pikkusepiir enne püsistust ja providerikutset (413, mitte vaikne kärbe).
  if (message.length > MAX_USER_MESSAGE_CHARS) {
    return { response: makeError("chat.error.message_too_long", 413) };
  }

  const rawHistory = Array.isArray(payload?.history) ? payload.history : [];
  const wantStream = !!payload?.stream;
  const convIdRaw = payload?.convId && String(payload.convId) || "";
  const convId = convIdRaw.trim() || null;
  const uiLocale = typeof payload?.uiLocale === "string" ? payload.uiLocale : undefined;
  // Aktsepteeri ainult suletud väärtust. Kõik muu on tavaline tekstisisend;
  // suvaline klienditekst ei jõua kunagi süsteemijuhisesse.
  const inputModality = payload?.inputModality === "voice" ? "voice" : "text";
  const roomId = normalizeRoomId(payload?.roomId ?? payload?.room_id);
  const persist = !roomId && !!payload?.persist;
  if (persist && convId && !isPlausibleConversationId(convId)) {
    return { response: makeError("chat.error.invalid_conv_id") };
  }
  /* SOL-CHAT-03: kliendi stabiilne kavatsuse võti. Sama väärtus läheb nii pöörde reale kui ka
     kasutusarvestuse idempotentsusvõtmesse — kaks eri identiteeti sama kavatsuse peal oli osa
     leiust. Vigane või puuduv võti EI ole viga: vana klient töötab edasi, aga ilma kaitseta. */
  const clientTurnKey = normalizeClientTurnKey(payload?.clientTurnKey);
  const requestedChatModeRaw = typeof payload?.chatMode === "string" ? payload.chatMode.trim().toLowerCase() : "";
  const requestedChatMode = !roomId && EXPLICIT_CHAT_MODE_VALUES.has(requestedChatModeRaw) ? requestedChatModeRaw : null;
  const privacyWorkflow = roomId
    ? "room_private"
    : requestedChatMode === "help_request"
      ? "help_request_public"
      : requestedChatMode === "help_offer"
        ? "help_offer_public"
        : requestedChatMode === "document"
          ? "document_generation"
          : "chat_private";
  const privacy = evaluateTextPrivacy(message, {
    workflow: privacyWorkflow,
    privacyDecision: payload?.privacyDecision
  });
  if (privacy.needsPrivacyConfirmation) {
    return {
      response: NextResponse.json(privacyConfirmationResponsePayload(privacy), {
        status: 409,
        headers: CHAT_NO_STORE_HEADERS
      })
    };
  }
  message = privacy.processedText || message;
  const ephemeralChunks = Array.isArray(payload?.ephemeralChunks)
    ? payload.ephemeralChunks
      .filter((s) => typeof s === "string" && s.trim())
      .slice(0, limits.ephemeralChunksMax)
      .map((s) => normalizeEphemeralChunk(s, limits.ephemeralChunkCharsMax))
      .filter(Boolean)
    : [];
  const ephemeralSource = payload?.ephemeralSource && typeof payload.ephemeralSource === "object" ? payload.ephemeralSource : null;
  const combineSources = payload?.combineSources === true;
  const forceSources = payload?.forceSources === true || payload?.includeSources === true || payload?.showSources === true;
  const includeSources = forceSources || detectSourcesRequest(rawHistory, message);
  const wantsDocumentDownload = shouldOfferDocumentDownload(message);
  const userId = session?.user?.id || null;
  const roleState = resolveRoleState(session, req.cookies);
  const normalizedRole = roleState.effectiveRole;
  const trustedRagRecoveryContext = persist && clientTurnKey && userId && convId && !roomId && isPlausibleConversationId(convId)
    ? await getPersistedRagRecoveryContext(prisma, convId, userId)
    : null;
  const trustedRagRecoveryState = trustedRagRecoveryContext?.state || null;
  const trustedRagRecoveryAssistantMessageId = trustedRagRecoveryContext?.assistantMessageId || null;
  const trustedRagRecoveryHistory = trustedRagRecoveryContext?.history || [];
  const history = toOpenAiMessages(
    rawHistory,
    ephemeralChunks.length
      ? {
          maxItems: limits.historyWithDocMaxItems,
          maxChars: limits.historyWithDocMaxChars
        }
      : {
          maxItems: limits.historyMaxItems,
          maxChars: limits.historyMaxChars
      }
  );
  const trustedRagRecoveryModelHistory = toOpenAiMessages(
    trustedRagRecoveryHistory,
    ephemeralChunks.length
      ? {
          maxItems: limits.historyWithDocMaxItems,
          maxChars: limits.historyWithDocMaxChars
        }
      : {
          maxItems: limits.historyMaxItems,
          maxChars: limits.historyMaxChars
        }
  );

  /* SOL-CHAT-07: ligipääsuvärav oli ADMINILE lahti (`!roleState.isAdmin`), aga ruumisõnumite API
     nõuab aktiivset liikmesust KÕIGILT. Kahe erineva reegli tagajärg oli, et platvormiadmin sai
     ruumi ID teadmisel sinna liikmeks astumata ja osalejate nõusolekuta „Assistant" sõnumi
     kirjutada — sündmus läks kohe ka ruumi voogu. Erandit ei ole enam: sama küsimus, sama vastus.
     Kui erakorralist ligipääsu kunagi vaja on, on see eraldi break-glass toiming oma jäljega. */
  if (roomId && userId) {
    const roomMembership = await getRoomMembership(prisma, userId, roomId);
    if (!roomMembership) {
      return { response: makeError("api.common.forbidden", 403) };
    }
  }

  const explicitHelpIntent = !roomId
    ? requestedChatMode === "help_request"
      ? "create_help_request"
      : requestedChatMode === "help_offer"
        ? "create_help_offer"
        : null
    : null;
  const clientHelpWorkflowState = !roomId
    ? normalizeHelpWorkflowState(payload?.helpWorkflowState || null)
    : null;
  const helpWorkflowState = clientHelpWorkflowState || (userId && !roomId
    ? await getHelpState(convId, userId, prisma)
    : null);
  const helpWorkflowActive = isActiveHelpWorkflowState(helpWorkflowState);
  const detectedHelpIntent = !roomId ? detectHelpIntent(message) : null;
  const gate = await requireSubscriptionCheck(session, normalizedRole, {
    allowWithoutSubscription: allowWithoutSubscription({
      roomId,
      requestedChatMode,
      explicitHelpIntent,
      detectedHelpIntent,
      helpWorkflowState,
      helpWorkflowActive
    })
  });
  if (!gate.ok) {
    return {
      response: NextResponse.json({
        ok: false,
        messageKey: gate.message,
        message: gate.message,
        requireSubscription: gate.requireSubscription,
        redirect: gate.redirect
      }, {
        status: gate.status,
        headers: CHAT_NO_STORE_HEADERS
      })
    };
  }

  /* SOL-CHAT-04: SEE kontroll on TEADLIKULT mitteatomaarne varane värav — ta hoiab ilmse ületuse
     enne kallist tööd kinni, aga ta EI OLE piiri jõustaja. Jõustamine käib pöörde nõude sees
     (`claimChatTurn`), kus lugemine ja kirjutamine on sama vestluseluku ja sama tehingu all. Kaks
     kohta on siin põhjendatud, sest nad vastavad eri küsimustele: „kas tasub üldse alustada" ja
     „kes sai viimase koha". */
  const sessionTurnLimit = getChatSessionTurnLimit(normalizedRole);
  if (persist && convId && userId && !roomId) {
    const sessionTurnCount = await prisma.conversationMessage.count({
      where: {
        conversationId: convId,
        role: "USER",
        conversation: {
          userId
        }
      }
    });
    if (sessionTurnCount >= sessionTurnLimit) {
      return {
        response: makeError("api.common.rate_limited", 429, {
          scope: "chat_session_turns",
          limit: sessionTurnLimit,
          used: sessionTurnCount
        })
      };
    }
  }

  const replyLang = chooseReplyLang({
    userMessage: message,
    uiLocale
  });
  const languagePlan = buildChatLanguagePlan({
    message,
    interfaceLanguage: uiLocale,
    history: rawHistory,
    runtimeAnswerLanguage: replyLang
  });
  const greeting = detectGreeting(message);
  const clarifyingTurns = countClarifications(rawHistory);
  const requestedThoroughness = inferThoroughness(message);
  const L = readLangStrings(replyLang, normalizedRole);
  const isCrisis = detectCrisisSignal(message);
  const hasHistory = Array.isArray(rawHistory) && rawHistory.length > 0;
  const effectiveMessage = message;
  const forcedMode = requestedChatMode;
  const effectiveExplicitHelpIntent = explicitHelpIntent;

  if (typeof logInfo === "function") {
    logInfo("request.start", {
      ts: new Date().toISOString(),
      userId,
      role: normalizedRole,
      isCrisis,
      hasHistory,
      hasEphemeral: !!ephemeralChunks.length
    });
  }
  if (typeof logEvent === "function") {
    await logEvent("chat_request", {
      userId,
      role: normalizedRole,
      isCrisis,
      hasHistory,
      hasEphemeralDoc: !!ephemeralChunks.length,
      messageLength: message.length,
      explicitHelpIntent: explicitHelpIntent || undefined,
      clarifyingTurns,
      requestedThoroughness,
      inputModality,
      interfaceLanguage: languagePlan.interfaceLanguage,
      queryLanguage: languagePlan.queryLanguage,
      queryLanguageConfidence: languagePlan.queryLanguageConfidence,
      queryLanguageReason: languagePlan.queryLanguageReason,
      retrievalLanguage: languagePlan.retrievalLanguage,
      answerLanguage: languagePlan.answerLanguage,
      answerLanguageReason: languagePlan.answerLanguageReason,
      recommendedAnswerLanguage: languagePlan.recommendedAnswerLanguage,
      recommendedAnswerLanguageReason: languagePlan.recommendedAnswerLanguageReason,
      runtimeReplyLanguage: languagePlan.runtimeReplyLanguage,
      runtimeReplyLanguageReason: languagePlan.runtimeReplyLanguageReason,
      languageShadowMode: languagePlan.shadowMode,
      canonicalQueryAvailable: languagePlan.canonicalQueryAvailable,
      canonicalIntent: languagePlan.canonicalIntent,
      preservedEntityTypes: languagePlan.preservedEntityTypes,
      preservedEntityCount: languagePlan.preservedEntityCount,
      transliterationUsed: languagePlan.transliterationUsed,
      convId
    });
  }

  const documentWorkflowState = userId && !roomId
    ? await getDocState(convId, userId, prisma)
    : null;
  const documentWorkflowActive = isActiveDocumentWorkflowState(documentWorkflowState);
  const explicitHelpModeActive = forcedMode === "help_request" || forcedMode === "help_offer";
  const helpForcedIntent = effectiveExplicitHelpIntent && !helpWorkflowState
    ? effectiveExplicitHelpIntent
    : null;
  const inactiveHelpStateCanResume = Boolean(
    helpWorkflowState
    && !helpWorkflowActive
    && detectedHelpIntent
    && detectedHelpIntent !== "service_guidance"
  );
  const pendingWorkflowBypassed = Boolean(
    !forcedMode &&
    (documentWorkflowActive || helpWorkflowActive) &&
    shouldBypassPendingWorkflowForSubstantiveQuestion(message)
  );
  const pendingWorkflowBypassReason = pendingWorkflowBypassed ? "substantive_question" : null;
  const shouldUseDocumentWorkflow = Boolean(
    userId &&
    !roomId &&
    !pendingWorkflowBypassed &&
    (forcedMode === "document" || (!forcedMode && documentWorkflowActive))
  );
  // T03 E3: sama jagatud predikaat, mida kasutab tellimusevärav — OR-itakse marsruutijasse,
  // et iga tasuta-abi päring läheks abivahenduse töövoogu, mitte tavavestluse mudelikutsesse.
  const freeHelpEligible = isFreeHelpWorkflowEligible({
    roomId,
    forcedMode,
    explicitHelpIntent,
    detectedHelpIntent,
    helpWorkflowState,
    helpWorkflowActive
  });
  const shouldUseHelpWorkflow = pendingWorkflowBypassed
    ? false
    : computeShouldUseHelpWorkflow({
        userId,
        roomId,
        forcedMode,
        explicitHelpModeActive,
        helpWorkflowActive,
        inactiveHelpStateCanResume,
        freeHelpEligible
      });

  if (pendingWorkflowBypassed && typeof logInfo === "function") {
    logInfo("workflow.pending_bypassed", {
      reason: pendingWorkflowBypassReason,
      documentWorkflowActive,
      helpWorkflowActive,
      routedToChatRagDueToSubstantiveQuestion: true
    });
  }

  return {
    response: null,
    data: {
      payload,
      session,
      rawHistory,
      wantStream,
      persist,
      convId,
      inputModality,
      roomId,
      requestedChatMode,
      ephemeralChunks,
      ephemeralSource,
      combineSources,
      forceSources,
      includeSources,
      wantsDocumentDownload,
      userId,
      normalizedRole,
      history,
      trustedRagRecoveryState,
      trustedRagRecoveryAssistantMessageId,
      trustedRagRecoveryHistory,
      trustedRagRecoveryModelHistory,
      helpWorkflowState,
      detectedHelpIntent,
      replyLang,
      languagePlan,
      greeting,
      clarifyingTurns,
      requestedThoroughness,
      L,
      isCrisis,
      hasHistory,
      effectiveMessage,
      forcedMode,
      effectiveExplicitHelpIntent,
      documentWorkflowState,
      helpForcedIntent,
      pendingWorkflowBypassed,
      pendingWorkflowBypassReason,
      routedToChatRagDueToSubstantiveQuestion: pendingWorkflowBypassed,
      shouldUseDocumentWorkflow,
      shouldUseHelpWorkflow,
      clientTurnKey,
      sessionTurnLimit
    }
  };
}
