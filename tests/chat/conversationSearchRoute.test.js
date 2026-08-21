import test from "node:test";
import assert from "node:assert/strict";

import { GET, POST } from "../../app/api/chat/conversations/route.js";

// U6 SOL-U6-P1-1 regression. The earlier test hand-built a `where` object and so
// never executed `parseCursor` — it stayed green while every real cursor request
// threw `ReferenceError: isPlausibleConversationId is not defined`. These tests
// drive the real GET export instead, so page 2 actually runs the parser.

const OWNER = "user-1";

function makeDeps({ rows = [], capture = [] } = {}) {
  return {
    requireUser: async () => ({ ok: true, userId: OWNER, session: {} }),
    enforceChatRateLimit: () => null,
    resolveSessionRoleState: () => ({ effectiveRole: "SOCIAL_WORKER", isAdmin: false }),
    resolveConversationListRoleFilter: () => null,
    prisma: {
      conversation: {
        findMany: async (args) => {
          capture.push(args);
          return typeof rows === "function" ? rows(args, capture.length) : rows;
        }
      }
    }
  };
}

const req = (query) => ({
  url: `https://x.test/api/chat/conversations${query}`,
  cookies: { get: () => undefined }
});

const row = (id, ms) => ({
  id,
  title: `Vestlus ${id}`,
  summary: "",
  metadata: null,
  lastActivityAt: new Date(ms),
  isPinned: false,
  role: "SOCIAL_WORKER",
  messages: [{ content: "eluaseme abi" }]
});

/** Every userId appearing anywhere in a Prisma where tree. */
function ownerIds(node, out = []) {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const item of node) ownerIds(item, out);
    return out;
  }
  for (const [k, v] of Object.entries(node)) {
    if (k === "userId") out.push(v);
    ownerIds(v, out);
  }
  return out;
}

test("a real cursor request does not throw and actually queries the database", async () => {
  const capture = [];
  const deps = makeDeps({ rows: [row("c-2", 2000)], capture });
  // A well-formed cursor token: "<isPinned>:<ms>:<id>".
  const res = await GET(req("?cursor=0%3A3000%3Ac-0000000001"), deps);
  assert.equal(res.status, 200);
  assert.equal(capture.length, 1, "the second page reached findMany — parseCursor did not throw");
  const body = await res.json();
  assert.equal(body.ok, true);
});

test("page 1 -> nextCursor -> page 2 with q keeps the owner scope and ordering", async () => {
  const capture = [];
  const pageSize = 2;
  const deps = makeDeps({
    capture,
    rows: (args, call) => {
      // take is limit+1; return a full page first so a nextCursor is produced.
      if (call === 1) return [row("c-1", 3000), row("c-2", 2000), row("c-3", 1000)];
      return [row("c-3", 1000)];
    }
  });

  const first = await GET(req(`?limit=${pageSize}&q=eluase`), deps);
  const firstBody = await first.json();
  assert.equal(firstBody.conversations.length, pageSize);
  assert.ok(firstBody.nextCursor, "page 1 produced a cursor");

  const second = await GET(
    req(`?limit=${pageSize}&q=eluase&cursor=${encodeURIComponent(firstBody.nextCursor)}`),
    deps
  );
  assert.equal(second.status, 200);
  assert.equal(capture.length, 2, "page 2 performed a second real query");

  const secondWhere = capture[1].where;
  assert.deepEqual(ownerIds(secondWhere), [OWNER], "owner scope survives q + cursor");
  // The search must still be present on the paged query.
  const asText = JSON.stringify(secondWhere);
  assert.match(asText, /"contains":"eluase"/);
  assert.match(asText, /"messages"/, "message content is still searched on page 2");
  // Ordering is unchanged by search.
  assert.deepEqual(capture[1].orderBy, [{ isPinned: "desc" }, { lastActivityAt: "desc" }, { id: "desc" }]);
  assert.deepEqual(capture[0].orderBy, capture[1].orderBy, "both pages share one stable order");
});

test("archived / expiry scoping survives q + cursor", async () => {
  const capture = [];
  const deps = makeDeps({ rows: [row("c-9", 1000)], capture });
  await GET(req("?q=eluase&cursor=0%3A3000%3Ac-0000000001"), deps);
  const asText = JSON.stringify(capture[0].where);
  assert.match(asText, /"archivedAt":null/);
  assert.match(asText, /"expiresAt"/);
});

test("a malformed cursor fails closed: page 1 is served, the route does not crash", async () => {
  for (const bad of ["nonsense", "::", "9:notanumber:c-1", "0:1000:x", ""]) {
    const capture = [];
    const deps = makeDeps({ rows: [row("c-1", 1000)], capture });
    const res = await GET(req(`?cursor=${encodeURIComponent(bad)}`), deps);
    assert.equal(res.status, 200, `cursor ${JSON.stringify(bad)} must not crash the route`);
    assert.equal(capture.length, 1);
    // An unparsable cursor is ignored, not honoured: the query is the first page.
    assert.deepEqual(ownerIds(capture[0].where), [OWNER]);
  }
});

test("an over-long q is rejected before any database call", async () => {
  const capture = [];
  const deps = makeDeps({ rows: [], capture });
  const res = await GET(req(`?q=${"a".repeat(201)}`), deps);
  assert.equal(res.status, 400);
  assert.equal(capture.length, 0, "no query ran");
  const body = await res.json();
  assert.equal(body.messageKey ?? body.message, "api.chat.search_query_too_long");
});

test("createOnly ei taasava arhiveeritud või võistluses juba tekkinud vestlust", async () => {
  let updateCalls = 0;
  const conversationId = "conv-33333333-3333-4333-8333-333333333333";
  const request = new Request("https://x.test/api/chat/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: conversationId,
      role: "SERVICE_PROVIDER",
      createOnly: true
    })
  });
  Object.defineProperty(request, "cookies", { value: { get: () => undefined } });

  const result = await POST(request, {
    requireUser: async () => ({
      ok: true,
      userId: OWNER,
      role: "SERVICE_PROVIDER",
      isAdmin: false,
      session: {}
    }),
    enforceChatRateLimit: () => null,
    resolveSessionRoleState: () => ({ effectiveRole: "SERVICE_PROVIDER" }),
    resolveConversationWriteRole: () => "SERVICE_PROVIDER",
    prisma: {
      conversation: {
        findUnique: async () => ({ userId: OWNER }),
        update: async () => {
          updateCalls += 1;
          return {};
        }
      }
    }
  });

  assert.equal(result.status, 409);
  assert.equal(updateCalls, 0, "createOnly ei tohi olemasolevat vestlust taasavada ega muuta");
  const body = await result.json();
  assert.equal(body.messageKey, "api.chat.conversation_exists");
});
