/**
 * Dokumendi otsinguindeksist eemaldamise tulemuse lugemine.
 *
 * Vana otsinguindeks lülitati välja 05.09.2026 (`lib/documents/ragService.js`).
 * Sellest ajast ei saa rakendus indeksist midagi eemaldada ja `deleteDocumentIndex`
 * vastab iga dokumendi kohta „ei õnnestunud". Konto kustutamine ja säilitusaja
 * pühkimine lugesid seda takistuseks nagu ajutist riket: dokumendi fail kustutati,
 * aga konto ega dokumendi rida ei kustunud kunagi.
 *
 * Reegel: väljalülitatud indeks ei ole takistus. Indeksit ei loe enam ükski otsing
 * ega vastus, eemaldamise kohustus jääb kirja ootel tööna koos indeksi viitega ja
 * ülejäänud kustutamine läheb edasi. Muu ebaõnnestumine (kui indeks kunagi tagasi
 * tuleb ja on ajutiselt maas) peatab kustutamise nagu enne.
 *
 * Puhas moodul, et seda saaks kasutada ka süstitavates orkestreerijates.
 */

/** Kas indeks vastas, et see on välja lülitatud (mitte et eemaldamine ebaõnnestus). */
export function isRagRetiredFailure(result) {
  return result?.reason === "rag_retired" || result?.error?.code === "RAG_RETIRED";
}

/** Kas indeksist eemaldamise tulemus peab dokumendi või konto kustutamise peatama. */
export function ragDeletionBlocks(result) {
  return result?.ok !== true && result?.retired !== true;
}
