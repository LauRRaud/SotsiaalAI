// U6: latest-request and list-state decisions for the conversation sidebar.
//
// Both decisions used to live inline in the component, where neither can be
// proven by reading the source: a superseded request's `finally` cleared the
// loading flag while its replacement was still in flight, and a *failed* search
// still rendered as a confident "no results". The second one is the exact class
// of bug U6 exists to remove, so it must not be reintroduced by the error path.
//
// They are pure functions here so the abort/error ordering can be driven
// deterministically in tests without a DOM.

/**
 * Only the request that still owns the active slot may write state. A request
 * that has been superseded (or aborted) must write nothing at all — not even
 * "loading finished", because its replacement is still loading.
 */
export function shouldSettleRequest(activeToken, token) {
  return Boolean(token) && activeToken === token;
}

export const LIST_STATE = Object.freeze({
  LOADING: "loading",
  ERROR: "error",
  RESULTS: "results",
  NO_MATCHES: "no_matches",
  EMPTY: "empty"
});

/**
 * Resolves what the list should render. Order matters:
 *
 * - `loading` wins over everything: an in-flight request has no verdict yet;
 * - `error` wins over `no_matches`: a request that failed proves nothing about
 *   whether results exist, so claiming "no results" would be a false negative;
 * - `no_matches` is only ever reported for a search that actually completed.
 */
export function resolveListState({ busy = false, error = "", itemCount = 0, hasSearch = false } = {}) {
  if (busy) return LIST_STATE.LOADING;
  if (error) return LIST_STATE.ERROR;
  if (itemCount > 0) return LIST_STATE.RESULTS;
  return hasSearch ? LIST_STATE.NO_MATCHES : LIST_STATE.EMPTY;
}
