/**
 * SOL-RAGADMIN-01 — faili ja metadata vahetuse TAASTATAV protokoll.
 *
 * MIDA SEE FAIL LAHENDAB. KOV- ja organisatsioonifaili asendamine tegi asjad
 * järjekorras, mis kaotab andmeid ühe vahepealse tõrke peale:
 *
 *   1. kirjuta uus fail          2. DB osutab uuele failile
 *   3. kustuta VANA fail         4. veel mitu DB-/sünkroniseerimistoimingut
 *
 * ja `catch` kustutas **uue faili** — ka siis, kui samm 2 oli juba läinud ja
 * samm 3 oli vana faili juba hävitanud. Üks tõrge sammus 4 jättis järele DB-rea,
 * mis osutab **olematule failile**, ja kumbagi faili enam ei olnud. Kustutamisel
 * oli sama viga peegelpildis: füüsiline fail kadus ENNE DB-rida, seega DB tõrge
 * jättis kirje failile, mida ei ole.
 *
 * KOGU PROTOKOLL SEISAB ÜHE LAUSE PEAL: **aktiivne kirje osutab alati
 * olemasolevale failile.** Sellest tuleneb kõik muu.
 *
 *   · Enne vahetuspunkti on ainus ohutu koristus UUS fail (teda ei näe keegi).
 *   · **Vahetuspunkt on DB-kirjutus.** Pärast teda ei tohi ükski samm — ei
 *     koristus, ei sünkroniseerimine, ei järeltegevus — uut faili puutuda.
 *   · Vana faili koristus on IDEMPOTENTNE JÄRELTEGEVUS, mitte osa tehingust.
 *     Tema tõrge ei tohi päringut kukutada: DB on juba õige ja allesjäänud vana
 *     fail on orb, mitte vale.
 *   · Kustutamisel läheb **DB nähtavus esimesena**. Orb fail on ohutu — talle ei
 *     osuta keegi. Kirje ilma failita ei ole ohutu.
 *
 * ORB EI KAO VAIKSELT. Iga koristus, mis ei õnnestunud, kirjutab püsiva
 * `DataDeletionJob` rea (`FILE_DELETE`), mille admin näeb ja mida saab uuesti
 * proovida. Ainult logisse kirjutamine tähendaks, et faili olemasolust teab
 * ainult see, kes juhtus logi lugema.
 */

import { createDataDeletionJob, DELETION_STATUS } from "@/lib/privacy/deletionJobs";
import { safeError } from "@/lib/privacy/safeError";

/** `DataDeletionJob.resourceType` väärtused, mida retry-teenus oskab koristada. */
export const RAG_ADMIN_FILE_RESOURCE = Object.freeze({
  KOV: "KovAdminFile",
  ORGANIZATION: "OrganizationAdminFile"
});

/**
 * Kirjutab orvu kohta püsiva rea. EI VISKA: orvu kirjapanek ei tohi olla põhjus,
 * miks õnnestunud toiming kasutajale ebaõnnestub.
 *
 * `recordOrphan` on SÜSTITAV, et veasüstetestid saaksid orvu kirjapanekut
 * TÕENDADA, mitte ainult loota. Vaikimisi kirjutab ta päris `DataDeletionJob`
 * rea.
 */
export async function recordOrphanFile({ resourceType, resourceId, storagePath, actorUserId, error }) {
  if (!storagePath) return null;
  try {
    return await createDataDeletionJob({
      actorUserId,
      action: "FILE_DELETE",
      resourceType,
      resourceId,
      storagePath,
      status: DELETION_STATUS.PENDING,
      /* Erindi KLASS ja kood, mitte teade: teade võib kanda failiteed koos
         sisuga või päringu argumente. */
      lastError: String(error?.code || error?.name || "unlink_failed").slice(0, 200)
    });
  } catch (jobError) {
    try {
      console.error("[rag-admin/file-swap] orphan record failed", safeError(jobError));
    } catch {}
    return null;
  }
}

