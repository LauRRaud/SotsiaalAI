const ORGANIZATION_SCHEMA_VERSION = "organization-source-v1";
const ORGANIZATION_COLLECTION_ID = "organizations";
const ORGANIZATION_CORE_FILE_NAMES = Object.freeze({
  sourcesJson: "{slug}.sources.json",
  dataJson: "{slug}.json",
  metaJson: "{slug}.meta.json",
  ragMd: "{slug}.rag.md"
});

const DOCUMENT_STATUS_VALUES = Object.freeze([
  "referenced_only",
  "ingest_candidate",
  "ingest_ready",
  "needs_review"
]);

function clean(value) {
  return String(value || "").trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values = []) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const normalized = clean(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

export function expectedOrganizationCoreFileName(slug, fileKey) {
  const pattern = ORGANIZATION_CORE_FILE_NAMES[fileKey];
  return pattern ? pattern.replace("{slug}", clean(slug).toLowerCase()) : "";
}

export function normalizeOrganizationSourcesPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.sources)) return payload.sources;
  return [];
}

function collectOrganizationDataItems(dataPayload = {}) {
  return [
    dataPayload,
    ...asArray(dataPayload.services),
    ...asArray(dataPayload.resources),
    ...asArray(dataPayload.contacts),
    ...asArray(dataPayload.documents)
  ];
}

function collectOrganizationReferencedSourceKeys(dataPayload = {}) {
  return uniqueStrings([
    ...asArray(dataPayload.sourceKeys),
    ...collectOrganizationDataItems(dataPayload).flatMap(item => asArray(item?.sourceKeys))
  ]);
}

export function summarizeOrganizationDocuments(dataPayload = {}) {
  const documents = asArray(dataPayload.documents);
  const counts = Object.fromEntries(DOCUMENT_STATUS_VALUES.map(status => [status, 0]));
  const items = documents.map(document => {
    const status = DOCUMENT_STATUS_VALUES.includes(clean(document?.document_status))
      ? clean(document.document_status)
      : "needs_review";
    counts[status] += 1;
    return {
      id: clean(document?.id),
      title: clean(document?.title),
      document_status: status,
      source_type: clean(document?.source_type),
      resource_type: clean(document?.resource_type),
      source_format: clean(document?.source_format),
      source_url: clean(document?.source_url || document?.url),
      source_path: document?.source_path || null,
      metadata_file: document?.metadata_file || null,
      sourceKeys: asArray(document?.sourceKeys).map(clean).filter(Boolean)
    };
  });

  return {
    total: documents.length,
    ...counts,
    items
  };
}

export function buildOrganizationRagDocId(slug) {
  return `organization-${clean(slug).toLowerCase()}`;
}

export function buildOrganizationRagPayloadPreview({ slug, metaPayload = {}, sourcesPayload = [], dataPayload = {} }) {
  const sources = normalizeOrganizationSourcesPayload(sourcesPayload);
  const sourceKeys = uniqueStrings(sources.map(source => source?.key));
  const organizationId = clean(dataPayload.organization_id || metaPayload.organization_id || slug).toLowerCase();
  const title = clean(dataPayload.name || metaPayload.organization_name || metaPayload.title || organizationId);
  const checkedAt = clean(metaPayload.checked_at || dataPayload.checked_at || sources[0]?.checked_at);

  return {
    docId: buildOrganizationRagDocId(slug || organizationId),
    title,
    organization_id: organizationId,
    organization_name: title,
    slug: clean(dataPayload.slug || metaPayload.slug || organizationId).toLowerCase(),
    organization_type: clean(dataPayload.organization_type || metaPayload.organization_type || "service_provider"),
    collection_id: ORGANIZATION_COLLECTION_ID,
    source_type: clean(dataPayload.source_type || metaPayload.source_type || "organization_profile"),
    resource_type: clean(dataPayload.resource_type || metaPayload.resource_type || "organization_profile"),
    authority: clean(dataPayload.authority || metaPayload.authority || "organization_official"),
    language: clean(dataPayload.language || metaPayload.language || "et"),
    audience: dataPayload.audience || metaPayload.audience || null,
    audiences: asArray(dataPayload.audiences || metaPayload.audiences),
    scope: dataPayload.scope || metaPayload.scope || null,
    region: dataPayload.region || metaPayload.region || dataPayload.county || metaPayload.county || null,
    focus: dataPayload.focus || metaPayload.focus || null,
    target_groups: asArray(dataPayload.target_groups || metaPayload.target_groups),
    sourceRegisterFile: clean(metaPayload.sourceRegisterFile),
    sourceCount: sources.length,
    checked_at: checkedAt || null,
    source_status: clean(dataPayload.source_status || metaPayload.source_status || "active"),
    historical: dataPayload.historical === true || metaPayload.historical === true,
    evidence_allowed: dataPayload.evidence_allowed !== false && metaPayload.evidence_allowed !== false,
    officialUrl: dataPayload.officialUrl || metaPayload.officialUrl || sources[0]?.url || null,
    sourceKeys,
    legal_basis: false,
    documentsAutoIngest: false
  };
}

