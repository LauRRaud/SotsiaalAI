import assert from "node:assert/strict";
import test from "node:test";

import {
  QUICK_CHECK_FIELD_KEYS,
  buildQuickCheckRecord,
  computeQuickCheckResult,
  formatQuickCheckFactor
} from "../../lib/wellbeing/quickCheck.js";

test("quick check exposes standardized fields required for comparable wellbeing data", () => {
  assert.deepEqual(QUICK_CHECK_FIELD_KEYS, [
    "workloadLevel",
    "caseComplexityLevel",
    "emotionalLoad",
    "documentationLoad",
    "interruptionsLevel",
    "recoveryLevel",
    "afterHoursImpact",
    "decisionControl",
    "priorityClarity",
    "supportAvailability",
    "covisionNeed",
    "workBoundaryClarity",
    "difficultCaseMarker",
    "supportNeed"
  ]);
});

test("quick check escalates to red when critical workload has no recovery", () => {
  const result = computeQuickCheckResult({
    workloadLevel: "critical",
    caseComplexityLevel: "moderate",
    emotionalLoad: "moderate",
    documentationLoad: "moderate",
    interruptionsLevel: "moderate",
    recoveryLevel: "none",
    afterHoursImpact: "low",
    decisionControl: "moderate",
    priorityClarity: "clear",
    supportAvailability: "available",
    covisionNeed: false,
    workBoundaryClarity: "clear",
    difficultCaseMarker: false,
    supportNeed: false
  });

  assert.equal(result.signalLevel, "red");
  assert.ok(result.riskMarkers.includes("recovery.none_with_critical_workload"));
  assert.ok(result.recommendedActions.some((action) => action.workflowType === "recovery"));
});

test("quick check recommends the next workflow from high load factors", () => {
  const result = computeQuickCheckResult({
    workloadLevel: "moderate",
    caseComplexityLevel: "complex",
    emotionalLoad: "high",
    documentationLoad: "very_high",
    interruptionsLevel: "very_high",
    recoveryLevel: "partial",
    afterHoursImpact: "high",
    decisionControl: "low",
    priorityClarity: "unclear",
    supportAvailability: "partial",
    covisionNeed: true,
    workBoundaryClarity: "unclear",
    difficultCaseMarker: true,
    supportNeed: true
  });

  assert.equal(result.signalLevel, "red");
  assert.deepEqual(
    result.recommendedActions.map((action) => action.workflowType),
    [
      "hard-case",
      "work-processes",
      "interruptions",
      "recovery",
      "work-boundaries",
      "role-boundaries",
      "covision"
    ]
  );
});

test("quick check record uses private visibility and export-ready metadata", () => {
  const record = buildQuickCheckRecord({
    period: "2026-W22",
    roleGroup: "SOCIAL_WORKER",
    standardizedFields: {
      workloadLevel: "low",
      caseComplexityLevel: "routine",
      emotionalLoad: "low",
      documentationLoad: "low",
      interruptionsLevel: "low",
      recoveryLevel: "sufficient",
      afterHoursImpact: "none",
      decisionControl: "high",
      priorityClarity: "clear",
      supportAvailability: "available",
      covisionNeed: false,
      workBoundaryClarity: "clear",
      difficultCaseMarker: false,
      supportNeed: false
    }
  });

  assert.equal(record.schemaVersion, "1.0");
  assert.equal(record.scoringVersion, "quick-check-v1");
  assert.equal(record.workflowType, "quick-check");
  assert.equal(record.visibility, "private");
  assert.equal(record.aggregationEligible, true);
  assert.equal(record.computedSignal.signalLevel, "green");
  assert.deepEqual(record.loadFactors, []);
  assert.deepEqual(record.resourceFactors, []);
});

test("quick check formats standardized factor keys for user-facing output", () => {
  assert.equal(formatQuickCheckFactor("documentation.high"), "Dokumenteerimise koormus on kõrge");
  assert.equal(formatQuickCheckFactor("support.unclear_or_missing"), "Juhi või kolleegi tugi on ebaselge või puudub");
  assert.equal(formatQuickCheckFactor("unknown.factor"), "unknown.factor");
});
