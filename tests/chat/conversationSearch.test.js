import test from "node:test";
import assert from "node:assert/strict";

import {
  CONVERSATION_MESSAGE_SEARCH_MIN_LENGTH,
  CONVERSATION_SEARCH_MAX_LENGTH,
  CONVERSATION_SEARCH_TOO_LONG,
  applyConversationSearch,
  conversationSearchFilter,
  normalizeConversationSearchQuery
} from "../../lib/chat/conversationSearch.js";

// U6: the sidebar used to filter only the loaded page (default 30), so a match
// further down produced a confident empty result. These tests lock the server
// contract that replaces it: owner scope is never dropped, and the search must
// reach every conversation, not just the first page.

const ownerWhere = (userId) => ({
  userId,
  archivedAt: null,
  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date("2026-07-14") } }]
});

/** Walks a Prisma where tree and collects every value of `key`. */
function collect(node, key, out = []) {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const item of node) collect(item, key, out);
    return out;
  }
  for (const [k, v] of Object.entries(node)) {
    if (k === key) out.push(v);
    collect(v, key, out);
  }
  return out;
}

test("cross-user leak is fail-closed: the owner scope survives the search", () => {
  const where = applyConversationSearch(ownerWhere("user-1"), "eluase");
  // The owner predicate must still be present and must be the only userId.
  assert.deepEqual(collect(where, "userId"), ["user-1"]);
  // And the search must be ANDed on top, never replacing the scope.
  assert.ok(Array.isArray(where.AND), "search is ANDed onto the owner scope");
  assert.equal(where.AND[0].userId, "user-1");
});

test("search does not cancel archived / expiry / role scoping", () => {
  const base = { ...ownerWhere("user-1"), role: "SOCIAL_WORKER" };
  const where = applyConversationSearch(base, "eluase");
  assert.equal(where.AND[0].archivedAt, null);
  assert.equal(where.AND[0].role, "SOCIAL_WORKER");
  assert.ok(where.AND[0].OR, "expiresAt window is preserved");
});

test("a match beyond the first loaded page is reachable — the false negative is gone", async () => {
  // 40 conversations; the only match is #35, i.e. past the default 30-row page
  // the old client-side filter could ever see.
  const rows = Array.from({ length: 40 }, (_, index) => ({
    id: `c-${index + 1}`,
    userId: "user-1",
    title: index === 34 ? "Eluaseme abi" : `Vestlus ${index + 1}`,
    summary: "",
    messages: [{ content: "tere" }]
  }));
  const db = {
    conversation: {
      findMany: async ({ where }) => {
        // Minimal fake of the Prisma predicate we actually build.
        const scope = where.AND[0];
        const search = where.AND[1].OR;
        const needle = search[0].title.contains.toLowerCase();
        return rows.filter((row) =>
          row.userId === scope.userId &&
          (`${row.title}`.toLowerCase().includes(needle) ||
            `${row.summary}`.toLowerCase().includes(needle) ||
            row.messages.some((m) => m.content.toLowerCase().includes(needle)))
        );
      }
    }
  };
  const where = applyConversationSearch(ownerWhere("user-1"), "eluaseme");
  const found = await db.conversation.findMany({ where });
  assert.equal(found.length, 1);
  assert.equal(found[0].id, "c-35", "the 35th conversation is found, not silently missed");
});

test("searches title, summary AND message content", () => {
  const filter = conversationSearchFilter("eluase");
  const fields = filter.OR;
  assert.equal(fields.length, 3);
  assert.equal(fields[0].title.contains, "eluase");
  assert.equal(fields[1].summary.contains, "eluase");
  // Message content is required: the list derives `preview` and the fallback
  // title from the last message, so a column-only search would not find a
  // conversation by the title the user is actually shown.
  assert.equal(fields[2].messages.some.content.contains, "eluase");
});

test("short low-selectivity queries do not scan message content", () => {
  const query = "a".repeat(CONVERSATION_MESSAGE_SEARCH_MIN_LENGTH - 1);
  const filter = conversationSearchFilter(query);

  assert.deepEqual(filter.OR, [
    { title: { contains: query, mode: "insensitive" } },
    { summary: { contains: query, mode: "insensitive" } }
  ]);
});

test("search is case-insensitive on every field", () => {
  for (const field of conversationSearchFilter("Eluase").OR) {
    const leaf = field.title || field.summary || field.messages.some.content;
    assert.equal(leaf.mode, "insensitive");
  }
});

test("empty or whitespace query means 'no search', not 'no results'", () => {
  for (const raw of ["", "   ", null, undefined, "\n\t"]) {
    const normalized = normalizeConversationSearchQuery(raw);
    assert.equal(normalized.ok, true);
    assert.equal(normalized.query, "");
    assert.equal(conversationSearchFilter(normalized.query), null);
    // The plain owner-scoped list is returned untouched.
    const base = ownerWhere("user-1");
    assert.equal(applyConversationSearch(base, normalized.query), base);
  }
});

test("query is trimmed before use", () => {
  assert.equal(normalizeConversationSearchQuery("  eluase  ").query, "eluase");
});

test("an over-long query is rejected before any DB work", () => {
  const tooLong = "a".repeat(CONVERSATION_SEARCH_MAX_LENGTH + 1);
  const normalized = normalizeConversationSearchQuery(tooLong);
  assert.equal(normalized.ok, false);
  assert.equal(normalized.code, CONVERSATION_SEARCH_TOO_LONG);
});

test("a query at exactly the limit is accepted", () => {
  const atLimit = "a".repeat(CONVERSATION_SEARCH_MAX_LENGTH);
  const normalized = normalizeConversationSearchQuery(atLimit);
  assert.equal(normalized.ok, true);
  assert.equal(normalized.query.length, CONVERSATION_SEARCH_MAX_LENGTH);
});

test("LIKE metacharacters are treated as literal text, not wildcards", () => {
  // Prisma `contains` parameterizes and escapes; we must never hand-build a
  // pattern. Locking that the raw value is passed through untouched.
  const filter = conversationSearchFilter("100% kindel_juhtum");
  assert.equal(filter.OR[0].title.contains, "100% kindel_juhtum");
});

test("search keeps working alongside cursor pagination", () => {
  // The route wraps the cursor where, then ANDs the search on top; ordering and
  // the keyset cursor are unchanged by search.
  const cursorWhere = { AND: [ownerWhere("user-1"), { OR: [{ isPinned: false }] }] };
  const where = applyConversationSearch(cursorWhere, "eluase");
  assert.equal(where.AND[0].AND[0].userId, "user-1", "owner scope survives both wrappers");
  assert.ok(where.AND[1].OR, "search condition is the outer AND branch");
});
