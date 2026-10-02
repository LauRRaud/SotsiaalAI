// A message that is only a greeting ("tere", "Hei!", "hello") asks for nothing, so its turn needs no search plan, no
// search and no evidence (owner 02.10.2026: "tere" waited ten seconds for "Tere. Kuidas saan sind aidata?", after a
// plan with no queries, a search of the whole corpus and a rerank of 12 500 tokens). Deterministic and narrow: the whole
// message, without punctuation and emoji, is one of these phrases. Anything more ("Tere, mul on võlad") is a request.
const GREETINGS = Object.freeze({
  et: ['tere', 'tere tere', 'terekest', 'tere päevast', 'tere hommikust', 'tere õhtust', 'hommikust', 'päevast', 'õhtust', 'tervist', 'tervitus', 'tervitused',
    'tsau', 'tšau', 'hei', 'hei hei', 'heihei', 'heipa'],
  en: ['hello', 'hello there', 'hi', 'hi there', 'hey', 'hey there', 'good morning', 'good afternoon', 'good evening'],
  ru: ['привет', 'здравствуйте', 'здравствуй', 'здрасьте', 'добрый день', 'доброе утро', 'добрый вечер'],
});
const LANGUAGE = new Map(Object.entries(GREETINGS).flatMap(([language, phrases]) => phrases.map(phrase => [phrase, language])));

/** The language of a message that is only a greeting ('et', 'en' or 'ru'), or null for any other message. */
export function loneGreeting(text) {
  if (typeof text !== 'string' || text.length > 60) return null;
  const words = text.normalize('NFC').toLocaleLowerCase('et').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return LANGUAGE.get(words) ?? null;
}
