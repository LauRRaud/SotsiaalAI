import test from "node:test";
import assert from "node:assert/strict";

import { GET } from "../../app/api/otsi/route.js";

const OWNER = "user-a";
const req = (q) => ({ url: `https://x.test/api/otsi${q}` });

function makeDeps(overrides = {}) {
  return {
    requireUser: async () => ({ ok: true, userId: OWNER }),
    enforceRateLimit: () => null,
    search: async () => [],
    prisma: {},
    ...overrides
  };
}

test("unauthenticated request is rejected with 401 and never searches", async () => {
  let searched = false;
  const res = await GET(req("?q=abi"), makeDeps({
    requireUser: async () => ({ ok: false, status: 401, message: "api.common.unauthorized" }),
    search: async () => { searched = true; return []; }
  }));
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.messageKey, "api.common.unauthorized");
  assert.equal(searched, false);
});

test("a rate-limited request returns the limiter response and never searches", async () => {
  let searched = false;
  const sentinel = { status: 429, __limiter: true };
  const res = await GET(req("?q=abi"), makeDeps({
    enforceRateLimit: () => sentinel,
    search: async () => { searched = true; return []; }
  }));
  assert.equal(res, sentinel);
  assert.equal(searched, false);
});

test("a too-long query is rejected with 400 before any search", async () => {
  let searched = false;
  const res = await GET(req(`?q=${"x".repeat(200)}`), makeDeps({
    search: async () => { searched = true; return []; }
  }));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.messageKey, "api.search.query_too_long");
  assert.equal(searched, false);
});

test("an empty query returns an empty result without scanning", async () => {
  let searched = false;
  const res = await GET(req("?q=%20%20"), makeDeps({
    search: async () => { searched = true; return []; }
  }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body, { ok: true, results: [] });
  assert.equal(searched, false);
});

test("a server-side failure is reported as a safe 500, not a false empty result", async () => {
  const res = await GET(req("?q=abi"), makeDeps({
    search: async () => { throw new Error("boom secret detail"); }
  }));
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.messageKey, "api.search.unavailable");
  assert.equal(JSON.stringify(body).includes("secret"), false);
});

test("a successful search passes the normalized query + owner through and returns only its results", async () => {
  const seen = [];
  const results = [{ kind: "journey", title: "Abi", status: "ACTIVE", updatedAt: "2026-07-17T00:00:00.000Z", href: "/teekond/j1" }];
  const res = await GET(req("?q=%20%20abi%20%20plaan%20"), makeDeps({
    search: async (args) => { seen.push(args); return results; }
  }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.deepEqual(body.results, results);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].userId, OWNER);
  assert.equal(seen[0].query, "abi plaan");
});
