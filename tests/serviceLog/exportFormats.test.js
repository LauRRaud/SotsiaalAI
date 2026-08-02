/**
 * TEENUSPÄEVIK E6 — DOCX ja PDF väljund.
 *
 * DoD 2 nõuab TERVIKLIKKU esitist. CSV üksi ei ole esitis: tunnitabel on
 * masinaloetav rida, aga sisuline aruanne on dokument, mille KOV loeb ja
 * osutaja allkirjastab. Need testid kaitsevad kahte asja: et fail on päriselt
 * see vorming, mida ta väidab olevat, ja et kirillitsa ei kao vaikselt ära.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { exportToDocx } from "../../lib/serviceLog/export/docx.js";
import { buildPdfText, exportToPdf } from "../../lib/serviceLog/export/pdf.js";
import { PRODUCT_NAME, buildRenderPlan, columnLabel } from "../../lib/serviceLog/export/render.js";
import { TEMPLATE } from "../../lib/serviceLog/export/templates.js";
import { exportFileName } from "../../lib/serviceLog/exportService.js";

function sampleDocument(overrides = {}) {
  return {
    template: TEMPLATE.A_TIMESHEET,
    header: [
      ["provider", "OÜ Hooldus"],
      ["registryCode", "12345678"],
      ["recipient", "Tartu linn"],
      ["period", "2026-08-01…2026-08-31"],
      ["contractRef", ""]
    ],
    columns: ["client", "date", "unit", "quantity"],
    rows: [
      { client: "Mari Mägi", date: "2026-08-03", unit: "HOUR", quantity: "2.00" },
      { client: "Jaan Kask", date: "2026-08-04", unit: "HOUR", quantity: "1.50" }
    ],
    footer: { totals: { HOUR: "3.50" }, entryCount: 2 },
    warnings: ["Mustandid jäid välja."],
    ...overrides
  };
}

test("renderdusplaan kannab tootenime täpselt", () => {
  const plan = buildRenderPlan(sampleDocument());
  assert.ok(plan.title.startsWith(PRODUCT_NAME), `pealkiri oli: ${plan.title}`);
  assert.ok(plan.title.includes("Teenuspäevik"));
});

/* Päised on FAILI keeles, mitte kasutajaliidese omas: fail läheb KOV-ile ja
   peab olema loetav ka siis, kui osutaja kasutab platvormi vene keeles. */
test("veerupäised on eestikeelsed ja tulevad ühest kohast", () => {
  const plan = buildRenderPlan(sampleDocument());
  assert.deepEqual(plan.table.head, ["Klient", "Kuupäev", "Ühik", "Kogus"]);
  assert.equal(columnLabel("travelMinutes"), "Sõiduaeg (min)");
  assert.equal(columnLabel("tundmatu_veerg"), "tundmatu_veerg", "tundmatu veerg jääb omaks");
});

/* Tühi päiserida ei tohi anda „Lepingu/hanke viide: " — tühjus ei ole info. */
test("tühjad päiseväljad jäetakse välja", () => {
  const plan = buildRenderPlan(sampleDocument());
  assert.ok(!plan.meta.some((line) => line.startsWith("Lepingu/hanke viide")));
  assert.ok(plan.meta.some((line) => line.startsWith("Osutaja: OÜ Hooldus")));
});

test("DOCX on päris zip ja sisaldab OOXML-i osi", () => {
  const buffer = exportToDocx(sampleDocument());
  assert.ok(Buffer.isBuffer(buffer));
  assert.equal(buffer[0], 0x50, "zip algab PK-ga");
  assert.equal(buffer[1], 0x4b);
  const raw = buffer.toString("latin1");
  assert.ok(raw.includes("word/document.xml"), "dokumendi osa peab olemas olema");
  assert.ok(raw.includes("[Content_Types].xml"));
});

/* SEE ON SELLE ETAPI PÕHJUS. PDF-kirjutaja on WinAnsi; kirillitsa nimi
   muutuks seal küsimärkideks ARVE ALUSDOKUMENDIS. DOCX peab ta ära kandma. */
test("kirillitsa nimi jõuab DOCX-i, PDF ütleb ausalt ei", () => {
  const document = sampleDocument({
    rows: [{ client: "Мария Иванова", date: "2026-08-03", unit: "HOUR", quantity: "2.00" }]
  });

  const docx = exportToDocx(document);
  assert.ok(Buffer.isBuffer(docx) && docx.length > 0);

  const pdf = exportToPdf(document);
  assert.equal(pdf.ok, false, "PDF ei tohi vaikselt küsimärke teha");
  assert.equal(pdf.reason, "unsupported_characters");
});

test("eesti täpitähed mahuvad PDF-i ära", () => {
  const document = sampleDocument({
    rows: [{ client: "Õnne Käär", date: "2026-08-03", unit: "HOUR", quantity: "2.00" }]
  });
  const pdf = exportToPdf(document);
  assert.equal(pdf.ok, true);
  assert.equal(pdf.buffer.subarray(0, 4).toString("latin1"), "%PDF");
});

test("PDF-tekst kannab pealkirja, hoiatused, tabeli ja kokkuvõtte", () => {
  const text = buildPdfText(sampleDocument());
  assert.ok(text.includes("Teenuspäevik"));
  assert.ok(text.includes("Mustandid jäid välja."), "hoiatus peab faili jõudma");
  assert.ok(text.includes("Mari Mägi"));
  assert.ok(text.includes("Kirjeid: 2"));
  const warningIndex = text.indexOf("Mustandid");
  const tableIndex = text.indexOf("Mari Mägi");
  assert.ok(warningIndex < tableIndex, "hoiatused tulevad enne numbreid");
});

/* Laiend tuli varem konstandist: DOCX oleks laadinud alla nimega .csv ja Word
   oleks keeldunud teda avamast. */
test("failinime laiend tuleb vormingust", () => {
  const base = { month: "2026-08", template: TEMPLATE.A_TIMESHEET, kovName: "Tartu linn" };
  assert.ok(exportFileName(base).endsWith(".csv"));
  assert.ok(exportFileName({ ...base, extension: "docx" }).endsWith(".docx"));
  assert.ok(exportFileName({ ...base, extension: "pdf" }).endsWith(".pdf"));
  assert.ok(
    exportFileName({ ...base, extension: "../../etc/passwd" }).endsWith(".csv"),
    "sodi ei tohi laiendisse jõuda"
  );
});
