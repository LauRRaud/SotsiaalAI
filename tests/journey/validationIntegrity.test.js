import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeJourneyCreateInput,
  normalizeJourneyUpdateInput
} from "../../lib/journey/validation.js";

function createInput(overrides = {}) {
  return { summary: "Synthetic journey summary", ...overrides };
}

test("SOL-JOUR-07: create defaults only missing enums and rejects empty or unknown values", () => {
  const defaults = normalizeJourneyCreateInput(createInput(), { roleContext: "CLIENT" });
  assert.equal(defaults.status, "ACTIVE");
  assert.equal(defaults.sharingStatus, "PRIVATE");
  assert.equal(defaults.primaryPath, null);

  for (const [field, valid] of [
    ["status", "DRAFT"],
    ["sharingStatus", "PRIVATE"],
    ["primaryPath", "SERVICE_MAP"]
  ]) {
    assert.equal(normalizeJourneyCreateInput(createInput({ [field]: valid }))[field], valid);
    for (const invalid of ["", "TYPO"]) {
      assert.throws(
        () => normalizeJourneyCreateInput(createInput({ [field]: invalid })),
        { status: 400, message: `journeys.errors.${field}_invalid` }
      );
    }
  }
});

test("SOL-JOUR-07: update accepts valid enums and rejects empty or unknown values", () => {
  assert.deepEqual(normalizeJourneyUpdateInput({}), {});
  for (const [field, valid] of [
    ["status", "ARCHIVED"],
    ["sharingStatus", "PRIVATE"],
    ["primaryPath", "HEALTH_CONTACT"]
  ]) {
    assert.equal(normalizeJourneyUpdateInput({ [field]: valid })[field], valid);
    for (const invalid of ["", "TYPO"]) {
      assert.throws(
        () => normalizeJourneyUpdateInput({ [field]: invalid }),
        { status: 400, message: `journeys.errors.${field}_invalid` }
      );
    }
  }
});

test("SOL-JOUR-08: client roleContext never overrides the server-resolved role", () => {
  for (const claimedRole of [undefined, "", "ADMIN", "SOCIAL_WORKER", "TYPO"]) {
    const normalized = normalizeJourneyCreateInput(
      createInput({ ...(claimedRole === undefined ? {} : { roleContext: claimedRole }) }),
      { roleContext: "CLIENT" }
    );
    assert.equal(normalized.roleContext, "CLIENT");
  }
});
