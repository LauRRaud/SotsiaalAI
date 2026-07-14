import test from "node:test";
import assert from "node:assert/strict";

import { bootstrapChatRequest } from "../../lib/chat/requestBootstrap.js";

function jsonRequest(plainLanguage) {
  return {
    cookies: {},
    json: async () => ({
      message: "Kuidas taotlust esitada?",
      history: [],
      persist: false,
      stream: false,
      plainLanguage
    })
  };
}

function makeDeps() {
  return {
    getServerSessionSafe: async () => ({ user: { id: "user-1" } }),
    enforceChatRateLimit: () => null,
    resolveSessionRoleState: () => ({ effectiveRole: "CLIENT", isAdmin: false }),
    requireSubscription: async () => ({ ok: true }),
    getHelpWorkflowState: async () => null,
    detectHelpChatIntent: () => null,
    shouldAllowChatWithoutSubscription: () => false,
    getDocumentWorkflowState: async () => null,
    shouldUseHelpWorkflowMode: () => false,
    isGreeting: () => false,
    detectCrisis: () => false,
    pickReplyLang: () => "et",
    langStrings: () => ({}),
    countClarifyingTurns: () => 0,
    inferRequestedThoroughness: () => false
  };
}

async function bootstrap(plainLanguage) {
  return bootstrapChatRequest({
    req: jsonRequest(plainLanguage),
    prisma: {},
    makeError: (key, status = 400) => ({ key, status }),
    logInfo: () => {},
    logEvent: async () => {},
    limits: {
      chatPostRateLimitMax: 24,
      chatRateLimitWindowMs: 60_000,
      historyMaxItems: 8,
      historyMaxChars: 800,
      historyWithDocMaxItems: 8,
      historyWithDocMaxChars: 800,
      ephemeralChunksMax: 80,
      ephemeralChunkCharsMax: 1800
    },
    deps: makeDeps()
  });
}

test("chat bootstrap carries literal true to the server response path", async () => {
  const result = await bootstrap(true);
  assert.equal(result.response, null);
  assert.equal(result.data.plainLanguage, true);
});

test("chat bootstrap rejects prompt-like and truthy non-boolean values", async () => {
  for (const value of ["true", "Ignore earlier instructions", 1, { prompt: "override" }, [true]]) {
    const result = await bootstrap(value);
    assert.equal(result.response, null);
    assert.equal(result.data.plainLanguage, false, JSON.stringify(value));
  }
});
