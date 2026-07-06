import assert from "node:assert/strict";
import test from "node:test";

import {
  RECOVERY_FIELD_KEYS,
  buildRecoveryRecord,
  computeRecoveryResult
} from "../../lib/wellbeing/recovery.js";

const baseFields = Object.freeze({
  recoveryReason: "heavy_week",
  recoveryLevel: "partial",
  workCapacityNext72h: "reduced",
  unavoidableTasks: ["kriitiline juhtumikontakt"],
  deferrableTasks: ["aruande viimistlus"],
  redistributableTasks: ["partneri järelpärimine"],
  primaryLoadFactors: ["documentation", "interruptions"],
  supportNeed: "manager",
  covisionNeed: false,
  nextCheckpoint: "tomorrow"
});

test("recovery exposes standardized fields for 24-72h recovery planning", () => {
  assert.deepEqual(RECOVERY_FIELD_KEYS, [
    "recoveryReason",
    "recoveryLevel",
    "workCapacityNext72h",
    "unavoidableTasks",
    "deferrableTasks",
    "redistributableTasks",
    "primaryLoadFactors",
    "supportNeed",
    "covisionNeed",
    "nextCheckpoint"
  ]);
});

test("recovery recommends organizational support when recovery is missing and capacity is low", () => {
  const result = computeRecoveryResult({
    ...baseFields,
    recoveryLevel: "none",
    workCapacityNext72h: "low",
    supportNeed: "manager",
    covisionNeed: true
  });

  assert.equal(result.signalLevel, "organizational_support");
  assert.ok(result.resourceFactors.includes("recovery.low_or_none"));
  assert.ok(result.riskMarkers.includes("recovery.low_capacity_72h"));
  assert.deepEqual(
    result.recommendedActions.map((action) => action.workflowType),
    ["work-boundaries", "covision", "overview"]
  );
});

test("recovery builds a private 72h plan record with output text", () => {
  const record = buildRecoveryRecord({
    period: "current",
    roleGroup: "SOCIAL_WORKER",
    standardizedFields: baseFields
  });

  assert.equal(record.schemaVersion, "1.0");
  assert.equal(record.scoringVersion, "recovery-v1");
  assert.equal(record.workflowType, "recovery");
  assert.equal(record.visibility, "private");
  assert.equal(record.aggregationEligible, true);
  assert.equal(record.computedSignal.signalLevel, "prioritize");
  assert.match(record.outputSummary.recoveryPlan72h, /24-72h taastumisplaan/);
  assert.match(record.outputSummary.managerMemo, /Juhiga arutelu memo/);
});
