import { createPdfBufferFromText } from "../chat/exportDocument.js"

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function formatArtifactType(value) {
  return String(value || "")
    .trim()
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatApprovedDate(value) {
  if (!value) return ""
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString().slice(0, 10)
}

function buildSourcesSection(sources = []) {
  if (!Array.isArray(sources) || !sources.length) {
    return "Allikdokumendid:\n- Allikdokumendid puuduvad."
  }

  return [
    "Allikdokumendid:",
    ...sources.map((source) => {
      const title = source?.title || source?.originalName || "Dokument"
      const originalName = source?.originalName && source.originalName !== title ? ` (${source.originalName})` : ""
      return `- ${title}${originalName}`
    })
  ].join("\n")
}

function buildArtifactPdfText({ artifact, sources = [] }) {
  const title = artifact?.title?.trim() || formatArtifactType(artifact?.type) || "Artifact"
  const lines = [
    title,
    "",
    `Tüüp: ${formatArtifactType(artifact?.type) || "Artifact"}`,
    artifact?.approvedAt ? `Kinnitatud: ${formatApprovedDate(artifact.approvedAt)}` : null,
    "",
    "Sisu:",
    normalizeText(artifact?.content) || "(empty)",
    "",
    buildSourcesSection(sources)
  ].filter(Boolean)

  return lines.join("\n")
}

export function createArtifactPdfBuffer({ artifact, sources = [] }) {
  const title = artifact?.title?.trim() || formatArtifactType(artifact?.type) || "Artifact"
  return createPdfBufferFromText(buildArtifactPdfText({ artifact, sources }), title)
}
