import test from "node:test";
import assert from "node:assert/strict";

import { readServiceMapEntriesQuery } from "../../lib/serviceMap/entriesQueryPolicy.js";

test("public service-map query ignores review and unlocated preview flags", () => {
  const query = readServiceMapEntriesQuery(
    "https://sotsiaal.ai/api/service-map/entries?includeNeedsReview=1&includeUnlocated=1&limit=250&q=abi"
  );

  assert.equal(query.keyword, "abi");
  assert.equal(query.limit, "250");
  assert.equal(query.includeNeedsReview, false);
  assert.equal(query.includeUnlocated, false);
});

test("admin service-map preview can opt in to review and unlocated entries", () => {
  const query = readServiceMapEntriesQuery(
    "https://sotsiaal.ai/api/service-map/entries?includeNeedsReview=1&includeUnlocated=1",
    { canPreviewReviewEntries: true }
  );

  assert.equal(query.includeNeedsReview, true);
  assert.equal(query.includeUnlocated, true);
});

test("admin service-map preview remains opt-in", () => {
  const query = readServiceMapEntriesQuery(
    "https://sotsiaal.ai/api/service-map/entries",
    { canPreviewReviewEntries: true }
  );

  assert.equal(query.includeNeedsReview, false);
  assert.equal(query.includeUnlocated, false);
});
