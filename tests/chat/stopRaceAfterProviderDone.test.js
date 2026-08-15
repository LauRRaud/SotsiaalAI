import { register } from "node:module";
import test from "node:test";
import assert from "node:assert/strict";

register(new URL("./serverOnlyTestLoader.mjs", import.meta.url), import.meta.url);

const [{ handleMainChatResponse }, { langStrings }] = await Promise.all([
  import("../../lib/chat/mainResponseHandler.js"),
  import("../../lib/chat/promptBuilder.js")
]);

/**
 * SOL-CHAT-05 — Stop pärast provider'i `done` sündmust.
 *
 * Vana kood pani `streamFinalized = true` kohe finaliseerimisse SISENEMISEL, seega hilisem
 * `finalizeStreamAbort()` ei teinud enam midagi: kasutaja nägi katkestatud teksti, aga server
 * commit'is ja püsistas KOGU provider'i puhvri. Siin mõõdetakse kolme ajastust eraldi ja neljandat
 * vastupidises suunas (Stop pärast `done`-i EI tohi lõpetatud pööret tagasi võtta).
 *
 * Teine pool leidu: püsiv tekst peab olema see, mis PÄRISELT välja saadeti (`emitted`), mitte
 * provider'i puhver (`accumulated`).
 */

const HIDDEN = " SEDA TEKSTI KASUTAJA EI NÄINUD";
const SHOWN = "Nähtav ja kasutatav osa vastusest.";

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

function harness({ streamOpenAI, logEvent, persist = true }) {
  const controller = new AbortController();
  const calls = {
    commit: 0,
    release: [],
    persisted: [],
    finalizeCalls: 0,
    events: []
  };
  const input = {
    req: { signal: controller.signal },
    wantStream: true,
    persist,
    convId: "conv-stop",
    userId: "user-1",
    normalizedRole: "CLIENT",
    effectiveMessage: "Pikk küsimus",
    modelUserMessage: "Pikk küsimus",
    messageLength: 12,
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
    makeError: (key, status) => ({ error: true, key, status }),
    logInfo: () => {},
    logError: () => {},
    logEvent: async (name, payload) => {
      calls.events.push({ name, payload });
      if (typeof logEvent === "function") await logEvent(name, payload, controller);
    },
    onUsageCommit: async () => { calls.commit += 1; },
    onUsageRelease: async (reason) => { calls.release.push(reason); }
  };
  const deps = {
    streamOpenAI: async ({ signal }) => streamOpenAI({ signal, controller }),
    persistInit: async () => true,
    persistDone: async (payload) => {
      calls.persisted.push(payload);
      if (typeof payload.settleUsage === "function") await payload.settleUsage(null);
      return { assistantMessageId: "assistant-1", reused: false };
    },
    finalizeAssistantReply: async ({ reply, settleUsage }) => {
      calls.finalizeCalls += 1;
      calls.finalizedReply = reply;
      if (typeof settleUsage === "function") await settleUsage(null);
      return { attachments: [], persisted: { required: true, durable: true } };
    }
  };
  return { input, deps, calls, controller };
}

test("Stop TÄPSELT provider'i `done` hetkel: täisvastust ei commit'ita ega püsistata", async () => {
  const { input, deps, calls } = harness({
    streamOpenAI: ({ controller }) => (async function* () {
      yield { type: "delta", text: SHOWN };
      // Kasutaja vajutab Stop pärast seda, kui provider on kogu teksti juba andnud.
      yield { type: "delta", text: HIDDEN };
      controller.abort();
      yield { type: "done" };
    })()
  });

  const res = await handleMainChatResponse(input, deps);
  const body = await readSse(res);

  assert.equal(calls.finalizeCalls, 0, "COMPLETED finalize ei tohi joosta");
  assert.equal(calls.commit, 1, "juba nähtav osaline vastus peab kasutuse arvestama");
  assert.deepEqual(calls.release, []);
  assert.ok(!body.includes("event: done"), "`done` on lubadus, mida katkestatud pööre ei anna");

  const marker = calls.persisted.at(-1);
  assert.equal(marker.status, "ABORTED");
  assert.ok(!marker.finalText.includes(HIDDEN.trim()), "peidetud teksti ei tohi püsistada");

  /* Mõõt selle kohta, et võistlusaken oli selles jooksus PÄRISELT olemas: provider'i puhvris oli
     teksti, mida kliendile ei saadetud. Kui see number oleks null, ei tõendaks test midagi. */
  const abortEvent = calls.events.find(event => event.name === "chat_stream_aborted");
  assert.ok(abortEvent.payload.discardedChars > 0, "vana kood oleks selle teksti püsistanud");
});

