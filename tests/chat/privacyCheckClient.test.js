import assert from "node:assert/strict";
import test from "node:test";

import { requestPrivacyCheck } from "../../lib/privacy/privacyCheckClient.js";

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload
  };
}

test("privacy check retries a transient gateway failure before showing an error", async () => {
  const responses = [
    response(502, { ok: false }),
    response(200, { ok: true, text: "turvaline tekst" })
  ];
  const waits = [];
  let calls = 0;

  const result = await requestPrivacyCheck({
    text: "turvaline tekst",
    workflow: "chat_private",
    fetchImpl: async () => responses[calls++],
    waitImpl: async delay => waits.push(delay),
    retryDelays: [10, 20]
  });

  assert.equal(calls, 2);
  assert.deepEqual(waits, [10]);
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.text, "turvaline tekst");
});

test("privacy confirmation and authentication errors are not retried", async () => {
  for (const status of [409, 401]) {
    let calls = 0;
    const result = await requestPrivacyCheck({
      text: "Kaire Talviste",
      workflow: "chat_private",
      fetchImpl: async () => {
        calls += 1;
        return response(status, status === 409 ? { needsPrivacyConfirmation: true } : { ok: false });
      },
      waitImpl: async () => {
        throw new Error("non-transient response must not wait");
      },
      retryDelays: [10, 20]
    });

    assert.equal(calls, 1);
    assert.equal(result.response.status, status);
  }
});
