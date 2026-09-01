import assert from "node:assert/strict";
import { test } from "node:test";
import { handleMainChatResponse } from "../../lib/chat/mainResponseHandler.js";
import { buildRecoveryBoundMessage, inferNoContextAssistanceMode } from "../../lib/chat/conversationalRecovery.js";
import { classifyModelFailure } from "../../lib/chat/modelFailure.js";
import { resolveReasoningEffortForModel } from "../../lib/chat/settings.js";

test("gpt-5.6 payloads cannot retain the unsupported minimal reasoning effort", () => {
  assert.equal(resolveReasoningEffortForModel("gpt-5.6-luna", "minimal"), "low");
  assert.equal(resolveReasoningEffortForModel("gpt-5.6-terra", "minimal"), "low");
  assert.equal(resolveReasoningEffortForModel("gpt-5.6-luna", "medium"), "medium");
  assert.equal(resolveReasoningEffortForModel("another-model", "minimal"), "minimal");
});

test("model failure classification distinguishes unsupported reasoning effort without retaining provider text", () => {
  const unsupported = Object.assign(
    new Error("400 Unsupported value: 'minimal' is not supported with the selected model."),
    { status: 400 }
  );
  assert.equal(
    classifyModelFailure(unsupported, { reasoningEffort: "minimal" }),
    "model_reasoning_effort_unsupported"
  );
  assert.equal(
    classifyModelFailure(
      new Error("Unsupported value: 'minimal' is not supported with the selected model."),
      { reasoningEffort: "minimal" }
    ),
    "model_reasoning_effort_unsupported"
  );
  assert.equal(classifyModelFailure(new Error("connection reset")), "model_failed");
  assert.equal(
    classifyModelFailure(Object.assign(new Error("cancelled"), { name: "AbortError" })),
    "request_cancelled"
  );
});

function noContextInput(effectiveMessage, normalizedRole = "CLIENT") {
  return {
    req: new Request("http://localhost/api/chat"),
    wantStream: false,
    persist: false,
    convId: "simple-help-conversation",
    userId: "simple-help-user",
    normalizedRole,
    effectiveMessage,
    messageLength: effectiveMessage.length,
    history: [],
    effectiveContext: "",
    grounding: "weak",
    includeSources: false,
    replyLang: "et",
    isCrisis: false,
    extraSystemInstructions: [],
    sources: [],
    retrievalMeta: {},
    metadataExtra: {},
    wantsDocumentDownload: false,
    noContextReply: "Palun täpsusta asukohta.",
    noContextMeta: { ragSearchFailed: false, ragReturned: false, hadDocContext: false },
    makeError: (message, status) => new Response(message, { status })
  };
}

test("location-dependent help questions use a deterministic municipality clarification for clients and workers", async () => {
  assert.equal(inferNoContextAssistanceMode({
    userMessage: "Mul ei ole täna ööbimiskohta. Kust ma abi saan?"
  }), "service_navigation");
  assert.equal(inferNoContextAssistanceMode({
    userMessage: "Kuhu saan kliendi täna öömajale suunata?"
  }), "service_navigation");

  let finalized = null;
  const response = await handleMainChatResponse(
    noContextInput("Mul ei ole täna ööbimiskohta. Kust ma abi saan?"), {
    callOpenAI: async () => { throw new Error("service navigation must not require a model call"); },
    finalizeAssistantReply: async input => {
      finalized = input;
      return { attachments: [], persisted: { required: false } };
    }
  });

  assert.equal(response.status, 200);
  assert.match(finalized.reply, /omavalitsuses/u);
  assert.deepEqual(finalized.sources, []);
  assert.equal(finalized.metadataExtra.workflow.ragRecovery.reason, "service_location_required");
  assert.equal(finalized.metadataExtra.workflow.ragRecovery.replySource, undefined);
  assert.equal(finalized.metadataExtra.workflow.ragRecovery.target, "municipality_scope");
});

