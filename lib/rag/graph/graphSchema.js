// Graph-lite phase 1 contract: entity/relation vocabulary and the allowed
// (fromType, relationType, toType) triples. Relations outside this table are
// rejected at build time so the graph cannot degenerate into free-form edges.
// RELATED_TO is deliberately last-resort: builders must prefer a specific type.

export const RAG_ENTITY_TYPES = Object.freeze([
  "SERVICE",
  "BENEFIT",
  "LAW",
  "LEGAL_SECTION",
  "MUNICIPALITY",
  "ORGANIZATION",
  "FORM",
  "CONTACT_POINT",
  "TARGET_GROUP",
  "NEED",
  "RISK_SIGNAL",
  "DOCUMENT_TYPE",
  "WORKFLOW"
]);

export const RAG_RELATION_TYPES = Object.freeze([
  "REGULATES",
  "BELONGS_TO",
  "PROVIDED_BY",
  "ORGANIZED_BY",
  "SUITABLE_FOR",
  "REQUIRES",
  "RELATED_TO",
  "HAS_LEGAL_BASIS",
  "HAS_DOCUMENT",
  "HAS_FORM",
  "HAS_NEXT_STEP",
  "HAS_CONTACT_POINT",
  "ASSESSES",
  "MITIGATES_RISK",
  "ESCALATES_TO",
  "APPLIES_TO",
  "AVAILABLE_IN"
]);

// Relation types that must always start as NEEDS_REVIEW because they touch
// risk/crisis logic. Phase 1 deterministic builders never emit these.
export const REVIEW_REQUIRED_RELATION_TYPES = Object.freeze([
  "MITIGATES_RISK",
  "ESCALATES_TO",
  "ASSESSES"
]);

const SERVICE_LIKE = ["SERVICE", "BENEFIT"];

export const ALLOWED_RELATION_TRIPLES = Object.freeze([
  ...SERVICE_LIKE.flatMap(serviceType => [
    [serviceType, "AVAILABLE_IN", "MUNICIPALITY"],
    [serviceType, "PROVIDED_BY", "ORGANIZATION"],
    [serviceType, "PROVIDED_BY", "MUNICIPALITY"],
    [serviceType, "HAS_FORM", "FORM"],
    [serviceType, "HAS_CONTACT_POINT", "CONTACT_POINT"],
    [serviceType, "HAS_LEGAL_BASIS", "LAW"],
    [serviceType, "HAS_LEGAL_BASIS", "LEGAL_SECTION"],
    [serviceType, "HAS_DOCUMENT", "DOCUMENT_TYPE"],
    [serviceType, "SUITABLE_FOR", "TARGET_GROUP"],
    [serviceType, "REQUIRES", "DOCUMENT_TYPE"],
    [serviceType, "RELATED_TO", serviceType === "SERVICE" ? "SERVICE" : "BENEFIT"],
    [serviceType, "RELATED_TO", serviceType === "SERVICE" ? "BENEFIT" : "SERVICE"]
  ]),
  ["LEGAL_SECTION", "REGULATES", "SERVICE"],
  ["LEGAL_SECTION", "REGULATES", "BENEFIT"],
  ["LAW", "REGULATES", "SERVICE"],
  ["LAW", "REGULATES", "BENEFIT"],
  ["LEGAL_SECTION", "BELONGS_TO", "LAW"],
  ["FORM", "BELONGS_TO", "MUNICIPALITY"],
  ["FORM", "BELONGS_TO", "ORGANIZATION"],
  ["CONTACT_POINT", "BELONGS_TO", "MUNICIPALITY"],
  ["CONTACT_POINT", "BELONGS_TO", "ORGANIZATION"],
  ["ORGANIZATION", "ORGANIZED_BY", "ORGANIZATION"],
  ["ORGANIZATION", "BELONGS_TO", "MUNICIPALITY"],
  ["WORKFLOW", "HAS_NEXT_STEP", "WORKFLOW"],
  ["WORKFLOW", "APPLIES_TO", "TARGET_GROUP"],
  ["NEED", "RELATED_TO", "SERVICE"],
  ["NEED", "RELATED_TO", "BENEFIT"],
  ["RISK_SIGNAL", "ESCALATES_TO", "WORKFLOW"],
  ["RISK_SIGNAL", "ESCALATES_TO", "CONTACT_POINT"],
  ["SERVICE", "MITIGATES_RISK", "RISK_SIGNAL"],
  ["WORKFLOW", "ASSESSES", "NEED"]
]);

const tripleKey = (fromType, relationType, toType) => `${fromType}>${relationType}>${toType}`;
const ALLOWED_TRIPLE_SET = new Set(ALLOWED_RELATION_TRIPLES.map(t => tripleKey(...t)));

export function isAllowedRelation(fromType, relationType, toType) {
  return ALLOWED_TRIPLE_SET.has(tripleKey(fromType, relationType, toType));
}

export function normalizeEntityName(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function validateGraphEntity(entity = {}) {
  const errors = [];
  if (!RAG_ENTITY_TYPES.includes(entity.type)) errors.push(`unknown entity type: ${entity.type}`);
  if (!String(entity.name || "").trim()) errors.push("entity name is required");
  if (!String(entity.externalKey || "").trim()) errors.push("entity externalKey is required");
  return { ok: errors.length === 0, errors };
}

export function validateGraphRelation(relation = {}, entityTypeByKey = new Map()) {
  const errors = [];
  if (!RAG_RELATION_TYPES.includes(relation.relationType)) {
    errors.push(`unknown relation type: ${relation.relationType}`);
  }
  const fromType = entityTypeByKey.get(relation.fromKey);
  const toType = entityTypeByKey.get(relation.toKey);
  if (!fromType) errors.push(`from entity not found: ${relation.fromKey}`);
  if (!toType) errors.push(`to entity not found: ${relation.toKey}`);
  if (fromType && toType && RAG_RELATION_TYPES.includes(relation.relationType)
    && !isAllowedRelation(fromType, relation.relationType, toType)) {
    errors.push(`relation not allowed: ${fromType} ${relation.relationType} ${toType}`);
  }
  if (!relation.evidence || (!relation.evidence.source_document_id && !relation.evidence.chunk_id)) {
    errors.push("relation evidence (source_document_id or chunk_id) is required");
  }
  if (REVIEW_REQUIRED_RELATION_TYPES.includes(relation.relationType)
    && relation.reviewStatus !== "NEEDS_REVIEW") {
    errors.push(`relation type ${relation.relationType} must be NEEDS_REVIEW`);
  }
  return { ok: errors.length === 0, errors };
}
