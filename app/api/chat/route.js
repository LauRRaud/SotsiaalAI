import { performance } from "node:perf_hooks";

import { NextResponse } from "next/server";
import { bootstrapChatRequest, MAX_USER_MESSAGE_CHARS } from "@/lib/chat/requestBootstrap";
import { CHAT_NO_STORE_HEADERS } from "@/lib/chat/routeServerUtils";
import { prisma } from "@/lib/prisma";
import {
  chooseOrchestrationPlan,
  WORK_MODES
} from "@/lib/chat/orchestrationPolicy";
import { logEvent } from "@/lib/chat/logger";
import { enforceChatRateLimit, readChatRateLimit } from "@/lib/chat-api-rate-limit";
import { assembleRetrievalContext } from "@/lib/chat/retrievalContextAssembler";
import { shouldUseAnswerHistory } from "@/lib/chat/retrievalOrchestrator";
import {
  buildRecoveryBoundMessage,
  isRagRecoveryContinuation
} from "@/lib/chat/conversationalRecovery";
import { buildReplayResponse, handleMainChatResponse } from "@/lib/chat/mainResponseHandler";
import { langStrings } from "@/lib/chat/promptBuilder";
import { readCompletedChatTurnReplay } from "@/lib/chat/turnRegistry";
import { buildImmediateChatResponse, finalizeAssistantReply } from "@/lib/chat/responseFinalizer";
import { handleDocumentWorkflowBranch, handleHelpWorkflowBranch } from "@/lib/chat/workflowBranchHandlers";
import { hasDocumentTaskContext } from "@/lib/chat/documentOrchestration";
import {
  makeChatError,
  logChatInfo,
  logChatError,
  buildChatOrchestrationMetadata,
  buildSourceLookupSystemInstruction,
  buildMissingMunicipalitySystemInstruction,
  buildVoiceInputSystemInstruction,
  saveAssistantRoomMessage
} from "@/lib/chat/mainRouteRuntime";
import {
  commitUsageForRequest,
  releaseUsageForRequest,
  reserveUsageForRequest,
  usageErrorDescriptor
} from "@/lib/usage/routeAdapter";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
const CHAT_RATE_LIMIT_WINDOW_MS = readChatRateLimit(process.env.CHAT_RATE_LIMIT_WINDOW_MS, 60_000, 1000);
const CHAT_POST_RATE_LIMIT_MAX = readChatRateLimit(process.env.CHAT_RATE_LIMIT_CHAT_POST_MAX, 24);
const CHAT_GET_RATE_LIMIT_MAX = readChatRateLimit(process.env.CHAT_RATE_LIMIT_CHAT_GET_MAX, 120);
const CHAT_HISTORY_MAX_ITEMS = readChatRateLimit(process.env.CHAT_HISTORY_MAX_ITEMS, 8, 1);
const CHAT_HISTORY_MAX_CHARS = readChatRateLimit(process.env.CHAT_HISTORY_MAX_CHARS, 800, 200);
const CHAT_HISTORY_WITH_DOC_MAX_ITEMS = readChatRateLimit(process.env.CHAT_HISTORY_WITH_DOC_MAX_ITEMS, 8, 1);
const CHAT_HISTORY_WITH_DOC_MAX_CHARS = readChatRateLimit(process.env.CHAT_HISTORY_WITH_DOC_MAX_CHARS, 800, 200);
const CHAT_EPHEMERAL_CHUNKS_MAX = readChatRateLimit(process.env.CHAT_EPHEMERAL_CHUNKS_MAX, 80, 1);
const CHAT_EPHEMERAL_CHUNK_CHARS_MAX = readChatRateLimit(process.env.CHAT_EPHEMERAL_CHUNK_CHARS_MAX, 1800, 200);
const CHAT_DOC_CONTEXT_CLIENT_CHARS = readChatRateLimit(process.env.CHAT_DOC_CONTEXT_CLIENT_CHARS, 1800, 300);
const CHAT_DOC_CONTEXT_CLIENT_COMBINED_CHARS = readChatRateLimit(process.env.CHAT_DOC_CONTEXT_CLIENT_COMBINED_CHARS, 1200, 300);
const CHAT_DOC_CONTEXT_WORKER_CHARS = readChatRateLimit(process.env.CHAT_DOC_CONTEXT_WORKER_CHARS, 2600, 300);
const CHAT_DOC_CONTEXT_WORKER_COMBINED_CHARS = readChatRateLimit(process.env.CHAT_DOC_CONTEXT_WORKER_COMBINED_CHARS, 1600, 300);
const CHAT_DOC_CONTEXT_CLIENT_MAX_CHUNKS = readChatRateLimit(process.env.CHAT_DOC_CONTEXT_CLIENT_MAX_CHUNKS, 4, 1);
const CHAT_DOC_CONTEXT_WORKER_MAX_CHUNKS = readChatRateLimit(process.env.CHAT_DOC_CONTEXT_WORKER_MAX_CHUNKS, 6, 1);

