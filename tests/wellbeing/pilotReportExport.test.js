import assert from "node:assert/strict";
import test from "node:test";

import {
  exportWellbeingPilotReportHtml,
  exportWellbeingPilotReportXlsx
} from "../../lib/wellbeing/pilotReportExport.js";
import { buildWellbeingPilotReport } from "../../lib/wellbeing/pilotReport.js";

const report = {
  reportType: "wellbeing_pilot_report",
  generatedAt: "2026-05-26T12:00:00.000Z",
  sampleSize: 6,
  recordCount: 8,
  minimumGroupSize: 3,
  privacyNotice: "Aruanne ei sisalda üksiktöötajate vastuseid ega vabatekste.",
  status: "open",
  signal: {
    redCount: 2,
    yellowCount: 3,
    greenCount: 1
  },
  priorities: [
    {
      metricKey: "work_demand.documentation.high.count",
      categoryLabel: "Töö nõudmine",
      label: "Dokumenteerimise koormus on kõrge",
      count: 5,
      sampleSize: 6
    }
  ],
  recommendedAgreements: [
    {
      key: "documentation_simplification",
      title: "Lihtsustada dokumenteerimise töövoogu",
      description: "Vaadata üle dubleerivad sisestused."
    }
  ]
};

test("pilot report HTML is printable and does not include raw identities", () => {
  const html = exportWellbeingPilotReportHtml(report, {
    filters: { roleGroup: "child_protection" }
  });

  assert.match(html, /<!doctype html>/i);
  assert.match(html, /KOV piloodi aruanne/);
  assert.match(html, /@media print/);
  assert.match(html, /Dokumenteerimise koormus on kõrge/);
  assert.match(html, /Lihtsustada dokumenteerimise töövoogu/);
  assert.equal(html.includes("ownerUserId"), false);
  assert.equal(html.includes("<script"), false);
});

test("pilot report XLSX creates an Excel workbook with report sheets", () => {
  const buffer = exportWellbeingPilotReportXlsx(report, {
    dataset: {
      metrics: [
        {
          metricKey: "signal.red.count",
          metricValue: 2,
          sampleSize: 6,
          aggregationLevel: "role_group",
          exportEligible: true
        }
      ]
    }
  });

  assert.ok(Buffer.isBuffer(buffer));
  assert.equal(buffer.subarray(0, 2).toString("utf8"), "PK");
  const zipText = buffer.toString("utf8");
  assert.match(zipText, /xl\/worksheets\/sheet1\.xml/);
  assert.match(zipText, /KOV piloodi aruanne/);
  assert.match(zipText, /Dokumenteerimise koormus on kõrge/);
  assert.match(zipText, /signal\.red\.count/);
  assert.equal(zipText.includes("ownerUserId"), false);
});

/* SOL-WB-04: ühik peab jõudma andmestikust VÄLJUNDINI. Enne seda parandust elas
   `analysisUnit` ainult JSON-andmestikus ja mõlemad inimloetavad väljundid —
   see, mida juht päriselt loeb — jätsid ta välja. Ahel on siin läbi käidud
   tervikuna: andmestik → aruanne → HTML ja XLSX. */
function personUnitReport() {
  return buildWellbeingPilotReport({
    analysisUnit: "latest_per_person",
    sampleSize: 6,
    recordCount: 120,
    countedRecordCount: 6,
    minimumGroupSize: 3,
    metrics: [
      {
        metricKey: "work_demand.documentation.high.count",
        metricValue: 5,
        denominator: 6,
        sampleSize: 6,
        aggregationLevel: "role_group",
        exportEligible: true
      }
    ]
  });
}

test("the analysis unit reaches the report object itself", () => {
  const built = personUnitReport();

  assert.equal(built.analysisUnit, "latest_per_person");
  assert.match(built.analysisUnitLabel, /inimene/i);
  assert.match(built.analysisUnitNotice, /INIMENE/);
  /* Just see lause on nüanss, mis muidu kaob: ühik on inimene JA töövoog. */
  assert.match(built.analysisUnitNotice, /töövoo kohta/);
  /* Kaks eri arvu, mis vanas kujus olid aruandes eristamatud. */
  assert.equal(built.recordCount, 120);
  assert.equal(built.countedRecordCount, 6);
});

test("printable HTML states the analysis unit next to the privacy notice", () => {
  const html = exportWellbeingPilotReportHtml(personUnitReport(), {});

  assert.match(html, /Analüüsiühik/);
  assert.match(html, /inimene/i);
  assert.match(html, /töövoo kohta/);
  /* Number, mille peal osakaal arvutati, peab olema väljas — mitte ainult
     `recordCount`, mis on kõigi leitud ridade arv. */
  assert.match(html, /Arvestatud ühikuid/);
});

test("the workbook states the analysis unit on the summary sheet", () => {
  const zipText = exportWellbeingPilotReportXlsx(personUnitReport(), { dataset: { metrics: [] } })
    .toString("utf8");

  assert.match(zipText, /Analüüsiühik/);
  assert.match(zipText, /Ühiku tähendus/);
  assert.match(zipText, /Arvestatud ühikuid/);
  /* Vana pealkiri „Valim" seisis `denominator` veeru peal ja ütles sama vale,
     mille SOL-WB-04 osakaaludest välja võttis. */
  assert.match(zipText, /Nimetaja/);
});
