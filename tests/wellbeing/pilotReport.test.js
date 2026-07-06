import assert from "node:assert/strict";
import test from "node:test";

import { buildWellbeingPilotReport } from "../../lib/wellbeing/pilotReport.js";

function metric(metricKey, metricValue, sampleSize = 6) {
  return {
    metricKey,
    metricValue,
    sampleSize,
    aggregationLevel: "role_group",
    exportEligible: true
  };
}

test("pilot report suppresses priorities when aggregate dataset is suppressed", () => {
  const report = buildWellbeingPilotReport({
    suppressed: true,
    sampleSize: 2,
    minimumGroupSize: 3,
    metrics: []
  });

  assert.equal(report.status, "suppressed");
  assert.deepEqual(report.priorities, []);
  assert.deepEqual(report.recommendedAgreements, []);
  assert.match(report.privacyNotice, /üksiktöötajate vastuseid/);
});

test("pilot report turns anonymous metrics into work-organization priorities", () => {
  const report = buildWellbeingPilotReport({
    suppressed: false,
    sampleSize: 6,
    recordCount: 8,
    minimumGroupSize: 3,
    metrics: [
      metric("signal.red.count", 2),
      metric("signal.yellow.count", 3),
      metric("work_demand.documentation.high.count", 5),
      metric("work_demand.interruptions.high.count", 4),
      metric("work_resource.support.unclear_or_missing.count", 5),
      metric("risk_event.risk.difficult_case.count", 3),
      metric("workflow.quick-check.count", 6)
    ]
  });

  assert.equal(report.status, "open");
  assert.equal(report.signal.redCount, 2);
  assert.equal(report.signal.yellowCount, 3);
  assert.deepEqual(
    report.priorities.map((priority) => priority.metricKey),
    [
      "work_demand.documentation.high.count",
      "work_resource.support.unclear_or_missing.count",
      "work_demand.interruptions.high.count",
      "risk_event.risk.difficult_case.count"
    ]
  );
  assert.ok(report.recommendedAgreements.some((item) => item.key === "documentation_simplification"));
  assert.ok(report.recommendedAgreements.some((item) => item.key === "support_clarity"));
  assert.equal(JSON.stringify(report).includes("ownerUserId"), false);
});
