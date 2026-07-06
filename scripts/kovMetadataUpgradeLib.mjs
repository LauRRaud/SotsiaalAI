import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const SCHEMA_VERSION = "v2.5-sourcepackage";
export const UPGRADE_DATE = "2026-04-29";
export const VALID_SOURCE_TYPES = new Set([
  "kov_service_info",
  "contact_page",
  "official_contact",
  "contact",
  "application_form",
  "web_form",
  "pdf_form",
  "official_form",
  "kov_regulation"
]);
export const VALID_RESOURCE_TYPES = new Set([
  "service_page",
  "service",
  "benefit",
  "resource",
  "contact",
  "form",
  "supporting_document",
  "fee_schedule",
  "regulation"
]);
export const VALID_SOURCE_FORMATS = new Set(["html", "pdf", "doc", "docx", "rtf", "odt", "xls", "xlsx", "xml", "json"]);

const LEGACY_KOV_WEB_SOURCE_TYPES = new Set([
  "kov_service_page",
  "kov_benefit_page",
  "kov_resource_page",
  "kov_social_overview",
  "kov_homepage",
  "kov_web",
  "municipality_web"
]);

function normalizeSourceType(value) {
  const type = String(value || "").trim();
  if (type === "kov_contact_page") return "contact_page";
  if (type === "file_attachment") return "kov_service_info";
  if (type === "docx_form" || type === "doc_form" || type === "rtf_form") return "application_form";
  if (LEGACY_KOV_WEB_SOURCE_TYPES.has(type)) return "kov_service_info";
  return type;
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function stableHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

export function cleanArray(value) {
  return Array.isArray(value) ? value.filter(item => item !== null && typeof item !== "undefined" && item !== "") : [];
}

export function uniqueSorted(value) {
  return [...new Set(cleanArray(value).map(item => String(item)))].sort();
}

export function toSnakeId(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/õ/g, "o")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

export function sourceIdForKey(municipalityId, key) {
  const cleanKey = toSnakeId(key);
  return cleanKey.startsWith(`${municipalityId}_`) ? cleanKey : `${municipalityId}_${cleanKey}`;
}

export function sourceFormatFor(source = {}) {
  const explicitFormat = String(source.source_format || "").trim().toLowerCase();
  if (explicitFormat) {
    if (explicitFormat === "web_page" || explicitFormat === "webpage") return "html";
    if (explicitFormat === "pdf_form") return "pdf";
    if (explicitFormat === "doc_form") return "doc";
    if (explicitFormat === "docx_form") return "docx";
    if (explicitFormat === "rtf_form") return "rtf";
    if (explicitFormat === "odt_form") return "odt";
    if (explicitFormat === "text/html") return "html";
    if (explicitFormat === "application/pdf") return "pdf";
    if (explicitFormat === "application/msword") return "doc";
    if (explicitFormat === "application/rtf" || explicitFormat === "text/rtf") return "rtf";
    if (explicitFormat === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
    if (explicitFormat === "application/vnd.ms-excel") return "xls";
    if (explicitFormat === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return "xlsx";
    if (explicitFormat === "application/xml" || explicitFormat === "text/xml") return "xml";
    if (explicitFormat === "application/json") return "json";
    const tagLikeFormat = explicitFormat.split(",").map(part => part.trim()).filter(Boolean);
    if (tagLikeFormat.length > 0 && tagLikeFormat.every(part => ["service", "benefit", "resource", "contact", "form"].includes(part))) {
      return "html";
    }
    return explicitFormat;
  }
  const url = String(source.url || source.url_canonical || "").toLowerCase().split("?")[0];
  const type = String(source.type || "").toLowerCase();
  if (url.endsWith(".pdf") || type === "pdf") return "pdf";
  if (url.endsWith(".doc") || type === "doc") return "doc";
  if (url.endsWith(".docx") || type === "docx") return "docx";
  if (url.endsWith(".rtf") || type === "rtf") return "rtf";
  if (url.endsWith(".odt") || type === "odt") return "odt";
  if (url.endsWith(".xls") || type === "xls") return "xls";
  if (url.endsWith(".xlsx") || type === "xlsx") return "xlsx";
  if (url.endsWith(".xml") || type === "xml") return "xml";
  if (url.endsWith(".json") || type === "json") return "json";
  return "html";
}

export function itemTypeOf(item = {}) {
  return String(item.item_type || item.itemType || "").trim();
}

export function sourceTypeForItem(item = {}) {
  const type = itemTypeOf(item);
  if (type === "contact") return "official_contact";
  if (type === "form") return "application_form";
  return "kov_service_info";
}

export function resourceTypeForItem(item = {}) {
  const type = itemTypeOf(item);
  if (["service", "benefit", "resource", "contact", "form"].includes(type)) return type;
  return "resource";
}

function looksLikeContact(source = {}) {
  const text = `${source.key || ""} ${source.source_key || ""} ${source.type || ""} ${source.title || ""} ${source.url || ""}`.toLowerCase();
  return text.includes("contact") || text.includes("kontakt");
}

function looksLikeForm(source = {}) {
  const format = sourceFormatFor(source);
  const text = `${source.key || ""} ${source.source_key || ""} ${source.type || ""} ${source.title || ""} ${source.url || ""}`.toLowerCase();
  return ["pdf", "doc", "docx", "rtf", "odt", "xls", "xlsx"].includes(format) ||
    text.includes("taotlus") ||
    text.includes("vorm") ||
    text.includes("blankett") ||
    text.includes("nõusolek") ||
    text.includes("nousolek");
}

export function sourceTypeForSource(source = {}) {
  const explicitSourceType = normalizeSourceType(source.source_type);
  if (explicitSourceType) return explicitSourceType;
  if (looksLikeContact(source)) return String(source.type || "").toLowerCase().includes("page") ? "contact_page" : "official_contact";
  if (looksLikeForm(source)) return "application_form";
  return "kov_service_info";
}

export function resourceTypeForSource(source = {}, sourceType = sourceTypeForSource(source)) {
  if (source.resource_type) return String(source.resource_type);
  if (["contact_page", "official_contact", "contact"].includes(sourceType)) return "contact";
  if (["application_form", "web_form", "pdf_form", "official_form"].includes(sourceType)) return "form";
  return "service_page";
}

export function sectionsPresentForSource(source = {}, sourceType = sourceTypeForSource(source), resourceType = resourceTypeForSource(source, sourceType)) {
  if (resourceType === "contact") return ["contacts"];
  if (resourceType === "form") return ["forms"];
  if (sourceType === "kov_service_info") return ["description", "eligibility", "application"];
  if (sourceType === "kov_regulation") return ["legal_basis"];
  return [];
}

export function sourceKeysForItem(item = {}) {
  return uniqueSorted([...(item.sourceKeys || []), ...(item.source_keys || [])]);
}

export function loadManifest(manifestPath) {
  const raw = readJson(manifestPath);
  if (Array.isArray(raw)) return { excluded_slugs: ["harku-vald"], municipalities: raw };
  return {
    excluded_slugs: cleanArray(raw.excluded_slugs),
    municipalities: cleanArray(raw.municipalities)
  };
}

export function pathsForSlug(slug, root = "KOV") {
  const dir = path.join(root, slug);
  return {
    dir,
    json: path.join(dir, `${slug}.json`),
    sources: path.join(dir, `${slug}.sources.json`),
    meta: path.join(dir, `${slug}.meta.json`),
    rag: path.join(dir, `${slug}.rag.md`)
  };
}

export function upgradeKovBundle(entry, options = {}) {
  const root = options.root || "KOV";
  const paths = pathsForSlug(entry.slug, root);
  for (const filePath of [paths.json, paths.sources, paths.meta]) {
    if (!fs.existsSync(filePath)) throw new Error(`${entry.slug}: missing ${filePath}`);
  }

  const data = readJson(paths.json);
  const sourcesDoc = readJson(paths.sources);
  const meta = readJson(paths.meta);
  const checkedAt = data.checkedAt || data.checked_at || sourcesDoc.checkedAt || sourcesDoc.checked_at || meta.checkedAt || meta.checked_at || UPGRADE_DATE;
  const items = cleanArray(data.items);
  const itemIdsByUrl = new Map();
  for (const item of items) {
    if (!item.officialUrl) continue;
    const list = itemIdsByUrl.get(item.officialUrl) || [];
    list.push(item.id);
    itemIdsByUrl.set(item.officialUrl, list);
  }

  let upgradedSources = cleanArray(sourcesDoc.sources).map(source => {
    const sourceKey = source.source_key || source.key || source.source_id || source.sourceId || sourceIdForKey(entry.municipality_id, source.title || source.url);
    const sourceId = source.source_id || sourceIdForKey(entry.municipality_id, sourceKey);
    const sourceType = sourceTypeForSource(source);
    const resourceType = resourceTypeForSource(source, sourceType);
    const sourceFormat = sourceFormatFor(source);
    const relatedCanonicalItemIds = uniqueSorted([...(source.relatedCanonicalItemIds || []), ...(itemIdsByUrl.get(source.url) || [])]);
    return {
      ...source,
      source_id: sourceId,
      document_id: source.document_id || sourceId,
      source_key: sourceKey,
      source_type: sourceType,
      resource_type: resourceType,
      source_format: sourceFormat,
      authority: source.authority || "KOV",
      audience: source.audience || ["CLIENT", "SOCIAL_WORKER"],
      language: source.language || "et",
      municipality: source.municipality || entry.municipality_name,
      municipality_id: source.municipality_id || entry.municipality_id,
      municipality_name: source.municipality_name || entry.municipality_name,
      county: source.county || entry.county,
      jurisdiction_level: source.jurisdiction_level || "MUNICIPALITY",
      collection_id: source.collection_id || "kov_services",
      checked_at: source.checked_at || source.last_checked || checkedAt,
      last_checked: source.last_checked || source.checked_at || checkedAt,
      retrieved_at: source.retrieved_at || source.checked_at || source.last_checked || checkedAt,
      valid_from: source.valid_from ?? null,
      valid_to: source.valid_to ?? null,
      source_status: source.source_status || "active",
      historical: source.historical ?? false,
      evidence_allowed: source.evidence_allowed ?? true,
      url_canonical: source.url_canonical || source.url || null,
      relatedCanonicalItemIds,
      sections_present: source.sections_present || sectionsPresentForSource(source, sourceType, resourceType),
      content_hash: source.content_hash || stableHash({
        source_id: sourceId,
        title: source.title || null,
        url: source.url || null,
        source_type: sourceType,
        resource_type: resourceType
      }),
      metadata_schema_version: source.metadata_schema_version || "v2.5",
      canonical_source_id: source.canonical_source_id || sourceId
    };
  });

  const existingSourceUrls = new Set(upgradedSources.map(source => source.url).filter(Boolean));
  const existingSourceKeys = new Set(upgradedSources.flatMap(source => [source.key, source.source_key].filter(Boolean).map(String)));
  for (const item of items) {
    const type = itemTypeOf(item);
    if (!["service", "benefit", "resource"].includes(type)) continue;
    if (!item.officialUrl || existingSourceUrls.has(item.officialUrl)) continue;
    const sourceKey = `${toSnakeId(item.id)}_page`;
    if (existingSourceKeys.has(sourceKey)) continue;
    const sourceId = sourceIdForKey(entry.municipality_id, sourceKey);
    upgradedSources.push({
      key: sourceKey,
      type: "web_page",
      title: item.title || item.id,
      url: item.officialUrl,
      source_id: sourceId,
      document_id: sourceId,
      source_key: sourceKey,
      source_type: "kov_service_info",
      resource_type: "service_page",
      source_format: sourceFormatFor({ url: item.officialUrl, type: "web_page" }),
      authority: "KOV",
      audience: ["CLIENT", "SOCIAL_WORKER"],
      language: "et",
      municipality: entry.municipality_name,
      municipality_id: entry.municipality_id,
      municipality_name: entry.municipality_name,
      county: entry.county,
      jurisdiction_level: "MUNICIPALITY",
      collection_id: "kov_services",
      checked_at: checkedAt,
      last_checked: checkedAt,
      retrieved_at: checkedAt,
      valid_from: null,
      valid_to: null,
      source_status: "active",
      historical: false,
      evidence_allowed: true,
      url_canonical: item.officialUrl,
      relatedCanonicalItemIds: [item.id],
      sections_present: ["description", "eligibility", "application"],
      content_hash: stableHash({
        source_id: sourceId,
        title: item.title || null,
        url: item.officialUrl,
        source_type: "kov_service_info",
        resource_type: "service_page"
      }),
      metadata_schema_version: "v2.5",
      canonical_source_id: sourceId,
      generated_from_existing_item: true
    });
    existingSourceUrls.add(item.officialUrl);
    existingSourceKeys.add(sourceKey);
  }

  const sourceKeysByUrl = new Map();
  for (const source of upgradedSources) {
    if (!source.url) continue;
    const list = sourceKeysByUrl.get(source.url) || [];
    list.push(source.source_key || source.key);
    sourceKeysByUrl.set(source.url, list);
  }

  const upgradedItems = items.map(item => {
    const itemType = itemTypeOf(item) || item.itemType || item.item_type;
    const itemSourceType = sourceTypeForItem({ ...item, item_type: itemType });
    const itemResourceType = resourceTypeForItem({ ...item, item_type: itemType });
    const keys = uniqueSorted([...sourceKeysForItem(item), ...(sourceKeysByUrl.get(item.officialUrl) || [])]);
    const normalizedItemSourceType = normalizeSourceType(item.source_type) || itemSourceType;
    return {
      ...item,
      itemType: item.itemType || itemType,
      item_type: item.item_type || itemType,
      municipality_id: item.municipality_id || entry.municipality_id,
      municipality_name: item.municipality_name || entry.municipality_name,
      county: item.county || entry.county,
      sourceKeys: keys,
      source_keys: keys,
      metadata_schema_version: item.metadata_schema_version || "v2.5",
      source_id: item.source_id || item.id,
      document_id: item.document_id || item.id,
      canonical_item_id: item.canonical_item_id || item.id,
      source_type: normalizedItemSourceType,
      resource_type: item.resource_type || itemResourceType,
      collection_id: item.collection_id || "kov_services",
      authority: item.authority || "KOV",
      audience: item.audience || ["CLIENT", "SOCIAL_WORKER"],
      language: item.language || "et",
      checked_at: item.checked_at || item.last_checked || checkedAt,
      last_checked: item.last_checked || item.checked_at || checkedAt,
      retrieved_at: item.retrieved_at || item.checked_at || item.last_checked || checkedAt,
      valid_from: item.valid_from ?? null,
      valid_to: item.valid_to ?? null,
      historical: item.historical ?? false,
      source_status: item.source_status || item.status || "active",
      url_canonical: item.url_canonical || item.officialUrl || null,
      content_hash: item.content_hash || stableHash({
        id: item.id,
        title: item.title || null,
        summary: item.summary || null,
        targetGroup: item.targetGroup || null,
        conditions: item.conditions || null,
        application: item.application || null,
        amount: item.amount || null,
        deadline: item.deadline || null,
        decisionTime: item.decisionTime || null,
        officialUrl: item.officialUrl || null
      }),
      evidence_allowed: item.evidence_allowed ?? true
    };
  });

  const upgradedData = {
    ...data,
    municipality: entry.municipality_name,
    municipality_id: entry.municipality_id,
    municipality_name: entry.municipality_name,
    county: entry.county,
    checked_at: data.checked_at || checkedAt,
    schemaVersion: data.schemaVersion || SCHEMA_VERSION,
    lastMetadataUpgradeAt: UPGRADE_DATE,
    items: upgradedItems
  };

  const counts = {
    services: upgradedItems.filter(item => item.item_type === "service").length,
    benefits: upgradedItems.filter(item => item.item_type === "benefit").length,
    resources: upgradedItems.filter(item => item.item_type === "resource").length,
    contacts: upgradedItems.filter(item => item.item_type === "contact").length,
    forms: upgradedItems.filter(item => item.item_type === "form").length,
    regulations: upgradedSources.filter(source => source.source_type === "kov_regulation").length
  };

  const serviceLike = upgradedItems.filter(item => ["service", "benefit", "resource"].includes(item.item_type));
  const upgradedSourceKeys = new Set(upgradedSources.flatMap(source => [source.key, source.source_key].filter(Boolean).map(String)));
  const itemIds = new Set(upgradedItems.map(item => item.id));
  const itemsMissingSourceKeys = serviceLike.filter(item => !sourceKeysForItem(item).length).map(item => item.id);
  const brokenSourceKeys = upgradedItems.flatMap(item =>
    sourceKeysForItem(item).filter(key => !upgradedSourceKeys.has(key)).map(key => ({ item_id: item.id, source_key: key }))
  );
  const brokenRelatedForms = upgradedItems.flatMap(item =>
    cleanArray(item.relatedForms).filter(id => !itemIds.has(id)).map(id => ({ item_id: item.id, related_form: id }))
  );
  const brokenRelatedContacts = upgradedItems.flatMap(item =>
    cleanArray(item.relatedContacts).filter(id => !itemIds.has(id)).map(id => ({ item_id: item.id, related_contact: id }))
  );
  const heuristicWarnings = [];
  const ambiguousSources = upgradedSources.filter(source => source.source_type === "kov_service_info" && source.resource_type === "service_page" && !source.relatedCanonicalItemIds.length);
  if (ambiguousSources.length) heuristicWarnings.push(`${ambiguousSources.length} source'i jäid üldiseks kov_service_info/service_page allikaks ilma otsese item seoseta.`);
  if (brokenSourceKeys.length) heuristicWarnings.push(`${brokenSourceKeys.length} sourceKeys/source_keys viidet ei lahene.`);
  if (brokenRelatedForms.length) heuristicWarnings.push(`${brokenRelatedForms.length} relatedForms viidet ei lahene.`);
  if (brokenRelatedContacts.length) heuristicWarnings.push(`${brokenRelatedContacts.length} relatedContacts viidet ei lahene.`);

  const readinessOk = itemsMissingSourceKeys.length === 0 &&
    brokenSourceKeys.length === 0 &&
    upgradedItems.every(item => item.municipality_id) &&
    upgradedSources.every(source => source.municipality_id && source.collection_id === "kov_services" && source.jurisdiction_level === "MUNICIPALITY");

  const sourcePackageReadiness = {
    ok: readinessOk,
    collection_id: "kov_services",
    municipality_id: entry.municipality_id,
    source_register_file: `${entry.slug}.sources.json`,
    service_benefit_resource_items: serviceLike.length,
    items_with_source_keys: serviceLike.length - itemsMissingSourceKeys.length,
    items_missing_source_keys: itemsMissingSourceKeys,
    items_with_related_forms: serviceLike.filter(item => cleanArray(item.relatedForms).length).length,
    items_without_related_forms: serviceLike.filter(item => !cleanArray(item.relatedForms).length).length,
    items_with_related_contacts: serviceLike.filter(item => cleanArray(item.relatedContacts).length).length,
    items_without_related_contacts: serviceLike.filter(item => !cleanArray(item.relatedContacts).length).length,
    form_sources: upgradedSources.filter(source => source.resource_type === "form").length,
    contact_sources: upgradedSources.filter(source => source.resource_type === "contact").length,
    regulation_sources: counts.regulations,
    warnings: heuristicWarnings
  };

  const upgradedMeta = {
    ...meta,
    schemaVersion: SCHEMA_VERSION,
    municipality: entry.municipality_name,
    municipality_id: entry.municipality_id,
    municipality_name: entry.municipality_name,
    county: entry.county,
    checked_at: meta.checked_at || meta.checkedAt || checkedAt,
    lastMetadataUpgradeAt: UPGRADE_DATE,
    ingestReady: readinessOk,
    status: readinessOk ? "ingest_ready" : "needs_review",
    country: "EE",
    language: "et",
    collection_id: "kov_services",
    jurisdiction_level: "MUNICIPALITY",
    sourceRegisterFile: `${entry.slug}.sources.json`,
    sourceCount: upgradedSources.length,
    counts,
    coverage: { ...(meta.coverage || {}), ...counts },
    sourcePackageReadiness,
    warnings: uniqueSorted([...(meta.warnings || []), ...heuristicWarnings])
  };

  const upgradedSourcesDoc = {
    ...sourcesDoc,
    municipality: entry.municipality_name,
    municipality_id: entry.municipality_id,
    municipality_name: entry.municipality_name,
    county: entry.county,
    checked_at: sourcesDoc.checked_at || sourcesDoc.checkedAt || checkedAt,
    schemaVersion: sourcesDoc.schemaVersion || SCHEMA_VERSION,
    lastMetadataUpgradeAt: UPGRADE_DATE,
    sources: upgradedSources
  };

  return {
    entry,
    paths,
    data: upgradedData,
    sources: upgradedSourcesDoc,
    meta: upgradedMeta,
    summary: {
      slug: entry.slug,
      itemCount: upgradedItems.length,
      sourceCount: upgradedSources.length,
      counts,
      ingestReady: readinessOk,
      sourcePackageReadiness
    }
  };
}

export function backupFiles(paths, timestamp) {
  const files = [paths.sources, paths.json, paths.meta];
  if (fs.existsSync(paths.rag)) files.push(paths.rag);
  return files.map(filePath => {
    const backupPath = `${filePath}.bak-${timestamp}`;
    fs.copyFileSync(filePath, backupPath);
    return backupPath;
  });
}

export function writeUpgrade(result, timestamp) {
  const backups = backupFiles(result.paths, timestamp);
  writeJson(result.paths.sources, result.sources);
  writeJson(result.paths.json, result.data);
  writeJson(result.paths.meta, result.meta);
  return backups;
}

export function validateKovBundle(entry, options = {}) {
  const root = options.root || "KOV";
  const paths = pathsForSlug(entry.slug, root);
  const errors = [];
  const warnings = [];
  for (const filePath of [paths.json, paths.sources, paths.meta, paths.rag]) {
    if (!fs.existsSync(filePath)) errors.push(`${entry.slug}: missing ${filePath}`);
  }
  if (errors.length) return { slug: entry.slug, ok: false, errors, warnings };

  const data = readJson(paths.json);
  const sourcesDoc = readJson(paths.sources);
  const meta = readJson(paths.meta);
  const items = cleanArray(data.items);
  const sources = cleanArray(sourcesDoc.sources);
  const itemIds = new Set(items.map(item => item.id));
  const sourceKeys = new Set(sources.flatMap(source => [source.key, source.source_key].filter(Boolean).map(String)));

  const requiredSourceFields = [
    "source_id", "document_id", "source_key", "source_type", "resource_type", "source_format",
    "authority", "audience", "language", "municipality_id", "municipality_name", "county",
    "jurisdiction_level", "collection_id", "checked_at", "last_checked", "retrieved_at",
    "valid_from", "valid_to", "source_status", "historical", "evidence_allowed",
    "url_canonical", "relatedCanonicalItemIds", "sections_present", "content_hash",
    "metadata_schema_version", "canonical_source_id"
  ];
  const requiredItemFields = [
    "item_type", "municipality_id", "municipality_name", "county", "source_keys",
    "metadata_schema_version", "source_id", "document_id", "canonical_item_id", "source_type",
    "resource_type", "collection_id", "authority", "audience", "language", "checked_at",
    "last_checked", "retrieved_at", "valid_from", "valid_to", "historical", "source_status",
    "url_canonical", "content_hash", "evidence_allowed"
  ];
  for (const [index, source] of sources.entries()) {
    for (const field of requiredSourceFields) {
      if (!(field in source)) errors.push(`${entry.slug}: source[${index}] missing ${field}`);
    }
    if (!VALID_SOURCE_TYPES.has(source.source_type)) errors.push(`${entry.slug}: source ${source.source_id || index} invalid source_type ${source.source_type}`);
    if (!VALID_RESOURCE_TYPES.has(source.resource_type)) errors.push(`${entry.slug}: source ${source.source_id || index} invalid resource_type ${source.resource_type}`);
    if (!VALID_SOURCE_FORMATS.has(source.source_format)) errors.push(`${entry.slug}: source ${source.source_id || index} invalid source_format ${source.source_format}`);
    if (source.municipality_id !== entry.municipality_id) errors.push(`${entry.slug}: source ${source.source_id || index} wrong municipality_id ${source.municipality_id}`);
    if (source.collection_id !== "kov_services") errors.push(`${entry.slug}: source ${source.source_id || index} wrong collection_id ${source.collection_id}`);
    if (source.jurisdiction_level !== "MUNICIPALITY") errors.push(`${entry.slug}: source ${source.source_id || index} wrong jurisdiction_level ${source.jurisdiction_level}`);
  }
  for (const [index, item] of items.entries()) {
    for (const field of requiredItemFields) {
      if (!(field in item)) errors.push(`${entry.slug}: item[${index}] ${item.id || ""} missing ${field}`);
    }
    if (!VALID_SOURCE_TYPES.has(item.source_type)) errors.push(`${entry.slug}: item ${item.id || index} invalid source_type ${item.source_type}`);
    if (!VALID_RESOURCE_TYPES.has(item.resource_type)) errors.push(`${entry.slug}: item ${item.id || index} invalid resource_type ${item.resource_type}`);
    if (item.municipality_id !== entry.municipality_id) errors.push(`${entry.slug}: item ${item.id || index} wrong municipality_id ${item.municipality_id}`);
    if (item.collection_id !== "kov_services") errors.push(`${entry.slug}: item ${item.id || index} wrong collection_id ${item.collection_id}`);
    for (const key of sourceKeysForItem(item)) {
      if (!sourceKeys.has(key)) errors.push(`${entry.slug}: item ${item.id || index} broken source_key ${key}`);
    }
    for (const id of cleanArray(item.relatedForms)) {
      if (!itemIds.has(id)) errors.push(`${entry.slug}: item ${item.id || index} broken relatedForms ${id}`);
    }
    for (const id of cleanArray(item.relatedContacts)) {
      if (!itemIds.has(id)) errors.push(`${entry.slug}: item ${item.id || index} broken relatedContacts ${id}`);
    }
  }

  for (const field of ["schemaVersion", "municipality_id", "municipality_name", "checked_at", "lastMetadataUpgradeAt", "ingestReady", "country", "language", "collection_id", "jurisdiction_level", "sourceRegisterFile", "sourceCount", "counts", "sourcePackageReadiness"]) {
    if (!(field in meta)) errors.push(`${entry.slug}: meta missing ${field}`);
  }
  if (meta.municipality_id !== entry.municipality_id) errors.push(`${entry.slug}: meta wrong municipality_id ${meta.municipality_id}`);
  if (meta.collection_id !== "kov_services") errors.push(`${entry.slug}: meta wrong collection_id ${meta.collection_id}`);
  if (meta.jurisdiction_level !== "MUNICIPALITY") errors.push(`${entry.slug}: meta wrong jurisdiction_level ${meta.jurisdiction_level}`);
  if (meta.sourceCount !== sources.length) errors.push(`${entry.slug}: meta sourceCount ${meta.sourceCount} != ${sources.length}`);
  if (meta.sourcePackageReadiness?.items_missing_source_keys?.length) warnings.push(`${entry.slug}: items_missing_source_keys=${meta.sourcePackageReadiness.items_missing_source_keys.length}`);

  return { slug: entry.slug, ok: errors.length === 0, errors, warnings, summary: meta.sourcePackageReadiness };
}
