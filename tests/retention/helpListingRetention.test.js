import assert from "node:assert/strict";
import test from "node:test";

import { buildExpiredHelpListingWhere } from "@/lib/retention";

test("help listing retention only deletes listings with no preserved matches", () => {
  const cutoff = new Date("2026-05-01T00:00:00.000Z");

  assert.deepEqual(buildExpiredHelpListingWhere(cutoff), {
    updatedAt: { lt: cutoff },
    status: { in: ["CLOSED", "CANCELLED", "ARCHIVED"] },
    matches: { none: {} }
  });
});
