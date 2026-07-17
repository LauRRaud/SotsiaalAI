import { register } from "node:module";
import test from "node:test";
import assert from "node:assert/strict";

register(new URL("./serverOnlyTestLoader.mjs", import.meta.url), import.meta.url);

const [
  { resolveRunStatus, normalizeCompletionStatus },
  { persistDone },
  { handleMainChatResponse },
  { langStrings }
] = await Promise.all([
  import("../../lib/chat/turnStatus.js"),
  import("../../lib/chat/persistence.js"),
  import("../../lib/chat/mainResponseHandler.js"),
  import("../../lib/chat/promptBuilder.js")
]);

function fakePrismaCapturing(capture) {
  return {
    $transaction: async callback => callback({
      conversation: {
        findUnique: async () => ({ userId: "user-1" }),
        update: async () => ({})
      },
      conversationMessage: {
        create: async ({ data }) => {
          capture.created = data;
          capture.createCalls = (capture.createCalls || 0) + 1;
          return { id: "assistant-1" };
        }
      }
    })
  };
}

// --- Contract 4: honest turn status, no perpetual RUNNING ---

test("resolveRunStatus reads the stored terminal status of the latest assistant turn", () => {
  assert.equal(resolveRunStatus({ latestTurnRole: "ASSISTANT", metadata: { completionStatus: "COMPLETED" } }), "COMPLETED");
  assert.equal(resolveRunStatus({ latestTurnRole: "ASSISTANT", metadata: { completionStatus: "ERROR" } }), "ERROR");
  assert.equal(resolveRunStatus({ latestTurnRole: "ASSISTANT", metadata: { completionStatus: "ABORTED" } }), "ABORTED");
  // Backward compatible: pre-T03 assistant messages without the marker read as COMPLETED.
  assert.equal(resolveRunStatus({ latestTurnRole: "ASSISTANT", metadata: {} }), "COMPLETED");
  assert.equal(resolveRunStatus({ latestTurnRole: "ASSISTANT", metadata: null }), "COMPLETED");
});

test("resolveRunStatus treats a fresh user-last turn as RUNNING but a stale one as ERROR", () => {
  const now = 1_000_000;
  assert.equal(resolveRunStatus({
    latestTurnRole: "USER",
    lastActivityMs: now - 5_000,
    nowMs: now,
    stallMs: 180_000
  }), "RUNNING");
  // No perpetual RUNNING: a user-last turn older than the stall window is ERROR.
  assert.equal(resolveRunStatus({
    latestTurnRole: "USER",
    lastActivityMs: now - 600_000,
    nowMs: now,
    stallMs: 180_000
  }), "ERROR");
  assert.equal(resolveRunStatus({ latestTurnRole: null }), "IDLE");
});

test("normalizeCompletionStatus rejects unknown values", () => {
  assert.equal(normalizeCompletionStatus("running"), "COMPLETED");
  assert.equal(normalizeCompletionStatus("aborted"), "ABORTED");
  assert.equal(normalizeCompletionStatus(undefined, "ERROR"), "ERROR");
});

// --- Contract 2/3: honest ABORTED/ERROR terminal markers with completionStatus + retryOf ---

test("persistDone stores the shown partial with an ABORTED completion marker", async () => {
  const capture = {};
  const result = await persistDone({
    convId: "conv-1",
    userId: "user-1",
    status: "ABORTED",
    finalText: "Osaline vastus mille kasutaja juba nägi",
    isCrisis: false
  }, { prisma: fakePrismaCapturing(capture) });

  assert.equal(result.assistantMessageId, "assistant-1");
  assert.equal(capture.created.content, "Osaline vastus mille kasutaja juba nägi");
  assert.equal(capture.created.metadata.completionStatus, "ABORTED");
});

test("persistDone writes an empty ABORTED marker so hydration is not stuck RUNNING", async () => {
  const capture = {};
  await persistDone({
    convId: "conv-1",
    userId: "user-1",
    status: "ABORTED",
    finalText: "",
    isCrisis: false
  }, { prisma: fakePrismaCapturing(capture) });

  assert.equal(capture.createCalls, 1);
  assert.equal(capture.created.content, "");
  assert.equal(capture.created.metadata.completionStatus, "ABORTED");
});

