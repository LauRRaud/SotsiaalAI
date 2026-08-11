import { register } from "node:module";
import test from "node:test";
import assert from "node:assert/strict";

register(new URL("./serverOnlyTestLoader.mjs", import.meta.url), import.meta.url);

const [{ handleMainChatResponse }, { langStrings }] = await Promise.all([
  import("../../lib/chat/mainResponseHandler.js"),
  import("../../lib/chat/promptBuilder.js")
]);

/**
 * SOL-CHAT-01 — API ei tohi vastata eduga, kui pöörde püsistus ei ole kinnitatud.
 *
 * Sondi (`npm run chat:settle:probe`) väide on ROLLBACK päris andmebaasis. Siin mõõdetakse teist
 * poolt: mida marsruut TEEB, kui püsistus ütles „ei jõudnud kettale". Vana kood ei küsinud seda
 * kordagi — `finalizeAssistantReply()` tagastas alati manused ja vastus läks välja.
 */

function baseInput(overrides = {}) {
  const calls = {
    commit: 0,
    release: [],
    errors: [],
    settleUsageSeen: 0
  };
  const input = {
    req: { signal: new AbortController().signal },
    wantStream: false,
    persist: true,
    convId: "conv-1",
    userId: "user-1",
    normalizedRole: "CLIENT",
    effectiveMessage: "Küsimus",
    modelUserMessage: "Küsimus",
    messageLength: 8,
    history: [],
    effectiveContext: "Kontekst mudelile",
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
    makeError: (key, status) => {
      calls.errors.push({ key, status });
      return { error: true, key, status };
    },
    logInfo: () => {},
    logError: () => {},
    logEvent: async () => {},
    onUsageCommit: async () => { calls.commit += 1; },
    onUsageRelease: async (reason) => { calls.release.push(reason); },
    ...overrides
  };
  return { input, calls };
}

function finalizeReturning(persisted, calls) {
  return async ({ settleUsage }) => {
    if (typeof settleUsage === "function") calls.settleUsageSeen += 1;
    return { attachments: [], persisted };
  };
}

async function readSse(res) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  const deadline = Date.now() + 5000;
  while (true) {
    if (Date.now() > deadline) throw new Error("SSE stream did not close");
    const { value, done } = await reader.read();
    if (value) text += decoder.decode(value, { stream: true });
    if (done) break;
  }
  return text;
}

test("non-stream: kinnitamata püsistus annab 503 ja vabastab ühiku, mitte ei arvesta seda", async () => {
  const { input, calls } = baseInput();
  const response = await handleMainChatResponse(input, {
    callOpenAI: async () => ({ reply: "Täisvastus" }),
    persistInit: async () => true,
    finalizeAssistantReply: finalizeReturning({ required: true, durable: false }, calls)
  });

  assert.equal(calls.settleUsageSeen, 1, "arveldus tuleb anda finaliseerijale, mitte teha ise");
  assert.equal(calls.commit, 0, "eraldi commit'i ei tohi olla");
  assert.deepEqual(calls.release, ["chat_reply_not_durable"]);
  assert.deepEqual(calls.errors, [{ key: "chat.error.not_saved", status: 503 }]);
  assert.equal(response.error, true);
});

test("non-stream: kinnitatud püsistus ei vabasta ega commit'i eraldi", async () => {
  const { input, calls } = baseInput();
  const response = await handleMainChatResponse(input, {
    callOpenAI: async () => ({ reply: "Täisvastus" }),
    persistInit: async () => true,
    finalizeAssistantReply: finalizeReturning({ required: true, durable: true }, calls)
  });

  assert.equal(calls.commit, 0);
  assert.deepEqual(calls.release, []);
  assert.deepEqual(calls.errors, []);
  assert.equal(response.status, 200);
});

test("persist=false rada arveldab endiselt eraldi sammuna", async () => {
  const { input, calls } = baseInput({ persist: false });
  await handleMainChatResponse(input, {
    callOpenAI: async () => ({ reply: "Täisvastus" }),
    persistInit: async () => true,
    finalizeAssistantReply: finalizeReturning({ required: false, durable: true }, calls)
  });

  assert.equal(calls.commit, 1, "ilma püsiva vestluseta ei ole millegagi siduda");
  assert.deepEqual(calls.release, []);
  assert.deepEqual(calls.errors, []);
});

test("voog: kinnitamata püsistus ei emiteeri `done`, vaid vea", async () => {
  const { input, calls } = baseInput({ wantStream: true });
  const response = await handleMainChatResponse(input, {
    streamOpenAI: async () => (async function* () {
      yield { type: "delta", text: "Osa vastusest" };
      yield { type: "done" };
    })(),
    persistInit: async () => true,
    finalizeAssistantReply: finalizeReturning({ required: true, durable: false }, calls)
  });

  const body = await readSse(response);
  assert.ok(!body.includes("event: done"), "kadunud vastust ei tohi lugeda lõpetatuks");
  assert.ok(body.includes("event: error"));
  assert.ok(body.includes("chat.error.not_saved"));
  assert.equal(calls.commit, 0);
  assert.deepEqual(calls.release, ["chat_reply_not_durable"]);
});

test("voog: kinnitatud püsistus emiteerib `done` ja ei vabasta midagi", async () => {
  const { input, calls } = baseInput({ wantStream: true });
  const response = await handleMainChatResponse(input, {
    streamOpenAI: async () => (async function* () {
      yield { type: "delta", text: "Osa vastusest" };
      yield { type: "done" };
    })(),
    persistInit: async () => true,
    finalizeAssistantReply: finalizeReturning({ required: true, durable: true }, calls)
  });

  const body = await readSse(response);
  assert.ok(body.includes("event: done"));
  assert.ok(!body.includes("chat.error.not_saved"));
  assert.deepEqual(calls.release, []);
  assert.equal(calls.commit, 0);
});

test("kasutaja küsimuse kirjutamise viga peatab pöörde ENNE providerit", async () => {
  const { input, calls } = baseInput();
  let providerCalls = 0;
  const response = await handleMainChatResponse(input, {
    callOpenAI: async () => {
      providerCalls += 1;
      return { reply: "Seda ei tohi tekkida" };
    },
    persistInit: async () => false,
    finalizeAssistantReply: finalizeReturning({ required: true, durable: true }, calls)
  });

  assert.equal(providerCalls, 0, "tasulist kutset ei tohi teha, kui küsimust ei salvestatud");
  assert.deepEqual(calls.release, ["chat_persist_init_failed"]);
  assert.deepEqual(calls.errors, [{ key: "chat.error.not_saved", status: 503 }]);
  assert.equal(response.error, true);
});

test("no-context rada käib sama värava alt läbi", async () => {
  const { input, calls } = baseInput({ effectiveContext: "" });
  const response = await handleMainChatResponse(input, {
    persistInit: async () => true,
    finalizeAssistantReply: finalizeReturning({ required: true, durable: false }, calls)
  });

  assert.equal(calls.settleUsageSeen, 1);
  assert.deepEqual(calls.release, ["chat_reply_not_durable"]);
  assert.deepEqual(calls.errors, [{ key: "chat.error.not_saved", status: 503 }]);
  assert.equal(response.error, true);
});
