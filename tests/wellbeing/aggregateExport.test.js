import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWellbeingExportDataset,
  exportWellbeingCsv,
  exportWellbeingJson
} from "../../lib/wellbeing/aggregateExport.js";

function record(overrides = {}) {
  return {
    ownerUserId: "user_1",
    workflowType: "quick-check",
    computedSignal: { signalLevel: "red" },
    loadFactors: ["documentation.high"],
    resourceFactors: ["support.unclear_or_missing"],
    riskMarkers: ["risk.difficult_case"],
    ...overrides
  };
}

test("buildWellbeingExportDataset returns export metadata and anonymous metrics", async () => {
  const prisma = {
    wellbeingRecord: {
      findMany: async () => [
        record({ ownerUserId: "user_1" }),
        record({ ownerUserId: "user_2", computedSignal: { signalLevel: "yellow" } }),
        record({ ownerUserId: "user_3", workflowType: "work-processes", riskMarkers: [] })
      ]
    }
  };

  const dataset = await buildWellbeingExportDataset(
    { roleGroup: "child_protection", aggregationLevel: "role_group" },
    { prisma, now: new Date("2026-05-26T12:00:00.000Z") }
  );

  assert.equal(dataset.exportType, "wellbeing_aggregate");
  assert.equal(dataset.minimumGroupSize, 3);
  assert.equal(dataset.filters.roleGroup, "child_protection");
  assert.equal(dataset.metrics.some((metric) => metric.metricKey === "risk_event.risk.difficult_case.count"), true);
  assert.equal(JSON.stringify(dataset).includes("ownerUserId"), false);
});

test("exportWellbeingCsv serializes metrics without identities or free text", async () => {
  const dataset = {
    exportType: "wellbeing_aggregate",
    generatedAt: "2026-05-26T12:00:00.000Z",
    minimumGroupSize: 3,
    sampleSize: 3,
    suppressed: false,
    metrics: [
      {
        metricKey: "signal.red.count",
        metricValue: 1,
        sampleSize: 3,
        aggregationLevel: "role_group",
        exportEligible: true
      }
    ]
  };

  const csv = exportWellbeingCsv(dataset);

  assert.match(csv, /^metricKey,metricValue,sampleSize,aggregationLevel,exportEligible/m);
  assert.match(csv, /signal\.red\.count,1,3,role_group,true/);
  assert.equal(csv.includes("ownerUserId"), false);
});

test("exportWellbeingJson preserves suppression without leaking suppressed metric keys", () => {
  const dataset = {
    exportType: "wellbeing_aggregate",
    minimumGroupSize: 3,
    sampleSize: 2,
    suppressed: true,
    suppressionReason: "minimum_group_size",
    metrics: []
  };

  const json = exportWellbeingJson(dataset);

  assert.match(json, /"suppressed": true/);
  assert.equal(json.includes("risk.difficult_case"), false);
});
