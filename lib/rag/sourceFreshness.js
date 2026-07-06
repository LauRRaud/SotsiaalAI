import {
  normalizeRagSourceMetadata,
  isKnownRagSourceStatus,
  isKnownRagSourceType
} from "./sourceMetadata.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const REQUIRED_METADATA_FIELDS = Object.freeze([
  "source_id",
  "document_id",
  "title",
  "source_type",
  "authority",
  "language",
  "source_status",
  "last_checked"
]);

const RECOMMENDED_METADATA_FIELDS = Object.freeze([
  "url_canonical",
  "content_hash"
]);

const KOV_SCOPED_SOURCE_TYPES = new Set([
  "kov_service_info",
  "kov_regulation",
  "application_form",
  "web_form",
  "pdf_form",
  "official_form",
  "official_contact",
  "contact_page"
]);

export const RAG_SOURCE_FRESHNESS_POLICIES = Object.freeze({
  application_form: { maxAgeDays: 90, priority: "high", currentEvidence: true },
  web_form: { maxAgeDays: 90, priority: "high", currentEvidence: true },
  pdf_form: { maxAgeDays: 90, priority: "high", currentEvidence: true },
  official_form: { maxAgeDays: 90, priority: "high", currentEvidence: true },
  official_contact: { maxAgeDays: 90, priority: "high", currentEvidence: true },
  contact_page: { maxAgeDays: 90, priority: "high", currentEvidence: true },
  kov_service_info: { maxAgeDays: 180, priority: "high", currentEvidence: true },
  partner_service_info: { maxAgeDays: 180, priority: "medium", currentEvidence: true },
  faq: { maxAgeDays: 180, priority: "medium", currentEvidence: true },
  kov_regulation: { maxAgeDays: 365, priority: "high", currentEvidence: true },
  national_law: { maxAgeDays: 365, priority: "high", currentEvidence: true },
  law: { maxAgeDays: 365, priority: "high", currentEvidence: true },
  regulation: { maxAgeDays: 365, priority: "high", currentEvidence: true },
  state_guide: { maxAgeDays: 365, priority: "medium", currentEvidence: true },
  service_standard: { maxAgeDays: 365, priority: "medium", currentEvidence: true },
  quality_guideline: { maxAgeDays: 365, priority: "medium", currentEvidence: true },
  methodology_guide: { maxAgeDays: 730, priority: "low", currentEvidence: false },
  template: { maxAgeDays: 365, priority: "medium", currentEvidence: false },
  journal_article: { maxAgeDays: null, priority: "low", currentEvidence: false },
  practice_example: { maxAgeDays: null, priority: "low", currentEvidence: false },
  project_description: { maxAgeDays: null, priority: "low", currentEvidence: false },
  personal_story: { maxAgeDays: null, priority: "low", currentEvidence: false },
  opinion: { maxAgeDays: null, priority: "low", currentEvidence: false },
  historical_source: { maxAgeDays: null, priority: "low", currentEvidence: false },
  court_decision: { maxAgeDays: 365, priority: "medium", currentEvidence: true }
});

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function parseMetadata(value) {
  if (isObject(value)) return value;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return isObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function firstValue(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && !value.trim()) continue;
    return value;
  }
  return null;
}

