import assert from "node:assert/strict";
import test from "node:test";

import { isRagProxyBodyLimitError, limitRagProxyBody } from "../../lib/rag/proxyBodyLimit.js";

function bodyFrom(parts) {
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(new TextEncoder().encode(part));
      controller.close();
    }
  });
}

async function read(stream) {
  const reader = stream.getReader();
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) return total;
    total += value.byteLength;
  }
}

test("proxy counts actual chunked bytes instead of trusting Content-Length", async () => {
  assert.equal(await read(limitRagProxyBody(bodyFrom(["123", "456"]), 6)), 6);
  await assert.rejects(
    read(limitRagProxyBody(bodyFrom(["1234", "5678"]), 7)),
    (error) => isRagProxyBodyLimitError(error)
  );
});

test("parallel oversized streams are independently stopped", async () => {
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, () => read(limitRagProxyBody(bodyFrom(["12345", "67890"]), 8)))
  );
  assert.equal(results.filter((item) => item.status === "rejected").length, 8);
  assert.ok(results.every((item) => isRagProxyBodyLimitError(item.reason)));
});
