import assert from "node:assert/strict";
import test from "node:test";
import { classifyHelpMapVisibility } from "../../lib/help/mapEntries.js";

const now = new Date("2026-08-13T10:00:00.000Z");

test("help-map visibility uses the same source and derived-state predicate as the public map", () => {
  const classify = (listingStatus, mapEntry, listingExpiresAt = null) => classifyHelpMapVisibility({
    listingStatus,
    listingExpiresAt,
    mapEntry,
    now
  });
  assert.equal(classify("OPEN", { mapVisible: true, status: "PUBLISHED", expiresAt: new Date("2026-08-14T00:00:00Z") }), "PUBLIC");
  assert.equal(classify("OPEN", { mapVisible: false, status: "PUBLISHED" }), "HIDDEN");
  assert.equal(classify("OPEN", { mapVisible: true, status: "REVIEW" }), "REVIEW");
  assert.equal(classify("OPEN", { mapVisible: true, status: "PUBLISHED", expiresAt: new Date("2026-08-12T00:00:00Z") }), "EXPIRED");
  assert.equal(classify("OPEN", null), "MISSING");
  assert.equal(classify("MATCHED", { mapVisible: true, status: "PUBLISHED" }), "OUT_OF_SYNC");
});
