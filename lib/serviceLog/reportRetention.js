import { prisma } from "@/lib/prisma";

import { SERVICE_LOG_REPORT_KIND } from "./reportArchive.js";

export const REPORT_RETENTION_ERROR = "documents.errors.retention_locked";

/** Raporti säilitusklass on serveri määratud ega tohi omaniku PATCH-iga kaduda. */
export function preserveServiceLogReportKind(document, candidateKind) {
  return document?.kind === SERVICE_LOG_REPORT_KIND ? SERVICE_LOG_REPORT_KIND : candidateKind;
}

export function reportRetentionEnd(document) {
  if (document?.kind !== SERVICE_LOG_REPORT_KIND) return null;
  const value = document?.metadata?.retentionEndsAt;
  const parsed = value ? new Date(value) : null;
  return parsed && Number.isFinite(parsed.getTime()) ? parsed : null;
}

/** Puuduv/vigane tähtaeg on fail-closed: raamatupidamisaruannet ei kustutata. */
export function isServiceLogReportRetentionActive(document, now = new Date()) {
  if (document?.kind !== SERVICE_LOG_REPORT_KIND) return false;
  const retentionEndsAt = reportRetentionEnd(document);
  return !retentionEndsAt || retentionEndsAt.getTime() > now.getTime();
}

export function assertServiceLogReportDeletable(document, now = new Date()) {
  if (!isServiceLogReportRetentionActive(document, now)) return;
  const error = new Error(REPORT_RETENTION_ERROR);
  error.status = 409;
  throw error;
}

export function partitionDocumentsForAccountDeletion(documents = [], now = new Date()) {
  const retainedDocuments = [];
  const deletableDocuments = [];
  for (const document of documents) {
    if (isServiceLogReportRetentionActive(document, now)) retainedDocuments.push(document);
    else deletableDocuments.push(document);
  }
  return { retainedDocuments, deletableDocuments };
}

/**
 * Konto kustutus ei tohi User-FK kaskaadil raportit kaasa viia. Arhiivirida ei
 * kanna ownerId-d, e-posti ega muud aktiivset identiteediseost; alles jäävad
 * ainult väljastatud faili tõend ja tema säilituse metaandmed.
 */
export async function archiveRetainedServiceLogReportsForDeletedAccount(
  userId,
  { db = prisma, now = new Date(), protectedDocumentIds = [] } = {}
) {
  const protectedIds = new Set(protectedDocumentIds.map(String));
  return db.$transaction(async (tx) => {
    const reports = await tx.userDocument.findMany({
      where: { ownerId: userId, kind: SERVICE_LOG_REPORT_KIND },
      select: {
        id: true,
        title: true,
        originalName: true,
        mime: true,
        size: true,
        sha256: true,
        storagePath: true,
        metadata: true,
        createdAt: true
      }
    });

    let archived = 0;
    for (const report of reports) {
      if (!protectedIds.has(report.id) && !isServiceLogReportRetentionActive({ ...report, kind: SERVICE_LOG_REPORT_KIND }, now)) {
        continue;
      }
      const retentionEndsAt = reportRetentionEnd({ ...report, kind: SERVICE_LOG_REPORT_KIND });
      if (!retentionEndsAt) {
        const error = new Error("SERVICE_LOG_REPORT_RETENTION_INVALID");
        error.code = "SERVICE_LOG_REPORT_RETENTION_INVALID";
        throw error;
      }
      await tx.serviceLogReportLegalArchive.upsert({
        where: { sourceDocumentId: report.id },
        create: {
          sourceDocumentId: report.id,
          title: report.title,
          originalName: report.originalName,
          mime: report.mime,
          size: report.size,
          sha256: report.sha256,
          storagePath: report.storagePath,
          metadata: report.metadata,
          retentionEndsAt,
          issuedDocumentCreatedAt: report.createdAt
        },
        update: {}
      });
      await tx.userDocument.delete({ where: { id: report.id } });
      archived += 1;
    }
    return { archived };
  });
}

export async function purgeExpiredServiceLogReportArchives({
  db = prisma,
  now = new Date(),
  limit = 100,
  deleteFile = null
} = {}) {
  const removeFile = deleteFile || (async (storagePath) => {
    const { deleteStoredDocument } = await import("@/lib/documents/server");
    return deleteStoredDocument(storagePath);
  });
  const rows = await db.serviceLogReportLegalArchive.findMany({
    where: { retentionEndsAt: { lte: now } },
    orderBy: { retentionEndsAt: "asc" },
    take: limit,
    select: { id: true, storagePath: true }
  });
  let purged = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await removeFile(row.storagePath);
      await db.serviceLogReportLegalArchive.delete({ where: { id: row.id } });
      purged += 1;
    } catch {
      failed += 1;
    }
  }
  return { scanned: rows.length, purged, failed };
}
