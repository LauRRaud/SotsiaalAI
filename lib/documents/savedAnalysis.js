import { prisma } from "@/lib/prisma"
import { MAX_ARTIFACT_SOURCE_DOCUMENTS } from "@/lib/documents/constants"
import { logDocumentsAudit } from "@/lib/documents/audit"
import { getUtf8ByteLength } from "@/lib/storageGuardrails"
import { withStorageQuota } from "@/lib/documents/storageQuota"

// E2 — a document analysis (an AI explanation) becomes a findable, owner-private object.
// It is persisted ONLY on the user's explicit Save; an unsaved analysis stays transient.
// Every analysis carries a permanent "AI explanation, not an official decision" marker so
// the object can never be mistaken for a formal decision. Foreign/missing ids are owner-404
// (handled by the routes) — this module only ever reads/writes the owner's own rows.

export const ANALYSIS_DISCLAIMER = "ai_explanation_not_official_decision"

const MAX_TITLE_LENGTH = 200
const MAX_CONTENT_BYTES = 200_000

function analysisError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

export function normalizeAnalysisTitle(value) {
  const title = String(value ?? "").trim()
  return title ? title.slice(0, MAX_TITLE_LENGTH) : null
}

export function normalizeAnalysisContent(value) {
  const content = String(value ?? "").trim()
  if (!content) throw analysisError(400, "documents.analyses.errors.content_required")
  if (getUtf8ByteLength(content) > MAX_CONTENT_BYTES) {
    throw analysisError(413, "documents.analyses.errors.content_too_large")
  }
  return content
}

// Client-supplied ids -> a de-duplicated, capped list of non-empty strings. Ownership is
// verified separately against the DB before anything is stored.
export function normalizeAnalysisSourceIds(value) {
  const raw = Array.isArray(value) ? value : []
  const seen = new Set()
  const ids = []
  for (const entry of raw) {
    const id = String(entry ?? "").trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
    if (ids.length >= MAX_ARTIFACT_SOURCE_DOCUMENTS) break
  }
  return ids
}

export function serializeSavedAnalysis(row, { includeContent = false } = {}) {
  if (!row) return null
  const sourceDocumentIds = Array.isArray(row.sourceDocumentIds) ? row.sourceDocumentIds : []
  return {
    id: row.id,
    title: row.title ?? null,
    sourceDocumentIds,
    // The marker is always present on read — the UI must show it on every analysis.
    disclaimer: ANALYSIS_DISCLAIMER,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...(includeContent ? { content: row.content } : {})
  }
}

/**
 * Persist a SavedAnalysis for the owner (explicit Save only).
 * Validates every source document id belongs to the owner (a foreign/missing id yields
 * 404 sources_not_found — no existence oracle), enforces the storage quota, and stamps the
 * disclaimer marker. Returns the serialized analysis (without content).
 */
export async function createSavedAnalysis({ userId, role, title, content, sourceDocumentIds }) {
  const normalizedContent = normalizeAnalysisContent(content)
  const normalizedTitle = normalizeAnalysisTitle(title)
  const requestedIds = normalizeAnalysisSourceIds(sourceDocumentIds)

  if (requestedIds.length > 0) {
    const owned = await prisma.userDocument.findMany({
      where: { ownerId: userId, id: { in: requestedIds } },
      select: { id: true }
    })
    if (owned.length !== requestedIds.length) {
      throw analysisError(404, "documents.analyses.errors.sources_not_found")
    }
  }

  // SOL-DOC-07/-08: analüüsi maht kuulub kanoonilisse summasse ja kontroll käib sama
  // kasutajapõhise luku all nagu iga teine isiklik objekt.
  const analysis = await withStorageQuota(
    { userId, role, addBytes: getUtf8ByteLength(normalizedContent) },
    {},
    (tx) =>
      tx.savedAnalysis.create({
        data: {
          ownerId: userId,
          title: normalizedTitle,
          content: normalizedContent,
          sourceDocumentIds: requestedIds,
          metadata: { disclaimer: ANALYSIS_DISCLAIMER }
        }
      })
  )

  await logDocumentsAudit("analysis.saved", {
    userId,
    analysisId: analysis.id,
    title: analysis.title,
    sourceCount: requestedIds.length
  })

  return serializeSavedAnalysis(analysis)
}

export async function listSavedAnalysesForOwner({ userId, limit, offset }) {
  const [total, rows] = await prisma.$transaction([
    prisma.savedAnalysis.count({ where: { ownerId: userId } }),
    prisma.savedAnalysis.findMany({
      where: { ownerId: userId },
      orderBy: { updatedAt: "desc" },
      skip: offset,
      take: limit
    })
  ])
  return { total, analyses: rows.map((row) => serializeSavedAnalysis(row)) }
}

// Owner-scoped read: returns null for a foreign or missing id so the route can answer
// with the same 404 shape either way (no existence/permission oracle).
export async function getSavedAnalysisForOwner({ userId, id, includeContent = false }) {
  const row = await prisma.savedAnalysis.findFirst({ where: { id, ownerId: userId } })
  return serializeSavedAnalysis(row, { includeContent })
}

export async function deleteSavedAnalysisForOwner({ userId, id }) {
  const result = await prisma.savedAnalysis.deleteMany({ where: { id, ownerId: userId } })
  if (result.count > 0) {
    await logDocumentsAudit("analysis.deleted", { userId, analysisId: id })
  }
  return result.count > 0
}
