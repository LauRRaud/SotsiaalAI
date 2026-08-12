import test from "node:test";
import assert from "node:assert/strict";
import {
  encodeServiceMapCombinedCursor,
  encodeServiceMapCursor,
  readServiceMapEntriesQuery
} from "../../lib/serviceMap/entriesQueryPolicy.js";
import { listPublishedHelpMapEntries } from "../../lib/help/mapEntries.js";

test("service cursors are source-specific and bound to filters", () => {
  const base = { keyword: "abi", type: "SERVICE_PROVIDER", includeUnlocated: false, includeNeedsReview: false };
  const cursor = encodeServiceMapCursor({ kind: "service", title: "A", id: "1" }, base);
  assert.equal(readServiceMapEntriesQuery(`https://sotsiaal.ai/api/service-map/entries?q=abi&type=SERVICE_PROVIDER&cursor=${cursor}`).invalidCursor, false);
  assert.equal(readServiceMapEntriesQuery(`https://sotsiaal.ai/api/service-map/entries?q=muu&type=SERVICE_PROVIDER&cursor=${cursor}`).invalidCursor, true);
  const idOnly = encodeServiceMapCursor({ id: "1" }, base);
  assert.equal(readServiceMapEntriesQuery(`https://sotsiaal.ai/api/service-map/entries?q=abi&type=SERVICE_PROVIDER&cursor=${idOnly}`).invalidCursor, true);
});

test("combined cursors carry independent source positions and remain filter-bound", () => {
  const base = { keyword: "abi", type: "ALL", includeUnlocated: false, includeNeedsReview: false };
  const serviceCursor = encodeServiceMapCursor({ kind: "service", title: "A", id: "service-1" }, base);
  const peerCursor = encodeServiceMapCursor({ kind: "help", updatedAt: "2026-08-13T00:00:00.000Z", id: "peer-1" }, base);
  const cursor = encodeServiceMapCombinedCursor({ serviceCursor, peerCursor, serviceDone: false, peerDone: false }, base);
  const parsed = readServiceMapEntriesQuery(`https://sotsiaal.ai/api/service-map/entries?q=abi&type=ALL&cursor=${cursor}`);
  assert.equal(parsed.invalidCursor, false);
  assert.equal(parsed.combinedCursor.serviceCursor, serviceCursor);
  assert.equal(parsed.combinedCursor.peerCursor, peerCursor);
  assert.equal(readServiceMapEntriesQuery(`https://sotsiaal.ai/api/service-map/entries?q=abi&type=ALL&cursor=${cursor}`).combinedCursor.peerDone, false);
  assert.equal(readServiceMapEntriesQuery(`https://sotsiaal.ai/api/service-map/entries?q=muu&type=ALL&cursor=${cursor}`).invalidCursor, true);
  assert.equal(readServiceMapEntriesQuery(`https://sotsiaal.ai/api/service-map/entries?q=abi&type=SERVICE_PROVIDER&cursor=${cursor}`).invalidCursor, true);
});

test("help listing target is constrained in the database query before take", async () => {
  let where;
  await listPublishedHelpMapEntries({ listingId: "wanted", limit: 1 }, {
    helpMapEntry: { findMany: async (query) => { where = query.where; return []; } }
  });
  assert.ok(where.AND.some((item) => item.OR?.some((branch) => branch.requestId === "wanted" || branch.offerId === "wanted")));
});
