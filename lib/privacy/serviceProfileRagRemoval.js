/**
 * SOL-SPROF-01 ja SOL-SPROF-02 — teenuseprofiili RAG-koopia eemaldamine on
 * MEHHANISM, mitte lause.
 *
 * MÕLEMA LEIU JUUR ON SAMA: profiil ütles „eemaldatud" enne, kui midagi oli
 * eemaldatud. `deleteRagDocument()` ei viska kunagi erindit — puuduva ID korral
 * `{ ok:false, skipped:true }`, päris tõrke korral `{ ok:false, error }` — ja
 * kutsuja ei vaadanud vastust. Kohe järel kirjutati `ragSourceId: null` ja
 * `syncStatus: "removed"`, seega kadus ka AINUS salvestatud viit orvule.
 * Kasutaja nägi „salvestatud", tema kontaktid jäid assistendile leitavaks.
 *
 * UUT TÖÖLIST SIIN EI EHITATA. `DataDeletionJob` kannab juba `RAG_DELETE`-i,
 * tal on `nextAttemptAt`, `attempts` ja `maxAttempts`, teda ajab taga
 * `deletionJobRetryService` ja teda loeb deploy-värav. Sama rada, mille
 * SOL-RAGADMIN-02 ja tõenduspõhised praktikad juba kasutavad — teine
 * järjekord tähendaks teist kohta, kust orbe otsida.
 *
 * KAKS REEGLIT, mis siin kehtivad:
 *   1. **Töö kirjutatakse ENNE kustutuskatset.** Kui protsess sureb katse ajal,
 *      peab jälg alles olema. Vastupidine järjekord kaotab orvu vaikselt.
 *   2. **`ragSourceId` kustub AINULT kinnitatud kustutuse järel.** Kinnitamata
 *      jäänud eemaldus jääb `pending_removal` seisu koos viida ja töö ID-ga.
 *      Viit ON tõend: ilma temata on orb leitav ainult sweep'iga, mis ei tea,
 *      et teda otsida tuleks.
 */

import { safeError } from "@/lib/privacy/safeError";

/* KUSTUTUSTEENUS ON SÜSTITAV, MITTE IMPORDITUD — ja tal EI OLE vaikeväärtust.
   `lib/documents/ragService` veab endaga kaasa `server-only` ahela, mille peale
   iga seda moodulit importiv ühiktest kukub (õppetund on kirjas ka
   SOL-RAGSVC juures). Protokoll peab olema imporditav ilma serverikihita;
   päris kutse annab kutsuja, kes on niikuinii serveris. */

export const SERVICE_PROFILE_RAG_RESOURCE_TYPE = "ServiceProviderProfile";
export const SERVICE_PROFILE_RAG_ACTION = "RAG_DELETE";

/** Eemalduse seisud, mida profiili `ragMetadata` võib kanda. */
export const ServiceProfileRagRemovalStatus = Object.freeze({
  /** Kaugkoopia on kinnitatult kadunud (või teda ei olnudki). */
  REMOVED: "removed",
  /** Kustutus ei ole kinnitatud. Viit ja töö on alles, retry-worker tegeleb. */
  PENDING_REMOVAL: "pending_removal"
});

/**
 * Kirjutab püsiva kustutustöö. IDEMPOTENTNE: sama dokumendi kohta ei teki teist
 * ootel tööd, sest kaks rida tähendaksid kaht taasproovi ja kaht auditijälge
 * ühe ja sama orvu kohta.
 *
 * `db` võib olla tehinguklient — töö peab sündima profiili olekumuutusega
 * SAMAS tehingus, muidu saab olek muutuda ilma jäljeta.
 */
export async function queueServiceProfileRagDeletionWithin(
  db,
  { profileId, ragSourceId, reason, actorUserId = null, targetUserId = null }
) {
  const docId = String(ragSourceId || "").trim();
  if (!docId) return null;

  const existing = await db.dataDeletionJob.findFirst({
    where: {
      action: SERVICE_PROFILE_RAG_ACTION,
      resourceType: SERVICE_PROFILE_RAG_RESOURCE_TYPE,
      externalRef: docId,
      status: { in: ["pending", "failed"] }
    },
    select: { id: true }
  });
  if (existing) return existing;

  return db.dataDeletionJob.create({
    data: {
      actorUserId: actorUserId || null,
      targetUserId: targetUserId || null,
      action: SERVICE_PROFILE_RAG_ACTION,
      resourceType: SERVICE_PROFILE_RAG_RESOURCE_TYPE,
      resourceId: profileId || null,
      externalRef: docId,
      /* `storagePath` kannab siin PÕHJUST, mitte teed — sama kokkulepe, mida
         kasutab tõenduspõhiste praktikate `queueRagDeletionTx`. Põhjus on
         masinloetav märksõna, mitte kasutaja tekst. */
      storagePath: String(reason || "profile_removed").slice(0, 200),
      status: "pending"
    },
    select: { id: true }
  });
}