function usageErrorResponse(error, scope) {
  const descriptor = usageErrorDescriptor(error, scope);
  return NextResponse.json(descriptor.body, {
    status: descriptor.status,
    headers: {
      ...CHAT_NO_STORE_HEADERS,
      ...descriptor.headers
    }
  });
}

async function releaseUsageSafely(handle, reason, releaseUsage = releaseUsageForRequest, logError = logChatError) {
  /* `reused` tähendab, et reservatsiooni omab sama võtme esimene aktiivne
     päring. Korduse viga ei tohi algse päringu kvooti alt vabastada. */
  if (!handle || handle.reused === true) return;
  try {
    await releaseUsage(handle, { reason });
  } catch (error) {
    logError("usage.release.error", {
      metric: handle.metric,
      reason,
      error: error?.message || String(error)
    });
  }
}

export async function POST(req, deps = {}) {
  const requestStartedAtMs = performance.now();
  const routeRuntime = {
    bootstrapChatRequest: deps.bootstrapChatRequest || bootstrapChatRequest,
    handleDocumentWorkflowBranch: deps.handleDocumentWorkflowBranch || handleDocumentWorkflowBranch,
    handleHelpWorkflowBranch: deps.handleHelpWorkflowBranch || handleHelpWorkflowBranch,
    reserveUsageForRequest: deps.reserveUsageForRequest || reserveUsageForRequest,
    commitUsageForRequest: deps.commitUsageForRequest || commitUsageForRequest,
    releaseUsageForRequest: deps.releaseUsageForRequest || releaseUsageForRequest,
    assembleRetrievalContext: deps.assembleRetrievalContext || assembleRetrievalContext,
    handleMainChatResponse: deps.handleMainChatResponse || handleMainChatResponse,
    readCompletedChatTurnReplay: deps.readCompletedChatTurnReplay || readCompletedChatTurnReplay,
    logEvent: deps.logEvent || logEvent
  };

  const bootstrapResult = await routeRuntime.bootstrapChatRequest({
    req,
    prisma,
    makeError: makeChatError,
    logInfo: logChatInfo,
    logEvent: routeRuntime.logEvent,
    limits: {
      chatPostRateLimitMax: CHAT_POST_RATE_LIMIT_MAX,
      chatRateLimitWindowMs: CHAT_RATE_LIMIT_WINDOW_MS,
      historyMaxItems: CHAT_HISTORY_MAX_ITEMS,
      historyMaxChars: CHAT_HISTORY_MAX_CHARS,
      historyWithDocMaxItems: CHAT_HISTORY_WITH_DOC_MAX_ITEMS,
      historyWithDocMaxChars: CHAT_HISTORY_WITH_DOC_MAX_CHARS,
      ephemeralChunksMax: CHAT_EPHEMERAL_CHUNKS_MAX,
      ephemeralChunkCharsMax: CHAT_EPHEMERAL_CHUNK_CHARS_MAX
    }
  });
  if (bootstrapResult.response) return bootstrapResult.response;

  const {
    payload,
    rawHistory,
    wantStream,
    persist,
    convId,
    roomId,
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
    replyLang,
    languagePlan,
    greeting,
    clarifyingTurns,
    requestedThoroughness,
    inputModality,
    L,
    isCrisis,
    hasHistory,
    effectiveMessage,
    forcedMode,
    effectiveExplicitHelpIntent,
    documentWorkflowState,
    helpForcedIntent,
    shouldUseDocumentWorkflow,
    shouldUseHelpWorkflow,
    clientTurnKey,
    sessionTurnLimit
  } = bootstrapResult.data;
  let documentUsageHandle = null;
  let documentWorkflowResponse;
  try {
    documentWorkflowResponse = await routeRuntime.handleDocumentWorkflowBranch({
      shouldUseDocumentWorkflow,
      message: effectiveMessage,
      convId,
      userId,
      replyLang,
      normalizedRole,
      documentWorkflowState,
      forcedMode,
      ephemeralChunks,
      ephemeralSource,
      persist,
      isCrisis,
      roomId,
      wantStream,
      clarifyingTurns,
      requestedThoroughness,
      prisma,
      saveRoomMessage: saveAssistantRoomMessage,
      buildOrchestrationMetadata: buildChatOrchestrationMetadata,
      logInfo: logChatInfo,
      logError: logChatError,
      onBeforeGenerate: async () => {
        documentUsageHandle = await routeRuntime.reserveUsageForRequest({
          request: req,
          userId,
          metric: "DOCUMENT_GENERATE",
          scope: "chat.document_generate",
          idempotencyKey: payload?.idempotencyKey,
          metadata: { convId, role: normalizedRole }
        });
      },
      onGenerationComplete: () => routeRuntime.commitUsageForRequest(documentUsageHandle),
      onGenerationFailure: (reason) => routeRuntime.releaseUsageForRequest(documentUsageHandle, { reason })
    });
  } catch (error) {
    if (!error?.usageWorkCompleted) {
      await releaseUsageSafely(documentUsageHandle, "chat_document_generation_failed", routeRuntime.releaseUsageForRequest);
    }
    if (String(error?.code || "").startsWith("USAGE_")) {
      return usageErrorResponse(error, "chat.document_generate");
    }
    throw error;
  }
  if (documentWorkflowResponse) return documentWorkflowResponse;

  const helpWorkflowResponse = await routeRuntime.handleHelpWorkflowBranch({
    shouldUseHelpWorkflow,
    message: effectiveMessage,
    convId,
    userId,
    replyLang,
    helpWorkflowState,
    helpForcedIntent,
    effectiveExplicitHelpIntent,
    clarifyingTurns,
    requestedThoroughness,
    persist,
    isCrisis,
    normalizedRole,
    roomId,
    wantStream,
    prisma,
    saveRoomMessage: saveAssistantRoomMessage,
    buildOrchestrationMetadata: buildChatOrchestrationMetadata,
    logInfo: logChatInfo
  });
  if (helpWorkflowResponse) return helpWorkflowResponse;
  if (isCrisis) {
    logChatInfo("crisis.detected", {
      role: normalizedRole,
      hasHistory,
      fromRag: false
    });
  }
  if (greeting && !isCrisis && !hasHistory) {
    const reply = inputModality === "voice"
      ? normalizedRole === "SOCIAL_WORKER" ? L.voiceGreetingWorker : L.voiceGreetingClient
      : normalizedRole === "SOCIAL_WORKER" ? L.greetingWorker : L.greetingClient;
    const { attachments } = await finalizeAssistantReply({
      persist,
      convId,
      userId,
      role: normalizedRole,
      userMessage: effectiveMessage,
      reply,
      sources: [],
      attachments: [],
      cards: [],
      metadataExtra: null,
      isCrisis,
      wantsDocumentDownload,
      replyLang,
      messageForDownload: effectiveMessage,
      roomId,
      saveRoomMessage: saveAssistantRoomMessage
    });
    return buildImmediateChatResponse({
      wantStream,
      reply,
      sources: [],
      attachments,
      cards: [],
      isCrisis,
      convId
    });
  }

  const completedTurnReplayResponse = async () => {
    if (!persist || !convId || !userId || !clientTurnKey) return null;
    const completed = await routeRuntime.readCompletedChatTurnReplay({
      userId,
      conversationId: convId,
      clientTurnKey
    });
    if (!completed) return null;
    return buildReplayResponse({
      wantStream,
      convId,
      replay: completed.replay,
      isCrisis
    });
  };

  try {
    const replayResponse = await completedTurnReplayResponse();
    if (replayResponse) return replayResponse;
  } catch (error) {
    logChatError("chat.turn.replay_lookup.error", { error: error?.message || String(error) });
    return makeChatError("chat.error.service_unavailable", 503);
  }

  let chatUsageHandle = null;
  let ragUsageHandle = null;
  try {
    chatUsageHandle = await routeRuntime.reserveUsageForRequest({
      request: req,
      userId,
      metric: "CHAT_ASSISTANT_REPLY",
      scope: "chat.reply",
      /* SOL-CHAT-03: kavatsuse võti on kliendi oma ja ta on stabiilne üle korduste. Ilma temata
         genereeris adapter IGA HTTP-katse jaoks uue UUID-i — täpselt see tegi korduse uueks
         tasuliseks tööks. `payload.idempotencyKey` jääb tagavaraks vanadele klientidele. */
      idempotencyKey: clientTurnKey || payload?.idempotencyKey,
      metadata: { convId, role: normalizedRole, stream: wantStream }
    });
  } catch (error) {
    if (error?.code === "USAGE_IDEMPOTENCY_CONFLICT") {
      const replayResponse = await completedTurnReplayResponse().catch(() => null);
      if (replayResponse) return replayResponse;
    }
    return usageErrorResponse(error, "chat.reply");
  }

  let retrievalResult;
  const plannedRagReplyLang = languagePlan?.answerLanguage || replyLang;
  const recoveryContinuation = isRagRecoveryContinuation(
    effectiveMessage,
    trustedRagRecoveryState
  );
  const retrievalHistory = recoveryContinuation
    ? trustedRagRecoveryHistory
    : rawHistory;
  const recoveryBoundMessage = recoveryContinuation
    ? buildRecoveryBoundMessage({
        message: effectiveMessage,
        recoveryState: trustedRagRecoveryState,
        trustedHistory: trustedRagRecoveryHistory
      })
    : effectiveMessage;
  try {
    retrievalResult = await routeRuntime.assembleRetrievalContext({
      payloadAudience: payload?.audience,
      graphChannelTestOverride: payload?.graphChannelTest === true,
      normalizedRole,
      rawHistory: retrievalHistory,
      trustedRagRecoveryState,
      effectiveMessage: recoveryBoundMessage,
      forceSources,
      forcedMode,
      hasHistory,
      replyLang: plannedRagReplyLang,
      languagePlan,
      ephemeralChunks,
      ephemeralSource,
      combineSources,
      userId,
      convId,
      isCrisis,
      logInfo: logChatInfo,
      logError: logChatError,
      logEvent: routeRuntime.logEvent,
      buildMissingMunicipalityInstruction: buildMissingMunicipalitySystemInstruction,
      buildSourceLookupInstruction: buildSourceLookupSystemInstruction,
      docContextBudgets: {
        clientChars: CHAT_DOC_CONTEXT_CLIENT_CHARS,
        clientCombinedChars: CHAT_DOC_CONTEXT_CLIENT_COMBINED_CHARS,
        workerChars: CHAT_DOC_CONTEXT_WORKER_CHARS,
        workerCombinedChars: CHAT_DOC_CONTEXT_WORKER_COMBINED_CHARS,
        clientMaxChunks: CHAT_DOC_CONTEXT_CLIENT_MAX_CHUNKS,
        workerMaxChunks: CHAT_DOC_CONTEXT_WORKER_MAX_CHUNKS,
        maxInputChunks: CHAT_EPHEMERAL_CHUNKS_MAX,
        chunkCharsMax: CHAT_EPHEMERAL_CHUNK_CHARS_MAX
      },
      onBeforeRag: async () => {
        ragUsageHandle = await routeRuntime.reserveUsageForRequest({
          request: req,
          userId,
              metric: "RAG_SEARCH",
          scope: "chat.rag_search",
          idempotencyKey: clientTurnKey || payload?.idempotencyKey,
          metadata: { convId, role: normalizedRole }
        });
      }
    });
  } catch (error) {
    await Promise.all([
      releaseUsageSafely(chatUsageHandle, "chat_retrieval_failed", routeRuntime.releaseUsageForRequest),
      releaseUsageSafely(ragUsageHandle, "rag_search_failed", routeRuntime.releaseUsageForRequest)
    ]);
    if (String(error?.code || "").startsWith("USAGE_")) {
      if (error?.code === "USAGE_IDEMPOTENCY_CONFLICT") {
        const replayResponse = await completedTurnReplayResponse().catch(() => null);
        if (replayResponse) return replayResponse;
      }
      return usageErrorResponse(error, ragUsageHandle ? "chat.reply" : "chat.rag_search");
    }
    logChatError("retrieval.unhandled_error", { error: error?.message || String(error) });
    return makeChatError("chat.error.service_unavailable", 503);
  }

  const {
    previousSourceUseRequest,
    sourceLookupRequest,
    extraSystemInstructions,
    effectiveContext,
    grounding,
    sources,
    retrievalMeta
  } = retrievalResult;
  const responseReplyLang = retrievalMeta?.responseReplyLang || plannedRagReplyLang;
  const responseLanguageStrings = responseReplyLang === replyLang
    ? L
    : langStrings(responseReplyLang, normalizedRole);
  const responseSystemInstructions = [
    ...(inputModality === "voice" ? [buildVoiceInputSystemInstruction(responseReplyLang)] : []),
    ...(Array.isArray(extraSystemInstructions) ? extraSystemInstructions : [])
  ].filter(Boolean);

  if (ragUsageHandle) {
    try {
      if (retrievalMeta.ragSearchFailed) {
        await routeRuntime.releaseUsageForRequest(ragUsageHandle, { reason: "rag_search_failed" });
      } else {
        await routeRuntime.commitUsageForRequest(ragUsageHandle);
      }
    } catch (error) {
      await releaseUsageSafely(chatUsageHandle, "rag_usage_settlement_failed", routeRuntime.releaseUsageForRequest);
      if (error?.code === "USAGE_IDEMPOTENCY_CONFLICT") {
        const replayResponse = await completedTurnReplayResponse().catch(() => null);
        if (replayResponse) return replayResponse;
      }
      logChatError("usage.rag_settlement.error", { error: error?.message || String(error) });
      return usageErrorResponse(error, "chat.rag_search");
    }
  }
  const genericIntent =
    forcedMode === "rag"
      ? WORK_MODES.SERVICE_GUIDANCE
      : effectiveExplicitHelpIntent === "service_guidance"
      ? WORK_MODES.SERVICE_GUIDANCE
      : WORK_MODES.GENERAL_QUESTION;
  const mainOrchestrationPlan = chooseOrchestrationPlan({
    intent: genericIntent,
    message: recoveryBoundMessage,
    clarifyingTurns,
    requestedThoroughness,
    sourceCount: retrievalMeta.sourceCount,
    hybridTask: genericIntent === WORK_MODES.SERVICE_GUIDANCE && hasDocumentTaskContext(retrievalHistory, normalizedRole)
  });
  logChatInfo("orchestration.plan", {
    mode: mainOrchestrationPlan.mode,
    step: mainOrchestrationPlan.step,
    complexity: mainOrchestrationPlan.complexity,
    reasoning: mainOrchestrationPlan.reasoning,
    capability: mainOrchestrationPlan.capability
  });
  const retryOf = typeof payload?.retryOf === "string" && payload.retryOf.trim()
    ? payload.retryOf.trim().slice(0, 64)
    : null;
  const mainMetadataExtra = {
    ...buildChatOrchestrationMetadata(mainOrchestrationPlan),
    input_modality: inputModality,
    ...(retryOf ? { retryOf } : {}),
    ...(retrievalMeta?.ragRiskPolicy
      ? {
          rag_risk_policy: retrievalMeta.ragRiskPolicy,
          rag_risk_level: retrievalMeta.ragRiskPolicy.riskLevel,
          rag_required_evidence: retrievalMeta.ragRiskPolicy.requiredEvidence
        }
      : {})
  };
  const useAnswerHistory = shouldUseAnswerHistory(effectiveMessage);
  const modelHistory = recoveryContinuation
    ? trustedRagRecoveryModelHistory
    : useAnswerHistory ? history : [];
  retrievalMeta.diagnosticHistory = {
    ...(retrievalMeta.diagnosticHistory || {}),
    request_raw_count: rawHistory.length,
    normalized_client_count: history.length,
    retrieval_input_origin: recoveryContinuation ? "trusted_recovery" : "client_payload",
    model_available_count: recoveryContinuation ? trustedRagRecoveryModelHistory.length : history.length,
    model_selected_count: modelHistory.length,
    model_selection_reason: recoveryContinuation ? "trusted_recovery" : useAnswerHistory ? "context_dependent" : "self_contained"
  };
  logChatInfo("answer.history_selection", {
    included: modelHistory.length > 0,
    messageCount: modelHistory.length,
    recoveryContinuation,
    trustedRecoveryAvailable: !!trustedRagRecoveryState
  });
  return routeRuntime.handleMainChatResponse({
    req,
    wantStream,
    persist,
    convId,
    userId,
    normalizedRole,
    effectiveMessage,
    ragContractMessage: recoveryBoundMessage,
    modelUserMessage: effectiveMessage.slice(0, MAX_USER_MESSAGE_CHARS),
    messageLength: effectiveMessage.length,
    history: modelHistory,
    effectiveContext,
    grounding,
    includeSources,
    replyLang: responseReplyLang,
    isCrisis,
    extraSystemInstructions: responseSystemInstructions,
    sources,
    retrievalMeta,
    metadataExtra: mainMetadataExtra,
    wantsDocumentDownload,
    roomId,
    saveRoomMessage: saveAssistantRoomMessage,
    // B0: kui otsing ise kukkus, ei tohi kasutajale öelda "ma ei leidnud
    // materjalidest vastust" — see palub tal küsimust täpsustada, mis siin ei
    // aita. Kriisisõnum jääb alati ülimuslikuks.
    noContextReply: isCrisis
      ? responseLanguageStrings.crisisNoCtx
      : retrievalMeta?.ragSearchFailed === true
        ? responseLanguageStrings.retrievalFailed
        : responseLanguageStrings.noContext,
    noContextMeta: {
      ragReturned: retrievalMeta.rawMatchesCount > 0,
      ragSearchFailed: retrievalMeta?.ragSearchFailed === true,
      hadDocContext: retrievalMeta.hadDocContext,
      sourceLookupRequest,
      previousSourceUseRequest,
      ragRiskLevel: retrievalMeta?.ragRiskPolicy?.riskLevel
    },
    makeError: makeChatError,
    logInfo: logChatInfo,
    logError: logChatError,
    logEvent: routeRuntime.logEvent,
    requestStartedAtMs,
    /* SOL-CHAT-01/-02: mõlemad võtavad nüüd valikulise tehingukliendi, sest arveldus kuulub
       pöörde terminalse kirjutusega ühte tehingusse. Ilma `tx`-ita käitub kumbki nagu varem. */
    clientTurnKey,
    sessionTurnLimit,
    expectedRecoveryAssistantMessageId: recoveryContinuation
      ? trustedRagRecoveryAssistantMessageId
      : null,
    recoveryRootUserMessageId: recoveryContinuation
      ? trustedRagRecoveryState?.rootUserMessageId || null
      : null,
    chatUsageReused: chatUsageHandle?.reused === true,
    onUsageCommit: (tx) => routeRuntime.commitUsageForRequest(chatUsageHandle, { tx: tx || undefined }),
    onUsageRelease: (reason, tx) => routeRuntime.releaseUsageForRequest(chatUsageHandle, {
      reason,
      tx: tx || undefined
    })
  });
}
export async function GET(req) {
  const limitResponse = enforceChatRateLimit(req, {
    scope: "main_get",
    limit: CHAT_GET_RATE_LIMIT_MAX,
    windowMs: CHAT_RATE_LIMIT_WINDOW_MS
  });
  if (limitResponse) return limitResponse;

  return NextResponse.json({
    ok: true,
    route: "api/chat"
  }, {
    headers: CHAT_NO_STORE_HEADERS
  });
}
