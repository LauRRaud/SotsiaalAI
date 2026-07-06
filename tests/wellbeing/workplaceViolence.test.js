import assert from "node:assert/strict";
import test from "node:test";

import {
  WORKPLACE_VIOLENCE_FIELD_KEYS,
  buildWorkplaceViolenceRecord,
  computeWorkplaceViolenceResult
} from "../../lib/wellbeing/workplaceViolence.js";

const baseFields = Object.freeze({
  violenceType: "aggression",
  dangerStatus: "ended",
  generalizedDescription: "Tööalane olukord, kus suhtlus muutus ähvardavaks ja vajab neutraalset järelkirjeldust.",
  locationOrChannel: "office",
  documentedStatus: "not_yet",
  workImpact: "moderate",
  safetyImpact: "some",
  nextStepNeed: "manager_followup",
  safetyAgreementNeed: "yes",
  covisionNeed: true,
  recoveryNeed: "partial"
});

test("workplace violence exposes standardized fields for safety and neutral documentation", () => {
  assert.deepEqual(WORKPLACE_VIOLENCE_FIELD_KEYS, [
    "violenceType",
    "dangerStatus",
    "generalizedDescription",
    "locationOrChannel",
    "documentedStatus",
    "workImpact",
    "safetyImpact",
    "nextStepNeed",
    "safetyAgreementNeed",
    "covisionNeed",
    "recoveryNeed"
  ]);
});

test("workplace violence requires visible safety notice when danger may continue", () => {
  const result = computeWorkplaceViolenceResult({
    ...baseFields,
    violenceType: "physical_danger",
    dangerStatus: "ongoing",
    workImpact: "high",
    safetyImpact: "high",
    documentedStatus: "partial",
    recoveryNeed: "high"
  });

  assert.equal(result.signalLevel, "urgent_attention");
  assert.equal(result.safetyNoticeRequired, true);
  assert.ok(result.loadFactors.includes("violence.workplace"));
  assert.ok(result.loadFactors.includes("violence.physical_danger"));
  assert.ok(result.riskMarkers.includes("workplace_violence.danger_ongoing"));
  assert.ok(result.resourceFactors.includes("safety.agreement_needed"));
  assert.deepEqual(
    result.recommendedActions.map((action) => action.workflowType),
    ["recovery", "covision", "work-boundaries", "overview"]
  );
});

test("workplace violence builds a private record with neutral and safety outputs", () => {
  const record = buildWorkplaceViolenceRecord({
    period: "current",
    roleGroup: "SOCIAL_WORKER",
    standardizedFields: baseFields
  });

  assert.equal(record.schemaVersion, "1.0");
  assert.equal(record.scoringVersion, "workplace-violence-v1");
  assert.equal(record.workflowType, "workplace-violence");
  assert.equal(record.visibility, "private");
  assert.equal(record.aggregationEligible, true);
  assert.equal(record.computedSignal.signalLevel, "needs_attention");
  assert.equal(record.computedSignal.safetyNoticeRequired, false);
  assert.match(record.outputSummary.neutralIncidentDescription, /Neutraalne juhtumikirjeldus/);
  assert.match(record.outputSummary.safetyAgreementInput, /Turvalisuse kokkuleppe sisend/);
  assert.match(record.outputSummary.managerMemo, /Juhiga arutelu memo/);
  assert.match(record.outputSummary.covisionInput, /Kovisiooni sisend/);
  assert.match(record.outputSummary.workArrangementRecommendation, /Töökorralduse muutmise soovitus/);
});
