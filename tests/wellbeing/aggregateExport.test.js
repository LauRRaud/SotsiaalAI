import assert from "node:assert/strict";
import test from "node:test";

import { WELLBEING_MINIMUM_GROUP_SIZE_FLOOR } from "../../lib/wellbeing/aggregate.js";
import {
  buildWellbeingExportDataset,
  csvCell,
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
        /* Valim lävendini välja JA sama riskimarker kõigil, muidu mõõdaks see
           fail summutust, mitte ekspordi metaandmeid: SOL-WB-06 saba paneb
           kinni ka üksiku lahtri, mitte ainult liiga väikese valimi. */
        ...["user_3", "user_4", "user_5"].map((ownerUserId) => record({
          ownerUserId,
          workflowType: "work-processes"
        }))
      ]
    }
  };

  const dataset = await buildWellbeingExportDataset(
    { roleGroup: "child_protection", aggregationLevel: "role_group" },
    { prisma, now: new Date("2026-05-26T12:00:00.000Z") }
  );

  assert.equal(dataset.exportType, "wellbeing_aggregate");
  assert.equal(dataset.minimumGroupSize, WELLBEING_MINIMUM_GROUP_SIZE_FLOOR);
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

  assert.match(
    csv,
    /^metricKey,metricValue,denominator,sampleSize,analysisUnit,aggregationLevel,exportEligible/m
  );
  assert.match(csv, /signal\.red\.count,1,3,3,record,role_group,true/);
  assert.equal(csv.includes("ownerUserId"), false);
});

/* SOL-WB-04: ühik ja nimetaja peavad CSV-s olema IGAL REAL. Tabelis
   sorteeritakse ja filtreeritakse — päisekommentaar või eraldi metaandmete plokk
   kaoks esimese sortimisega ja alles jääks paljas arv. */
test("exportWellbeingCsv carries the analysis unit and denominator on every row", () => {
  const dataset = {
    analysisUnit: "latest_per_person",
    countedRecordCount: 3,
    sampleSize: 3,
    metrics: [
      { metricKey: "signal.red.count", metricValue: 1, denominator: 3, sampleSize: 3, aggregationLevel: "role_group", exportEligible: true },
      { metricKey: "signal.green.count", metricValue: 2, denominator: 3, sampleSize: 3, aggregationLevel: "role_group", exportEligible: true }
    ]
  };

  const lines = exportWellbeingCsv(dataset).trim().split("\n");
  assert.equal(lines.length, 3, "päis + kaks rida");

  for (const line of lines.slice(1)) {
    assert.match(line, /latest_per_person/, "ühik peab olema real, mitte ainult päises");
  }

  /* Negatiivkontroll: vana veerukogum jättis nimetaja välja, seega ainus arv,
     mille vastu `metricValue` jagada andis, oli INIMESTE arv. Kui nimetaja
     veerg kaob, kaob ka see kontroll — hoiame teda nimeliselt. */
  assert.equal(lines[0].split(",").includes("denominator"), true);
  assert.equal(lines[0].split(",").indexOf("denominator") < lines[0].split(",").indexOf("sampleSize"), true,
    "nimetaja peab olema valimist EES, et teda esimesena loetaks");
});

test("csvCell neutralizes formula-looking strings after leading spaces or tabs", () => {
  for (const value of ["=SUM(A1:A2)", "+1+1", "-cmd", "@reference", "  =SUM(A1:A2)", "\t@reference"]) {
    assert.equal(csvCell(value), `'${value}`);
  }
});

test("csvCell preserves ordinary numeric and system values", () => {
  assert.equal(csvCell(42), "42");
  assert.equal(csvCell(-1), "-1");
  assert.equal(csvCell("signal.red.count"), "signal.red.count");
  assert.equal(csvCell("line one\nline two"), '"line one\nline two"');
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
