import { chooseOrchestrationPlan, WORK_MODES } from "@/lib/chat/orchestrationPolicy";
import { buildImmediateChatResponse, finalizeAssistantReply } from "@/lib/chat/responseFinalizer";
import {
  buildDocumentGeneratedIntro,
  buildDocumentTaskAttachments,
  buildDocumentWorkflowMetadata,
  getDocumentWorkflowPlanInput,
  runDocumentChatWorkflow
} from "@/lib/chat/documentOrchestration";
import { getEphemeralSourceLabel, buildDocumentMissingInstructionReply } from "@/lib/chat/requestContext";
import { MAX_ARTIFACT_SOURCE_DOCUMENTS } from "@/lib/documents/constants";
import { generateArtifactDraftContent } from "@/lib/documents/generation";
import { cacheRetrievalDebugMeta } from "@/lib/documents/retrievalObservability";
import { buildHelpWorkflowMetadata, runHelpChatWorkflow } from "@/lib/help/chatWorkflow";

const CLIENT_AGENT_DOCUMENT_LIMIT = 2;

async function buildHandledHelpWorkflowResponse({
  helpResult,
  wantStream,
  persist,
  convId,
  userId,
  normalizedRole,
  userMessage,
  planMessage,
  intentFallback,
  clarifyingTurns,
  requestedThoroughness,
  replyLang,
  roomId,
  saveRoomMessage,
  buildOrchestrationMetadata,
  logInfo
}, deps = {}) {
  const choosePlan = deps.chooseOrchestrationPlan || chooseOrchestrationPlan;
  const finalizeReply = deps.finalizeAssistantReply || finalizeAssistantReply;
  const buildResponse = deps.buildImmediateChatResponse || buildImmediateChatResponse;
  const buildHelpMeta = deps.buildHelpWorkflowMetadata || buildHelpWorkflowMetadata;

  if (!helpResult?.handled) return null;

  const reply = String(helpResult.reply || "").trim();
  let attachments = Array.isArray(helpResult.attachments) ? helpResult.attachments : [];
  const cards = Array.isArray(helpResult.cards) ? helpResult.cards : [];
  const sources = Array.isArray(helpResult.sources) ? helpResult.sources : [];
  const helpPlan = choosePlan({
    intent: helpResult?.workflowState?.intent || intentFallback || WORK_MODES.CREATE_HELP_REQUEST,
    message: planMessage,
    workflowState: helpResult?.workflowState || null,
    clarifyingTurns,
    requestedThoroughness
  });

  if (typeof logInfo === "function") {
    logInfo("orchestration.plan", {
      mode: helpPlan.mode,
      step: helpPlan.step,
      complexity: helpPlan.complexity,
      reasoning: helpPlan.reasoning,
      capability: helpPlan.capability
    });
  }

  const metadataExtra = buildOrchestrationMetadata(
    helpPlan,
    buildHelpMeta(helpResult.workflowState)
  );
  const helpWorkflowMeta = buildHelpMeta(helpResult.workflowState).workflow;

  ({ attachments } = await finalizeReply({
    persist,
    convId,
    userId,
    role: normalizedRole,
    userMessage,
    reply,
    sources,
    attachments,
    cards,
    metadataExtra,
    isCrisis: false,
    wantsDocumentDownload: false,
    replyLang,
    messageForDownload: userMessage,
    roomId,
    saveRoomMessage
  }));

  return buildResponse({
    wantStream,
    reply,
    sources,
    attachments,
    cards,
    workflow: helpWorkflowMeta,
    isCrisis: false,
    convId
  });
}

