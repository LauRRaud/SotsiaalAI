import crypto from "node:crypto"

import { templateShapesFile } from "@/lib/documents/artifactFiles"
import { createArtifactError } from "@/lib/documents/artifacts"
import { approveArtifact } from "@/lib/documents/artifactMutation"
import { createArtifactDocxBuffer } from "@/lib/documents/docxExport"
import { artifactExportLabels } from "@/lib/documents/exportLabels"
import { artifactPdfLabels, canCreateArtifactPdf, createArtifactPdfBuffer } from "@/lib/documents/pdfExport"
import { readArtifactGenerationProvenance } from "@/lib/documents/artifactProvenance"
import { prisma } from "@/lib/prisma"
import { readStoredDocument } from "@/lib/documents/server"

const FINAL_MANIFEST_VERSION = 1

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

function iso(value) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const finalizationInclude = {
  template: {
    select: {
      id: true,
      title: true,
      originalName: true,
      mime: true,
      sha256: true,
      storagePath: true,
      updatedAt: true
    }
  },
  sourceDocuments: {
    include: {
      document: {
        select: {
          id: true,
          title: true,
          originalName: true,
          /* Liik ja malli otstarve lähevad vastusega lehele: ilma nendeta näitas
             allikate rida kohe pärast kinnitamist faili liigi asemel sõna „Muu”. */
          kind: true,
          templateFor: true,
          sha256: true,
          updatedAt: true
        }
      }
    },
    orderBy: { createdAt: "asc" }
  },
  finalSnapshot: true
}

function sourceManifest(source) {
  return {
    id: source.id,
    title: source.title,
    originalName: source.originalName,
    sha256: source.sha256,
    revision: iso(source.updatedAt)
  }
}

function templateManifest(template) {
  if (!template) return null
  return {
    id: template.id,
    title: template.title,
    originalName: template.originalName,
    sha256: template.sha256,
    revision: iso(template.updatedAt)
  }
}

function buildManifest(artifact, sources, rendered, labelLocale) {
  const generation = readArtifactGenerationProvenance(artifact.metadata)
  return {
    version: FINAL_MANIFEST_VERSION,
    artifactId: artifact.id,
    approvedAt: iso(artifact.approvedAt),
    /* Mis keeles on failide sildid: kinnitaja lehe keel kinnitamise hetkel. */
    labelLocale,
    contentSha256: sha256(Buffer.from(artifact.content, "utf8")),
    model: generation.model || null,
    promptVersion: generation.promptVersion || null,
    retrievalMode: generation.retrievalMode || null,
    evidenceChunks: Array.isArray(generation.evidenceChunks) ? generation.evidenceChunks : [],
    sources: sources.map(sourceManifest),
    template: templateManifest(artifact.template),
    templateSha256: artifact.template?.sha256 || null,
    rendered
  }
}

/**
 * Kinnitab mustandi ja teeb sellest failid, mis jäävad selliseks, nagu need
 * kinnitamise hetkel tehti. `locale`: kinnitaja lehe keel; failide sildid ja
 * teksti liigi nimi on selles keeles (vt ./exportLabels.js).
 */
export async function finalizeArtifact(
  { artifactId, ownerId, expectedUpdatedAt = null, title, content, locale, maxSnapshotBytes = Number.POSITIVE_INFINITY },
  { db = prisma, now = new Date() } = {}
) {
  const approved = await approveArtifact(
    { artifactId, ownerId, expectedUpdatedAt, title, content },
    { db, now }
  )
  let artifact = await db.agentArtifact.findFirst({
    where: { id: artifactId, ownerId },
    include: finalizationInclude
  })
  if (!artifact) throw createArtifactError("documents.artifacts.errors.not_found", 404)
  if (artifact.finalSnapshot) return { artifact, alreadyFinal: approved.alreadyFinal }

  const sources = artifact.sourceDocuments.map((link) => link.document).filter(Boolean)
  /* Kuju annab ainult Wordi mall. PDF- ja TXT-malli ei loeta: varem prooviti
     seda Wordi failina avada, see ebaõnnestus ja serveri logisse läks iga
     kinnitamise kohta viga, enne kui tehti tavaline fail. */
  const templateBuffer = artifact.template?.storagePath && templateShapesFile(artifact.template)
    ? await readStoredDocument(artifact.template.storagePath)
    : null
  const labels = artifactExportLabels(locale)
  const pdfLabels = artifactPdfLabels(locale, artifact.type)
  const docxBytes = createArtifactDocxBuffer({ artifact, sources, templateBuffer, labels })
  const pdfBytes = canCreateArtifactPdf({ artifact, sources, labels: pdfLabels })
    ? createArtifactPdfBuffer({ artifact, sources, labels: pdfLabels })
    : null
  const totalBytes = docxBytes.length + (pdfBytes?.length || 0)
  if (totalBytes > maxSnapshotBytes) {
    const error = createArtifactError("documents.errors.storage_quota_exceeded", 413)
    error.quota = { scope: "storage_quota" }
    throw error
  }

  const rendered = {
    docx: { sha256: sha256(docxBytes), size: docxBytes.length },
    pdf: pdfBytes ? { sha256: sha256(pdfBytes), size: pdfBytes.length } : null
  }
  await db.agentArtifactFinalSnapshot.create({
    data: {
      artifactId,
      manifest: buildManifest(artifact, sources, rendered, labels.locale),
      docxBytes,
      docxSha256: rendered.docx.sha256,
      docxSize: rendered.docx.size,
      pdfBytes,
      pdfSha256: rendered.pdf?.sha256 || null,
      pdfSize: rendered.pdf?.size || 0,
      totalBytes
    }
  })
  artifact = await db.agentArtifact.findFirst({
    where: { id: artifactId, ownerId },
    include: finalizationInclude
  })
  return { artifact, alreadyFinal: approved.alreadyFinal }
}

export async function readFinalArtifactDownload(
  { artifactId, ownerId, format },
  { db = prisma } = {}
) {
  const artifact = await db.agentArtifact.findFirst({
    where: { id: artifactId, ownerId },
    include: { finalSnapshot: true }
  })
  if (!artifact) throw createArtifactError("documents.artifacts.errors.not_found", 404)
  if (artifact.status !== "FINAL" || !artifact.approvedAt || !artifact.finalSnapshot) {
    throw createArtifactError("documents.artifacts.errors.download_requires_approval", 409)
  }
  const snapshot = artifact.finalSnapshot
  const bytes = format === "pdf" ? snapshot.pdfBytes : snapshot.docxBytes
  if (!bytes) throw createArtifactError("api.exports.pdf_content_not_supported", 409)
  const buffer = Buffer.from(bytes)
  const expectedSha256 = format === "pdf" ? snapshot.pdfSha256 : snapshot.docxSha256
  if (!expectedSha256 || sha256(buffer) !== expectedSha256) {
    throw createArtifactError("documents.artifacts.errors.download_failed", 500)
  }
  return {
    artifact,
    bytes: buffer,
    sha256: expectedSha256,
    manifest: snapshot.manifest
  }
}
