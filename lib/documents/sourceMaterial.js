import { createArtifactError } from "@/lib/documents/artifacts"
import { readStoredDocument } from "@/lib/documents/server"
import { buildRagHeaders, ragServiceRequest } from "@/lib/documents/ragService"
import { redactPersonalData } from "@/lib/privacy/piiFilter"

function readPositiveInteger(value, fallback) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback
  return Math.max(1, Math.trunc(numeric))
}

const AGENT_SOURCE_DOC_MAX_CHARS = readPositiveInteger(process.env.AGENT_SOURCE_DOC_MAX_CHARS, 12_000)
const AGENT_SOURCE_FALLBACK_MAX_CHARS = readPositiveInteger(process.env.AGENT_SOURCE_FALLBACK_MAX_CHARS, 4_000)
const AGENT_ANALYZE_MAX_CHUNKS = readPositiveInteger(process.env.AGENT_ANALYZE_MAX_CHUNKS, 18)

export function normalizeText(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function compactText(value, maxChars) {
  const text = normalizeText(value)
  if (!text) return ""
  if (text.length <= maxChars) return text

  const budget = Math.max(400, maxChars)
  const headLength = Math.max(200, Math.floor(budget * 0.72))
  const tailLength = Math.max(120, budget - headLength - 16)
  const head = text.slice(0, headLength).trim()
  const tail = text.slice(-tailLength).trim()
  return `${head}\n\n[...]\n\n${tail}`
}

function redactDocumentSourceText(value) {
  return redactPersonalData(value).redactedText
}

function excerptText(value, maxChars) {
  const text = normalizeText(value)
  if (!text) return ""
  if (text.length <= maxChars) return text

  const budget = Math.max(600, Number(maxChars) || AGENT_SOURCE_FALLBACK_MAX_CHARS)
  const separator = "\n\n[...]\n\n"
  const separatorChars = separator.length * 2
  const available = Math.max(300, budget - separatorChars)

  const headLength = Math.max(180, Math.floor(available * 0.38))
  const middleLength = Math.max(180, Math.floor(available * 0.37))
  const tailLength = Math.max(140, available - headLength - middleLength)

  const middleStart = Math.max(
    headLength,
    Math.floor((text.length - middleLength) / 2)
  )

  const head = text.slice(0, headLength).trim()
  const middle = text.slice(middleStart, middleStart + middleLength).trim()
  const tail = text.slice(-tailLength).trim()

  return [head, middle, tail].filter(Boolean).join(separator)
}

async function analyzeDocumentBuffer({ fileName, mime, buffer }) {
  const formData = new FormData()
  formData.append("file", new Blob([buffer], { type: mime }), fileName || "document")
  formData.append("mimeType", mime)
  formData.append("maxChunks", String(AGENT_ANALYZE_MAX_CHUNKS))

  const payload = await ragServiceRequest(
    "/analyze",
    {
      method: "POST",
      headers: buildRagHeaders(null),
      body: formData
    },
    "documents.artifacts.errors.analysis_failed"
  )

  const fullText = typeof payload?.fullText === "string" && payload.fullText.trim()
    ? payload.fullText
    : Array.isArray(payload?.chunks)
      ? payload.chunks.join("\n\n")
      : payload?.preview || ""

  return normalizeText(fullText)
}

export async function extractDocumentText(document) {
  if ((document.kind === "CALL_TRANSCRIPT" || document.kind === "AUDIO_TRANSCRIPT") && document.content) {
    const normalizedContent = normalizeText(redactDocumentSourceText(document.content))
    if (normalizedContent) return compactText(normalizedContent, AGENT_SOURCE_DOC_MAX_CHARS)
  }

  const buffer = await readStoredDocument(document.storagePath)
  let rawText = ""

  if (document.mime === "text/plain") {
    rawText = buffer.toString("utf8")
  } else {
    rawText = await analyzeDocumentBuffer({
      fileName: document.originalName,
      mime: document.mime,
      buffer
    })
  }

  const normalized = normalizeText(redactDocumentSourceText(rawText))
  if (!normalized) {
    throw createArtifactError("documents.artifacts.errors.analysis_failed", 502)
  }

  return compactText(normalized, AGENT_SOURCE_DOC_MAX_CHARS)
}

export async function collectFallbackSourceMaterial(documents) {
  const extractedDocuments = []
  const unavailableSources = []

  for (const document of documents) {
    try {
      const text = await extractDocumentText(document)
      extractedDocuments.push({
        id: document.id,
        title: document.title,
        originalName: document.originalName,
        kind: document.kind,
        text
      })
    } catch (error) {
      unavailableSources.push(document.title || document.originalName || document.id)
      console.error("[documents artifacts] fallback source extraction failed", {
        documentId: document.id,
        message: error?.message || "unknown"
      })
    }
  }

  if (!extractedDocuments.length) {
    throw createArtifactError("documents.artifacts.errors.analysis_failed", 502)
  }

  const sourceBlocks = []
  let usedChars = 0

  for (let index = 0; index < extractedDocuments.length; index += 1) {
    if (usedChars >= AGENT_SOURCE_FALLBACK_MAX_CHARS) break

    const document = extractedDocuments[index]
    const remainingDocs = extractedDocuments.length - index
    const remainingChars = AGENT_SOURCE_FALLBACK_MAX_CHARS - usedChars
    const perDocumentBudget = Math.max(
      500,
      Math.floor(remainingChars / Math.max(1, remainingDocs))
    )

    const excerpt = excerptText(document.text, perDocumentBudget)
    if (!excerpt) continue

    const block = [
      `Document: ${document.title || document.originalName}`,
      `Original file: ${document.originalName}`,
      `Kind: ${document.kind}`,
      "Excerpt:",
      excerpt
    ].join("\n")

    if (block.length > remainingChars) {
      const truncatedExcerptBudget = Math.max(300, remainingChars - (block.length - excerpt.length) - 16)
      const truncatedExcerpt = excerptText(document.text, truncatedExcerptBudget)
      if (!truncatedExcerpt) break
      const truncatedBlock = [
        `Document: ${document.title || document.originalName}`,
        `Original file: ${document.originalName}`,
        `Kind: ${document.kind}`,
        "Excerpt:",
        truncatedExcerpt
      ].join("\n")
      sourceBlocks.push(truncatedBlock)
      usedChars += truncatedBlock.length
      break
    }

    sourceBlocks.push(block)
    usedChars += block.length
  }

  return {
    sourceBlocks,
    unavailableSources
  }
}
