import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import {
  canonicalizeNetworkUrl,
  canonicalizeSourceUrlPair,
  normalizeRegistryIdentityUrl,
  URL_CANONICAL_CONTRACTS
} from "./url-canonical.mjs";

export const STATE_SCHEMA_VERSION = "master-sources-state-v1";
export const REPORT_SCHEMA_VERSION = "master-sources-inventory-report-v1";

export const MATCH_STATUSES = Object.freeze([
  "covered_ok",
  "covered_by_other_pipeline",
  "needs_content_check",
  "needs_adoption",
  "incomplete",
  "stale_match",
  "redirected",
  "duplicate_content",
  "missing",
  "invalid_url"
]);

const SUMMARY_FIELDS = Object.freeze([
  "registry_entries",
  "rag_documents",
  "url_matches",
  "alternative_url_matches",
  "proven_same_rag_document",
  "needs_adoption",
  "incomplete_or_unknown_freshness",
  "unknown_freshness_evidence",
  "missing",
  "proven_ready"
]);

const STATE_FIELDS = Object.freeze([
  "state_schema_version",
  "registry_sha256",
  "updated_at",
  "inventory_input",
  "registry_entry_count",
  "url_contracts",
  "status_counts",
  "summary",
  "anomaly_counts",
  "limitations",
  "sources"
]);

const OTHER_PIPELINE_COLLECTIONS = new Set([
  "kov_legal",
  "kov_regulations",
  "kov_services",
  "organizations",
  "sotsiaaltoo_articles"
]);

const OTHER_PIPELINE_SOURCE_TYPES = new Set([
  "journal_article",
  "kov_regulation",
  "kov_service_info",
  "municipality_kov",
  "municipality_web",
  "organization_profile"
]);

const FRESHNESS_MAX_AGE_DAYS = Object.freeze({
  information_material: 730,
  official_guideline: 365,
  organization_profile: 365,
  policy_analysis: 365,
  research_report: 730,
  web_page: 365
});

const REQUIRED_RAG_METADATA = Object.freeze([
  "source_id",
  "document_id",
  "title",
  "source_type",
  "authority",
  "language",
  "audience",
  "last_checked",
  "historical",
  "source_status"
]);

const LIMITATIONS = Object.freeze([
  "P8.0 does not fetch source websites, so URL matches cannot prove current source completeness.",
  "P8.0 does not ingest, patch or delete RAG documents.",
  "A missing or stale last_checked value prevents a ready/covered_ok conclusion.",
  "content_hash is reported as evidence only; legacy master PDF hashes may be identity hashes rather than content hashes.",
  "P8.0 deliberately keeps covered_ok at zero because it has no independently verified content-completeness evidence."
]);

export class InventoryError extends Error {
  constructor(code, message, exitCode = 2) {
    super(message);
    this.name = "InventoryError";
    this.code = code;
    this.exitCode = exitCode;
  }
}

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clean(value, maxLength = 2000) {
  if (value === undefined || value === null) return null;
  const text = String(value).replace(/\s+/gu, " ").trim();
  return text ? text.slice(0, maxLength) : null;
}

function firstValue(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && !value.trim()) continue;
    return value;
  }
  return null;
}

function firstClean(...values) {
  return clean(firstValue(...values));
}

