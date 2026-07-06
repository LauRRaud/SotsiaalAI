import assert from "node:assert/strict";
import test from "node:test";

import {
  WORK_BOUNDARIES_FIELD_KEYS,
  buildWorkBoundariesRecord,
  computeWorkBoundariesResult
} from "../../lib/wellbeing/workBoundaries.js";

const baseFields = Object.freeze({
  agreementType: "after_hours_availability",
  currentConcern: "Õhtused sõnumid katkestavad taastumist.",
  boundaryClarity: "partly_clear",
  afterHoursPressure: "moderate",
  pauseProtection: "partial",
  replacementCoverage: "unclear",
  urgentExceptionClarity: "partly_clear",
  counterpart: "manager",
  desiredPrinciple: "Töövälised kontaktid ainult kiire ohu korral.",
  exceptions: "Vahetu ohu olukord.",
  reviewTime: "two_weeks",
  supportNeed: "manager"
});

test("work boundaries exposes standardized fields for agreement drafts", () => {
  assert.deepEqual(WORK_BOUNDARIES_FIELD_KEYS, [
    "agreementType",
    "currentConcern",
    "boundaryClarity",
    "afterHoursPressure",
    "pauseProtection",
    "replacementCoverage",
    "urgentExceptionClarity",
    "counterpart",
    "desiredPrinciple",
    "exceptions",
    "reviewTime",
    "supportNeed"
  ]);
});

test("work boundaries escalates when after-hours pressure and unclear boundaries require agreement", () => {
  const result = computeWorkBoundariesResult({
    ...baseFields,
    boundaryClarity: "unclear",
    afterHoursPressure: "high",
    pauseProtection: "none",
    urgentExceptionClarity: "unclear"
  });

  assert.equal(result.signalLevel, "needs_agreement");
  assert.ok(result.loadFactors.includes("after_hours.impact"));
  assert.ok(result.resourceFactors.includes("clarity.unclear"));
  assert.ok(result.riskMarkers.includes("boundaries.after_hours_unclear"));
  assert.deepEqual(
    result.recommendedActions.map((action) => action.workflowType),
    ["recovery", "work-processes", "overview"]
  );
});

test("work boundaries builds a private boundary agreement record with draft outputs", () => {
  const record = buildWorkBoundariesRecord({
    period: "current",
    roleGroup: "SOCIAL_WORKER",
    standardizedFields: baseFields
  });

  assert.equal(record.schemaVersion, "1.0");
  assert.equal(record.scoringVersion, "work-boundaries-v1");
  assert.equal(record.workflowType, "work-boundaries");
  assert.equal(record.visibility, "private");
  assert.equal(record.aggregationEligible, true);
  assert.equal(record.computedSignal.signalLevel, "needs_clarification");
  assert.match(record.outputSummary.boundaryAgreement, /Tööpiiride kokkuleppe mustand/);
  assert.match(record.outputSummary.managerMemo, /Juhiga arutelu memo/);
  assert.match(record.outputSummary.documentInput, /Dokumendi koostamise sisend/);
});
