import { normalizeSemanticText } from "./semanticTurnContract.js";

function normalizePlanningText(value = "") {
  return normalizeSemanticText(value);
}

function normalizeWordSet(values = []) {
  return new Set((Array.isArray(values) ? values : [])
    .map(value => normalizePlanningText(value))
    .filter(Boolean));
}

const TOPIC_STOPWORD_VALUES = [
  "aasta", "aastad", "aastate", "aastaks", "aastal", "aastani", "aastast", "aastatel", "ajatelg",
  "alates", "alla", "asemel", "ega", "ehk", "ei", "et", "ga", "iga", "ikka",
  "ja", "kas", "kogu", "kohta", "kui", "kuidas", "kus", "mida", "miks", "millal",
  "milline", "mis", "mitte", "ning", "nagu", "on", "oli", "olid", "oleks",
  "palun", "peamised", "peamine", "rohkem", "sama", "see", "selle", "selles", "siis",
  "suurim", "suurimad", "suuna", "suunad", "suunas", "table", "tabel", "tee",
  "to", "timeline", "too", "tule", "uldine", "uldist", "valja", "voi", "või",
  "which", "what", "when", "where", "year", "years"
];

const GENERIC_TOPIC_WORD_VALUES = [
  "abi", "areng", "arendus", "eesti", "elu", "inimene", "inimesed", "korraldus", "muutus",
  "muutused", "muutumine", "pohine", "sotsiaal", "sotsiaalvaldkond", "sotsiaalvaldkonna", "teema", "teemad",
  "teenus", "teenused", "toetus", "toetused", "trend", "trendid", "valdkond", "valdkonna"
];

const TOPIC_STOPWORDS = normalizeWordSet(TOPIC_STOPWORD_VALUES);
const GENERIC_TOPIC_WORDS = normalizeWordSet(GENERIC_TOPIC_WORD_VALUES);
const PRIMARY_TEMPORAL_ANCHOR = "Eesti sotsiaalvaldkond";
const TEMPORAL_POLICY_ANCHOR = "sotsiaalkaitse";
const TEMPORAL_CARE_ANCHOR = "sotsiaalhoolekanne";
const TEMPORAL_JOURNAL_ANCHOR = "Sotsiaaltöö";

function isGenericTopicWord(word = "") {
  if (!word) return false;
  if (GENERIC_TOPIC_WORDS.has(word)) return true;
  return Array.from(GENERIC_TOPIC_WORDS).some(genericWord => {
    const shorterLength = Math.min(word.length, genericWord.length);
    const lengthDifference = Math.abs(word.length - genericWord.length);
    return shorterLength >= 5 && lengthDifference <= 5 &&
      (word.startsWith(genericWord) || genericWord.startsWith(word));
  });
}

function recentUserTexts(history = [], maxItems = 8) {
  const out = [];
  if (!Array.isArray(history)) return out;
  for (let i = history.length - 1; i >= 0 && out.length < maxItems; i -= 1) {
    const entry = history[i];
    const role = String(entry?.role || "").toLowerCase();
    if (!(role === "user" || role === "client")) continue;
    const text = String(entry?.text || entry?.content || "").trim();
    if (!text) continue;
    out.push(text);
  }
  return out;
}

function recentAssistantTexts(history = [], maxItems = 4) {
  const out = [];
  if (!Array.isArray(history)) return out;
  for (let i = history.length - 1; i >= 0 && out.length < maxItems; i -= 1) {
    const entry = history[i];
    const role = String(entry?.role || "").toLowerCase();
    if (!(role === "assistant" || role === "ai")) continue;
    const text = String(entry?.text || entry?.content || "").trim();
    if (!text) continue;
    out.push(text);
  }
  return out;
}

function isShortFollowup(text = "") {
  const normalized = normalizePlanningText(text).replace(/[.!?\s]+$/g, "");
  if (!normalized) return true;
  return /^(jah|jaa|jep|ok|okei|selge|sobib|hea|vaga hea|jah palun|jah tee|tee|tee ara|teeme|jatka|jatkame|edasi|veel|palun tee|tee tabel|tabel|uldist|uldine)$/.test(normalized);
}

