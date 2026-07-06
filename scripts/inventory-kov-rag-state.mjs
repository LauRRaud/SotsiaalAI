#!/usr/bin/env node

import prisma from "../lib/prisma.js";
import {
  buildKovAdminStatusResetPlan,
  clean,
  collectKovRuntimeFiles,
  collectRagDocuments,
  countDuplicateNormalizedCanonicalIds,
  DEFAULT_RAG_BASE_URL,
  DEFAULT_REGISTRY_PATH,
  discoverKovMunicipalities,
  groupSnapshotSummary,
  isKovRelatedRecord,
  readKovBundleReadiness,
  readRegistry,
  serializeKovAdminCleanupState,
  summarizeDocumentRecord,
  unique,
  writeJson
} from "./lib/kov-rag-state.mjs";

function usage() {
  return [
    "Usage:",
    "  npm run rag:inventory:kov",
    "  npm run rag:inventory:kov -- --json logs/kov-rag-inventory.json",
    "",
    "Options:",
    "  --base-url <url>       RAG service URL. Default from env or http://127.0.0.1:8000",
    "  --registry <path>      RAG registry.json path. Default /var/lib/sotsiaalai-rag/registry.json",
    "  --json <path>          Write full JSON inventory",
    "  --page-size <n>        Documents API page size. Default 100",
    "  --max-docs <n>         Maximum documents to fetch. Default 5000",
    "  --include-files         Include scoped KOV runtime/upload/RAG docs file inventory",
    "",
    "Read-only inventory. Does not change RAG, registry, DB, or KOV files."
  ].join("\n");
}

