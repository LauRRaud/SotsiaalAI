import { createPdfBufferFromText, isPdfTextSupported } from "../chat/exportDocument.js"
import { artifactExportLabels, exportLabelTexts } from "./exportLabels.js"

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/* PDF joonistab ainult ladina tähti (WinAnsi, vt ../chat/exportDocument.js). */
const PDF_FALLBACK_LOCALE = "et"

/**
 * PDF-i sildid ja liigi nimi kinnitaja lehe keeles, samast kohast kust Wordi
 * faili omad (./exportLabels.js). Kui selle keele sõnu PDF joonistada ei saa
 * (vene keel), kannab PDF eestikeelseid silte: nii saab ladina tähtedega
 * tekstist PDF-i ikka teha, nagu enne. Wordi fail kannab alati kinnitaja keelt.
 */
export function artifactPdfLabels(locale, type) {
  const labels = artifactExportLabels(locale)
  return isPdfTextSupported(exportLabelTexts(labels, type).join("\n")) ? labels : artifactExportLabels(PDF_FALLBACK_LOCALE)
}

function formatApprovedDate(value) {
  if (!value) return ""
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString().slice(0, 10)
}

function buildSourcesSection(sources = [], labels) {
  if (!Array.isArray(sources) || !sources.length) {
    return `${labels.sources}:\n- ${labels.noSources}`
  }

  return [
    `${labels.sources}:`,
    ...sources.map((source) => {
      const title = source?.title || source?.originalName || labels.untitledSource
      const originalName = source?.originalName && source.originalName !== title ? ` (${source.originalName})` : ""
      return `- ${title}${originalName}`
    })
  ].join("\n")
}

/** Pealkirjata tekst kannab oma liigi nime, mitte sisemist koodi. */
function artifactPdfTitle(artifact, labels) {
  return artifact?.title?.trim() || labels.typeName(artifact?.type)
}

function buildArtifactPdfText({ artifact, sources = [], labels }) {
  const lines = [
    artifactPdfTitle(artifact, labels),
    "",
    `${labels.type}: ${labels.typeName(artifact?.type)}`,
    artifact?.approvedAt ? `${labels.approved}: ${formatApprovedDate(artifact.approvedAt)}` : null,
    "",
    `${labels.content}:`,
    normalizeText(artifact?.content) || labels.emptyContent,
    "",
    buildSourcesSection(sources, labels)
  ].filter(Boolean)

  return lines.join("\n")
}

/**
 * Kas tekstist saab PDF-i teha: kõik märgid (pealkiri, sisu, allikate nimed ja
 * sildid) peavad olema PDF-i kirjatüübis olemas. `labels`: vt `artifactPdfLabels`.
 */
export function canCreateArtifactPdf({ artifact, sources = [], labels = artifactPdfLabels(undefined, artifact?.type) }) {
  return isPdfTextSupported(buildArtifactPdfText({ artifact, sources, labels }))
}

export function createArtifactPdfBuffer({ artifact, sources = [], labels = artifactPdfLabels(undefined, artifact?.type) }) {
  return createPdfBufferFromText(buildArtifactPdfText({ artifact, sources, labels }), artifactPdfTitle(artifact, labels))
}