function toDateOnly(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;
  const parsed = new Date(`${match[1]}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === match[1] ? match[1] : null;
}

function dayDiff(later, earlierDateOnly) {
  const laterDate = new Date(Date.UTC(later.getUTCFullYear(), later.getUTCMonth(), later.getUTCDate()));
  const earlier = new Date(`${earlierDateOnly}T00:00:00Z`);
  return Math.floor((laterDate.getTime() - earlier.getTime()) / DAY_MS);
}

function normalizeAudience(value) {
  if (Array.isArray(value)) return value.map(item => String(item || "").trim()).filter(Boolean);
  if (value == null || value === "") return [];
  return [String(value).trim()];
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) return value.map(item => String(item || "").trim()).filter(Boolean);
  if (value == null || value === "") return [];
  return [String(value).trim()].filter(Boolean);
}

function normalizeCount(value) {
  if (Array.isArray(value)) return value.length;
  if (value == null || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function firstCount(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    return normalizeCount(value);
  }
  return 0;
}

function lowerIncludes(value, needle) {
  return String(value || "").toLowerCase().includes(needle);
}

function inferCollectionFamily(source = {}) {
  const text = [
    source.collection_id,
    source.legacy_source_type,
    source.source_register_file,
    source.source_path,
    source.document_id,
    source.source_id,
    source.act_reference,
    source.source_type
  ].filter(Boolean).join(" ").toLowerCase();

  if (source.source_type === "kov_regulation" || lowerIncludes(text, "kov-rt") || lowerIncludes(text, ".rt.")) {
    return "kov_rt";
  }
  if (
    source.source_type === "national_law" ||
    source.source_type === "law" ||
    source.source_type === "regulation" ||
    lowerIncludes(text, "national_rt") ||
    lowerIncludes(text, "national-rt") ||
    lowerIncludes(text, "riigiteataja")
  ) {
    return "national_rt";
  }
  if (
    source.source_type === "journal_article" ||
    lowerIncludes(text, "sotsiaaltoo") ||
    lowerIncludes(text, "sotsiaaltoo") ||
    lowerIncludes(text, "ajakiri")
  ) {
    return "ajakiri_sotsiaaltoo";
  }
  if (source.organization_id || lowerIncludes(text, "organization")) {
    return "organizations";
  }
  if (source.municipality_id || source.authority === "KOV" || lowerIncludes(text, "kov")) {
    return "kov_web";
  }
  return "unknown";
}

function inferSourceFileType(source = {}) {
  const text = [
    source.file_name,
    source.source_file,
    source.source_register_file,
    source.source_path,
    source.source_format,
    source.mime_type,
    source.legacy_source_type,
    source.document_id,
    source.source_id
  ].filter(Boolean).join(" ").toLowerCase();

  if (source.legacy_source_type === "kov_dataset_item") return "kov_data_item";
  if (source.legacy_source_type === "kov_dataset_bundle") return "rag_md";
  if (lowerIncludes(text, ".rt.xml") || lowerIncludes(text, "rtxml")) return "rt_xml";
  if (lowerIncludes(text, ".rt.json")) return "rt_json";
  if (lowerIncludes(text, ".rt.md")) return "rt_md";
  if (lowerIncludes(text, ".sources.json")) return "sources_json";
  if (lowerIncludes(text, ".meta.json")) return "meta_json";
  if (lowerIncludes(text, ".rag.md") || source.mime_type === "text/markdown") return "rag_md";
  if (source.source_type === "journal_article") return "article_ingest";
  if (source.source_format === "xml" || source.mime_type === "application/xml" || lowerIncludes(text, ".xml")) return "xml";
  if (lowerIncludes(text, ".json")) return "data_json";
  return "unknown";
}

export function normalizeSourceMetadataForFreshness(record = {}) {
  const root = isObject(record) ? record : {};
  const metadata = parseMetadata(root.metadata);
  const canonical = normalizeRagSourceMetadata(root, { includeUrlAlias: true });
  const sourceType = canonical.source_type;
  const rootStatus = typeof root.status === "string" && isKnownRagSourceStatus(root.status.trim().toLowerCase())
    ? root.status.trim().toLowerCase()
    : null;
  const sourceStatus = firstValue(canonical.source_status, rootStatus);

  const normalized = {
    metadata_schema_version: canonical.metadata_schema_version,
    source_id: firstValue(canonical.source_id, root.id),
    document_id: firstValue(canonical.document_id, root.remoteId, root.id),
    chunk_id: canonical.chunk_id,
    canonical_item_id: canonical.canonical_item_id,
    title: firstValue(canonical.title, root.fileName, root.name),
    source_type: sourceType ? String(sourceType).trim() : null,
    collection_id: canonical.collection_id,
    legacy_source_type: firstValue(metadata.legacy_source_type, metadata.legacySourceType, root.legacy_source_type, root.legacySourceType),
    source_register_file: firstValue(metadata.source_register_file, metadata.sourceRegisterFile, root.source_register_file, root.sourceRegisterFile),
    source_path: firstValue(metadata.source_path, metadata.sourcePath, root.source_path, root.sourcePath),
    source_file: firstValue(metadata.source_file, metadata.sourceFile, root.source_file, root.sourceFile),
    source_format: firstValue(metadata.source_format, metadata.sourceFormat, root.source_format, root.sourceFormat),
    file_name: firstValue(metadata.fileName, metadata.file_name, metadata.filename, root.fileName, root.file_name, root.filename),
    mime_type: firstValue(metadata.mimeType, metadata.mime_type, root.mimeType, root.mime_type),
    organization_id: firstValue(metadata.organization_id, metadata.organizationId, root.organization_id, root.organizationId),
    authority: canonical.authority,
    audience: normalizeAudience(canonical.audience),
    language: canonical.language,
    municipality_id: canonical.municipality_id,
    item_type: canonical.item_type,
    service_name: firstValue(metadata.service_name, metadata.serviceName, root.service_name, root.serviceName),
    sections_present: normalizeStringArray(firstValue(metadata.sections_present, metadata.sectionsPresent, root.sections_present, root.sectionsPresent)),
    forms_count: firstCount(metadata.forms_count, metadata.formsCount, metadata.forms, root.forms_count, root.formsCount, root.forms),
    related_forms_count: firstCount(
      metadata.related_forms_count,
      metadata.relatedFormsCount,
      metadata.related_forms,
      metadata.relatedForms,
      root.related_forms_count,
      root.relatedFormsCount,
      root.related_forms,
      root.relatedForms
    ),
    contacts_count: firstCount(metadata.contacts_count, metadata.contactsCount, metadata.contacts, root.contacts_count, root.contactsCount, root.contacts),
    related_contacts_count: firstCount(
      metadata.related_contacts_count,
      metadata.relatedContactsCount,
      metadata.related_contacts,
      metadata.relatedContacts,
      root.related_contacts_count,
      root.relatedContactsCount,
      root.related_contacts,
      root.relatedContacts
    ),
    legal_basis_count: firstCount(metadata.legal_basis_count, metadata.legalBasisCount, metadata.legal_basis, metadata.legalBasis, root.legal_basis_count, root.legalBasisCount, root.legal_basis, root.legalBasis),
    act_reference: canonical.act_reference,
    last_checked: canonical.last_checked,
    valid_from: canonical.valid_from,
    valid_to: canonical.valid_to,
    historical: canonical.historical === true,
    source_status: sourceStatus ? String(sourceStatus).trim().toLowerCase() : null,
    url: canonical.url_canonical,
    url_canonical: canonical.url_canonical,
    content_hash: canonical.content_hash,
    inserted_at: toDateOnly(firstValue(root.insertedAt, metadata.inserted_at, metadata.insertedAt)),
    updated_at: toDateOnly(firstValue(root.updatedAt, metadata.updated_at, metadata.updatedAt))
  };

  return {
    ...normalized,
    collection_family: inferCollectionFamily(normalized),
    source_file_type: inferSourceFileType(normalized)
  };
}

function severityForPolicy(policy, fallback = "warning") {
  if (!policy) return fallback;
  return policy.priority === "high" ? "error" : fallback;
}

function isValidHttpUrl(value) {
  if (value == null || value === "") return true;
  try {
    const url = new URL(String(value));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function hasContactSignal(source) {
  const text = [
    source.title,
    source.source_id,
    source.document_id,
    source.url,
    source.sections_present.join(" ")
  ].filter(Boolean).join(" ").toLowerCase();
  return /\b(contact|kontakt|contacts|kontaktid)\b/.test(text);
}

function hasSection(source, sectionNames) {
  const wanted = new Set(sectionNames.map(section => String(section).toLowerCase()));
  return source.sections_present.some(section => wanted.has(String(section).trim().toLowerCase()));
}

function hasPositiveCount(source, fieldNames) {
  return fieldNames.some(fieldName => Number(source[fieldName] || 0) > 0);
}

function isMissingMetadataValue(source, fieldName) {
  const value = source[fieldName];
  if (fieldName === "audience") return !Array.isArray(value) || value.length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return value === undefined || value === null || value === "";
}

function isKovScopedSource(source) {
  if (source.municipality_id) return true;
  if (source.authority === "KOV") return true;
  return KOV_SCOPED_SOURCE_TYPES.has(source.source_type);
}

function assessMetadataQuality(source) {
  const requiredFields = [...REQUIRED_METADATA_FIELDS];
  const recommendedFields = [...RECOMMENDED_METADATA_FIELDS];

  if (isKovScopedSource(source)) requiredFields.push("municipality_id");
  if (source.source_type === "kov_service_info" && source.item_type !== "bundle") {
    recommendedFields.push("canonical_item_id");
  }

  const missingRequiredFields = requiredFields.filter(fieldName => isMissingMetadataValue(source, fieldName));
  const missingRecommendedFields = recommendedFields.filter(fieldName => isMissingMetadataValue(source, fieldName));
  const checkedFieldCount = requiredFields.length + recommendedFields.length;
  const missingFieldCount = missingRequiredFields.length + missingRecommendedFields.length;

  return {
    status: missingRequiredFields.length ? "incomplete" : "complete",
    score: checkedFieldCount ? (checkedFieldCount - missingFieldCount) / checkedFieldCount : 1,
    missing_required_fields: missingRequiredFields,
    missing_recommended_fields: missingRecommendedFields
  };
}

function serviceDeclaresFormPackage(source) {
  return hasSection(source, ["forms", "form", "application_form", "application_forms"]) ||
    hasPositiveCount(source, ["forms_count", "related_forms_count"]);
}

function serviceDeclaresContactPackage(source) {
  return hasSection(source, ["contacts", "contact", "official_contact", "contact_page"]) ||
    hasPositiveCount(source, ["contacts_count", "related_contacts_count"]);
}

function sourceGroupKey(source) {
  if (source.canonical_item_id) return `canonical:${source.canonical_item_id}`;
  if (source.municipality_id && (source.service_name || source.title)) {
    return `municipality:${source.municipality_id}:${String(source.service_name || source.title).trim().toLowerCase()}`;
  }
  return null;
}

function addSummaryReason(summary, reason) {
  if (!reason) return;
  summary.reasons[reason] = (summary.reasons[reason] || 0) + 1;
}

function addIssueReason(source, reason, status, severity = "warning") {
  if (!source || !reason) return;
  if (!source.reasons.includes(reason)) source.reasons.push(reason);
  if (source.freshness_status === "ok") source.freshness_status = status || reason;
  if (severity === "error") {
    source.severity = "error";
  } else if (source.severity !== "error") {
    source.severity = severity;
  }
}

function createMetadataQualityBucket() {
  return {
    total: 0,
    complete: 0,
    incomplete: 0,
    required_missing: 0,
    recommended_missing: 0,
    completeness_rate: 0,
    average_score: 0,
    missing_fields: {},
    missing_required_fields: {},
    missing_recommended_fields: {}
  };
}

function addMissingFieldCount(target, fieldName, required) {
  target.missing_fields[fieldName] = (target.missing_fields[fieldName] || 0) + 1;
  if (required) {
    target.required_missing += 1;
    target.missing_required_fields[fieldName] = (target.missing_required_fields[fieldName] || 0) + 1;
  } else {
    target.recommended_missing += 1;
    target.missing_recommended_fields[fieldName] = (target.missing_recommended_fields[fieldName] || 0) + 1;
  }
}

function addMetadataQualityToBucket(bucket, metadataQuality) {
  bucket.total += 1;
  if (metadataQuality.status === "complete") bucket.complete += 1;
  if (metadataQuality.status === "incomplete") bucket.incomplete += 1;
  bucket.average_score += Number(metadataQuality.score || 0);
  for (const fieldName of metadataQuality.missing_required_fields || []) {
    addMissingFieldCount(bucket, fieldName, true);
  }
  for (const fieldName of metadataQuality.missing_recommended_fields || []) {
    addMissingFieldCount(bucket, fieldName, false);
  }
}

function finalizeMetadataQualityBucket(bucket) {
  if (!bucket.total) return bucket;
  bucket.completeness_rate = bucket.complete / bucket.total;
  bucket.average_score /= bucket.total;
  return bucket;
}

function addQueryParam(params, key, value) {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    const normalized = value.map(item => String(item || "").trim()).filter(Boolean);
    if (normalized.length > 0) params.set(key, normalized.join(","));
    return;
  }
  const normalized = String(value || "").trim();
  if (normalized) params.set(key, normalized);
}

function buildAdminHref(basePath, query = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) addQueryParam(params, key, value);
  const queryString = params.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

function suggestedSourceTypeForRemediation(source = {}) {
  const sourceType = String(source.source_type || "").trim();
  if (sourceType && isKnownRagSourceType(sourceType)) return sourceType;

  const collectionFamily = String(source.collection_family || "").trim();
  if (collectionFamily === "ajakiri_sotsiaaltoo") return "journal_article";
  if (collectionFamily === "kov_rt") return "kov_regulation";
  if (collectionFamily === "national_rt") return "national_law";
  if (collectionFamily === "organizations") return "partner_service_info";
  if (collectionFamily === "kov_web") {
    const sourceFileType = String(source.source_file_type || "").trim();
    if (sourceFileType === "rag_md" || sourceFileType === "kov_data_item" || sourceFileType === "data_json") {
      return "kov_service_info";
    }
  }

  return null;
}

function suggestedAuthorityForRemediation(source = {}) {
  const authority = String(source.authority || "").trim();
  if (authority) return authority;

  const collectionFamily = String(source.collection_family || "").trim();
  if (collectionFamily === "ajakiri_sotsiaaltoo") return "editorial";
  if (collectionFamily === "kov_rt" || collectionFamily === "national_rt") return "official_legal";
  if (collectionFamily === "kov_web") return "KOV";
  if (collectionFamily === "organizations") return "organization";
  return null;
}

function suggestedUrlForRemediation(source = {}) {
  return firstValue(source.url, source.source_url, source.sourceUrl);
}

function fileKeyForSourceFileType(collectionFamily, sourceFileType) {
  const type = String(sourceFileType || "").trim();
  if (!type) return null;

  if (type === "sources_json") return "sourcesJson";
  if (type === "kov_data_item" || type === "data_json") return "dataJson";
  if (type === "meta_json") return "metaJson";
  if (type === "rag_md") return "ragMd";
  if (type === "rt_xml") return "rtXml";
  if (type === "rt_json") return "rtJson";
  if (type === "rt_md") return "rtMd";
  if (collectionFamily === "organizations" && type === "attachment") return "attachment";
  return null;
}

function focusForRemediationTarget(source = {}, remediation = {}) {
  const collectionFamily = source.collection_family || "unknown";
  const sourceFileType = source.source_file_type || "unknown";
  const fileKey = fileKeyForSourceFileType(collectionFamily, sourceFileType);
  if (fileKey) {
    return {
      focus: "file",
      file_key: fileKey
    };
  }

  if (collectionFamily === "kov_rt") {
    return {
      focus: remediation.action === "fix_source_url" ? "kov_rt_link" : "kov_rt"
    };
  }

  if (collectionFamily === "kov_web") {
    if (["fix_source_url", "add_or_link_form_source", "add_or_link_official_contact_source"].includes(remediation.action)) {
      return {
        focus: "kov_web_links"
      };
    }
    return {
      focus: "kov_web"
    };
  }

  if (collectionFamily === "organizations") {
    return {
      focus: remediation.action === "fix_source_url" ? "organization_details" : "organization_package"
    };
  }

  if (collectionFamily === "national_rt" || collectionFamily === "ajakiri_sotsiaaltoo") {
    return {
      focus: "ingest_metadata"
    };
  }

  return {
    focus: "document_metadata"
  };
}

function remediationTarget(source = {}, remediation = {}) {
  const focus = focusForRemediationTarget(source, remediation);
  const target = {
    collection_family: source.collection_family || "unknown",
    source_file_type: source.source_file_type || "unknown",
    source_id: source.source_id || null,
    document_id: source.document_id || null,
    canonical_item_id: source.canonical_item_id || null,
    municipality_id: source.municipality_id || null,
    organization_id: source.organization_id || null,
    source_type: source.source_type || null,
    source_path: source.source_path || source.source_file || null,
    action: remediation.action || null,
    fields: Array.isArray(remediation.fields) ? remediation.fields : [],
    focus: focus.focus || null,
    file_key: focus.file_key || null
  };

  const commonQuery = {
    remediation_action: remediation.action || null,
    fields: remediation.fields || [],
    recommended_fields: remediation.recommended_fields || [],
    source_id: target.source_id,
    document_id: target.document_id,
    canonical_item_id: target.canonical_item_id,
    source_type: target.source_type,
    source_file_type: target.source_file_type,
    source_path: target.source_path,
    suggested_source_type: suggestedSourceTypeForRemediation(source),
    suggested_authority: suggestedAuthorityForRemediation(source),
    suggested_url: suggestedUrlForRemediation(source),
    focus: target.focus,
    file_key: target.file_key
  };

  if (target.collection_family === "kov_web" || target.collection_family === "kov_rt") {
    target.admin_href = buildAdminHref("/admin/rag/kov", {
      municipality: target.municipality_id,
      ...commonQuery
    });
  } else if (target.collection_family === "organizations") {
    target.admin_href = buildAdminHref("/admin/rag/organizations", {
      organization: target.organization_id,
      ...commonQuery
    });
  } else if (target.collection_family === "national_rt") {
    target.admin_href = buildAdminHref("/admin/rag/ingest", {
      source: "national_rt",
      ...commonQuery
    });
  } else if (target.collection_family === "ajakiri_sotsiaaltoo") {
    target.admin_href = buildAdminHref("/admin/rag/ingest", {
      source: "ajakiri_sotsiaaltoo",
      ...commonQuery
    });
  } else {
    target.admin_href = buildAdminHref("/admin/rag/documents", commonQuery);
  }

  return {
    ...target
  };
}

function remediation(source, action, fields = [], extras = {}) {
  const normalized = {
    action,
    fields,
    ...extras
  };
  return {
    ...normalized,
    target: remediationTarget(source, normalized)
  };
}

function buildRemediationHint(source = {}) {
  const reasons = Array.isArray(source.reasons) ? source.reasons : [];
  const metadataQuality = source.metadata_quality || {};
  const missingRequired = Array.isArray(metadataQuality.missing_required_fields)
    ? metadataQuality.missing_required_fields
    : [];
  const missingRecommended = Array.isArray(metadataQuality.missing_recommended_fields)
    ? metadataQuality.missing_recommended_fields
    : [];

  if (missingRequired.length > 0) {
    return remediation(source, "fill_required_metadata_fields", missingRequired, {
      recommended_fields: missingRecommended,
    });
  }

  if (reasons.includes("unknown_source_type")) {
    return remediation(source, "map_source_type", ["source_type"]);
  }

  if (reasons.includes("missing_url") || reasons.includes("invalid_url")) {
    return remediation(source, "fix_source_url", ["url"]);
  }

  if (reasons.includes("missing_last_checked") || reasons.includes("last_checked_stale") || reasons.includes("review_due_soon")) {
    return remediation(source, "refresh_last_checked", ["last_checked"]);
  }

  if (reasons.includes("valid_to_expired") || reasons.includes("valid_from_in_future")) {
    return remediation(source, "review_validity_window", ["valid_from", "valid_to"]);
  }

  if (reasons.includes("kov_service_missing_form_source")) {
    return remediation(source, "add_or_link_form_source", ["application_form", "canonical_item_id"]);
  }

  if (reasons.includes("kov_service_missing_official_contact_source") || reasons.includes("contact_not_official_source")) {
    return remediation(source, "add_or_link_official_contact_source", ["official_contact", "contact_page", "canonical_item_id"]);
  }

  if (reasons.includes("canonical_item_municipality_conflict")) {
    return remediation(source, "resolve_canonical_item_municipality_conflict", ["canonical_item_id", "municipality_id"]);
  }

  if (missingRecommended.length > 0) {
    return remediation(source, "fill_recommended_metadata_fields", missingRecommended);
  }

  return remediation(source, "review_source_metadata", []);
}

export function assessSourceFreshness(record = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const source = normalizeSourceMetadataForFreshness(record);
  const policy = RAG_SOURCE_FRESHNESS_POLICIES[source.source_type] || null;
  const reasons = [];
  let freshnessStatus = "ok";
  let severity = "info";
  let ageDays = null;

  if (!source.source_type || !isKnownRagSourceType(source.source_type)) {
    reasons.push("unknown_source_type");
    freshnessStatus = "unknown_type";
    severity = "warning";
  }

  if (source.source_status && !isKnownRagSourceStatus(source.source_status)) {
    reasons.push("unknown_source_status");
    if (severity === "info") severity = "warning";
  }

  if (source.source_status === "stale") {
    reasons.push("source_status_stale");
    freshnessStatus = "stale";
    severity = "error";
  } else if (source.source_status === "inactive" || source.source_status === "archived") {
    reasons.push(`source_status_${source.source_status}`);
    freshnessStatus = source.source_status;
    severity = severity === "error" ? severity : "warning";
  }

  if (source.valid_to) {
    const daysUntilValidTo = dayDiff(new Date(`${source.valid_to}T00:00:00Z`), now.toISOString().slice(0, 10));
    if (daysUntilValidTo < 0) {
      reasons.push("valid_to_expired");
      freshnessStatus = "expired";
      severity = "error";
    }
  }

  if (source.valid_from) {
    const daysSinceValidFrom = dayDiff(now, source.valid_from);
    if (daysSinceValidFrom < 0) {
      reasons.push("valid_from_in_future");
      freshnessStatus = freshnessStatus === "ok" ? "not_yet_valid" : freshnessStatus;
      if (severity === "info") severity = "warning";
    }
  }

  if (!source.last_checked) {
    reasons.push("missing_last_checked");
    freshnessStatus = freshnessStatus === "ok" ? "missing_last_checked" : freshnessStatus;
    severity = policy?.currentEvidence === false ? (severity === "error" ? severity : "warning") : "error";
  } else {
    ageDays = dayDiff(now, source.last_checked);
    if (ageDays < 0) {
      reasons.push("last_checked_in_future");
      freshnessStatus = freshnessStatus === "ok" ? "invalid_last_checked" : freshnessStatus;
      severity = "warning";
    } else if (policy?.maxAgeDays != null && ageDays > policy.maxAgeDays) {
      reasons.push("last_checked_stale");
      freshnessStatus = freshnessStatus === "ok" ? "stale" : freshnessStatus;
      severity = severity === "error" ? severity : severityForPolicy(policy);
    } else if (policy?.maxAgeDays != null && ageDays > Math.max(0, policy.maxAgeDays - 14)) {
      reasons.push("review_due_soon");
      freshnessStatus = freshnessStatus === "ok" ? "due_soon" : freshnessStatus;
      if (severity === "info") severity = "warning";
    }
  }

  if (source.historical && policy?.currentEvidence) {
    reasons.push("historical_current_evidence_source");
    freshnessStatus = freshnessStatus === "ok" ? "historical" : freshnessStatus;
    if (severity === "info") severity = "warning";
  }

  if (source.url && !isValidHttpUrl(source.url)) {
    reasons.push("invalid_url");
    freshnessStatus = freshnessStatus === "ok" ? "invalid_url" : freshnessStatus;
    severity = severity === "error" ? severity : "warning";
  } else if (!source.url && policy?.currentEvidence) {
    reasons.push("missing_url");
    freshnessStatus = freshnessStatus === "ok" ? "missing_url" : freshnessStatus;
    severity = severity === "error" ? severity : "warning";
  }

  if (hasContactSignal(source) && source.source_type && !["official_contact", "contact_page", "kov_service_info"].includes(source.source_type)) {
    reasons.push("contact_not_official_source");
    freshnessStatus = freshnessStatus === "ok" ? "contact_not_official_source" : freshnessStatus;
    severity = severity === "error" ? severity : "warning";
  }

  return {
    ...source,
    freshness_status: freshnessStatus,
    severity,
    reasons,
    metadata_quality: assessMetadataQuality(source),
    age_days: ageDays,
    max_age_days: policy?.maxAgeDays ?? null,
    freshness_priority: policy?.priority || "unknown",
    current_evidence: policy?.currentEvidence === true
  };
}

export function summarizeFreshnessAudit(records = [], options = {}) {
  const assessments = records.map(record => assessSourceFreshness(record, options));
  const formSourceTypes = new Set(["application_form", "web_form", "pdf_form", "official_form"]);
  const contactSourceTypes = new Set(["official_contact", "contact_page"]);
  const groups = new Map();
  for (const item of assessments) {
    const key = sourceGroupKey(item);
    if (!key) continue;
    if (!groups.has(key)) {
      groups.set(key, {
        hasForm: false,
        hasOfficialContact: false,
        municipalityIds: new Set(),
        services: [],
        items: []
      });
    }
    const group = groups.get(key);
    if (formSourceTypes.has(item.source_type)) group.hasForm = true;
    if (contactSourceTypes.has(item.source_type)) group.hasOfficialContact = true;
    if (item.municipality_id) group.municipalityIds.add(String(item.municipality_id).trim());
    group.items.push(item);
    if (item.source_type === "kov_service_info") group.services.push(item);
  }

  for (const group of groups.values()) {
    if (group.municipalityIds.size > 1) {
      for (const item of group.items) {
        addIssueReason(item, "canonical_item_municipality_conflict", "canonical_item_municipality_conflict");
      }
    }

    for (const service of group.services) {
      if (!group.hasForm && serviceDeclaresFormPackage(service)) {
        addIssueReason(service, "kov_service_missing_form_source", "kov_service_missing_form_source");
      }

      if (!group.hasOfficialContact && serviceDeclaresContactPackage(service)) {
        addIssueReason(service, "kov_service_missing_official_contact_source", "kov_service_missing_official_contact_source");
      }
    }
  }

  const summary = {
    total: assessments.length,
    ok: 0,
    due_soon: 0,
    stale: 0,
    missing_last_checked: 0,
    expired: 0,
    inactive_or_archived: 0,
    unknown_type: 0,
    warnings: 0,
    errors: 0,
    quality_issues: 0,
    metadata_quality: createMetadataQualityBucket(),
    reasons: {}
  };
  summary.metadata_quality.by_collection = {};
  summary.metadata_quality.by_file_type = {};

  for (const item of assessments) {
    item.remediation = buildRemediationHint(item);
    const metadataQuality = item.metadata_quality || {};
    if (item.freshness_status === "ok") summary.ok += 1;
    if (item.freshness_status === "due_soon") summary.due_soon += 1;
    if (item.freshness_status === "stale") summary.stale += 1;
    if (item.freshness_status === "missing_last_checked") summary.missing_last_checked += 1;
    if (item.freshness_status === "expired") summary.expired += 1;
    if (item.freshness_status === "inactive" || item.freshness_status === "archived") summary.inactive_or_archived += 1;
    if (item.freshness_status === "unknown_type") summary.unknown_type += 1;
    if (item.severity === "warning") summary.warnings += 1;
    if (item.severity === "error") summary.errors += 1;
    if (item.severity === "warning" || item.severity === "error") summary.quality_issues += 1;
    for (const reason of item.reasons) addSummaryReason(summary, reason);

    addMetadataQualityToBucket(summary.metadata_quality, metadataQuality);
    const collectionFamily = item.collection_family || "unknown";
    if (!summary.metadata_quality.by_collection[collectionFamily]) {
      summary.metadata_quality.by_collection[collectionFamily] = createMetadataQualityBucket();
    }
    addMetadataQualityToBucket(summary.metadata_quality.by_collection[collectionFamily], metadataQuality);

    const sourceFileType = item.source_file_type || "unknown";
    if (!summary.metadata_quality.by_file_type[sourceFileType]) {
      summary.metadata_quality.by_file_type[sourceFileType] = createMetadataQualityBucket();
    }
    addMetadataQualityToBucket(summary.metadata_quality.by_file_type[sourceFileType], metadataQuality);
  }

  finalizeMetadataQualityBucket(summary.metadata_quality);
  for (const bucket of Object.values(summary.metadata_quality.by_collection)) {
    finalizeMetadataQualityBucket(bucket);
  }
  for (const bucket of Object.values(summary.metadata_quality.by_file_type)) {
    finalizeMetadataQualityBucket(bucket);
  }

  return {
    ok: summary.errors === 0,
    summary,
    items: assessments
  };
}

function addIndexValue(index, key, value) {
  const normalized = String(key || "").trim();
  if (!normalized || index.has(normalized)) return;
  index.set(normalized, value);
}

function extractRtActReferences(...values) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const text = String(value || "");
    for (const match of text.matchAll(/\b(\d{12})\b/g)) {
      const ref = String(match?.[1] || "").trim();
      if (!ref || seen.has(ref)) continue;
      seen.add(ref);
      out.push(ref);
    }
  }
  return out;
}

function addRtActReferenceAliases(index, item = {}) {
  const refs = extractRtActReferences(
    item.act_reference,
    item.source_id,
    item.document_id,
    item.chunk_id,
    item.url,
    item.title
  );
  for (const ref of refs) {
    addIndexValue(index, ref, item);
    addIndexValue(index, `rt-${ref}`, item);
    addIndexValue(index, `national-rt-${ref}`, item);
    addIndexValue(index, `jogeva-vald-rt-${ref}`, item);
    addIndexValue(index, `riigiteataja:${ref}`, item);
    addIndexValue(index, `national_rt_${ref}`, item);
  }
}

export function buildSourceFreshnessIndex(items = []) {
  const index = new Map();
  for (const item of items) {
    addIndexValue(index, item.source_id, item);
    addIndexValue(index, item.document_id, item);
    addIndexValue(index, item.chunk_id, item);
    addIndexValue(index, item.canonical_item_id, item);
    addRtActReferenceAliases(index, item);
  }
  return index;
}

function sourceFreshnessLookupCandidates(sourceId = "") {
  const raw = String(sourceId || "").trim();
  if (!raw) return [];
  const out = [raw];
  const pipeBase = raw.split("|")[0]?.trim();
  if (pipeBase && pipeBase !== raw) out.push(pipeBase);
  const paragraphBase = raw.split(":paragraph-")[0]?.trim();
  if (paragraphBase && paragraphBase !== raw) out.push(paragraphBase);
  for (const ref of extractRtActReferences(raw)) {
    out.push(ref, `rt-${ref}`, `national-rt-${ref}`, `jogeva-vald-rt-${ref}`, `riigiteataja:${ref}`, `national_rt_${ref}`);
  }
  return [...new Set(out.filter(Boolean))];
}

function resolveSourceFreshnessItem(index, sourceId = "") {
  for (const candidate of sourceFreshnessLookupCandidates(sourceId)) {
    const item = index.get(candidate);
    if (item) return item;
  }
  return null;
}

function traceData(row) {
  if (row?.data && typeof row.data === "object") return row.data;
  return row && typeof row === "object" ? row : {};
}

function isHighRiskTrace(data = {}) {
  const risk = String(data.rag_risk_level || data.risk_level || data.riskLevel || "").trim().toLowerCase();
  return risk === "high";
}

function displayedSourceIdsFromTrace(data = {}) {
  return Array.isArray(data.displayed_source_ids)
    ? [...new Set(data.displayed_source_ids.map(id => String(id || "").trim()).filter(Boolean))]
    : [];
}

function answerSourceIdsFromTrace(data = {}) {
  return Array.isArray(data.answer_source_ids)
    ? [...new Set(data.answer_source_ids.map(id => String(id || "").trim()).filter(Boolean))]
    : [];
}

function normalizeSourceIdList(...values) {
  const out = [];
  for (const value of values) {
    const items = Array.isArray(value) ? value : [value];
    for (const item of items) {
      const normalized = String(item || "").trim();
      if (normalized) out.push(normalized);
    }
  }
  return [...new Set(out)];
}

function claimAttributionItemsFromTrace(data = {}) {
  const directContainers = [
    data.claim_attributions,
    data.claimAttributions,
    data.claim_level_attributions,
    data.claimLevelAttributions,
    data.rag_claims,
    data.claims
  ];

  const items = [];
  for (const container of directContainers) {
    if (Array.isArray(container)) {
      items.push(...container.filter(isObject));
    } else if (isObject(container) && Array.isArray(container.claims)) {
      items.push(...container.claims.filter(isObject));
    } else if (isObject(container) && Array.isArray(container.items)) {
      items.push(...container.items.filter(isObject));
    }
  }
  return items;
}

function sourceIdsFromClaimAttribution(item = {}) {
  return normalizeSourceIdList(
    item.source_id,
    item.sourceId,
    item.source_ids,
    item.sourceIds,
    item.answer_source_ids,
    item.answerSourceIds,
    item.evidence_source_ids,
    item.evidenceSourceIds
  );
}

function claimSourceIdsFromTrace(data = {}) {
  const ids = [];
  for (const item of claimAttributionItemsFromTrace(data)) {
    ids.push(...sourceIdsFromClaimAttribution(item));
  }
  return [...new Set(ids)];
}

function claimRefsBySourceIdFromTrace(data = {}) {
  const refs = new Map();
  for (const item of claimAttributionItemsFromTrace(data)) {
    const sourceIds = sourceIdsFromClaimAttribution(item);
    if (sourceIds.length === 0) continue;
    const ref = {
      claim_id: firstValue(item.claim_id, item.claimId, item.id),
      claim_type: firstValue(item.claim_type, item.claimType, item.type),
      evidence_strength: firstValue(item.evidence_strength, item.evidenceStrength)
    };
    const hasRef = Object.values(ref).some(value => value !== null && value !== undefined && value !== "");
    for (const sourceId of sourceIds) {
      if (!refs.has(sourceId)) refs.set(sourceId, []);
      if (hasRef) refs.get(sourceId).push(ref);
    }
  }
  return refs;
}

function hasStaleFreshnessRisk(item = {}) {
  const status = String(item.freshness_status || "").trim();
  if (item.severity === "error") return true;
  return [
    "stale",
    "missing_last_checked",
    "expired",
    "inactive",
    "archived",
    "invalid_last_checked",
    "not_yet_valid"
  ].includes(status);
}

function createLayerSummary(prefix) {
  return {
    [`high_risk_with_${prefix}_sources`]: 0,
    [`high_risk_${prefix}_source_count`]: 0,
    [`matched_${prefix}_source_count`]: 0,
    [`stale_${prefix}_source_count`]: 0,
    [`unknown_${prefix}_source_count`]: 0,
    [`stale_${prefix}_source_responses`]: 0,
    [`unknown_${prefix}_source_responses`]: 0,
    [`${prefix}_source_stale_rate`]: 0,
    [`${prefix}_unknown_source_rate`]: 0
  };
}

function processSourceLayer({
  sourceIds,
  prefix,
  index,
  summary,
  issues,
  claimRefsBySourceId = null
}) {
  if (sourceIds.length > 0) summary[`high_risk_with_${prefix}_sources`] += 1;
  summary[`high_risk_${prefix}_source_count`] += sourceIds.length;

  let responseHasStale = false;
  let responseHasUnknown = false;

  for (const sourceId of sourceIds) {
    const item = resolveSourceFreshnessItem(index, sourceId);
    if (!item) {
      responseHasUnknown = true;
      summary[`unknown_${prefix}_source_count`] += 1;
      issues.push({
        layer: prefix,
        source_id: sourceId,
        issue: "unknown_source_freshness",
        severity: "warning",
        claim_refs: claimRefsBySourceId?.get(sourceId)?.slice(0, 5) || undefined
      });
      continue;
    }

    summary[`matched_${prefix}_source_count`] += 1;
    if (hasStaleFreshnessRisk(item)) {
      responseHasStale = true;
      summary[`stale_${prefix}_source_count`] += 1;
      for (const reason of Array.isArray(item.reasons) ? item.reasons : []) {
        summary.issue_reasons[reason] = (summary.issue_reasons[reason] || 0) + 1;
      }
      issues.push({
        layer: prefix,
        source_id: sourceId,
        title: item.title || null,
        source_type: item.source_type || null,
        collection_family: item.collection_family || null,
        source_file_type: item.source_file_type || null,
        freshness_status: item.freshness_status || null,
        severity: item.severity || "info",
        remediation: item.remediation || buildRemediationHint(item),
        reasons: Array.isArray(item.reasons) ? item.reasons.slice(0, 8) : [],
        claim_refs: claimRefsBySourceId?.get(sourceId)?.slice(0, 5) || undefined
      });
    }
  }

  if (responseHasStale) summary[`stale_${prefix}_source_responses`] += 1;
  if (responseHasUnknown) summary[`unknown_${prefix}_source_responses`] += 1;
}

function finalizeSourceLayerRates(summary, prefix) {
  const denominator = summary[`high_risk_with_${prefix}_sources`];
  if (denominator <= 0) return;
  summary[`${prefix}_source_stale_rate`] = summary[`stale_${prefix}_source_responses`] / denominator;
  summary[`${prefix}_unknown_source_rate`] = summary[`unknown_${prefix}_source_responses`] / denominator;
}

export function summarizeHighRiskSourceFreshness(traceRows = [], freshnessItems = []) {
  const index = buildSourceFreshnessIndex(freshnessItems);
  const summary = {
    total_traces: 0,
    high_risk_traces: 0,
    ...createLayerSummary("answer"),
    ...createLayerSummary("displayed"),
    ...createLayerSummary("claim"),
    claim_source_risk_readiness_rate: 0,
    stale_source_responses: 0,
    unknown_source_responses: 0,
    stale_source_rate: 0,
    unknown_source_freshness_rate: 0,
    issue_reasons: {}
  };
  const issues = [];

  for (const row of traceRows || []) {
    const data = traceData(row);
    summary.total_traces += 1;
    if (!isHighRiskTrace(data)) continue;

    summary.high_risk_traces += 1;
    const answerIds = answerSourceIdsFromTrace(data);
    const displayedIds = displayedSourceIdsFromTrace(data);
    const claimIds = claimSourceIdsFromTrace(data);
    const claimRefsBySourceId = claimRefsBySourceIdFromTrace(data);

    processSourceLayer({ sourceIds: answerIds, prefix: "answer", index, summary, issues });
    processSourceLayer({ sourceIds: displayedIds, prefix: "displayed", index, summary, issues });
    processSourceLayer({ sourceIds: claimIds, prefix: "claim", index, summary, issues, claimRefsBySourceId });
  }

  finalizeSourceLayerRates(summary, "answer");
  finalizeSourceLayerRates(summary, "displayed");
  finalizeSourceLayerRates(summary, "claim");
  summary.claim_source_risk_readiness_rate = summary.high_risk_traces > 0
    ? summary.high_risk_with_claim_sources / summary.high_risk_traces
    : 0;
  summary.stale_source_responses = summary.stale_displayed_source_responses;
  summary.unknown_source_responses = summary.unknown_displayed_source_responses;
  summary.stale_source_rate = summary.displayed_source_stale_rate;
  summary.unknown_source_freshness_rate = summary.displayed_unknown_source_rate;

  return {
    ok: summary.stale_answer_source_responses === 0 && summary.stale_displayed_source_responses === 0 && summary.stale_claim_source_responses === 0,
    summary,
    issues: issues.slice(0, 25)
  };
}
