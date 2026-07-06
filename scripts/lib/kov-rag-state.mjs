import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_RAG_BASE_URL = normalizeBaseFromHost(
  process.env.RAG_INTERNAL_HOST || process.env.RAG_API_BASE || "127.0.0.1:8000"
);
export const DEFAULT_REGISTRY_PATH = process.env.RAG_REGISTRY_PATH || "/var/lib/sotsiaalai-rag/registry.json";

export function clean(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

export function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

export function unique(values = []) {
  return [...new Set(values.map(clean).filter(Boolean))].sort();
}

export function normalizeBaseFromHost(host) {
  const trimmed = String(host || "").trim().replace(/\/+$/u, "");
  if (!trimmed) return "http://127.0.0.1:8000";
  if (/^https?:\/\//iu.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

export function slugToMunicipalityId(slug) {
  return clean(slug)?.replace(/-/gu, "_") || null;
}

export function municipalityIdToSlug(municipalityId) {
  return clean(municipalityId)?.replace(/_/gu, "-") || null;
}

export function buildKovRagDocId(slug) {
  return `kov-${String(slug || "").trim().toLowerCase()}`;
}

export function buildKovRtRagDocId(slug) {
  return `kov-rt-${String(slug || "").trim().toLowerCase()}`;
}

export function normalizeCanonicalId(value) {
  let text = clean(value);
  if (!text) return null;
  const duplicatePrefixes = [
    "jogeva_vald_service_jogeva_vald_service_",
    "jogeva_vald_benefit_jogeva_vald_benefit_"
  ];
  for (const prefix of duplicatePrefixes) {
    if (text.startsWith(prefix)) {
      return `${prefix.slice(0, prefix.indexOf("_jogeva_vald_"))}_${text.slice(prefix.length)}`;
    }
  }
  return text;
}

export async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(/*turbopackIgnore: true*/ filePath, "utf8"));
  } catch {
    return null;
  }
}

export async function readText(filePath) {
  try {
    return await fs.readFile(/*turbopackIgnore: true*/ filePath, "utf8");
  } catch {
    return null;
  }
}

