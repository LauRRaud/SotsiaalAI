import { register } from "node:module";
import test from "node:test";
import assert from "node:assert/strict";

register(new URL("./serverOnlyTestLoader.mjs", import.meta.url), import.meta.url);

const [
  { POST },
  { resolveHydratedCrisisState },
  { resolveCrisisStateAfterEvent },
  { persistDone },
  { langStrings },
  { handleDocumentWorkflowBranch, handleHelpWorkflowBranch }
] = await Promise.all([
  import("../../app/api/chat/route.js"),
  import("../../components/chat/hooks/useChatConversationState.js"),
  import("../../components/chat/hooks/useChatStream.js"),
  import("../../lib/chat/persistence.js"),
  import("../../lib/chat/promptBuilder.js"),
  import("../../lib/chat/workflowBranchHandlers.js")
]);

function baseBootstrapData(overrides = {}) {
  return {
    payload: {},
    rawHistory: [],
    wantStream: false,
    persist: false,
    convId: "conv-vest-p0",
    roomId: null,
    ephemeralChunks: [],
    ephemeralSource: null,
    combineSources: false,
    forceSources: true,
    includeSources: true,
    wantsDocumentDownload: false,
    userId: "user-vest-p0",
    normalizedRole: "CLIENT",
    history: [],
    helpWorkflowState: null,
    replyLang: "et",
    greeting: false,
    clarifyingTurns: 0,
    requestedThoroughness: null,
    L: langStrings("et"),
    isCrisis: false,
    hasHistory: false,
    effectiveMessage: "Vajan infot tundmatu kohaliku toetuse kohta",
    forcedMode: "rag",
    effectiveExplicitHelpIntent: "service_guidance",
    documentWorkflowState: null,
    helpForcedIntent: null,
    shouldUseDocumentWorkflow: false,
    shouldUseHelpWorkflow: false,
    ...overrides
  };
}

function noContextRouteDeps(bootstrapData) {
  return {
    bootstrapChatRequest: async () => ({ data: bootstrapData }),
    reserveUsageForRequest: async ({ metric }) => ({ metric }),
    commitUsageForRequest: async () => {},
    releaseUsageForRequest: async () => {},
    logEvent: async () => {},
    assembleRetrievalContext: async () => ({
      previousSourceUseRequest: false,
      sourceLookupRequest: true,
      extraSystemInstructions: [],
      effectiveContext: "",
      grounding: "none",
      sources: [],
      retrievalMeta: {
        sourceCount: 0,
        rawMatchesCount: 0,
        hadDocContext: false,
        ragSearchFailed: true
      }
    })
  };
}

test("ET, EN and RU crisis fallbacks are non-empty and contain 112", () => {
  for (const language of ["et", "en", "ru"]) {
    const fallback = langStrings(language).crisisNoCtx;
    assert.equal(typeof fallback, "string");
    assert.ok(fallback.trim());
    assert.match(fallback, /112/);
  }
});

test("persistDone saves the localized crisis fallback with crisis metadata", async () => {
  for (const replyLang of ["et", "en", "ru"]) {
    let createdMessage = null;
    const fakePrisma = {
      $transaction: async callback => callback({
        conversation: {
          findUnique: async () => ({ userId: "user-1" }),
          update: async () => ({})
        },
        conversationMessage: {
          create: async ({ data }) => {
            createdMessage = data;
            return { id: `assistant-${replyLang}` };
          }
        }
      })
    };

    const result = await persistDone({
      convId: "conv-1",
      userId: "user-1",
      finalText: "",
      isCrisis: true,
      replyLang
    }, { prisma: fakePrisma });

    assert.equal(result.assistantMessageId, `assistant-${replyLang}`);
    assert.equal(createdMessage.content, langStrings(replyLang).crisisNoCtx);
    assert.equal(createdMessage.metadata.isCrisis, true);
  }
});

test("persistDone keeps the existing empty non-crisis behavior", async () => {
  let createCalls = 0;
  const fakePrisma = {
    $transaction: async callback => callback({
      conversation: {
        findUnique: async () => ({ userId: "user-1" }),
        update: async () => ({})
      },
      conversationMessage: {
        create: async () => {
          createCalls += 1;
          return { id: "unexpected" };
        }
      }
    })
  };

  const result = await persistDone({
    convId: "conv-1",
    userId: "user-1",
    finalText: "",
    isCrisis: false
  }, { prisma: fakePrisma });

  assert.equal(createCalls, 0);
  assert.equal(result.assistantMessageId, null);
});

function workflowDeps(captures, result, workflowKind) {
  return {
    runHelpChatWorkflow: async () => result,
    runDocumentChatWorkflow: async () => result,
    chooseOrchestrationPlan: () => ({
      mode: "single",
      step: "respond",
      complexity: "low",
      reasoning: "workflow",
      capability: workflowKind
    }),
    buildHelpWorkflowMetadata: () => ({ workflow: { help: { step: "collect" } } }),
    buildDocumentWorkflowMetadata: () => ({ workflow: { document: { step: "collect" } } }),
    getDocumentWorkflowPlanInput: () => ({
      mode: "single",
      step: "respond",
      complexity: "low",
      reasoning: "workflow",
      capability: workflowKind
    }),
    finalizeAssistantReply: async input => {
      captures.finalize = input;
      return { attachments: input.attachments || [] };
    },
    buildImmediateChatResponse: input => {
      captures.response = input;
      return input;
    }
  };
}

