/**
 * Faili vana otsingukoopia eemaldamise seis: kas see loeb praegu või mitte.
 *
 * MIS SEE ON. Kui faililt võetakse luba „Luba töörežiimis”, tuleb selle koopia
 * vanast otsinguindeksist eemaldada. Eemaldamine on töö tabelis
 * `DataDeletionJob` (koos indeksi viitega) ja selle seis on ka faili
 * metaandmetes (`metadata.ragRemoval.status`: `pending`, `failed` või `done`).
 * Kuni eemaldamine on lõpetamata, ei tohi sama faili uuesti indeksisse panna:
 * hilisem eemaldamise katse kustutaks värske koopia.
 *
 * MIKS SIIN ON ERAND. Vana otsinguindeks on suletud (`lib/rag/retired.js`).
 * Sealt ei saa midagi eemaldada, seega jääb iga eemaldamine seisu `failed`
 * (põhjus `rag_retired`) ja uus katse seda ei muuda. Leht luges seda nagu
 * ajutist riket: märk „Eemaldamine ootab”, luba lukus ja uuesti lubamine
 * vastas veaga. Luba, mis kord ära võeti, ei saanud enam kunagi tagasi anda.
 *
 * REEGEL (sama mis konto kustutamisel, vt `lib/privacy/ragDeletionResult.js`):
 * suletud indeks ei ole takistus. Seda ei loe ükski otsing ega vastus ja sinna
 * ei panda midagi juurde, seega ei ole midagi, mida lõpetamata eemaldamine
 * kaitseks. Eemaldamise kohustus jääb kirja: töö on tabelis alles koos indeksi
 * viitega ja faili metaandmetes on seis nii, nagu see oli. Kui indeks kunagi
 * tagasi tuleb, loeb lõpetamata eemaldamine jälle täpselt nagu enne.
 *
 * Puhas moodul: seda loevad nii server (`./ragPermission.js`) kui ka lehed
 * (`./workspace.js`, `components/documents/workspace/documentRows.js`).
 */

import { RAG_AVAILABLE } from "../rag/retired.js"

/**
 * Lõpetamata eemaldamise seis, kui see praegu loeb: `pending`, `failed` või
 * tühi string. Suletud indeksi ajal on vastus alati tühi.
 * @param {{ status?: string } | null | undefined} ragRemoval faili `metadata.ragRemoval`
 */
export function unfinishedRagRemoval(ragRemoval, { ragAvailable = RAG_AVAILABLE } = {}) {
  const status = String(ragRemoval?.status || "")
  if (status !== "pending" && status !== "failed") return ""
  return ragAvailable ? status : ""
}
