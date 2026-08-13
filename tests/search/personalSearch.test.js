import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizePersonalSearchCursor,
  normalizePersonalSearchQuery,
  searchPersonalObjects,
  PERSONAL_SEARCH_LIMITS
} from "@/lib/search/personalSearch";

function fakePrisma(calls, rows = {}, failures = {}) {
  const find = (kind) => async (args) => {
    calls.push([kind, args]);
    if (failures[kind]) throw failures[kind];
    return rows[kind] ?? [];
  };
  return {
    conversation: { findMany: find("conversation") },
    journey: { findMany: find("journey") },
    userDocument: { findMany: find("document") }
  };
}

test("query and kind cursors are bounded without turning blank input into a scan", () => {
  assert.deepEqual(normalizePersonalSearchQuery("  abi   plaan  "), { ok: true, query: "abi plaan" });
  assert.equal(normalizePersonalSearchQuery("x".repeat(PERSONAL_SEARCH_LIMITS.maxQueryLength + 1)).ok, false);
  assert.deepEqual(normalizePersonalSearchCursor({ conversation: "c1", journey: " ", document: "x".repeat(201) }), {
    conversation: "c1", journey: null, document: null
  });
});

test("blank query or missing owner returns an empty paged response without DB access", async () => {
  for (const args of [{ userId: "u", query: " " }, { userId: "", query: "abi" }]) {
    const calls = [];
    const response = await searchPersonalObjects({ prisma: fakePrisma(calls), ...args });
    assert.deepEqual(response.results, []);
    assert.equal(response.pagination.hasMore, false);
    assert.equal(calls.length, 0);
  }
});

test("each source has an owner boundary, deterministic order and one-row lookahead", async () => {
  const calls = [];
  await searchPersonalObjects({
    prisma: fakePrisma(calls), userId: "owner", query: "abi",
    cursor: { conversation: "c0", journey: "j0", document: "d0" },
    now: new Date("2026-08-13T10:00:00Z")
  });
  const byKind = Object.fromEntries(calls);
  assert.equal(byKind.conversation.where.userId, "owner");
  assert.equal(byKind.journey.where.ownerUserId, "owner");
  assert.equal(byKind.document.where.ownerId, "owner");
  for (const [kind, args] of Object.entries(byKind)) {
    assert.equal(args.take, PERSONAL_SEARCH_LIMITS.resultsPerKind + 1, kind);
    assert.equal(args.skip, 1, kind);
    assert.equal(args.orderBy.at(-1).id, "asc", kind);
    assert.deepEqual(args.cursor, { id: `${kind[0]}0` }, kind);
  }
});

test("9+ rows per source return 8, honest source cursors and distinct document hrefs", async () => {
  const at = new Date("2026-08-13T09:00:00Z");
  const rows = Array.from({ length: 9 }, (_, index) => index);
  const response = await searchPersonalObjects({
    prisma: fakePrisma([], {
      conversation: rows.map((index) => ({ id: `c${index}`, title: null, isPinned: false, lastActivityAt: at })),
      journey: rows.map((index) => ({ id: `j${index}`, title: "", status: "ACTIVE", updatedAt: at })),
      document: rows.map((index) => ({ id: `d${index}`, title: "", originalName: "", kind: "MATERIAL", updatedAt: at }))
    }),
    userId: "owner", query: "x"
  });
  assert.equal(response.results.length, 24);
  assert.equal(new Set(response.results.map((item) => `${item.kind}:${item.href}`)).size, 24);
  assert.equal(response.pagination.hasMore, true);
  assert.deepEqual(response.pagination.nextCursor, { conversation: "c7", journey: "j7", document: "d7" });
  assert.equal(response.results.find((item) => item.kind === "conversation").title, null);
  assert.ok(response.results.some((item) => item.href === "/documents/d0"));
});

test("an exhausted kind is not restarted while another kind continues", async () => {
  const calls = [];
  const response = await searchPersonalObjects({
    prisma: fakePrisma(calls, {
      journey: [{ id: "j-next", title: "next", status: "ACTIVE", updatedAt: new Date() }]
    }),
    userId: "owner",
    query: "x",
    cursor: { conversation: "__done__", journey: "j0", document: "__done__" }
  });
  assert.deepEqual(calls.map(([kind]) => kind), ["journey"]);
  assert.equal(response.pagination.hasMore, false);
  assert.deepEqual(response.pagination.nextCursor, {
    conversation: "__done__", journey: "__done__", document: "__done__"
  });
});

test("each technical source failure produces named partial results", async () => {
  for (const missing of ["conversation", "journey", "document"]) {
    const response = await searchPersonalObjects({
      prisma: fakePrisma([], {
        conversation: [{ id: "c", title: "c", isPinned: false, lastActivityAt: new Date() }],
        journey: [{ id: "j", title: "j", status: "ACTIVE", updatedAt: new Date() }],
        document: [{ id: "d", title: "d", originalName: "d", kind: "MATERIAL", updatedAt: new Date() }]
      }, { [missing]: new Error(`${missing} offline`) }),
      userId: "owner", query: "x"
    });
    assert.equal(response.partial, true);
    assert.deepEqual(response.unavailableKinds, [missing]);
    assert.equal(response.results.some((item) => item.kind === missing), false);
  }
});

test("rights failures never become partial results", async () => {
  await assert.rejects(
    searchPersonalObjects({
      prisma: fakePrisma([], {}, { document: Object.assign(new Error("FORBIDDEN"), { status: 403 }) }),
      userId: "owner", query: "x"
    }),
    /FORBIDDEN/u
  );
});
