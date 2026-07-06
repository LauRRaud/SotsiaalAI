#!/usr/bin/env node

import path from "node:path";
import fs from "node:fs/promises";

import prisma from "../lib/prisma.js";
import {
  buildKovAdminStatusResetPlan,
  clean,
  collectKovRuntimeFiles,
  collectRagDocuments,
  countDuplicateNormalizedCanonicalIds,
  DEFAULT_RAG_BASE_URL,
  DEFAULT_REGISTRY_PATH,
  deleteRagDocument,
  documentMatchesCleanupLayer,
  discoverKovMunicipalities,
  groupSnapshotSummary,
  loadCleanupManifest,
  mergeDocumentMetadata,
  readKovBundleReadiness,
  readRegistry,
  recordLooksLikeMunicipality,
  summarizeDocumentRecord,
  unique,
  writeJson
} from "./lib/kov-rag-state.mjs";

const DEFAULT_LOG_DIR = "logs";

function usage() {
  return [
    "Usage:",
    "  npm run rag:cleanup:kov -- --municipality jogeva_vald --slug jogeva-vald --dry-run",
    "  npm run rag:cleanup:kov -- --municipality jogeva_vald --slug jogeva-vald --write --confirm-cleanup",
    "  npm run rag:cleanup:kov -- --manifest config/kov-reingest-cleanup-manifest.json --dry-run",
    "  npm run rag:cleanup:kov -- --manifest config/kov-reingest-cleanup-manifest.json --write --confirm-cleanup",
    "  npm run rag:cleanup:kov -- --all-kov --dry-run",
    "",
    "Options:",
    "  --municipality <id>    Municipality id, e.g. jogeva_vald",
    "  --slug <slug>          Municipality slug, e.g. jogeva-vald",
    "  --manifest <path>      JSON manifest with municipalities",
    "  --all-kov              Use all local KOV/*/*.meta.json municipalities",
    "  --dry-run              Plan only. Default.",
    "  --write                Execute the planned RAG deletes and archive SourcePackage snapshots",
    "  --confirm-cleanup      Required together with --write. Does nothing without --write",
    "  --include-files         Also plan/delete scoped KOV runtime upload and RAG docs files",
    "  --layer <all|web|rt>    Cleanup layer. Default all. Use web before KOV web reingest",
    "  --base-url <url>       RAG service URL. Default from env or http://127.0.0.1:8000",
    "  --registry <path>      RAG registry.json path. Default /var/lib/sotsiaalai-rag/registry.json",
    "  --json <path>          Write dry-run plan/result JSON",
    "  --log-dir <path>       Write log directory for --write. Default logs",
    "  --page-size <n>        Documents API page size. Default 100",
    "  --max-docs <n>         Maximum documents to fetch. Default 5000",
    "",
    "This script never deletes files under KOV/, scripts/, or config/."
  ].join("\n");
}

function parseArgs(argv = []) {
  const args = {
    municipality: "",
    slug: "",
    manifest: "",
    allKov: false,
    write: false,
    confirmCleanup: false,
    baseUrl: DEFAULT_RAG_BASE_URL,
    registry: DEFAULT_REGISTRY_PATH,
    json: "",
    logDir: DEFAULT_LOG_DIR,
    pageSize: 100,
    maxDocs: 5000,
    layer: "all",
    includeFiles: false,
    help: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--municipality" || arg === "--municipality-id") args.municipality = argv[++index] || "";
    else if (arg === "--slug") args.slug = argv[++index] || "";
    else if (arg === "--manifest") args.manifest = argv[++index] || "";
    else if (arg === "--all-kov") args.allKov = true;
    else if (arg === "--dry-run") args.write = false;
    else if (arg === "--write") args.write = true;
    else if (arg === "--confirm-cleanup") args.confirmCleanup = true;
    else if (arg === "--include-files") args.includeFiles = true;
    else if (arg === "--base-url") args.baseUrl = argv[++index] || args.baseUrl;
    else if (arg === "--registry") args.registry = argv[++index] || args.registry;
    else if (arg === "--json") args.json = argv[++index] || "";
    else if (arg === "--log-dir") args.logDir = argv[++index] || args.logDir;
    else if (arg === "--page-size") args.pageSize = Number.parseInt(argv[++index] || "100", 10) || 100;
    else if (arg === "--max-docs") args.maxDocs = Number.parseInt(argv[++index] || "5000", 10) || 5000;
    else if (arg === "--layer") args.layer = argv[++index] || args.layer;
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!["all", "web", "rt"].includes(args.layer)) {
    throw new Error("--layer must be one of: all, web, rt");
  }
  return args;
}

