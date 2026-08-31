import { createHash } from "node:crypto";

export const responseTextHash = text => createHash("sha256").update(String(text || "").trim()).digest("hex");
const validIndexes = values => Array.isArray(values) && values.length <= 12 &&
  values.every(value => Number.isInteger(value) && value >= 1 && value <= 12) && new Set(values).size === values.length;
export const GROUP_CONTRACT_REASONS = ["group_requirements_not_supported", "group_locator_missing", "group_source_not_active",
  "group_evidence_conflict", "group_evidence_uncheckable", "group_evidence_missing", "group_source_version_conflict",
  "group_facts_bound", "group_membership_missing", "group_population_mismatch"];

// This is a server-produced decision, not a client-supplied grant. It keeps
// incomplete request coverage separate from authorization of the actual reply.
export function hasValidatedPublication(trace, reply = null) {
  const decision = trace?.response_decision;
  return trace?.enabled === true && decision?.version === "supported_response_v1" &&
    trace.version === "group_fact_contract_v1" && trace.document_identity_matched === true &&
    trace.document_identity_confidence === "high" &&
    trace.reason === (decision.semantic_outcome === "COMPLETE" ? "group_fact_complete" : "group_fact_partial") &&
    decision?.issuer === "group_fact_contract_v1" && decision?.publication_allowed === true &&
    ["COMPLETE", "PARTIAL"].includes(decision.semantic_outcome) &&
    /^[a-f0-9]{64}$/u.test(decision.validated_reply_hash || "") &&
    validIndexes(decision.admitted_slot_indexes) && decision.admitted_slot_indexes.length > 0 &&
    validIndexes(decision.missing_slot_indexes) &&
    !decision.admitted_slot_indexes.some(index => decision.missing_slot_indexes.includes(index)) &&
    trace.passed === (decision.semantic_outcome === "COMPLETE") &&
    (decision.semantic_outcome === "COMPLETE") === (decision.missing_slot_indexes.length === 0) &&
    (reply === null || responseTextHash(reply) === decision.validated_reply_hash);
}

// IDs, hashes and coordinates only: never copy source text or member names.
export function projectGroupEvidenceLocators(value) {
  return (Array.isArray(value) ? value : []).slice(0, 12).map(item => Object.fromEntries([
    ...["document_id", "source_id", "chunk_id", "document_version", "offset_basis", "chunk_offset_basis"].map(key =>
      [key, typeof item?.[key] === "string" && /^[\p{L}\p{N}_.:/+-]{1,512}$/u.test(item[key]) && !item[key].startsWith("sk-") ? item[key] : null]),
    ...["chunk_hash", "rendered_body_hash", "fragment_hash"].map(key => [key, /^[a-f0-9]{64}$/u.test(item?.[key] || "") ? item[key] : null]),
    ...["slot_index", "rendered_block_index", "start", "end", "chunk_start", "chunk_end"].map(key =>
      [key, Number.isSafeInteger(item?.[key]) && item[key] >= 0 && item[key] <= 10000000 ? item[key] : null])
  ].filter(([, value]) => value !== null)));
}

export function projectResponseDecision(value) {
  if (!value || value.version !== "supported_response_v1" || value.issuer !== "group_fact_contract_v1") return null;
  const indexes = values => [...new Set((Array.isArray(values) ? values : [])
    .filter(item => Number.isInteger(item) && item >= 1 && item <= 12))].slice(0, 12);
  return {
    version: value.version, issuer: value.issuer,
    semantic_outcome: ["COMPLETE", "PARTIAL"].includes(value.semantic_outcome) ? value.semantic_outcome : null,
    publication_allowed: value.publication_allowed === true,
    validated_reply_hash: /^[a-f0-9]{64}$/u.test(value.validated_reply_hash || "") ? value.validated_reply_hash : null,
    admitted_slot_indexes: indexes(value.admitted_slot_indexes),
    missing_slot_indexes: indexes(value.missing_slot_indexes)
  };
}
