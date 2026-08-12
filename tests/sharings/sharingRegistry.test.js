import assert from "node:assert/strict";
import test from "node:test";
import { DATA_EXPORT_REGISTRY } from "../../lib/dataExport/registry.js";
import { mySharingsInternals } from "../../lib/mySharings.js";
import {
  SHARING_CLASSIFICATION,
  SHARING_EXPORT_TYPES,
  SHARING_TYPE_REGISTRY
} from "../../lib/sharings/registry.js";

test("one canonical registry binds every sharing model to UI and export coverage", () => {
  const types = SHARING_TYPE_REGISTRY.map(entry => entry.type);
  assert.equal(new Set(types).size, types.length, "sharing type keys must be unique");

  const exportCollectorTypes = Object.keys(mySharingsInternals.EXPORT_COLLECTORS).sort();
  assert.deepEqual([...SHARING_EXPORT_TYPES].sort(), exportCollectorTypes);
  assert.ok(DATA_EXPORT_REGISTRY.some(surface => surface.name === "sharing_history" && surface.version === "1.0"));

  const canonicalModels = new Set(
    SHARING_TYPE_REGISTRY
      .filter(entry => entry.classification === SHARING_CLASSIFICATION.SHARING)
      .map(entry => entry.sourceModel)
  );
  for (const requiredModel of [
    "RoomMember", "RoomSharedSummary", "Invite", "HelpRequest", "HelpOffer",
    "MentoringPrivateNote", "NetworkShare", "UrgentRequest", "WellbeingSupportShare",
    "ServiceReportShare"
  ]) {
    assert.ok(canonicalModels.has(requiredModel), `${requiredModel} is missing from sharing coverage`);
  }

  const networkDirections = SHARING_TYPE_REGISTRY
    .filter(entry => entry.sourceModel === "NetworkShare")
    .map(entry => `${entry.ownerField}:${entry.direction}`)
    .sort();
  assert.deepEqual(networkDirections, ["clientUserId:INCOMING_REQUEST", "workerId:OUTGOING"]);

  const privateTypes = SHARING_TYPE_REGISTRY
    .filter(entry => entry.classification === SHARING_CLASSIFICATION.PRIVATE_RECORD);
  assert.ok(privateTypes.some(entry => entry.type === "FRAMEWORK_ACCEPTANCE" && entry.export === false));
  assert.ok(privateTypes.some(entry => entry.type === "PRIVATE_MENTORING_PREPARATION" && entry.export === false));
});
