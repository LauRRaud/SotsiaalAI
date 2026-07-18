import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// U6 UI contract. Source-level, matching the repo's existing contract-test
// pattern (see tests/wellbeing/covisionHandoffContracts.test.js).

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const sidebar = readFileSync(join(root, "components/ChatSidebar.jsx"), "utf8");
const route = readFileSync(join(root, "app/api/chat/conversations/route.js"), "utf8");

test("the client-side page filter is gone and cannot creep back", () => {
  // The whole point of U6: this filter only ever saw the loaded page (30), so a
  // match further down produced a confident empty result.
  assert.doesNotMatch(sidebar, /haystack/, "no client-side haystack filter");
  assert.doesNotMatch(sidebar, /normalizedSearchQuery/, "no client-side query matching");
  assert.doesNotMatch(sidebar, /filteredConversations/, "no client-side filtered list");
});

test("the sidebar asks the server for the search", () => {
  assert.match(sidebar, /params\.set\("q", searchRef\.current\)/, "q is sent to the server");
  assert.match(sidebar, /setTimeout\([\s\S]*fetchList\(\{ reset: true \}\)/, "typing is debounced and refetches from page 1");
});

test("search rides the existing cursor so 'load more' still works", () => {
  assert.match(sidebar, /if \(!reset && cursorRef\.current\)/);
  assert.match(route, /applyConversationSearch\(where, search\.query\)/);
});

test("the component delegates both racy decisions to the tested pure module", () => {
  // The decisions themselves are proven in tests/chat/sidebarListState.test.js.
  // Here we only lock that the component actually routes through them instead
  // of re-inlining the conditions that produced SOL-U6-P1-2.
  assert.match(sidebar, /from "@\/lib\/chat\/sidebarListState"/);
  assert.match(sidebar, /const listState = resolveListState\(\{/, "render is driven by the resolver");
  // The list fetch's finally must clear loading only through the guard. (The
  // delete handler's own setBusy(false) is a one-shot action with no
  // latest-request semantics, so it is deliberately not covered here.)
  assert.match(
    sidebar,
    /if \(shouldSettleRequest\(abortRef\.current, ac\)\) \{\s*abortRef\.current = null;\s*setBusy\(false\);/,
    "only the current request may clear loading"
  );
  assert.match(sidebar, /e\?\.name !== "AbortError" && shouldSettleRequest\(abortRef\.current, ac\)/,
    "a superseded request may not write an error either");
});

test("loading, empty-vs-no-results and error states are distinct", () => {
  assert.match(sidebar, /listState === LIST_STATE\.LOADING/, "loading state");
  assert.match(
    sidebar,
    /listState === LIST_STATE\.NO_MATCHES \? t\("chat\.sidebar\.search\.no_matches"/,
    "no-results is distinct from the empty list"
  );
  assert.match(sidebar, /hasConversationSearch = isConversationView && Boolean\(committedSearch\)/,
    "no-results reflects what the server was actually asked, not what is being typed");
  assert.match(sidebar, /setError\(/, "error state is surfaced");
});

test("a failed search offers a working retry", () => {
  assert.match(sidebar, /t\("chat\.sidebar\.search\.retry"/, "retry is labelled");
  assert.match(sidebar, /onClick=\{\(\) => fetchList\(\{ reset: true \}\)\}/,
    "retry re-runs the current search from page 1");
});

test("the route rejects an over-long query before touching the database", () => {
  assert.match(route, /normalizeConversationSearchQuery\(url\.searchParams\.get\("q"\)\)/);
  assert.match(route, /if \(!search\.ok\)[\s\S]*api\.chat\.search_query_too_long/);
  // The rejection must sit above the findMany.
  assert.ok(
    route.indexOf("search_query_too_long") < route.indexOf("conversation.findMany"),
    "the 400 is returned before any query runs"
  );
});
