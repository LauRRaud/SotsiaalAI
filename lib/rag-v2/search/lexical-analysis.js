import { fail } from '../contracts.js';
import { defaultEstnltkAnalyzer, ESTNLTK_LIMITS } from './estnltk.js';
import { ESTNLTK_LEXICAL, LEGACY_LEXICAL, MORPHOLOGY_LEXICAL, englishRussianStems, morphologyFields, morphologyText } from './morphology.js';

/** Pack by size, retain every input and use the identical analyzer for query and index. */
async function estnltkTexts(texts, analyzer) {
  const result = [];
  for (let offset = 0; offset < texts.length;) {
    const batch = []; let chars = 0;
    while (offset < texts.length && batch.length < ESTNLTK_LIMITS.texts) {
      const text = texts[offset];
      if (typeof text !== 'string' || text.length > ESTNLTK_LIMITS.textChars) fail('morphology_input_limit');
      if (batch.length && chars + text.length > ESTNLTK_LIMITS.batchChars) break;
      batch.push(text); chars += text.length; offset++;
    }
    const lemmas = await (analyzer || defaultEstnltkAnalyzer()).analyze(batch);
    result.push(...lemmas.map((lemma, i) => [lemma, englishRussianStems(batch[i])].filter(Boolean).join(' ')));
  }
  return result;
}

export async function lexicalFields(units, lexical, analyzer) {
  if (lexical === LEGACY_LEXICAL) return units.map(() => ({}));
  if (lexical === MORPHOLOGY_LEXICAL) return units.map(morphologyFields);
  if (lexical !== ESTNLTK_LEXICAL) fail('unknown_lexical_config');
  const texts = await estnltkTexts(units.flatMap(unit => [unit.title, unit.body, unit.search_aids]), analyzer);
  return units.map((_, index) => ({ title: texts[3 * index], body: texts[3 * index + 1], aids: texts[3 * index + 2] }));
}

export async function lexicalQuery(text, lexical, analyzer) {
  if (lexical === MORPHOLOGY_LEXICAL) return morphologyText(text);
  if (lexical === ESTNLTK_LEXICAL) return (await estnltkTexts([text], analyzer))[0];
  if (lexical === LEGACY_LEXICAL) return '';
  fail('unknown_lexical_config');
}