/**
 * Proovib kaugkoopia kohe ära kustutada ja ütleb AUSALT, kas see õnnestus.
 *
 * Ei viska erindit: kutsuja peab saama kirjutada oma oleku ka siis, kui
 * RAG-teenus on maas. Tagastab `{ confirmed, reason }`, kus `confirmed:false`
 * tähendab, et töö jääb järjekorda ja profiil jääb `pending_removal`-iks.
 */
export async function attemptServiceProfileRagDeletion(
  ragSourceId,
  { deleteDocument, ragKeyPresent = true, observability = null } = {}
) {
  const docId = String(ragSourceId || "").trim();
  if (!docId) return { confirmed: true, reason: "no_document" };

  /* PUUDUV VÕTI EI OLE EDU. Vana kood tagastas siin `syncStatus:"skipped"` ja
     jättis kustutuse tegemata — kasutaja nõusoleku tagasivõtmine ei jõudnud
     välise koopiani ja keegi ei märkinud, et ta peaks. */
  if (!ragKeyPresent) return { confirmed: false, reason: "rag_key_missing" };
  if (typeof deleteDocument !== "function") return { confirmed: false, reason: "rag_delete_not_configured" };

  try {
    const result = await deleteDocument(docId, observability);
    /* `ok:true` katab ka 404 (`missing:true`) — soovitud tulemus on juba tõsi.
       `skipped:true` tähendab tühja ID-d ja siia ta ei jõua. */
    if (result?.ok) return { confirmed: true, reason: result.missing ? "already_absent" : "deleted" };
    return { confirmed: false, reason: result?.reason || "rag_delete_failed" };
  } catch (error) {
    try {
      console.error("[service-profile-rag] delete threw", safeError(error));
    } catch {}
    return { confirmed: false, reason: "rag_delete_threw" };
  }
}

/**
 * Ehitab `ragMetadata` väärtuse eemalduse kohta. Eraldi funktsioon, sest sama
 * kuju kirjutavad kolm kohta (profiilisalvestus, konto kustutus, retry-teenus)
 * ja kolm koopiat lahkneksid.
 */
export function serviceProfileRemovalMetadata({ confirmed, reason, jobId = null, docId = null, now = new Date() }) {
  return {
    syncStatus: confirmed
      ? ServiceProfileRagRemovalStatus.REMOVED
      : ServiceProfileRagRemovalStatus.PENDING_REMOVAL,
    reason: String(reason || "").slice(0, 120),
    ...(confirmed ? {} : { pendingJobId: jobId || null, pendingDocId: docId || null }),
    checkedAt: (now instanceof Date ? now : new Date()).toISOString()
  };
}

/**
 * Terviklik eemaldus ühe profiili kohta: töö järjekorda → kustutuskatse →
 * aus olek. Tagastab kirjutamiseks valmis `data` osa, mitte ei kirjuta ise —
 * kutsuja teab, kas ta on tehingus ja millised muud väljad kaasa lähevad.
 */
export async function removeServiceProfileFromRag(
  { profileId, ragSourceId, reason, actorUserId = null, targetUserId = null, ragKeyPresent = true },
  { db, deleteDocument, now = new Date() } = {}
) {
  if (!db) throw new TypeError("db is required");
  const docId = String(ragSourceId || "").trim();
  if (!docId) {
    return { data: { ragMetadata: serviceProfileRemovalMetadata({ confirmed: true, reason: "no_document", now }) }, confirmed: true };
  }

  const job = await queueServiceProfileRagDeletionWithin(db, {
    profileId,
    ragSourceId: docId,
    reason,
    actorUserId,
    targetUserId
  });

  const attempt = await attemptServiceProfileRagDeletion(docId, {
    deleteDocument,
    ragKeyPresent,
    observability: { route: "service-provider/profile", stage: "rag_delete", userId: targetUserId || actorUserId }
  });

  if (attempt.confirmed && job?.id) {
    await db.dataDeletionJob.update({
      where: { id: job.id },
      data: { status: "done", lastError: null, lastErrorCode: null, nextAttemptAt: null }
    }).catch(() => null);
  }

  return {
    confirmed: attempt.confirmed,
    jobId: job?.id || null,
    data: {
      /* VIIT KUSTUB AINULT KINNITUSE JÄREL. Kinnitamata eemaldus hoiab ta
         alles — tema kadumine oli see, mis muutis orvu nähtamatuks. */
      ...(attempt.confirmed ? { ragSourceId: null } : {}),
      ragMetadata: serviceProfileRemovalMetadata({
        confirmed: attempt.confirmed,
        reason: attempt.reason,
        jobId: job?.id || null,
        docId,
        now
      })
    }
  };
}
