import { createRecordingStorage } from "./recordingStorage.js";

// E6 (audit 12 K1): kõnesalvestise retention'i jõustus. Purge kustutab füüsilise
// failiobjekti, seotud dokumendi (createdDocument) ja märgib CallRecordingFile rea
// DELETED-iks. Idempotentne: juba DELETED rida, puuduv dokument või puuduv fail ei
// ole viga (parim pingutus). Nii auto-purge (retentionUntil möödas) kui omaniku
// käsitsi kustutus jooksevad sama tuuma kaudu.

// Read, mis hoiavad veel füüsilist artefakti või partiaali. DELETED on juba tehtud.
const PURGEABLE_FILE_STATUSES = ["AVAILABLE", "PROCESSING", "FAILED"];

export async function purgeRecordingFile({ db, file, storage = null }) {
  if (!db || !file) return false;
  const resolvedStorage = storage || createRecordingStorage();

  // Seotud dokument (kõne-salvestuse UserDocument) — kustutame nii rea kui salvestuse.
  const doc =
    file.createdDocumentId && db.userDocument?.findFirst
      ? await db.userDocument.findFirst({ where: { id: file.createdDocumentId } }).catch(() => null)
      : null;

  // Füüsiline objekt: dokumendi storagePath (finaliseeritud) või faili filePath.
  const storagePath = doc?.storagePath || file.filePath || null;
  if (storagePath && resolvedStorage.deleteStoredArtifact) {
    await resolvedStorage.deleteStoredArtifact({ storagePath }).catch(() => {});
  }

  if (doc && db.userDocument?.deleteMany) {
    await db.userDocument.deleteMany({ where: { id: doc.id } }).catch(() => {});
  }

  if (db.callRecordingFile?.update) {
    await db.callRecordingFile
      .update({
        where: { id: file.id },
        data: { status: "DELETED", filePath: null }
      })
      .catch(() => {});
  }
  return true;
}

export async function purgeExpiredCallRecordings({ db, now = () => new Date(), storage = null, limit = 100 } = {}) {
  if (!db?.callRecordingFile?.findMany) return { scanned: 0, purged: 0 };
  const cutoff = now();
  const candidates = await db.callRecordingFile.findMany({
    where: {
      retentionUntil: { lte: cutoff },
      status: { in: PURGEABLE_FILE_STATUSES }
    },
    orderBy: { retentionUntil: "asc" },
    take: limit
  });
  const resolvedStorage = storage || createRecordingStorage();
  let purged = 0;
  for (const file of candidates) {
    const ok = await purgeRecordingFile({ db, file, storage: resolvedStorage });
    if (ok) purged += 1;
  }
  return { scanned: candidates.length, purged };
}
