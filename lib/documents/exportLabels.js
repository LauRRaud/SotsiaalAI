/**
 * Kinnitatud teksti failide (Word ja PDF) sildid ja teksti liigi nimi.
 *
 * MIKS OMA FAIL. Wordi faili sildid olid koodis inglise keeles („Type”,
 * „Content”, „Sources”), PDF-i omad eesti keeles, ja liigi nime asemel oli
 * mõlemas sisemine kood („MEETING SUMMARY”, „Meeting Summary”). Fail tehakse
 * kinnitamise hetkel ja jääb selliseks: sildid peavad olema kinnitaja lehe
 * keeles ja tulema ühest kohast, samast kataloogist, kust lehed oma sõnad
 * võtavad (`documents.export.*` ja `documents.artifact_types.*`).
 *
 * Suhtelised teed ja laiendid on meelega: neid faile laadivad ka skriptid ja
 * testid ilma rakenduse teepikenduseta.
 */

import { normalizeServerLocale, serverT } from "../i18n/serverMessages.js"
import { AGENT_ARTIFACT_TYPE_VALUES } from "./constants.js"

/** Keel, kui kinnitaja lehe keelt ei ole teada (sama vaikimisi keel mis serveri veateadetel). */
export const EXPORT_DEFAULT_LOCALE = "en"

const ARTIFACT_TYPES = new Set(AGENT_ARTIFACT_TYPE_VALUES)

/** Teksti liik sõnaga; tundmatu liik on „Muu”, mitte sisemine kood. */
export function artifactTypeName(type, locale) {
  const value = String(type || "").trim().toUpperCase()
  return serverT(locale, `documents.artifact_types.${ARTIFACT_TYPES.has(value) ? value.toLowerCase() : "other"}`)
}

/**
 * Faili sildid ühes keeles. `typeName(type)` annab liigi nime samas keeles.
 * @param {string} [locale] et, en või ru; muu väärtus annab vaikimisi keele
 */
export function artifactExportLabels(locale) {
  const language = normalizeServerLocale(locale) || EXPORT_DEFAULT_LOCALE
  const word = (key) => serverT(language, `documents.export.${key}`)
  return {
    locale: language,
    type: word("type"),
    approved: word("approved"),
    content: word("content"),
    sources: word("sources"),
    noSources: word("no_sources"),
    emptyContent: word("empty_content"),
    untitledSource: word("untitled_source"),
    typeName: (type) => artifactTypeName(type, language)
  }
}

/** Kõik sõnad, mis siltidest faili võivad jõuda (kontrolliks, kas PDF suudab need joonistada). */
export function exportLabelTexts(labels, type) {
  return [labels.type, labels.approved, labels.content, labels.sources, labels.noSources, labels.emptyContent, labels.untitledSource, labels.typeName(type)]
}
