import { register } from "node:module";
import test from "node:test";
import assert from "node:assert/strict";

register(new URL("./serverOnlyTestLoader.mjs", import.meta.url), import.meta.url);

const [{ POST }, { langStrings }] = await Promise.all([
  import("../../app/api/chat/route.js"),
  import("../../lib/chat/promptBuilder.js")
]);

const staleHistory = [
  { role: "user", text: "Kes on Laur Raudsoo?" },
  { role: "assistant", text: "Laur Raudsoo kirjutas 2025. aastal tehisintellektist." }
];

function bootstrapData(effectiveMessage) {
  return {
    payload: {},
    rawHistory: staleHistory,
    wantStream: false,
    persist: false,
    convId: "conv-answer-history",
    roomId: null,
    ephemeralChunks: [],
    ephemeralSource: null,
    combineSources: false,
    forceSources: true,
    includeSources: true,
    wantsDocumentDownload: false,
    userId: "user-answer-history",
    normalizedRole: "CLIENT",
    history: staleHistory,
    helpWorkflowState: null,
    replyLang: "et",
    greeting: false,
    clarifyingTurns: 0,
    requestedThoroughness: null,
    L: langStrings("et"),
    isCrisis: false,
    hasHistory: true,
    effectiveMessage,
    forcedMode: "rag",
    effectiveExplicitHelpIntent: "service_guidance",
    documentWorkflowState: null,
    helpForcedIntent: null,
    shouldUseDocumentWorkflow: false,
    shouldUseHelpWorkflow: false,
    clientTurnKey: null,
    sessionTurnLimit: null
  };
}

async function capturedMainInput(effectiveMessage) {
  let captured = null;
  const response = await POST(new Request("http://localhost/api/chat", { method: "POST" }), {
    bootstrapChatRequest: async () => ({ data: bootstrapData(effectiveMessage) }),
    handleDocumentWorkflowBranch: async () => null,
    handleHelpWorkflowBranch: async () => null,
    reserveUsageForRequest: async ({ metric }) => ({ metric }),
    commitUsageForRequest: async () => {},
    releaseUsageForRequest: async () => {},
    logEvent: async () => {},
    assembleRetrievalContext: async () => ({
      previousSourceUseRequest: false,
      sourceLookupRequest: false,
      extraSystemInstructions: [],
      effectiveContext: "OTT-süsteem kasutab 45 näitajat.",
      grounding: "rag",
      sources: [{ title: "Tehisintellekt sotsiaaltöös" }],
      retrievalMeta: {
        sourceCount: 1,
        rawMatchesCount: 1,
        hadDocContext: false,
        ragSearchFailed: false
      }
    }),
    handleMainChatResponse: async input => {
      captured = input;
      return Response.json({ ok: true });
    }
  });

  assert.equal(response.status, 200);
  assert.ok(captured);
  return captured;
}

test("a standalone topic question does not inherit stale answer history", async () => {
  const input = await capturedMainInput(
    "Kuidas kasutab Eesti Töötukassa OTT-süsteem tehisintellekti ning milliseid piiranguid kasutajad esile tõid?"
  );

  assert.deepEqual(input.history, []);
});

test("an explicit follow-up keeps recent answer history", async () => {
  const input = await capturedMainInput("Aga milliseid piiranguid kasutajad nimetasid?");

  assert.deepEqual(input.history, staleHistory);
});
