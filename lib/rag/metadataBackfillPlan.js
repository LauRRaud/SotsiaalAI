import crypto from "node:crypto";

import {
  inferKovItemRagSourceType,
  isKnownRagSourceType,
  normalizeRagSourceMetadata,
  validateRagSourceMetadataContract
} from "./sourceMetadata.js";

const DEFAULT_AUDIENCE = Object.freeze(["CLIENT", "SOCIAL_WORKER"]);

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function firstValue(...values) {
  for (const value of values) {
    if (hasValue(value)) return value;
  }
  return null;
}

export function slugifyRagId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function dateOnly(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function stableHash(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function normalizeAudience(value) {
  const values = Array.isArray(value) ? value : [value];
  const normalized = values
    .map(item => String(item || "").trim().toUpperCase())
    .filter(Boolean)
    .flatMap(item => item === "BOTH" ? DEFAULT_AUDIENCE : [item]);
  return [...new Set(normalized)].filter(item => DEFAULT_AUDIENCE.includes(item));
}

function textForInference(source = {}, context = {}) {
  return [
    source.source_type,
    source.type,
    source.itemType,
    source.resourceType,
    source.key,
    source.id,
    source.articleId,
    source.article_id,
    source.docId,
    source.journalTitle,
    source.journal_title,
    source.issueLabel,
    source.issue_label,
    source.title,
    source.url,
    context.filePath,
    context.collectionFamily
  ].filter(Boolean).join(" ").toLowerCase();
}

function normalizedText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function looksLikeJournalArticle(source = {}, context = {}) {
  const text = textForInference(source, context);
  const journalTitle = normalizedText(firstValue(source.journalTitle, source.journal_title));
  const docId = normalizedText(firstValue(source.docId, source.document_id, source.documentId));
  return String(context.collectionFamily || "").trim() === "ajakiri_sotsiaaltoo" ||
    text.includes("imports/ajakiri_sotsiaaltoo") ||
    journalTitle === "sotsiaaltoo" ||
    docId.startsWith("sotsiaaltoo-") ||
    (hasValue(source.articleId || source.article_id) && hasValue(source.issueLabel || source.issue_label) && hasValue(source.year));
}

function isFormSource(text) {
  return /\b(pdf|docx?|vorm|blankett|taotlus|lisa|form|e[_-]?form)\b/.test(text);
}

function inferSourceType(source = {}, context = {}) {
  const existing = firstValue(source.source_type, source.sourceType);
  if (looksLikeJournalArticle(source, context) && (!existing || String(existing).trim() === "file")) {
    return "journal_article";
  }
  if (existing && isKnownRagSourceType(existing)) return existing;

  const collection = String(context.collectionFamily || "").trim();
  const text = textForInference(source, context);

  if (collection === "ajakiri_sotsiaaltoo") return "journal_article";
  if (collection === "kov_rt") return "kov_regulation";
  if (collection === "national_rt") return "national_law";
  if (collection === "organizations") return "partner_service_info";

  if (collection === "kov_web") {
    if (/\b(contact_page|kontakt|kontaktid|contact)\b/.test(text)) return "contact_page";
    if (isFormSource(text)) return "application_form";
    return "kov_service_info";
  }

  if (source.itemType) return inferKovItemRagSourceType(source.itemType, source.resourceType);
  if (/\b(riigi[_-]?teataja|rt[_-]?xml|act|seadus|maarus|määrus)\b/.test(text)) return "national_law";
  if (/\b(organisatsioon|organization|partner)\b/.test(text)) return "partner_service_info";
  if (/\b(ajakiri|sotsiaaltoo|sotsiaaltöö|article|artikkel)\b/.test(text)) return "journal_article";
  return null;
}

function inferAuthority(source = {}, context = {}, sourceType = "") {
  const existing = firstValue(source.authority);
  if (existing) return existing;
  if (sourceType === "kov_regulation" || sourceType === "national_law") return "official_legal";
  if (String(context.collectionFamily || "") === "national_rt") return "official_legal";
  if (String(context.collectionFamily || "").startsWith("kov")) return "KOV";
  if (String(context.collectionFamily || "") === "organizations") return "organization";
  if (sourceType === "state_guide") return "state_official";
  if (sourceType === "journal_article") return "editorial";
  return null;
}

function inferMunicipalityId(source = {}, root = {}, context = {}) {
  return firstValue(
    source.municipality_id,
    source.municipalityId,
    root.municipality_id,
    root.municipalityId,
    root.id,
    context.municipalityId,
    context.slug,
    source.municipality,
    root.municipality
  );
}

function inferMunicipalityName(source = {}, root = {}, context = {}) {
  return firstValue(
    source.municipality_name,
    source.municipalityName,
    source.municipality,
    root.municipality_name,
    root.municipalityName,
    root.municipality,
    context.municipalityName,
    context.slug
  );
}

function normalizeSourceRecord(source = {}) {
  const metadata = isObject(source.metadata) ? source.metadata : {};
  return {
    ...source,
    ...metadata
  };
}

function needsMunicipality(sourceType, collectionFamily) {
  return collectionFamily === "kov_web" ||
    collectionFamily === "kov_rt" ||
    [
      "kov_service_info",
      "kov_regulation",
      "application_form",
      "web_form",
      "pdf_form",
      "official_form",
      "official_contact",
      "contact_page"
    ].includes(sourceType);
}

function buildSourceId(source = {}, root = {}, context = {}) {
  const existing = firstValue(source.source_id, source.sourceId, source.canonical_source_id, source.canonicalSourceId);
  if (existing) return slugifyRagId(existing);
  if (looksLikeJournalArticle(source, context)) {
    const articleId = firstValue(source.articleId, source.article_id);
    if (articleId) return String(articleId).trim();
  }
  const base = firstValue(source.articleId, source.article_id, source.key, source.id, source.title);
  if (!base) return null;
  const municipalityId = slugifyRagId(inferMunicipalityId(source, root, context));
  if (municipalityId && !String(base).startsWith(`${municipalityId}_`)) {
    return `${municipalityId}_${slugifyRagId(base)}`;
  }
  return slugifyRagId(base);
}

function buildBackfilledMetadata(sourceInput = {}, context = {}, options = {}) {
  const source = normalizeSourceRecord(sourceInput);
  const root = isObject(context.root) ? context.root : {};
  const collectionFamily = context.collectionFamily || "unknown";
  const sourceType = inferSourceType(source, { ...context, collectionFamily });
  const sourceId = buildSourceId(source, root, context);
  const title = firstValue(source.title, source.name, sourceId);
  const municipalityId = inferMunicipalityId(source, root, context);
  const municipalityName = inferMunicipalityName(source, root, context);
  const checkedAt = dateOnly(firstValue(
    source.last_checked,
    source.lastChecked,
    source.checked_at,
    source.checkedAt,
    root.checkedAt,
    root.last_checked,
    options.defaultLastChecked
  ));
  const hasStatusOrVersionSignal = hasValue(firstValue(
    source.source_status,
    source.sourceStatus,
    source.content_status,
    source.contentStatus,
    source.status,
    source.is_current_version,
    source.isCurrentVersion
  ));

  return normalizeRagSourceMetadata({
    ...source,
    source_id: sourceId,
    document_id: firstValue(source.document_id, source.documentId, source.docId, sourceId),
    title,
    source_type: sourceType,
    authority: inferAuthority(source, { ...context, collectionFamily }, sourceType),
    collection_id: firstValue(source.collection_id, source.collectionId, sourceType === "journal_article" ? "sotsiaaltoo_articles" : null),
    language: firstValue(source.language, root.language, "et"),
    audience: normalizeAudience(firstValue(source.audience, source.audiences, root.audience, root.audiences)).length
      ? normalizeAudience(firstValue(source.audience, source.audiences, root.audience, root.audiences))
      : [...DEFAULT_AUDIENCE],
    municipality_id: needsMunicipality(sourceType, collectionFamily) ? slugifyRagId(municipalityId) : firstValue(source.municipality_id, source.municipalityId),
    municipality_name: needsMunicipality(sourceType, collectionFamily) ? municipalityName : firstValue(source.municipality_name, source.municipalityName, source.municipality),
    canonical_item_id: firstValue(source.canonical_item_id, source.canonicalItemId, source.id && source.itemType ? source.id : null),
    last_checked: checkedAt,
    retrieved_at: dateOnly(firstValue(source.retrieved_at, source.retrievedAt, root.retrieved_at, root.retrievedAt, checkedAt)),
    valid_from: dateOnly(firstValue(source.valid_from, source.validFrom, source.effective_start, source.effectiveStart)),
    valid_to: dateOnly(firstValue(source.valid_to, source.validTo, source.effective_end, source.effectiveEnd)),
    historical: source.historical === true ? true : source.historical === false ? false : sourceType === "journal_article" ? true : undefined,
    source_status: firstValue(
      source.source_status,
      source.sourceStatus,
      source.content_status,
      source.contentStatus,
      !hasStatusOrVersionSignal && sourceType === "journal_article" ? "active" : null
    ),
    url_canonical: firstValue(source.url_canonical, source.urlCanonical, source.url, source.sourceUrl, source.officialUrl),
    source_urls: firstValue(source.source_urls, source.sourceUrls, source.sourceKeys),
    content_hash: firstValue(source.content_hash, source.contentHash, stableHash({ source, root: { id: root.id, checkedAt: root.checkedAt } }))
  });
}

function fieldChanged(original, backfilled, field) {
  const before = original[field];
  const after = backfilled[field];
  if (!hasValue(after)) return false;
  if (Array.isArray(after)) {
    const beforeArray = Array.isArray(before) ? before : hasValue(before) ? [before] : [];
    return JSON.stringify(beforeArray) !== JSON.stringify(after);
  }
  return !hasValue(before) || String(before).trim() !== String(after).trim();
}

export function planRagMetadataBackfillForSource(sourceInput = {}, context = {}, options = {}) {
  const original = normalizeSourceRecord(sourceInput);
  const backfilled = buildBackfilledMetadata(sourceInput, context, options);
  const requireMunicipality = needsMunicipality(backfilled.source_type, context.collectionFamily);
  const label = context.label || "source";
  const originalValidation = validateRagSourceMetadataContract(original, {
    label,
    requireMunicipality,
    requireDocumentId: true,
    requireTitle: true,
    requireAudience: true
  });
  const backfilledValidation = validateRagSourceMetadataContract(backfilled, {
    label,
    requireMunicipality,
    requireDocumentId: true,
    requireTitle: true,
    requireAudience: true,
    requireMetadataSchemaVersion: true
  });
  const fields = [
    "metadata_schema_version",
    "source_id",
    "document_id",
    "title",
    "source_type",
    "collection_id",
    "authority",
    "language",
    "audience",
    "municipality_id",
    "municipality_name",
    "canonical_item_id",
    "last_checked",
    "retrieved_at",
    "valid_from",
    "valid_to",
    "historical",
    "source_status",
    "url_canonical",
    "content_hash"
  ];
  const inferredFields = fields.filter(field => fieldChanged(original, backfilled, field));
  const status = originalValidation.ok
    ? "ready"
    : backfilledValidation.ok
      ? "backfill_required"
      : "blocked";

  return {
    status,
    collection_family: context.collectionFamily || "unknown",
    record_kind: context.recordKind || "source",
    file_path: context.filePath || null,
    index: context.index ?? null,
    source_id: backfilled.source_id || null,
    document_id: backfilled.document_id || null,
    title: backfilled.title || null,
    source_type: backfilled.source_type || null,
    inferred_fields: inferredFields,
    remaining_errors: backfilledValidation.errors,
    warnings: backfilledValidation.warnings,
    metadata: backfilled
  };
}

function createSummary() {
  return {
    total: 0,
    ready: 0,
    backfill_required: 0,
    blocked: 0,
    by_collection: {},
    by_status: {},
    inferred_fields: {},
    remaining_errors: {}
  };
}

function increment(map, key, by = 1) {
  const normalized = String(key || "unknown");
  map[normalized] = (map[normalized] || 0) + by;
}

function addSummaryItem(summary, item) {
  summary.total += 1;
  increment(summary.by_status, item.status);
  increment(summary.by_collection, item.collection_family);
  summary[item.status] += 1;
  for (const field of item.inferred_fields || []) increment(summary.inferred_fields, field);
  for (const error of item.remaining_errors || []) increment(summary.remaining_errors, error);
}

export function buildRagMetadataBackfillPlan(records = [], options = {}) {
  const items = records.map((record, index) => {
    const source = record.source || record;
    const context = {
      ...record.context,
      index: record.index ?? index,
      label: record.label || `${record.context?.filePath || "source"}[${record.index ?? index}]`
    };
    return planRagMetadataBackfillForSource(source, context, options);
  });
  const summary = createSummary();
  for (const item of items) addSummaryItem(summary, item);
  return {
    ok: summary.blocked === 0,
    summary,
    items
  };
}
