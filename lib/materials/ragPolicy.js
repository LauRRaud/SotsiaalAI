const POLICY_FIELDS = Object.freeze({
  version: "MATERIALS_RAG_POLICY_VERSION",
  rightsEvidenceMode: "MATERIALS_RAG_RIGHTS_EVIDENCE_MODE",
  collection: "MATERIALS_RAG_COLLECTION",
  audience: "MATERIALS_RAG_AUDIENCE",
  retentionMode: "MATERIALS_RAG_RETENTION_MODE",
  withdrawalAuthority: "MATERIALS_RAG_WITHDRAWAL_AUTHORITY"
})

const AUDIENCES = new Set(["CLIENT", "SOCIAL_WORKER", "BOTH"])
const RIGHTS_EVIDENCE_MODES = new Set(["SUBMITTER_ATTESTATION", "ORG_ADMIN_ATTESTATION", "DOCUMENTED_LICENSE"])
const RETENTION_MODES = new Set(["DELETE_WITH_SUBMISSION_OR_ACCOUNT", "RETAIN_AFTER_ACCOUNT_WITH_LICENSE"])
const WITHDRAWAL_AUTHORITIES = new Set(["ADMIN_ONLY", "SUBMITTER_OR_ADMIN", "SUBMITTER_RIGHTS_HOLDER_OR_ADMIN"])
const COLLECTION_RE = /^[a-z][a-z0-9_]{2,63}$/u
const SHARED_RAG_RIGHTS_BASES = new Set(["PUBLIC_DOMAIN", "OPEN_LICENSE", "DOCUMENTED_PERMISSION"])

export const MATERIAL_RAG_POLICY = Object.freeze({
  version: "materials-rag-v1-2026-08",
  rightsEvidenceMode: "DOCUMENTED_LICENSE",
  collection: "materials_reviewed_social_work",
  audience: "SOCIAL_WORKER",
  retentionMode: "DELETE_WITH_SUBMISSION_OR_ACCOUNT",
  withdrawalAuthority: "SUBMITTER_RIGHTS_HOLDER_OR_ADMIN"
})

function text(value) {
  return String(value || "").trim()
}

function optionalDate(value) {
  if (value == null || value === "") return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) {
    const error = new Error("material_rights_validity_invalid")
    error.code = "material_rights_validity_invalid"
    error.status = 400
    throw error
  }
  return date
}

export function materialRagPolicyFromEnvironment(env = process.env) {
  const drift = Object.entries(POLICY_FIELDS)
    .filter(([key, variable]) => text(env?.[variable]) && text(env?.[variable]) !== MATERIAL_RAG_POLICY[key])
    .map(([key]) => key)
  if (drift.length) return { configured: false, missing: drift, policy: null }
  return { configured: true, missing: [], policy: MATERIAL_RAG_POLICY }
}

export function requireMaterialRagPolicy(policy) {
  const normalized = Object.fromEntries(
    Object.keys(POLICY_FIELDS).map(key => [key, text(policy?.[key])])
  )
  const missing = Object.entries(normalized).filter(([, value]) => !value).map(([key]) => key)
  const invalid = [
    !AUDIENCES.has(normalized.audience) && "audience",
    !RIGHTS_EVIDENCE_MODES.has(normalized.rightsEvidenceMode) && "rightsEvidenceMode",
    !RETENTION_MODES.has(normalized.retentionMode) && "retentionMode",
    !WITHDRAWAL_AUTHORITIES.has(normalized.withdrawalAuthority) && "withdrawalAuthority",
    !COLLECTION_RE.test(normalized.collection) && "collection",
    ...Object.keys(MATERIAL_RAG_POLICY)
      .filter(key => normalized[key] && normalized[key] !== MATERIAL_RAG_POLICY[key])
  ].filter(Boolean)
  if (missing.length || invalid.length) {
    const error = new Error("materials_page.errors.rag_ingest_decision_required")
    error.code = "MATERIAL_RAG_POLICY_REQUIRED"
    error.status = 409
    error.missingPolicyFields = [...new Set([...missing, ...invalid])]
    throw error
  }
  return normalized
}

export function buildMaterialRagIdentity(submission, version) {
  const id = text(submission?.id)
  const hash = text(submission?.sha256)
  const numericVersion = Number(version)
  if (!id || !/^[a-f0-9]{64}$/iu.test(hash) || !Number.isSafeInteger(numericVersion) || numericVersion < 1) {
    const error = new Error("material_rag_identity_invalid")
    error.code = "material_rag_identity_invalid"
    error.status = 409
    throw error
  }
  const sourceId = `material:${id}`
  return { sourceId, docId: `${sourceId}:v${numericVersion}`, contentHash: hash }
}

export function requireMaterialSharedRagRights(input = {}) {
  const rights = {
    authorName: text(input.authorName).slice(0, 500),
    rightsHolder: text(input.rightsHolder).slice(0, 500),
    rightsBasis: text(input.rightsBasis).toUpperCase().slice(0, 500),
    rightsEvidence: text(input.rightsEvidence).slice(0, 4_000),
    rightsValidUntil: optionalDate(input.rightsValidUntil),
    sourceValidUntil: optionalDate(input.sourceValidUntil)
  }
  const persistedConfirmation = Boolean(input.rightsConfirmedAt && input.rightsConfirmedByUserId)
  const forbidden = !persistedConfirmation && (
    input.clientCaseMaterial !== false
    || input.confidential !== false
    || input.containsPersonalData !== false
  )
  if (
    [rights.authorName, rights.rightsHolder, rights.rightsBasis, rights.rightsEvidence].some(value => !value)
    || !SHARED_RAG_RIGHTS_BASES.has(rights.rightsBasis)
    || forbidden
  ) {
    const error = new Error("material_shared_rag_rights_forbidden")
    error.code = "material_shared_rag_rights_forbidden"
    error.status = 409
    throw error
  }
  return rights
}
