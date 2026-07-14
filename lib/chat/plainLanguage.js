const CITATION_PATTERN = /(?:\[[^\]\n]{1,80}\]|https?:\/\/[^\s)\]]+)/giu;
const NUMBER_PATTERN = /\b\d+(?:[.,]\d+)?(?:\s?(?:%|€|eur|eurot|days?|päeva|дн(?:я|ей)?))?\b/giu;
const CONDITION_PATTERN = /(?<![\p{L}\p{N}_])(?:kui|ainult juhul|välja arvatud|juhul kui|if|only if|unless|except|если|только если|кроме)(?![\p{L}\p{N}_])/giu;
const UNCERTAINTY_PATTERN = /(?<![\p{L}\p{N}_])(?:võib|ei pruugi|pole kindel|may|might|may not|uncertain|может|может не|неясно)(?![\p{L}\p{N}_])/giu;

function uniqueMatches(value, pattern) {
  return [...new Set(String(value || "").match(pattern) || [])];
}

function missingTokens(source, candidate, pattern) {
  const normalizedCandidate = String(candidate || "").toLocaleLowerCase();
  return uniqueMatches(source, pattern).filter((token) => (
    !normalizedCandidate.includes(String(token).toLocaleLowerCase())
  ));
}

export function normalizePlainLanguagePreference(value) {
  return value === true;
}

export function evaluatePlainLanguageInvariant({
  source,
  candidate,
  crisisInstruction = ""
} = {}) {
  const sourceText = String(source || "");
  const candidateText = String(candidate || "");
  const exactCrisisInstruction = String(crisisInstruction || "").trim();
  const missing = {
    citations: missingTokens(sourceText, candidateText, CITATION_PATTERN),
    numbers: missingTokens(sourceText, candidateText, NUMBER_PATTERN),
    conditions: missingTokens(sourceText, candidateText, CONDITION_PATTERN),
    uncertainty: missingTokens(sourceText, candidateText, UNCERTAINTY_PATTERN),
    crisisInstruction: (
      exactCrisisInstruction
      && sourceText.includes(exactCrisisInstruction)
      && !candidateText.includes(exactCrisisInstruction)
    ) ? [exactCrisisInstruction] : []
  };
  return {
    ok: Object.values(missing).every((items) => items.length === 0),
    missing
  };
}
