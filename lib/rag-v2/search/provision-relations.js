import { actGenitive, lawNames, namedActLists, sectionResolution } from './legal-references.js';
import { publicationYear } from './ranking.js';
import ACT_ABBREVIATIONS from './act-abbreviations.json' with { type: 'json' };

// ADR-145 (11.10.2026): the relation from a passage of any document to the provision of a law it names. The relation is
// read from the passage's own words when it is needed and stored nowhere: a guide's "SHS § 17 lg 2" is that relation,
// and which version of the act it leads to is the one the search reads that day. No model and no guess: a reference
// that could be another act's, or names no section of the stored act, is left out with its reason. The rules stand
// here so that the search (retrieval.js) and the corpus count (scripts/rag-v2-provision-relations.mjs) read the same.
export const RELATION_VERSION = 'rag-v2/provision-relations-1';
/** Why a reference is not followed. */
export const LEFT_OUT = Object.freeze(['range', 'older_document', 'undated_document', 'section_not_in_act', 'section_ambiguous', 'over_limit']);

const spaced = text => String(text ?? '').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('et');
/**
 * The names by which a text may point at the laws of a search scope: { names, abbreviations }, as namedActLists reads
 * them. titles: [documentId, title] of the scope's national legal texts. A law is named by its title in the genitive,
 * the same joined or split otherwise (lawNames), the title as it stands, and the abbreviation Riigi Teataja gives it
 * (act-abbreviations.json). A title two documents of the scope share names neither, and so does any name two laws
 * would share. An act that is no law, code or codex has no name here.
 */
export function followableNames(titles) {
  const pairs = [...titles].filter(([, title]) => typeof title === 'string'), genitives = new Map();
  for (const [documentId, title] of pairs) { const name = actGenitive(title); if (name) genitives.set(name, genitives.has(name) ? null : documentId); }
  const names = new Map(), abbreviations = new Map(), put = (map, key, documentId) => map.set(key, map.has(key) && map.get(key) !== documentId ? null : documentId);
  for (const [documentId, title] of pairs) {
    if (genitives.get(actGenitive(title)) !== documentId) continue;
    for (const name of [...lawNames(title), spaced(title)]) put(names, name, documentId);
    const short = Object.hasOwn(ACT_ABBREVIATIONS.abbreviations, title) ? ACT_ABBREVIATIONS.abbreviations[title] : null;
    if (short) put(abbreviations, short, documentId);
  }
  for (const map of [names, abbreviations]) for (const [key, documentId] of [...map]) if (!documentId) map.delete(key);
  return { names, abbreviations };
}

const day = value => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/u.test(value) ? value.slice(0, 10) : null);
/** The day a document's text speaks from: a legal text's version from its first day in force; anything else from its
 *  publication day, a year alone from its first day; a page without either from the day it was read. Null without any. */
export function documentDay(fields) {
  const year = publicationYear(fields?.publication_year?.value);
  return day(fields?.valid_from?.value) ?? day(fields?.publication_date?.value) ?? (year ? `${year}-01-01` : null) ?? day(fields?.source_checked_at?.value) ?? day(fields?.retrieved_at?.value);
}
/** The first day of the act a document is a version of (its own entry into force; where the text gives none, the day
 *  it was adopted), or null. */
export function actFirstDay(fields) {
  const text = fields?.legal_text?.value;
  return day(text?.act_in_force_from) ?? day(text?.adopted);
}
/**
 * Why a document's reference to an act is not followed for its day, or null. A law's name and abbreviation outlive
 * the law: "sotsiaalhoolekande seaduse § 22" in a text of 2014 is a section of the act that ended in 2015, and the act
 * of that name today has another § 22. So a text older than the act's first day names none of its sections, and a
 * text without a day cannot be told. An act whose first day is not known is followed as before.
 */
export function dayRefusal(documentFields, actFields) {
  const first = actFirstDay(actFields), own = first ? documentDay(documentFields) : null;
  return !first ? null : !own ? 'undated_document' : own < first ? 'older_document' : null;
}

/** The lists of a passage that name a law of the scope, as the search follows them (namedActLists with the scope's names). */
export const passageRelations = (text, { names, abbreviations }) => namedActLists(text, names, abbreviations);
/** Which section of the act a relation leads to: { key }, or { reason } for a range, a number the act does not have, or
 *  one that could be two of its sections. exactNumbers: the pointing text keeps its superscripts. */
export function relationSection(relation, sections, exactNumbers) {
  return relation.to ? { reason: 'range' } : sectionResolution(relation.base, relation.superscript, sections, exactNumbers);
}
