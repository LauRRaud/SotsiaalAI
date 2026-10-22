// ADR-180 (owner 22.10.2026): a message that only asks for the provisions of the answer before it ("Mis paragrahv seda
// ütleb?", "Viita palun sättele", "Mis on selle õiguslik alus?") is answered from that answer's own evidence, which holds
// each cited legal excerpt with its provision: no search plan, no embedding, no search and no selection. Owner, on such a
// follow-up that ran the whole search again: "eelmise vastuse allikad on juba ju olemas". Since ADR-179 an answer names
// no provision unless asked, so the question comes more often.
// Deterministic and narrow, as greeting.js: the whole message is at most ten words, at least one of them names a
// provision, the legal basis or a law, and every other word is a question word, a pointer back ("seda", "need"), a verb
// of saying or a courtesy. A word outside these ("Mis seadus ütleb lapsetoetuse kohta?") makes it a new request.
const KEY = Object.freeze({
  // Whole word forms, not stems: "alustada" (to start) is no "alus", "нормально" no "норма", "стать" (to become) no "статья".
  et: /^(?:paragrahv\p{L}*|sät(?:e|ted|te|tet|test|tele|tetest|etest|etele|teid)|lõi(?:ge|ked|ke|kest|kele|geid)|õigusakt\p{L}*|õiguslik\p{L}*|alus(?:e|el|eks|ed|eid)?|seadus(?:e|est|es|ele|t|ed|te|tes|test)?)$/u,
  en: /^(?:sections?|provisions?|paragraphs?|clauses?|legal|basis|law|laws|act|statute)$/u,
  ru: /^(?:параграф\p{L}*|стать(?:я|и|ю|е|ей)|правов\p{L}*|основани\p{L}*|закон(?:а|у|е|ом|ы|ов)?|пункт\p{L}*|норм(?:а|ы|у|ой|е)?)$/u,
});
const WORDS = Object.freeze({
  et: ['mis', 'missugune', 'missugused', 'milline', 'millised', 'millisest', 'millistest', 'millisele', 'millistele', 'millises', 'millistes', 'kus', 'kust',
    'mille', 'millel', 'kas', 'on', 'oli', 'olid', 'see', 'seda', 'need', 'neid', 'selle', 'nende', 'sellest', 'nendest', 'sellele', 'nendele', 'selles',
    'ütleb', 'ütlevad', 'ütles', 'öeldud', 'sätestab', 'sätestavad', 'sätestatud', 'tuleb', 'tulevad', 'tugineb', 'tuginevad', 'põhineb', 'põhinevad',
    'kirjas', 'kirjutatud', 'viita', 'viidake', 'viitaksid', 'viide', 'viited', 'viiteid', 'palun', 'aga', 'ja', 'ka', 'siis', 'täpsemalt', 'täpselt',
    'nimeta', 'nimetage', 'ütle', 'öelge', 'too', 'tooge', 'välja', 'kõik', 'kohta', 'eelmise', 'eelmises', 'vastuse', 'vastuses', 'eespool', 'mainitud', 'nimetatud'],
  en: ['which', 'what', 'where', 'is', 'are', 'the', 'that', 'this', 'these', 'those', 'it', 'its', 'says', 'say', 'said', 'does', 'do', 'come', 'comes',
    'from', 'cite', 'please', 'give', 'me', 'show', 'name', 'and', 'so', 'exactly', 'of', 'for', 'in', 'there', 'then', 'answer'],
  ru: ['какой', 'какая', 'какие', 'какое', 'каком', 'какого', 'какую', 'каких', 'это', 'этот', 'эта', 'эти', 'где', 'откуда', 'из', 'говорит', 'сказано',
    'указано', 'укажите', 'укажи', 'пожалуйста', 'назовите', 'назови', 'а', 'и', 'на', 'в', 'чём', 'чем', 'основано', 'основывается', 'тоже', 'там'],
});
const VOCABULARY = Object.fromEntries(Object.entries(WORDS).map(([language, words]) => [language, new Set(words)]));

/** The language of a message that only asks for the provisions of the answer before it ('et', 'en' or 'ru'), or null. */
export function loneProvisionQuestion(text) {
  if (typeof text !== 'string' || text.length > 80) return null;
  const words = text.normalize('NFC').toLocaleLowerCase('et').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter(Boolean);
  if (!words.length || words.length > 10) return null;
  for (const language of Object.keys(KEY)) {
    if (words.some(word => KEY[language].test(word)) && words.every(word => KEY[language].test(word) || VOCABULARY[language].has(word))) return language;
  }
  return null;
}

/** The legal excerpts the answer cited ({ ref, title }), from its blocks' refs and its packet: none when the answer cited
 *  no passage of a legal act (then a new search may find one). */
export function citedLegalSources(answer, packet) {
  const refs = new Set((Array.isArray(answer?.blocks) ? answer.blocks : []).flatMap(block => (Array.isArray(block?.refs) ? block.refs : [])));
  const byId = new Map((Array.isArray(packet?.evidence) ? packet.evidence : []).map(entry => [entry?.evidence_id, entry]));
  return [...refs].map(ref => ({ ref, entry: byId.get(packet?.reference_map?.[ref]?.evidence_id) }))
    .filter(({ entry }) => entry?.legal_place).map(({ ref, entry }) => ({ ref, title: entry.bibliography?.title || null }));
}
