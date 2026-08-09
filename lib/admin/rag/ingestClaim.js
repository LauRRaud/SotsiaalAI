/**
 * SOL-RAGADMIN-03 — ingest'i ATOMAARNE claim koos lease'iga.
 *
 * MIDA SEE FAIL LAHENDAB. Ingest kontrollis LOETUD objektilt, kas seis on
 * `INGESTING`, ja seadis seisu hiljem TINGIMUSETA `update`-iga:
 *
 *   1. loe rida    2. kas ta on INGESTING?    3. update ingestStatus = INGESTING
 *
 * Sammude 2 ja 3 vahel ei hoia miski kinni. Kaks paralleelset päringut läbisid
 * mõlemad eelkontrolli ja käivitasid sama `doc_id` ingest'i — kaks kirjutust
 * samale dokumendile, tulemus juhuslik. Ja katkestus oli veel hullem: protsessi
 * surm pärast sammu 3 jättis rea `INGESTING`-usse, staatuse sünkroniseerija
 * SÄILITAS seda seisu alati ja iga järgmine ingest blokeeriti. Lukk ilma omanikku
 * ja ilma tähtajata.
 *
 * KOGU PROTOKOLL SEISAB KAHE LAUSE PEAL:
 *
 *   1. **Luku võtmine on ÜKS tingimuslik kirjutus, mitte kontroll + kirjutus.**
 *      `updateMany` kannab tingimuse `where`-is, seega PostgreSQL otsustab
 *      võitja: `count === 1` tähendab „minu oma", `count === 0` „keegi teine
 *      jõudis ette". Kahe sammu vahel ei ole enam akent, sest sammu on üks.
 *   2. **Igal lukul on omanik ja tähtaeg.** `claimId` on ühe katse töö-ID ja
 *      lõppseis kirjutatakse AINULT tema järgi; `claimedAt` on lease'i algus ja
 *      aegunud claim on varastatav. Lukk, mida ei saa vabastada, ei ole kaitse —
 *      ta on ummik, mis näeb välja nagu kaitse.
 *
 * `claimedAt IS NULL` LOETAKSE AEGUNUKS. Nii on enne seda parandust
 * `INGESTING`-usse jäänud rida kohe varastatav — vanad ummikud lahenevad
 * esimese uue katsega ja ükski andmerida ei vaja backfill'i.
 *
 * KOLM RADA, ÜKS PROTOKOLL: KOV veeb, KOV Riigi Teataja ja organisatsioon
 * kandsid sama viga kolmes koopias. Erinevus on ainult veerunimedes
 * ({@link INGEST_LANES}).
 */

import { randomUUID } from "node:crypto";

/**
 * Lease'i pikkus. RAG-päringu enda ülempiir on `RAG_TIMEOUT_MS` (30 s), seega
 * elus ingest jõuab kordades varem valmis; 15 minutit on „ilmselgelt surnud"
 * piir, mitte ajastuse peenhäälestus.
 */
export const INGEST_LEASE_MS = 15 * 60 * 1000;

export const INGEST_STATUS = Object.freeze({
  INGESTING: "INGESTING",
  INGESTED: "INGESTED",
  ERROR: "ERROR"
});

/** Millised veerud kannavad millisel rajal ingest'i seisu. */
export const INGEST_LANES = Object.freeze({
  KOV_WEB: Object.freeze({
    key: "kov_web",
    status: "ingestStatus",
    claimId: "ingestClaimId",
    claimedAt: "ingestClaimedAt",
    error: "lastIngestError",
    ingestedAt: "lastIngestedAt",
    docId: "ragDocId"
  }),
  KOV_RT: Object.freeze({
    key: "kov_rt",
    status: "rtIngestStatus",
    claimId: "rtIngestClaimId",
    claimedAt: "rtIngestClaimedAt",
    error: "rtLastIngestError",
    ingestedAt: "rtLastIngestedAt",
    docId: "rtRagDocId"
  }),
  ORGANIZATION: Object.freeze({
    key: "organization",
    status: "ingestStatus",
    claimId: "ingestClaimId",
    claimedAt: "ingestClaimedAt",
    error: "lastIngestError",
    ingestedAt: "lastIngestedAt",
    docId: "ragDocId"
  })
});

/**
 * Kas lease on läbi. `null` = omanikku ei ole teada = aegunud (vt failipea).
 */
export function isIngestClaimExpired(claimedAt, { now = new Date(), leaseMs = INGEST_LEASE_MS } = {}) {
  if (!claimedAt) return true;
  const started = claimedAt instanceof Date ? claimedAt.getTime() : new Date(claimedAt).getTime();
  if (!Number.isFinite(started)) return true;
  return now.getTime() - started >= leaseMs;
}

/**
 * Kas rida on PÄRISELT kellegi käes. Eelkontrollid peavad küsima just seda —
 * paljas „kas seis on INGESTING" blokeeriks igavesti ka surnud luku ja teeks
 * taastumise võimatuks.
 */
