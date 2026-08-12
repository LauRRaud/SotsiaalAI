import test from "node:test";
import assert from "node:assert/strict";
import { encodeServiceMapCursor, readServiceMapEntriesQuery } from "../../lib/serviceMap/entriesQueryPolicy.js";
import { listPublishedHelpMapEntries } from "../../lib/help/mapEntries.js";

test("service cursors are source-specific and bound to filters", () => {
  const base = { keyword: "abi", type: "SERVICE_PROVIDER", includeUnlocated: false, includeNeedsReview: false };
  const cursor = encodeServiceMapCursor({ kind: "service", title: "A", id: "1" }, base);
  assert.equal(readServiceMapEntriesQuery(`https://sotsiaal.ai/api/service-map/entries?q=abi&type=SERVICE_PROVIDER&cursor=${cursor}`).invalidCursor, false);
  assert.equal(readServiceMapEntriesQuery(`https://sotsiaal.ai/api/service-map/entries?q=muu&type=SERVICE_PROVIDER&cursor=${cursor}`).invalidCursor, true);
  const idOnly = encodeServiceMapCursor({ id: "1" }, base);
  assert.equal(readServiceMapEntriesQuery(`https://sotsiaal.ai/api/service-map/entries?q=abi&type=SERVICE_PROVIDER&cursor=${idOnly}`).invalidCursor, true);
});

test("help listing target is constrained in the database query before take", async () => {
  let where;
  await listPublishedHelpMapEntries({ listingId: "wanted", limit: 1 }, {
    helpMapEntry: { findMany: async (query) => { where = query.where; return []; } }
  });
  assert.ok(where.AND.some((item) => item.OR?.some((branch) => branch.requestId === "wanted" || branch.offerId === "wanted")));
});
