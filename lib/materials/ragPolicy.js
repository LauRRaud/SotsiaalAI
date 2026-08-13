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

function text(value) {
  return String(value || "").trim()
}

export function materialRagPolicyFromEnvironment(env = process.env) {
  const policy = Object.fromEntries(
    Object.entries(POLICY_FIELDS).map(([key, variable]) => [key, text(env?.[variable])])
  )
  const missing = Object.entries(policy).filter(([, value]) => !value).map(([key]) => key)
  if (missing.length) return { configured: false, missing, policy: null }
  if (!AUDIENCES.has(policy.audience)) return { configured: false, missing: ["audience"], policy: null }
  if (!RIGHTS_EVIDENCE_MODES.has(policy.rightsEvidenceMode)) return { configured: false, missing: ["rightsEvidenceMode"], policy: null }
  if (!RETENTION_MODES.has(policy.retentionMode)) return { configured: false, missing: ["retentionMode"], policy: null }
  if (!WITHDRAWAL_AUTHORITIES.has(policy.withdrawalAuthority)) return { configured: false, missing: ["withdrawalAuthority"], policy: null }
  if (!COLLECTION_RE.test(policy.collection)) return { configured: false, missing: ["collection"], policy: null }
  return { configured: true, missing: [], policy: Object.freeze(policy) }
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
    !COLLECTION_RE.test(normalized.collection) && "collection"
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
