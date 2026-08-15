const DAY_MS = 24 * 60 * 60 * 1000

export const MATERIAL_RETENTION_POLICY_VERSION = "SOL-MAT-12-2026-08-13"

const POLICY_DAYS = Object.freeze({
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

const POLICY = Object.freeze({
  version: MATERIAL_RETENTION_POLICY_VERSION,
  days: POLICY_DAYS,
  ragRetentionMode: "DELETE_WITH_SUBMISSION_OR_ACCOUNT"
})

const SUBMISSION_POLICY = Object.freeze({
  pending: ["MATERIAL_PENDING", POLICY_DAYS.pending],
  rejected: ["MATERIAL_REJECTED", POLICY_DAYS.rejected],
  reviewed: ["MATERIAL_REVIEWED", POLICY_DAYS.reviewed]
})

function text(value, max = 200) {
  const normalized = String(value || "").trim()
  return normalized ? normalized.slice(0, max) : ""
}

function validDate(value) {
  if (value == null || value === "") return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

function anchorDate(value) {
  const date = validDate(value)
  if (!date) throw Object.assign(new Error("material_retention_anchor_invalid"), { code: "material_retention_anchor_invalid" })
  return date
}

function deadline(anchor, days, boundaries = []) {
  const candidates = [new Date(anchor.getTime() + (days * DAY_MS)), ...boundaries.map(validDate).filter(Boolean)]
  return new Date(Math.min(...candidates.map(item => item.getTime())))
}

function originalFields(retentionClass, anchor, days) {
  const anchorAt = anchorDate(anchor)
  return {
    originalRetentionClass: retentionClass,
    originalRetentionUntil: deadline(anchorAt, days),
    originalRetentionPolicyVersion: MATERIAL_RETENTION_POLICY_VERSION,
    originalRetentionState: "SCHEDULED",
    originalRetentionAnchorAt: anchorAt,
    originalDeletedAt: null
  }
}

export function materialRetentionPolicyFromEnvironment() {
  // SOL-MAT-12: päevad on kinnitatud andmekäitlusleping, mitte deploy-keskkonna
  // vabalt muudetav seadistus. Funktsiooni nimi jääb olemasolevate kutsujate jaoks.
  return { configured: true, missing: [], policy: POLICY }
}

export function retentionFieldsForSubmission(status, anchor, { derivativePresent = false } = {}) {
  const definition = SUBMISSION_POLICY[text(status, 40).toLowerCase()]
  if (!definition) throw Object.assign(new Error("material_retention_status_invalid"), { code: "material_retention_status_invalid" })
  const fields = originalFields(definition[0], anchor, definition[1])
  if (!derivativePresent) return fields
  return {
    ...fields,
    derivativeRetentionClass: "MATERIAL_SANITIZED_DERIVATIVE",
    derivativeRetentionUntil: fields.originalRetentionUntil,
    derivativeRetentionPolicyVersion: MATERIAL_RETENTION_POLICY_VERSION,
    derivativeRetentionState: "SCHEDULED",
    derivativeRetentionAnchorAt: fields.originalRetentionAnchorAt,
    derivativeDeletedAt: null
  }
}

export function retentionFieldsForImportedLayers(anchor, {
  derivativePresent = false,
  rightsValidUntil = null,
  sourceValidUntil = null
} = {}) {
  const anchorAt = anchorDate(anchor)
  const reevaluationBoundaries = [rightsValidUntil, sourceValidUntil]
  const derivativeUntil = derivativePresent
    ? deadline(anchorAt, POLICY_DAYS.sanitizedDerivative, reevaluationBoundaries)
    : null
  return {
    ...originalFields("MATERIAL_IMPORTED_ORIGINAL", anchorAt, POLICY_DAYS.importedOriginal),
    derivativeRetentionClass: "MATERIAL_SANITIZED_DERIVATIVE",
    derivativeRetentionUntil: derivativeUntil,
    derivativeRetentionPolicyVersion: MATERIAL_RETENTION_POLICY_VERSION,
    derivativeRetentionState: derivativePresent ? "SCHEDULED" : "NOT_PRESENT",
    derivativeRetentionAnchorAt: derivativePresent ? anchorAt : null,
    derivativeDeletedAt: null,
    ragRetentionClass: "MATERIAL_RAG_COPY",
    ragRetentionUntil: deadline(anchorAt, POLICY_DAYS.ragCopy, reevaluationBoundaries),
    ragRetentionPolicyVersion: MATERIAL_RETENTION_POLICY_VERSION,
    ragRetentionState: "SCHEDULED",
    ragRetentionAnchorAt: anchorAt,
    ragRightsReviewedAt: anchorAt,
    ragFreshnessReviewedAt: anchorAt,
    ragDeletedAt: null
  }
}

export function retentionFieldsForQuarantine(receipt, anchor) {
  const anchorAt = anchorDate(anchor)
  const scanState = text(receipt?.scanState, 40).toUpperCase()
  const state = scanState === "CLEAN" ? "CLEAN" : scanState === "FAILED" ? "FAILED" : "PENDING"
  const days = state === "CLEAN"
    ? POLICY_DAYS.quarantineClean
    : state === "FAILED"
      ? POLICY_DAYS.quarantineFailed
      : POLICY_DAYS.quarantinePending
  return {
    retentionClass: `MATERIAL_QUARANTINE_${state}`,
    retentionUntil: deadline(anchorAt, days),
    retentionPolicyVersion: MATERIAL_RETENTION_POLICY_VERSION,
    retentionState: "SCHEDULED",
    retentionAnchorAt: anchorAt
  }
}