function isAffirmativeFollowup(text = "") {
  const normalized = normalizePlanningText(text).replace(/[.!?\s]+$/g, "");
  if (!normalized) return false;
  return /^(jah|jaa|jep|ok|okei|sobib|hea|vaga hea|jah palun|jah tee|tee|tee ara|teeme|jatka|jatkame|edasi|palun tee|tee tabel|tabel)$/.test(normalized);
}

function hasTemporalBreakdownCue(normalizedText = "") {
  if (!normalizedText) return false;
  return /\b(iga aasta|iga aasta kohta|aasta kohta|aastate kaupa|ajatelg|timeline|kronoloog|tabel|tabelina)\b/.test(normalizedText);
}

function hasTemporalComparisonCue(normalizedText = "", yearCount = 0) {
  if (!normalizedText || yearCount < 2) return false;
  return /(?:^|[^\p{L}])(?:vordl\p{L}*|muut\p{L}*|trend\p{L}*|kasv(?:u\p{L}*|a(?:s|b|vad|nud|ma|mine)|av\p{L}*)?|tous\p{L}*|suuren\p{L}*|lange\p{L}*|langus\p{L}*|vahen\p{L}*|kahan\p{L}*|compar\p{L}*|chang\p{L}*|increas\p{L}*|decreas\p{L}*|grew|rose|fell|declin\p{L}*|сравн\p{L}*|измен\p{L}*|динамик\p{L}*|тренд\p{L}*|рост\p{L}*|сниж\p{L}*|увелич\p{L}*|уменьш\p{L}*|возрос\p{L}*|упал\p{L}*)(?=$|[^\p{L}])/u.test(normalizedText);
}

function hasTemporalDevelopmentCue(normalizedText = "", yearCount = 0) {
  if (!normalizedText || yearCount < 2) return false;
  return /(?:^|[^\p{L}])(?:arene\p{L}*|areng\p{L}*|kujun\p{L}*|evolv\p{L}*|develop\p{L}*|progress\p{L}*|развив\p{L}*|эволюц\p{L}*)(?=$|[^\p{L}])/u.test(normalizedText);
}

function hasTemporalSourceSetCue(normalizedText = "") {
  return /\b(?:artikl\p{L}*|allik\p{L}*|materjal\p{L}*|uuring\p{L}*|articles?|sources?|materials?|studies|стат\p{L}*|источник\p{L}*|материал\p{L}*|исследован\p{L}*)\b/u.test(normalizedText);
}

function hasExplicitPeriodCue(text = "", normalizedText = "", yearCount = 0) {
  if (yearCount < 2) return false;
  const source = String(text || "");
  if (/\b\d{4}\s*(?:-|–|—|kuni|to)\s*\d{4}\b/iu.test(source)) return true;
  return /\b(aastatel|aastate|aastani|aastast|perioodil|perioodi|vahemikus|ajavahemikul|between|from)\b/.test(normalizedText);
}

function shouldCarryTemporalHistory(current = "", normalizedCurrent = "") {
  if (!String(current || "").trim()) return true;
  if (isShortFollowup(current)) return true;
  const refersBack = /\b(need|neid|nende|sama|samad|samade|seda|selle|eelmised|eelmiste|eeltoodud|eespool)\b/.test(normalizedCurrent);
  const asksTemporalWork =
    hasTemporalBreakdownCue(normalizedCurrent) ||
    /\b(aasta|aastad|aastate|ajatelg|kronoloog|tabel|vordle|vordlus|muutus|muutused)\b/.test(normalizedCurrent);
  return refersBack && asksTemporalWork;
}

function hasRecentTemporalAssistantOffer(history = []) {
  const assistantText = recentAssistantTexts(history, 2).join("\n");
  const normalized = normalizePlanningText(assistantText);
  if (!normalized) return false;
  const offersAction = /\b(voin|võin|saan|teen|teha|panna|koostan|make|create|can|могу|сделаю)\b/.test(normalized);
  const temporalShape = hasTemporalBreakdownCue(normalized) || /\b(201\d|202\d).{0,80}\b(201\d|202\d)\b/.test(normalized);
  return offersAction && temporalShape;
}

function expandYearRange(start, end, maxSpan = 10) {
  const from = Number(start);
  const to = Number(end);
  if (!Number.isInteger(from) || !Number.isInteger(to)) return [];
  const min = Math.min(from, to);
  const max = Math.max(from, to);
  if (min < 1900 || max > 2100 || max - min > maxSpan) return [];
  const years = [];
  for (let year = min; year <= max; year += 1) {
    years.push(year);
  }
  return years;
}