export async function handleHelpWorkflowBranch({
  shouldUseHelpWorkflow,
  message,
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
  saveRoomMessage,
  buildOrchestrationMetadata,
  logInfo
}, deps = {}) {
  const runHelpWorkflow = deps.runHelpChatWorkflow || runHelpChatWorkflow;

  if (!shouldUseHelpWorkflow) return null;

  const helpResult = await runHelpWorkflow({
    message,
    convId,
    userId,
    replyLang,
    workflowState: helpWorkflowState,
    forcedIntent: helpForcedIntent
  }, prisma);

  return buildHandledHelpWorkflowResponse({
    helpResult,
    wantStream,
    persist,
    convId,
    userId,
    normalizedRole,
    userMessage: message,
    planMessage: message,
    intentFallback: effectiveExplicitHelpIntent,
    clarifyingTurns,
    requestedThoroughness,
    replyLang,
    roomId,
    saveRoomMessage,
    buildOrchestrationMetadata,
    logInfo
  }, deps);
}

export async function handleDocumentWorkflowBranch({
  shouldUseDocumentWorkflow,
  message,
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
  saveRoomMessage,
  buildOrchestrationMetadata,
  logInfo,
  logError
}, deps = {}) {
  const runDocumentWorkflow = deps.runDocumentChatWorkflow || runDocumentChatWorkflow;
  const runHelpWorkflow = deps.runHelpChatWorkflow || runHelpChatWorkflow;
  const finalizeReply = deps.finalizeAssistantReply || finalizeAssistantReply;
  const buildResponse = deps.buildImmediateChatResponse || buildImmediateChatResponse;
  const buildDocGeneratedIntro = deps.buildDocumentGeneratedIntro || buildDocumentGeneratedIntro;
  const buildDocTaskAttachments = deps.buildDocumentTaskAttachments || buildDocumentTaskAttachments;
  const buildDocWorkflowMetadata = deps.buildDocumentWorkflowMetadata || buildDocumentWorkflowMetadata;
  const getDocWorkflowPlanInput = deps.getDocumentWorkflowPlanInput || getDocumentWorkflowPlanInput;
  const getEphemeralLabel = deps.getEphemeralSourceLabel || getEphemeralSourceLabel;
  const buildMissingInstructionReply = deps.buildDocumentMissingInstructionReply || buildDocumentMissingInstructionReply;
  const generateDraftContent = deps.generateArtifactDraftContent || generateArtifactDraftContent;
  const cacheDebugMeta = deps.cacheRetrievalDebugMeta || cacheRetrievalDebugMeta;

  if (!shouldUseDocumentWorkflow) return null;

  const documentResult = await runDocumentWorkflow({
    message,
    convId,
    userId,
    replyLang,
    role: normalizedRole,
    workflowState: documentWorkflowState,
    hasSourceMaterial: ephemeralChunks.length > 0,
    forceConfirmed: forcedMode === "document"
  }, prisma);

  if (documentResult?.switchTo === "help_request" || documentResult?.switchTo === "help_offer") {
    const switchedHelpIntent = documentResult.switchTo === "help_request"
      ? "create_help_request"
      : "create_help_offer";
    const helpSeedMessage = String(documentResult.switchMessage || message).trim() || message;
    const helpResult = await runHelpWorkflow({
      message: helpSeedMessage,
      convId,
      userId,
      replyLang,
      forcedIntent: switchedHelpIntent
    }, prisma);

    const switchedResponse = await buildHandledHelpWorkflowResponse({
      helpResult,
      wantStream,
      persist,
      convId,
      userId,
      normalizedRole,
      userMessage: message,
      planMessage: helpSeedMessage,
      intentFallback: switchedHelpIntent,
      clarifyingTurns,
      requestedThoroughness,
      replyLang,
      roomId,
      saveRoomMessage,
      buildOrchestrationMetadata,
      logInfo
    }, deps);
    if (switchedResponse) return switchedResponse;
  }

  if (!documentResult?.handled) return null;

  const documentWorkflowMeta = buildDocWorkflowMetadata(documentResult.workflowState).workflow;
  const workflowPlan = documentResult?.workflowState
    ? getDocWorkflowPlanInput(documentResult.workflowState, requestedThoroughness, clarifyingTurns)
    : null;

  if (workflowPlan && typeof logInfo === "function") {
    logInfo("orchestration.plan", {
      mode: workflowPlan.mode,
      step: workflowPlan.step,
      complexity: workflowPlan.complexity,
      reasoning: workflowPlan.reasoning,
      capability: workflowPlan.capability
    });
  }

  if (!documentResult.readyToGenerate) {
    const reply = String(documentResult.reply || "").trim();
    let attachments = Array.isArray(documentResult.attachments) ? documentResult.attachments : [];
    const metadataExtra = buildOrchestrationMetadata(
      workflowPlan,
      buildDocWorkflowMetadata(documentResult.workflowState)
    );

    ({ attachments } = await finalizeReply({
      persist,
      convId,
      userId,
      role: normalizedRole,
      userMessage: message,
      reply,
      sources: [],
      attachments,
      cards: [],
      metadataExtra,
      isCrisis: false,
      wantsDocumentDownload: false,
      replyLang,
      messageForDownload: message,
      roomId,
      saveRoomMessage
    }));

    return buildResponse({
      wantStream,
      reply,
      sources: [],
      attachments,
      cards: [],
      workflow: documentWorkflowMeta,
      isCrisis: false,
      convId
    });
  }

  try {
    const taskConfig = documentResult.taskConfig;
    const documentsLimit = normalizedRole === "CLIENT"
      ? Math.min(CLIENT_AGENT_DOCUMENT_LIMIT, MAX_ARTIFACT_SOURCE_DOCUMENTS)
      : MAX_ARTIFACT_SOURCE_DOCUMENTS;
    const agentDocuments = [];
    const selectedTemplate = null;
    const runInstruction = String(taskConfig?.instruction || "").trim();
    const workflowDraft = documentResult?.workflowState?.draft || {};
    const uploadedMaterialText = Array.isArray(ephemeralChunks) && ephemeralChunks.length
      ? ephemeralChunks.join("\n\n---\n\n").slice(0, 14_000)
      : "";
    const sessionSourceMaterialText =
      workflowDraft?.sourceMode === "existing_material"
        ? uploadedMaterialText || runInstruction
        : runInstruction;
    const sessionSourceMaterialName =
      workflowDraft?.sourceMode === "existing_material"
        ? getEphemeralLabel(ephemeralSource, "chat-uploaded-material")
        : "chat-conversation-brief";

    if (runInstruction.length < 12) {
      const reply = buildMissingInstructionReply(replyLang);
      let attachments = buildDocTaskAttachments({
        replyLang,
        role: normalizedRole
      });
      const metadataExtra = buildOrchestrationMetadata(
        workflowPlan,
        buildDocWorkflowMetadata(documentResult.workflowState)
      );

      ({ attachments } = await finalizeReply({
        persist,
        convId,
        userId,
        role: normalizedRole,
        userMessage: message,
        reply,
        sources: [],
        attachments,
        cards: [],
        metadataExtra,
        isCrisis: false,
        wantsDocumentDownload: false,
        replyLang,
        messageForDownload: message,
        roomId,
        saveRoomMessage
      }));

      return buildResponse({
        wantStream,
        reply,
        sources: [],
        attachments,
        cards: [],
        workflow: documentWorkflowMeta,
        isCrisis: false,
        convId
      });
    }

    const generated = await generateDraftContent({
      type: taskConfig.artifactType,
      documents: agentDocuments,
      sourceMaterialText: sessionSourceMaterialText,
      sourceMaterialName: sessionSourceMaterialName,
      templateTitle: selectedTemplate?.title || null,
      instruction: runInstruction,
      audience: taskConfig.audience,
      tone: taskConfig.tone,
      language: taskConfig.language,
      length: taskConfig.length,
      observabilityRoute: "api/chat",
      observabilityStage: "document_generate",
      userId,
      userRole: normalizedRole,
      conversationId: convId
    });
    const content = String(generated?.content || "").trim();
    if (!content) throw new Error("documents.artifacts.errors.ai_empty");
    if (generated?.debugMeta) {
      cacheDebugMeta(userId, content, generated.debugMeta);
    }

    const sourceData = agentDocuments
      .slice(0, documentsLimit)
      .map((document) => ({
        documentId: document.id
      }));
    const artifact = await prisma.agentArtifact.create({
      data: {
        ownerId: userId,
        type: taskConfig.artifactType,
        title: taskConfig.generatedTitle || null,
        status: "DRAFT",
        content,
        templateId: selectedTemplate?.id || null,
        ...(sourceData.length
          ? {
              sourceDocuments: {
                createMany: {
                  data: sourceData
                }
              }
            }
          : {})
      },
      select: {
        id: true
      }
    });
    const intro = buildDocGeneratedIntro({
      replyLang,
      role: normalizedRole
    });
    const optionSummary = [
      `type=${taskConfig.artifactType}`,
      `audience=${taskConfig.audience}`,
      `tone=${taskConfig.tone}`,
      `language=${taskConfig.language}`,
      `length=${taskConfig.length}`,
      "template=none",
      normalizedRole === "CLIENT" ? `clientTask=${taskConfig.clientTask || "LETTER_REQUEST"}` : ""
    ]
      .filter(Boolean)
      .join(", ");
    const reply = `${intro}\n\n(${optionSummary})\n\n${content}`;
    const sources = workflowDraft?.sourceMode === "existing_material" && sessionSourceMaterialText
      ? [{
          id: "chat-session-material",
          title: getEphemeralLabel(ephemeralSource, "Uploaded document"),
          fileName: getEphemeralLabel(ephemeralSource, "") || undefined,
          short_ref: "(uploaded document)"
        }]
      : agentDocuments.map((document, index) => ({
          id: document.id,
          title: document.title || document.originalName || `source-${index + 1}`,
          fileName: document.originalName || undefined,
          short_ref: "(selected document)"
        }));
    let attachments = buildDocTaskAttachments({
      replyLang,
      artifactId: artifact.id,
      role: normalizedRole
    });
    const metadataExtra = buildOrchestrationMetadata(
      workflowPlan,
      buildDocWorkflowMetadata(null)
    );

    ({ attachments } = await finalizeReply({
      persist,
      convId,
      userId,
      role: normalizedRole,
      userMessage: message,
      reply,
      sources,
      attachments,
      cards: [],
      metadataExtra,
      isCrisis: false,
      wantsDocumentDownload: false,
      replyLang,
      messageForDownload: message,
      roomId,
      saveRoomMessage
    }));

    return buildResponse({
      wantStream,
      reply,
      sources,
      attachments,
      cards: [],
      workflow: buildDocWorkflowMetadata(null).workflow,
      isCrisis: false,
      convId
    });
  } catch (error) {
    if (typeof logError === "function") {
      logError("document_task.flow_failed", {
        err: error?.message || String(error),
        userId,
        role: normalizedRole
      });
    }

    const reply =
      replyLang === "ru"
        ? "Не удалось создать черновик. Проверьте исходные материалы и попробуйте снова."
        : replyLang === "en"
          ? "Failed to create the draft. Check the source material and try again."
          : "Mustandi loomine ebaõnnestus. Kontrolli alusmaterjale ja proovi uuesti.";
    let attachments = buildDocTaskAttachments({
      replyLang,
      role: normalizedRole
    });
    const metadataExtra = buildOrchestrationMetadata(
      workflowPlan,
      buildDocWorkflowMetadata(documentResult.workflowState)
    );

    ({ attachments } = await finalizeReply({
      persist,
      convId,
      userId,
      role: normalizedRole,
      userMessage: message,
      reply,
      sources: [],
      attachments,
      cards: [],
      metadataExtra,
      isCrisis: false,
      wantsDocumentDownload: false,
      replyLang,
      messageForDownload: message,
      roomId,
      saveRoomMessage
    }));

    return buildResponse({
      wantStream,
      reply,
      sources: [],
      attachments,
      cards: [],
      workflow: documentWorkflowMeta,
      isCrisis: false,
      convId
    });
  }
}
