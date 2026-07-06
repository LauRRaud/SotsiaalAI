import {
  AGENT_ARTIFACT_TYPE_VALUES,
  ARTIFACT_DOWNLOAD_FORMATS,
  DOCX_MIME_TYPE,
  PDF_MIME_TYPE,
  MAX_ARTIFACT_CONTENT_LENGTH,
  MAX_ARTIFACT_SOURCE_DOCUMENTS
} from "@/lib/documents/constants"
import { makeSnippet, sanitizeTextFilename } from "@/lib/documents/server"

export function createArtifactError(message, status = 400) {
  const error = new Error(message)
  error.status = status
  return error
}

export function normalizeArtifactType(value) {
  const normalized = String(value || "").trim().toUpperCase()
  return AGENT_ARTIFACT_TYPE_VALUES.includes(normalized) ? normalized : "REPORT_DRAFT"
}

export function normalizeArtifactTitle(value) {
  const sanitized = sanitizeTextFilename(value, "")
  return sanitized || null
}

export function normalizeArtifactContent(value) {
  const normalized = String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  if (!normalized) {
    throw createArtifactError("documents.artifacts.errors.content_required", 400)
  }

  if (normalized.length > MAX_ARTIFACT_CONTENT_LENGTH) {
    throw createArtifactError("documents.artifacts.errors.content_too_large", 413)
  }

  return normalized
}

export function getMaxArtifactSourceDocumentsForRole(role) {
  const normalized = String(role || "").trim().toUpperCase()
  return normalized === "CLIENT" ? 2 : MAX_ARTIFACT_SOURCE_DOCUMENTS
}

export function normalizeSelectedDocumentIds(values, options = {}) {
  const maxDocuments = Number.isFinite(Number(options?.maxDocuments))
    ? Math.max(1, Math.min(Math.floor(Number(options.maxDocuments)), MAX_ARTIFACT_SOURCE_DOCUMENTS))
    : MAX_ARTIFACT_SOURCE_DOCUMENTS
  const unique = []
  const seen = new Set()

  for (const value of Array.isArray(values) ? values : []) {
    const id = String(value || "").trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    unique.push(id)
  }

  if (!unique.length) {
    throw createArtifactError("documents.artifacts.errors.sources_required", 400)
  }

  if (unique.length > maxDocuments) {
    throw createArtifactError("documents.artifacts.errors.too_many_sources", 400)
  }

  return unique
}

export function assertDraftArtifactEditable(artifact) {
  if (String(artifact?.status || "") === "FINAL") {
    throw createArtifactError("documents.artifacts.errors.final_read_only", 409)
  }
}

export function buildArtifactDownloadUrl(id, format = "docx") {
  return `/api/documents/artifacts/${encodeURIComponent(id)}/download?format=${encodeURIComponent(format)}`
}

export function buildArtifactFileName(artifact, extension = "docx") {
  const baseTitle =
    normalizeArtifactTitle(artifact?.title) ||
    sanitizeTextFilename(String(artifact?.type || "artifact").toLowerCase().replace(/_/g, "-"), "artifact")
  return `${baseTitle}.${extension}`
}

function getArtifactDownloadDescriptors(artifact) {
  if (String(artifact?.status || "") !== "FINAL") return null
  return [
    {
      format: "docx",
      mime: DOCX_MIME_TYPE,
      url: buildArtifactDownloadUrl(artifact.id, "docx"),
      fileName: buildArtifactFileName(artifact, "docx")
    },
    {
      format: "pdf",
      mime: PDF_MIME_TYPE,
      url: buildArtifactDownloadUrl(artifact.id, "pdf"),
      fileName: buildArtifactFileName(artifact, "pdf")
    }
  ]
}

export function serializeArtifactSource(link) {
  const document = link?.document
  if (!document) return null
  return {
    id: document.id,
    title: document.title,
    originalName: document.originalName,
    kind: document.kind,
    templateFor: document.templateFor
  }
}

export function serializeArtifact(artifact, options = {}) {
  const includeContent = options.includeContent !== false
  const downloads = getArtifactDownloadDescriptors(artifact)
  const primaryDownload = downloads?.find((entry) => entry.format === "docx") || downloads?.[0] || null
  const sources = Array.isArray(artifact?.sourceDocuments)
    ? artifact.sourceDocuments.map(serializeArtifactSource).filter(Boolean)
    : []

  return {
    id: artifact.id,
    type: artifact.type,
    title: artifact.title,
    status: artifact.status,
    approvedAt: artifact.approvedAt,
    templateId: artifact.templateId || null,
    template: artifact.template
      ? {
          id: artifact.template.id,
          title: artifact.template.title,
          originalName: artifact.template.originalName
        }
      : null,
    content: includeContent ? artifact.content : undefined,
    metadata: artifact.metadata || null,
    sourceTranscriptDocumentId: artifact.metadata?.sourceTranscriptDocumentId || null,
    sourceAudioDocumentId: artifact.metadata?.sourceAudioDocumentId || null,
    snippet: makeSnippet(artifact.content),
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt,
    sourceCount: sources.length,
    sources,
    canDownload: Boolean(downloads?.length),
    downloadFormats: downloads ? ARTIFACT_DOWNLOAD_FORMATS : [],
    downloadUrl: primaryDownload?.url || null,
    downloadUrls: downloads
      ? Object.fromEntries(downloads.map((entry) => [entry.format, entry.url]))
      : {}
  }
}
