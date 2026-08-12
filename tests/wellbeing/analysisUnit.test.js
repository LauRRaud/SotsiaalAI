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
  assert.equal(dataset.countedRecordCount, 10);
  assert.equal(
    dataset.metrics.find((metric) => metric.metricKey === "signal.red.count").metricValue,
    5,
    "sada sisestust ei anna enam sada punast — viielt inimeselt tuleb viis"
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
  assert.equal(dataset.countedRecordCount, 105);
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
   ühe ning kontrollima otsustatud kaalu."
 *
 * SOL-WB-06 saba lisas ühe piirangu: inimeste vaates annab üks väga aktiivne
 * inimene ÜHE punase, ja üks punane on alla lävendi — lahter läheks summutusse
 * ja see fail mõõdaks summutust, mitte analüüsiühikut. Seepärast on punaseid
 * inimesi viis, aga sada kirjet on endiselt peaaegu kõik ühe oma (96 vs 4).
 * Kontrast, mida test mõõdab, jääb täpselt samaks: `record` annab 100, `person`
 * annab 5. */
function loudAndQuiet() {
  const rows = [];
  for (let index = 0; index < 96; index += 1) {
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
  for (const owner of ["user_red_a", "user_red_b", "user_red_c", "user_red_d"]) {
    rows.push({
      id: `red_${owner}`,
      ownerUserId: owner,
      workflowType: "quick-check",
      computedSignal: { signalLevel: "red" },
      loadFactors: ["documentation.high"],
      resourceFactors: [],
      riskMarkers: [],
      createdAt: new Date(Date.UTC(2026, 0, 2))
    });
  }
  /* Vaiksed inimesed lävendini välja (SOL-WB-06 põrand on 5). */
  for (const owner of ["user_a", "user_b", "user_c", "user_d", "user_e"]) {
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

  assert.equal(dataset.sampleSize, 10, "kümme inimest");
  assert.equal(dataset.analysisUnit, "record");
  assert.equal(dataset.countedRecordCount, 105);

  const red = dataset.metrics.find((metric) => metric.metricKey === "signal.red.count");
  assert.equal(red.metricValue, 100);
  /* Nimetaja on SAMA ühik mis lugejal — kirjed, mitte inimesed. Varem oli
     `sampleSize` ainus kaasas käiv arv ja „100/10" oleks andnud 1000%. */
  assert.equal(red.denominator, 105);
  assert.equal(red.sampleSize, 10);

  const share = dataset.metrics.find((metric) => metric.metricKey === "signal.red.share");
  assert.ok(share.metricValue <= 1, "osakaal ei tohi ületada 100%");
  assert.equal(Math.round(share.metricValue * 100), 95);
});

test("with the person unit the same data gives one voice per person", async () => {
  const dataset = await buildWellbeingAggregateDataset({}, {
    prisma: loudAndQuiet(),
    env: { WELLBEING_MIN_GROUP_SIZE: "3" },
    analysisUnit: "latest_per_person"
  });

  assert.equal(dataset.analysisUnit, "latest_per_person");
  assert.equal(dataset.sampleSize, 10);
  assert.equal(dataset.countedRecordCount, 10, "üks kirje inimese ja töövoo kohta");
  /* Sada sisestust ei määra enam kogu prioriteedijärjestust: aktiivsest
     inimesest jääb üks punane, mitte 96. */
  assert.equal(dataset.metrics.find((metric) => metric.metricKey === "signal.red.count").metricValue, 5);
  assert.equal(dataset.metrics.find((metric) => metric.metricKey === "signal.green.count").metricValue, 5);
  assert.equal(
    dataset.metrics.find((metric) => metric.metricKey === "work_demand.documentation.high.count").metricValue,
    5
  );
  /* `recordCount` jääb kõigi leitud ridade arvuks — ühik ja kärbe on eri
     küsimused ja neid ei tohi ühte arvu kokku suruda. */
  assert.equal(dataset.recordCount, 105);
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
  assert.equal(priority.denominator, 105);
  assert.equal(priority.sampleSize, 10);

  /* Negatiivkontroll: vana nimetaja (inimeste arv) annab sellel real 1000%.
     Number sõltub valimist, absurd mitte — osakaal ületab 100% niikuinii. */
  assert.equal(Math.round((priority.count / priority.sampleSize) * 100), 1000);
  assert.ok((priority.count / priority.sampleSize) > 1, "vana nimetaja ületab 100%");
  assert.ok((priority.count / priority.denominator) <= 1);
});
