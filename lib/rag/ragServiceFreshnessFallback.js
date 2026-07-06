const DEFAULT_LIMIT = 1000;
const PAGE_SIZE = 100;

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function firstValue(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && !value.trim()) continue;
    return value;
  }
  return null;
}

function normalizeMetadata(doc = {}) {
  const metadata = isObject(doc.metadata) ? { ...doc.metadata } : {};
  const docId = firstValue(doc.docId, doc.document_id, doc.documentId, doc.remoteId, doc.id);
  const sourceId = firstValue(doc.source_id, doc.sourceId, metadata.source_id, metadata.sourceId, docId);

  return {
    ...doc,
    ...metadata,
    source_id: sourceId,
    document_id: firstValue(doc.document_id, doc.documentId, metadata.document_id, metadata.documentId, docId),
    title: firstValue(doc.title, metadata.title, doc.fileName, doc.name),
    source_type: firstValue(doc.source_type, doc.sourceType, metadata.source_type, metadata.sourceType, doc.type),
    authority: firstValue(doc.authority, metadata.authority),
    language: firstValue(doc.language, metadata.language),
    source_status: firstValue(doc.source_status, doc.sourceStatus, metadata.source_status, metadata.sourceStatus),
    last_checked: firstValue(doc.last_checked, doc.lastChecked, metadata.last_checked, metadata.lastChecked),
    url: firstValue(doc.url, doc.sourceUrl, metadata.url_canonical, metadata.urlCanonical, metadata.url, metadata.sourceUrl),
    fileName: firstValue(doc.fileName, metadata.fileName, metadata.file_name),
    mimeType: firstValue(doc.mimeType, metadata.mimeType, metadata.mime_type)
  };
}

export function normalizeRagServiceDocumentForFreshness(doc = {}) {
  const metadata = normalizeMetadata(doc);
  const docId = firstValue(metadata.document_id, doc.docId, doc.id);

  return {
    id: firstValue(doc.id, docId),
    remoteId: docId,
    title: firstValue(doc.title, metadata.title, doc.fileName),
    type: firstValue(doc.type, metadata.type, metadata.source_type),
    status: firstValue(doc.status, metadata.status),
    audience: firstValue(doc.audience, metadata.audience),
    sourceUrl: firstValue(doc.sourceUrl, doc.url, metadata.url),
    fileName: firstValue(doc.fileName, metadata.fileName),
    mimeType: firstValue(doc.mimeType, metadata.mimeType),
    metadata,
    insertedAt: firstValue(doc.insertedAt, doc.createdAt, doc.lastIngested, metadata.insertedAt, metadata.createdAt),
    createdAt: firstValue(doc.createdAt, metadata.createdAt),
    updatedAt: firstValue(doc.updatedAt, doc.lastIngested, metadata.updatedAt, metadata.lastIngested)
  };
}

export async function fetchRagServiceDocumentsForFreshness(options = {}) {
  const limit = Number.isFinite(Number(options.limit)) && Number(options.limit) > 0
    ? Math.floor(Number(options.limit))
    : DEFAULT_LIMIT;
  const requestedPageSize = Number.isFinite(Number(options.pageSize)) && Number(options.pageSize) > 0
    ? Math.floor(Number(options.pageSize))
    : PAGE_SIZE;
  const pageSize = Math.min(PAGE_SIZE, requestedPageSize, limit);
  const ragService = options.request
    ? null
    : await import("../documents/ragService.js");
  const request = options.request || ragService.ragServiceRequest;
  const headers = options.headers || ragService?.buildRagHeaders?.(null, {
    route: "admin_analytics_summary",
    stage: "rag_freshness_fallback"
  });
  const out = [];

  for (let offset = 0; out.length < limit; offset += pageSize) {
    const params = new URLSearchParams({
      limit: String(Math.min(pageSize, limit - out.length)),
      offset: String(offset)
    });
    const page = await request(`/documents?${params.toString()}`, {
      method: "GET",
      headers
    });
    const items = Array.isArray(page) ? page : [];
    out.push(...items.map(normalizeRagServiceDocumentForFreshness));
    if (items.length < pageSize) break;
  }

  return out;
}
