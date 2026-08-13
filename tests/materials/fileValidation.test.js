import test from "node:test"
import assert from "node:assert/strict"

import { createSimpleDocxBuffer } from "../../lib/documents/docxExport.js"
import { validateMaterialBuffer } from "../../lib/materials/validation.js"

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

function minimalPdf() {
  const parts = ["%PDF-1.4\n"]
  const offsets = [0]
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> /Contents 4 0 R >>\nendobj\n",
    "4 0 obj\n<< /Length 0 >>\nstream\n\nendstream\nendobj\n"
  ]
  for (const object of objects) {
    offsets.push(Buffer.byteLength(parts.join(""), "latin1"))
    parts.push(object)
  }
  const xref = Buffer.byteLength(parts.join(""), "latin1")
  parts.push("xref\n0 5\n0000000000 65535 f \n")
  for (const offset of offsets.slice(1)) parts.push(`${String(offset).padStart(10, "0")} 00000 n \n`)
  parts.push(`trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  return Buffer.from(parts.join(""), "latin1")
}

async function rejects(buffer, mime) {
  await assert.rejects(validateMaterialBuffer(buffer, mime), /documents\.errors\.(file_empty|file_structure_invalid|file_too_complex)/)
}

test("material validation rejects empty payloads for every supported type", async () => {
  await rejects(Buffer.alloc(0), "text/plain")
  await rejects(Buffer.alloc(0), "application/pdf")
  await rejects(Buffer.alloc(0), DOCX)
})

test("material TXT validation checks the entire UTF-8 file", async () => {
  await validateMaterialBuffer(Buffer.from("Tavaline UTF-8 tekst õäöü"), "text/plain")
  await rejects(Buffer.concat([Buffer.alloc(5000, 0x61), Buffer.from([0])]), "text/plain")
  await rejects(Buffer.from([0xc3, 0x28]), "text/plain")
})

test("material DOCX validation requires a bounded complete OOXML package", async () => {
  const valid = createSimpleDocxBuffer({ title: "Test", blocks: [{ type: "paragraph", text: "Tere" }] })
  await validateMaterialBuffer(valid, DOCX)
  await rejects(Buffer.from([0x50, 0x4b, 0x03, 0x04]), DOCX)

  const missingParts = Buffer.from(valid)
  const documentName = Buffer.from("word/document.xml")
  for (let index = missingParts.indexOf(documentName); index >= 0; index = missingParts.indexOf(documentName, index + 1)) {
    missingParts[index] = 0x78
  }
  await rejects(missingParts, DOCX)

  const bomb = Buffer.from(valid)
  for (let offset = 0; offset <= bomb.length - 46; offset += 1) {
    if (bomb.readUInt32LE(offset) === 0x02014b50) bomb.writeUInt32LE(0x7fffffff, offset + 24)
  }
  await rejects(bomb, DOCX)
})

test("material PDF validation rejects header-only and structurally incomplete files", async () => {
  await validateMaterialBuffer(minimalPdf(), "application/pdf")
  await rejects(Buffer.from("%PDF-not-a-real-pdf"), "application/pdf")
  await rejects(Buffer.from("%PDF-1.7\n%%EOF\n"), "application/pdf")
  await rejects(Buffer.concat([minimalPdf(), Buffer.from("<script>polyglot</script>")]), "application/pdf")
})
