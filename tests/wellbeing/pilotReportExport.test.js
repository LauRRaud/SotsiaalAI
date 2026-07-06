import assert from "node:assert/strict";
import test from "node:test";

import {
  exportWellbeingPilotReportHtml,
  exportWellbeingPilotReportXlsx
} from "../../lib/wellbeing/pilotReportExport.js";

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
