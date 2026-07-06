import assert from "node:assert/strict";
import test from "node:test";

import {
  ROLE_BOUNDARIES_FIELD_KEYS,
  buildRoleBoundariesRecord,
  computeRoleBoundariesResult
} from "../../lib/wellbeing/roleBoundaries.js";

const baseFields = Object.freeze({
  expectationSource: "client_family",
  expectedAction: "solve_partner_delay",
  myRole: "case_worker",
  outsideRole: "make_other_agency_decision",
  neededResponsibility: "partner_agency",
  roleConflict: "high",
  partnerExplanationNeed: true,
  managerDiscussionNeed: true,
  availabilityPressure: "high",
  ethicalComplexity: "moderate",
  counterpart: "partner"
});

test("role boundaries exposes standardized fields for expectation and responsibility analysis", () => {
  assert.deepEqual(ROLE_BOUNDARIES_FIELD_KEYS, [
    "expectationSource",
    "expectedAction",
    "myRole",
    "outsideRole",
    "neededResponsibility",
    "roleConflict",
    "partnerExplanationNeed",
    "managerDiscussionNeed",
    "availabilityPressure",
    "ethicalComplexity",
    "counterpart"
  ]);
});

test("role boundaries escalates when role conflict and partner responsibility are unclear", () => {
  const result = computeRoleBoundariesResult(baseFields);

  assert.equal(result.signalLevel, "needs_network_discussion");
  assert.ok(result.loadFactors.includes("role_boundaries.role_conflict_high"));
  assert.ok(result.loadFactors.includes("role_boundaries.partner_explanation_needed"));
  assert.ok(result.resourceFactors.includes("role_boundaries.manager_discussion_needed"));
  assert.ok(result.riskMarkers.includes("role_boundaries.responsibility_shift"));
  assert.deepEqual(
    result.recommendedActions.map((action) => action.workflowType),
    ["work-boundaries", "work-processes", "interruptions", "covision", "overview"]
  );
});

test("role boundaries builds a private record with explanation-ready outputs", () => {
  const record = buildRoleBoundariesRecord({
    period: "current",
    roleGroup: "SOCIAL_WORKER",
    standardizedFields: baseFields
  });

  assert.equal(record.schemaVersion, "1.0");
  assert.equal(record.scoringVersion, "role-boundaries-v1");
  assert.equal(record.workflowType, "role-boundaries");
  assert.equal(record.visibility, "private");
  assert.equal(record.aggregationEligible, true);
  assert.equal(record.computedSignal.signalLevel, "needs_network_discussion");
  assert.match(record.outputSummary.roleBoundaryAnalysis, /Rollipiiride analüüs/);
  assert.match(record.outputSummary.clientExplanation, /Kliendile selgitus/);
  assert.match(record.outputSummary.partnerClarification, /Partnerile rolliselgitus/);
  assert.match(record.outputSummary.canCannotDoText, /Mida saan \/ mida ei saa teha/);
  assert.match(record.outputSummary.managerMemo, /Juhiga memo/);
});
