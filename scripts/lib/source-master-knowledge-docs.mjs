import crypto from "node:crypto";
import fs from "node:fs/promises";

import {
  DEFAULT_ALLOWED_GUIDANCE_CLAIMS,
  DISALLOWED_CURRENT_EVIDENCE_CLAIMS,
  validateKnowledgeMetadata
} from "./knowledge-docs.mjs";

export const DEFAULT_SOURCE_MASTER_PATH = "Andmebaasi/Admebaasi-materjali-lisa/master_sources_final.json";

const COLLECTION_HINT_TO_COLLECTION_ID = new Map([
  ["national_guidelines", "national_guidelines"],
  ["research_reports", "research_reports"],
  ["policy_analyses", "policy_analyses"],
  ["organization_guidelines", "organization_guidelines"],
  ["organization_materials", "organization_materials"],
  ["sotsiaaltoo_articles", "sotsiaaltoo_articles"],
  ["training_materials", "training_materials"],
  ["methodology_guides", "methodology_guides"]
]);

const SOURCE_TYPE_MAP = new Map([
  ["official_guideline", "official_guideline"],
  ["information_material", "information_material"],
  ["research_report", "research_report"],
  ["policy_analysis", "policy_analysis"],
  ["methodology_material", "methodology_guide"],
  ["methodology_guide", "methodology_guide"],
  ["training_material", "training_material"],
  ["journal_article", "journal_article"]
]);

const DOCUMENT_KIND_BY_SOURCE_TYPE = new Map([
  ["journal_article", "journal_article"],
  ["research_report", "research_report"],
  ["policy_analysis", "policy_analysis"],
  ["methodology_guide", "methodology"],
  ["methodology_material", "methodology"],
  ["training_material", "training_material"]
]);

const RESOURCE_TYPE_BY_COLLECTION = new Map([
  ["national_guidelines", "best_practice_guidance"],
  ["research_reports", "research_evidence"],
  ["policy_analyses", "policy_context"],
  ["organization_guidelines", "organization_guidance"],
  ["organization_materials", "training_material"],
  ["sotsiaaltoo_articles", "professional_article"],
  ["journal_articles", "professional_article"],
  ["training_materials", "training_material"],
  ["methodology_guides", "method_guidance"]
]);

const EVIDENCE_ROLE_BY_COLLECTION = new Map([
  ["national_guidelines", "practice_guidance"],
  ["research_reports", "research_evidence"],
  ["policy_analyses", "policy_context"],
  ["organization_guidelines", "practice_guidance"],
  ["organization_materials", "methodology_background"],
  ["sotsiaaltoo_articles", "background"],
  ["journal_articles", "background"],
  ["training_materials", "methodology_background"],
  ["methodology_guides", "methodology_background"]
]);

function clean(value) {
  const text = String(value ?? "").trim();
  return text || "";
}

function arrayValue(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function unique(values = []) {
  return [...new Set(arrayValue(values).map(clean).filter(Boolean))];
}

function firstValue(...values) {
  for (const value of values) {
    if (Array.isArray(value)) {
      if (value.length) return value;
      continue;
    }
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && !value.trim()) continue;
    return value;
  }
  return null;
}