test("a municipality continuation never repeats the municipality question when local evidence is still absent", async () => {
  const original = "Mul ei ole täna ööbimiskohta. Kust ma abi saan?";
  let firstPublication = null;
  await handleMainChatResponse(noContextInput(original), {
    callOpenAI: async () => { throw new Error("service navigation must not require a model call"); },
    finalizeAssistantReply: async input => {
      firstPublication = input;
      return { attachments: [], persisted: { required: false } };
    }
  });
  const recoveryState = firstPublication.metadataExtra.workflow.ragRecovery;
  const boundMessage = buildRecoveryBoundMessage({
    message: "Tallinn",
    recoveryState,
    trustedHistory: [{ role: "user", text: original }]
  });
  assert.match(boundMessage, /Tallinn/u);
  assert.equal(inferNoContextAssistanceMode({
    userMessage: boundMessage,
    recoveryContinuation: true
  }), "service_navigation_followup");

  let providerCalls = 0;
  let secondPublication = null;
  const response = await handleMainChatResponse({
    ...noContextInput("Tallinn"),
    ragContractMessage: boundMessage,
    expectedRecoveryAssistantMessageId: "assistant-1",
    recoveryRootUserMessageId: "root-user"
  }, {
    callOpenAI: async () => { providerCalls += 1; return { reply: "Millises omavalitsuses sa praegu viibid?" }; },
    finalizeAssistantReply: async input => {
      secondPublication = input;
      return { attachments: [], persisted: { required: false } };
    }
  });

  assert.equal(response.status, 200);
  assert.equal(providerCalls, 0);
  assert.doesNotMatch(secondPublication.reply, /millises omavalitsuses/u);
  assert.match(secondPublication.reply, /kohalikku kontakti/u);
  assert.match(secondPublication.reply, /abipalve/u);
  assert.equal(secondPublication.metadataExtra.workflow.ragRecovery.reason, "service_location_unresolved_after_clarification");
});

test("a simple provider communication question gets deterministic guidance without model-invented service facts", async () => {
  const message = "Kuidas selgitada inimesele meie teenuse järgmist sammu?";
  assert.equal(inferNoContextAssistanceMode({ userMessage: message }), "general_guidance");

  let providerCalls = 0;
  let finalized = null;
  const response = await handleMainChatResponse(noContextInput(message, "SERVICE_PROVIDER"), {
    callOpenAI: async () => {
      providerCalls += 1;
      return { reply: "Teenusele pääseb ainult perearsti saatekirjaga." };
    },
    finalizeAssistantReply: async input => {
      finalized = input;
      return { attachments: [], persisted: { required: false } };
    }
  });

  assert.equal(response.status, 200);
  assert.equal(providerCalls, 0);
  assert.match(finalized.reply, /järgmine samm/u);
  assert.match(finalized.reply, /aru sai/u);
  assert.doesNotMatch(finalized.reply, /saatekiri|õigus|kättesaadav/u);
  assert.deepEqual(finalized.sources, []);
  assert.equal(finalized.metadataExtra.workflow.ragRecovery.action, "provide_general_guidance");
  assert.equal(finalized.metadataExtra.workflow.ragRecovery.reason, "bounded_non_factual_guidance");
});

test("a streamed unsupported reasoning effort is classified from the observed model request", async () => {
  const stages = [];
  const input = {
    ...noContextInput("Selgita palun lühidalt teenuse järgmist sammu."),
    wantStream: true,
    effectiveContext: "Kinnitatud teenusekirjelduse katkend.",
    ragAttemptController: {
      fence: { id: "attempt", attempt: 1 },
      stage: async (stage, payload) => { stages.push({ stage, payload }); return true; },
      stop: () => {}
    }
  };
  const response = await handleMainChatResponse(input, {
    streamOpenAI: async request => {
      await request.onRuntimeObservation?.({
        configured_model: "gpt-5.6-luna",
        reasoning_effort: "minimal",
        prompt_hash: "c".repeat(64),
        model_settings_hash: "d".repeat(64)
      });
      return (async function* providerStream() {
        throw new Error("Unsupported value: 'minimal' is not supported with the selected model.");
      })();
    }
  });

  assert.match(response.headers.get("content-type") || "", /text\/event-stream/u);
  await response.text();
  assert.deepEqual(
    stages.find(item => item.payload?.failure)?.payload.failure,
    { stage: "model", code: "model_reasoning_effort_unsupported" }
  );
});
