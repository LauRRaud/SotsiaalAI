import { register } from "node:module";
import test from "node:test";
import assert from "node:assert/strict";

register(new URL("./serverOnlyTestLoader.mjs", import.meta.url), import.meta.url);

const { bootstrapChatRequest, MAX_USER_MESSAGE_CHARS } = await import("../../lib/chat/requestBootstrap.js");

function makeError(messageKey, status = 400) {
  return { __error: true, messageKey, status };
}

const limits = {
  chatPostRateLimitMax: 100,
  chatRateLimitWindowMs: 60000,
  historyMaxItems: 8,
  historyMaxChars: 800,
  historyWithDocMaxItems: 8,
  historyWithDocMaxChars: 800,
  ephemeralChunksMax: 80,
  ephemeralChunkCharsMax: 1800
};

function bootstrapDeps() {
  return {
    getServerSessionSafe: async () => ({ user: { id: "user-1" } }),
    enforceChatRateLimit: () => null
  };
}

test("the visible message limit is 4000 characters", () => {
  assert.equal(MAX_USER_MESSAGE_CHARS, 4000);
});

test("a message over 4000 characters is rejected with 413 before any persistence or provider call", async () => {
  const result = await bootstrapChatRequest({
    req: {
      json: async () => ({ message: "a".repeat(MAX_USER_MESSAGE_CHARS + 1), persist: true, convId: "conv-x" }),
      cookies: {}
    },
    prisma: {},
    makeError,
    logInfo: () => {},
    logEvent: async () => {},
    limits,
    deps: bootstrapDeps()
  });

  assert.ok(result.response, "an over-limit message must short-circuit with a response");
  assert.equal(result.response.status, 413);
  assert.equal(result.response.messageKey, "chat.error.message_too_long");
  assert.equal(result.data, undefined, "no request data must be produced for a rejected message");
});
