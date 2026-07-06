import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { serviceMapEntryTypesFromFilter } from "../../lib/serviceMap/entryTypes.js";

function read(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

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

test("service map toolbar names the KOV social welfare department tab", () => {
  const source = read("components/workspace/WorkspaceFeaturePage.jsx");
  const messages = read("messages/et.json");

  assert.match(source, /\["KOV_SOCIAL_CONTACT",\s*readText\(t,\s*"workspace_feature_pages\.service_map\.types\.kov"/);
  assert.match(messages, /"kov":\s*"KOV"/);
});
