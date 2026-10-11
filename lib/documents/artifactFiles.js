/**
 * Koostatud teksti failide ja malli reeglid ILMA andmebaasi ja serverita.
 *
 * MIKS OMA FAIL. Need kolm otsust elasid marsruutides ja serveri moodulites,
 * kuhu test ei ulatu, ja igaüks neist läks vaikselt valesti:
 *  - PDF-i linki pakuti iga kinnitatud teksti juures, ka siis, kui PDF-i ei
 *    tehtud (link vastas veaga);
 *  - mustand, mille mall ei olnud enam töörežiimis lubatud, ei salvestunud
 *    koostamisruumis, kuigi inimene malli ei muutnud;
 *  - kinnitamine proovis iga malli lugeda Wordi failina, ka PDF- ja TXT-malli.
 *
 * Puhas moodul: seda loevad marsruudid (`./artifacts.js`,
 * `./artifactFinalization.js`), lehed ja testid.
 */

import { DOCX_MIME_TYPE } from "./constants.js"

/**
 * Kas kinnitamisel tehti PDF. PDF-i ei tehta, kui tekstis on märke, mida PDF ei
 * toeta (kirillitsa, emotikonid): siis on hoiul ainult Wordi fail.
 *
 * Vastus loetakse kinnitamisel salvestatud failide kirjest (`finalSnapshot`):
 * loendi marsruut laadib sellest ainult PDF-i suuruse, teksti enda marsruudid
 * kogu kirje. Kui kirjet ei ole laaditud või seda ei ole, siis PDF-i ei ole:
 * linki pakutakse ainult failile, mis on olemas.
 */
export function artifactHasPdf(artifact) {
  const snapshot = artifact?.finalSnapshot
  if (!snapshot || typeof snapshot !== "object") return false
  if (Number(snapshot.pdfSize) > 0 || snapshot.pdfSha256) return true
  return Boolean(snapshot.manifest?.rendered?.pdf)
}

/**
 * Mida mustandi salvestamine malliga teeb.
 *
 *  - `keep`: päring malli ei nimeta või nimetab sama malli, mis mustandil juba
 *    on. Olemasoleva malli hoidmine ei ole uus valik: seda ei kontrollita
 *    uuesti. Nii salvestub ka mustand, mille mallilt võeti luba „Luba
 *    töörežiimis” ära pärast seda, kui mustand selle sai (koostamisruum saadab
 *    valitud malli iga salvestusega kaasa).
 *  - `clear`: tühi väärtus võtab malli ära.
 *  - `choose`: teine mall. Kutsuja kontrollib, et see on selle inimese mall ja
 *    töörežiimis lubatud.
 *
 * @param {string|null|undefined} currentTemplateId mustandi praegune mall
 * @param {unknown} requested päringu `templateId` (`undefined`, kui päring seda ei nimeta)
 * @returns {{ kind: "keep" | "clear" | "choose", templateId: string | null }}
 */
export function draftTemplateChange(currentTemplateId, requested) {
  const current = String(currentTemplateId || "").trim() || null
  if (requested === undefined) return { kind: "keep", templateId: current }
  const candidate = String(requested || "").trim()
  if (!candidate) return { kind: "clear", templateId: null }
  if (candidate === current) return { kind: "keep", templateId: current }
  return { kind: "choose", templateId: candidate }
}

/**
 * Kas mall annab kinnitatud Wordi failile kuju. Kuju annab ainult Wordi mall
 * (DOCX): selle kohatäitjad asendatakse teksti osadega. PDF- ja TXT-mall faili
 * kuju ei muuda ja kinnitatud fail tehakse tavalise kujuga.
 */
export function templateShapesFile(template) {
  return String(template?.mime || "").split(";")[0].trim() === DOCX_MIME_TYPE
}
