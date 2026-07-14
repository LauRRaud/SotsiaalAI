import test from "node:test";
import assert from "node:assert/strict";

import {
  LIST_STATE,
  resolveListState,
  shouldSettleRequest
} from "../../lib/chat/sidebarListState.js";

// U6 SOL-U6-P1-2 regression. These two decisions used to be inline in the
// component, where a source-level regex could not prove them. The bugs were:
// (a) a superseded request cleared the loading flag while its replacement was
// still in flight, and (b) a *failed* request still rendered "no results" —
// reintroducing the exact false negative U6 exists to remove.

test("a superseded request may not settle: A is replaced by B, A must write nothing", () => {
  const a = Symbol("request-A");
  const b = Symbol("request-B");
  let active = a;          // A starts
  active = b;              // B replaces A (fetchList aborts A and takes the slot)

  assert.equal(shouldSettleRequest(active, a), false, "A must not write state");
  assert.equal(shouldSettleRequest(active, b), true, "B still owns the slot");
});

test("A aborting while B is in flight leaves the list LOADING, never 'no results'", () => {
  const a = Symbol("request-A");
  const b = Symbol("request-B");
  let active = a;
  let busy = true;
  const items = [];        // B reset the list

  active = b;              // B replaces A, still loading

  // A's finally runs here. It is gated, so it cannot clear `busy`.
  if (shouldSettleRequest(active, a)) busy = false;

  assert.equal(busy, true, "the aborted predecessor did not clear loading");
  assert.equal(
    resolveListState({ busy, error: "", itemCount: items.length, hasSearch: true }),
    LIST_STATE.LOADING,
    "an in-flight search has no verdict yet"
  );
});

test("an ungated settle would have produced the bug — this is what we are preventing", () => {
  // Documents the old behaviour so the guard cannot be quietly removed.
  let busy = true;
  busy = false; // the old unconditional setBusy(false) from the aborted request
  assert.equal(
    resolveListState({ busy, error: "", itemCount: 0, hasSearch: true }),
    LIST_STATE.NO_MATCHES,
    "without the guard the UI claims 'no results' over an in-flight search"
  );
});

test("a failed search shows the error and never 'no results'", () => {
  const state = resolveListState({
    busy: false,
    error: "Vestlusi ei saanud laadida.",
    itemCount: 0,
    hasSearch: true
  });
  assert.equal(state, LIST_STATE.ERROR);
  assert.notEqual(state, LIST_STATE.NO_MATCHES, "a technical failure is not a factual negative");
});

test("error outranks no_matches even with an empty list and no search", () => {
  assert.equal(
    resolveListState({ busy: false, error: "network", itemCount: 0, hasSearch: false }),
    LIST_STATE.ERROR
  );
});

test("loading outranks error: a retry in flight must not still show the old error", () => {
  // Retry sets busy=true; the stale error must not win.
  assert.equal(
    resolveListState({ busy: true, error: "network", itemCount: 0, hasSearch: true }),
    LIST_STATE.LOADING
  );
});

test("'no results' is only ever reported for a completed search", () => {
  assert.equal(
    resolveListState({ busy: false, error: "", itemCount: 0, hasSearch: true }),
    LIST_STATE.NO_MATCHES
  );
  // Same empty list, no search -> the ordinary empty list, not a search verdict.
  assert.equal(
    resolveListState({ busy: false, error: "", itemCount: 0, hasSearch: false }),
    LIST_STATE.EMPTY
  );
});

test("results win once they arrive", () => {
  assert.equal(
    resolveListState({ busy: false, error: "", itemCount: 3, hasSearch: true }),
    LIST_STATE.RESULTS
  );
});

test("shouldSettleRequest rejects a null/undefined token", () => {
  assert.equal(shouldSettleRequest(null, null), false, "a cleared slot settles nothing");
  assert.equal(shouldSettleRequest(undefined, undefined), false);
});

test("the full A/B/abort/error/retry sequence never renders a false negative", () => {
  const a = Symbol("A");
  const b = Symbol("B");
  let active = null;
  let busy = false;
  let error = "";
  let items = [];
  const render = () => resolveListState({ busy, error, itemCount: items.length, hasSearch: true });

  // A starts
  active = a; busy = true; error = ""; items = [];
  assert.equal(render(), LIST_STATE.LOADING);

  // B replaces A (user typed another letter)
  active = b; busy = true; items = [];
  // A settles late with AbortError -> gated, writes nothing
  if (shouldSettleRequest(active, a)) { busy = false; error = "aborted"; }
  assert.equal(render(), LIST_STATE.LOADING, "still loading, not 'no results'");

  // B fails with a network error
  if (shouldSettleRequest(active, b)) { busy = false; error = "network"; }
  assert.equal(render(), LIST_STATE.ERROR, "the failure is visible as an error");

  // Retry: a new request C takes the slot
  const c = Symbol("C");
  active = c; busy = true; error = "";
  assert.equal(render(), LIST_STATE.LOADING, "retry clears the error and reloads");

  // C succeeds with a real match
  if (shouldSettleRequest(active, c)) { busy = false; items = [{ id: "c-35" }]; }
  assert.equal(render(), LIST_STATE.RESULTS);
});
