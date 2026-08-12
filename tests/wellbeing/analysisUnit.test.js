import assert from "node:assert/strict";
import test from "node:test";

import { buildWellbeingAggregateDataset } from "../../lib/wellbeing/aggregate.js";
import { buildWellbeingPilotReport } from "../../lib/wellbeing/pilotReport.js";

/* SOL-WB-04 kriteerium: „Test peab andma ühele inimesele 100 kirjet ja kahele
   ühe ning kontrollima otsustatud kaalu." */
function loudAndQuiet() {
  const rows = [];
  for (let index = 0; index < 100; index += 1) {
    rows.push({
      id: `loud_${index}`,
      ownerUserId: "user_loud",
      workflowType: "quick-check",
      computedSignal: { signalLevel: "red" },
      loadFactors: ["documentation.high"],
      resourceFactors: [],
      riskMarkers: [],
      createdAt: new Date(Date.UTC(2026, 0, 1) + index * 60_000)
    });
  }
  for (const owner of ["user_a", "user_b"]) {
    rows.push({
      id: `quiet_${owner}`,
      ownerUserId: owner,
      workflowType: "quick-check",
      computedSignal: { signalLevel: "green" },
      loadFactors: [],
      resourceFactors: [],
      riskMarkers: [],
      createdAt: new Date(Date.UTC(2026, 0, 2))
    });
  }
  return { wellbeingRecord: { findMany: async () => rows } };
}

test("with the event unit one very active person still carries the counts — but the numbers say so", async () => {
  const dataset = await buildWellbeingAggregateDataset({}, {
    prisma: loudAndQuiet(),
    env: { WELLBEING_MIN_GROUP_SIZE: "3" }
  });

  assert.equal(dataset.sampleSize, 3, "kolm inimest");
  assert.equal(dataset.analysisUnit, "record");
  assert.equal(dataset.countedRecordCount, 102);

  const red = dataset.metrics.find((metric) => metric.metricKey === "signal.red.count");
  assert.equal(red.metricValue, 100);
  /* Nimetaja on SAMA ühik mis lugejal — kirjed, mitte inimesed. Varem oli
     `sampleSize` (3) ainus kaasas käiv arv ja „100/3" oli 3333%. */
  assert.equal(red.denominator, 102);
  assert.equal(red.sampleSize, 3);

  const share = dataset.metrics.find((metric) => metric.metricKey === "signal.red.share");
  assert.ok(share.metricValue <= 1, "osakaal ei tohi ületada 100%");
  assert.equal(Math.round(share.metricValue * 100), 98);
});

test("with the person unit the same data gives one voice per person", async () => {
  const dataset = await buildWellbeingAggregateDataset({}, {
    prisma: loudAndQuiet(),
    env: { WELLBEING_MIN_GROUP_SIZE: "3" },
    analysisUnit: "latest_per_person"
  });

  assert.equal(dataset.analysisUnit, "latest_per_person");
  assert.equal(dataset.sampleSize, 3);
  assert.equal(dataset.countedRecordCount, 3, "üks kirje inimese ja töövoo kohta");
  /* Sada sisestust ei määra enam kogu prioriteedijärjestust: aktiivsest
     inimesest jääb üks punane, mitte sada. */
  assert.equal(dataset.metrics.find((metric) => metric.metricKey === "signal.red.count").metricValue, 1);
  assert.equal(dataset.metrics.find((metric) => metric.metricKey === "signal.green.count").metricValue, 2);
  assert.equal(
    dataset.metrics.find((metric) => metric.metricKey === "work_demand.documentation.high.count").metricValue,
    1
  );
  /* `recordCount` jääb kõigi leitud ridade arvuks — ühik ja kärbe on eri
     küsimused ja neid ei tohi ühte arvu kokku suruda. */
  assert.equal(dataset.recordCount, 102);
});

test("the report's percentages use the same unit as its counts", async () => {
  const dataset = await buildWellbeingAggregateDataset({}, {
    prisma: loudAndQuiet(),
    env: { WELLBEING_MIN_GROUP_SIZE: "3" }
  });
  const report = buildWellbeingPilotReport(dataset);
  const priority = report.priorities.find((item) => item.metricKey === "work_demand.documentation.high.count");

  assert.equal(priority.count, 100);
  assert.equal(priority.denominator, 102);
  assert.equal(priority.sampleSize, 3);

  /* Negatiivkontroll: vana nimetaja (inimeste arv) annab sellel real 3333%. */
  assert.equal(Math.round((priority.count / priority.sampleSize) * 100), 3333);
  assert.ok((priority.count / priority.denominator) <= 1);
});
