import assert from "node:assert/strict";
import test from "node:test";

import { inferAssistiveDevicesFromJourney } from "../../lib/journey/assistiveDevices.js";

test("SOL-JOUR-12: one device status never propagates to another device", () => {
  const devices = inferAssistiveDevicesFromJourney({
    summary: "Rollaator on katki, aga prillid on olemas. Kuuldeaparaadi seis ei ole teada."
  });
  const byName = new Map(devices.map((item) => [item.name, item]));

  assert.equal(byName.get("rollaator")?.status, "NOT_WORKING");
  assert.equal(byName.get("prillid")?.status, "EXISTING");
  assert.equal(byName.get("kuuldeaparaat")?.status, "UNSURE");
  assert.doesNotMatch(byName.get("prillid")?.issue || "", /rollaator on katki/iu);
});
