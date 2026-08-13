import { PDFParse } from "pdf-parse"

import { readBoundedDocxZipEntries } from "@/lib/documents/docxExport"

const PDF_MIME = "application/pdf"
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
const TEXT_MIME = "text/plain"
const MAX_PDF_PAGES = 500
const PDF_PARSE_TIMEOUT_MS = 8_000

function validationError(message, status = 415) {
  const error = new Error(message)
  error.status = status
  return error
}

function isComplexityError(error) {
  return /too many|too large|compression ratio|maxOutputLength|page limit|timeout/iu.test(String(error?.message || ""))
}

function validateText(buffer) {
  let text
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer)
  } catch {
    throw validationError("documents.errors.file_structure_invalid")
  }
  for (const character of text) {
    const code = character.codePointAt(0)
    if ((code < 32 && code !== 9 && code !== 10 && code !== 13) || (code >= 127 && code <= 159)) {
      throw validationError("documents.errors.file_structure_invalid")
    }
  }
}

function validateDocx(buffer) {
  let entries
  try {
    entries = readBoundedDocxZipEntries(buffer)
  } catch (error) {
    throw validationError(isComplexityError(error)
      ? "documents.errors.file_too_complex"
      : "documents.errors.file_structure_invalid")
  }
  const byName = new Map(entries.map((entry) => [entry.name, entry.data]))
  const contentTypes = byName.get("[Content_Types].xml")?.toString("utf8") || ""
  const rootRelationships = byName.get("_rels/.rels")?.toString("utf8") || ""
  const documentXml = byName.get("word/document.xml")?.toString("utf8") || ""
  if (
    !contentTypes.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml") ||
    !/Type=["']http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships\/officeDocument["']/u.test(rootRelationships) ||
    !/Target=["']\/?word\/document\.xml["']/u.test(rootRelationships) ||
    !/<w:document\b/u.test(documentXml) ||
    !/<w:body\b/u.test(documentXml)
  ) {
    throw validationError("documents.errors.file_structure_invalid")
  }
  for (const entry of entries) {
    if (!entry.name.endsWith(".rels")) continue
    const relationships = entry.data.toString("utf8")
    if (/TargetMode=["']External["']/iu.test(relationships)) {
      throw validationError("documents.errors.file_structure_invalid")
    }
  }
}

async function validatePdf(buffer) {
  const text = buffer.toString("latin1")
  if (!/^%PDF-1\.[0-9]/u.test(text) || !/%%EOF\s*$/u.test(text)) {
    throw validationError("documents.errors.file_structure_invalid")
  }
  const xrefMatch = /startxref\s+(\d+)\s+%%EOF\s*$/u.exec(text)
  if (!xrefMatch || Number(xrefMatch[1]) >= buffer.length) {
    throw validationError("documents.errors.file_structure_invalid")
  }

  const parser = new PDFParse({
    data: new Uint8Array(buffer),
    stopAtErrors: true,
    isEvalSupported: false,
    maxImageSize: 20_000_000,
    useSystemFonts: false
  })
  let timer
  try {
    const info = await Promise.race([
      parser.getInfo(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("PDF parse timeout")), PDF_PARSE_TIMEOUT_MS)
      })
    ])
    if (!Number.isInteger(info?.total) || info.total < 1) {
      throw new Error("PDF has no pages")
    }
    if (info.total > MAX_PDF_PAGES) throw new Error("PDF page limit exceeded")
  } catch (error) {
    throw validationError(isComplexityError(error)
      ? "documents.errors.file_too_complex"
      : "documents.errors.file_structure_invalid")
  } finally {
    clearTimeout(timer)
    await parser.destroy().catch(() => {})
  }
}

export async function validateMaterialBuffer(bufferLike, mime) {
  const buffer = Buffer.isBuffer(bufferLike) ? bufferLike : Buffer.from(bufferLike || [])
  if (!buffer.length) throw validationError("documents.errors.file_empty", 400)
  if (mime === TEXT_MIME) return validateText(buffer)
  if (mime === DOCX_MIME) return validateDocx(buffer)
  if (mime === PDF_MIME) return validatePdf(buffer)
  throw validationError("documents.errors.mime_not_allowed")
}
