import { NextResponse } from "next/server";
import { bootstrapChatRequest } from "@/lib/chat/requestBootstrap";
import { CHAT_NO_STORE_HEADERS } from "@/lib/chat/routeServerUtils";
import { prisma } from "@/lib/prisma";
import {
  chooseOrchestrationPlan,
  WORK_MODES
} from "@/lib/chat/orchestrationPolicy";
import { logEvent } from "@/lib/chat/logger";
import { enforceChatRateLimit, readChatRateLimit } from "@/lib/chat-api-rate-limit";
import { assembleRetrievalContext } from "@/lib/chat/retrievalContextAssembler";
import { handleMainChatResponse } from "@/lib/chat/mainResponseHandler";
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
  saveAssistantRoomMessage
} from "@/lib/chat/mainRouteRuntime";
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
const MAX_USER_MESSAGE_CHARS = 1500;
export async function POST(req) {
  const bootstrapResult = await bootstrapChatRequest({
    req,
    prisma,
    makeError: makeChatError,
    logInfo: logChatInfo,
    logEvent,
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
    helpWorkflowState,
    replyLang,
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
    shouldUseDocumentWorkflow,
    shouldUseHelpWorkflow
  } = bootstrapResult.data;
  const documentWorkflowResponse = await handleDocumentWorkflowBranch({
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
    roomId,
    wantStream,
    clarifyingTurns,
    requestedThoroughness,
    prisma,
    saveRoomMessage: saveAssistantRoomMessage,
    buildOrchestrationMetadata: buildChatOrchestrationMetadata,
    logInfo: logChatInfo,
    logError: logChatError
  });
  if (documentWorkflowResponse) return documentWorkflowResponse;

  const helpWorkflowResponse = await handleHelpWorkflowBranch({
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
    const reply = normalizedRole === "SOCIAL_WORKER" ? L.greetingWorker : L.greetingClient;
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
  const {
    previousSourceUseRequest,
    sourceLookupRequest,
    extraSystemInstructions,
    effectiveContext,
    grounding,
    sources,
    retrievalMeta
  } = await assembleRetrievalContext({
    payloadAudience: payload?.audience,
    graphChannelTestOverride: payload?.graphChannelTest === true,
    normalizedRole,
    rawHistory,
    effectiveMessage,
    forceSources,
    forcedMode,
    hasHistory,
    replyLang,
    ephemeralChunks,
    ephemeralSource,
    combineSources,
    userId,
    convId,
    isCrisis,
    logInfo: logChatInfo,
    logError: logChatError,
    logEvent,
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
    }
  });
  const genericIntent =
    forcedMode === "rag"
      ? WORK_MODES.SERVICE_GUIDANCE
      : effectiveExplicitHelpIntent === "service_guidance"
      ? WORK_MODES.SERVICE_GUIDANCE
      : WORK_MODES.GENERAL_QUESTION;
  const mainOrchestrationPlan = chooseOrchestrationPlan({
    intent: genericIntent,
    message: effectiveMessage,
    clarifyingTurns,
    requestedThoroughness,
    sourceCount: retrievalMeta.sourceCount,
    hybridTask: genericIntent === WORK_MODES.SERVICE_GUIDANCE && hasDocumentTaskContext(rawHistory, normalizedRole)
  });
  logChatInfo("orchestration.plan", {
    mode: mainOrchestrationPlan.mode,
    step: mainOrchestrationPlan.step,
    complexity: mainOrchestrationPlan.complexity,
    reasoning: mainOrchestrationPlan.reasoning,
    capability: mainOrchestrationPlan.capability
  });
  const mainMetadataExtra = {
    ...buildChatOrchestrationMetadata(mainOrchestrationPlan),
    ...(retrievalMeta?.ragRiskPolicy
      ? {
          rag_risk_policy: retrievalMeta.ragRiskPolicy,
          rag_risk_level: retrievalMeta.ragRiskPolicy.riskLevel,
          rag_required_evidence: retrievalMeta.ragRiskPolicy.requiredEvidence
        }
      : {})
  };
  return handleMainChatResponse({
    req,
    wantStream,
    persist,
    convId,
    userId,
    normalizedRole,
    effectiveMessage,
    modelUserMessage: effectiveMessage.slice(0, MAX_USER_MESSAGE_CHARS),
    messageLength: effectiveMessage.length,
    history,
    effectiveContext,
    grounding,
    includeSources,
    replyLang,
    isCrisis,
    extraSystemInstructions,
    sources,
    retrievalMeta,
    metadataExtra: mainMetadataExtra,
    wantsDocumentDownload,
    roomId,
    saveRoomMessage: saveAssistantRoomMessage,
    noContextReply: isCrisis ? L.crisisNoCtx : L.noContext,
    noContextMeta: {
      ragReturned: retrievalMeta.rawMatchesCount > 0,
      hadDocContext: retrievalMeta.hadDocContext,
      sourceLookupRequest,
      previousSourceUseRequest,
      ragRiskLevel: retrievalMeta?.ragRiskPolicy?.riskLevel
    },
    makeError: makeChatError,
    logInfo: logChatInfo,
    logError: logChatError,
    logEvent
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
