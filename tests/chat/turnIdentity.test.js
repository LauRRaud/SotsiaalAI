import { register } from "node:module";
import test from "node:test";
import assert from "node:assert/strict";

register(new URL("./serverOnlyTestLoader.mjs", import.meta.url), import.meta.url);

const [{ handleMainChatResponse }, { langStrings }, { normalizeClientTurnKey, CHAT_TURN_OUTCOME }] =
  await Promise.all([
    import("../../lib/chat/mainResponseHandler.js"),
    import("../../lib/chat/promptBuilder.js"),
    import("../../lib/chat/turnRegistry.js")
  ]);

/**
 * SOL-CHAT-03/-04 — marsruudi otsus pöörde nõude tulemuse peale.
 *
 * Sond (`npm run chat:turn:probe`) mõõdab võidujooksu päris andmebaasis. Siin mõõdetakse teist
 * poolt: mida marsruut TEEB iga tulemusega — kas ta kutsub providerit, kas ta arveldab, mis
 * staatuse kasutaja saab.
 */

function harness(overrides = {}) {
  const calls = { commit: 0, release: [], errors: [], provider: 0, claims: [], finalizeTurnIds: [] };
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
    makeError: (key, status, extra) => {
      calls.errors.push({ key, status, extra });
      return { error: true, key, status, extra };
    },
    logInfo: () => {},
    logError: () => {},
    logEvent: async () => {},
    onUsageCommit: async () => { calls.commit += 1; },
    onUsageRelease: async (reason) => { calls.release.push(reason); },
    clientTurnKey: "intent-1",
    sessionTurnLimit: 20,
    ...overrides
  };
  return { input, calls };
}

function deps(calls, claimResult) {
  return {
    claimChatTurn: async (claimInput) => {
      calls.claims.push(claimInput);
      return claimResult;
    },
    callOpenAI: async () => {
      calls.provider += 1;
      return { reply: "Uus vastus" };
    },
    persistInit: async () => {
      calls.legacyInit = (calls.legacyInit || 0) + 1;
      return true;
    },
    finalizeAssistantReply: async ({ turnId, settleUsage }) => {
      calls.finalizeTurnIds.push(turnId);
      if (typeof settleUsage === "function") await settleUsage(null);
      return { attachments: [], persisted: { required: true, durable: true } };
    }
  };
}

test("normalizeClientTurnKey lükkab tagasi tühja, liiga pika ja ohtliku võtme", () => {
  assert.equal(normalizeClientTurnKey("  "), null);
  assert.equal(normalizeClientTurnKey("a".repeat(101)), null);
  assert.equal(normalizeClientTurnKey("kala mees"), null, "tühik ei kuulu võtmesse");
  assert.equal(normalizeClientTurnKey("intent-1"), "intent-1");
  assert.equal(normalizeClientTurnKey(" chat.reply:9f2 "), "chat.reply:9f2");
});

test("lõpetatud kavatsuse kordus tagastab salvestatud vastuse ilma providerita", async () => {
  const { input, calls } = harness();
  const response = await handleMainChatResponse(input, deps(calls, {
    outcome: CHAT_TURN_OUTCOME.REPLAYED,
    turn: { id: "turn-1", attempt: 2 },
    replay: {
      content: "Varem antud vastus",
      metadata: { sources: [{ title: "Allikas" }], attachments: [], cards: [] }
    }
  }));

  assert.equal(calls.provider, 0, "korduse eest ei tehta uut tasulist tööd");
  assert.equal(calls.commit, 0);
  assert.deepEqual(calls.release, []);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.reply, "Varem antud vastus");
  assert.equal(body.sources[0].title, "Allikas");
});

test("juba töös oleva pöörde kordus ei vabasta algse päringu reservatsiooni", async () => {
  const { input, calls } = harness({ chatUsageReused: true });
  await handleMainChatResponse(input, deps(calls, {
    outcome: CHAT_TURN_OUTCOME.IN_FLIGHT,
    turn: { id: "turn-1" }
  }));

  assert.equal(calls.provider, 0);
  assert.deepEqual(calls.errors, [{ key: "chat.error.turn_in_flight", status: 409, extra: undefined }]);
  assert.deepEqual(calls.release, []);
});

test("sama vestluse teine kavatsus korraga annab samuti 409", async () => {
  const { input, calls } = harness();
  await handleMainChatResponse(input, deps(calls, {
    outcome: CHAT_TURN_OUTCOME.CONVERSATION_BUSY,
    turn: { id: "turn-other" }
  }));

  assert.equal(calls.provider, 0);
  assert.equal(calls.errors[0].status, 409);
  assert.deepEqual(calls.release, ["chat_turn_conflict"]);
});

test("sessioonipiir tuleb pöörde nõudest ja annab 429 koos piiriga", async () => {
  const { input, calls } = harness();
  await handleMainChatResponse(input, deps(calls, {
    outcome: CHAT_TURN_OUTCOME.SESSION_LIMIT,
    limit: 20,
    used: 20
  }));

  assert.equal(calls.provider, 0);
  assert.equal(calls.errors[0].key, "api.common.rate_limited");
  assert.equal(calls.errors[0].status, 429);
  assert.deepEqual(calls.errors[0].extra, { scope: "chat_session_turns", limit: 20, used: 20 });
  assert.deepEqual(calls.release, ["chat_session_limit"]);
});

test("õnnestunud nõue kannab pöörde ID terminalse kirjutuseni", async () => {
  const { input, calls } = harness();
  await handleMainChatResponse(input, deps(calls, {
    outcome: CHAT_TURN_OUTCOME.CLAIMED,
    turn: { id: "turn-42" }
  }));

  assert.equal(calls.provider, 1);
  assert.deepEqual(calls.finalizeTurnIds, ["turn-42"]);
  assert.equal(calls.claims[0].sessionTurnLimit, 20);
  assert.equal(calls.claims[0].clientTurnKey, "intent-1");
});

test("ilma kliendivõtmeta jääb vana rada alles, aga ilma kaitseta", async () => {
  const { input, calls } = harness({ clientTurnKey: null });
  await handleMainChatResponse(input, deps(calls, { outcome: CHAT_TURN_OUTCOME.CLAIMED, turn: { id: "x" } }));

  assert.equal(calls.claims.length, 0, "vana klient ei nõua pööret");
  assert.equal(calls.legacyInit, 1, "kasutaja küsimus kirjutatakse endiselt");
  assert.deepEqual(calls.finalizeTurnIds, [null]);
  assert.equal(calls.provider, 1);
});
