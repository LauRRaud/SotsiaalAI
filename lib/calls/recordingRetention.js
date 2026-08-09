import { createRecordingStorage } from "./recordingStorage.js";

// E6 (audit 12 K1): kõnesalvestise retention'i jõustus. Purge kustutab füüsilise
// failiobjekti, seotud dokumendi (createdDocument) ja märgib CallRecordingFile rea
// DELETED-iks. Idempotentne: juba DELETED rida, puuduv dokument või puuduv fail ei
// ole viga (parim pingutus). Nii auto-purge (retentionUntil möödas) kui omaniku
// käsitsi kustutus jooksevad sama tuuma kaudu.

// Read, mis hoiavad veel füüsilist artefakti või partiaali. DELETED on juba tehtud.
// SOL-CALL-01 lisas `QUARANTINED`: nõusoleku tagasivõtul kõrvaldatud artefakt, mille
// kustutus ei ole kinnitatud. Ilma temata jääks karantiin igaveseks kettale seisma.
const PURGEABLE_FILE_STATUSES = ["AVAILABLE", "PROCESSING", "FAILED", "QUARANTINED"];

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
  let deferred = 0;
  for (const file of candidates) {
    /* SOL-CALL-01 — karantiini koristatakse ALLES siis, kui provider on stopi
       kinnitanud. Kinnitamata stopi korral võib egress samasse faili veel kirjutada
       ja kustutus sünnitaks lihtsalt uue partiaali, mida keegi ei jälgi. Reegel on
       siin nähtavas koodis, mitte `where`-klauslis, sest ta on ohutusotsus ja peab
       olema loetav ka siis, kui keegi päringut hiljem muudab. */
    if (file.status === "QUARANTINED" && !file.providerStopConfirmedAt) {
      deferred += 1;
      continue;
    }
    const ok = await purgeRecordingFile({ db, file, storage: resolvedStorage });
    if (ok) purged += 1;
  }
  /* `deferred` raporteeritakse, sest vaikiv vahelejätt näeb koristusarvestuses välja
     nagu „polnudki midagi teha". */
  return { scanned: candidates.length, purged, deferred };
}
