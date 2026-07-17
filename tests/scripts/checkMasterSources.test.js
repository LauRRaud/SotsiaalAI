import assert from "node:assert/strict";
import test from "node:test";

import { applyRecheckObservation } from "../../scripts/check-master-sources.mjs";

test("master-source recheck needs three separately timed failures over 48 hours before gone_candidate", () => {
  const candidate = { source_id: "fixture", url: "https://example.test/a", final_url: "https://example.test/a", status: "http_404" };
  const first = applyRecheckObservation({}, candidate, new Date("2026-07-17T00:00:00.000Z"));
  const second = applyRecheckObservation(first, candidate, new Date("2026-07-18T00:00:00.000Z"));
  const third = applyRecheckObservation(second, candidate, new Date("2026-07-19T00:01:00.000Z"));
  assert.equal(first.status, "http_404");
  assert.equal(second.status, "http_404");
  assert.equal(third.status, "gone_candidate");
  assert.equal(third.gone_count, 3);
  assert.match(third.next_check_at, /^2026-07-20/u);
});

test("master-source recheck records redirects as review candidates and never publishes or ingests", () => {
  const result = applyRecheckObservation({}, {
    source_id: "fixture",
    url: "https://example.test/old",
    final_url: "https://example.test/new",
    status: "review_required"
  }, new Date("2026-07-17T00:00:00.000Z"));
  assert.equal(result.status, "redirect_candidate");
  assert.deepEqual(result.redirect_candidate, {
    from: "https://example.test/old",
    to: "https://example.test/new",
    observed_at: "2026-07-17T00:00:00.000Z"
  });
  assert.match(result.next_check_at, /^2026-08-16/u);
});