function buildOrganizationChunkMetadataPreview(ragPayload = {}) {
  return {
    docId: ragPayload.docId,
    organization_id: ragPayload.organization_id,
    organization_name: ragPayload.organization_name,
    collection_id: ORGANIZATION_COLLECTION_ID,
    source_type: ragPayload.source_type || "organization_profile",
    resource_type: ragPayload.resource_type || "organization_profile",
    authority: ragPayload.authority || "organization_official",
    language: ragPayload.language || "et",
    checked_at: ragPayload.checked_at || null,
    source_status: ragPayload.source_status || "active",
    historical: ragPayload.historical === true,
    legal_basis: false
  };
}

export function validateOrganizationPackagePayload({ slug, fileNames = {}, metaPayload = {}, sourcesPayload = [], dataPayload = {}, ragText = "" } = {}) {
  const errors = [];
  const warnings = [];
  const normalizedSlug = clean(slug || dataPayload.slug || metaPayload.slug).toLowerCase();
  const sources = normalizeOrganizationSourcesPayload(sourcesPayload);
  const sourceKeys = uniqueStrings(sources.map(source => source?.key));
  const sourceKeySet = new Set(sourceKeys);
  const referencedSourceKeys = collectOrganizationReferencedSourceKeys(dataPayload);
  const missingSourceKeys = referencedSourceKeys.filter(key => !sourceKeySet.has(key));
  const documentsSummary = summarizeOrganizationDocuments(dataPayload);

  for (const [fileKey] of Object.entries(ORGANIZATION_CORE_FILE_NAMES)) {
    const expected = expectedOrganizationCoreFileName(normalizedSlug, fileKey);
    const actual = clean(fileNames[fileKey] || expected);
    if (actual !== expected) errors.push(`${fileKey} filename must be ${expected}`);
  }

  if (clean(metaPayload.schemaVersion) !== ORGANIZATION_SCHEMA_VERSION) errors.push(`meta.schemaVersion must be ${ORGANIZATION_SCHEMA_VERSION}`);
  if (clean(metaPayload.collection_id) !== ORGANIZATION_COLLECTION_ID) errors.push(`meta.collection_id must be ${ORGANIZATION_COLLECTION_ID}`);
  if (clean(dataPayload.collection_id) && clean(dataPayload.collection_id) !== ORGANIZATION_COLLECTION_ID) errors.push(`data.collection_id must be ${ORGANIZATION_COLLECTION_ID}`);
  if (clean(metaPayload.organization_id).toLowerCase() !== normalizedSlug) errors.push(`meta.organization_id must be ${normalizedSlug}`);
  if (clean(dataPayload.organization_id).toLowerCase() !== normalizedSlug) errors.push(`data.organization_id must be ${normalizedSlug}`);
  if (clean(metaPayload.slug).toLowerCase() !== normalizedSlug) errors.push(`meta.slug must be ${normalizedSlug}`);
  if (clean(dataPayload.slug).toLowerCase() !== normalizedSlug) errors.push(`data.slug must be ${normalizedSlug}`);
  if (clean(metaPayload.sourceRegisterFile) !== expectedOrganizationCoreFileName(normalizedSlug, "sourcesJson")) {
    errors.push(`meta.sourceRegisterFile must be ${expectedOrganizationCoreFileName(normalizedSlug, "sourcesJson")}`);
  }
  if (!sources.length) errors.push("sources.json must contain at least one source");
  if (Number(metaPayload.sourceCount) !== sources.length) errors.push(`meta.sourceCount must match sources count (${sources.length})`);
  if (!clean(ragText)) errors.push(`${expectedOrganizationCoreFileName(normalizedSlug, "ragMd")} must not be empty`);
  if (missingSourceKeys.length) errors.push(`Unknown sourceKeys referenced: ${missingSourceKeys.join(", ")}`);

  sources.forEach((source, index) => {
    if (!clean(source?.key)) errors.push(`sources[${index}].key is required`);
    if (!clean(source?.title)) errors.push(`sources[${index}].title is required`);
    if (!clean(source?.url || source?.source_url)) errors.push(`sources[${index}].url or source_url is required`);
    const format = clean(source?.source_format || source?.format).toLowerCase();
    if (format && !["html", "pdf", "md", "txt", "docx", "csv", "json"].includes(format)) {
      errors.push(`sources[${index}].source_format is unsupported: ${format}`);
    }
  });

  documentsSummary.items.forEach((document, index) => {
    if (!document.id) errors.push(`documents[${index}].id is required`);
    if (!document.title) errors.push(`documents[${index}].title is required`);
    if (!document.source_url && !document.source_path) errors.push(`documents[${index}] needs source_url or source_path`);
    if (document.source_path && !document.source_url) warnings.push(`documents[${index}] uses local source_path without remote source_url`);
    for (const sourceKey of document.sourceKeys) {
      if (!sourceKeySet.has(sourceKey)) errors.push(`documents[${index}] references unknown sourceKey ${sourceKey}`);
    }
  });

  if (metaPayload.ingestReady === true && errors.length) {
    errors.push("meta.ingestReady=true but package validation has blocking errors");
  }
  if (metaPayload.readiness?.ok === true && errors.length) {
    errors.push("meta.readiness.ok=true but package validation has blocking errors");
  }
  if (dataPayload.legal_basis === true || metaPayload.legal_basis === true) {
    errors.push("organization profile must not be legal_basis");
  }
  if (metaPayload.documentPolicy?.documentsAutoIngest === true) {
    errors.push("documentsAutoIngest must be false for organization profile ingest");
  }

  const ragPayloadPreview = buildOrganizationRagPayloadPreview({
    slug: normalizedSlug,
    metaPayload,
    sourcesPayload: sources,
    dataPayload
  });

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    slug: normalizedSlug,
    core_files_present: true,
    metadata_valid: errors.length === 0,
    ingest_ready: errors.length === 0 && metaPayload.ingestReady === true,
    rag_doc_id: ragPayloadPreview.docId,
    sourceKeys,
    referencedSourceKeys,
    source_key_reference_errors: missingSourceKeys,
    documents_summary: documentsSummary,
    remote_source_url_supported: true,
    rag_payload_preview: ragPayloadPreview,
    chunk_metadata_preview: buildOrganizationChunkMetadataPreview(ragPayloadPreview),
    risks: [
      ...(documentsSummary.ingest_candidate || documentsSummary.ingest_ready
        ? ["documents[] entries are references only; separate document ingest must use knowledge-doc workflow."]
        : []),
      ...(documentsSummary.needs_review ? ["Some documents[] entries need review before separate ingest."] : [])
    ],
    recommended_fixes: errors
  };
}