function parseObject(value) {
  if (isObject(value)) return value;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return isObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function booleanOrNull(value) {
  if (value === true || value === false) return value;
  if (typeof value === "string") {
    if (value.trim().toLowerCase() === "true") return true;
    if (value.trim().toLowerCase() === "false") return false;
  }
  return null;
}

function nonNegativeNumberOrNull(value) {
  if (Array.isArray(value)) return value.length;
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function normalizeDate(value) {
  const text = clean(value, 80);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function uniqueSorted(values) {
  return [...new Set(values.filter(value => value !== undefined && value !== null && value !== ""))]
    .sort((left, right) => String(left).localeCompare(String(right), "en"));
}

function hasExactKeys(value, expectedKeys) {
  if (!isObject(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isStringArray(value) {
  return Array.isArray(value) && value.every(item => typeof item === "string");
}

function normalizeTitle(value) {
  return String(value || "")
    .toLocaleLowerCase("et")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function inputIdentifier(filePath, bytes, parsed) {
  return {
    type: "rag_dump",
    identifier: {
      file_name: path.basename(filePath),
      sha256: sha256(bytes),
      generated_at: normalizeDate(parsed?.generated_at || parsed?.generatedAt)
    }
  };
}

function extractDocumentArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (!isObject(payload)) return null;
  for (const key of ["documents", "items", "data", "results", "records", "sources"]) {
    if (Array.isArray(payload[key])) return payload[key];
  }

  const metadataKeys = new Set([
    "generated_at",
    "generatedAt",
    "registry_sha256",
    "schema_version",
    "total"
  ]);
  const entries = Object.entries(payload).filter(([key, value]) => !metadataKeys.has(key) && isObject(value));
  if (!entries.length) return null;
  return entries.map(([documentId, value]) => ({ document_id: documentId, ...value }));
}

function documentIdOf(root, metadata) {
  return firstClean(
    root.document_id,
    root.documentId,
    root.doc_id,
    root.docId,
    root.id,
    metadata.document_id,
    metadata.documentId,
    metadata.doc_id,
    metadata.docId,
    metadata.id
  );
}

function sourceMasterSubset(value) {
  const sourceMaster = parseObject(value);
  const subset = {
    source_id: firstClean(sourceMaster.source_id, sourceMaster.sourceId),
    source_master_file: firstClean(sourceMaster.source_master_file, sourceMaster.sourceMasterFile),
    registry_role: firstClean(sourceMaster.registry_role, sourceMaster.registryRole),
    dedupe_key: firstClean(sourceMaster.dedupe_key, sourceMaster.dedupeKey),
    recommended_pipeline: firstClean(sourceMaster.recommended_pipeline, sourceMaster.recommendedPipeline),
    collected_by: firstClean(sourceMaster.collected_by, sourceMaster.collectedBy)
  };
  return Object.fromEntries(Object.entries(subset).filter(([, item]) => item != null));
}

function arrayStrings(...values) {
  const out = [];
  for (const value of values) {
    if (Array.isArray(value)) out.push(...value.map(item => clean(item)).filter(Boolean));
    else if (value != null && value !== "") out.push(clean(value));
  }
  return uniqueSorted(out.filter(Boolean));
}

function collectUrlFields(root, metadata, sourceMaster) {
  const primary = [
    ["url_canonical", firstValue(root.url_canonical, root.urlCanonical, metadata.url_canonical, metadata.urlCanonical)],
    ["source_url", firstValue(root.source_url, root.sourceUrl, metadata.source_url, metadata.sourceUrl)],
    ["url", firstValue(root.url, metadata.url)]
  ];
  const alternative = [
    ["final_url", firstValue(root.final_url, root.finalUrl, metadata.final_url, metadata.finalUrl)],
    ["web_final_url", firstValue(root.web_final_url, root.webFinalUrl, metadata.web_final_url, metadata.webFinalUrl)],
    ["redirect_url", firstValue(root.redirect_url, root.redirectUrl, metadata.redirect_url, metadata.redirectUrl)],
    ["resolved_url", firstValue(root.resolved_url, root.resolvedUrl, metadata.resolved_url, metadata.resolvedUrl)],
    ["original_url", firstValue(root.original_url, root.originalUrl, metadata.original_url, metadata.originalUrl)]
  ];

  const rows = [];
  for (const [field, rawValue] of [...primary, ...alternative]) {
    const value = clean(rawValue, 8000);
    if (value) rows.push({ field, kind: primary.some(([name]) => name === field) ? "primary" : "alternative", value });
  }
  for (const value of arrayStrings(
    root.source_urls,
    root.sourceUrls,
    metadata.source_urls,
    metadata.sourceUrls,
    root.alternative_urls,
    root.alternativeUrls,
    metadata.alternative_urls,
    metadata.alternativeUrls,
    sourceMaster.alternative_urls,
    sourceMaster.alternativeUrls
  )) {
    rows.push({ field: "alternative_urls", kind: "alternative", value });
  }
  return rows;
}

function normalizeDocumentUrl(row) {
  const network = canonicalizeNetworkUrl(row.value);
  const registry = normalizeRegistryIdentityUrl(row.value);
  return {
    field: row.field,
    kind: row.kind,
    valid: network.ok || registry.ok,
    network_canonical_url: network.ok ? network.canonical_url : null,
    network_comparison_key: network.ok ? network.comparison_key : null,
    registry_identity_url: registry.ok ? registry.identity_key : null,
    error_codes: uniqueSorted([
      network.ok ? null : network.error.code,
      registry.ok ? null : registry.error.code
    ]),
    anomaly_codes: uniqueSorted([
      ...(network.ok ? network.anomalies.map(item => item.code) : []),
      ...(registry.ok ? registry.anomalies.map(item => item.code) : [])
    ])
  };
}

function sourceIdentityKeys(document) {
  const raw = [
    document.source_id,
    document.canonical_source_id,
    document.source_master.source_id,
    document.document_id
  ].filter(Boolean);
  const keys = [];
  for (const value of raw) {
    const text = String(value).trim();
    keys.push(text);
    const withoutPrefix = text.replace(/^master:/u, "").replace(/:v\d+$/u, "");
    keys.push(withoutPrefix);
  }
  return uniqueSorted(keys);
}

export function normalizeRagDocument(record, index = 0) {
  if (!isObject(record)) {
    throw new InventoryError("rag_dump_invalid_document", `RAG dump document at index ${index} is not an object`, 2);
  }
  const metadata = parseObject(record.metadata);
  const documentId = documentIdOf(record, metadata);
  if (!documentId) {
    throw new InventoryError("rag_dump_missing_document_id", `RAG dump document at index ${index} has no document_id/doc_id`, 2);
  }
  const sourceMasterRaw = firstValue(record.source_master, record.sourceMaster, metadata.source_master, metadata.sourceMaster);
  const sourceMasterFull = parseObject(sourceMasterRaw);
  const sourceMaster = sourceMasterSubset(sourceMasterRaw);
  const urls = collectUrlFields(record, metadata, sourceMasterFull).map(normalizeDocumentUrl);
  const sourceId = firstClean(record.source_id, record.sourceId, metadata.source_id, metadata.sourceId);
  const canonicalSourceId = firstClean(
    record.canonical_source_id,
    record.canonicalSourceId,
    metadata.canonical_source_id,
    metadata.canonicalSourceId
  );
  const document = {
    document_id: documentId,
    source_id: sourceId,
    canonical_source_id: canonicalSourceId,
    title: firstClean(record.title, metadata.title, record.fileName, metadata.fileName) || "(untitled)",
    source_type: firstClean(record.source_type, record.sourceType, metadata.source_type, metadata.sourceType, record.type),
    collection_id: firstClean(record.collection_id, record.collectionId, metadata.collection_id, metadata.collectionId),
    authority: firstClean(record.authority, metadata.authority, record.publisher, metadata.publisher),
    language: firstClean(record.language, metadata.language),
    audience: firstValue(record.audience, metadata.audience),
    source_register_file: firstClean(
      record.source_register_file,
      record.sourceRegisterFile,
      metadata.source_register_file,
      metadata.sourceRegisterFile,
      sourceMaster.source_master_file
    ),
    source_master: sourceMaster,
    content_hash: firstClean(record.content_hash, record.contentHash, metadata.content_hash, metadata.contentHash),
    chunks: nonNegativeNumberOrNull(firstValue(record.chunks, record.chunk_count, record.chunkCount, metadata.chunks, metadata.chunk_count)),
    historical: booleanOrNull(firstValue(record.historical, metadata.historical)),
    source_status: firstClean(record.source_status, record.sourceStatus, metadata.source_status, metadata.sourceStatus, record.status),
    is_current_version: booleanOrNull(firstValue(record.is_current_version, record.isCurrentVersion, metadata.is_current_version, metadata.isCurrentVersion)),
    active: booleanOrNull(firstValue(record.active, metadata.active)),
    last_checked: normalizeDate(firstValue(record.last_checked, record.lastChecked, metadata.last_checked, metadata.lastChecked, record.checked_at, metadata.checked_at)),
    last_ingested: normalizeDate(firstValue(record.lastIngested, record.last_ingested, record.ingested_at, metadata.lastIngested, metadata.last_ingested)),
    urls
  };
  document.identity_keys = sourceIdentityKeys(document);
  return document;
}

function assertUniqueDocumentIds(documents, errorCode) {
  const seen = new Set();
  for (const document of documents) {
    if (seen.has(document.document_id)) {
      throw new InventoryError(errorCode, `Duplicate RAG document_id: ${document.document_id}`, 2);
    }
    seen.add(document.document_id);
  }
}

export async function loadRegistry(registryPath) {
  let bytes;
  try {
    bytes = await fs.readFile(registryPath);
  } catch (error) {
    throw new InventoryError("registry_read_failed", `Cannot read registry: ${error?.code || "read_failed"}`, 3);
  }
  let records;
  try {
    records = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new InventoryError("registry_invalid_json", "Registry is not valid JSON", 3);
  }
  if (!Array.isArray(records) || records.length === 0) {
    throw new InventoryError("registry_invalid_shape", "Registry must be a non-empty JSON array", 3);
  }
  const sourceIds = new Set();
  records.forEach((record, index) => {
    if (!isObject(record)) throw new InventoryError("registry_invalid_record", `Registry record ${index} is not an object`, 3);
    const sourceId = clean(record.source_id);
    if (!sourceId) throw new InventoryError("registry_missing_source_id", `Registry record ${index} has no source_id`, 3);
    if (sourceIds.has(sourceId)) throw new InventoryError("registry_duplicate_source_id", `Duplicate registry source_id: ${sourceId}`, 3);
    sourceIds.add(sourceId);
    if (!clean(record.url) || !clean(record.normalized_url)) {
      throw new InventoryError("registry_missing_url", `Registry record ${sourceId} lacks url or normalized_url`, 3);
    }
  });
  return {
    path: registryPath,
    sha256: sha256(bytes),
    bytes,
    records
  };
}

export async function loadRagDump(dumpPath, { registrySha256 = null } = {}) {
  let bytes;
  try {
    bytes = await fs.readFile(dumpPath);
  } catch (error) {
    throw new InventoryError("rag_dump_read_failed", `Cannot read RAG dump: ${error?.code || "read_failed"}`, 2);
  }
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new InventoryError("rag_dump_invalid_json", "RAG dump is not valid JSON", 2);
  }
  const declaredRegistryHash = clean(parsed?.registry_sha256, 128);
  if (declaredRegistryHash && registrySha256 && declaredRegistryHash !== registrySha256) {
    throw new InventoryError("rag_dump_registry_hash_mismatch", "RAG dump registry_sha256 does not match the current registry", 3);
  }
  const records = extractDocumentArray(parsed);
  if (!Array.isArray(records) || records.length === 0) {
    throw new InventoryError("rag_dump_empty", "RAG dump contains no documents", 2);
  }
  const documents = records.map((record, index) => normalizeRagDocument(record, index));
  assertUniqueDocumentIds(documents, "rag_dump_duplicate_document_id");
  return {
    documents,
    input: {
      ...inputIdentifier(dumpPath, bytes, parsed),
      registry_binding: declaredRegistryHash ? "matched" : "not_provided",
      document_count: documents.length
    }
  };
}

function normalizeServiceBaseUrl(baseUrl) {
  const raw = String(baseUrl || "").trim();
  const withScheme = /^https?:\/\//iu.test(raw) ? raw : `http://${raw}`;
  let parsed;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new InventoryError("rag_service_invalid_url", "RAG service base URL is invalid", 4);
  }
  if (!new Set(["http:", "https:"]).has(parsed.protocol) || parsed.username || parsed.password) {
    throw new InventoryError("rag_service_forbidden_url", "RAG service URL must be non-credentialed http(s)", 4);
  }
  parsed.search = "";
  parsed.hash = "";
  parsed.pathname = parsed.pathname.replace(/\/+$/u, "");
  return parsed.toString().replace(/\/$/u, "");
}

function parseDocumentsResponse(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ["documents", "items", "data", "results"]) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return null;
}

export async function fetchRagDocuments({
  baseUrl,
  apiKey,
  pageSize = 100,
  maxDocuments = 10000,
  fetchImpl = fetch
} = {}) {
  const normalizedBaseUrl = normalizeServiceBaseUrl(baseUrl || process.env.RAG_INTERNAL_HOST || process.env.RAG_API_BASE || "127.0.0.1:8000");
  const secret = clean(apiKey || process.env.RAG_SERVICE_API_KEY || process.env.RAG_API_KEY, 10000);
  if (!secret) throw new InventoryError("rag_service_api_key_missing", "RAG service API key is required in the environment", 4);
  const safePageSize = Math.max(1, Math.min(100, Number(pageSize) || 100));
  const safeMax = Math.max(1, Math.min(100000, Number(maxDocuments) || 10000));
  const rawDocuments = [];

  for (let offset = 0; rawDocuments.length < safeMax; offset += safePageSize) {
    const url = new URL("/documents", `${normalizedBaseUrl}/`);
    url.searchParams.set("limit", String(Math.min(safePageSize, safeMax - rawDocuments.length)));
    url.searchParams.set("offset", String(offset));
    let response;
    try {
      response = await fetchImpl(url, { method: "GET", headers: { "X-API-Key": secret } });
    } catch {
      throw new InventoryError("rag_service_request_failed", "Read-only GET /documents request failed", 4);
    }
    if (!response.ok) {
      throw new InventoryError("rag_service_http_error", `Read-only GET /documents returned HTTP ${response.status}`, 4);
    }
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new InventoryError("rag_service_invalid_json", "Read-only GET /documents returned invalid JSON", 4);
    }
    const page = parseDocumentsResponse(payload);
    if (!page) throw new InventoryError("rag_service_invalid_shape", "Read-only GET /documents returned an unsupported shape", 4);
    rawDocuments.push(...page);
    if (page.length < safePageSize) break;
  }
  if (!rawDocuments.length) throw new InventoryError("rag_service_empty", "Read-only GET /documents returned no documents", 4);
  const documents = rawDocuments.slice(0, safeMax).map((record, index) => normalizeRagDocument(record, index));
  assertUniqueDocumentIds(documents, "rag_service_duplicate_document_id");
  return {
    documents,
    input: {
      type: "rag_service_read_only",
      identifier: { base_url: normalizedBaseUrl },
      registry_binding: "not_provided",
      document_count: documents.length
    }
  };
}

function addToIndex(map, key, document) {
  if (!key) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(document);
}

function buildDocumentIndexes(documents) {
  const byNetwork = new Map();
  const byRegistry = new Map();
  const byIdentity = new Map();
  const byTitle = new Map();
  for (const document of documents) {
    for (const url of document.urls) {
      addToIndex(byNetwork, url.network_comparison_key, document);
      addToIndex(byRegistry, url.registry_identity_url, document);
    }
    for (const key of document.identity_keys) addToIndex(byIdentity, key, document);
    addToIndex(byTitle, normalizeTitle(document.title), document);
  }
  return { byNetwork, byRegistry, byIdentity, byTitle };
}

function urlMatchDetails(document, networkKey, registryKey) {
  const details = [];
  for (const url of document.urls) {
    if (networkKey && url.network_comparison_key === networkKey) {
      details.push({ matched_by: url.kind === "primary" ? "network_url" : "alternative_network_url", field: url.field, kind: url.kind });
    }
    if (registryKey && url.registry_identity_url === registryKey) {
      details.push({ matched_by: url.kind === "primary" ? "registry_identity_url" : "alternative_registry_identity_url", field: url.field, kind: url.kind });
    }
  }
  return details;
}

function documentOwnsSource(document, sourceId) {
  return document.identity_keys.includes(sourceId);
}

function isOtherPipelineDocument(document) {
  const docId = document.document_id || "";
  return OTHER_PIPELINE_COLLECTIONS.has(document.collection_id) ||
    OTHER_PIPELINE_SOURCE_TYPES.has(document.source_type) ||
    /^(?:kov-|kov::|organization-|org:|ajakiri[:_-])/u.test(docId);
}

function missingMetadata(document) {
  const values = {
    source_id: document.source_id || document.canonical_source_id || document.source_master.source_id,
    document_id: document.document_id,
    title: document.title === "(untitled)" ? null : document.title,
    source_type: document.source_type,
    authority: document.authority,
    language: document.language,
    audience: document.audience,
    last_checked: document.last_checked,
    historical: document.historical,
    source_status: document.source_status
  };
  return REQUIRED_RAG_METADATA.filter(field => values[field] === null || values[field] === undefined || values[field] === "");
}

function freshnessEvidence(document, now) {
  const sourceStatus = String(document.source_status || "").toLowerCase();
  if (["stale", "inactive", "archived"].includes(sourceStatus)) {
    return { status: "stale", reason: `source_status_${sourceStatus}`, checked_at: document.last_checked, age_days: null, max_age_days: null };
  }
  if (document.historical === true || document.is_current_version === false || document.active === false) {
    return { status: "stale", reason: "inactive_or_historical_version", checked_at: document.last_checked, age_days: null, max_age_days: null };
  }
  if (!document.last_checked) {
    return { status: "unknown", reason: "missing_last_checked", checked_at: null, age_days: null, max_age_days: FRESHNESS_MAX_AGE_DAYS[document.source_type] ?? null };
  }
  const checked = new Date(document.last_checked);
  const ageDays = Math.floor((now.getTime() - checked.getTime()) / 86400000);
  const maxAgeDays = FRESHNESS_MAX_AGE_DAYS[document.source_type] ?? null;
  if (ageDays < 0) return { status: "unknown", reason: "last_checked_in_future", checked_at: document.last_checked, age_days: ageDays, max_age_days: maxAgeDays };
  if (maxAgeDays != null && ageDays > maxAgeDays) {
    return { status: "stale", reason: "last_checked_stale", checked_at: document.last_checked, age_days: ageDays, max_age_days: maxAgeDays };
  }
  if (maxAgeDays == null) {
    return { status: "unknown", reason: "no_type_freshness_policy", checked_at: document.last_checked, age_days: ageDays, max_age_days: null };
  }
  return { status: "fresh_by_metadata", reason: "last_checked_within_policy", checked_at: document.last_checked, age_days: ageDays, max_age_days: maxAgeDays };
}

function safeDocumentEvidence(document, matchDetails, now) {
  return {
    document_id: document.document_id,
    source_id: document.source_id,
    canonical_source_id: document.canonical_source_id,
    title: document.title,
    source_type: document.source_type,
    collection_id: document.collection_id,
    source_register_file: document.source_register_file,
    source_master: document.source_master,
    content_hash: document.content_hash,
    chunks: document.chunks,
    historical: document.historical,
    source_status: document.source_status,
    is_current_version: document.is_current_version,
    active: document.active,
    last_checked: document.last_checked,
    last_ingested: document.last_ingested,
    missing_metadata: missingMetadata(document),
    freshness: freshnessEvidence(document, now),
    url_matches: matchDetails
  };
}

function candidateScore(candidate) {
  let score = 0;
  if (candidate.sourceIdentityMatch) score += 100;
  if (candidate.details.some(item => item.matched_by === "network_url")) score += 80;
  if (candidate.details.some(item => item.matched_by === "alternative_network_url")) score += 70;
  if (candidate.details.some(item => item.matched_by === "registry_identity_url")) score += 60;
  if (candidate.details.some(item => item.matched_by === "alternative_registry_identity_url")) score += 50;
  if ((candidate.document.chunks ?? 0) > 0) score += 10;
  return score;
}

function classifySource({ candidates, selected, sourceId, now }) {
  if (!selected) return "missing";
  const selectedEvidence = safeDocumentEvidence(selected.document, selected.details, now);
  const exactDocuments = candidates.filter(candidate => candidate.details.length > 0);
  const hashes = new Map();
  for (const candidate of exactDocuments) {
    const hash = candidate.document.content_hash;
    if (!hash) continue;
    if (!hashes.has(hash)) hashes.set(hash, new Set());
    hashes.get(hash).add(candidate.document.document_id);
  }
  if ([...hashes.values()].some(ids => ids.size > 1)) return "duplicate_content";
  if (selected.details.some(item => item.kind === "alternative") && !selected.details.some(item => item.kind === "primary")) return "redirected";
  if (selected.document.chunks === 0) return "incomplete";

  const owned = documentOwnsSource(selected.document, sourceId);
  const otherPipeline = isOtherPipelineDocument(selected.document);
  if (!owned && !otherPipeline) return "needs_adoption";
  if (owned && selectedEvidence.missing_metadata.some(field => field !== "last_checked")) return "needs_adoption";
  if (selectedEvidence.freshness.status === "stale" || selectedEvidence.freshness.status === "unknown") return "stale_match";
  if (otherPipeline) return "covered_by_other_pipeline";

  // P8.0 has no fresh web fetch and therefore cannot prove content completeness.
  return "needs_content_check";
}

function sourceAnomalyCodes(contract, candidates, status) {
  const codes = [
    ...contract.anomalies.map(item => item.code),
    ...(contract.registry.ok ? contract.registry.anomalies.map(item => item.code) : []),
    ...(contract.network.ok ? contract.network.anomalies.map(item => item.code) : [])
  ];
  if (!contract.registry.ok) codes.push(contract.registry.error.code);
  if (!contract.network.ok) codes.push(contract.network.error.code);
  if (candidates.length > 1) codes.push("multiple_rag_matches");
  if (status === "duplicate_content") codes.push("duplicate_rag_documents_same_content_hash");
  if (status === "needs_adoption") codes.push("rag_match_missing_source_master_identity");
  if (status === "stale_match") codes.push("rag_match_freshness_not_proven");
  return uniqueSorted(codes);
}

function titleHints(record, indexes, excludedIds) {
  const titleKey = normalizeTitle(record.title);
  if (!titleKey) return [];
  return (indexes.byTitle.get(titleKey) || [])
    .filter(document => !excludedIds.has(document.document_id))
    .slice(0, 3)
    .map(document => ({ document_id: document.document_id, reason: "exact_normalized_title" }));
}

function countAnomalies(sources) {
  const counts = {};
  for (const source of Object.values(sources)) {
    for (const code of source.anomalies) counts[code] = (counts[code] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right, "en")));
}

export function buildInventory({ registryRecords, registrySha256, documents, input, now = new Date() }) {
  if (!Array.isArray(registryRecords) || !registryRecords.length) {
    throw new InventoryError("inventory_registry_empty", "Cannot inventory an empty registry", 3);
  }
  if (!Array.isArray(documents) || !documents.length) {
    throw new InventoryError("inventory_rag_empty", "Cannot inventory an empty RAG document list", 2);
  }
  const timestamp = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date(now);
  if (Number.isNaN(timestamp.getTime())) throw new InventoryError("inventory_invalid_time", "Inventory time is invalid", 2);
  const indexes = buildDocumentIndexes(documents);
  const sources = {};
  const statusCounts = Object.fromEntries(MATCH_STATUSES.map(status => [status, 0]));

  for (const record of registryRecords) {
    const sourceId = clean(record.source_id);
    const expectedIdentity = clean(record.normalized_url, 8000);
    const contract = canonicalizeSourceUrlPair(String(record.url), expectedIdentity);
    if (!contract.registry.ok || !contract.network.ok) {
      const status = "invalid_url";
      statusCounts[status] += 1;
      sources[sourceId] = {
        source_id: sourceId,
        match_status: status,
        registry_identity_url: contract.registry.ok ? contract.registry.identity_key : null,
        network_canonical_url: contract.network.ok ? contract.network.canonical_url : null,
        network_comparison_key: contract.network.ok ? contract.network.comparison_key : null,
        anomalies: sourceAnomalyCodes(contract, [], status),
        evidence: {
          matched_by: [],
          matched_document_ids: [],
          url_match: false,
          source_identity_match: false,
          title_hints: [],
          documents: []
        }
      };
      continue;
    }

    const candidateMap = new Map();
    const addCandidate = document => {
      if (!candidateMap.has(document.document_id)) {
        candidateMap.set(document.document_id, {
          document,
          details: [],
          sourceIdentityMatch: false
        });
      }
      return candidateMap.get(document.document_id);
    };
    for (const document of indexes.byNetwork.get(contract.network.comparison_key) || []) addCandidate(document);
    for (const document of indexes.byRegistry.get(expectedIdentity) || []) addCandidate(document);
    for (const document of indexes.byIdentity.get(sourceId) || []) {
      const candidate = addCandidate(document);
      candidate.sourceIdentityMatch = true;
    }

    const candidates = [...candidateMap.values()];
    for (const candidate of candidates) {
      candidate.details = urlMatchDetails(candidate.document, contract.network.comparison_key, expectedIdentity);
      candidate.sourceIdentityMatch = candidate.sourceIdentityMatch || documentOwnsSource(candidate.document, sourceId);
    }
    candidates.sort((left, right) => candidateScore(right) - candidateScore(left) || left.document.document_id.localeCompare(right.document.document_id, "en"));
    const selected = candidates[0] || null;
    const status = classifySource({ candidates, selected, sourceId, now: timestamp });
    statusCounts[status] += 1;
    const matchedBy = uniqueSorted(candidates.flatMap(candidate => [
      ...candidate.details.map(item => item.matched_by),
      candidate.sourceIdentityMatch ? "source_identity" : null
    ]));
    const matchedDocumentIds = candidates.map(candidate => candidate.document.document_id).sort((left, right) => left.localeCompare(right, "en"));
    const excludedIds = new Set(matchedDocumentIds);

    sources[sourceId] = {
      source_id: sourceId,
      match_status: status,
      registry_identity_url: contract.registry.identity_key,
      network_canonical_url: contract.network.canonical_url,
      network_comparison_key: contract.network.comparison_key,
      anomalies: sourceAnomalyCodes(contract, candidates, status),
      evidence: {
        matched_by: matchedBy,
        matched_document_ids: matchedDocumentIds,
        selected_document_id: selected?.document.document_id || null,
        url_match: candidates.some(candidate => candidate.details.length > 0),
        alternative_url_match: candidates.some(candidate => candidate.details.some(item => item.kind === "alternative")),
        source_identity_match: candidates.some(candidate => candidate.sourceIdentityMatch),
        title_hints: titleHints(record, indexes, excludedIds),
        documents: candidates.map(candidate => safeDocumentEvidence(candidate.document, candidate.details, timestamp))
      }
    };
  }

  const sourceValues = Object.values(sources);
  const unknownFreshnessCount = sourceValues.filter(source => source.evidence.documents.some(document => document.freshness.status !== "fresh_by_metadata")).length;
  const summary = {
    registry_entries: registryRecords.length,
    rag_documents: documents.length,
    url_matches: sourceValues.filter(source => source.evidence.url_match).length,
    alternative_url_matches: sourceValues.filter(source => source.evidence.alternative_url_match).length,
    proven_same_rag_document: sourceValues.filter(source => source.evidence.source_identity_match).length,
    needs_adoption: statusCounts.needs_adoption,
    incomplete_or_unknown_freshness: sourceValues.filter(source => ["incomplete", "stale_match", "needs_content_check"].includes(source.match_status)).length,
    unknown_freshness_evidence: unknownFreshnessCount,
    missing: statusCounts.missing,
    proven_ready: statusCounts.covered_ok
  };

  return {
    state_schema_version: STATE_SCHEMA_VERSION,
    registry_sha256: registrySha256,
    updated_at: timestamp.toISOString(),
    inventory_input: input,
    registry_entry_count: registryRecords.length,
    url_contracts: URL_CANONICAL_CONTRACTS,
    status_counts: statusCounts,
    summary,
    anomaly_counts: countAnomalies(sources),
    limitations: [...LIMITATIONS],
    sources
  };
}

export function validateStatePayload(state, { expectedRegistrySha256 = null } = {}) {
  if (!isObject(state)) throw new InventoryError("state_invalid_shape", "State file must contain a JSON object", 3);
  if (!hasExactKeys(state, STATE_FIELDS)) {
    throw new InventoryError("state_fields_invalid", "State file fields do not match the v1 contract", 3);
  }
  if (state.state_schema_version !== STATE_SCHEMA_VERSION) {
    throw new InventoryError("state_schema_mismatch", `State schema must be ${STATE_SCHEMA_VERSION}`, 3);
  }
  if (!/^[a-f0-9]{64}$/u.test(String(state.registry_sha256 || ""))) {
    throw new InventoryError("state_registry_hash_invalid", "State registry_sha256 is missing or invalid", 3);
  }
  if (expectedRegistrySha256 && state.registry_sha256 !== expectedRegistrySha256) {
    throw new InventoryError("state_registry_hash_mismatch", "Existing state belongs to a different registry revision", 3);
  }
  if (!normalizeDate(state.updated_at)) throw new InventoryError("state_updated_at_invalid", "State updated_at is invalid", 3);
  if (!Number.isInteger(state.registry_entry_count) || state.registry_entry_count < 1) {
    throw new InventoryError("state_registry_count_invalid", "State registry_entry_count is invalid", 3);
  }
  if (!isObject(state.inventory_input) ||
      !["rag_dump", "rag_service_read_only"].includes(state.inventory_input.type) ||
      !isObject(state.inventory_input.identifier) ||
      !["matched", "not_provided"].includes(state.inventory_input.registry_binding) ||
      !Number.isInteger(state.inventory_input.document_count) ||
      state.inventory_input.document_count < 1) {
    throw new InventoryError("state_inventory_input_invalid", "State inventory_input is invalid", 3);
  }
  if (!hasExactKeys(state.url_contracts, ["registry_identity", "network_url"]) ||
      state.url_contracts.registry_identity !== URL_CANONICAL_CONTRACTS.registry_identity ||
      state.url_contracts.network_url !== URL_CANONICAL_CONTRACTS.network_url) {
    throw new InventoryError("state_url_contracts_invalid", "State URL contracts are invalid", 3);
  }
  if (!isObject(state.status_counts) || !isObject(state.sources) || !hasExactKeys(state.summary, SUMMARY_FIELDS)) {
    throw new InventoryError("state_content_invalid", "State status_counts, summary and sources are required objects", 3);
  }
  for (const field of SUMMARY_FIELDS) {
    if (!Number.isInteger(state.summary[field]) || state.summary[field] < 0) {
      throw new InventoryError("state_summary_invalid", `State summary field is invalid: ${field}`, 3);
    }
  }
  if (state.summary.registry_entries !== state.registry_entry_count ||
      state.summary.rag_documents !== state.inventory_input.document_count ||
      state.summary.needs_adoption !== state.status_counts.needs_adoption ||
      state.summary.missing !== state.status_counts.missing ||
      state.summary.proven_ready !== state.status_counts.covered_ok) {
    throw new InventoryError("state_summary_mismatch", "State summary does not match inventory and status counts", 3);
  }
  if (!isObject(state.anomaly_counts) || Object.entries(state.anomaly_counts).some(([code, count]) => !code || !Number.isInteger(count) || count < 0)) {
    throw new InventoryError("state_anomalies_invalid", "State anomaly_counts is invalid", 3);
  }
  if (!Array.isArray(state.limitations) || state.limitations.length === 0 || state.limitations.some(item => typeof item !== "string" || !item.trim())) {
    throw new InventoryError("state_limitations_invalid", "State limitations is invalid", 3);
  }
  if (Object.keys(state.sources).length !== state.registry_entry_count) {
    throw new InventoryError("state_source_count_mismatch", "State source count does not match registry_entry_count", 3);
  }
  const statusKeys = Object.keys(state.status_counts).sort();
  const expectedStatusKeys = [...MATCH_STATUSES].sort();
  if (statusKeys.length !== expectedStatusKeys.length || statusKeys.some((key, index) => key !== expectedStatusKeys[index])) {
    throw new InventoryError("state_status_keys_invalid", "State status_counts must contain exactly the supported statuses", 3);
  }
  for (const status of MATCH_STATUSES) {
    if (!Number.isInteger(state.status_counts[status]) || state.status_counts[status] < 0) {
      throw new InventoryError("state_status_count_invalid", `State status count is invalid: ${status}`, 3);
    }
  }
  const observedStatusCounts = Object.fromEntries(MATCH_STATUSES.map(status => [status, 0]));
  for (const [sourceId, source] of Object.entries(state.sources)) {
    if (!hasExactKeys(source, [
      "source_id",
      "match_status",
      "registry_identity_url",
      "network_canonical_url",
      "network_comparison_key",
      "anomalies",
      "evidence"
    ]) || source.source_id !== sourceId || !MATCH_STATUSES.includes(source.match_status) ||
      !isStringArray(source.anomalies) || new Set(source.anomalies).size !== source.anomalies.length ||
      !isObject(source.evidence) || !isStringArray(source.evidence.matched_by) ||
      !isStringArray(source.evidence.matched_document_ids) || typeof source.evidence.url_match !== "boolean" ||
      typeof source.evidence.source_identity_match !== "boolean" || !Array.isArray(source.evidence.title_hints) ||
      !Array.isArray(source.evidence.documents)) {
      throw new InventoryError("state_source_invalid", `State source entry is invalid: ${sourceId}`, 3);
    }
    observedStatusCounts[source.match_status] += 1;
  }
  for (const status of MATCH_STATUSES) {
    if (state.status_counts[status] !== observedStatusCounts[status]) {
      throw new InventoryError("state_status_count_mismatch", `State status count does not match sources: ${status}`, 3);
    }
  }
  const total = Object.values(state.status_counts).reduce((sum, value) => sum + value, 0);
  if (total !== state.registry_entry_count) {
    throw new InventoryError("state_status_count_mismatch", "State status counts do not sum to registry_entry_count", 3);
  }
  return true;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function atomicWriteText(filePath, text, { beforeRename = null } = {}) {
  const absolute = path.resolve(filePath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  const temporary = `${absolute}.tmp-${process.pid}-${crypto.randomUUID()}`;
  let handle = null;
  try {
    handle = await fs.open(temporary, "wx");
    await handle.writeFile(text, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    if (beforeRename) await beforeRename({ temporary, target: absolute });
    await fs.rename(temporary, absolute);
  } catch (error) {
    await handle?.close().catch(() => {});
    await fs.unlink(temporary).catch(() => {});
    throw error;
  }
}

export async function writeInventoryStateAtomic(statePath, state, options = {}) {
  validateStatePayload(state, { expectedRegistrySha256: state.registry_sha256 });
  await assertExistingStateCompatible(statePath, state.registry_sha256);
  try {
    await atomicWriteText(statePath, `${JSON.stringify(state, null, 2)}\n`, options);
  } catch (error) {
    if (error instanceof InventoryError) throw error;
    throw new InventoryError("state_atomic_write_failed", `Atomic state write failed: ${error?.code || "write_failed"}`, 5);
  }
}

export async function assertExistingStateCompatible(statePath, registrySha256) {
  if (await fileExists(statePath)) {
    let existing;
    try {
      existing = JSON.parse(await fs.readFile(statePath, "utf8"));
    } catch {
      throw new InventoryError("existing_state_corrupt", "Existing state file is invalid; refusing to overwrite it", 3);
    }
    validateStatePayload(existing, { expectedRegistrySha256: registrySha256 });
  }
}

function reportStamp(updatedAt) {
  return String(updatedAt).replace(/[-:.]/gu, "").replace(/Z$/u, "Z");
}

export function renderMarkdownReport(state) {
  const statusRows = MATCH_STATUSES.map(status => `| \`${status}\` | ${state.status_counts[status] || 0} |`).join("\n");
  const anomalyRows = Object.entries(state.anomaly_counts)
    .map(([code, count]) => `| \`${code}\` | ${count} |`)
    .join("\n") || "| _(puuduvad)_ | 0 |";
  return [
    "# Master-listi P8.0 inventuur",
    "",
    `- Kontrolliaeg: \`${state.updated_at}\``,
    `- Registri SHA-256: \`${state.registry_sha256}\``,
    `- Registrikirjeid: **${state.registry_entry_count}**`,
    `- RAG-dokumente sisendis: **${state.summary.rag_documents}**`,
    `- URL-i järgi kattuvaid kirjeid: **${state.summary.url_matches}**`,
    `- Tõendatud source_id/document_id seoseid: **${state.summary.proven_same_rag_document}**`,
    `- Adopteerimist vajavaid: **${state.summary.needs_adoption}**`,
    `- Puuduliku või tundmatu värskusega: **${state.summary.incomplete_or_unknown_freshness}**`,
    `- Puudu: **${state.summary.missing}**`,
    `- P8.0-s tõendatult valmis: **${state.summary.proven_ready}**`,
    "",
    "## Seisundid",
    "",
    "| Seisund | Arv |",
    "|---|---:|",
    statusRows,
    "",
    "## URL- ja inventuurianomaaliad",
    "",
    "| Anomaalia | Kirjeid |",
    "|---|---:|",
    anomalyRows,
    "",
    "## Mida P8.0 ei tõenda",
    "",
    ...state.limitations.map(item => `- ${item}`),
    ""
  ].join("\n");
}

export async function writeInventoryReports(reportDir, state) {
  const stamp = reportStamp(state.updated_at);
  const jsonPath = path.join(reportDir, `master-sources-inventory-${stamp}.json`);
  const markdownPath = path.join(reportDir, `master-sources-inventory-${stamp}.md`);
  const report = {
    report_schema_version: REPORT_SCHEMA_VERSION,
    read_only: true,
    ...state
  };
  try {
    await atomicWriteText(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
    await atomicWriteText(markdownPath, renderMarkdownReport(state));
  } catch (error) {
    throw new InventoryError("report_write_failed", `Inventory report write failed: ${error?.code || "write_failed"}`, 5);
  }
  return { json: jsonPath, markdown: markdownPath };
}

function displayPath(filePath, cwd = process.cwd()) {
  const relative = path.relative(cwd, filePath).replace(/\\/gu, "/");
  return relative && !relative.startsWith("..") ? relative : path.basename(filePath);
}

export function machineOutput(state, outputs = {}, cwd = process.cwd()) {
  return {
    ok: true,
    read_only: true,
    state_schema_version: state.state_schema_version,
    registry_sha256: state.registry_sha256,
    updated_at: state.updated_at,
    inventory_input: state.inventory_input,
    status_counts: state.status_counts,
    summary: state.summary,
    anomaly_counts: state.anomaly_counts,
    limitations: state.limitations,
    outputs: {
      state: outputs.state ? displayPath(outputs.state, cwd) : null,
      report_json: outputs.json ? displayPath(outputs.json, cwd) : null,
      report_markdown: outputs.markdown ? displayPath(outputs.markdown, cwd) : null
    }
  };
}

export function humanSummary(state, outputs = {}, cwd = process.cwd()) {
  const machine = machineOutput(state, outputs, cwd);
  return [
    `Master-listi P8.0 inventuur: ${state.registry_entry_count} registrikirjet, ${state.summary.rag_documents} RAG-dokumenti`,
    `URL-kattuvusi: ${state.summary.url_matches}`,
    `Tõendatud source_id/document_id seoseid: ${state.summary.proven_same_rag_document}`,
    `Adopteerimist vajab: ${state.summary.needs_adoption}`,
    `Puudulik või tundmatu värskus: ${state.summary.incomplete_or_unknown_freshness}`,
    `Puudub: ${state.summary.missing}`,
    `P8.0-s tõendatult valmis: ${state.summary.proven_ready}`,
    `Seisundifail: ${machine.outputs.state}`,
    `Raport: ${machine.outputs.report_markdown}`,
    "P8.0 ei teinud ühtegi fetch-, ingest-, patch- ega delete-toimingut."
  ].join("\n");
}
