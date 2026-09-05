import assert from "node:assert/strict";
import { mock, test } from "node:test";

let auth = { ok: false, status: 401, message: "api.common.unauthorized" };
let limited = null;
mock.module("../lib/chat/routeServerUtils.js", {
  exports: {
    CHAT_NO_STORE_HEADERS: { "Cache-Control": "no-store" },
    requireChatUser: async () => auth
  }
});
mock.module("../lib/chat-api-rate-limit.js", {
  exports: {
    readChatRateLimit: (_value, fallback) => fallback,
    enforceChatRateLimit: () => limited
  }
});
const { POST } = await import("../app/api/chat/route.js");

test("paused generation preserves authentication and rate limits without consuming the message", async () => {
  let reads = 0;
  const request = { json: async () => { reads += 1; throw new Error("Message must remain unread"); } };
  assert.equal((await POST(request)).status, 401);
  auth = { ok: true, userId: "test-owner" };
  limited = new Response(null, { status: 429 });
  assert.equal((await POST(request)).status, 429);
  limited = null;
  const response = await POST(request);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).code, "RAG_RETIRED");
  assert.equal(reads, 0);
});
