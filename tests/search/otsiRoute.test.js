import test from "node:test";
import assert from "node:assert/strict";

import { GET, POST } from "../../app/api/otsi/route.js";

const OWNER = "user-a";
const req = (body = {}) => new Request("https://x.test/api/otsi", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body)
});

function makeDeps(overrides = {}) {
  return {
    requireUser: async () => ({ ok: true, userId: OWNER }),
    enforceRateLimit: async () => ({ allowed: true }),
    search: async () => ({
      results: [], partial: false, unavailableKinds: [],
      pagination: { hasMore: false, nextCursor: {} }
    }),
    prisma: {},
    ...overrides
  };
}

test("GET never accepts private search text", async () => {
  const response = await GET();
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
});

test("unauthenticated request is rejected before limiter and search", async () => {
  let limited = false;
  let searched = false;
  const response = await POST(req({ query: "abi" }), makeDeps({
    requireUser: async () => ({ ok: false, status: 401, message: "api.common.unauthorized" }),
    enforceRateLimit: async () => { limited = true; return { allowed: true }; },
    search: async () => { searched = true; return {}; }
  }));
  assert.equal(response.status, 401);
  assert.equal(limited, false);
  assert.equal(searched, false);
});

test("durable limiter runs before payload parsing and scanning", async () => {
  let searched = false;
  const response = await POST(req({ query: "abi" }), makeDeps({
    enforceRateLimit: async () => ({ allowed: false, retryAfterSeconds: 7 }),
    search: async () => { searched = true; return {}; }
  }));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "7");
  assert.equal(searched, false);
});

test("limiter storage failure is fail-closed", async () => {
  const response = await POST(req({ query: "abi" }), makeDeps({
    enforceRateLimit: async () => { throw new Error("database offline"); }
  }));
  assert.equal(response.status, 503);
});

test("invalid, too-long and blank payloads never scan", async () => {
  let searches = 0;
  const deps = makeDeps({ search: async () => { searches += 1; return {}; } });
  const invalid = await POST(new Request("https://x.test/api/otsi", { method: "POST", body: "{" }), deps);
  const long = await POST(req({ query: "x".repeat(200) }), deps);
  const blank = await POST(req({ query: "  " }), deps);
  assert.equal(invalid.status, 400);
  assert.equal(long.status, 400);
  assert.equal(blank.status, 200);
  assert.equal(searches, 0);
});

test("normalized private query and source cursors reach the owner-scoped service via body", async () => {
  const seen = [];
  const result = {
    results: [{ kind: "journey", title: "Abi", href: "/teekond/j1" }],
    partial: true,
    unavailableKinds: ["document"],
    pagination: { hasMore: true, nextCursor: { journey: "j1" } }
  };
  const response = await POST(req({ query: "  abi   plaan ", cursor: { journey: "j0" } }), makeDeps({
    search: async (args) => { seen.push(args); return result; }
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, ...result });
  assert.equal(seen[0].userId, OWNER);
  assert.equal(seen[0].query, "abi plaan");
  assert.deepEqual(seen[0].cursor, { journey: "j0" });
});

test("authorization failures fail the whole response closed", async () => {
  const response = await POST(req({ query: "abi" }), makeDeps({
    search: async () => { throw Object.assign(new Error("FORBIDDEN"), { status: 403 }); }
  }));
  assert.equal(response.status, 403);
  assert.equal((await response.json()).messageKey, "api.common.forbidden");
});
