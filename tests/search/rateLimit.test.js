import test from "node:test";
import assert from "node:assert/strict";

import { consumePersonalSearchRateLimit } from "@/lib/search/rateLimit";

function request(headers = {}) {
  return { headers: new Headers(headers) };
}

test("spoofable forwarding headers do not select the durable bucket", async () => {
  const oldHeader = process.env.TRUSTED_PROXY_IP_HEADER;
  delete process.env.TRUSTED_PROXY_IP_HEADER;
  const keys = [];
  const prisma = {
    $queryRawUnsafe: async (_sql, key) => {
      keys.push(key);
      return [{ count: 1, resetAt: new Date(Date.now() + 60_000) }];
    }
  };
  try {
    await consumePersonalSearchRateLimit({
      prisma, request: request({ "x-forwarded-for": "198.51.100.1" }), userId: "owner"
    });
    await consumePersonalSearchRateLimit({
      prisma, request: request({ "x-real-ip": "203.0.113.9" }), userId: "owner"
    });
    assert.equal(keys[0], keys[1]);
  } finally {
    if (oldHeader == null) delete process.env.TRUSTED_PROXY_IP_HEADER;
    else process.env.TRUSTED_PROXY_IP_HEADER = oldHeader;
  }
});

test("configured trusted proxy header uses its edge-appended value", async () => {
  const oldHeader = process.env.TRUSTED_PROXY_IP_HEADER;
  process.env.TRUSTED_PROXY_IP_HEADER = "x-edge-client-ip";
  const keys = [];
  const prisma = {
    $queryRawUnsafe: async (_sql, key) => {
      keys.push(key);
      return [{ count: 1, resetAt: new Date(Date.now() + 60_000) }];
    }
  };
  try {
    await consumePersonalSearchRateLimit({
      prisma,
      request: request({ "x-edge-client-ip": "spoofed, 198.51.100.2" }),
      userId: "owner"
    });
    await consumePersonalSearchRateLimit({
      prisma,
      request: request({ "x-edge-client-ip": "spoofed, 198.51.100.3" }),
      userId: "owner"
    });
    assert.notEqual(keys[0], keys[1]);
  } finally {
    if (oldHeader == null) delete process.env.TRUSTED_PROXY_IP_HEADER;
    else process.env.TRUSTED_PROXY_IP_HEADER = oldHeader;
  }
});

test("missing durable storage fails closed", async () => {
  await assert.rejects(
    consumePersonalSearchRateLimit({ prisma: {}, request: request(), userId: "owner" }),
    /STORAGE_UNAVAILABLE/u
  );
});
