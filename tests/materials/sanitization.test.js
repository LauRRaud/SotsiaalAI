import assert from "node:assert/strict"
import test from "node:test"

import {
  MATERIAL_SANITIZATION_VERSION,
  createMaterialSanitizer
} from "../../lib/materials/sanitization.js"

test("one-way text extraction normalizes controls and produces a versioned digest", async () => {
  const result = await createMaterialSanitizer().sanitize({
    buffer: Buffer.from("  Ohutu\r\ntekst\u202e  ", "utf8"),
    mime: "text/plain",
    originalName: "private.txt"
  })
  assert.equal(result.buffer.toString("utf8"), "Ohutu\ntekst\n")
  assert.match(result.sha256, /^[a-f0-9]{64}$/u)
  assert.equal(result.version, MATERIAL_SANITIZATION_VERSION)
})

for (const mime of [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]) {
  test(`${mime} fails closed when no local CDR adapter is configured`, async () => {
    await assert.rejects(
      createMaterialSanitizer().sanitize({ buffer: Buffer.from("synthetic"), mime, originalName: "synthetic" }),
      /material_cdr_unavailable/
    )
  })
}

test("a local CDR adapter output is revalidated as strict sanitized UTF-8", async () => {
  let calls = 0
  const sanitizer = createMaterialSanitizer({
    cdr: { async extractSanitizedText() { calls += 1; return Buffer.from("Extracted synthetic text") } }
  })
  const result = await sanitizer.sanitize({ buffer: Buffer.from("not parsed here"), mime: "application/pdf" })
  assert.equal(calls, 1)
  assert.equal(result.buffer.toString(), "Extracted synthetic text\n")
})
