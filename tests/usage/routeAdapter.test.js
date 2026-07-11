import assert from "node:assert/strict";
import test from "node:test";

import {
  buildUsageIdempotencyKey,
  commitUsageForRequest,
  releaseUsageForRequest,
  reserveUsageForRequest,
  usageErrorDescriptor
} from "../../lib/usage/routeAdapter.js";

function requestWithKey(value) {
  return {
    headers: new Headers(value ? { "Idempotency-Key": value } : {})
  };
}

test("route usage keys are scoped and preserve client retry keys", () => {
  assert.equal(buildUsageIdempotencyKey(requestWithKey("retry_1"), "documents.generate"), "documents.generate:retry_1");
  assert.match(buildUsageIdempotencyKey(requestWithKey(), "chat.reply"), /^chat\.reply:[0-9a-f-]{36}$/);
});

test("route adapter reserves, commits and releases through one service contract", async () => {
  const calls = [];
  const service = {
    async reserve(input) {
      calls.push(["reserve", input]);
      return {
        reservation: { id: "reservation_1", status: "RESERVED" },
        bucket: { remaining: 4n },
        reused: false
      };
    },
    async commit(input) {
      calls.push(["commit", input]);
      return { ok: true };
    },
    async release(input) {
      calls.push(["release", input]);
      return { ok: true };
    }
  };

  const handle = await reserveUsageForRequest({
    request: requestWithKey("retry_2"),
    userId: "user_1",
    metric: "DOCUMENT_GENERATE",
    amount: 1,
    scope: "documents.generate",
    service
  });
  await commitUsageForRequest(handle);
  await releaseUsageForRequest(handle, { reason: "provider_error" });

  assert.deepEqual(calls.map(([name]) => name), ["reserve", "commit", "release"]);
  assert.equal(calls[0][1].idempotencyKey, "documents.generate:retry_2");
  assert.equal(calls[1][1].actualAmount, 1n);
  assert.equal(calls[2][1].reason, "provider_error");
});

test("limit errors serialize BigInt counters into a structured 429 descriptor", () => {
  const resetAt = new Date(Date.now() + 60_000);
  const descriptor = usageErrorDescriptor({
    code: "USAGE_LIMIT_EXCEEDED",
    details: {
      bucket: {
        metric: "FILE_ANALYZE",
        used: 4n,
        reserved: 0n,
        hardLimit: 4n,
        remaining: 0n,
        periodEnd: resetAt
      }
    }
  }, "analyze_file");

  assert.equal(descriptor.status, 429);
  assert.equal(descriptor.body.usage.used, 4);
  assert.equal(descriptor.body.usage.limit, 4);
  assert.equal(descriptor.body.usage.remaining, 0);
  assert.equal(descriptor.body.usage.resetAt, resetAt.toISOString());
  assert.ok(Number(descriptor.headers["Retry-After"]) >= 1);
});
