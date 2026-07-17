import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizePersonalSearchQuery,
  searchPersonalObjects,
  PERSONAL_SEARCH_LIMITS
} from "@/lib/search/personalSearch";

const ALLOWED_KEYS = ["href", "kind", "status", "title", "updatedAt"];
const HREF_ALLOWLIST = [/^\/vestlus\?conversation=/, /^\/teekond\//, /^\/documents$/];

function fakePrisma(calls, rows = {}) {
  return {
    conversation: {
      findMany: async (args) => {
        calls.push(["conversation", args]);
        return rows.conversation ?? [];
      }
    },
    journey: {
      findMany: async (args) => {
        calls.push(["journey", args]);
        return rows.journey ?? [];
      }
    },
    userDocument: {
      findMany: async (args) => {
        calls.push(["document", args]);
        return rows.document ?? [];
      }
    }
  };
}

test("personal search normalizes a bounded query and never turns blank input into a scan", () => {
  assert.deepEqual(normalizePersonalSearchQuery("  abi   plaan  "), { ok: true, query: "abi plaan" });
  assert.deepEqual(normalizePersonalSearchQuery("   "), { ok: true, query: "" });
  assert.equal(normalizePersonalSearchQuery("x".repeat(PERSONAL_SEARCH_LIMITS.maxQueryLength)).ok, true);
  assert.equal(normalizePersonalSearchQuery("x".repeat(PERSONAL_SEARCH_LIMITS.maxQueryLength + 1)).ok, false);
});

test("blank or too-long query returns [] WITHOUT touching the database", async () => {
  for (const q of ["", "   ", "x".repeat(PERSONAL_SEARCH_LIMITS.maxQueryLength + 1)]) {
    const calls = [];
    const results = await searchPersonalObjects({ prisma: fakePrisma(calls), userId: "user-a", query: q });
    assert.deepEqual(results, []);
    assert.equal(calls.length, 0, `query ${JSON.stringify(q)} must not run any findMany`);
  }
});

test("a missing user id returns [] without a scan", async () => {
  const calls = [];
  const results = await searchPersonalObjects({ prisma: fakePrisma(calls), userId: "", query: "abi" });
  assert.deepEqual(results, []);
  assert.equal(calls.length, 0);
});

test("personal search returns only allowlisted metadata and owned objects", async () => {
  const calls = [];
  const prisma = fakePrisma(calls, {
    conversation: [{ id: "chat-own", title: "Abi plaan", isPinned: true, lastActivityAt: new Date("2026-07-17T10:00:00Z"), summary: "must not leave the database" }],
    journey: [{ id: "journey-own", title: "Abi teekond", status: "ACTIVE", updatedAt: new Date("2026-07-17T09:00:00Z"), summary: "private body" }],
    document: [{ id: "document-own", title: "Abi dokument", originalName: "abi.pdf", kind: "MATERIAL", updatedAt: new Date("2026-07-17T08:00:00Z"), content: "private body" }]
  });

  const results = await searchPersonalObjects({ prisma, userId: "user-a", query: "abi", now: new Date("2026-07-17T12:00:00Z") });

  // Strictly the locked shape — no summary, content, preview or other raw field.
  assert.deepEqual(results.map((item) => Object.keys(item).sort()), [
    ALLOWED_KEYS, ALLOWED_KEYS, ALLOWED_KEYS
  ]);
  // Every href comes from the server allowlist, never built from the query.
  for (const item of results) {
    assert.ok(HREF_ALLOWLIST.some((re) => re.test(item.href)), `href not allowlisted: ${item.href}`);
  }
  assert.deepEqual(results.map((item) => item.href), [
    "/vestlus?conversation=chat-own",
    "/teekond/journey-own",
    "/documents"
  ]);
  const serialized = JSON.stringify(results);
  assert.equal(serialized.includes("private body"), false);
  assert.equal(serialized.includes("must not leave the database"), false);
  assert.equal(serialized.includes("preview"), false);
});

test("each kind is filtered by its own authoritative owner/expiry boundary", async () => {
  const calls = [];
  const prisma = fakePrisma(calls);
  await searchPersonalObjects({ prisma, userId: "user-a", query: "abi", now: new Date("2026-07-17T12:00:00Z") });

  const conversation = calls.find((c) => c[0] === "conversation")[1];
  const journey = calls.find((c) => c[0] === "journey")[1];
  const document = calls.find((c) => c[0] === "document")[1];

  // Conversations: own, not archived, not expired.
  assert.equal(conversation.where.userId, "user-a");
  assert.equal(conversation.where.archivedAt, null);
  assert.deepEqual(conversation.where.OR, [{ expiresAt: null }, { expiresAt: { gt: new Date("2026-07-17T12:00:00Z") } }]);
  // Journeys and documents: strictly the current owner.
  assert.equal(journey.where.ownerUserId, "user-a");
  assert.equal(document.where.ownerId, "user-a");

  // Page/row limit is explicit and bounded per kind.
  for (const args of [conversation, journey, document]) {
    assert.equal(args.take, PERSONAL_SEARCH_LIMITS.resultsPerKind);
  }
  // Only metadata columns are selected — never message/content/summary bodies.
  assert.equal(conversation.select.summary, undefined);
  assert.equal(document.select.content, undefined);
  assert.equal(journey.select.summary, undefined);
});

test("results are ordered newest-first across kinds", async () => {
  const calls = [];
  const prisma = fakePrisma(calls, {
    conversation: [{ id: "c", title: "c", isPinned: false, lastActivityAt: new Date("2026-07-01T00:00:00Z") }],
    journey: [{ id: "j", title: "j", status: "ACTIVE", updatedAt: new Date("2026-07-17T00:00:00Z") }],
    document: [{ id: "d", title: "d", originalName: "d", kind: "MATERIAL", updatedAt: new Date("2026-07-10T00:00:00Z") }]
  });
  const results = await searchPersonalObjects({ prisma, userId: "user-a", query: "x" });
  assert.deepEqual(results.map((r) => r.kind), ["journey", "document", "conversation"]);
});
