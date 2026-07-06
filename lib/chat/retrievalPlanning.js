function normalizePlanningText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
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
  "muutused", "muutumine", "pohine", "sotsiaal", "sotsiaalvaldkond", "teema", "teemad",
  "teenus", "teenused", "toetus", "toetused", "trend", "trendid", "valdkond", "valdkonna"
];

const TOPIC_STOPWORDS = normalizeWordSet(TOPIC_STOPWORD_VALUES);
const GENERIC_TOPIC_WORDS = normalizeWordSet(GENERIC_TOPIC_WORD_VALUES);
const PRIMARY_TEMPORAL_ANCHOR = "Eesti sotsiaalvaldkond";
const TEMPORAL_POLICY_ANCHOR = "sotsiaalkaitse";
const TEMPORAL_CARE_ANCHOR = "sotsiaalhoolekanne";
const TEMPORAL_JOURNAL_ANCHOR = "Sotsiaaltöö";

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
  return /\b(vordle|vordlus|vordleva|muutus|muutused|muutusi)\b/.test(normalizedText);
}

function hasExplicitPeriodCue(text = "", normalizedText = "", yearCount = 0) {
  if (yearCount < 2) return false;
  const source = String(text || "");
  if (/\b\d{4}\s*(?:-|–|—|kuni|to)\s*\d{4}\b/iu.test(source)) return true;
  return /\b(aastatel|aastate|aastani|aastast|perioodil|perioodi|vahemikus|ajavahemikul|between|from)\b/.test(normalizedText);
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
    .split(/[^a-z0-9]+/i)
    .map(word => word.trim())
    .filter(Boolean)
    .filter(word => !TOPIC_STOPWORDS.has(word))
    .filter(word => !/^\d{4}$/.test(word))
    .filter(word => word === "kov" || word.length >= 4)
    .filter(word => !GENERIC_TOPIC_WORDS.has(word));

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

export function buildTemporalRetrievalPlan({ message = "", history = [], baseQuery = "" } = {}) {
  const current = String(message || "").trim();
  const recent = recentUserTexts(history, 8);
  const acceptedAssistantOffer = isAffirmativeFollowup(current) && hasRecentTemporalAssistantOffer(history);
  const recentAssistantOfferText = acceptedAssistantOffer ? recentAssistantTexts(history, 2) : [];
  const combined = [current, ...recent, ...recentAssistantOfferText].filter(Boolean).join("\n");
  const normalized = normalizePlanningText(combined);
  const candidateYears = extractTemporalBreakdownYears(combined);
  const years = (
    acceptedAssistantOffer ||
    hasExplicitPeriodCue(combined, normalized, candidateYears.length) ||
    hasTemporalBreakdownCue(normalized) ||
    hasTemporalComparisonCue(normalized, candidateYears.length)
  )
    ? candidateYears
    : [];

  const enabled = years.length >= 2 && years.length <= 8;
  if (!enabled) {
    return {
      enabled: false,
      years: [],
      focusText: "",
      queries: baseQuery ? [baseQuery] : []
    };
  }

  const focusText = pickFocusText(current, history) || stripTemporalNoise(baseQuery);
  const queries = Array.from(new Set([
    baseQuery,
    ...years.map(year => buildTemporalYearQuery(focusText, year))
  ].filter(Boolean)));

  return {
    enabled: true,
    years,
    focusText,
    queries
  };
}

export function buildTemporalFillQueries({
  years = [],
  focusText = "",
  message = "",
  topicHints = []
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
      filters: {
        year
      }
    }));
  });
}

export function buildTemporalBreakdownInstruction(replyLang = "et", years = []) {
  const yearLabel = Array.isArray(years) && years.length ? years.join(", ") : "";

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
