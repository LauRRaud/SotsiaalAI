// ASCII \b / \w never matched pure-Cyrillic text and mis-handled Estonian words
// that start or end with õ/ä/ö/ü, so the Russian crisis/consent terms and words
// like "õigusakt" silently slipped through the ban. Unicode-aware look-around
// boundaries fix that across Latin, Estonian and Cyrillic. This text heuristic
// SUPPLEMENTS — it never replaces — the structured `isOfficial` meta-class
// enforced in canExplainJourneySummary; over-blocking here is the safe direction.
const WORD_CHAR = "[\\p{L}\\p{N}]";
const RESTRICTED_TERMS = [
  "112",
  "hädaabi",
  "emergency",
  "nõusolek",
  "consent",
  "соглас\\p{L}*", // согласие / согласия / согласен
  "seadus",
  "õigusakt",
  "legal",
  "law",
  "ametlik",
  "official",
  "allkirjastatud",
  "signed",
  "подписан\\p{L}*", // подписанный / подписано
  "срочн\\p{L}*\\s+помощ\\p{L}*" // срочная помощь
];
const RESTRICTED_SOURCE = new RegExp(
  `(?<!${WORD_CHAR})(?:${RESTRICTED_TERMS.join("|")})(?!${WORD_CHAR})`,
  "iu"
);

export function canExplainJourneySummary({ source, isOfficial = false } = {}) {
  const value = String(source || "").trim();
  return Boolean(value) && isOfficial !== true && !RESTRICTED_SOURCE.test(value);
}

/**
 * This is a reading aid, not a rewritten or persisted document. Keeping each
 * source sentence intact preserves dates, conditions, uncertainty and sources.
 */
export function buildPlainLanguageReadingAid(source) {
  const value = String(source || "").trim();
  if (!value) return [];
  return value.split(/(?<=[.!?])\s+(?=[A-ZÄÖÕÜА-Я])/u).map((item) => item.trim()).filter(Boolean);
}
