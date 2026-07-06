import assert from "node:assert/strict";
import test from "node:test";

import { buildWellbeingPilotReport } from "../../lib/wellbeing/pilotReport.js";

test("pilot report adds a decision-friendly executive summary", () => {
  const report = buildWellbeingPilotReport({
    suppressed: false,
    sampleSize: 8,
    recordCount: 12,
    minimumGroupSize: 3,
    metrics: [
      { metricKey: "signal.red.count", metricValue: 2, sampleSize: 8 },
      { metricKey: "signal.yellow.count", metricValue: 3, sampleSize: 8 },
      { metricKey: "signal.green.count", metricValue: 7, sampleSize: 8 },
      { metricKey: "work_demand.documentation.high.count", metricValue: 5, sampleSize: 8 },
      { metricKey: "work_resource.support.unclear_or_missing.count", metricValue: 4, sampleSize: 8 }
    ]
  });

  assert.equal(report.executiveSummary.statusLabel, "Tähelepanu vajav");
  assert.match(report.decisionSummary, /8 töötaja/);
  assert.match(report.decisionSummary, /2 punast/);
  assert.deepEqual(report.primaryRecommendation, {
    title: "Lihtsustada dokumenteerimise töövoogu",
    description: "Vaadata üle dubleerivad sisestused, korduvad vormid ja kohad, kus sama info liigub mitmesse süsteemi."
  });
  assert.deepEqual(report.decisionFocus, [
    "Dokumenteerimise koormus on kõrge",
    "Juhi või kolleegi tugi on ebaselge või puudub"
  ]);
});

test("suppressed pilot report explains why decisions cannot use detailed priorities", () => {
  const report = buildWellbeingPilotReport({
    suppressed: true,
    sampleSize: 2,
    recordCount: 2,
    minimumGroupSize: 3,
    metrics: []
  });

  assert.equal(report.executiveSummary.statusLabel, "Valim liiga väike");
  assert.match(report.decisionSummary, /alla miinimumgrupi/);
  assert.deepEqual(report.decisionFocus, []);
  assert.equal(report.primaryRecommendation, null);
});
