import assert from "node:assert/strict";
import test from "node:test";

import {
  STARTER_SUPPORT_FIELD_KEYS,
  buildStarterSupportRecord,
  computeStarterSupportResult
} from "../../lib/wellbeing/starterSupport.js";

const baseFields = Object.freeze({
  experienceStage: "first_month",
  roleArea: "child_protection",
  unclearTopics: ["role_boundaries", "documentation", "network_work"],
  existingSupport: ["manager_check_in"],
  missingSupport: ["mentor", "covision", "clear_documentation_routine"],
  casesNotCarryAlone: ["complex_family_case"],
  covisionNeedSigns: ["ethical_tension", "role_uncertainty"],
  mentorDiscussionNeed: true,
  managerDiscussionNeed: true,
  workBoundaryNeed: true,
  supportUrgency: "soon"
});

test("starter support exposes standardized fields for the 100 day support journey", () => {
  assert.deepEqual(STARTER_SUPPORT_FIELD_KEYS, [
    "experienceStage",
    "roleArea",
    "unclearTopics",
    "existingSupport",
    "missingSupport",
    "casesNotCarryAlone",
    "covisionNeedSigns",
    "mentorDiscussionNeed",
    "managerDiscussionNeed",
    "workBoundaryNeed",
    "supportUrgency"
  ]);
});

test("starter support escalates when support gaps and cases not to carry alone are present", () => {
  const result = computeStarterSupportResult(baseFields);

  assert.equal(result.signalLevel, "needs_urgent_support_agreement");
  assert.ok(result.loadFactors.includes("starter_support.missing_support"));
  assert.ok(result.loadFactors.includes("starter_support.cases_not_carry_alone"));
  assert.ok(result.resourceFactors.includes("starter_support.mentor_needed"));
  assert.ok(result.riskMarkers.includes("starter_support.early_role_uncertainty"));
  assert.deepEqual(
    result.recommendedActions.map((action) => action.workflowType),
    ["role-boundaries", "work-processes", "work-boundaries", "covision", "overview"]
  );
});

test("starter support builds a private record with first week, month and 100 day outputs", () => {
  const record = buildStarterSupportRecord({
    period: "current",
    roleGroup: "SOCIAL_WORKER",
    standardizedFields: baseFields
  });

  assert.equal(record.schemaVersion, "1.0");
  assert.equal(record.scoringVersion, "starter-support-v1");
  assert.equal(record.workflowType, "starter-support");
  assert.equal(record.visibility, "private");
  assert.equal(record.aggregationEligible, true);
  assert.equal(record.computedSignal.signalLevel, "needs_urgent_support_agreement");
  assert.match(record.outputSummary.firstWeekPlan, /Esimese nädala plaan/);
  assert.match(record.outputSummary.firstMonthFocus, /Esimese kuu fookused/);
  assert.match(record.outputSummary.hundredDaySupportPlan, /100 päeva töötoe plaan/);
  assert.match(record.outputSummary.managerMentorQuestions, /Küsimused juhile või mentorile/);
  assert.match(record.outputSummary.covisionNeedCheck, /Kovisiooni vajaduse kontroll/);
  assert.match(record.outputSummary.boundaryDraft, /Alustaja tööpiiride mustand/);
});
