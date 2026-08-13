const DAY_MS = 24 * 60 * 60 * 1000

const SUBMISSION_POLICY = Object.freeze({
  pending: ["MATERIAL_PENDING", "MATERIALS_RETENTION_PENDING_DAYS"],
  rejected: ["MATERIAL_REJECTED", "MATERIALS_RETENTION_REJECTED_DAYS"],
  reviewed: ["MATERIAL_REVIEWED", "MATERIALS_RETENTION_REVIEWED_DAYS"],
  imported: ["MATERIAL_IMPORTED_ORIGINAL", "MATERIALS_RETENTION_IMPORTED_ORIGINAL_DAYS"]
})

const QUARANTINE_POLICY = Object.freeze({
  PENDING: ["MATERIAL_QUARANTINE_PENDING", "MATERIALS_RETENTION_QUARANTINE_PENDING_DAYS"],
  FAILED: ["MATERIAL_QUARANTINE_FAILED", "MATERIALS_RETENTION_QUARANTINE_FAILED_DAYS"],
  CLEAN: ["MATERIAL_QUARANTINE_CLEAN", "MATERIALS_RETENTION_QUARANTINE_CLEAN_DAYS"]
})

const REQUIRED_VARIABLES = Object.freeze([
  "MATERIALS_RETENTION_PENDING_DAYS",
  "MATERIALS_RETENTION_REJECTED_DAYS",
  "MATERIALS_RETENTION_REVIEWED_DAYS",
  "MATERIALS_RETENTION_IMPORTED_ORIGINAL_DAYS",
  "MATERIALS_RETENTION_QUARANTINE_PENDING_DAYS",
  "MATERIALS_RETENTION_QUARANTINE_FAILED_DAYS",
  "MATERIALS_RETENTION_QUARANTINE_CLEAN_DAYS"
])

function text(value, max = 200) {
  const normalized = String(value || "").trim()
  return normalized ? normalized.slice(0, max) : ""
}

function parseDays(value) {
  const raw = text(value, 20)
  if (!/^\d+$/u.test(raw)) return null
  const days = Number(raw)
  return Number.isSafeInteger(days) && days > 0 ? days : null
}

function decisionPending(anchorAt) {
  return {
    retentionClass: "DECISION_PENDING",
    retentionUntil: null,
    retentionPolicyVersion: null,
    retentionState: "DECISION_PENDING",
    retentionAnchorAt: anchorAt
  }
}

function fieldsFor(definition, anchor, policyResult) {
  const anchorAt = new Date(anchor)
  if (!Number.isFinite(anchorAt.getTime()) || !policyResult?.configured || !definition) {
    return decisionPending(Number.isFinite(anchorAt.getTime()) ? anchorAt : new Date(0))
  }
  const [retentionClass, variable] = definition
  const days = policyResult.policy.days[variable]
  return {
    retentionClass,
    retentionUntil: new Date(anchorAt.getTime() + (days * DAY_MS)),
    retentionPolicyVersion: policyResult.policy.version,
    retentionState: "SCHEDULED",
    retentionAnchorAt: anchorAt
  }
}

export function materialRetentionPolicyFromEnvironment(env = process.env) {
  const status = text(env?.MATERIALS_RETENTION_POLICY_STATUS, 40).toUpperCase()
  const version = text(env?.MATERIALS_RETENTION_POLICY_VERSION, 120)
  const days = Object.fromEntries(REQUIRED_VARIABLES.map(variable => [variable, parseDays(env?.[variable])]))
  const missing = [
    ...(status === "CONFIRMED" ? [] : ["MATERIALS_RETENTION_POLICY_STATUS"]),
    ...(version ? [] : ["MATERIALS_RETENTION_POLICY_VERSION"]),
    ...REQUIRED_VARIABLES.filter(variable => days[variable] == null)
  ]
  if (missing.length) return { configured: false, missing, policy: null }
  return { configured: true, missing: [], policy: Object.freeze({ version, days: Object.freeze(days) }) }
}

export function retentionFieldsForSubmission(status, anchor, policyResult = materialRetentionPolicyFromEnvironment()) {
  return fieldsFor(SUBMISSION_POLICY[text(status, 40).toLowerCase()], anchor, policyResult)
}

export function retentionFieldsForQuarantine(receipt, anchor, policyResult = materialRetentionPolicyFromEnvironment()) {
  const scanState = text(receipt?.scanState, 40).toUpperCase()
  const state = scanState === "CLEAN" ? "CLEAN" : scanState === "FAILED" ? "FAILED" : "PENDING"
  return fieldsFor(QUARANTINE_POLICY[state], anchor, policyResult)
}