async function resolveMunicipalities(args) {
  if (args.manifest) return loadCleanupManifest(args.manifest);
  if (args.allKov) return discoverKovMunicipalities();
  if (args.municipality || args.slug) {
    return [{
      municipality_id: clean(args.municipality) || clean(args.slug)?.replace(/-/gu, "_"),
      slug: clean(args.slug) || clean(args.municipality)?.replace(/_/gu, "-"),
      municipality_name: null
    }];
  }
  throw new Error("Pass --municipality/--slug, --manifest, or --all-kov.");
}

async function loadSnapshots(municipalities = []) {
  if (!process.env.DATABASE_URL) {
    return { available: false, error: "DATABASE_URL is not set", rows: [] };
  }
  try {
    const ids = unique(municipalities.map(item => item.municipality_id));
    if (!ids.length) return { available: true, error: null, rows: [] };
    const rows = await prisma.sourcePackageSnapshot.findMany({
      where: {
        municipalityId: {
          in: ids
        }
      },
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

async function loadKovAdminRows(municipalities = []) {
  if (!process.env.DATABASE_URL) {
    return { available: false, error: "DATABASE_URL is not set", rows: [] };
  }
  try {
    const slugs = unique(municipalities.map(item => item.slug));
    const ids = unique(municipalities.map(item => item.municipality_id));
    if (!slugs.length && !ids.length) return { available: true, error: null, rows: [] };
    const rows = await prisma.municipalityKovAdmin.findMany({
      where: {
        OR: [
          slugs.length ? { municipality: { slug: { in: slugs } } } : undefined,
          ids.length ? { municipalityId: { in: ids } } : undefined
        ].filter(Boolean)
      },
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

function matchedDocumentsForMunicipality(records = [], municipality = {}, origin = "unknown") {
  return records
    .map(record => mergeDocumentMetadata(record))
    .filter(record => recordLooksLikeMunicipality(record, municipality))
    .map(record => {
      const summary = summarizeDocumentRecord(record, origin);
      const warning = !summary.municipality_id && summary.docId
        ? `municipality_id missing; matched by slug/name/docId for ${municipality.slug || municipality.municipality_id}`
        : null;
      return warning ? { ...summary, warning } : summary;
    });
}

function documentExistsInApi(records = [], docId) {
  const id = clean(docId);
  if (!id) return false;
  return records.some(record => {
    const merged = mergeDocumentMetadata(record);
    return clean(merged.doc_id || merged.docId || merged.document_id || merged.documentId || merged.id) === id;
  });
}

async function buildPlanForMunicipality(municipality, registryRecords, apiRecords, snapshots, adminRows, options = {}) {
  const layer = options.layer || "all";
  const registryMatches = matchedDocumentsForMunicipality(registryRecords, municipality, "registry")
    .filter(record => documentMatchesCleanupLayer(record, municipality, layer));
  const apiMatches = matchedDocumentsForMunicipality(apiRecords, municipality, "documents_api")
    .filter(record => documentMatchesCleanupLayer(record, municipality, layer));
  const byDocId = new Map();
  for (const doc of [...registryMatches, ...apiMatches]) {
    if (!doc.docId) continue;
    const existing = byDocId.get(doc.docId);
    byDocId.set(doc.docId, existing ? {
      ...existing,
      ...Object.fromEntries(Object.entries(doc).filter(([, value]) => value != null)),
      origin: unique([existing.origin, doc.origin].join("+").split("+")).join("+"),
      warning: existing.warning || doc.warning || null
    } : doc);
  }

  const municipalitySnapshots = snapshots.filter(row => row.municipalityId === municipality.municipality_id);
  const adminRow = adminRows.find(row =>
    clean(row.municipality?.slug) === clean(municipality.slug) ||
    clean(row.municipalityId) === clean(municipality.municipality_id)
  ) || null;
  const bundleReadiness = await readKovBundleReadiness(municipality);
  const expectedWebDocId = adminRow?.ragDocId || (municipality.slug ? `kov-${municipality.slug}` : null);
  const expectedRtDocId = adminRow?.rtRagDocId || (municipality.slug ? `kov-rt-${municipality.slug}` : null);
  const adminStatusReset = layer === "all"
    ? buildKovAdminStatusResetPlan({
        row: adminRow,
        municipality,
        bundleReadiness,
        webDocumentExists: documentExistsInApi(apiRecords, expectedWebDocId),
        rtDocumentExists: documentExistsInApi(apiRecords, expectedRtDocId)
      })
    : { will_update: false, reason: `skipped_for_layer_${layer}` };
  const active = layer === "rt" ? [] : municipalitySnapshots.filter(row => row.active === true);
  const archived = municipalitySnapshots.filter(row => row.active !== true);
  const reviewEventCount = municipalitySnapshots.reduce((sum, row) => sum + Number(row._count?.reviewEvents || 0), 0);
  const matchedDocIds = [...byDocId.keys()].sort();
  const runtimeFiles = options.includeFiles
    ? await collectKovRuntimeFiles({
        municipalities: [municipality],
        docIds: matchedDocIds,
        adminRows: adminRow ? [adminRow] : [],
        registryPath: options.registryPath
      })
    : null;

  return {
    municipality_id: municipality.municipality_id,
    municipality_name: municipality.municipality_name || null,
    slug: municipality.slug || null,
    matched_rag_doc_ids: matchedDocIds,
    matched_registry_entries: registryMatches,
    matched_documents_api_entries: apiMatches,
    source_package_snapshots: municipalitySnapshots.map(row => ({
      id: row.id,
      packageId: row.packageId,
      canonicalItemId: row.canonicalItemId,
      packageType: row.packageType,
      title: row.title,
      status: row.status,
      active: row.active,
      reviewStatus: row.reviewStatus,
      version: row.version,
      review_event_count: Number(row._count?.reviewEvents || 0)
    })),
    counts: {
      cleanup_layer: layer,
      matched_rag_doc_ids: byDocId.size,
      matched_registry_entries: registryMatches.length,
      matched_documents_api_entries: apiMatches.length,
      source_package_snapshot_rows: municipalitySnapshots.length,
      active_snapshot_count: active.length,
      archived_snapshot_count: archived.length,
      review_event_count: reviewEventCount
    },
    planned_actions: {
      cleanup_layer: layer,
      delete_rag_documents_via_service: matchedDocIds,
      archive_active_source_package_snapshots: active.map(row => row.id).sort(),
      leave_archived_source_package_snapshots: archived.map(row => row.id).sort(),
      delete_runtime_files: runtimeFiles?.files?.filter(item => item.exists).map(item => item.path) || [],
      reset_kov_admin_state: adminStatusReset.will_update ? {
        admin_id: adminStatusReset.admin_id,
        changes: adminStatusReset.changes
      } : null
    },
    admin_status_reset: adminStatusReset,
    runtime_files: runtimeFiles,
    warnings: unique([
      ...registryMatches.map(item => item.warning),
      ...apiMatches.map(item => item.warning)
    ])
  };
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/gu, "").replace(/\.\d{3}Z$/u, "Z");
}

async function executePlan(plan, args) {
  const apiKey = clean(process.env.RAG_SERVICE_API_KEY);
  if (!apiKey && plan.summary.total_rag_documents_to_delete > 0) {
    throw new Error("RAG_SERVICE_API_KEY is missing; cannot delete RAG documents.");
  }

  const result = {
    deleted_rag_documents: [],
    failed_rag_documents: [],
    archived_source_package_snapshots: 0,
    archive_result: null,
    reset_kov_admin_rows: 0,
    reset_kov_admin_results: [],
    deleted_runtime_files: [],
    failed_runtime_files: []
  };

  for (const docId of plan.summary.rag_doc_ids_to_delete) {
    const deleteResult = await deleteRagDocument(args.baseUrl, apiKey, docId);
    if (deleteResult.ok) {
      result.deleted_rag_documents.push({
        docId,
        notFound: deleteResult.notFound === true,
        status: deleteResult.status || null
      });
    } else {
      result.failed_rag_documents.push({
        docId,
        status: deleteResult.status || null,
        error: deleteResult.error || deleteResult.reason || "delete_failed"
      });
    }
  }

  if (plan.summary.active_source_package_snapshots_to_archive > 0) {
    const ids = plan.municipalities.flatMap(item => item.planned_actions.archive_active_source_package_snapshots);
    const archiveResult = await prisma.sourcePackageSnapshot.updateMany({
      where: {
        id: {
          in: ids
        },
        active: true
      },
      data: {
        active: false,
        status: "archived",
        reviewStatus: "archived"
      }
    });
    result.archived_source_package_snapshots = Number(archiveResult.count || 0);
    result.archive_result = archiveResult;
  }

  const adminPlans = plan.municipalities.map(item => item.admin_status_reset).filter(item => item?.will_update && item.admin_id);
  for (const adminPlan of adminPlans) {
    const updated = await prisma.municipalityKovAdmin.update({
      where: { id: adminPlan.admin_id },
      data: {
        status: adminPlan.after.adminStatus,
        readyForIngest: adminPlan.after.readyForIngest,
        ingestStatus: adminPlan.after.ingestStatus,
        lastIngestedAt: null,
        lastIngestError: null,
        rtIngestStatus: adminPlan.after.rtIngestStatus,
        rtLastIngestedAt: null,
        rtLastIngestError: null
      },
      select: {
        id: true,
        status: true,
        readyForIngest: true,
        ingestStatus: true,
        lastIngestedAt: true,
        rtIngestStatus: true,
        rtLastIngestedAt: true
      }
    });
    result.reset_kov_admin_rows += 1;
    result.reset_kov_admin_results.push({
      admin_id: updated.id,
      status: updated.status,
      readyForIngest: updated.readyForIngest,
      ingestStatus: updated.ingestStatus,
      lastIngestedAt: updated.lastIngestedAt,
      rtIngestStatus: updated.rtIngestStatus,
      rtLastIngestedAt: updated.rtLastIngestedAt
    });
  }

  if (args.includeFiles) {
    const filePaths = unique(plan.municipalities.flatMap(item => item.planned_actions.delete_runtime_files));
    for (const filePath of filePaths) {
      try {
        await fs.rm(filePath, { force: true });
        result.deleted_runtime_files.push(filePath);
      } catch (error) {
        result.failed_runtime_files.push({
          path: filePath,
          error: error?.message || String(error)
        });
      }
    }
  }

  if (result.failed_rag_documents.length > 0 || result.failed_runtime_files.length > 0) {
    plan.ok = false;
  }
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  if (args.write && !args.confirmCleanup) {
    throw new Error("Refusing destructive cleanup: pass --confirm-cleanup together with --write.");
  }

  const municipalities = await resolveMunicipalities(args);
  if (!municipalities.length) throw new Error("No municipalities matched cleanup scope.");

  const [registry, documentsApi, snapshotResult, adminRowsResult] = await Promise.all([
    readRegistry(args.registry),
    collectRagDocuments({
      baseUrl: args.baseUrl,
      pageSize: args.pageSize,
      maxDocs: args.maxDocs
    }),
    loadSnapshots(municipalities),
    loadKovAdminRows(municipalities)
  ]);

  const municipalityPlans = await Promise.all(municipalities.map(item =>
    buildPlanForMunicipality(item, registry.records, documentsApi.records, snapshotResult.rows, adminRowsResult.rows, {
      includeFiles: args.includeFiles,
      registryPath: args.registry,
      layer: args.layer
    })
  ));
  const adminResetPlans = municipalityPlans.map(item => item.admin_status_reset).filter(Boolean);
  const adminResetUpdateCount = adminResetPlans.filter(item => item.will_update).length;
  const staleAdminIngestedCount = adminResetPlans.filter(item => item.staleAdminIngested).length;
  const removesTopLevelIngestedCount = adminResetPlans.filter(item => item.removes_top_level_ingested_status).length;
  const ragDocIds = unique(municipalityPlans.flatMap(item => item.matched_rag_doc_ids));
  const activeSnapshotIds = unique(municipalityPlans.flatMap(item => item.planned_actions.archive_active_source_package_snapshots));
  const runtimeFilesToDelete = unique(municipalityPlans.flatMap(item => item.planned_actions.delete_runtime_files));
  const duplicateActive = countDuplicateNormalizedCanonicalIds(snapshotResult.rows.filter(row => row.active === true));

  const plan = {
    ok: true,
    mode: args.write ? "write" : "dry-run",
    cleanup_layer: args.layer,
    generated_at: new Date().toISOString(),
    dry_run_first: !args.write,
    repo_files_deleted: false,
    scope: {
      manifest: args.manifest || null,
      all_kov: args.allKov,
      include_files: args.includeFiles,
      municipalities
    },
    registry: {
      available: registry.available,
      path: registry.path
    },
    documents_api: {
      available: documentsApi.available,
      base_url: documentsApi.baseUrl,
      errors: documentsApi.errors
    },
    source_package_snapshots: {
      available: snapshotResult.available,
      error: snapshotResult.error,
      by_municipality: groupSnapshotSummary(snapshotResult.rows),
      duplicate_normalized_canonical_ids_before: duplicateActive
    },
    kov_admin_state: {
      available: adminRowsResult.available,
      error: adminRowsResult.error,
      stale_admin_ingested_count: staleAdminIngestedCount,
      admin_rows_to_reset: adminResetUpdateCount,
      removes_top_level_ingested_status_count: removesTopLevelIngestedCount
    },
    runtime_files: {
      include_files: args.includeFiles,
      roots: municipalityPlans.find(item => item.runtime_files)?.runtime_files?.roots || null,
      files_to_delete_count: runtimeFilesToDelete.length,
      files_to_delete: runtimeFilesToDelete,
      warnings: municipalityPlans.flatMap(item => item.runtime_files?.warnings || []),
      note: municipalityPlans.find(item => item.runtime_files)?.runtime_files?.note || null
    },
    municipalities: municipalityPlans,
    summary: {
      municipality_count: municipalityPlans.length,
      total_rag_documents_to_delete: ragDocIds.length,
      rag_doc_ids_to_delete: ragDocIds,
      active_source_package_snapshots_to_archive: activeSnapshotIds.length,
      source_package_snapshot_rows_in_scope: snapshotResult.rows.length,
      review_event_count_in_scope: snapshotResult.rows.reduce((sum, row) => sum + Number(row._count?.reviewEvents || 0), 0),
      active_duplicate_normalized_canonical_id_count_before: duplicateActive.duplicate_row_count,
      runtime_files_to_delete: runtimeFilesToDelete.length,
      kov_admin_rows_to_reset: adminResetUpdateCount,
      stale_admin_ingested_count: staleAdminIngestedCount,
      removes_top_level_ingested_status_count: removesTopLevelIngestedCount
    },
    execution: null
  };

  const outputPath = args.json || (args.write
    ? path.join(args.logDir, `cleanup-kov-rag-state-${timestamp()}.json`)
    : "");

  if (!args.write) {
    if (outputPath) await writeJson(outputPath, plan);
    console.log(JSON.stringify({
      ok: true,
      mode: "dry-run",
      output: outputPath || null,
      municipality_count: plan.summary.municipality_count,
      total_rag_documents_to_delete: plan.summary.total_rag_documents_to_delete,
      active_source_package_snapshots_to_archive: plan.summary.active_source_package_snapshots_to_archive,
      review_event_count_in_scope: plan.summary.review_event_count_in_scope,
      active_duplicate_normalized_canonical_id_count_before: plan.summary.active_duplicate_normalized_canonical_id_count_before,
      runtime_files_to_delete: plan.summary.runtime_files_to_delete,
      kov_admin_rows_to_reset: plan.summary.kov_admin_rows_to_reset,
      stale_admin_ingested_count: plan.summary.stale_admin_ingested_count,
      removes_top_level_ingested_status_count: plan.summary.removes_top_level_ingested_status_count,
      municipalities: plan.municipalities.map(item => ({
        municipality_id: item.municipality_id,
        slug: item.slug,
        matched_rag_doc_ids: item.matched_rag_doc_ids,
        admin_status_reset: item.admin_status_reset ? {
          available: item.admin_status_reset.available,
          staleAdminIngested: item.admin_status_reset.staleAdminIngested,
          removes_top_level_ingested_status: item.admin_status_reset.removes_top_level_ingested_status,
          before: item.admin_status_reset.before,
          after: item.admin_status_reset.after,
          changes: item.admin_status_reset.changes,
          will_update: item.admin_status_reset.will_update
        } : null,
        counts: item.counts,
        runtime_files_to_delete: item.planned_actions.delete_runtime_files,
        warnings: item.warnings
      }))
    }, null, 2));
    return;
  }

  plan.execution = await executePlan(plan, args);
  const afterSnapshots = await loadSnapshots(municipalities);
  const duplicateAfter = countDuplicateNormalizedCanonicalIds(afterSnapshots.rows.filter(row => row.active === true));
  plan.source_package_snapshots.by_municipality_after = groupSnapshotSummary(afterSnapshots.rows);
  plan.source_package_snapshots.duplicate_normalized_canonical_ids_after = duplicateAfter;
  plan.summary.active_duplicate_normalized_canonical_id_count_after = duplicateAfter.duplicate_row_count;

  if (outputPath) await writeJson(outputPath, plan);
  console.log(JSON.stringify({
    ok: plan.ok,
    mode: "write",
    output: outputPath,
    deleted_rag_documents: plan.execution.deleted_rag_documents.length,
    failed_rag_documents: plan.execution.failed_rag_documents.length,
    archived_source_package_snapshots: plan.execution.archived_source_package_snapshots,
    reset_kov_admin_rows: plan.execution.reset_kov_admin_rows,
    deleted_runtime_files: plan.execution.deleted_runtime_files.length,
    failed_runtime_files: plan.execution.failed_runtime_files.length,
    active_duplicate_normalized_canonical_id_count_after: plan.summary.active_duplicate_normalized_canonical_id_count_after
  }, null, 2));
  if (plan.execution.failed_rag_documents.length > 0 || plan.execution.failed_runtime_files.length > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(`[rag:cleanup:kov] ${error?.message || String(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma?.$disconnect?.().catch(() => {});
  });
