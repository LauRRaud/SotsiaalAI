import test from "node:test";
import assert from "node:assert/strict";

import { serviceMapEntryTypesFromFilter } from "../../lib/serviceMap/entryTypes.js";

test("service map type filters expose KOV social welfare contacts explicitly", () => {
  assert.deepEqual(serviceMapEntryTypesFromFilter("KOV_SOCIAL_CONTACT"), ["KOV_SOCIAL_CONTACT"]);
  assert.deepEqual(serviceMapEntryTypesFromFilter("SERVICE_PROVIDER"), ["SERVICE_PROVIDER"]);
});

test("legacy KOV_CONTACT filter remains a grouped KOV alias", () => {
  assert.deepEqual(serviceMapEntryTypesFromFilter("KOV_CONTACT"), [
    "KOV_SOCIAL_CONTACT",
    "KOV_GENERAL_CONTACT"
  ]);
});
