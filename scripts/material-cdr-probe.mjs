#!/usr/bin/env node
import assert from "node:assert/strict"

import { createSimpleDocxBuffer } from "../lib/documents/docxExport.js"
import { createLocalMaterialCdr } from "../lib/materials/cdr.js"
import { createMaterialSanitizer, MATERIAL_SANITIZATION_VERSION } from "../lib/materials/sanitization.js"

const PDF_MIME = "application/pdf"
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
const HIDDEN_MARKER = "HIDDEN ACTIVE PAYLOAD 99173"

function expect(label, condition) {
  assert.ok(condition, label)
  console.log(`PASS ${label}`)
}

function normalized(buffer) {
  return buffer.toString("utf8").replace(/\s+/gu, " ").trim().toUpperCase()
}

function createProbePdf(visibleText, hiddenMarker) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(`BT\n/F1 20 Tf\n72 700 Td\n(${visibleText}) Tj\nET\n`, "ascii")} >>\nstream\nBT\n/F1 20 Tf\n72 700 Td\n(${visibleText}) Tj\nET\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ]
  const chunks = [Buffer.from("%PDF-1.4\n", "ascii")]
  const offsets = [0]
  let size = chunks[0].length
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(size)
    const chunk = Buffer.from(`${index + 1} 0 obj\n${objects[index]}\nendobj\n`, "ascii")
    chunks.push(chunk)
    size += chunk.length
  }
  const xrefOffset = size
  const xref = ["xref", `0 ${objects.length + 1}`, "0000000000 65535 f "]
  for (const offset of offsets.slice(1)) xref.push(`${String(offset).padStart(10, "0")} 00000 n `)
  chunks.push(Buffer.from(
    `${xref.join("\n")}\n% ${hiddenMarker}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
    "ascii"
  ))
  return Buffer.concat(chunks)
}

const sanitizer = createMaterialSanitizer({ cdr: createLocalMaterialCdr() })

const pdfWithNonRenderedPayload = createProbePdf("SOTSIAALAI CDR PDF PROBE 84271", HIDDEN_MARKER)
const pdfResult = await sanitizer.sanitize({
  buffer: pdfWithNonRenderedPayload,
  mime: PDF_MIME,
  originalName: "synthetic-probe.pdf"
})
const pdfText = normalized(pdfResult.buffer)
expect("PDF survives local Dangerzone CDR as readable text", pdfText.includes("84271"))
expect("non-rendered PDF payload does not survive CDR", !pdfText.includes("99173"))
expect("PDF derivative is not a PDF or original byte copy", !pdfResult.buffer.subarray(0, 4).equals(Buffer.from("%PDF")))

const docx = createSimpleDocxBuffer({
  title: HIDDEN_MARKER,
  blocks: [{ kind: "paragraph", text: "SOTSIAALAI CDR DOCX PROBE 57318" }]
})
const docxResult = await sanitizer.sanitize({
  buffer: docx,
  mime: DOCX_MIME,
  originalName: "synthetic-probe.docx"
})
const docxText = normalized(docxResult.buffer)
expect("DOCX survives local Dangerzone CDR as readable text", docxText.includes("57318"))
expect("DOCX package metadata does not survive CDR", !docxText.includes("99173"))
expect("DOCX derivative is not a ZIP or original byte copy", !docxResult.buffer.subarray(0, 2).equals(Buffer.from("PK")))

expect("both outputs use the pinned sanitization version",
  pdfResult.version === MATERIAL_SANITIZATION_VERSION && docxResult.version === MATERIAL_SANITIZATION_VERSION)

console.log(`CDR_PROBE_OK engine=dangerzone version=${MATERIAL_SANITIZATION_VERSION} cases=2 checks=7`)
