/**
 * SOL-RAGADMIN-02 — KOV RAG reseti tulemuse AUS sõnastus.
 *
 * Varem vaatas UI ainult HTTP-staatust ja `payload.ok`-i ning kuvas seejärel
 * ühemõttelise eduteate: „Documents üksikuid ridu ei pea eraldi kustutama."
 * Serveri vastuses oli samal ajal `failed_rag_documents` sisu.
 *
 * SEEPÄRAST OTSUSTAB SIIN TÖÖ TULEMUS, MITTE STAATUS. Kui vastuses on kas või
 * üks kustutamata dokument, on teade viga — ka siis, kui `ok: true`. Nii ei sõltu
 * aus teade sellest, et iga tulevane serverirada mäletaks õiget staatust panna.
 *
 * `.ra-alert` ei kanna tooni (ta on ainult tekst), seega peab lause ise ütlema,
 * et reset jäi pooleli.
 */

const MAX_LISTED_DOC_IDS = 5;

function listedDocIds(failed) {
  const ids = failed.map(row => String(row?.docId || "").trim()).filter(Boolean);
  const shown = ids.slice(0, MAX_LISTED_DOC_IDS).join(", ");
  return ids.length > MAX_LISTED_DOC_IDS ? `${shown}, …` : shown;
}

/**
 * @param {object|null} payload reseti kirjutusvastus (õnnestunud või osaline)
 * @param {{ et?: boolean }} options
 * @returns {{ type: "success"|"error", text: string, partial: boolean }}
 */
export function describeKovRagResetOutcome(payload, { et = false } = {}) {
  const execution = payload?.execution || null;
  const failed = Array.isArray(execution?.failed_rag_documents) ? execution.failed_rag_documents : [];

  if (failed.length > 0) {
    const deleted = Array.isArray(execution?.deleted_rag_documents) ? execution.deleted_rag_documents.length : 0;
    const queued = Number(execution?.retry_queued_count || 0);
    const notQueued = Number(execution?.retry_not_queued_count || 0);
    const dbChanged = execution?.db_state_changed === true;
    const ids = listedDocIds(failed);

    const parts = et
      ? [
          `KOV RAG reset JÄI POOLELI: ${failed.length} dokumenti ei kustutatud (kustutatud: ${deleted}).`,
          dbChanged
            ? "Andmebaasi olekut jõuti muuta — kontrolli paketti käsitsi."
            : "Andmebaasi olekut EI muudetud: pakett on endiselt ingestitud, mis on tõsi.",
          ids ? `Alles: ${ids}.` : "",
          queued > 0 ? `Uuesti proovimiseks järjekorras: ${queued} (admin → Kustutus- ja puhastustööd).` : "",
          notQueued > 0 ? `Järjekorda EI õnnestunud panna: ${notQueued} — vaata serveri logi.` : ""
        ]
      : [
          `KOV RAG reset is INCOMPLETE: ${failed.length} document(s) were not deleted (deleted: ${deleted}).`,
          dbChanged
            ? "Database state was already changed — check the package manually."
            : "Database state was NOT changed: the package is still ingested, which is true.",
          ids ? `Remaining: ${ids}.` : "",
          queued > 0 ? `Queued for retry: ${queued} (admin → Deletion and cleanup jobs).` : "",
          notQueued > 0 ? `Could NOT be queued: ${notQueued} — check the server log.` : ""
        ];

    return { type: "error", partial: true, text: parts.filter(Boolean).join(" ") };
  }

  if (payload?.ok === false) {
    return {
      type: "error",
      partial: false,
      text: payload?.message || (et ? "KOV RAG state reset ebaõnnestus." : "KOV RAG state reset failed.")
    };
  }

  return {
    type: "success",
    partial: false,
    text: et
      ? "KOV RAG state resetiti paketina. Documents üksikuid ridu ei pea eraldi kustutama."
      : "KOV RAG state was reset package-wise. No individual document deletes are needed."
  };
}
