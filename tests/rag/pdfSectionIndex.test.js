import assert from "node:assert/strict";
import test from "node:test";

import {
  applyPdfSectionAnalysisToMetadata,
  buildSectionIndexFromPageText,
  detectHeadingSectionsFromPages,
  detectTocSectionsFromPages,
  slugifySectionId
} from "../../scripts/lib/pdf-section-index.mjs";

const baseMetadata = {
  evidence_role: "practice_guidance",
  allowed_claim_types: ["practice_recommendation"],
  disallowed_claim_types: ["legal_entitlement"],
  topics: ["lastekaitse", "juhend"]
};

test("PDF TOC detection builds stable section index with page ranges", () => {
  const pages = [
    {
      page: 1,
      text: `
Sisukord
Sissejuhatus ................................ 3
Lastekaitse korraldus ....................... 5
Dokumenteerimine ja juhtumikorraldus ........ 12
Kokkuvote ................................... 20
`
    },
    { page: 2, text: "Eessona" },
    { page: 3, text: "Sissejuhatus" }
  ];

  const toc = detectTocSectionsFromPages(pages, { pageCount: 24 });
  assert.equal(toc.confidence, "medium");
  assert.equal(toc.entries.length, 4);

  const analysis = buildSectionIndexFromPageText(pages, baseMetadata, { pageCount: 24 });
  assert.equal(analysis.ok, true);
  assert.equal(analysis.method, "toc");
  assert.equal(analysis.sectionIndex.length, 4);
  assert.equal(analysis.sectionIndex[0].page_start, 3);
  assert.equal(analysis.sectionIndex[0].page_end, 4);
  assert.equal(analysis.sectionIndex.at(-1).page_end, 24);
  assert.equal(analysis.sectionIndex[0].evidence_role, "practice_guidance");
  assert.deepEqual(analysis.sectionIndex[0].allowed_claim_types, ["practice_recommendation"]);
});

test("PDF heading fallback is conservative and marks low confidence", () => {
  const pages = [
    { page: 1, text: "Lastekaitse probleemkohad\nTavatekst." },
    { page: 2, text: "Dokumenteerimise koormus\nTavatekst." },
    { page: 3, text: "Jarelevalve ootused\nTavatekst." }
  ];

  const headings = detectHeadingSectionsFromPages(pages);
  assert.equal(headings.confidence, "low");
  assert.equal(headings.entries.length, 3);

  const analysis = buildSectionIndexFromPageText(pages, baseMetadata, { pageCount: 3 });
  assert.equal(analysis.method, "heading");
  assert.equal(analysis.confidence, "low");
  assert.equal(analysis.sectionIndex.length, 3);
  assert.equal(analysis.warnings.includes("heading structure detected with low confidence"), true);
});

test("PDF section analysis does not invent sections when structure is not reliable", () => {
  const analysis = buildSectionIndexFromPageText([
    { page: 1, text: "See on pikk tavaline loik ilma sisukorra ja pealkirjadeta." },
    { page: 2, text: "Veel tavalist teksti ja mitte midagi muud." }
  ], baseMetadata, { pageCount: 2 });

  assert.equal(analysis.ok, false);
  assert.equal(analysis.method, "none");
  assert.deepEqual(analysis.sectionIndex, []);
  assert.equal(analysis.warnings.includes("sectionIndex remains empty"), true);
});

test("section analysis metadata records review flags without storing document text", () => {
  const analysis = buildSectionIndexFromPageText([
    { page: 1, text: "Sisukord\nPeatukk yks ................ 2\nPeatukk kaks ............... 4\nPeatukk kolm ............... 8" }
  ], baseMetadata, { pageCount: 10 });

  const metadata = applyPdfSectionAnalysisToMetadata({ quality: {} }, analysis);
  assert.equal(metadata.quality.section_index_complete, true);
  assert.equal(metadata.quality.needs_manual_review, false);
  assert.equal(metadata.pdf_section_analysis.section_count, 3);
  assert.equal(JSON.stringify(metadata).includes("Sisukord"), false);
});

test("section ids are ASCII stable", () => {
  assert.equal(slugifySectionId("Lastekaitse tootoo ja abi korraldus"), "lastekaitse-tootoo-ja-abi-korraldus");
});
