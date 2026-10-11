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

const phrase = text => (typeof text !== 'string' || text.length > 60 ? null : text.normalize('NFC').toLocaleLowerCase('et').replace(/[^\p{L}\p{N}]+/gu, ' ').trim());
/** The language of a message that is only a greeting ('et', 'en' or 'ru'), or null for any other message. */
export function loneGreeting(text) {
  return LANGUAGE.get(phrase(text)) ?? null;
}

// ADR-120 (09.10.2026): a message that is only a thank-you asks for nothing either, and nearly every conversation ends
// with one. It ran the search plan, an embedding, a search by the joined text of the whole topic, the selection and the
// answer (ADR-106, left open). The same narrow rule as for a greeting: the whole message is one of these phrases.
// A word that can be the reply to the assistant's own question is not here, alone or first: "jah", "ei", "ok", "selge",
// "hästi" may answer what was asked (ADR-119), so "ok aitäh" takes the full route. Anything more ("Aitäh, aga mis see
// maksab?") is a request.
const THANKS = Object.freeze({
  et: ['aitäh', 'aitähh', 'aitäh aitäh', 'suur aitäh', 'suur suur aitäh', 'aitäh sulle', 'aitäh teile', 'suur aitäh sulle', 'suur aitäh teile', 'aitüma', 'tänan', 'tänan väga', 'väga tänan', 'tänan sind', 'tänan teid',
    'tänud', 'suured tänud', 'suur tänu', 'palju tänu', 'aitäh abi eest', 'suur aitäh abi eest', 'tänan abi eest', 'tänud abi eest', 'aitäh vastuse eest', 'tänan vastuse eest', 'aitäh info eest', 'aitäh selle eest',
    'aitäh see aitas', 'aitäh sellest oli abi', 'aitäh väga', 'aitäh kõige eest'],
  en: ['thanks', 'thank you', 'thanks a lot', 'thank you very much', 'thank you so much', 'many thanks', 'thanks for the help', 'thank you for the help', 'thanks for your help', 'thank you for your help', 'thx'],
  ru: ['спасибо', 'спасибо большое', 'большое спасибо', 'спасибо вам', 'спасибо тебе', 'спасибо за помощь', 'благодарю', 'благодарю вас'],
});
const THANKS_LANGUAGE = new Map(Object.entries(THANKS).flatMap(([language, phrases]) => phrases.map(item => [item, language])));
/** The language of a message that is only a thank-you ('et', 'en' or 'ru'), or null for any other message. */
export function loneThanks(text) {
  return THANKS_LANGUAGE.get(phrase(text)) ?? null;
}
