import { deleteRagDocument } from "@/lib/documents/ragService";
import { prisma } from "@/lib/prisma";

import {
  buildKovAdminStatusResetPlan,
  clean,
  collectRagDocuments,
  countDuplicateNormalizedCanonicalIds,
  documentMatchesCleanupLayer,
  groupSnapshotSummary,
  mergeDocumentMetadata,
  readKovBundleReadiness,
  readRegistry,
  recordLooksLikeMunicipality,
  summarizeDocumentRecord
} from "../../../../scripts/lib/kov-rag-state.mjs";

function matchedDocumentsForMunicipality(records = [], municipality = {}, origin = "unknown") {
  return records
    .map(record => mergeDocumentMetadata(record))
    .filter(record => recordLooksLikeMunicipality(record, municipality))
    .map(record => summarizeDocumentRecord(record, origin));
}

function matchedDocumentsForMunicipalityLayer(records = [], municipality = {}, origin = "unknown", layer = "all") {
  return matchedDocumentsForMunicipality(records, municipality, origin)
    .filter(record => documentMatchesCleanupLayer(record, municipality, layer));
}

function documentExistsInApi(records = [], docId) {
  const id = clean(docId);
  if (!id) return false;
  return records.some(record => {
    const merged = mergeDocumentMetadata(record);
    return clean(merged.doc_id || merged.docId || merged.document_id || merged.documentId || merged.id) === id;
  });
}

async function loadAdminRow(slug) {
  return prisma.municipalityKovAdmin.findFirst({
    where: {
      municipality: {
        slug
      }
    },
    include: {
      municipality: {
        select: {
          id: true,
          slug: true,
          displayName: true,
          county: true,
          type: true,
          isActive: true
        }
      }
    }
  });
}