function stableHash(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function hasMojibake(value) {
  // U+FFFD = Unicode replacement character; kept as an escape so this file
  // itself passes encoding:check.
  return /[ĆĀÅÂ\uFFFD]/u.test(String(value || ""));
}

function collectEncodingWarnings(record = {}, metadata = {}) {
  const checks = [
    ["title", metadata.title],
    ["publisher", metadata.publisher],
    ["description", metadata.description],
    ["topic_tags", unique(record.topic_tags).join(" ")]
  ];
  return checks
    .filter(([, value]) => hasMojibake(value))
    .map(([field]) => `possible encoding issue in ${field}`);
}

function extractYear(record = {}) {
  const direct = Number(record.year);
  if (Number.isInteger(direct) && direct >= 1900 && direct <= 2100) return direct;
  const haystack = [
    record.title,
    record.url,
    record.normalized_url,
    record.notes,
    ...unique(record.topic_tags),
    ...unique(record.merged_titles)
  ].join(" ");
  const match = haystack.match(/\b(19\d{2}|20\d{2})\b/u);
  return match ? Number(match[1]) : null;
}

function normalizeLinkStatus(record = {}) {
  return unique(record.link_check_status).map(value => value.toLowerCase());
}

function sourceStatusFromRecord(record = {}) {
  const explicit = clean(record.source_status).toLowerCase();
  if (["active", "inactive", "stale", "archived", "unknown"].includes(explicit)) return explicit;
  const statuses = normalizeLinkStatus(record);
  if (statuses.includes("review")) return "unknown";
  return "active";
}

function chooseCollectionId(record = {}) {
  const hints = unique([
    record.collection_hint,
    ...arrayValue(record.collection_hints)
  ]);
  for (const hint of hints) {
    const mapped = COLLECTION_HINT_TO_COLLECTION_ID.get(hint);
    if (mapped) return mapped;
  }
  return "national_guidelines";
}

function chooseSourceType(record = {}) {
  const types = unique([
    record.source_type,
    ...arrayValue(record.source_types_seen)
  ]);
  for (const type of types) {
    const mapped = SOURCE_TYPE_MAP.get(type);
    if (mapped) return mapped;
  }
  return "information_material";
}

function chooseResourceType(record = {}, collectionId) {
  const seen = unique([
    record.resource_type,
    ...arrayValue(record.resource_types_seen)
  ]);
  for (const value of seen) {
    if ([
      "best_practice_guidance",
      "research_evidence",
      "policy_context",
      "method_guidance",
      "training_material",
      "professional_article",
      "information_material",
      "organization_guidance"
    ].includes(value)) return value;
  }
  return RESOURCE_TYPE_BY_COLLECTION.get(collectionId) || "information_material";
}

function chooseEvidenceRole(record = {}, collectionId) {
  const role = clean(record.evidence_role);
  if ([
    "practice_guidance",
    "research_evidence",
    "policy_context",
    "methodology_background",
    "professional_ethics",
    "communication_guidance",
    "case_example",
    "definition",
    "background"
  ].includes(role)) return role;
  return EVIDENCE_ROLE_BY_COLLECTION.get(collectionId) || "background";
}

function chooseDocumentKind(sourceType, collectionId) {
  if (DOCUMENT_KIND_BY_SOURCE_TYPE.has(sourceType)) return DOCUMENT_KIND_BY_SOURCE_TYPE.get(sourceType);
  if (collectionId === "research_reports") return "research_report";
  if (collectionId === "policy_analyses") return "policy_analysis";
  if (collectionId === "sotsiaaltoo_articles" || collectionId === "journal_articles") return "journal_article";
  return "guideline";
}

function normalizeAudience(record = {}) {
  const value = clean(record.audience).toUpperCase();
  if (["CLIENT", "SOCIAL_WORKER", "BOTH", "ADMIN", "PROFESSIONAL", "CLIENT_SIMPLIFIED_ADAPTATION"].includes(value)) {
    return value;
  }
  return "BOTH";
}

function buildDescription(record = {}) {
  const parts = [];
  if (record.notes) parts.push(clean(record.notes));
  const contexts = Array.isArray(record.source_contexts) ? record.source_contexts : [];
  const headings = contexts
    .flatMap(context => [context?.heading_2, context?.heading_3, context?.heading_4])
    .map(clean)
    .filter(Boolean);
  if (headings.length) parts.push(`Source master headings: ${unique(headings).join("; ")}`);
  return parts.join(" ").slice(0, 600) || null;
}

export function isSourceMasterPdfKnowledgeCandidate(record = {}, options = {}) {
  const includeReferenced = options.includeReferenced === true;
  const format = clean(record.source_format).toLowerCase();
  if (format !== "pdf") return false;
  if (record.recommended_pipeline && clean(record.recommended_pipeline) !== "knowledge_doc_pipeline") return false;
  if (!includeReferenced && clean(record.ingest_status) !== "ingest_candidate") return false;
  return /^https?:\/\//iu.test(clean(record.url));
}

export function buildKnowledgeMetadataFromSourceMasterRecord(record = {}, options = {}) {
  const checkedAt = clean(options.checkedAt) || new Date().toISOString().slice(0, 10);
  const collectionId = chooseCollectionId(record);
  const sourceType = chooseSourceType(record);
  const resourceType = chooseResourceType(record, collectionId);
  const evidenceRole = chooseEvidenceRole(record, collectionId);
  const year = extractYear(record);
  const sourceId = clean(record.source_id);
  const url = clean(record.url);
  const title = clean(record.title) || sourceId;
  const topics = unique([
    ...arrayValue(record.topic_tags),
    ...arrayValue(record.collection_hints),
    record.collection_hint
  ]);
  const publisher = clean(firstValue(record.publisher, record.publisher_seen?.[0], record.organization_id)) || "Unknown";
  const contentHashInput = JSON.stringify({
    source_id: sourceId,
    title,
    url,
    normalized_url: record.normalized_url || null,
    source_type: sourceType,
    collection_id: collectionId
  });

  return {
    schemaVersion: "knowledge-doc-v1",
    metadata_schema_version: "v2.5",
    docId: sourceId,
    document_id: sourceId,
    source_id: sourceId,
    canonical_source_id: sourceId,
    title,
    description: buildDescription(record),
    publisher,
    source_organization: publisher,
    organization_id: clean(record.organization_id) || null,
    year,
    publication_date: year ? null : null,
    checked_at: checkedAt,
    last_checked: checkedAt,
    retrieved_at: null,
    language: clean(record.language) || "et",
    document_kind: chooseDocumentKind(sourceType, collectionId),
    resource_type: resourceType,
    source_type: sourceType,
    source_origin_type: "source_master_pdf",
    source_format: "pdf",
    collection_id: collectionId,
    jurisdiction_level: "NATIONAL",
    country: "EE",
    audience: normalizeAudience(record),
    audiences: normalizeAudience(record) === "BOTH" ? ["SOCIAL_WORKER", "CLIENT"] : [normalizeAudience(record)],
    evidence_role: evidenceRole,
    allowed_claim_types: unique([
      ...DEFAULT_ALLOWED_GUIDANCE_CLAIMS,
      "research_evidence",
      "policy_context",
      "background"
    ]),
    disallowed_claim_types: DISALLOWED_CURRENT_EVIDENCE_CLAIMS,
    topics,
    target_groups: [],
    source_url: url,
    url,
    url_canonical: clean(record.normalized_url) || url,
    source_path: null,
    source_status: sourceStatusFromRecord(record),
    historical: false,
    evidence_allowed: true,
    legal_basis: false,
    copyright_status: "restricted_citation_summary_only",
    display_full_text: false,
    allow_excerpts: "short_only",
    user_facing_knowledge: true,
    content_hash: stableHash(contentHashInput),
    source_master: {
      registry_schema_version: clean(record.registry_schema_version) || "source-master-v1",
      registry_role: clean(record.registry_role) || "dedupe_seed_and_ingest_planning",
      source_master_file: options.sourceMasterFile || null,
      ingest_priority: clean(record.ingest_priority) || null,
      ingest_status: clean(record.ingest_status) || null,
      recommended_pipeline: clean(record.recommended_pipeline) || null,
      link_check_status: unique(record.link_check_status),
      dedupe_key: clean(record.dedupe_key) || null,
      duplicate_group_id: clean(record.duplicate_group_id) || null,
      duplicate_count: Number(record.duplicate_count) || 0
    },
    quality: {
      metadata_complete: true,
      section_index_complete: false,
      needs_manual_review: normalizeLinkStatus(record).some(value => ["review", "redirect", "search-confirmed"].includes(value))
    },
    sectionIndex: []
  };
}

export async function loadSourceMasterRecords(filePath = DEFAULT_SOURCE_MASTER_PATH) {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Source master JSON must be an array.");
  return parsed;
}

export function buildSourceMasterPdfPlan(records = [], options = {}) {
  const candidates = records.filter(record => isSourceMasterPdfKnowledgeCandidate(record, options));
  const limited = Number(options.limit) > 0 ? candidates.slice(0, Number(options.limit)) : candidates;
  const items = limited.map(record => {
    const metadata = buildKnowledgeMetadataFromSourceMasterRecord(record, options);
    const validation = validateKnowledgeMetadata(metadata);
    const warnings = validation.warnings.filter(warning => warning !== "sectionIndex is empty");
    const linkStatuses = normalizeLinkStatus(record);
    if (linkStatuses.some(value => ["review", "redirect", "search-confirmed"].includes(value))) {
      warnings.push(`link_check_status needs attention: ${unique(record.link_check_status).join(", ") || "unknown"}`);
    }
    warnings.push(...collectEncodingWarnings(record, metadata));
    return {
      source_id: record.source_id,
      title: record.title,
      url: record.url,
      ingest_priority: record.ingest_priority || null,
      link_check_status: unique(record.link_check_status),
      metadata,
      validation: {
        ok: validation.ok,
        errors: validation.errors,
        warnings
      }
    };
  });

  const byPriority = {};
  const byCollection = {};
  for (const item of items) {
    const priority = item.ingest_priority || "unknown";
    const collection = item.metadata.collection_id || "unknown";
    byPriority[priority] = (byPriority[priority] || 0) + 1;
    byCollection[collection] = (byCollection[collection] || 0) + 1;
  }

  return {
    ok: items.every(item => item.validation.ok),
    source_count: records.length,
    pdf_candidate_count: candidates.length,
    planned_count: items.length,
    by_priority: byPriority,
    by_collection: byCollection,
    invalid_count: items.filter(item => !item.validation.ok).length,
    warning_count: items.filter(item => item.validation.warnings.length).length,
    items
  };
}
