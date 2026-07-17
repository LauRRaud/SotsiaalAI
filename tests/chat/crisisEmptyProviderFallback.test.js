import { register } from "node:module";
import test from "node:test";
import assert from "node:assert/strict";

register(new URL("./serverOnlyTestLoader.mjs", import.meta.url), import.meta.url);

const [
  { handleMainChatResponse },
  { finalizeAssistantReply },
  { langStrings },
  { resolveCrisisStateAfterEvent },
  { resolveHydratedCrisisState }
] = await Promise.all([
  import("../../lib/chat/mainResponseHandler.js"),
  import("../../lib/chat/responseFinalizer.js"),
  import("../../lib/chat/promptBuilder.js"),
  import("../../components/chat/hooks/useChatStream.js"),
  import("../../components/chat/hooks/useChatConversationState.js")
]);

const GENERAL_FALLBACK = "Sorry, I couldn't generate an answer right now.";

function createHandlerInput({ replyLang = "et", isCrisis = true, wantStream = false, persist = true } = {}) {
  return {
    req: new Request("http://localhost/api/chat", { method: "POST" }),
    wantStream,
    persist,
    convId: "conv-empty-provider",
    userId: "user-empty-provider",
    normalizedRole: "CLIENT",
    effectiveMessage: "Mul on kohe abi vaja",
    messageLength: 22,
    history: [],
    effectiveContext: "(1) kontrollitud RAG-kontekst",
    grounding: "strong",
    includeSources: true,
    replyLang,
    isCrisis,
    extraSystemInstructions: [],
    sources: [],
    retrievalMeta: {
      sourceCount: 1,
      rawMatchesCount: 1,
      hadDocContext: false
    },
    metadataExtra: null,
    wantsDocumentDownload: false,
    roomId: null,
    saveRoomMessage: null,
    noContextReply: langStrings(replyLang).crisisNoCtx,
    noContextMeta: {},
    makeError: (messageKey, status) => new Response(JSON.stringify({ messageKey }), { status }),
    logInfo: () => {},
    logError: () => {},
    logEvent: async () => {}
  };
}

function createFinalizerCapture() {
  const captures = [];
  return {
    captures,
    finalizeAssistantReply: input => finalizeAssistantReply(input, {
      persistAppend: async () => {},
      persistDone: async input => {
        captures.push({
          replyLang: input.replyLang,
          text: input.finalText
        });
        return { assistantMessageId: "assistant-empty-provider" };
      }
    })
  };
}

function parseSseEvents(body) {
  return body
    .trim()
    .split("\n\n")
    .map(block => {
      const [eventLine, dataLine] = block.split("\n");
      return {
        event: eventLine?.replace("event: ", ""),
        data: dataLine?.startsWith("data: ") ? JSON.parse(dataLine.slice(6)) : null
      };
    });
}

test("empty non-stream provider replies use the localized crisis fallback and persistence boundary", async () => {
  for (const replyLang of ["et", "en", "ru"]) {
    const finalizer = createFinalizerCapture();
    const response = await handleMainChatResponse(createHandlerInput({ replyLang }), {
      callOpenAI: async () => ({ reply: "" }),
      persistInit: async () => {},
      finalizeAssistantReply: finalizer.finalizeAssistantReply
    });
    const payload = await response.json();
    const fallback = langStrings(replyLang).crisisNoCtx;

    assert.equal(payload.reply, fallback);
    assert.equal(payload.answer, fallback);
    assert.deepEqual(finalizer.captures, [{ replyLang, text: fallback }]);
    assert.match(payload.reply, /112/);
    if (replyLang === "et") {
      assert.match(payload.reply, /116 111/);
      assert.match(payload.reply, /116 006/);
    }
  }
});

