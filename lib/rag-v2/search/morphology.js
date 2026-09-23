import Estonian from '../vendor/snowball-3.1.1/estonian-stemmer.js';
import English from '../vendor/snowball-3.1.1/english-stemmer.js';
import Russian from '../vendor/snowball-3.1.1/russian-stemmer.js';
import { fail } from '../contracts.js';

export const MORPHOLOGY_LEXICAL = 'pg-snowball311-et-en-ru-v1';
export const ESTNLTK_LEXICAL = 'pg-estnltk175-et-snowball311-en-ru-v1';
export const LEGACY_LEXICAL = 'pg-simple-weighted-or-v1';
export const LEXICAL_CONFIGS = Object.freeze([LEGACY_LEXICAL, MORPHOLOGY_LEXICAL, ESTNLTK_LEXICAL]);
const stemmers = [['et', new Estonian()], ['en', new English()], ['ru', new Russian()]];

/** Search aids only. Original source text and embeddings are never rewritten. */
export function morphologyText(text) {
  if (typeof text !== 'string' || text.length > 2_000_000) fail('morphology_input_limit');
  const words = text.normalize('NFC').toLowerCase().match(/\p{L}[\p{L}\p{M}]*/gu) || [];
  const terms = new Set();
  for (const word of new Set(words)) {
    if (word.length < 3 || word.length > 100) continue;
    for (const [language, stemmer] of stemmers) {
      const stem = stemmer.stem(word);
      if (stem.length >= 2) terms.add(`sb${language}${stem}`);
    }
  }
  return [...terms].sort().join(' ');
}

export function morphologyFields(unit) {
  return { title: morphologyText(unit.title), body: morphologyText(unit.body), aids: morphologyText(unit.search_aids) };
}

/** The EstNLTK profile replaces only the Estonian stemmer; older profiles stay immutable. */
export function englishRussianStems(text) {
  return morphologyText(text).split(' ').filter(term => term.startsWith('sben') || term.startsWith('sbru')).join(' ');
}
