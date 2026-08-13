const MATERIAL_SUBMISSION_STATUSES = Object.freeze(["pending", "reviewed", "rejected", "imported"])

const MATERIAL_STATUS_SET = new Set(MATERIAL_SUBMISSION_STATUSES)
const MATERIAL_ACTION_TO_STATUS = Object.freeze({
  mark_pending: "pending",
  mark_reviewed: "reviewed",
  reject: "rejected",
  mark_rejected: "rejected",
  mark_imported: "imported"
})

const MAX_REVIEW_NOTE_LENGTH = 2_000

export function normalizeMaterialSubmissionStatus(value, fallback = "pending") {
  const normalized = String(value || "").trim().toLowerCase()
  return MATERIAL_STATUS_SET.has(normalized) ? normalized : fallback
}

export function statusFromMaterialReviewAction(action, status) {
  const directStatus = normalizeMaterialSubmissionStatus(status, "")
  if (directStatus) return directStatus
  const normalizedAction = String(action || "").trim().toLowerCase()
  return MATERIAL_ACTION_TO_STATUS[normalizedAction] || ""
}

function normalizeMaterialReviewNote(value) {
  const normalized = String(value || "").replace(/\r\n/g, "\n").trim()
  if (!normalized) return null
  if (normalized.length > MAX_REVIEW_NOTE_LENGTH) {
    const error = new Error("materials_page.errors.review_note_too_long")
    error.status = 400
    throw error
  }
  return normalized
}

export function buildMaterialReviewUpdate({ action, status, reviewedBy, reviewNote, now = new Date() } = {}) {
  const nextStatus = statusFromMaterialReviewAction(action, status)
  if (!nextStatus) {
    const error = new Error("materials_page.errors.review_status_invalid")
    error.status = 400
    throw error
  }

  if (nextStatus === "pending") {
    return {
      status: nextStatus,
      reviewedAt: null,
      reviewedBy: null,
      reviewNote: null
    }
  }

  return {
    status: nextStatus,
    reviewedAt: now,
    reviewedBy: String(reviewedBy || "admin").trim().slice(0, 255) || "admin",
    reviewNote: normalizeMaterialReviewNote(reviewNote)
  }
}

export function serializeMaterialSubmission(submission) {
  if (!submission) return null
  return {
    id: submission.id,
    comment: submission.comment,
    originalName: submission.originalName,
    mime: submission.mime,
    size: submission.size,
    sha256: submission.sha256,
    storageStatus: submission.storageStatus || "ACTIVE",
    security: {
      scanState: submission.scanState || "LEGACY_UNKNOWN",
      validationState: submission.validationState || "LEGACY_UNKNOWN",
      scannedAt: submission.scannedAt || null,
      engine: submission.scanEngine || null,
      engineVersion: submission.scanEngineVersion || null,
      signatureVersion: submission.scanSignatureVersion || null,
      signatureUpdatedAt: submission.scanSignatureUpdatedAt || null,
      failureCode: submission.scanFailureCode || null
    },
    duplicateOfId: submission.duplicateOfId || null,
    status: normalizeMaterialSubmissionStatus(submission.status),
    reviewRevision: Number(submission.reviewRevision || 0),
    reviewedAt: submission.reviewedAt || null,
    reviewedBy: submission.reviewedBy || null,
    reviewNote: submission.reviewNote || null,
    retention: {
      original: {
        class: submission.originalRetentionClass || "MATERIAL_PENDING",
        until: submission.originalRetentionUntil || null,
        policyVersion: submission.originalRetentionPolicyVersion || null,
        state: submission.originalRetentionState || "SCHEDULED",
        deletedAt: submission.originalDeletedAt || null
      },
      derivative: {
        class: submission.derivativeRetentionClass || "MATERIAL_SANITIZED_DERIVATIVE",
        until: submission.derivativeRetentionUntil || null,
        policyVersion: submission.derivativeRetentionPolicyVersion || null,
        state: submission.derivativeRetentionState || "NOT_PRESENT",
        deletedAt: submission.derivativeDeletedAt || null
      },
      rag: {
        class: submission.ragRetentionClass || "MATERIAL_RAG_COPY",
        until: submission.ragRetentionUntil || null,
        policyVersion: submission.ragRetentionPolicyVersion || null,
        state: submission.ragRetentionState || "NOT_PRESENT",
        rightsReviewedAt: submission.ragRightsReviewedAt || null,
        freshnessReviewedAt: submission.ragFreshnessReviewedAt || null,
        rightsValidUntil: submission.rightsValidUntil || null,
        sourceValidUntil: submission.sourceValidUntil || null,
        deletedAt: submission.ragDeletedAt || null
      }
    },
    rag: {
      sourceId: submission.sourceId || null,
      docId: submission.ragDocId || null,
      version: Number(submission.ragVersion || 0),
      contentHash: submission.ragContentHash || null,
      collection: submission.ragCollection || null,
      audience: submission.ragAudience || null,
      policyVersion: submission.ragPolicyVersion || null,
      rightsEvidenceMode: submission.rightsEvidenceMode || null,
      retentionMode: submission.ragRetentionMode || null,
      withdrawalAuthority: submission.ragWithdrawalAuthority || null,
      ingestStatus: submission.ragIngestStatus || "NOT_CONFIGURED",
      ingestedAt: submission.ragIngestedAt || null,
      ingestedByUserId: submission.ragIngestedByUserId || null,
      errorCode: submission.ragIngestErrorCode || null,
      attempts: Number(submission.ragIngestAttempts || 0),
      nextAttemptAt: submission.ragIngestNextAt || null,
      removalStatus: submission.ragRemovalStatus || null
    },
    rights: {
      authorName: submission.authorName || null,
      holder: submission.rightsHolder || null,
      basis: submission.rightsBasis || null,
      evidence: submission.rightsEvidence || null,
      confirmedAt: submission.rightsConfirmedAt || null,
      confirmedByUserId: submission.rightsConfirmedByUserId || null
    },
    notification: submission.batch
      ? {
          status: submission.batch.notificationStatus,
          attempts: Number(submission.batch.notificationAttempts || 0),
          lastErrorCode: submission.batch.notificationLastError || null,
          nextAttemptAt: submission.batch.notificationNextAt || null,
          sentAt: submission.batch.notifiedAt || null
        }
      : null,
    createdAt: submission.createdAt,
    updatedAt: submission.updatedAt,
    submittedByUser: submission.submittedByUser
      ? {
          id: submission.submittedByUser.id,
          email: submission.submittedByUser.email
        }
      : null
  }
}
