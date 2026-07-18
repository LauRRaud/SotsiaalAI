import assert from "node:assert/strict";
import test from "node:test";

import { assertSafeFetchUrl, safeFetch, SafeFetchError } from "../../scripts/lib/safe-fetch.mjs";

const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }];

test("safe fetch blocks private targets before a request is made", async () => {
  await assert.rejects(
    () => assertSafeFetchUrl("http://127.0.0.1/internal", { lookup: publicLookup }),
    error => error instanceof SafeFetchError && error.code === "blocked_address"
  );
  await assert.rejects(
    () => assertSafeFetchUrl("file:///etc/passwd", { lookup: publicLookup }),
    error => error instanceof SafeFetchError && error.code === "forbidden_scheme"
  );
});

test("safe fetch revalidates every redirect hop", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } });
  };
  await assert.rejects(
    () => safeFetch("https://example.org/start", { lookup: publicLookup, fetchImpl }),
    error => error instanceof SafeFetchError && error.code === "blocked_address"
  );
  assert.equal(calls.length, 1);
});

test("safe fetch bounds response bytes and preserves only fetch metadata", async () => {
  const response = await safeFetch("https://example.org/guide", {
    lookup: publicLookup,
    fetchImpl: async () => new Response("guide text", { status: 200, headers: { "content-type": "text/html" } })
  });
  assert.equal(response.ok, true);
  assert.equal(response.finalUrl, "https://example.org/guide");
  assert.equal(response.body.toString("utf8"), "guide text");
  await assert.rejects(
    () => safeFetch("https://example.org/large", {
      lookup: publicLookup,
      maxBytes: 3,
      fetchImpl: async () => new Response("too large", { status: 200 })
    }),
    error => error instanceof SafeFetchError && error.code === "response_too_large"
  );
});
