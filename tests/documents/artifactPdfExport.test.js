import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { canCreateArtifactPdf, createArtifactPdfBuffer } from "../../lib/documents/pdfExport.js";

function artifact(content) {
  return {
    title: "Case summary",
    type: "CASE_SUMMARY",
    content,
    approvedAt: "2026-07-17T00:00:00.000Z"
  };
}

test("artifact PDF export keeps the Latin-basic path available", () => {
  const input = { artifact: artifact("Latin basic text"), sources: [] };

  assert.equal(canCreateArtifactPdf(input), true);
  assert.match(createArtifactPdfBuffer(input).subarray(0, 8).toString("ascii"), /^%PDF-1\.4/);
});

test("artifact PDF export fails closed for unsupported characters", () => {
  const input = { artifact: artifact("Привет"), sources: [] };

  assert.equal(canCreateArtifactPdf(input), false);
  assert.throws(() => createArtifactPdfBuffer(input), { code: "PDF_UNSUPPORTED_TEXT" });
});

test("artifact download route returns the localized 409 before generating an unsupported PDF", async () => {
  const source = await readFile(new URL("../../app/api/documents/artifacts/[id]/download/route.js", import.meta.url), "utf8");

  assert.match(source, /format === "pdf" && !canCreateArtifactPdf\(\{ artifact, sources \}\)/);
  assert.match(source, /errorJson\("api\.exports\.pdf_content_not_supported", 409, locale\)/);
});
