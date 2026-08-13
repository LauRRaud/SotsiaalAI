import prisma from "@/lib/prisma"
import { writeDataAudit } from "@/lib/privacy/audit"
import { materialRetentionPolicyFromEnvironment, retentionFieldsForSubmission } from "./retentionPolicy.js"
import { buildMaterialReviewUpdate, serializeMaterialSubmission } from "./submissions.js"

const REVIEW_TRANSITIONS = Object.freeze({
  pending: new Set(["reviewed", "rejected"]),
  reviewed: new Set(["pending", "rejected", "imported"]),
  rejected: new Set(["pending", "reviewed"]),
  imported: new Set()
})

function reviewError(message, status, current = null) {
  const error = new Error(message)
  error.status = status
  if (current) error.current = current
  return error
}

export function normalizeExpectedMaterialRevision(value) {
  if (value == null || value === "") throw reviewError("materials_page.errors.review_revision_required", 400)
  const revision = Number(value)
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw reviewError("materials_page.errors.review_revision_required", 400)
  }
  return revision
}

export function assertMaterialReviewTransition(previousStatus, nextStatus) {
  const previous = String(previousStatus || "").trim().toLowerCase()
  const next = String(nextStatus || "").trim().toLowerCase()
  if (!REVIEW_TRANSITIONS[previous]?.has(next)) {
    throw reviewError("materials_page.errors.review_transition_invalid", 409)
  }
}

function includeSubmitter() {
  return { submittedByUser: { select: { id: true, email: true } } }
}

export async function reviewMaterialSubmission(
  { id, action, status, expectedRevision, reviewedBy, reviewNote, actorUserId = null } = {},
  { db = prisma, audit = writeDataAudit, now = new Date() } = {}
) {
  const submissionId = String(id || "").trim()
  if (!submissionId) throw reviewError("api.common.not_found", 404)
  const revision = normalizeExpectedMaterialRevision(expectedRevision)
  const update = buildMaterialReviewUpdate({ action, status, reviewedBy, reviewNote, now })
  const retention = retentionFieldsForSubmission(update.status, now, materialRetentionPolicyFromEnvironment())
  if (update.status === "imported") {
    throw reviewError("materials_page.errors.rag_ingest_decision_required", 409)
  }

  return db.$transaction(async (tx) => {
    const current = await tx.materialSubmission.findUnique({
      where: { id: submissionId }, include: includeSubmitter()
    })
    if (!current) throw reviewError("api.common.not_found", 404)
    if (current.scanState !== "CLEAN" || current.validationState !== "VALIDATED" || current.storageStatus !== "ACTIVE") {
      throw reviewError("materials_page.errors.security_gate_failed", 409)
    }
    if (current.reviewRevision !== revision) {
      throw reviewError("materials_page.errors.review_conflict", 409, serializeMaterialSubmission(current))
    }
    assertMaterialReviewTransition(current.status, update.status)
    const changed = await tx.materialSubmission.updateMany({
      where: { id: submissionId, status: current.status, reviewRevision: revision },
      data: { ...update, ...retention, reviewRevision: { increment: 1 } }
    })
    if (changed.count !== 1) {
      const fresh = await tx.materialSubmission.findUnique({ where: { id: submissionId }, include: includeSubmitter() })
      throw reviewError("materials_page.errors.review_conflict", 409, serializeMaterialSubmission(fresh))
    }
    await audit({
      db: tx,
      actorUserId,
      targetUserId: current.submittedByUserId,
      action: `MATERIAL_REVIEW_${update.status.toUpperCase()}`,
      resourceType: "MaterialSubmission",
      resourceId: submissionId,
      meta: {
        previousStatus: current.status,
        nextStatus: update.status,
        previousRevision: revision,
        nextRevision: revision + 1,
        reviewNote: update.reviewNote
      }
    })
    const saved = await tx.materialSubmission.findUnique({ where: { id: submissionId }, include: includeSubmitter() })
    return serializeMaterialSubmission(saved)
  })
}

export async function auditMaterialDownload(
  submission,
  { actorUserId = null, admin = false, ipAddress = null, userAgent = null } = {},
  { db = prisma, audit = writeDataAudit } = {}
) {
  return audit({
    db,
    actorUserId,
    targetUserId: submission?.submittedByUserId || null,
    action: admin ? "FILE_DOWNLOAD_ADMIN" : "FILE_DOWNLOAD_OWNER",
    resourceType: "MaterialSubmission",
    resourceId: submission?.id || null,
    ipAddress,
    userAgent,
    meta: { mime: submission?.mime, size: submission?.size }
  })
}