async function loadSnapshots(municipalityId) {
  return prisma.sourcePackageSnapshot.findMany({
    where: {
      municipalityId
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
}

export async function planKovRagStateResetBySlug(slug, options = {}) {
  const normalizedSlug = String(slug || "").trim().toLowerCase();
  const layer = ["all", "web", "rt"].includes(options.layer) ? options.layer : "all";
  if (!normalizedSlug) {
    const error = new Error("Missing municipality slug");
    error.status = 400;
    throw error;
  }

  const adminRow = await loadAdminRow(normalizedSlug);
  if (!adminRow) {
    const error = new Error("Municipality KOV admin entry not found");
    error.status = 404;
    throw error;
  }

  const municipality = {
    municipality_id: clean(adminRow.municipalityId),
    municipality_name: clean(adminRow.municipality?.displayName),
    slug: clean(adminRow.municipality?.slug)
  };

  const [registry, documentsApi, snapshots, bundleReadiness] = await Promise.all([
    readRegistry(),
    collectRagDocuments(),
    loadSnapshots(adminRow.municipalityId),
    readKovBundleReadiness(municipality)
  ]);

  const registryMatches = matchedDocumentsForMunicipalityLayer(registry.records, municipality, "registry", layer);
  const apiMatches = matchedDocumentsForMunicipalityLayer(documentsApi.records, municipality, "documents_api", layer);
  const byDocId = new Map();
  for (const doc of [...registryMatches, ...apiMatches]) {
    if (!doc.docId) continue;
    const existing = byDocId.get(doc.docId);
    byDocId.set(
      doc.docId,
      existing
        ? {
            ...existing,
            ...Object.fromEntries(Object.entries(doc).filter(([, value]) => value != null))
          }
        : doc
    );
  }

  const activeSnapshots = layer === "rt" ? [] : snapshots.filter(row => row.active === true);
  const archivedSnapshots = snapshots.filter(row => row.active !== true);
  const adminStatusReset = layer === "all"
    ? buildKovAdminStatusResetPlan({
        row: adminRow,
        municipality,
        bundleReadiness,
        webDocumentExists: documentExistsInApi(documentsApi.records, adminRow.ragDocId || `kov-${normalizedSlug}`),
        rtDocumentExists: documentExistsInApi(documentsApi.records, adminRow.rtRagDocId || `kov-rt-${normalizedSlug}`)
      })
    : { will_update: false, reason: `skipped_for_layer_${layer}` };
  const duplicateBefore = countDuplicateNormalizedCanonicalIds(snapshots.filter(row => row.active === true));

  return {
    ok: true,
    mode: "dry-run",
    cleanup_layer: layer,
    generated_at: new Date().toISOString(),
    municipality,
    registry: {
      available: registry.available,
      path: registry.path
    },
    documents_api: {
      available: documentsApi.available,
      base_url: documentsApi.baseUrl,
      errors: documentsApi.errors
    },
    matched_registry_entries: registryMatches,
    matched_documents_api_entries: apiMatches,
    matched_rag_doc_ids: [...byDocId.keys()].sort(),
    source_package_snapshots: {
      available: true,
      by_municipality: groupSnapshotSummary(snapshots),
      duplicate_normalized_canonical_ids_before: duplicateBefore,
      rows: snapshots.map(row => ({
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
      }))
    },
    admin_status_reset: adminStatusReset,
    planned_actions: {
      cleanup_layer: layer,
      delete_rag_documents_via_service: [...byDocId.keys()].sort(),
      archive_active_source_package_snapshots: activeSnapshots.map(row => row.id).sort(),
      leave_archived_source_package_snapshots: archivedSnapshots.map(row => row.id).sort(),
      reset_kov_admin_state: adminStatusReset.will_update
        ? {
            admin_id: adminStatusReset.admin_id,
            changes: adminStatusReset.changes
          }
        : null
    },
    summary: {
      cleanup_layer: layer,
      matched_rag_doc_ids: byDocId.size,
      source_package_snapshot_rows: snapshots.length,
      active_snapshot_count: activeSnapshots.length,
      archived_snapshot_count: archivedSnapshots.length,
      review_event_count: snapshots.reduce((sum, row) => sum + Number(row._count?.reviewEvents || 0), 0),
      stale_admin_ingested: adminStatusReset.staleAdminIngested,
      admin_row_will_reset: adminStatusReset.will_update,
      removes_top_level_ingested_status: adminStatusReset.removes_top_level_ingested_status,
      duplicate_normalized_canonical_id_count_before: duplicateBefore.duplicate_row_count
    }
  };
}

export async function executeKovRagStateResetBySlug(slug) {
  const plan = await planKovRagStateResetBySlug(slug);

  const execution = {
    deleted_rag_documents: [],
    failed_rag_documents: [],
    archived_source_package_snapshots: 0,
    reset_kov_admin_rows: 0
  };

  for (const docId of plan.planned_actions.delete_rag_documents_via_service) {
    const result = await deleteRagDocument(docId, {
      route: "api/admin/rag/kov/reset-rag-state",
      stage: "kov_reset"
    });
    if (result.ok) execution.deleted_rag_documents.push({ docId });
    else execution.failed_rag_documents.push({ docId, error: String(result.error?.message || result.error || "delete_failed") });
  }

  if (plan.planned_actions.archive_active_source_package_snapshots.length > 0) {
    const archiveResult = await prisma.sourcePackageSnapshot.updateMany({
      where: {
        id: {
          in: plan.planned_actions.archive_active_source_package_snapshots
        },
        active: true
      },
      data: {
        active: false,
        status: "archived",
        reviewStatus: "archived"
      }
    });
    execution.archived_source_package_snapshots = Number(archiveResult.count || 0);
  }

  if (plan.admin_status_reset?.will_update && plan.admin_status_reset?.admin_id) {
    await prisma.municipalityKovAdmin.update({
      where: { id: plan.admin_status_reset.admin_id },
      data: {
        status: plan.admin_status_reset.after.adminStatus,
        readyForIngest: plan.admin_status_reset.after.readyForIngest,
        ingestStatus: plan.admin_status_reset.after.ingestStatus,
        lastIngestedAt: null,
        lastIngestError: null,
        rtIngestStatus: plan.admin_status_reset.after.rtIngestStatus,
        rtLastIngestedAt: null,
        rtLastIngestError: null
      }
    });
    execution.reset_kov_admin_rows = 1;
  }

  const afterSnapshots = await loadSnapshots(plan.municipality.municipality_id);
  const duplicateAfter = countDuplicateNormalizedCanonicalIds(afterSnapshots.filter(row => row.active === true));

  return {
    ...plan,
    mode: "write",
    execution,
    source_package_snapshots: {
      ...plan.source_package_snapshots,
      by_municipality_after: groupSnapshotSummary(afterSnapshots),
      duplicate_normalized_canonical_ids_after: duplicateAfter
    },
    summary: {
      ...plan.summary,
      duplicate_normalized_canonical_id_count_after: duplicateAfter.duplicate_row_count
    }
  };
}

export async function executeKovRagWebLayerCleanupBySlug(slug) {
  const plan = await planKovRagStateResetBySlug(slug, { layer: "web" });

  const execution = {
    deleted_rag_documents: [],
    failed_rag_documents: [],
    archived_source_package_snapshots: 0,
    reset_kov_admin_rows: 0
  };

  for (const docId of plan.planned_actions.delete_rag_documents_via_service) {
    const result = await deleteRagDocument(docId, {
      route: "api/admin/rag/kov/replace-ingest",
      stage: "kov_web_replace_cleanup"
    });
    if (result.ok) execution.deleted_rag_documents.push({ docId });
    else execution.failed_rag_documents.push({ docId, error: String(result.error?.message || result.error || "delete_failed") });
  }

  if (plan.planned_actions.archive_active_source_package_snapshots.length > 0) {
    const archiveResult = await prisma.sourcePackageSnapshot.updateMany({
      where: {
        id: {
          in: plan.planned_actions.archive_active_source_package_snapshots
        },
        active: true
      },
      data: {
        active: false,
        status: "archived",
        reviewStatus: "archived"
      }
    });
    execution.archived_source_package_snapshots = Number(archiveResult.count || 0);
  }

  if (execution.failed_rag_documents.length > 0) {
    const error = new Error("KOV web replace cleanup failed");
    error.status = 502;
    error.execution = execution;
    throw error;
  }

  const afterSnapshots = await loadSnapshots(plan.municipality.municipality_id);
  const duplicateAfter = countDuplicateNormalizedCanonicalIds(afterSnapshots.filter(row => row.active === true));

  return {
    ...plan,
    mode: "write",
    execution,
    source_package_snapshots: {
      ...plan.source_package_snapshots,
      by_municipality_after: groupSnapshotSummary(afterSnapshots),
      duplicate_normalized_canonical_ids_after: duplicateAfter
    },
    summary: {
      ...plan.summary,
      duplicate_normalized_canonical_id_count_after: duplicateAfter.duplicate_row_count
    }
  };
}
