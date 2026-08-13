import test from "node:test"
import assert from "node:assert/strict"

import {
  assertMaterialReviewTransition,
  auditMaterialDownload,
  normalizeExpectedMaterialRevision,
  reviewMaterialSubmission
} from "../../lib/materials/review.js"
import { buildMaterialReviewUpdate } from "../../lib/materials/submissions.js"

test("material review transition matrix keeps imported terminal", () => {
  assert.doesNotThrow(() => assertMaterialReviewTransition("pending", "reviewed"))
  assert.doesNotThrow(() => assertMaterialReviewTransition("reviewed", "imported"))
  assert.throws(() => assertMaterialReviewTransition("imported", "pending"), /review_transition_invalid/)
  assert.throws(() => assertMaterialReviewTransition("pending", "imported"), /review_transition_invalid/)
})

test("material review requires an explicit non-negative revision", () => {
  assert.equal(normalizeExpectedMaterialRevision(0), 0)
  assert.equal(normalizeExpectedMaterialRevision("4"), 4)
  assert.throws(() => normalizeExpectedMaterialRevision(undefined), /review_revision_required/)
  assert.throws(() => normalizeExpectedMaterialRevision(-1), /review_revision_required/)
})

test("material review rejects an overlong note instead of truncating it", () => {
  assert.throws(
    () => buildMaterialReviewUpdate({ action: "reject", reviewNote: "x".repeat(2001) }),
    /review_note_too_long/
  )
})

test("material cannot claim imported before the rights and RAG receipt flow exists", async () => {
  await assert.rejects(
    reviewMaterialSubmission({
      id: "mat-1",
      action: "mark_imported",
      expectedRevision: 1,
      reviewedBy: "admin-1",
      actorUserId: "admin-1"
    }),
    /rag_ingest_decision_required/
  )
})

test("material download fails closed when the mandatory audit cannot be written", async () => {
  await assert.rejects(
    auditMaterialDownload(
      { id: "mat-1", submittedByUserId: "owner-1", mime: "text/plain", size: 10 },
      { actorUserId: "admin-1", admin: true },
      { audit: async () => { throw new Error("audit unavailable") } }
    ),
    /audit unavailable/
  )
})
