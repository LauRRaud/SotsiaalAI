import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_WELLBEING_ANALYSIS_UNIT,
  buildWellbeingAggregateDataset,
  normalizeWellbeingAnalysisUnit
} from "../../lib/wellbeing/aggregate.js";
import { buildWellbeingPilotReport } from "../../lib/wellbeing/pilotReport.js";

/* SOL-WB-04 omaniku otsus 12.08: vaikeühik on INIMENE. Vahetus tehti ajal, mil
   tootmises oli 0 `WellbeingRecord` rida, 0 pilooti ja 0 vaatajat — ühegi
   olemasoleva aruande tähendus ei muutunud. */
test("the default analysis unit is one voice per person", async () => {
  assert.equal(DEFAULT_WELLBEING_ANALYSIS_UNIT, "latest_per_person");
  assert.equal(normalizeWellbeingAnalysisUnit(undefined), "latest_per_person");
  assert.equal(normalizeWellbeingAnalysisUnit(""), "latest_per_person");

  const dataset = await buildWellbeingAggregateDataset({}, {
    prisma: loudAndQuiet(),
    env: { WELLBEING_MIN_GROUP_SIZE: "3" }
  });

  assert.equal(dataset.analysisUnit, "latest_per_person", "ühikut küsimata saab inimeste vaate");
  assert.equal(dataset.countedRecordCount, 5);
  assert.equal(
    dataset.metrics.find((metric) => metric.metricKey === "signal.red.count").metricValue,
    1,
    "sada sisestust ei anna enam sada punast"
  );
});

/* Sagedusvaade ei tohi kaduda — ta vastab teisele küsimusele („kui tihti see
   kordub"), mitte samale küsimusele halvemini. */
test("the event-frequency view is still reachable by name", async () => {
  const dataset = await buildWellbeingAggregateDataset({}, {
    prisma: loudAndQuiet(),
    env: { WELLBEING_MIN_GROUP_SIZE: "3" },
    analysisUnit: "record"
  });

  assert.equal(dataset.analysisUnit, "record");
  assert.equal(dataset.countedRecordCount, 104);
});

/* Tundmatu ühik VISKAB. Vaikne tagasilangus tähendaks, et klient küsib
   sagedusvaadet ja saab inimeste vaate sama nime all — sama vaikimise klass,
   mille SOL-WB-03 ohuväärtuse pealt välja võttis. */
test("an unknown analysis unit is refused instead of silently defaulted", () => {
  for (const attempt of ["records", "per_person", "LATEST_PER_PERSON", "kirje", "1"]) {
    assert.throws(
      () => normalizeWellbeingAnalysisUnit(attempt),
      (error) => error.status === 400 && /analysis_unit_invalid/.test(error.message),
      `${attempt} oleks vaikselt läbi läinud`
    );
  }

  /* Negatiivkontroll: vana avaldis `String(x || "record")` andis igale tundmatule
     väärtusele sagedusvaate ilma ühegi märguandeta. */
  assert.equal(String("records" || "record"), "records");
});

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
  /* Vaiksed inimesed lävendini välja (SOL-WB-06 põrand on 5) — muidu mõõdaks
     see fail summutust, mitte analüüsiühikut. */
  for (const owner of ["user_a", "user_b", "user_c", "user_d"]) {
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
    env: { WELLBEING_MIN_GROUP_SIZE: "3" },
    /* Sagedusvaadet tuleb nüüd nimeliselt küsida — vaikeühik on inimene. */
    analysisUnit: "record"
  });

  assert.equal(dataset.sampleSize, 5, "viis inimest");
  assert.equal(dataset.analysisUnit, "record");
  assert.equal(dataset.countedRecordCount, 104);

  const red = dataset.metrics.find((metric) => metric.metricKey === "signal.red.count");
  assert.equal(red.metricValue, 100);
  /* Nimetaja on SAMA ühik mis lugejal — kirjed, mitte inimesed. Varem oli
     `sampleSize` ainus kaasas käiv arv ja „100/5" oleks andnud 2000%. */
  assert.equal(red.denominator, 104);
  assert.equal(red.sampleSize, 5);

  const share = dataset.metrics.find((metric) => metric.metricKey === "signal.red.share");
  assert.ok(share.metricValue <= 1, "osakaal ei tohi ületada 100%");
  assert.equal(Math.round(share.metricValue * 100), 96);
});

test("with the person unit the same data gives one voice per person", async () => {
  const dataset = await buildWellbeingAggregateDataset({}, {
    prisma: loudAndQuiet(),
    env: { WELLBEING_MIN_GROUP_SIZE: "3" },
    analysisUnit: "latest_per_person"
  });

  assert.equal(dataset.analysisUnit, "latest_per_person");
  assert.equal(dataset.sampleSize, 5);
  assert.equal(dataset.countedRecordCount, 5, "üks kirje inimese ja töövoo kohta");
  /* Sada sisestust ei määra enam kogu prioriteedijärjestust: aktiivsest
     inimesest jääb üks punane, mitte sada. */
  assert.equal(dataset.metrics.find((metric) => metric.metricKey === "signal.red.count").metricValue, 1);
  assert.equal(dataset.metrics.find((metric) => metric.metricKey === "signal.green.count").metricValue, 4);
  assert.equal(
    dataset.metrics.find((metric) => metric.metricKey === "work_demand.documentation.high.count").metricValue,
    1
  );
  /* `recordCount` jääb kõigi leitud ridade arvuks — ühik ja kärbe on eri
     küsimused ja neid ei tohi ühte arvu kokku suruda. */
  assert.equal(dataset.recordCount, 104);
});

test("the report's percentages use the same unit as its counts", async () => {
  const dataset = await buildWellbeingAggregateDataset({}, {
    prisma: loudAndQuiet(),
    env: { WELLBEING_MIN_GROUP_SIZE: "3" },
    analysisUnit: "record"
  });
  const report = buildWellbeingPilotReport(dataset);
  const priority = report.priorities.find((item) => item.metricKey === "work_demand.documentation.high.count");

  assert.equal(priority.count, 100);
  assert.equal(priority.denominator, 104);
  assert.equal(priority.sampleSize, 5);

  /* Negatiivkontroll: vana nimetaja (inimeste arv) annab sellel real 2000%.
     Number sõltub valimist, absurd mitte — osakaal ületab 100% niikuinii. */
  assert.equal(Math.round((priority.count / priority.sampleSize) * 100), 2000);
  assert.ok((priority.count / priority.sampleSize) > 1, "vana nimetaja ületab 100%");
  assert.ok((priority.count / priority.denominator) <= 1);
});
