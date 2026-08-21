import assert from "node:assert/strict";
import test from "node:test";

const bootstrapModule = await import("../../lib/chat/conversationBootstrap.js").catch(() => ({}));

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}

test("esimene sõnum loob puuduva vestluse serveris enne vestluse kasutamist", async () => {
  assert.equal(
    typeof bootstrapModule.ensureConversationBeforeSend,
    "function",
    "uue vestluse serveripoolne eelloomine puudub"
  );

  const calls = [];
  const knownConversationIds = new Set();
  const conversationId = "conv-11111111-1111-4111-8111-111111111111";
  const ensuredId = await bootstrapModule.ensureConversationBeforeSend({
    conversationId,
    role: "SERVICE_PROVIDER",
    knownConversationIds,
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options });
      if (url.startsWith("/api/chat/run?")) {
        return response(200, { ok: false, notFound: true });
      }
      if (url === "/api/chat/conversations") {
        return response(200, { ok: true, conversation: { id: conversationId } });
      }
      throw new Error(`ootamatu päring: ${url}`);
    }
  });

  assert.equal(ensuredId, conversationId);
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /^\/api\/chat\/run\?convId=/);
  assert.equal(calls[1].url, "/api/chat/conversations");
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    id: conversationId,
    role: "SERVICE_PROVIDER",
    createOnly: true
  });
  assert.equal(knownConversationIds.has(conversationId), true);
});

test("olemasolevat aktiivset vestlust ei looda uuesti ja sama lehe järgmine sõnum ei tee uut kontrolli", async () => {
  assert.equal(typeof bootstrapModule.ensureConversationBeforeSend, "function");

  const calls = [];
  const knownConversationIds = new Set();
  const input = {
    conversationId: "conv-22222222-2222-4222-8222-222222222222",
    role: "SERVICE_PROVIDER",
    knownConversationIds,
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options });
      return response(200, { ok: true, convId: input.conversationId });
    }
  };

  await bootstrapModule.ensureConversationBeforeSend(input);
  await bootstrapModule.ensureConversationBeforeSend(input);

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^\/api\/chat\/run\?convId=/);
});
