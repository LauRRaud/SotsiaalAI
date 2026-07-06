import assert from "node:assert/strict";
import test from "node:test";

import {
  WORK_PROCESSES_FIELD_KEYS,
  buildWorkProcessesRecord,
  computeWorkProcessesResult
} from "../../lib/wellbeing/workProcesses.js";

const baseFields = Object.freeze({
  analysisFocus: "documentation_flow",
  categories: ["documentation", "duplicate_entry", "information_search", "repetitive_tasks"],
  timeCostSources: ["same_data_multiple_places", "searching_partner_info", "manual_status_updates"],
  lowValueActivities: ["same_data_multiple_places", "manual_copying"],
  informationBlockers: ["unclear_owner", "missing_shared_view"],
  unfinishedWork: ["client_followup", "case_notes"],
  simplificationNeeds: ["single_entry", "shared_status_view"],
  documentationDuplication: "high",
  switchingLoad: "high",
  processImpact: "high",
  counterpart: "manager"
});

test("work processes exposes standardized fields for workflow and time-thief audit", () => {
  assert.deepEqual(WORK_PROCESSES_FIELD_KEYS, [
    "analysisFocus",
    "categories",
    "timeCostSources",
    "lowValueActivities",
    "informationBlockers",
    "unfinishedWork",
    "simplificationNeeds",
    "documentationDuplication",
    "switchingLoad",
    "processImpact",
    "counterpart"
  ]);
});

test("work processes escalates when duplicate documentation and switching load are high", () => {
  const result = computeWorkProcessesResult(baseFields);

  assert.equal(result.signalLevel, "needs_organizational_change");
  assert.ok(result.loadFactors.includes("processes.duplicate_entry"));
  assert.ok(result.loadFactors.includes("processes.switching_load_high"));
  assert.ok(result.resourceFactors.includes("processes.single_entry_needed"));
  assert.ok(result.riskMarkers.includes("processes.high_value_loss"));
  assert.deepEqual(
    result.recommendedActions.map((action) => action.workflowType),
    ["interruptions", "work-boundaries", "role-boundaries", "overview"]
  );
});

test("work processes builds a private record with process map and simplification outputs", () => {
  const record = buildWorkProcessesRecord({
    period: "current",
    roleGroup: "SOCIAL_WORKER",
    standardizedFields: baseFields
  });

  assert.equal(record.schemaVersion, "1.0");
  assert.equal(record.scoringVersion, "work-processes-v1");
  assert.equal(record.workflowType, "work-processes");
  assert.equal(record.visibility, "private");
  assert.equal(record.aggregationEligible, true);
  assert.equal(record.computedSignal.signalLevel, "needs_organizational_change");
  assert.match(record.outputSummary.processMap, /Tööprotsessi kaart/);
  assert.match(record.outputSummary.topTimeThieves, /Kolm suurimat ajaröövlit/);
  assert.match(record.outputSummary.documentationSimplification, /Dokumenteerimise lihtsustamise ettepanek/);
  assert.match(record.outputSummary.informationFlowSummary, /Info liikumise kokkuvõte/);
  assert.match(record.outputSummary.managerMemo, /Töökorralduse arutelu memo/);
});