test("persistDone writes an empty ERROR marker for a failed non-crisis turn", async () => {
  const capture = {};
  await persistDone({
    convId: "conv-1",
    userId: "user-1",
    status: "ERROR",
    finalText: "",
    isCrisis: false
  }, { prisma: fakePrismaCapturing(capture) });

  assert.equal(capture.createCalls, 1);
  assert.equal(capture.created.content, "");
  assert.equal(capture.created.metadata.completionStatus, "ERROR");
});

test("persistDone still shows the crisis fallback even when the turn errors", async () => {
  const capture = {};
  await persistDone({
    convId: "conv-1",
    userId: "user-1",
    status: "ERROR",
    finalText: "",
    isCrisis: true,
    replyLang: "ru"
  }, { prisma: fakePrismaCapturing(capture) });

  assert.equal(capture.created.content, langStrings("ru").crisisNoCtx);
  assert.match(capture.created.content, /112/);
  assert.equal(capture.created.metadata.completionStatus, "ERROR");
  assert.equal(capture.created.metadata.isCrisis, true);
});

test("persistDone links a retry to the failed turn via retryOf", async () => {
  const capture = {};
  await persistDone({
    convId: "conv-1",
    userId: "user-1",
    status: "COMPLETED",
    finalText: "Uus vastus pärast kordust",
    retryOf: "assistant-failed-42",
    isCrisis: false
  }, { prisma: fakePrismaCapturing(capture) });

  assert.equal(capture.created.metadata.completionStatus, "COMPLETED");
  assert.equal(capture.created.metadata.retryOf, "assistant-failed-42");
});

test("a COMPLETED empty turn still creates no message (VEST-P0 behavior preserved)", async () => {
  const capture = {};
  const result = await persistDone({
    convId: "conv-1",
    userId: "user-1",
    status: "COMPLETED",
    finalText: "",
    isCrisis: false
  }, { prisma: fakePrismaCapturing(capture) });

  assert.equal(capture.createCalls || 0, 0);
  assert.equal(result.assistantMessageId, null);
});

// --- Contract 2: server Stop aborts the provider, releases usage, never persists the full reply ---

async function drainSseBody(res) {
  const reader = res.body.getReader();
  // Guard against a hung stream in case of a regression.
  const deadline = Date.now() + 5000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (Date.now() > deadline) throw new Error("SSE stream did not close after abort");
    const { done } = await reader.read();
    if (done) break;
  }
}

test("streaming Stop aborts the provider, releases usage and does not run the COMPLETED finalize", async () => {
  const controller = new AbortController();
  let capturedSignal = null;
  let commitCalls = 0;
  let releaseCalls = 0;
  let finalizeCalls = 0;

  const deps = {
    streamOpenAI: async ({ signal }) => {
      capturedSignal = signal;
      return (async function* () {
        yield { type: "delta", text: "Osaline vastus" };
        // The user presses Stop mid-stream.
        controller.abort();
        // Anything after the abort must never be shown or persisted.
        yield { type: "delta", text: " TÄISVASTUS MIDA EI TOHI PÜSISTADA" };
        yield { type: "done" };
      })();
    },
    finalizeAssistantReply: async () => {
      finalizeCalls += 1;
      return { attachments: [] };
    },
    persistInit: async () => {}
  };

  const res = await handleMainChatResponse({
    req: { signal: controller.signal },
    wantStream: true,
    persist: false,
    convId: "conv-abort",
    userId: "user-1",
    normalizedRole: "CLIENT",
    effectiveMessage: "Pikk küsimus",
    modelUserMessage: "Pikk küsimus",
    messageLength: 12,
    history: [],
    effectiveContext: "Mingi kontekst mudelile",
    grounding: "ok",
    includeSources: false,
    replyLang: "et",
    isCrisis: false,
    extraSystemInstructions: [],
    sources: [],
    retrievalMeta: {},
    metadataExtra: null,
    wantsDocumentDownload: false,
    roomId: null,
    saveRoomMessage: null,
    noContextReply: langStrings("et").noContext,
    noContextMeta: {},
    makeError: () => ({ error: true }),
    logInfo: () => {},
    logError: () => {},
    logEvent: async () => {},
    onUsageCommit: async () => { commitCalls += 1; },
    onUsageRelease: async () => { releaseCalls += 1; }
  }, deps);

  await drainSseBody(res);

  assert.ok(capturedSignal, "the abort signal must be threaded into the provider stream");
  assert.equal(finalizeCalls, 0, "the COMPLETED finalize (full-reply persist) must not run on abort");
  assert.equal(commitCalls, 0, "usage must not be committed on abort");
  assert.equal(releaseCalls, 1, "the unused reservation must be released on abort");
});
