/**
 * SOL-RAGADMIN-03 — surnud ingest'i LEPITUS päris RAG-i vastu.
 *
 * MIDA SEE FAIL LAHENDAB. Claim ja lease teevad luku vabastatavaks, aga nad ei
 * ütle, MIS SAI. Kui protsess suri kohe pärast õnnestunud RAG-kirjutust, on
 * dokument teenuses olemas ja andmebaas ütleb ikka „INGESTING". Kui ta suri
 * enne, ei ole midagi. Neid kahte ei saa DB-st välja lugeda — seda teab ainult
 * RAG.
 *
 * SEEPÄRAST ON TÕE ALLIKAS RAG, MITTE OLETUS.
 *
 *   · `present` → `INGESTED`. Töö ON tehtud, ainult kinnitus jäi kirjutamata.
 *   · `missing` → `ERROR` põhjusega `ingest_interrupted`. Midagi ei jõudnud
 *     kohale ja seda saab öelda ausalt.
 *   · `unknown` (teenus ei vasta) → **EI OTSUSTA MIDAGI**. Rida jääb
 *     `INGESTING`-usse. See ei ole ummik: lease on juba läbi, seega järgmine
 *     ingest võtab luku endale. Oletus oleks siin halvem kui ootamine — just
 *     „märgi ERROR-iks ja loodame" oli see viga, mis ütles kasutajale, et
 *     dokumenti ei ole, kuigi ta oli RAG-is aktiivne.
 *
 * MIKS AINULT AEGUNUD CLAIM'I PEAL. Elus ingest ei vaja lepitust ja iga
 * lugemise peale tehtud võrgupäring oleks maksnud rohkem, kui ta annab. Lepitus
 * käivitub täpselt seal, kus seni tekkis igavene ummik.
 */

import { clearedIngestClaim, INGEST_STATUS, isIngestClaimExpired } from "./ingestClaim";

export const RAG_PRESENCE = Object.freeze({
  PRESENT: "present",
  MISSING: "missing",
  UNKNOWN: "unknown"
});

/** Kirjeldab, mis dokumendist sai. Läheb `lastIngestError`-isse, seega kood. */
export const INGEST_INTERRUPTED = "ingest_interrupted";

/**
 * Lepitab ühe aegunud claim'i. Ei tee midagi, kui rida ei ole `INGESTING` või kui
 * lease on veel elus.
 *
 * Kirjutus on TINGIMUSLIK sama claim'i peale: kui keegi jõudis vahepeal luku
 * endale võtta, ei tohi lepitus tema tööd üle kirjutada.
 *
 * `readPresence` on KOHUSTUSLIK parameeter, mitte vaikeväärtus: nii ei vea see
 * fail endaga kaasa serveri-ainult moodulite ahelat ja on testitav ilma
 * RAG-teenuseta. Päris lugeja elab `ragDocumentPresence.js`-is.
 *
 * @returns {Promise<{ reconciled: boolean, presence?: string, nextStatus?: string, reason?: string }>}
 */
export async function reconcileStaleIngestClaim({
  delegate,
  row,
  lane,
  now = new Date(),
  leaseMs,
  readPresence
}) {
  if (!row) return { reconciled: false, reason: "no_row" };
  if (String(row[lane.status] || "") !== INGEST_STATUS.INGESTING) {
    return { reconciled: false, reason: "not_ingesting" };
  }
  if (!isIngestClaimExpired(row[lane.claimedAt], { now, leaseMs })) {
    return { reconciled: false, reason: "claim_live" };
  }

  const docId = String(row[lane.docId] || "").trim();
  const { presence, lastIngested } = await readPresence(docId, {
    route: "admin/rag/ingest-reconcile",
    stage: `ingest_reconcile_${lane.key}`
  });

  if (presence === RAG_PRESENCE.UNKNOWN) {
    /* Ei otsusta. Lease on läbi, seega järgmine ingest saab luku endale. */
    return { reconciled: false, presence, reason: "presence_unknown" };
  }

  const nextStatus = presence === RAG_PRESENCE.PRESENT ? INGEST_STATUS.INGESTED : INGEST_STATUS.ERROR;
  const result = await delegate.updateMany({
    where: {
      id: row.id,
      [lane.status]: INGEST_STATUS.INGESTING,
      [lane.claimId]: row[lane.claimId] ?? null
    },
    data: {
      [lane.status]: nextStatus,
      [lane.error]: nextStatus === INGEST_STATUS.ERROR ? INGEST_INTERRUPTED : null,
      ...(nextStatus === INGEST_STATUS.INGESTED
        ? { [lane.ingestedAt]: lastIngested || now }
        : {}),
      ...clearedIngestClaim(lane)
    }
  });

  if (Number(result?.count || 0) !== 1) {
    return { reconciled: false, presence, reason: "claim_lost" };
  }
  return { reconciled: true, presence, nextStatus };
}
