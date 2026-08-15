import assert from "node:assert/strict"
import test from "node:test"

import {
  MATERIAL_RETENTION_POLICY_VERSION,
  materialRetentionPolicyFromEnvironment,
  retentionFieldsForImportedLayers,
  retentionFieldsForQuarantine,
  retentionFieldsForSubmission
} from "../../lib/materials/retentionPolicy.js"

const DAY = 24 * 60 * 60 * 1000
const anchor = new Date("2026-08-13T12:00:00.000Z")

test("confirmed material policy cannot be weakened by runtime environment overrides", () => {
  const policy = materialRetentionPolicyFromEnvironment({
    MATERIALS_RETENTION_PENDING_DAYS: "9999",
    MATERIALS_RETENTION_IMPORTED_ORIGINAL_DAYS: "9999"
  })

  assert.equal(policy.configured, true)
  assert.equal(policy.policy.version, MATERIAL_RETENTION_POLICY_VERSION)
  assert.deepEqual(policy.policy.days, {
    pending: 14,
    rejected: 30,
    reviewed: 30,
    importedOriginal: 7,
    quarantinePending: 1,
    quarantineFailed: 1,
    quarantineClean: 1,
    sanitizedDerivative: 365,
    ragCopy: 365
  })
})

test("pending, rejected, and reviewed clocks apply only to the original file", () => {
  const expectedDays = { pending: 14, rejected: 30, reviewed: 30 }

  for (const [status, days] of Object.entries(expectedDays)) {
    const fields = retentionFieldsForSubmission(status, anchor)
    assert.equal(fields.originalRetentionClass, `MATERIAL_${status.toUpperCase()}`)
    assert.equal(fields.originalRetentionState, "SCHEDULED")
    assert.equal(fields.originalRetentionPolicyVersion, MATERIAL_RETENTION_POLICY_VERSION)
    assert.equal(fields.originalRetentionAnchorAt.toISOString(), anchor.toISOString())
    assert.equal(fields.originalRetentionUntil.toISOString(), new Date(anchor.getTime() + (days * DAY)).toISOString())
    assert.equal("ragRetentionUntil" in fields, false)
    assert.equal("derivativeRetentionUntil" in fields, false)
  }
})

test("a sanitized derivative created with a submission is tracked on the same pre-import clock", () => {
  const fields = retentionFieldsForSubmission("pending", anchor, { derivativePresent: true })

  assert.equal(fields.derivativeRetentionClass, "MATERIAL_SANITIZED_DERIVATIVE")
  assert.equal(fields.derivativeRetentionState, "SCHEDULED")
  assert.equal(fields.derivativeRetentionAnchorAt.toISOString(), anchor.toISOString())
  assert.equal(fields.derivativeRetentionUntil.toISOString(), fields.originalRetentionUntil.toISOString())
  assert.equal(fields.derivativeRetentionPolicyVersion, MATERIAL_RETENTION_POLICY_VERSION)
})

test("successful ingest starts independent 7-day original and 365-day derivative/RAG clocks", () => {
  const fields = retentionFieldsForImportedLayers(anchor, { derivativePresent: true })

  assert.equal(fields.originalRetentionUntil.getTime(), anchor.getTime() + 7 * DAY)
  assert.equal(fields.derivativeRetentionUntil.getTime(), anchor.getTime() + 365 * DAY)
  assert.equal(fields.ragRetentionUntil.getTime(), anchor.getTime() + 365 * DAY)
  assert.equal(fields.originalRetentionState, "SCHEDULED")
  assert.equal(fields.derivativeRetentionState, "SCHEDULED")
  assert.equal(fields.ragRetentionState, "SCHEDULED")
  assert.equal(fields.ragRightsReviewedAt.toISOString(), anchor.toISOString())
  assert.equal(fields.ragFreshnessReviewedAt.toISOString(), anchor.toISOString())
})

test("a missing derivative is explicit and does not borrow the RAG clock", () => {
  const fields = retentionFieldsForImportedLayers(anchor, { derivativePresent: false })

  assert.equal(fields.derivativeRetentionState, "NOT_PRESENT")
  assert.equal(fields.derivativeRetentionUntil, null)
  assert.equal(fields.ragRetentionState, "SCHEDULED")
  assert.equal(fields.ragRetentionUntil.getTime(), anchor.getTime() + 365 * DAY)
})

test("licence/source expiry shortens the RAG/derivative boundary but never extends 365 days", () => {
  const rightsValidUntil = new Date(anchor.getTime() + 40 * DAY)
  const sourceValidUntil = new Date(anchor.getTime() + 20 * DAY)
  const fields = retentionFieldsForImportedLayers(anchor, {
    derivativePresent: true,
    rightsValidUntil,
    sourceValidUntil
  })

  assert.equal(fields.originalRetentionUntil.getTime(), anchor.getTime() + 7 * DAY)
  assert.equal(fields.derivativeRetentionUntil.getTime(), sourceValidUntil.getTime())
  assert.equal(fields.ragRetentionUntil.getTime(), sourceValidUntil.getTime())
})

test("quarantine PENDING, FAILED, and CLEAN clocks are each one day", () => {
  for (const receipt of [
    { scanState: "PENDING" },
    { scanState: "FAILED" },
    { scanState: "CLEAN", validationState: "VALIDATED" }
  ]) {
    assert.equal(retentionFieldsForQuarantine(receipt, anchor).retentionUntil.getTime(), anchor.getTime() + DAY)
  }
})
