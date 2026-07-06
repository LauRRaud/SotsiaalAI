import assert from "node:assert/strict";
import test from "node:test";

import {
  INTERRUPTIONS_FIELD_KEYS,
  buildInterruptionsRecord,
  computeInterruptionsResult
} from "../../lib/wellbeing/interruptions.js";

const baseFields = Object.freeze({
  interruptionClass: "negotiable",
  sources: ["phone", "colleague_questions", "documentation_system"],
  frequency: "often",
  workImpact: "moderate",
  immediateResponseNeed: "partial",
  canWait: "many",
  neededAgreement: "focus_time",
  counterpart: "team",
  wrongChannelShare: "some",
  documentationInterruption: true,
  recoveryImpact: "some"
});

test("interruptions exposes standardized fields for fragmentation diagnostics", () => {
  assert.deepEqual(INTERRUPTIONS_FIELD_KEYS, [
    "interruptionClass",
    "sources",
    "frequency",
    "workImpact",
    "immediateResponseNeed",
    "canWait",
    "neededAgreement",
    "counterpart",
    "wrongChannelShare",
    "documentationInterruption",
    "recoveryImpact"
  ]);
});

test("interruptions escalates when interruptions are frequent, high impact and from wrong channels", () => {
  const result = computeInterruptionsResult({
    ...baseFields,
    interruptionClass: "wrong_channel",
    frequency: "very_often",
    workImpact: "high",
    wrongChannelShare: "many",
    immediateResponseNeed: "unclear",
    recoveryImpact: "high"
  });

  assert.equal(result.signalLevel, "needs_reorganization");
  assert.ok(result.loadFactors.includes("interruptions.high_frequency"));
  assert.ok(result.loadFactors.includes("interruptions.wrong_channel"));
  assert.ok(result.resourceFactors.includes("focus_time.agreement_needed"));
  assert.ok(result.riskMarkers.includes("interruptions.recovery_impact_high"));
  assert.deepEqual(
    result.recommendedActions.map((action) => action.workflowType),
    ["work-boundaries", "work-processes", "recovery", "overview"]
  );
});

test("interruptions builds a private record with focus time and channel agreements", () => {
  const record = buildInterruptionsRecord({
    period: "current",
    roleGroup: "SOCIAL_WORKER",
    standardizedFields: baseFields
  });

  assert.equal(record.schemaVersion, "1.0");
  assert.equal(record.scoringVersion, "interruptions-v1");
  assert.equal(record.workflowType, "interruptions");
  assert.equal(record.visibility, "private");
  assert.equal(record.aggregationEligible, true);
  assert.equal(record.computedSignal.signalLevel, "needs_workflow_clarification");
  assert.match(record.outputSummary.interruptionMap, /Katkestuste kaart/);
  assert.match(record.outputSummary.focusTimeAgreement, /Fookusaja kokkulepe/);
  assert.match(record.outputSummary.channelAgreement, /Suhtluskanalite kokkulepe/);
  assert.match(record.outputSummary.managerMemo, /Juhiga arutelu memo/);
});
