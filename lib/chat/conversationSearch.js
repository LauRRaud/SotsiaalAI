// U6: owner-scoped conversation search.
//
// The sidebar used to filter only the already-loaded page (default 30), so a
// match further down the list produced a confident empty result. The filter is
// server-side now, but the scope contract is unchanged: the caller's existing
// owner `where` (userId + archivedAt + expiresAt + role) is always preserved and
// the search condition is ANDed on top of it — never used in its place.
//
// Fields: `title`, `summary` and message `content`. Message content is required,
// not optional: the list derives `preview` from the last message and falls back
// to it for a null `title` (app/api/chat/conversations/route.js), so a
// column-only search would fail to find a conversation by the very title the
// user is shown.

export const CONVERSATION_SEARCH_MAX_LENGTH = 200;
export const CONVERSATION_MESSAGE_SEARCH_MIN_LENGTH = 3;
export const CONVERSATION_SEARCH_TOO_LONG = "CONVERSATION_SEARCH_TOO_LONG";

/**
 * Normalizes a raw query param. Empty/whitespace means "no search", not "no
 * results" — the caller falls back to the plain list.
 */
export function normalizeConversationSearchQuery(raw) {
  const query = String(raw ?? "").trim();
  if (!query) return { ok: true, query: "" };
  if (query.length > CONVERSATION_SEARCH_MAX_LENGTH) {
    return { ok: false, code: CONVERSATION_SEARCH_TOO_LONG };
  }
  return { ok: true, query };
}

/** The search condition alone. Returns null when there is nothing to search. */
export function conversationSearchFilter(query) {
  const value = String(query ?? "").trim();
  if (!value) return null;
  const contains = { contains: value, mode: "insensitive" };
  // Message history is much larger than conversation metadata and `content`
  // has no substring-search index. Do not let short, low-selectivity terms
  // amplify one list request into a scan across all of the owner's messages.
  return {
    OR: [
      { title: contains },
      { summary: contains },
      ...(value.length >= CONVERSATION_MESSAGE_SEARCH_MIN_LENGTH
        ? [{ messages: { some: { content: contains } } }]
        : [])
    ]
  };
}

/**
 * ANDs the search onto an existing owner-scoped `where`. The owner scope is the
 * first argument on purpose: it can only ever be narrowed here, never replaced.
 */
export function applyConversationSearch(where, query) {
  const filter = conversationSearchFilter(query);
  if (!filter) return where;
  return { AND: [where, filter] };
}