test("null-delta streams use the localized crisis fallback and persistence boundary", async () => {
  for (const replyLang of ["et", "en", "ru"]) {
    const finalizer = createFinalizerCapture();
    const response = await handleMainChatResponse(createHandlerInput({ replyLang, wantStream: true }), {
      streamOpenAI: async function* emptyProviderStream() {
        yield { type: "done" };
      },
      persistInit: async () => {},
      finalizeAssistantReply: finalizer.finalizeAssistantReply
    });
    const events = parseSseEvents(await response.text());
    const fallback = langStrings(replyLang).crisisNoCtx;
    const meta = events.find(event => event.event === "meta");
    const delta = events.find(event => event.event === "delta");

    assert.equal(meta?.data?.isCrisis, true);
    assert.equal(delta?.data?.t, fallback);
    assert.deepEqual(finalizer.captures, [{ replyLang, text: fallback }]);
    assert.match(delta.data.t, /112/);
    if (replyLang === "et") {
      assert.match(delta.data.t, /116 111/);
      assert.match(delta.data.t, /116 006/);
    }
  }
});

test("empty non-crisis provider replies keep the general fallback in both response modes", async () => {
  const nonStreamFinalizer = createFinalizerCapture();
  const nonStreamResponse = await handleMainChatResponse(createHandlerInput({ isCrisis: false }), {
    callOpenAI: async () => ({ reply: "" }),
    persistInit: async () => {},
    finalizeAssistantReply: nonStreamFinalizer.finalizeAssistantReply
  });
  const nonStreamPayload = await nonStreamResponse.json();
  assert.equal(nonStreamPayload.reply, GENERAL_FALLBACK);
  assert.deepEqual(nonStreamFinalizer.captures, [{ replyLang: "et", text: GENERAL_FALLBACK }]);

  const streamFinalizer = createFinalizerCapture();
  const streamResponse = await handleMainChatResponse(createHandlerInput({ isCrisis: false, wantStream: true }), {
    streamOpenAI: async function* emptyProviderStream() {
      yield { type: "done" };
    },
    persistInit: async () => {},
    finalizeAssistantReply: streamFinalizer.finalizeAssistantReply
  });
  const delta = parseSseEvents(await streamResponse.text()).find(event => event.event === "delta");
  assert.equal(delta?.data?.t, GENERAL_FALLBACK);
  assert.deepEqual(streamFinalizer.captures, [{ replyLang: "et", text: GENERAL_FALLBACK }]);
});

test("provider stream error follows a crisis meta event without lowering the active warning", async () => {
  const response = await handleMainChatResponse(createHandlerInput({ wantStream: true, persist: false }), {
    streamOpenAI: async () => {
      throw new Error("synthetic provider failure");
    }
  });
  const events = parseSseEvents(await response.text());
  const metaIndex = events.findIndex(event => event.event === "meta" && event.data?.isCrisis === true);
  const errorIndex = events.findIndex(event => event.event === "error");

  assert.ok(metaIndex >= 0);
  assert.ok(errorIndex > metaIndex);
  const afterMeta = resolveCrisisStateAfterEvent(false, { phase: "meta", isCrisis: true });
  assert.equal(resolveCrisisStateAfterEvent(afterMeta, { phase: "stream-error" }), true);
});

test("newer local crisis state survives stale hydration and clears after a successful non-crisis done", () => {
  const localMessages = [
    { role: "user", text: "Mul on kohe abi vaja", createdAt: 10_000 },
    { role: "ai", text: "112", createdAt: 10_100 }
  ];
  const hydrated = resolveHydratedCrisisState(true, {
    serverIsCrisis: false,
    localMessages,
    serverMessages: [
      { role: "USER", text: "Varasem pöördumine", createdAt: 9_000 },
      { role: "ASSISTANT", text: "Varasem vastus", createdAt: 9_100 }
    ]
  });

  assert.equal(hydrated, true);
  assert.equal(resolveCrisisStateAfterEvent(hydrated, {
    phase: "done",
    isCrisis: false
  }), false);
});
