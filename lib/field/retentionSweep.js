/**
 * FIELD-V1 server retention (O-FD-1), called from lib/retention.js inside the
 * shared sweep. Injectable db/now so the promise is unit-testable:
 *  - CLOSED/CANCELLED visits delete 90 days after their end (notes and
 *    attachment JOIN rows cascade; attachment documents are ordinary
 *    UserDocuments covered by the general document sweep);
 *  - a raw field-audio document purges 7 days after upload or as soon as its
 *    transcript is confirmed — fail-closed: the DB row goes only after the
 *    file and any RAG reference are gone, otherwise it stays for the next
 *    sweep (never a silent gap).
 */

import { logDataAudit } from "@/lib/privacy/audit";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function sweepFieldRetention({
  db,
  now = new Date(),
  generalCutoff,
  rawAudioDays = 7,
  helpers = null
} = {}) {
  const counts = { fieldVisits: 0, fieldAudio: 0 };
  if (!db?.fieldVisit?.deleteMany) return counts;
  const cutoff = generalCutoff instanceof Date ? generalCutoff : new Date(now.getTime() - 90 * DAY_MS);

  counts.fieldVisits = (await db.fieldVisit.deleteMany({
    where: {
      OR: [
        { status: "CLOSED", closedAt: { lt: cutoff } },
        { status: "CANCELLED", cancelledAt: { lt: cutoff } }
      ]
    }
  })).count;

  const fieldAudioCutoff = new Date(now.getTime() - rawAudioDays * DAY_MS);
  const links = await db.fieldVisitAttachment.findMany({
    where: {
      role: "audio",
      documentId: { not: null },
      OR: [
        { transcriptConfirmedAt: { not: null } },
        { createdAt: { lt: fieldAudioCutoff } }
      ]
    },
    select: {
      document: {
        select: {
          id: true,
          ownerId: true,
          title: true,
          originalName: true,
          kind: true,
          mime: true,
          size: true,
          sha256: true,
          storagePath: true,
          updatedAt: true
        }
      }
    },
    take: 100
  });
  if (!links.length) return counts;

  const resolved = helpers || (await loadDeletionHelpers());
  for (const link of links) {
    const document = link.document;
    if (!document) continue;
    const ragResult = await resolved.deleteDocumentRagReference({
      document,
      targetUserId: document.ownerId,
      action: "RAG_DELETE",
      auditResourceType: "UserDocument"
    });
    const fileResult = await resolved.deleteTrackedStorageFile({
      targetUserId: document.ownerId,
      resourceType: "UserDocument",
      resourceId: document.id,
      storagePath: document.storagePath,
      deleteFile: resolved.deleteStoredDocument
    });
    if (!ragResult.ok || !fileResult.ok) continue;
    const deleted = await db.userDocument.deleteMany({ where: { id: document.id } });
    counts.fieldAudio += deleted.count;
    if (deleted.count) {
      await logDataAudit({
        targetUserId: document.ownerId,
        action: "RETENTION_FIELD_AUDIO_DELETE",
        resourceType: "UserDocument",
        resourceId: document.id,
        meta: { kind: document.kind, mime: document.mime, size: document.size }
      });
    }
  }
  return counts;
}

async function loadDeletionHelpers() {
  const [{ deleteStoredDocument }, { deleteDocumentRagReference }, { deleteTrackedStorageFile }] = await Promise.all([
    import("@/lib/documents/server"),
    import("@/lib/privacy/documentDeletion"),
    import("@/lib/privacy/fileDeletion")
  ]);
  return { deleteStoredDocument, deleteDocumentRagReference, deleteTrackedStorageFile };
}
