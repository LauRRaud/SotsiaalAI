import assert from "node:assert/strict";
import test from "node:test";

import { wellbeingTools } from "../../lib/wellbeingTools.js";

test("wellbeing dashboard avoids medical-style status icons", () => {
  const bannedMedicalIcons = new Set(["Activity", "HeartPulse", "HeartHandshake"]);

  for (const tool of wellbeingTools) {
    assert.equal(
      bannedMedicalIcons.has(tool.icon),
      false,
      `${tool.title} should use a social-work icon instead of ${tool.icon}`
    );
  }
});

test("workplace violence card does not reuse the wellbeing shield-person mark", () => {
  const workplaceViolence = wellbeingTools.find((tool) => tool.id === "workplace-violence");

  assert.equal(workplaceViolence?.icon, "OctagonAlert");
  assert.notEqual(workplaceViolence?.icon, "ShieldUser");
});