export function hasLiveIngestClaim(row, lane, { now = new Date(), leaseMs = INGEST_LEASE_MS } = {}) {
  if (!row) return false;
  if (String(row[lane.status] || "") !== INGEST_STATUS.INGESTING) return false;
  return !isIngestClaimExpired(row[lane.claimedAt], { now, leaseMs });
}

/** 409 — mitte 400: „proovi hiljem uuesti", mitte „sinu päring on vigane". */
export function ingestClaimConflictError(message = "Ingest is already in progress") {
  const error = new Error(message);
  error.status = 409;
  error.code = "ingest_claim_conflict";
  error.blockingIssues = [message];
  return error;
}

/**
 * Väljad, millega lease VABASTATAKSE. Iga kirjutaja, kes viib rea terminaalsesse
 * seisu, peab need kaasa panema — muidu jääb reale omanikuta claim.
 */
export function clearedIngestClaim(lane) {
  return {
    [lane.claimId]: null,
    [lane.claimedAt]: null
  };
}

/**
 * TINGIMUSLIK CLAIM. Üks kirjutus, mille `where` laseb läbi ainult siis, kui
 * rida ei ole kellegi käes või kui eelmine lease on läbi.
 *
 * @returns {Promise<{ ok: true, claimId: string } | { ok: false, reason: "ingest_in_progress" }>}
 */
export async function claimIngestLease({
  delegate,
  id,
  lane,
  docId = null,
  now = new Date(),
  leaseMs = INGEST_LEASE_MS,
  claimId = randomUUID(),
  extraData = {}
}) {
  const staleBefore = new Date(now.getTime() - leaseMs);
  const result = await delegate.updateMany({
    where: {
      id,
      OR: [
        /* Vaba: mis tahes muu seis kui INGESTING. */
        { [lane.status]: { not: INGEST_STATUS.INGESTING } },
        /* Omanikuta lukk (sh enne seda parandust tekkinud read). */
        { [lane.claimedAt]: null },
        /* Aegunud lease — varastatav. */
        { [lane.claimedAt]: { lt: staleBefore } }
      ]
    },
    data: {
      [lane.status]: INGEST_STATUS.INGESTING,
      [lane.claimId]: claimId,
      [lane.claimedAt]: now,
      [lane.error]: null,
      ...(docId ? { [lane.docId]: docId } : {}),
      ...extraData
    }
  });

  if (Number(result?.count || 0) !== 1) {
    return { ok: false, reason: "ingest_in_progress" };
  }
  return { ok: true, claimId };
}

/**
 * LÕPPSEIS. Kirjutatakse ainult siis, kui rida kannab endiselt SEDA claim'i.
 *
 * MIKS TINGIMUSLIK. Aegunud lease võis vahepeal minna kellelegi teisele. Ilma
 * selle tingimuseta kirjutaks hiline zombi üle värskema katse tulemuse ja
 * andmebaas ütleks midagi, mida ükski elus ingest ei väitnud.
 *
 * @returns {Promise<{ ok: true } | { ok: false, reason: "claim_lost" }>}
 */
export async function finishIngestClaim({
  delegate,
  id,
  lane,
  claimId,
  docId = null,
  ingestedAt = new Date(),
  extraData = {}
}) {
  const result = await delegate.updateMany({
    where: { id, [lane.claimId]: claimId },
    data: {
      [lane.status]: INGEST_STATUS.INGESTED,
      [lane.ingestedAt]: ingestedAt,
      [lane.error]: null,
      ...(docId ? { [lane.docId]: docId } : {}),
      ...clearedIngestClaim(lane),
      ...extraData
    }
  });

  if (Number(result?.count || 0) !== 1) return { ok: false, reason: "claim_lost" };
  return { ok: true };
}

/**
 * TÕRKE-VABASTUS. Sama tingimus samal põhjusel: kui claim on juba kellegi teise
 * käes, ei tohi meie tõrge tema tööd `ERROR`-iks märkida.
 *
 * SEDA EI KUTSUTA, KUI RAG-KIRJUTUS JUBA ÕNNESTUS — vt `ingestKovEntryBySlug`
 * kommentaari: pärast õnnestunud kirjutust oleks `ERROR` vale väide.
 *
 * @returns {Promise<{ ok: true } | { ok: false, reason: "claim_lost" }>}
 */
export async function releaseIngestClaimWithError({
  delegate,
  id,
  lane,
  claimId,
  message = null,
  docId = null
}) {
  const result = await delegate.updateMany({
    where: { id, [lane.claimId]: claimId },
    data: {
      [lane.status]: INGEST_STATUS.ERROR,
      [lane.error]: message,
      ...(docId ? { [lane.docId]: docId } : {}),
      ...clearedIngestClaim(lane)
    }
  });

  if (Number(result?.count || 0) !== 1) return { ok: false, reason: "claim_lost" };
  return { ok: true };
}