export async function writeJson(filePath, payload) {
  await fs.mkdir(/*turbopackIgnore: true*/ path.dirname(filePath), { recursive: true });
  await fs.writeFile(/*turbopackIgnore: true*/ filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export async function discoverKovMunicipalities(root = "KOV") {
  const rootPath = path.resolve(/*turbopackIgnore: true*/ process.cwd(), root);
  let entries = [];
  try {
    entries = await fs.readdir(/*turbopackIgnore: true*/ rootPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const out = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    const metaPath = path.join(/*turbopackIgnore: true*/ rootPath, slug, `${slug}.meta.json`);
    const meta = await readJson(metaPath);
    if (!meta) continue;
    out.push({
      municipality_id: clean(meta.municipality_id) || slugToMunicipalityId(slug),
      municipality_name: clean(meta.municipality_name || meta.municipality),
      slug,
      root: path.join(/*turbopackIgnore: true*/ rootPath, slug),
      county: clean(meta.county)
    });
  }
  return out.sort((a, b) => String(a.slug).localeCompare(String(b.slug)));
}

export async function readKovBundleReadiness(municipality = {}, root = "KOV") {
  const slug = clean(municipality.slug) || municipalityIdToSlug(municipality.municipality_id || municipality.municipalityId);
  if (!slug) {
    return {
      slug: null,
      meta_path: null,
      bundle_exists: false,
      source_package_readiness_ok: false,
      ingest_ready: false,
      status: "missing_slug",
      error: "Missing municipality slug"
    };
  }

  const metaPath = path.join(/*turbopackIgnore: true*/ root, slug, `${slug}.meta.json`);
  const meta = await readJson(metaPath);
  if (!meta) {
    return {
      slug,
      meta_path: metaPath,
      bundle_exists: false,
      source_package_readiness_ok: false,
      ingest_ready: false,
      status: "missing_meta",
      error: "Metadata file not found"
    };
  }

  const readinessOk = meta.sourcePackageReadiness?.ok === true || meta.ingestReady === true;
  return {
    slug,
    meta_path: metaPath,
    bundle_exists: true,
    source_package_readiness_ok: meta.sourcePackageReadiness?.ok === true,
    ingest_ready: meta.ingestReady === true,
    status: clean(meta.status),
    collection_id: clean(meta.collection_id),
    municipality_id: clean(meta.municipality_id) || slugToMunicipalityId(slug),
    municipality_name: clean(meta.municipality_name || meta.municipality),
    ready_for_admin_reset: readinessOk,
    error: null
  };
}

function isoOrNull(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value?.toISOString?.() || null;
}

export function serializeKovAdminCleanupState(row = null, municipality = {}) {
  const slug = clean(row?.municipality?.slug || row?.slug || municipality.slug) || municipalityIdToSlug(municipality.municipality_id);
  return {
    id: clean(row?.id),
    municipality_id: clean(row?.municipalityId || row?.municipality_id || municipality.municipality_id),
    slug,
    municipality_name: clean(row?.municipality?.displayName || row?.municipality_name || municipality.municipality_name),
    adminStatus: clean(row?.status),
    readyForIngest: row?.readyForIngest === true,
    ingestStatus: clean(row?.ingestStatus),
    lastIngestedAt: isoOrNull(row?.lastIngestedAt),
    lastIngestError: clean(row?.lastIngestError),
    rtIngestStatus: clean(row?.rtIngestStatus),
    rtLastIngestedAt: isoOrNull(row?.rtLastIngestedAt),
    rtLastIngestError: clean(row?.rtLastIngestError),
    ragDocId: clean(row?.ragDocId) || (slug ? buildKovRagDocId(slug) : null),
    expectedWebDocId: slug ? buildKovRagDocId(slug) : null,
    rtRagDocId: clean(row?.rtRagDocId) || (slug ? buildKovRtRagDocId(slug) : null),
    expectedRtDocId: slug ? buildKovRtRagDocId(slug) : null
  };
}

export function buildKovAdminStatusResetPlan({
  row = null,
  municipality = {},
  bundleReadiness = {},
  webDocumentExists = false,
  rtDocumentExists = false
} = {}) {
  const before = serializeKovAdminCleanupState(row, municipality);
  const hasAdminRow = Boolean(before.id);
  const nextAdminStatus = before.adminStatus === "NOT_STARTED" ? "NOT_STARTED" : "NEEDS_REVIEW";
  const after = hasAdminRow
    ? {
        adminStatus: nextAdminStatus,
        readyForIngest: false,
        ingestStatus: "NOT_INGESTED",
        lastIngestedAt: null,
        lastIngestError: null,
        rtIngestStatus: "NOT_INGESTED",
        rtLastIngestedAt: null,
        rtLastIngestError: null,
        ragDocId: before.ragDocId,
        expectedWebDocId: before.expectedWebDocId,
        rtRagDocId: before.rtRagDocId,
        expectedRtDocId: before.expectedRtDocId
      }
    : null;
  const changes = {};

  if (hasAdminRow) {
    for (const key of [
      "adminStatus",
      "readyForIngest",
      "ingestStatus",
      "lastIngestedAt",
      "lastIngestError",
      "rtIngestStatus",
      "rtLastIngestedAt",
      "rtLastIngestError"
    ]) {
      if (before[key] !== after[key]) changes[key] = { before: before[key], after: after[key] };
    }
  }

  return {
    available: hasAdminRow,
    municipality_id: before.municipality_id || clean(municipality.municipality_id),
    slug: before.slug || clean(municipality.slug),
    admin_id: before.id,
    bundle_readiness: bundleReadiness,
    rag_documents_endpoint: {
      web_exists: webDocumentExists === true,
      rt_exists: rtDocumentExists === true
    },
    staleAdminIngested: Boolean(
      (before.adminStatus === "INGESTED" && webDocumentExists !== true && rtDocumentExists !== true) ||
      (before.ingestStatus === "INGESTED" && webDocumentExists !== true) ||
      (before.rtIngestStatus === "INGESTED" && rtDocumentExists !== true)
    ),
    removes_top_level_ingested_status: before.adminStatus === "INGESTED" && after?.adminStatus !== "INGESTED",
    before,
    after,
    changes,
    will_update: hasAdminRow && Object.keys(changes).length > 0,
    reason: hasAdminRow ? null : "MunicipalityKovAdmin row not found"
  };
}

export async function loadCleanupManifest(filePath) {
  const data = await readJson(filePath);
  const items = arrayValue(data?.municipalities || data?.items || data);
  return items.map((item) => ({
    municipality_id: clean(item.municipality_id || item.municipalityId || item.municipality) || slugToMunicipalityId(item.slug),
    municipality_name: clean(item.municipality_name || item.municipalityName || item.name),
    slug: clean(item.slug) || municipalityIdToSlug(item.municipality_id || item.municipalityId || item.municipality),
    county: clean(item.county)
  })).filter(item => item.municipality_id || item.slug);
}

export function normalizeRegistryDocuments(registry) {
  if (!registry) return [];
  if (Array.isArray(registry)) return registry;
  const candidates = [
    registry.documents,
    registry.sources,
    registry.items,
    registry.records,
    registry.data
  ];
  for (const value of candidates) {
    if (Array.isArray(value)) return value;
  }
  if (typeof registry === "object") {
    return Object.entries(registry)
      .filter(([, value]) => value && typeof value === "object")
      .map(([key, value]) => ({ doc_id: key, ...value }));
  }
  return [];
}

export function mergeDocumentMetadata(record = {}) {
  const metadata = record?.metadata && typeof record.metadata === "object" ? record.metadata : {};
  return { ...metadata, ...record };
}

export function docIdOf(record = {}) {
  return clean(record.doc_id || record.docId || record.document_id || record.documentId || record.id || record.key);
}

export function titleOf(record = {}) {
  return clean(record.title || record.name || record.label);
}

export function chunksOf(record = {}) {
  const value = record.chunks ?? record.chunk_count ?? record.chunkCount ?? record.inserted;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function statusOf(record = {}) {
  return clean(record.status || record.source_status || record.sourceStatus || record.content_status);
}

export function sourceTypeOf(record = {}) {
  return clean(record.source_type || record.sourceType || record.type || record.legacy_source_type);
}

export function sourceFormatOf(record = {}) {
  return clean(record.source_format || record.sourceFormat || record.mimeType || record.mime_type || record.format);
}

export function municipalityIdOf(record = {}) {
  return clean(record.municipality_id || record.municipalityId || record.municipality);
}

export function municipalityNameOf(record = {}) {
  return clean(record.municipality_name || record.municipalityName);
}

export function collectionIdOf(record = {}) {
  return clean(record.collection_id || record.collectionId || record.collection);
}

export function lastIngestedOf(record = {}) {
  return clean(record.lastIngested || record.last_ingested || record.ingested_at || record.retrieved_at || record.updatedAt);
}

export function sourcePathOf(record = {}) {
  return clean(record.source_path || record.sourcePath || record.path || record.fileName);
}

export function resolveRuntimeStorageRoots(registryPath = DEFAULT_REGISTRY_PATH) {
  const registryDir = path.dirname(path.resolve(/*turbopackIgnore: true*/ registryPath || DEFAULT_REGISTRY_PATH));
  const docsStorageDir = path.resolve(/*turbopackIgnore: true*/ process.env.DOCS_STORAGE_DIR || "tmp/documents");
  return {
    ragRegistryDir: registryDir,
    ragDocsDir: path.resolve(/*turbopackIgnore: true*/ process.env.RAG_DOCS_DIR || path.join(/*turbopackIgnore: true*/ registryDir, "docs")),
    ragChromaDir: path.resolve(/*turbopackIgnore: true*/ process.env.RAG_CHROMA_DIR || path.join(/*turbopackIgnore: true*/ registryDir, "chroma")),
    docsStorageDir,
    kovUploadDir: path.resolve(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ docsStorageDir, "kov"))
  };
}

async function statOrNull(filePath) {
  try {
    return await fs.stat(/*turbopackIgnore: true*/ filePath);
  } catch {
    return null;
  }
}

function isInsidePath(targetPath, rootPath) {
  const target = path.resolve(/*turbopackIgnore: true*/ targetPath);
  const root = path.resolve(/*turbopackIgnore: true*/ rootPath);
  return target === root || target.startsWith(`${root}${path.sep}`);
}

function isForbiddenRepoPath(targetPath) {
  const repoRoot = path.resolve(/*turbopackIgnore: true*/ process.cwd());
  return [
    path.join(/*turbopackIgnore: true*/ repoRoot, "KOV"),
    path.join(/*turbopackIgnore: true*/ repoRoot, "scripts"),
    path.join(/*turbopackIgnore: true*/ repoRoot, "config")
  ].some(root => isInsidePath(targetPath, root));
}

async function listFilesRecursive(rootPath, { maxFiles = 10000 } = {}) {
  const root = path.resolve(/*turbopackIgnore: true*/ rootPath);
  const rootStats = await statOrNull(root);
  if (!rootStats?.isDirectory?.()) return [];
  const out = [];
  const stack = [root];
  while (stack.length && out.length < maxFiles) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = await fs.readdir(/*turbopackIgnore: true*/ current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const absolutePath = path.join(/*turbopackIgnore: true*/ current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
      } else if (entry.isFile()) {
        out.push(absolutePath);
        if (out.length >= maxFiles) break;
      }
    }
  }
  return out;
}

function filePatternValues(municipalities = [], docIds = []) {
  return unique([
    ...docIds,
    ...municipalities.flatMap(item => [
      item.slug,
      item.municipality_id,
      item.municipality_name,
      item.slug ? `kov-${item.slug}` : null,
      item.slug ? `kov-rt-${item.slug}` : null
    ])
  ]).map(value => value.toLowerCase());
}

function fileLooksScoped(filePath, patterns = []) {
  const normalized = String(filePath || "").toLowerCase();
  return patterns.some(pattern => pattern && normalized.includes(pattern));
}

export async function collectKovRuntimeFiles({
  municipalities = [],
  docIds = [],
  adminRows = [],
  registryPath = DEFAULT_REGISTRY_PATH
} = {}) {
  const roots = resolveRuntimeStorageRoots(registryPath);
  const patterns = filePatternValues(municipalities, docIds);
  const filesByPath = new Map();
  const warnings = [];

  function addCandidate(filePath, reason, storagePath = null) {
    const absolutePath = path.resolve(/*turbopackIgnore: true*/ filePath);
    const allowed =
      isInsidePath(absolutePath, roots.kovUploadDir) ||
      isInsidePath(absolutePath, roots.ragDocsDir);
    if (!allowed) {
      warnings.push({
        path: absolutePath,
        reason,
        warning: "Skipped because path is outside allowed KOV runtime/RAG docs roots"
      });
      return;
    }
    if (isForbiddenRepoPath(absolutePath)) {
      warnings.push({
        path: absolutePath,
        reason,
        warning: "Skipped because path is inside protected repo source directories"
      });
      return;
    }
    filesByPath.set(absolutePath, {
      path: absolutePath,
      storagePath,
      reason,
      exists: null,
      size: null
    });
  }

  for (const row of adminRows) {
    for (const file of arrayValue(row?.files)) {
      const storagePath = clean(file.storagePath);
      if (!storagePath) continue;
      addCandidate(path.resolve(/*turbopackIgnore: true*/ roots.docsStorageDir, path.normalize(storagePath)), "kov_admin_upload_file", storagePath);
    }
  }

  for (const municipality of municipalities) {
    const slug = clean(municipality.slug);
    if (!slug) continue;
    const slugUploadDir = path.join(/*turbopackIgnore: true*/ roots.kovUploadDir, slug);
    for (const filePath of await listFilesRecursive(slugUploadDir)) {
      addCandidate(filePath, "kov_admin_upload_slug_directory");
    }
  }

  for (const filePath of await listFilesRecursive(roots.ragDocsDir)) {
    if (fileLooksScoped(filePath, patterns)) {
      addCandidate(filePath, "rag_docs_storage_scoped_match");
    }
  }

  const files = [];
  for (const item of filesByPath.values()) {
    const stats = await statOrNull(item.path);
    files.push({
      ...item,
      exists: Boolean(stats?.isFile?.()),
      size: stats?.isFile?.() ? Number(stats.size || 0) : null
    });
  }

  return {
    roots: {
      rag_docs_dir: roots.ragDocsDir,
      rag_chroma_dir: roots.ragChromaDir,
      docs_storage_dir: roots.docsStorageDir,
      kov_upload_dir: roots.kovUploadDir
    },
    files: files.sort((a, b) => a.path.localeCompare(b.path)),
    warnings,
    note: "Chroma chunks are deleted through the RAG /documents/:docId endpoint; this file plan only covers scoped RAG docs files and admin KOV uploads."
  };
}

export function isKovRelatedRecord(record = {}) {
  const docId = docIdOf(record) || "";
  const sourceType = sourceTypeOf(record);
  const collectionId = collectionIdOf(record);
  const jurisdiction = clean(record.jurisdiction_level || record.jurisdictionLevel);
  return Boolean(
    municipalityIdOf(record) ||
    collectionId === "kov_services" ||
    collectionId === "kov_legal" ||
    collectionId === "kov_regulations" ||
    sourceType === "kov_regulation" ||
    sourceType === "municipality_kov" ||
    sourceType === "kov_service_info" ||
    sourceType === "municipality_web" ||
    jurisdiction === "MUNICIPALITY" ||
    docId.startsWith("kov-") ||
    docId.startsWith("kov::")
  );
}

export function recordLooksLikeMunicipality(record = {}, municipality = {}) {
  const merged = mergeDocumentMetadata(record);
  const municipalityId = clean(municipality.municipality_id || municipality.municipalityId || municipality.municipality);
  const slug = clean(municipality.slug) || municipalityIdToSlug(municipalityId);
  const name = clean(municipality.municipality_name || municipality.municipalityName || municipality.name);
  const haystack = [
    docIdOf(merged),
    titleOf(merged),
    sourcePathOf(merged),
    clean(merged.source_url || merged.url_canonical || merged.url)
  ].filter(Boolean).join(" ").toLowerCase();
  const recordMunicipalityId = municipalityIdOf(merged);
  if (municipalityId && recordMunicipalityId === municipalityId) return true;
  if (slug && haystack.includes(slug.toLowerCase())) return true;
  if (name && haystack.includes(name.toLowerCase())) return true;
  return false;
}

export function documentMatchesCleanupLayer(record = {}, municipality = {}, layer = "all") {
  if (layer === "all") return true;
  const docId = docIdOf(record) || "";
  const slug = clean(municipality.slug);
  const collectionId = collectionIdOf(record);
  const sourceType = sourceTypeOf(record);
  const isRtDoc = Boolean(
    (slug && docId === `kov-rt-${slug}`) ||
    collectionId === "kov_legal" ||
    collectionId === "kov_regulations" ||
    sourceType === "kov_regulation"
  );
  if (layer === "rt") return isRtDoc;
  if (layer === "web") {
    const isKnownWebDoc = Boolean(
      (slug && docId === `kov-${slug}`) ||
      (slug && docId.startsWith(`kov::${slug}::`)) ||
      collectionId === "kov_services" ||
      sourceType === "municipality_kov" ||
      sourceType === "kov_service_info" ||
      sourceType === "municipality_web"
    );
    return isKnownWebDoc && !isRtDoc;
  }
  return false;
}

export function summarizeDocumentRecord(record = {}, origin = "unknown") {
  const merged = mergeDocumentMetadata(record);
  return {
    origin,
    docId: docIdOf(merged),
    title: titleOf(merged),
    municipality_id: municipalityIdOf(merged),
    municipality_name: municipalityNameOf(merged),
    collection_id: collectionIdOf(merged),
    source_type: sourceTypeOf(merged),
    source_format: sourceFormatOf(merged),
    lastIngested: lastIngestedOf(merged),
    status: statusOf(merged),
    chunks: chunksOf(merged),
    source_path: sourcePathOf(merged)
  };
}

export async function readRegistry(registryPath = DEFAULT_REGISTRY_PATH) {
  const registry = await readJson(registryPath);
  const records = normalizeRegistryDocuments(registry).map(record => mergeDocumentMetadata(record));
  return {
    available: !!registry,
    path: registryPath,
    records
  };
}

function parseDocumentsPayload(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ["documents", "items", "data", "results"]) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

export async function fetchDocumentsPage(baseUrl, apiKey, limit, offset) {
  if (!apiKey) {
    return { ok: false, status: 0, error: "RAG_SERVICE_API_KEY missing", items: [] };
  }
  const url = new URL("/documents", `${normalizeBaseFromHost(baseUrl)}/`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  try {
    const response = await fetch(url, {
      headers: {
        "X-API-Key": apiKey
      }
    });
    const raw = await response.text();
    const payload = raw ? JSON.parse(raw) : [];
    if (!response.ok) {
      return { ok: false, status: response.status, error: raw.slice(0, 300), items: [] };
    }
    return { ok: true, status: response.status, error: null, items: parseDocumentsPayload(payload) };
  } catch (error) {
    return { ok: false, status: 0, error: error?.message || String(error), items: [] };
  }
}

export async function collectRagDocuments(options = {}) {
  const baseUrl = normalizeBaseFromHost(options.baseUrl || DEFAULT_RAG_BASE_URL);
  const apiKey = clean(options.apiKey || process.env.RAG_SERVICE_API_KEY);
  const pageSize = Math.max(1, Math.min(200, Number.parseInt(String(options.pageSize || 100), 10) || 100));
  const maxDocs = Math.max(1, Number.parseInt(String(options.maxDocs || 5000), 10) || 5000);
  const out = [];
  const errors = [];

  for (let offset = 0; out.length < maxDocs; offset += pageSize) {
    const limit = Math.min(pageSize, maxDocs - out.length);
    const page = await fetchDocumentsPage(baseUrl, apiKey, limit, offset);
    if (!page.ok) {
      errors.push(page.error || `HTTP ${page.status}`);
      break;
    }
    out.push(...page.items.map(item => mergeDocumentMetadata(item)));
    if (page.items.length < limit) break;
  }

  return {
    available: errors.length === 0,
    baseUrl,
    records: out,
    errors
  };
}

export async function deleteRagDocument(baseUrl, apiKey, docId) {
  const normalizedDocId = clean(docId);
  if (!normalizedDocId) return { ok: false, skipped: true, reason: "missing_doc_id" };
  const response = await fetch(`${normalizeBaseFromHost(baseUrl)}/documents/${encodeURIComponent(normalizedDocId)}`, {
    method: "DELETE",
    headers: {
      "X-API-Key": apiKey,
      "X-Observability-Route": "script/cleanup-kov-rag-state",
      "X-Observability-Stage": "kov_cleanup"
    }
  });
  const raw = await response.text().catch(() => "");
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = { detail: raw.slice(0, 300) };
  }
  if (response.status === 404) {
    return { ok: true, notFound: true, status: 404, payload };
  }
  if (!response.ok || payload?.ok === false) {
    return {
      ok: false,
      status: response.status,
      error: payload?.detail || payload?.message || raw.slice(0, 300) || `HTTP ${response.status}`,
      payload
    };
  }
  return { ok: true, status: response.status, payload };
}

export function countDuplicateNormalizedCanonicalIds(rows = []) {
  const groups = new Map();
  for (const row of arrayValue(rows)) {
    const municipalityId = clean(row.municipalityId || row.municipality_id) || "(missing)";
    const canonicalId = normalizeCanonicalId(row.canonicalItemId || row.canonical_item_id);
    if (!canonicalId) continue;
    const key = `${municipalityId}::${canonicalId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const duplicateGroups = [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => {
      const [municipalityId, canonicalItemId] = key.split("::");
      return {
        municipality_id: municipalityId === "(missing)" ? null : municipalityId,
        normalized_canonical_item_id: canonicalItemId,
        count: group.length,
        package_ids: unique(group.map(row => row.packageId || row.package_id))
      };
    });

  return {
    duplicate_group_count: duplicateGroups.length,
    duplicate_row_count: duplicateGroups.reduce((sum, group) => sum + Math.max(0, group.count - 1), 0),
    groups: duplicateGroups
  };
}

export function groupSnapshotSummary(rows = []) {
  const summary = new Map();
  for (const row of arrayValue(rows)) {
    const municipalityId = clean(row.municipalityId || row.municipality_id) || "(missing)";
    if (!summary.has(municipalityId)) {
      summary.set(municipalityId, {
        municipality_id: municipalityId === "(missing)" ? null : municipalityId,
        snapshot_count: 0,
        active_snapshot_count: 0,
        archived_snapshot_count: 0,
        review_event_count: 0
      });
    }
    const entry = summary.get(municipalityId);
    entry.snapshot_count += 1;
    if (row.active === true) entry.active_snapshot_count += 1;
    else entry.archived_snapshot_count += 1;
    entry.review_event_count += Number(row._count?.reviewEvents || row.review_event_count || 0);
  }
  return [...summary.values()].sort((a, b) => String(a.municipality_id).localeCompare(String(b.municipality_id)));
}