function temporalCoverageAnchors(years = [], maxAnchors = 4) {
  const ordered = Array.from(new Set((Array.isArray(years) ? years : [])
    .map(year => Number(year))
    .filter(year => Number.isInteger(year) && year >= 1900 && year <= 2100)))
    .sort((left, right) => left - right);
  const limit = Math.max(2, Math.min(Number(maxAnchors) || 4, ordered.length));
  if (ordered.length <= limit) return ordered;
  return Array.from(new Set(Array.from({ length: limit }, (_, index) =>
    ordered[Math.round(index * (ordered.length - 1) / (limit - 1))]
  )));
}

function extractTemporalBreakdownYears(text = "") {
  const source = String(text || "");
  const rangePattern = /\b(\d{4})\s*(?:-|–|—|kuni|to)\s*(\d{4})\b/giu;
  for (const match of source.matchAll(rangePattern)) {
    const from = Number(match[1]);
    const to = Number(match[2]);
    const expanded = expandYearRange(from, to);
    if (expanded.length >= 2) return expanded;
  }

  const years = Array.from(new Set(
    (source.match(/\b(19|20)\d{2}\b/g) || [])
      .map(value => Number(value))
      .filter(year => Number.isInteger(year) && year >= 1900 && year <= 2100)
  )).sort((a, b) => a - b);
  return years.slice(0, 8);
}

export function extractExplicitSourceYears(text = "") {
  const source = String(text || "");
  const sourceYearMatches = Array.from(source.matchAll(
    /\b((?:19|20)\d{2})\.?\s+aasta\b(?=[^.!?\n]{0,100}\b(?:artikkel|artikli|uuring|uuringu|seire|seirearuanne|aruanne|aruande|raport|raporti|juhend|juhendi|materjal|materjali|käsitlus|käsitluse|väljaanne|väljaande|ajakirjanumber|analüüs|analüüsi)\b)/giu
  ))
    .map(match => Number(match[1]))
    .filter(year => Number.isInteger(year) && year >= 1900 && year <= 2100);
  const sourceYears = Array.from(new Set(sourceYearMatches));
  if (sourceYears.length) return sourceYears.slice(0, 8);

  const sourceCue = "(?:artikkel|artikli|uuring|uuringu|seire|seirearuanne|aruanne|aruande|raport|raporti|juhend|juhendi|materjal|materjali|käsitlus|käsitluse|väljaanne|väljaande|ajakirjanumber|analüüs|analüüsi)";
  const contextualPatterns = [
    new RegExp(`\\b((?:19|20)\\d{2})\\b[^.!?\\n]{0,40}\\b${sourceCue}\\b`, "giu"),
    new RegExp(`\\b${sourceCue}\\b[^.!?\\n]{0,40}\\b((?:19|20)\\d{2})\\b`, "giu")
  ];
  const contextualYears = Array.from(new Set(contextualPatterns.flatMap(pattern =>
    Array.from(source.matchAll(pattern), match => Number(match[1]))
  ))).filter(year => Number.isInteger(year) && year >= 1900 && year <= 2100);
  return contextualYears.slice(0, 8);
}

function typedPreferredSourceYears(yearRoleMentions) {
  if (!Array.isArray(yearRoleMentions)) {
    return {
      available: false,
      years: [],
      evidenceYears: [],
      ambiguousYears: [],
      ambiguousYearCount: 0
    };
  }
  const validYear = value => Number.isInteger(Number(value)) && Number(value) >= 1900 && Number(value) <= 2100;
  const years = Array.from(new Set(yearRoleMentions
    .filter(mention => mention?.role === "document_source_year")
    .map(mention => Number(mention?.value))
    .filter(validYear)
  )).slice(0, 8);
  const evidenceYears = Array.from(new Set(yearRoleMentions
    .filter(mention => mention?.role === "evidence_year")
    .map(mention => Number(mention?.value))
    .filter(validYear)
  )).slice(0, 8);
  const ambiguousYears = Array.from(new Set(yearRoleMentions
    .filter(mention => mention?.role === "ambiguous")
    .map(mention => Number(mention?.value))
    .filter(validYear)
  )).slice(0, 8);
  const ambiguousYearCount = yearRoleMentions.filter(mention =>
    mention?.role === "ambiguous" && validYear(mention?.value)
  ).length;
  return {
    available: true,
    years,
    evidenceYears,
    ambiguousYears,
    ambiguousYearCount
  };
}