function parseArgs(argv = []) {
  const args = {
    baseUrl: DEFAULT_RAG_BASE_URL,
    registry: DEFAULT_REGISTRY_PATH,
    json: "",
    pageSize: 100,
    maxDocs: 5000,
    includeFiles: false,
    help: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--base-url") args.baseUrl = argv[++index] || args.baseUrl;
    else if (arg === "--registry") args.registry = argv[++index] || args.registry;
    else if (arg === "--json") args.json = argv[++index] || "";
    else if (arg === "--page-size") args.pageSize = Number.parseInt(argv[++index] || "100", 10) || 100;
    else if (arg === "--max-docs") args.maxDocs = Number.parseInt(argv[++index] || "5000", 10) || 5000;
    else if (arg === "--include-files") args.includeFiles = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return args;
}

async function loadSnapshots() {
  try {
    if (!process.env.DATABASE_URL) {
      return { available: false, error: "DATABASE_URL is not set", rows: [] };
    }
    const rows = await prisma.sourcePackageSnapshot.findMany({
      select: {
        id: true,
        packageId: true,
        canonicalItemId: true,
        municipalityId: true,
        packageType: true,
        title: true,
        status: true,
        active: true,
        reviewStatus: true,
        version: true,
        _count: {
          select: {
            reviewEvents: true
          }
        }
      },
      orderBy: [
        { municipalityId: "asc" },
        { active: "desc" },
        { title: "asc" }
      ]
    });
    return { available: true, error: null, rows };
  } catch (error) {
    return { available: false, error: error?.message || String(error), rows: [] };
  }
}

async function loadKovAdminRows() {
  try {
    if (!process.env.DATABASE_URL) {
      return { available: false, error: "DATABASE_URL is not set", rows: [] };
    }
    const rows = await prisma.municipalityKovAdmin.findMany({
      include: {
        files: {
          select: {
            id: true,
            role: true,
            originalName: true,
            storagePath: true,
            size: true,
            validationStatus: true
          }
        },
        municipality: {
          select: {
            slug: true,
            displayName: true,
            county: true,
            type: true,
            isActive: true
          }
        }
      },
      orderBy: {
        municipality: {
          slug: "asc"
        }
      }
    });
    return { available: true, error: null, rows };
  } catch (error) {
    return { available: false, error: error?.message || String(error), rows: [] };
  }
}

function mergeDocumentSummaries(registryRecords = [], apiRecords = []) {
  const byDocId = new Map();
  for (const item of registryRecords.filter(isKovRelatedRecord).map(record => summarizeDocumentRecord(record, "registry"))) {
    if (item.docId) byDocId.set(item.docId, item);
  }
  for (const item of apiRecords.filter(isKovRelatedRecord).map(record => summarizeDocumentRecord(record, "documents_api"))) {
    if (!item.docId) continue;
    const existing = byDocId.get(item.docId);
    byDocId.set(item.docId, existing ? { ...existing, ...Object.fromEntries(Object.entries(item).filter(([, value]) => value != null)), origin: "registry+documents_api" } : item);
  }
  return [...byDocId.values()].sort((a, b) => String(a.docId).localeCompare(String(b.docId)));
}

function groupDocumentsByMunicipality(documents = []) {
  const groups = new Map();
  for (const doc of documents) {
    const key = clean(doc.municipality_id) || "(missing)";
    if (!groups.has(key)) {
      groups.set(key, {
        municipality_id: key === "(missing)" ? null : key,
        document_count: 0,
        collection_ids: new Set(),
        source_types: new Set(),
        docIds: []
      });
    }
    const group = groups.get(key);
    group.document_count += 1;
    if (doc.collection_id) group.collection_ids.add(doc.collection_id);
    if (doc.source_type) group.source_types.add(doc.source_type);
    if (doc.docId) group.docIds.push(doc.docId);
  }
  return [...groups.values()].map(group => ({
    ...group,
    collection_ids: [...group.collection_ids].sort(),
    source_types: [...group.source_types].sort(),
    docIds: group.docIds.sort()
  })).sort((a, b) => String(a.municipality_id).localeCompare(String(b.municipality_id)));
}

function documentExistsInApi(documents = [], docId) {
  const id = clean(docId);
  if (!id) return false;
  return documents.some(doc => clean(doc.doc_id || doc.docId || doc.document_id || doc.documentId || doc.id) === id);
}

async function buildAdminInventory(localMunicipalities = [], adminRows = [], apiRecords = [], documentsApiAvailable = false) {
  const rowBySlug = new Map(adminRows.map(row => [clean(row.municipality?.slug), row]).filter(([slug]) => slug));
  const municipalityBySlug = new Map(localMunicipalities.map(item => [clean(item.slug), item]).filter(([slug]) => slug));
  for (const row of adminRows) {
    const slug = clean(row.municipality?.slug);
    if (slug && !municipalityBySlug.has(slug)) {
      municipalityBySlug.set(slug, {
        slug,
        municipality_id: slug.replace(/-/gu, "_"),
        municipality_name: clean(row.municipality?.displayName)
      });
    }
  }

  const out = [];
  for (const municipality of [...municipalityBySlug.values()].sort((a, b) => String(a.slug).localeCompare(String(b.slug)))) {
    const row = rowBySlug.get(clean(municipality.slug)) || null;
    const before = serializeKovAdminCleanupState(row, municipality);
    const bundleReadiness = await readKovBundleReadiness(municipality);
    const webExists = documentExistsInApi(apiRecords, before.expectedWebDocId);
    const rtExists = documentExistsInApi(apiRecords, before.expectedRtDocId);
    const resetPlan = buildKovAdminStatusResetPlan({
      row,
      municipality,
      bundleReadiness,
      webDocumentExists: webExists,
      rtDocumentExists: rtExists
    });
    out.push({
      ...before,
      admin_row_available: Boolean(row),
      source_bundle: bundleReadiness,
      rag_documents_endpoint: {
        available: documentsApiAvailable === true,
        web_exists: webExists,
        rt_exists: rtExists
      },
      staleAdminIngested: resetPlan.staleAdminIngested,
      would_reset_admin_state: resetPlan.will_update,
      reset_preview: {
        after: resetPlan.after,
        changes: resetPlan.changes,
        removes_top_level_ingested_status: resetPlan.removes_top_level_ingested_status
      }
    });
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const [registry, documentsApi, snapshotResult, localMunicipalities, adminRowsResult] = await Promise.all([
    readRegistry(args.registry),
    collectRagDocuments({
      baseUrl: args.baseUrl,
      pageSize: args.pageSize,
      maxDocs: args.maxDocs
    }),
    loadSnapshots(),
    discoverKovMunicipalities(),
    loadKovAdminRows()
  ]);

  const documents = mergeDocumentSummaries(registry.records, documentsApi.records);
  const kovAdminInventory = await buildAdminInventory(localMunicipalities, adminRowsResult.rows, documentsApi.records, documentsApi.available);
  const duplicateActive = countDuplicateNormalizedCanonicalIds(snapshotResult.rows.filter(row => row.active === true));
  const runtimeFiles = args.includeFiles
    ? await collectKovRuntimeFiles({
        municipalities: localMunicipalities,
        docIds: documents.map(item => item.docId),
        adminRows: adminRowsResult.rows,
        registryPath: args.registry
      })
    : null;
  const inventory = {
    ok: true,
    generated_at: new Date().toISOString(),
    read_only: true,
    registry: {
      available: registry.available,
      path: registry.path,
      kov_related_count: registry.records.filter(isKovRelatedRecord).length
    },
    documents_api: {
      available: documentsApi.available,
      base_url: documentsApi.baseUrl,
      fetched_count: documentsApi.records.length,
      kov_related_count: documentsApi.records.filter(isKovRelatedRecord).length,
      errors: documentsApi.errors
    },
    kov_admin_state: {
      available: adminRowsResult.available,
      error: adminRowsResult.error,
      rows: kovAdminInventory
    },
    local_kov_municipalities: localMunicipalities.map(item => ({
      municipality_id: item.municipality_id,
      municipality_name: item.municipality_name,
      slug: item.slug
    })),
    rag_documents: documents,
    rag_documents_by_municipality: groupDocumentsByMunicipality(documents),
    source_package_snapshots: {
      available: snapshotResult.available,
      error: snapshotResult.error,
      by_municipality: groupSnapshotSummary(snapshotResult.rows),
      duplicate_normalized_canonical_ids: duplicateActive,
      active_duplicate_normalized_canonical_id_count: duplicateActive.duplicate_row_count
    },
    runtime_files: runtimeFiles ? {
      include_files: true,
      roots: runtimeFiles.roots,
      files: runtimeFiles.files,
      warnings: runtimeFiles.warnings,
      note: runtimeFiles.note
    } : {
      include_files: false
    },
    summary: {
      kov_related_rag_document_count: documents.length,
      municipality_ids_in_rag_documents: unique(documents.map(doc => doc.municipality_id)),
      source_package_snapshot_count: snapshotResult.rows.length,
      active_source_package_snapshot_count: snapshotResult.rows.filter(row => row.active === true).length,
      archived_source_package_snapshot_count: snapshotResult.rows.filter(row => row.active !== true).length,
      active_duplicate_normalized_canonical_id_count: duplicateActive.duplicate_row_count,
      stale_admin_ingested_count: kovAdminInventory.filter(item => item.staleAdminIngested).length,
      kov_runtime_file_count: runtimeFiles?.files?.filter(item => item.exists).length || 0
    }
  };

  if (args.json) await writeJson(args.json, inventory);
  console.log(JSON.stringify({
    ok: true,
    read_only: true,
    output: args.json || null,
    registry_available: inventory.registry.available,
    documents_api_available: inventory.documents_api.available,
    kov_related_rag_document_count: inventory.summary.kov_related_rag_document_count,
    source_package_snapshot_count: inventory.summary.source_package_snapshot_count,
    active_source_package_snapshot_count: inventory.summary.active_source_package_snapshot_count,
    active_duplicate_normalized_canonical_id_count: inventory.summary.active_duplicate_normalized_canonical_id_count,
    stale_admin_ingested_count: inventory.summary.stale_admin_ingested_count,
    kov_runtime_file_count: inventory.summary.kov_runtime_file_count,
    municipalities: inventory.rag_documents_by_municipality.map(item => ({
      municipality_id: item.municipality_id,
      document_count: item.document_count,
      source_types: item.source_types
    })),
    kov_admin_state: inventory.kov_admin_state.rows.map(item => ({
      municipality_id: item.municipality_id,
      slug: item.slug,
      adminStatus: item.adminStatus,
      readyForIngest: item.readyForIngest,
      ingestStatus: item.ingestStatus,
      rtIngestStatus: item.rtIngestStatus,
      expectedWebDocId: item.expectedWebDocId,
      expectedRtDocId: item.expectedRtDocId,
      rag_documents_endpoint: item.rag_documents_endpoint,
      staleAdminIngested: item.staleAdminIngested
    })),
    snapshot_municipalities: inventory.source_package_snapshots.by_municipality
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(`[rag:inventory:kov] ${error?.message || String(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma?.$disconnect?.().catch(() => {});
  });
