import { createRecordingStorage } from "./recordingStorage.js";

// E6 (audit 12 K1): kõnesalvestise retention'i jõustus. Purge kustutab füüsilise
// failiobjekti, seotud dokumendi (createdDocument) ja märgib CallRecordingFile rea
// DELETED-iks. Nii auto-purge (retentionUntil möödas) kui omaniku käsitsi kustutus
// jooksevad sama tuuma kaudu.
//
// SOL-CALL-06 — MIKS SEE FAIL ÜMBER KIRJUTATI.
//
// Vana `purgeRecordingFile()` neelas KOLM eraldi viga (`.catch(() => {})`) ja
// tagastas alati `true`. Tagajärg ei olnud „natuke ebatäpne raport", vaid kadunud
// mehhanism: kui füüsiline kustutus tõrkus, kirjutati reale ikkagi `DELETED` — ja
// sweep ei vali `DELETED` rida enam KUNAGI. Fail jäi kettale, DB ütles, et teda ei
// ole, ja automaatne taasproov kadus koos tõega. Kasutajale öeldi „kustutatud".
//
// Nüüd on kustutus ASTMELINE ja iga aste kinnitatakse:
//   1. `DELETE_PENDING` — kavatsus kirja ENNE ühegi artefakti puutumist;
//   2. artefakt(id) — dokumendi oma JA toores egress-fail (vt allpool, miks kaks);
//   3. `UserDocument` rida;
//   4. alles siis `DELETED`.
// Iga aste, mis ei õnnestu, jätab rea `DELETE_PENDING`-iks. Sweep valib teda
// uuesti — pooleli jäänud kustutus on ise oma taasproovi allikas.
//
// KAKS ARTEFAKTI, MITTE ÜKS. Finaliseeritud salvestis elab dokumendisalvestuses
// (`uploads/...`) ja tema kustutus käib `deleteStoredArtifact` kaudu.
// Finaliseerimata salvestis (PROCESSING / FAILED / QUARANTINED) elab egress'i
// väljundkaustas ja tema nimi EI OLE dokumenditee. Vana kood saatis mõlemad
// `deleteStoredArtifact`-i, mis nõuab `uploads/` prefiksit — toores fail andis seal
// tee-vea, mis neelati alla. St karantiini pandud partiaali ei kustutanud KEEGI,
// kuigi raport luges ta „purged" hulka.

// Read, mis hoiavad veel füüsilist artefakti või partiaali. DELETED on juba tehtud.
// SOL-CALL-01 lisas `QUARANTINED`: nõusoleku tagasivõtul kõrvaldatud artefakt, mille
// kustutus ei ole kinnitatud. SOL-CALL-06 lisas `DELETE_PENDING`: pooleli jäänud
// kustutus. Ilma nendeta jääks kumbki igaveseks kettale seisma.
const PURGEABLE_FILE_STATUSES = ["AVAILABLE", "PROCESSING", "FAILED", "QUARANTINED", "DELETE_PENDING"];

const DOCUMENT_PATH_PREFIX = "uploads/";

function isDocumentStoragePath(value) {
  return String(value || "").replace(/\\/g, "/").startsWith(DOCUMENT_PATH_PREFIX);
}

function failure(step, error) {
  return {
    purged: false,
    step,
    errorCode: String(error?.code || error?.message || "unknown").slice(0, 120)
  };
}

/**
 * Tagastab `{ purged, step, errorCode }`. `purged: true` tähendab, et KÕIK sammud on
 * kinnitatud — kutsuja tohib alles siis öelda inimesele „kustutatud". Idempotentne:
 * juba `DELETED` rida, puuduv dokument ja puuduv fail (ENOENT) on kõik õnnestumine,
 * sest lõppseis on täpselt see, mida taheti.
 */
export async function purgeRecordingFile({ db, file, storage = null }) {
  if (!db || !file) return { purged: false, step: "input", errorCode: "missing_input" };
  if (file.status === "DELETED") return { purged: true, step: "already_deleted", errorCode: null };
  const resolvedStorage = storage || createRecordingStorage();

  // 1. KAVATSUS. Kirjutatakse enne artefakte, et protsessi surm poole pealt jätaks
  //    maha jälje, mille sweep üles korjab. Kui see kirjutus kukub, ei ole meil
  //    õigust ka artefakte puutuda — muidu kaob fail ilma ühegi kirjeta.
  if (db.callRecordingFile?.update) {
    const marked = await db.callRecordingFile
      .update({ where: { id: file.id }, data: { status: "DELETE_PENDING" } })
      .catch(error => error);
    if (marked instanceof Error) return failure("mark_pending", marked);
  }

  const doc =
    file.createdDocumentId && db.userDocument?.findFirst
      ? await db.userDocument.findFirst({ where: { id: file.createdDocumentId } }).catch(() => null)
      : null;

  // 2a. Dokumendisalvestuse objekt (finaliseeritud salvestis).
  const documentPath = doc?.storagePath || (isDocumentStoragePath(file.filePath) ? file.filePath : null);
  if (documentPath && resolvedStorage.deleteStoredArtifact) {
    try {
      await resolvedStorage.deleteStoredArtifact({ storagePath: documentPath });
    } catch (error) {
      return failure("artifact", error);
    }
  }

  // 2b. Toores egress-väljund (finaliseerimata salvestis). Vt faili päist: see samm
  //     PUUDUS täielikult ja just tema all elas kustutamata partiaal.
  const rawFileName = !isDocumentStoragePath(file.filePath) ? file.filePath : null;
  if (rawFileName && resolvedStorage.discardEgressArtifact) {
    try {
      await resolvedStorage.discardEgressArtifact({ fileName: rawFileName });
    } catch (error) {
      return failure("egress_artifact", error);
    }
  }

  // 3. Dokumendi rida. Alles pärast objekti — vastupidises järjekorras kaoks ainus
  //    viide teele, mille pealt objekt üles leitakse.
  if (doc && db.userDocument?.deleteMany) {
    const removed = await db.userDocument.deleteMany({ where: { id: doc.id } }).catch(error => error);
    if (removed instanceof Error) return failure("document_row", removed);
  }

  // 4. Alles nüüd tohib rida öelda, et faili ei ole.
  if (db.callRecordingFile?.update) {
    const finished = await db.callRecordingFile
      .update({
        where: { id: file.id },
        data: { status: "DELETED", filePath: null, createdDocumentId: null }
      })
      .catch(error => error);
    if (finished instanceof Error) return failure("file_row", finished);
  }
  return { purged: true, step: "done", errorCode: null };
}

export async function purgeExpiredCallRecordings({ db, now = () => new Date(), storage = null, limit = 100 } = {}) {
  if (!db?.callRecordingFile?.findMany) return { scanned: 0, purged: 0, deferred: 0, failed: 0 };
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
  const failures = [];
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
    const result = await purgeRecordingFile({ db, file, storage: resolvedStorage });
    /* SOL-CALL-06: `purged` kasvab AINULT kinnitatud kustutuse peale. Vana loendur
       kasvas iga kandidaadi peale ja raport oli seetõttu kandidaatide, mitte tehtud
       töö arv. */
    if (result.purged) purged += 1;
    else failures.push({ fileId: file.id, step: result.step, errorCode: result.errorCode });
  }
  /* `deferred` ja `failed` raporteeritakse, sest vaikiv vahelejätt näeb
     koristusarvestuses välja nagu „polnudki midagi teha". */
  return { scanned: candidates.length, purged, deferred, failed: failures.length, failures };
}