function stripTemporalNoise(text = "") {
  return String(text || "")
    .replace(/\b\d{4}\s*(?:-|–|—|kuni|to)\s*\d{4}\b/giu, " ")
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/\b(iga aasta(?: kohta)?|aastate kaupa|ajatelg|timeline|kronoloogiliselt|kronoloogilis|tee tabel|tabelina|tabel)\b/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickFocusText(message = "", history = []) {
  const current = String(message || "").trim();
  const currentCleaned = stripTemporalNoise(current);
  if (current && !isShortFollowup(current) && currentCleaned.length >= 18) {
    return currentCleaned;
  }

  const recentMeaningful = recentUserTexts(history, 8)
    .filter(text => !isShortFollowup(text))
    .map(text => stripTemporalNoise(text))
    .find(text => text.length >= 18);
  if (recentMeaningful) return recentMeaningful;

  const cleaned = [current, ...recentUserTexts(history, 8)]
    .filter(Boolean)
    .map(text => stripTemporalNoise(text))
    .filter(text => text.length >= 18);
  if (cleaned.length) return cleaned[0];

  return currentCleaned;
}

function buildTemporalYearQuery(focusText = "", year) {
  const yearText = String(year || "").trim();
  const focus = String(focusText || "").trim();
  const domainAnchor = [
    yearText,
    PRIMARY_TEMPORAL_ANCHOR,
    TEMPORAL_POLICY_ANCHOR,
    TEMPORAL_CARE_ANCHOR,
    TEMPORAL_JOURNAL_ANCHOR
  ]
    .filter(Boolean)
    .join(" ");

  if (!focus) return domainAnchor;
  return [focus, domainAnchor].filter(Boolean).join("\n").trim();
}

export function buildTemporalYearSearchQuery(focusText = "", year) {
  return buildTemporalYearQuery(focusText, year);
}

export function extractTopicHints(text = "", maxHints = 6) {
  const normalized = normalizePlanningText(stripTemporalNoise(text));
  if (!normalized) return [];

  const words = normalized
    .split(/[^\p{L}\p{N}]+/u)
    .map(word => word.trim())
    .filter(Boolean)
    .filter(word => !TOPIC_STOPWORDS.has(word))
    .filter(word => !/^\d{4}$/.test(word))
    .filter(word => !TEMPORAL_REFERENCE_ONLY_WORD_RE.test(word))
    // Eesti lühikesed sisusõnad on samuti tähenduskandjad: „uni”/„une” ja
    // „abi” ei tohi kaduda ainult pikkuse tõttu. Stoppsõnade filter eemaldab
    // enne seda grammatiliselt üldised kolmetähelised sõnad.
    .filter(word => word.length >= 3)
    .filter(word => !isGenericTopicWord(word));

  const unique = [];
  const seen = new Set();
  for (const word of words) {
    if (seen.has(word)) continue;
    seen.add(word);
    unique.push(word);
    if (unique.length >= maxHints) break;
  }
  return unique;
}

const TEMPORAL_REFERENCE_ONLY_WORD_RE = /^(?:aga|see|seda|selle|selles|sellel|sellest|need|neid|nende|sama|samad|samade|eelmine|eelmised|eelmiste|aast\p{L}*|vordl\p{L}*|muut\p{L}*|trend\p{L}*|loik\p{L}*|vahel|periood\p{L}*|naitaj\p{L}*|how|did|does|and|the|this|it|its|that|these|those|them|their|same|previous|years?|compar\p{L}*|chang\p{L}*|between|period\p{L}*|metrics?|indicators?|services?|support|эти\p{L}*|это|этот\p{L}*|его|ее|её|их|тот\p{L}*|сравн\p{L}*|измен\p{L}*|тренд\p{L}*|между|период\p{L}*|год\p{L}*|показател\p{L}*)$/u;
const TEMPORAL_UNRESOLVED_ANAPHORA_RE = /\b(?:see|seda|selle|selles|sellel|sellest|need|neid|nende|sama|samad|samade|eelmine|eelmised|eelmiste|this|it|its|that|these|those|them|their|same|previous)\b|(?:^|\s)(?:эти\p{L}*|это|этот\p{L}*|его|ее|её|их|тот\p{L}*|предыдущ\p{L}*)(?=\s|$)/u;
const TEMPORAL_LOCALLY_BOUND_YEAR_REFERENCE_RE = /\b(?:nende|these|those)\s+(?:(?:samade?|same)\s+)?(?:aastate|years)\b|(?:^|\s)эти\p{L}*\s+год\p{L}*(?=\s|$)/gu;

export function isSelfContainedTemporalBreakdownTurn(message = "", temporalPlan = null) {
  const years = Array.isArray(temporalPlan?.years) ? temporalPlan.years : [];
  if (temporalPlan?.enabled !== true || years.length < 2) return false;
  const normalized = normalizePlanningText(message);
  const withoutLocallyBoundYearReference = normalized.replace(
    TEMPORAL_LOCALLY_BOUND_YEAR_REFERENCE_RE,
    " "
  );
  if (TEMPORAL_UNRESOLVED_ANAPHORA_RE.test(withoutLocallyBoundYearReference)) return false;
  const topicWords = normalizePlanningText(stripTemporalNoise(message))
    .split(/[^\p{L}\p{N}]+/u)
    .map(word => word.trim())
    .filter(Boolean)
    .filter(word => word.length >= 3)
    .filter(word => !TOPIC_STOPWORDS.has(word))
    .filter(word => !isGenericTopicWord(word))
    .filter(word => !TEMPORAL_REFERENCE_ONLY_WORD_RE.test(word));
  return topicWords.length > 0;
}

export function buildTemporalRetrievalPlan({
  message = "",
  history = [],
  baseQuery = "",
  periodRole = null,
  yearRoleMentions = null,
  evidencePeriodYears = []
} = {}) {
  const current = String(message || "").trim();
  const normalizedCurrent = normalizePlanningText(current);
  const recent = recentUserTexts(history, 8);
  const acceptedAssistantOffer = isAffirmativeFollowup(current) && hasRecentTemporalAssistantOffer(history);
  const recentAssistantOfferText = acceptedAssistantOffer ? recentAssistantTexts(history, 2) : [];
  const temporalHistory = shouldCarryTemporalHistory(current, normalizedCurrent) ? recent : [];
  const combined = [current, ...temporalHistory, ...recentAssistantOfferText].filter(Boolean).join("\n");
  const normalized = normalizePlanningText(combined);
  const candidateYears = extractTemporalBreakdownYears(combined);
  const typedYears = typedPreferredSourceYears(yearRoleMentions);
  const preferredYears = typedYears.available
    ? typedYears.years
    : extractExplicitSourceYears(current);
  const preferredYearsSource = typedYears.available
    ? "typed_year_role_mentions"
    : "raw_text_fallback";
  const evidenceYears = Array.from(new Set([
    ...typedYears.evidenceYears,
    ...(Array.isArray(evidencePeriodYears) ? evidencePeriodYears : [])
  ].map(year => Number(year)).filter(year => Number.isInteger(year) && year >= 1900 && year <= 2100))).slice(0, 8);
  const explicitPeriod = periodRole !== "evidence_episode" && hasExplicitPeriodCue(
    combined,
    normalized,
    candidateYears.length
  );
  const qualitativeSynthesisRequested = explicitPeriod &&
    hasTemporalDevelopmentCue(normalized, candidateYears.length) &&
    hasTemporalSourceSetCue(normalized);
  const plannedYears = (
    acceptedAssistantOffer ||
    explicitPeriod ||
    hasTemporalBreakdownCue(normalized) ||
    hasTemporalComparisonCue(normalized, candidateYears.length) ||
    qualitativeSynthesisRequested
  )
    ? candidateYears
    : [];
  const years = qualitativeSynthesisRequested && plannedYears.length > 8
    ? temporalCoverageAnchors(plannedYears)
    : plannedYears;
  const breakdownYears = periodRole === "evidence_episode" || qualitativeSynthesisRequested ? [] : years;
  const comparisonRequested = hasTemporalComparisonCue(normalized, candidateYears.length) || qualitativeSynthesisRequested;

  const enabled = years.length >= 2 && years.length <= 8;
  if (!enabled) {
    return {
      enabled: false,
      years: [],
      preferredYears,
      preferredYearsSource,
      sourceFilterYears: preferredYears,
      sourceFilterSource: preferredYearsSource,
      evidenceYears,
      ambiguousYears: typedYears.ambiguousYears,
      breakdownYears,
      typedYearRoleMentionsAvailable: typedYears.available,
      ambiguousYearCount: typedYears.ambiguousYearCount,
      comparisonRequested,
      qualitativeSynthesisRequested,
      periodYears: plannedYears,
      topicTerms: extractTopicHints(stripTemporalNoise(current)),
      focusText: preferredYears.length ? stripTemporalNoise(current) : "",
      queries: baseQuery ? [baseQuery] : []
    };
  }

  const focusText = pickFocusText(current, history) || stripTemporalNoise(baseQuery);
  const topicTerms = extractTopicHints(focusText);
  const queries = Array.from(new Set([
    baseQuery,
    ...years.map(year => buildTemporalYearQuery(focusText, year))
  ].filter(Boolean)));

  return {
    enabled: true,
    years,
    preferredYears,
    preferredYearsSource,
    sourceFilterYears: preferredYears,
    sourceFilterSource: preferredYearsSource,
    evidenceYears,
    ambiguousYears: typedYears.ambiguousYears,
    breakdownYears,
    typedYearRoleMentionsAvailable: typedYears.available,
    ambiguousYearCount: typedYears.ambiguousYearCount,
    comparisonRequested,
    qualitativeSynthesisRequested,
    periodYears: plannedYears,
    topicTerms,
    focusText,
    queries
  };
}

export function buildTemporalFillQueries({
  years = [],
  focusText = "",
  message = "",
  topicHints = [],
  requestedYearRole = "evidence_year"
} = {}) {
  const normalizedYears = Array.from(new Set((Array.isArray(years) ? years : [])
    .map(year => Number(year))
    .filter(year => Number.isInteger(year) && year >= 1900 && year <= 2100)));
  if (!normalizedYears.length) return [];

  const baseFocus = String(focusText || message || "").trim();
  const hintText = Array.from(new Set((Array.isArray(topicHints) ? topicHints : [])
    .map(hint => String(hint || "").trim())
    .filter(Boolean))).slice(0, 3).join(" ");

  return normalizedYears.flatMap(year => {
    const yearText = String(year);
    return Array.from(new Set([
      [baseFocus, yearText].filter(Boolean).join("\n").trim(),
      [baseFocus, hintText, yearText].filter(Boolean).join("\n").trim(),
      [PRIMARY_TEMPORAL_ANCHOR, yearText].filter(Boolean).join(" ").trim(),
      [PRIMARY_TEMPORAL_ANCHOR, TEMPORAL_POLICY_ANCHOR, TEMPORAL_CARE_ANCHOR, hintText, yearText].filter(Boolean).join(" ").trim(),
      [TEMPORAL_JOURNAL_ANCHOR, "sotsiaalpoliitika", hintText, yearText].filter(Boolean).join(" ").trim(),
      [TEMPORAL_JOURNAL_ANCHOR, yearText].filter(Boolean).join(" ").trim()
    ].filter(Boolean))).map(query => ({
      query,
      ...(requestedYearRole === "publication_year" ? { filters: { year } } : {})
    }));
  });
}

export function buildTemporalBreakdownInstruction(replyLang = "et", years = [], options = {}) {
  const yearLabel = Array.isArray(years) && years.length ? years.join(", ") : "";
  const qualitativeSynthesis = options?.qualitativeSynthesis === true;

  if (qualitativeSynthesis) {
    const periodLabel = Array.isArray(options?.periodYears) && options.periodYears.length
      ? `${options.periodYears[0]}–${options.periodYears.at(-1)}`
      : yearLabel;
    if (replyLang === "en") {
      return [
        "TEMPORAL_SYNTHESIS_MODE:",
        "Synthesize how the topic is described as developing across the requested source period.",
        "Use publication years only to order what earlier and later sources discussed; do not turn them into event or evidence years.",
        "Bind every development claim to visible source text and state gaps instead of inventing continuity.",
        periodLabel ? `Requested source period: ${periodLabel}.` : null
      ].filter(Boolean).join("\n");
    }
    if (replyLang === "ru") {
      return [
        "TEMPORAL_SYNTHESIS_MODE:",
        "Синтезируй, как тема описывается в развитии в источниках запрошенного периода.",
        "Годы публикации используй только для порядка более ранних и поздних источников, а не как годы события или доказательства.",
        "Каждое утверждение о развитии связывай с видимым текстом источника; пробелы обозначай прямо.",
        periodLabel ? `Период источников: ${periodLabel}.` : null
      ].filter(Boolean).join("\n");
    }
    return [
      "TEMPORAL_SYNTHESIS_MODE:",
      "Sünteesi, kuidas teemat kirjeldatakse küsitud perioodi allikates arenemas.",
      "Kasuta ilmumisaastaid ainult varasemate ja hilisemate allikate käsitluste järjestamiseks; ära muuda neid sündmuse- ega tõendusaastateks.",
      "Seo iga arenguväide nähtava allikatekstiga ja nimeta lüngad, selle asemel et järjepidevust oletada.",
      periodLabel ? `Küsitud allikaperiood: ${periodLabel}.` : null
    ].filter(Boolean).join("\n");
  }

  if (replyLang === "en") {
    return [
      "TEMPORAL_BREAKDOWN_MODE:",
      "The user wants a year-by-year or timeline answer.",
      "Make claims for a specific year only when RAG_CONTEXT shows evidence for that same year.",
      "Do not treat a source's publication year or source_year metadata as the year when a policy change happened.",
      "If the context only shows that a source was published in a year, phrase it as what that source discussed, not as a change that happened that year.",
      "Do not fill missing years from general trends or neighboring years.",
      "If evidence is missing for a year, say that directly for that year.",
      "If the user asks for a table, prefer a table or a clearly year-structured answer.",
      "If the current user message is a short affirmative follow-up, treat it as acceptance of the previous assistant offer for a year-by-year/table answer.",
      yearLabel ? `Target years: ${yearLabel}.` : null
    ].filter(Boolean).join("\n");
  }

  if (replyLang === "ru") {
    return [
      "TEMPORAL_BREAKDOWN_MODE:",
      "Пользователь просит ответ по годам или в виде хронологии.",
      "Делай утверждение про конкретный год только тогда, когда в RAG_CONTEXT есть подтверждение именно за этот год.",
      "Не считай год публикации источника или метаданные source_year годом, когда произошло изменение политики.",
      "Если контекст показывает только, что источник опубликован в определённом году, формулируй это как тему источника, а не как изменение, произошедшее в этом году.",
      "Не заполняй пропущенные годы общими трендами или данными из соседних лет.",
      "Если по какому-то году материала не хватает, скажи это прямо у этого года.",
      "Если пользователь просит таблицу, предпочти таблицу или явно структурированный список по годам.",
      "Если текущее сообщение пользователя — короткое согласие, считай его согласием на предыдущее предложение ассистента сделать ответ по годам или таблицу.",
      yearLabel ? `Целевые годы: ${yearLabel}.` : null
    ].filter(Boolean).join("\n");
  }

  return [
    "TEMPORAL_BREAKDOWN_MODE:",
    "Kasutaja soovib aastate kaupa või ajateljena vastust.",
    "Tee väide konkreetse aasta kohta ainult siis, kui RAG_CONTEXT-is on sama aasta kohta nähtav tõendus.",
    "Ära käsitle allika ilmumisaastat ega source_year metaandmeid automaatselt poliitikamuudatuse toimumise aastana.",
    "Kui kontekst näitab ainult seda, et allikas ilmus mingil aastal, sõnasta see allika käsitletud teemana, mitte väitena, et muudatus toimus samal aastal.",
    "Ära täida puuduvaid aastaid üldiste trendide või naaberaastate põhjal.",
    "Kui mõni aasta ei ole piisavalt kaetud, ütle seda selle aasta juures otse.",
    "Kui kasutaja palub tabelit, eelista tabelit või selgelt aastate kaupa struktureeritud vastust.",
    "Kui praegune kasutaja sõnum on lühike nõusolek, käsitle seda nõustumisena eelmise assistendi pakkumisega teha aastate kaupa või tabelina vastus.",
    yearLabel ? `Sihtaastad: ${yearLabel}.` : null
  ].filter(Boolean).join("\n");
}
