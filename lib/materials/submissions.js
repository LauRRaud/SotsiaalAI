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
  return normalized.slice(0, MAX_REVIEW_NOTE_LENGTH)
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
    status: normalizeMaterialSubmissionStatus(submission.status),
    reviewedAt: submission.reviewedAt || null,
    reviewedBy: submission.reviewedBy || null,
    reviewNote: submission.reviewNote || null,
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