test("Help workflow carries isCrisis through persistence and the final response", async () => {
  const captures = {};
  const result = await handleHelpWorkflowBranch({
    shouldUseHelpWorkflow: true,
    message: "Mind ähvardab vägivald",
    convId: "conv-help",
    userId: "user-1",
    replyLang: "et",
    helpWorkflowState: null,
    helpForcedIntent: "create_help_request",
    effectiveExplicitHelpIntent: "create_help_request",
    clarifyingTurns: 0,
    requestedThoroughness: null,
    persist: true,
    isCrisis: true,
    normalizedRole: "CLIENT",
    roomId: null,
    wantStream: false,
    prisma: {},
    saveRoomMessage: null,
    buildOrchestrationMetadata: (_plan, metadata) => metadata,
    logInfo: () => {}
  }, workflowDeps(captures, {
    handled: true,
    reply: "Jätkame abisoovi täpsustamisega.",
    workflowState: { intent: "create_help_request", step: "collect" }
  }, "help"));

  assert.equal(captures.finalize.isCrisis, true);
  assert.equal(captures.response.isCrisis, true);
  assert.equal(result.isCrisis, true);
});

test("Document workflow carries isCrisis through persistence and the final response", async () => {
  const captures = {};
  const result = await handleDocumentWorkflowBranch({
    shouldUseDocumentWorkflow: true,
    message: "Mind ähvardab vägivald",
    convId: "conv-document",
    userId: "user-1",
    replyLang: "et",
    normalizedRole: "CLIENT",
    documentWorkflowState: null,
    forcedMode: "document",
    ephemeralChunks: [],
    ephemeralSource: null,
    persist: true,
    isCrisis: true,
    roomId: null,
    wantStream: false,
    clarifyingTurns: 0,
    requestedThoroughness: null,
    prisma: {},
    saveRoomMessage: null,
    buildOrchestrationMetadata: (_plan, metadata) => metadata,
    logInfo: () => {},
    logError: () => {}
  }, workflowDeps(captures, {
    handled: true,
    readyToGenerate: false,
    reply: "Täpsustame dokumendi juhist.",
    workflowState: { step: "collect" }
  }, "document"));

  assert.equal(captures.finalize.isCrisis, true);
  assert.equal(captures.response.isCrisis, true);
  assert.equal(result.isCrisis, true);
});

test("route returns the crisis fallback for crisis plus empty context and greeting cannot shadow it", async () => {
  const data = baseBootstrapData({
    greeting: true,
    isCrisis: true,
    effectiveMessage: "Tere, mind ähvardab vägivald ja vajan toetust tundmatus vallas"
  });
  const response = await POST(new Request("http://localhost/api/chat", {
    method: "POST"
  }), noContextRouteDeps(data));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.isCrisis, true);
  assert.ok(payload.reply.trim());
  assert.match(payload.reply, /112/);
  assert.notEqual(payload.reply, data.L.greetingClient);
});

test("route preserves the existing noContext response for non-crisis empty context", async () => {
  const data = baseBootstrapData();
  const response = await POST(new Request("http://localhost/api/chat", {
    method: "POST"
  }), noContextRouteDeps(data));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.isCrisis, false);
  assert.equal(payload.reply, data.L.noContext);
});

test("hydration preserves a local crisis until the server has replied to the latest local turn", () => {
  const localMessages = [
    { role: "user", text: "Mind ähvardab vägivald", createdAt: 10_000 },
    { role: "ai", text: "Ajutine veateade", createdAt: 10_100 }
  ];

  assert.equal(resolveHydratedCrisisState(true, {
    serverIsCrisis: false,
    localMessages,
    serverMessages: [
      { role: "USER", text: "Mind ähvardab vägivald", createdAt: new Date(10_050) }
    ]
  }), true);

  assert.equal(resolveHydratedCrisisState(true, {
    serverIsCrisis: false,
    localMessages,
    serverMessages: [
      { role: "USER", text: "Mind ähvardab vägivald", createdAt: new Date(10_050) },
      { role: "ASSISTANT", text: "Uus edukas mitte-kriisi vastus", createdAt: new Date(10_200) }
    ]
  }), false);

  assert.equal(resolveHydratedCrisisState(false, {
    serverIsCrisis: true,
    localMessages: [],
    serverMessages: []
  }), true);
});

test("HTTP errors, stream errors and catch paths preserve crisis state", () => {
  assert.equal(resolveCrisisStateAfterEvent(true, { phase: "http-error" }), true);
  assert.equal(resolveCrisisStateAfterEvent(true, { phase: "stream-error" }), true);
  assert.equal(resolveCrisisStateAfterEvent(true, { phase: "catch" }), true);
});

test("only a successful non-crisis response or conversation switch lowers crisis state", () => {
  assert.equal(resolveCrisisStateAfterEvent(true, {
    phase: "success",
    isCrisis: false
  }), false);
  assert.equal(resolveCrisisStateAfterEvent(true, {
    phase: "done",
    isCrisis: false
  }), false);
  assert.equal(resolveCrisisStateAfterEvent(true, {
    phase: "meta",
    isCrisis: false
  }), true);
  assert.equal(resolveCrisisStateAfterEvent(true, {
    phase: "conversation-switch"
  }), false);

});

test("non-crisis stream metadata defers lowering an active crisis state until done", () => {
  const afterMeta = resolveCrisisStateAfterEvent(true, {
    phase: "meta",
    isCrisis: false
  });
  assert.equal(afterMeta, true);
  assert.equal(resolveCrisisStateAfterEvent(afterMeta, {
    phase: "done",
    isCrisis: false
  }), false);
});
