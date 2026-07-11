import assert from "node:assert/strict";
import test from "node:test";

import { getUsagePeriodRange } from "../../lib/usage/periods.js";

test("weekly periods start on Monday in Europe/Tallinn across spring DST", () => {
  const range = getUsagePeriodRange("WEEKLY", new Date("2026-03-29T10:00:00.000Z"));

  assert.equal(range.start.toISOString(), "2026-03-22T22:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-03-29T21:00:00.000Z");
  assert.equal((range.end - range.start) / 3_600_000, 167);
});

test("weekly periods preserve Tallinn midnight across autumn DST", () => {
  const range = getUsagePeriodRange("WEEKLY", new Date("2026-10-25T10:00:00.000Z"));

  assert.equal(range.start.toISOString(), "2026-10-18T21:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-10-25T22:00:00.000Z");
  assert.equal((range.end - range.start) / 3_600_000, 169);
});

test("monthly periods use calendar month boundaries in Tallinn", () => {
  const range = getUsagePeriodRange("MONTHLY", new Date("2026-07-11T09:00:00.000Z"));

  assert.equal(range.start.toISOString(), "2026-06-30T21:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-07-31T21:00:00.000Z");
});
