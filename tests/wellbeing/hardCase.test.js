import assert from "node:assert/strict";
import test from "node:test";

import {
  HARD_CASE_FIELD_KEYS,
  buildHardCaseRecord,
  computeHardCaseResult
} from "../../lib/wellbeing/hardCase.js";

const baseFields = Object.freeze({
  caseType: "emotionally_heavy",
  immediateDanger: "no",
  generalizedDescription: "Keeruline kohtumine, mis jättis tööalase pinge ja vajab järeltegevuse korrastamist.",
  professionalRole: "case_worker",
  mainLoad: "emotional_load",
  ethicalTension: "moderate",
  moralDistress: "some",
  traumaExposure: "indirect",
  roleClarity: "partly_clear",
  shouldNotCarryAlone: true,
  next24hNeeds: ["manager_check_in", "document_key_facts"],
  covisionNeed: true,
  recoveryNeed: "partial"
});

test("hard case exposes standardized fields for 24h aftercare planning", () => {
  assert.deepEqual(HARD_CASE_FIELD_KEYS, [
    "caseType",
    "immediateDanger",
    "generalizedDescription",
    "professionalRole",
    "mainLoad",
    "ethicalTension",
    "moralDistress",
    "traumaExposure",
    "roleClarity",
    "shouldNotCarryAlone",
    "next24hNeeds",
    "covisionNeed",
    "recoveryNeed"
  ]);
});

test("hard case shows urgent safety signal when immediate danger may still exist", () => {
  const result = computeHardCaseResult({
    ...baseFields,
    immediateDanger: "uncertain",
    ethicalTension: "high",
    moralDistress: "strong",
    traumaExposure: "direct",
    recoveryNeed: "high"
  });

  assert.equal(result.signalLevel, "urgent_attention");
  assert.equal(result.safetyNoticeRequired, true);
  assert.ok(result.loadFactors.includes("case.difficult"));
  assert.ok(result.loadFactors.includes("trauma.exposure"));
  assert.ok(result.resourceFactors.includes("support.do_not_carry_alone"));
  assert.ok(result.riskMarkers.includes("hard_case.immediate_danger_uncertain"));
  assert.deepEqual(
    result.recommendedActions.map((action) => action.workflowType),
    ["recovery", "covision", "role-boundaries", "overview"]
  );
});

test("hard case builds a private record with aftercare and shareable outputs", () => {
  const record = buildHardCaseRecord({
    period: "current",
    roleGroup: "SOCIAL_WORKER",
    standardizedFields: baseFields
  });

  assert.equal(record.schemaVersion, "1.0");
  assert.equal(record.scoringVersion, "hard-case-v1");
  assert.equal(record.workflowType, "hard-case");
  assert.equal(record.visibility, "private");
  assert.equal(record.aggregationEligible, true);
  assert.equal(record.computedSignal.signalLevel, "needs_attention");
  assert.equal(record.computedSignal.safetyNoticeRequired, false);
  assert.match(record.outputSummary.aftercarePlan24h, /24h järelplaan/);
  assert.match(record.outputSummary.neutralSummary, /Neutraalne kokkuvõte/);
  assert.match(record.outputSummary.managerMemo, /Juhiga arutelu memo/);
  assert.match(record.outputSummary.covisionInput, /Kovisiooni sisend/);
});