/**
 * ASENDAMINE. Uus fail on juba kirjutatud (oma UUID-teele, seega ta ei kirjuta
 * vana üle); siit algab vahetus.
 *
 * @param {object} input
 * @param {() => Promise<unknown>} input.commit ATOMAARNE vahetuspunkt (DB-kirjutus)
 * @param {string} input.newStoragePath enne vahetuspunkti ainus ohutu koristus
 * @param {string|null} input.previousStoragePath vana fail, koristatakse PÄRAST
 * @param {(path: string) => Promise<void>} input.deleteFile idempotentne kustutaja
 * @returns {Promise<{ committed: true, orphanedPath: string|null }>}
 */
export async function commitFileSwap({
  commit,
  newStoragePath,
  previousStoragePath = null,
  deleteFile,
  resourceType,
  resourceId = null,
  actorUserId = null,
  recordOrphan = recordOrphanFile
}) {
  try {
    await commit();
  } catch (error) {
    /* VAHETUSPUNKTINI EI JÕUTUD: uut faili ei näe keegi ja vana on puutumata.
       See on ainus koht, kus uue faili kustutamine on õige. */
    if (newStoragePath) {
      try {
        await deleteFile(newStoragePath);
      } catch (cleanupError) {
        await recordOrphan({
          resourceType,
          resourceId,
          storagePath: newStoragePath,
          actorUserId,
          error: cleanupError
        });
      }
    }
    throw error;
  }

  /* SIIT EDASI ON UUS FAIL VIIDATUD. Teda ei kustuta enam mitte keegi. */
  if (!previousStoragePath || previousStoragePath === newStoragePath) {
    return { committed: true, orphanedPath: null };
  }

  try {
    await deleteFile(previousStoragePath);
    return { committed: true, orphanedPath: null };
  } catch (error) {
    /* Vana fail jäi alles. DB on juba õige, seega see EI OLE päringu viga —
       ta on koristusvõlg ja tema koht on järjekorras, mitte veakoodis. */
    await recordOrphan({
      resourceType,
      resourceId,
      storagePath: previousStoragePath,
      actorUserId,
      error
    });
    return { committed: true, orphanedPath: previousStoragePath };
  }
}

/**
 * KUSTUTAMINE. DB nähtavus esimesena, füüsiline fail järeltegevusena.
 *
 * @param {object} input
 * @param {() => Promise<unknown>} input.removeRecord DB-rea eemaldus
 * @param {string} input.storagePath fail, mis koristatakse PÄRAST DB-d
 */
export async function commitFileRemoval({
  removeRecord,
  storagePath,
  deleteFile,
  resourceType,
  resourceId = null,
  actorUserId = null,
  recordOrphan = recordOrphanFile
}) {
  /* Kui see kukub, ei ole midagi juhtunud: kirje on alles ja fail on alles. */
  await removeRecord();

  if (!storagePath) return { removed: true, orphanedPath: null };

  try {
    await deleteFile(storagePath);
    return { removed: true, orphanedPath: null };
  } catch (error) {
    await recordOrphan({ resourceType, resourceId, storagePath, actorUserId, error });
    return { removed: true, orphanedPath: storagePath };
  }
}

/**
 * VAHETUSPUNKTI-JÄRGSED SAMMUD (`checkedAt`, seisu sünkroniseerimine, uuesti
 * lugemine).
 *
 * MIKS NAD EI TOHI PÄRINGUT KUKUTADA. Nad jooksevad siis, kui fail on kirjutatud
 * ja DB osutab talle — töö ON tehtud. 500 ütleks adminile „ei õnnestunud" ja ta
 * laeks faili uuesti üles; halvemal juhul viiks veaharu meid faili kustutama.
 * Ebaõnnestunud sünkroniseerimine on seisuvõlg, mille järgmine lugemine parandab.
 */
export async function afterCommit(label, run) {
  try {
    return await run();
  } catch (error) {
    try {
      console.error(`[rag-admin/file-swap] after-commit step failed: ${label}`, safeError(error));
    } catch {}
    return null;
  }
}
