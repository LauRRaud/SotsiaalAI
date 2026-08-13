import assert from "node:assert/strict"
import test from "node:test"

import {
  materialRetentionPolicyFromEnvironment,
  retentionFieldsForQuarantine,
  retentionFieldsForSubmission
} from "../../lib/materials/retentionPolicy.js"

const DAY = 24 * 60 * 60 * 1000
const anchor = new Date("2026-08-13T12:00:00.000Z")

function confirmedPolicyEnv(overrides = {}) {
  return {
    MATERIALS_RETENTION_POLICY_STATUS: "CONFIRMED",
    MATERIALS_RETENTION_POLICY_VERSION: "owner-v1",
    MATERIALS_RETENTION_PENDING_DAYS: "14",
    MATERIALS_RETENTION_REJECTED_DAYS: "30",
    MATERIALS_RETENTION_REVIEWED_DAYS: "60",
    MATERIALS_RETENTION_IMPORTED_ORIGINAL_DAYS: "90",
    MATERIALS_RETENTION_QUARANTINE_PENDING_DAYS: "2",
    MATERIALS_RETENTION_QUARANTINE_FAILED_DAYS: "7",
    MATERIALS_RETENTION_QUARANTINE_CLEAN_DAYS: "1",
    ...overrides
  }
}

test("retention policy fails closed without an explicit confirmed owner decision", () => {
  const absent = materialRetentionPolicyFromEnvironment({})
  const partial = materialRetentionPolicyFromEnvironment(confirmedPolicyEnv({
    MATERIALS_RETENTION_REJECTED_DAYS: ""
  }))

  assert.equal(absent.configured, false)
  assert.equal(partial.configured, false)
  assert.equal(retentionFieldsForSubmission("pending", anchor, absent).retentionUntil, null)
  assert.equal(retentionFieldsForSubmission("pending", anchor, absent).retentionState, "DECISION_PENDING")
})

test("every submission transition deterministically recalculates its UTC deadline", () => {
  const policy = materialRetentionPolicyFromEnvironment(confirmedPolicyEnv())
  const expectedDays = { pending: 14, rejected: 30, reviewed: 60, imported: 90 }
  const expectedClass = { pending: "MATERIAL_PENDING", rejected: "MATERIAL_REJECTED", reviewed: "MATERIAL_REVIEWED", imported: "MATERIAL_IMPORTED_ORIGINAL" }

  for (const [status, days] of Object.entries(expectedDays)) {
    const fields = retentionFieldsForSubmission(status, anchor, policy)
    assert.equal(fields.retentionClass, expectedClass[status])
    assert.equal(fields.retentionState, "SCHEDULED")
    assert.equal(fields.retentionPolicyVersion, "owner-v1")
    assert.equal(fields.retentionAnchorAt.toISOString(), anchor.toISOString())
    assert.equal(fields.retentionUntil.toISOString(), new Date(anchor.getTime() + (days * DAY)).toISOString())
  }
})

test("quarantine PENDING/FAILED and CLEAN lifecycles have separate configured clocks", () => {
  const policy = materialRetentionPolicyFromEnvironment(confirmedPolicyEnv())
  assert.equal(retentionFieldsForQuarantine({ scanState: "PENDING" }, anchor, policy).retentionUntil.getTime(), anchor.getTime() + 2 * DAY)
  assert.equal(retentionFieldsForQuarantine({ scanState: "FAILED" }, anchor, policy).retentionUntil.getTime(), anchor.getTime() + 7 * DAY)
  assert.equal(retentionFieldsForQuarantine({ scanState: "CLEAN", validationState: "VALIDATED" }, anchor, policy).retentionUntil.getTime(), anchor.getTime() + DAY)
})

test("invalid or fractional day values never create a plausible-looking date", () => {
  for (const value of ["0", "-1", "1.5", "abc"]) {
    const policy = materialRetentionPolicyFromEnvironment(confirmedPolicyEnv({
      MATERIALS_RETENTION_PENDING_DAYS: value
    }))
    assert.equal(policy.configured, false)
    assert.equal(retentionFieldsForSubmission("pending", anchor, policy).retentionUntil, null)
  }
})
