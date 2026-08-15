import test from "node:test"
import assert from "node:assert/strict"

import {
  buildMaterialReviewUpdate,
  normalizeMaterialSubmissionStatus,
  serializeMaterialSubmission,
  statusFromMaterialReviewAction
} from "../../lib/materials/submissions.js"

test("material review action maps to review metadata", () => {
  const now = new Date("2026-05-02T10:00:00.000Z")
  const update = buildMaterialReviewUpdate({
    action: "mark_reviewed",
    reviewedBy: "admin@example.test",
    reviewNote: "Checked",
    now
  })

  assert.deepEqual(update, {
    status: "reviewed",
    reviewedAt: now,
    reviewedBy: "admin@example.test",
    reviewNote: "Checked"
  })
})

test("pending material review clears review metadata", () => {
  const update = buildMaterialReviewUpdate({
    status: "pending",
    reviewedBy: "admin@example.test",
    reviewNote: "Old note",
    now: new Date("2026-05-02T10:00:00.000Z")
  })

  assert.deepEqual(update, {
    status: "pending",
    reviewedAt: null,
    reviewedBy: null,
    reviewNote: null
  })
})

test("material review status rejects unknown action", () => {
  assert.equal(statusFromMaterialReviewAction("mark_imported"), "imported")
  assert.equal(normalizeMaterialSubmissionStatus("unknown"), "pending")
  assert.throws(() => buildMaterialReviewUpdate({ action: "unknown" }), /review_status_invalid/)
})

test("serialized material submission includes status and safe review fields", () => {
  const createdAt = new Date("2026-05-02T09:00:00.000Z")
  const reviewedAt = new Date("2026-05-02T10:00:00.000Z")
  const originalUntil = new Date("2026-05-09T10:00:00.000Z")
  const ragUntil = new Date("2027-05-02T10:00:00.000Z")
  const serialized = serializeMaterialSubmission({
    id: "mat_1",
    comment: "A short note",
    originalName: "guide.pdf",
    mime: "application/pdf",
    size: 123,
    sha256: "abc",
    status: "imported",
    reviewedAt,
    reviewedBy: "admin@example.test",
    reviewNote: "Imported into review queue",
    originalRetentionClass: "MATERIAL_IMPORTED_ORIGINAL",
    originalRetentionUntil: originalUntil,
    originalRetentionPolicyVersion: "SOL-MAT-12-2026-08-13",
    originalRetentionState: "SCHEDULED",
    derivativeRetentionState: "NOT_PRESENT",
    ragRetentionClass: "MATERIAL_RAG_COPY",
    ragRetentionUntil: ragUntil,
    ragRetentionPolicyVersion: "SOL-MAT-12-2026-08-13",
    ragRetentionState: "SCHEDULED",
    ragRightsReviewedAt: reviewedAt,
    ragFreshnessReviewedAt: reviewedAt,
    createdAt,
    updatedAt: reviewedAt,
    submittedByUser: {
      id: "user_1",
      email: "user@example.test",
      passwordHash: "not returned"
    }
  })

  assert.equal(serialized.status, "imported")
  assert.equal(serialized.reviewedAt, reviewedAt)
  assert.equal(serialized.reviewedBy, "admin@example.test")
  assert.equal(serialized.reviewNote, "Imported into review queue")
  assert.equal(serialized.retention.original.until, originalUntil)
  assert.equal(serialized.retention.derivative.state, "NOT_PRESENT")
  assert.equal(serialized.retention.rag.until, ragUntil)
  assert.equal(serialized.retention.rag.rightsReviewedAt, reviewedAt)
  assert.deepEqual(serialized.submittedByUser, {
    id: "user_1",
    email: "user@example.test"
  })
  assert.equal(serialized.submittedByUser.passwordHash, undefined)
})

test("material notification delivery metadata is opt-in for admin responses", () => {
  const submission = {
    id: "mat_1",
    batch: {
      notificationStatus: "RETRY",
      notificationAttempts: 3,
      notificationLastError: "SMTP_451",
      notificationNextAt: new Date("2026-05-02T11:00:00.000Z"),
      notifiedAt: null
    }
  }

  const ownerResponse = serializeMaterialSubmission(submission)
  const adminResponse = serializeMaterialSubmission(submission, { includeNotification: true })

  assert.equal(Object.hasOwn(ownerResponse, "notification"), false)
  assert.deepEqual(adminResponse.notification, {
    status: "RETRY",
    attempts: 3,
    lastErrorCode: "SMTP_451",
    nextAttemptAt: submission.batch.notificationNextAt,
    sentAt: null
  })
})