test("püsiv tekst on VÄLJA SAADETUD tekst, mitte provider'i puhver", async () => {
  const { input, deps, calls } = harness({
    streamOpenAI: ({ controller }) => (async function* () {
      yield { type: "delta", text: SHOWN };
      controller.abort();
      // Pärast abort'i tulev tekst jõuab `accumulated`-isse, aga mitte kliendini.
      yield { type: "delta", text: HIDDEN };
    })()
  });

  const res = await handleMainChatResponse(input, deps);
  const body = await readSse(res);

  const marker = calls.persisted.at(-1);
  assert.equal(marker.status, "ABORTED");
  assert.ok(!marker.finalText.includes(HIDDEN.trim()));
  assert.ok(!body.includes(HIDDEN.trim()));
  // Sündmus mõõdab vahet ise: kui midagi visati ära, on see number nullist suurem.
  const abortEvent = calls.events.find(event => event.name === "chat_stream_aborted");
  assert.ok(abortEvent, "katkestus peab jätma sündmuse");
  assert.equal(abortEvent.payload.partialChars, marker.finalText.length);
});

test("Stop enne nähtavat väljundit vabastab kasutamata reservatsiooni", async () => {
  const { input, deps, calls, controller } = harness({
    streamOpenAI: () => (async function* () {
      controller.abort();
      yield { type: "delta", text: HIDDEN };
    })()
  });

  const res = await handleMainChatResponse(input, deps);
  await readSse(res);

  assert.equal(calls.commit, 0);
  assert.deepEqual(calls.release, ["chat_stream_aborted"]);
  assert.equal(calls.persisted.at(-1).finalText, "");
});

test("Stop finaliseerimise AWAIT-ide ajal võidab endiselt", async () => {
  // Teine kontrollpunkt: Stop saabub pärast sisenemiskontrolli, aga enne püsivat kirjutust.
  const { input, deps, calls } = harness({
    streamOpenAI: () => (async function* () {
      yield { type: "delta", text: SHOWN };
      yield { type: "done" };
    })(),
    logEvent: async (name, _payload, controller) => {
      if (name === "rag_trace") controller.abort();
    }
  });

  const res = await handleMainChatResponse(input, deps);
  await readSse(res);

  /* Ilma selle sündmuseta ei ole `await`-i, mille ajal Stop saaks saabuda — siis oleks test
     vaikselt roheline ega mõõdaks kontrollpunkti. Seepärast on ta nõue, mitte eeldus. */
  assert.ok(
    calls.events.some(event => event.name === "rag_trace"),
    "kontrollpunkti mõõtmiseks peab finaliseerimises olema vähemalt üks await (rag_trace)"
  );
  assert.equal(calls.finalizeCalls, 0, "Stop enne püsivat kirjutust peab võitma");
  assert.equal(calls.commit, 1, "juba väljasaadetud tekst peab kasutuse arvestama");
  assert.deepEqual(calls.release, []);
});

test("Stop PÄRAST `done` emiteerimist ei võta lõpetatud pööret tagasi", async () => {
  const { input, deps, calls, controller } = harness({
    streamOpenAI: () => (async function* () {
      yield { type: "delta", text: SHOWN };
      yield { type: "done" };
    })()
  });

  const res = await handleMainChatResponse(input, deps);
  const body = await readSse(res);
  // Kasutaja vajutab Stop siis, kui vastus on juba lõpetatud ja kliendile kinnitatud.
  controller.abort();

  assert.ok(body.includes("event: done"));
  assert.equal(calls.finalizeCalls, 1);
  assert.deepEqual(calls.release, [], "lõpetatud pööret ei vabastata");
  assert.equal(
    calls.persisted.filter(entry => entry.status === "ABORTED").length,
    0,
    "hilisem Stop ei tohi kirjutada ABORTED markerit valmis vastuse otsa"
  );
});
