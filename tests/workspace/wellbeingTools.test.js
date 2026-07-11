import assert from "node:assert/strict";
import test from "node:test";

import { getWellbeingToolBySlug } from "../../lib/wellbeingTools.js";

test("wellbeing tools can be resolved by route slug", () => {
  assert.equal(getWellbeingToolBySlug("kiirkontroll")?.id, "quick-check");
  assert.equal(getWellbeingToolBySlug("toovagivald")?.title, "Töövägivald");
  assert.equal(getWellbeingToolBySlug("rollipiirid")?.id, "role-boundaries");
  assert.equal(getWellbeingToolBySlug("puudub"), null);
});
