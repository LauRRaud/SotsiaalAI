import Estonian from '../vendor/snowball-3.1.1/estonian-stemmer.js';
import { chunkSection } from './legal-references.js';

// ADR-186 (23.10.2026): the terms a legal act defines, read from its own text, and the defined terms a provision uses.
// SÜS § 25 sets the deadline for a decision on a "hüvitis", and § 12 and § 14 say that a service is one (a non-monetary
// hüvitis). Without them in the packet the answer read § 25 as not about a social service (A17, F6 and F7 of 23.10).
// No model and no guess: a definition is a sentence of the act that says what its term is, in one of three forms.
//  - The section's heading names the term and a sentence of the section says "<term> on …" ("§ 14. Mitterahaline
//    hüvitis" — "Mitterahaline hüvitis on isikule antav soodustus …"; "§ 12. Hüvitiste liigid" — "Hüvitis on …").
//  - "<term> käesoleva seaduse tähenduses on …" or "<term> on käesoleva seaduse tähenduses …", in any section.
//  - A section of terms ("Mõisted", "Terminid"): its points "1) <term> – …" or "1) <term> on …".
// A rule about the term ("Kohaliku omavalitsuse üksus on kohustatud …") is no definition: the word after "on" says so.
const stemmer = new Estonian();
const WORD = /\p{L}[\p{L}\p{M}-]*/gu;
export const stemsOf = text => (String(text ?? '').normalize('NFC').toLocaleLowerCase('et').match(WORD) || []).map(word => stemmer.stem(word));
// The words that make "<subject> on …" a duty, a right or a permission rather than what the subject is.
const RULE_WORDS = new Set(['kohustatud', 'kohustus', 'kohustuslik', 'õigus', 'õigustatud', 'keelatud', 'lubatud', 'pädev', 'vastutav',
  'võimalik', 'kohaldatav', 'kohustuslikud', 'kohustatud', 'tasuline', 'tasuta', 'avalik', 'piiratud', 'alus', 'aluseks']);
const TERM = '((?:\\p{Lu}|\\p{Ll})[\\p{Ll}\\p{M}-]+(?:\\s+[\\p{Ll}\\p{M}-]+){0,3})';
// "(1) " or a line start, then the term, then "on" and the next word.
const LEAD = new RegExp(`(?:^|\\n|\\(\\d+\\p{No}*\\)\\s*|\\.\\s+)${TERM}\\s+on\\s+(\\p{L}+)`, 'gu');
const MEANING = new RegExp(`${TERM}\\s+(?:käesoleva\\s+(?:seaduse|seadustiku)\\s+tähenduses\\s+on|on\\s+käesoleva\\s+(?:seaduse|seadustiku)\\s+tähenduses)\\s+(\\p{L}+)`, 'gu');
const POINT = new RegExp(`(?:^|\\n)\\s*\\d+\\p{No}*\\)\\s*${TERM}\\s*(?:[–—-]\\s|on\\s+)`, 'gu');
const TERMS_HEADING = /^(?:mõisted|mõiste|terminid|põhimõisted|seaduses kasutatavad mõisted)\b/iu;
export const DEFINITION_LIMITS = Object.freeze({ termWords: 4, terms: 200, stem: 4, ending: 5 });
// The Snowball stemmer leaves a case ending on many Estonian words ("hüvitis" -> "hüviti", "hüvitise" -> "hüvitise"), so a
// word is the term's word when it is that stem or the stem and an ending of at most five letters, the stem at least four.
export const sameWord = (word, stem) => word === stem || stem.length >= DEFINITION_LIMITS.stem && word.startsWith(stem)
  && word.length - stem.length <= DEFINITION_LIMITS.ending || word.length >= DEFINITION_LIMITS.stem && stem.startsWith(word)
  && stem.length - word.length <= DEFINITION_LIMITS.ending;
// A term is a noun phrase: not an adverbial ("Isikul", "Kriisiolukorra ajal", "arvestamise aluseks", "menetluses"), a
// pronoun, a list, a right or duty ("Õigus saada …") or a purpose ("… eesmärk on").
const NOT_TERMS = new Set(['kes', 'mis', 'see', 'need', 'tema', 'nad', 'õigus', 'kohustus', 'eesmärk', 'ülesanne']);
const phrase = term => {
  const words = term.trim().toLocaleLowerCase('et').split(/\s+/u), last = words.at(-1);
  return words.join('').length >= 4 && !NOT_TERMS.has(words[0]) && !NOT_TERMS.has(last) && !words.some(word => ['ja', 'või', 'ning'].includes(word))
    && !/(?:l|lt|ks|ses|sse)$/u.test(last);
};

/** The section's heading: the words after "§ N." on its first line. */
function headingOf(text) {
  const found = String(text ?? '').match(/^\s*§\s*\d+\p{No}*\.\s*([^\n]*)/u);
  return found ? found[1].trim() : '';
}

/**
 * The terms an act defines, in the act's order: { term, stems, section, chunk_id }. chunks: the act's chunks in document
 * order. A term defined twice keeps its first definition.
 */
export function actDefinitions(chunks) {
  const out = [], held = new Set();
  const push = (term, section, chunk) => {
    const stems = stemsOf(term);
    if (!stems.length || stems.length > DEFINITION_LIMITS.termWords || out.length >= DEFINITION_LIMITS.terms || !phrase(term)) return;
    const key = stems.join(' ');
    if (held.has(key)) return;
    held.add(key); out.push({ term: term.trim(), stems, section, chunk_id: chunk.id });
  };
  let section = null, heading = '', headingStems = [];
  for (const chunk of chunks) {
    const key = chunkSection(chunk);
    if (!key) continue;
    if (key !== section) { section = key; heading = headingOf(chunk.source_text); headingStems = stemsOf(heading); }
    const text = chunk.source_text;
    for (const found of text.matchAll(LEAD)) {
      const stems = stemsOf(found[1]);
      if (RULE_WORDS.has(found[2].toLocaleLowerCase('et')) || !stems.length || !stems.every(stem => headingStems.some(word => sameWord(word, stem)))) continue;
      push(found[1], section, chunk);
    }
    for (const found of text.matchAll(MEANING)) if (!RULE_WORDS.has(found[2].toLocaleLowerCase('et'))) push(found[1], section, chunk);
    if (TERMS_HEADING.test(heading)) for (const found of text.matchAll(POINT)) push(found[1], section, chunk);
  }
  return out;
}

/**
 * The definitions whose term a text uses (every word of the term, in order, by stem), outside the section `own`, in the
 * order they first stand in the text; a longer term first where two start at one word ("mitterahaline hüvitis" before
 * "hüvitis").
 */
export function definedTerms(text, definitions, own = null) {
  const words = stemsOf(text), found = [];
  for (const definition of definitions) {
    if (definition.section === own) continue;
    const n = definition.stems.length;
    for (let i = 0; i + n <= words.length; i++) {
      if (definition.stems.every((stem, j) => sameWord(words[i + j], stem))) { found.push({ definition, at: i }); break; }
    }
  }
  return found.sort((a, b) => a.at - b.at || b.definition.stems.length - a.definition.stems.length).map(item => item.definition);
}
