const SUPPORTED_LANGUAGES = new Set(["et", "ru", "en"]);
const MULTILINGUAL_AUTHOR_RETRIEVAL_ENABLED =
  String(process.env.RAG_MULTILINGUAL_AUTHOR_RETRIEVAL_ENABLED || "1").trim() !== "0";
const CYRILLIC_LETTER_RE = /[\u0400-\u04FF]/gu;
const LETTER_RE = /\p{Letter}/gu;
const ESTONIAN_HINT_RE = /[äöõüšž]|\b(aga|aitäh|aitah|eakas|eakate|ei|ja|kas|kuidas|kus|mida|miks|millal|milline|mis|olen|oled|olete|palun|seadus|soovin|tahan|teenus|tere|vajan|vald|või|voi)\b/iu;
const ENGLISH_HINT_RE = /\b(about|answer|can|could|elderly|english|estonian|help|hello|hi|how|older|please|reply|russian|thanks|thank you|what|when|where|which|who|why|write|written)\b/iu;

const ANSWER_LANGUAGE_PATTERNS = Object.freeze([
  { language: "ru", pattern: /\bvasta(?:ke)?\b[^.!?]{0,40}\bvene\s+keeles\b/iu },
  { language: "en", pattern: /\bvasta(?:ke)?\b[^.!?]{0,40}\binglise\s+keeles\b/iu },
  { language: "et", pattern: /\bvasta(?:ke)?\b[^.!?]{0,40}\beesti\s+keeles\b/iu },
  { language: "ru", pattern: /\b(?:ответь|ответьте)\b[^.!?]{0,40}(?:по-русски|на\s+русском)/iu },
  { language: "en", pattern: /\b(?:ответь|ответьте)\b[^.!?]{0,40}(?:по-английски|на\s+английском)/iu },
  { language: "et", pattern: /\b(?:ответь|ответьте)\b[^.!?]{0,40}(?:по-эстонски|на\s+эстонском)/iu },
  { language: "ru", pattern: /\b(?:answer|reply)\b[^.!?]{0,40}\bin\s+russian\b/iu },
  { language: "en", pattern: /\b(?:answer|reply)\b[^.!?]{0,40}\bin\s+english\b/iu },
  { language: "et", pattern: /\b(?:answer|reply)\b[^.!?]{0,40}\bin\s+estonian\b/iu }
]);

const CYRILLIC_TRANSLITERATION = Object.freeze({
  А: "A", а: "a", Б: "B", б: "b", В: "V", в: "v", Г: "G", г: "g",
  Д: "D", д: "d", Е: "E", е: "e", Ё: "Jo", ё: "jo", Ж: "Ž", ж: "ž",
  З: "Z", з: "z", И: "I", и: "i", Й: "J", й: "j", К: "K", к: "k",
  Л: "L", л: "l", М: "M", м: "m", Н: "N", н: "n", О: "O", о: "o",
  П: "P", п: "p", Р: "R", р: "r", С: "S", с: "s", Т: "T", т: "t",
  У: "U", у: "u", Ф: "F", ф: "f", Х: "H", х: "h", Ц: "Ts", ц: "ts",
  Ч: "Tš", ч: "tš", Ш: "Š", ш: "š", Щ: "Štš", щ: "štš", Ы: "Õ", ы: "õ",
  Э: "E", э: "e", Ю: "Ju", ю: "ju", Я: "Ja", я: "ja", Ъ: "", ъ: "",
  Ь: "", ь: ""
});

function roundConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Number(Math.max(0, Math.min(1, number)).toFixed(2));
}

export function normalizeChatLanguage(value = "") {
  const normalized = String(value || "").trim().toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_LANGUAGES.has(normalized) ? normalized : null;
}

export function detectQueryLanguage(text = "") {
  const raw = String(text || "").trim();
  if (!raw) {
    return { language: null, confidence: 0, reason: "empty" };
  }

  const letters = raw.match(LETTER_RE) || [];
  const cyrillicCount = (raw.match(CYRILLIC_LETTER_RE) || []).length;
  if (cyrillicCount >= 2 && cyrillicCount / Math.max(1, letters.length) >= 0.25) {
    return {
      language: "ru",
      confidence: roundConfidence(Math.max(0.9, cyrillicCount / Math.max(1, letters.length))),
      reason: "cyrillic_majority"
    };
  }
  if (ESTONIAN_HINT_RE.test(raw)) {
    return { language: "et", confidence: 0.92, reason: "estonian_lexical_hint" };
  }
  if (ENGLISH_HINT_RE.test(raw)) {
    return { language: "en", confidence: 0.9, reason: "english_lexical_hint" };
  }
  return { language: null, confidence: 0, reason: "insufficient_signal" };
}

function detectExplicitAnswerLanguage(text = "") {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const match = ANSWER_LANGUAGE_PATTERNS.find((entry) => entry.pattern.test(raw));
  return match?.language || null;
}

function isUserHistoryItem(item = {}) {
  const role = String(item?.role || item?.author || "").trim().toLowerCase();
  return !role || role === "user" || role === "client" || role === "kasutaja";
}

function latestHistoryLanguage(history = []) {
  if (!Array.isArray(history)) return null;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const item = history[index];
    if (!isUserHistoryItem(item)) continue;
    const content = typeof item?.content === "string"
      ? item.content
      : typeof item?.text === "string"
        ? item.text
        : "";
    const detected = detectQueryLanguage(content);
    if (detected.language && detected.confidence >= 0.85) return detected;
  }
  return null;
}

function isShortContextDependentLanguageTurn(text = "") {
  const raw = String(text || "").trim();
  if (!raw || raw.length > 48) return false;
  const normalized = raw
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase();
  return /^(?:ja\s+)?(?:see|seda|sellest|need|nendest|tema|temast|mis|miks|kuidas|millal|kui\s+palju|а\s+это|это|об\s+этом|почему|как|когда|сколько|and\s+that|that|about\s+it|why|how|when|how\s+many)\b/u.test(normalized)
    || /^[\s\d%§.,:;!?-]+$/u.test(raw);
}

function cleanPersonCandidate(value = "") {
  const cleaned = String(value || "")
    .replace(/[?!.:,;]+$/u, "")
    .replace(/\s+/g, " ")
    .trim();
  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length < 2 || parts.length > 4) return null;
  if (!parts.every((part) => /^[\p{Letter}'’.-]{2,}$/u.test(part))) return null;
  return cleaned;
}

function transliterateCyrillicName(value = "") {
  let used = false;
  const transliterated = Array.from(String(value || ""), (character) => {
    if (!Object.prototype.hasOwnProperty.call(CYRILLIC_TRANSLITERATION, character)) return character;
    used = true;
    return CYRILLIC_TRANSLITERATION[character];
  }).join("");
  return { value: transliterated, used };
}

function controlledTopicTermsEt(text = "") {
  const normalized = String(text || "").toLowerCase();
  const terms = new Set();
  if (/пожил|престарел|elderly|older\s+(?:people|person|persons|adult|adults)/u.test(normalized)) {
    terms.add("eakas");
    terms.add("eakad");
    terms.add("eakate");
    terms.add("vanemaealiste");
  }
  if (/насили|violence/u.test(normalized)) terms.add("vägivald");
  if (/реб[её]нок|дет(?:и|ях|ей)|\bchild|children\b/u.test(normalized)) {
    terms.add("lapsed");
    terms.add("lastekaitse");
  }
  if (/социальн|social\s+work/u.test(normalized)) terms.add("sotsiaaltöö");
  if (/long[-\s]?term\s+care|долгосрочн.*уход/u.test(normalized)) terms.add("pikaajaline hooldus");
  if (/home\s+care\s+service|домашн.*услуг/u.test(normalized)) terms.add("koduteenus");
  return Array.from(terms).slice(0, 4);
}

function normalizeControlledTopicText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function controlledTopicRoots(terms = []) {
  const normalized = (Array.isArray(terms) ? terms : [])
    .map(normalizeControlledTopicText)
    .filter(Boolean);
  const roots = new Set();
  for (const term of normalized) {
    if (term.startsWith("eaka")) roots.add("eaka");
    else if (term.startsWith("vanemaeal")) roots.add("vanemaeal");
    else if (term.startsWith("vagivall")) roots.add("vagivall");
    else if (term.startsWith("lastekait")) roots.add("lastekait");
    else if (term.startsWith("laps")) roots.add("laps");
    else if (term.startsWith("sotsiaaltoo")) roots.add("sotsiaaltoo");
    else if (term.startsWith("pikaajaline hooldus")) roots.add("pikaajal");
    else if (term.startsWith("koduteen")) roots.add("koduteen");
  }
  return Array.from(roots);
}

export function matchesControlledEstonianTopic(value = "", terms = []) {
  const text = normalizeControlledTopicText(value);
  const roots = controlledTopicRoots(terms);
  if (!text || !roots.length) return false;
  return roots.some(root => text.includes(root));
}

function extractPersonSourceShadowPlan(message = "", queryLanguage = null) {
  if (queryLanguage !== "ru" && queryLanguage !== "en") return null;
  const raw = String(message || "").trim().replace(/[?!.]+$/u, "").trim();
  const patterns = queryLanguage === "ru"
    ? [
        { pattern: /^кто\s+(?:такой|такая)\s+(.+?)\s+и\s+(?:что|о\s+ч[её]м)\s+.*$/iu, includesIdentity: true },
        { pattern: /^кто\s+(?:такой|такая)\s+(.+)$/iu, includesIdentity: true },
        { pattern: /^(?:что|о\s+ч[её]м)\s+(?:писал|писала|написал|написала)\s+(.+?)\s+о\s+.*$/iu, includesIdentity: false },
        { pattern: /^(?:что|о\s+ч[её]м)\s+(?:писал|писала|написал|написала)\s+(.+)$/iu, includesIdentity: false }
      ]
    : [
        { pattern: /^who\s+is\s+(.+?)\s+and\s+what\b.*$/iu, includesIdentity: true },
        { pattern: /^who\s+is\s+(.+)$/iu, includesIdentity: true },
        { pattern: /^what\s+(?:has|had)\s+(.+?)\s+written\s+about\s+.+$/iu, includesIdentity: false },
        { pattern: /^what\s+(?:has|had)\s+(.+?)\s+written$/iu, includesIdentity: false },
        { pattern: /^what\s+did\s+(.+?)\s+write\s+about\s+.+$/iu, includesIdentity: false },
        { pattern: /^what\s+did\s+(.+?)\s+write$/iu, includesIdentity: false }
      ];

  for (const entry of patterns) {
    const match = raw.match(entry.pattern);
    const personRaw = cleanPersonCandidate(match?.[1]);
    if (!personRaw) continue;
    const transliterated = transliterateCyrillicName(personRaw);
    const personCanonical = cleanPersonCandidate(transliterated.value);
    if (!personCanonical) continue;
    const topicTerms = controlledTopicTermsEt(raw);
    const topicSuffix = topicTerms.length ? ` teemal ${topicTerms.join(" ")}` : "";
    return {
      canonicalQueryEt: entry.includesIdentity
        ? `Kes on ${personCanonical} ja mida ta on kirjutanud${topicSuffix}?`
        : `Mida on ${personCanonical} kirjutanud${topicSuffix}?`,
      canonicalIntent: "person_source_lookup",
      preservedEntityTypes: ["person_name"],
      preservedEntityCount: 1,
      transliterationUsed: transliterated.used,
      controlledTopicCount: topicTerms.length
    };
  }
  return null;
}

function literalEntitySummary(text = "") {
  const raw = String(text || "");
  const types = new Set();
  let count = 0;
  const matchers = [
    ["year", /\b(?:19|20)\d{2}\b/gu],
    ["percentage", /\b\d+(?:[.,]\d+)?\s*%/gu],
    ["paragraph", /(?:§\s*|paragrahv\p{Letter}*\s+)\d+[a-z]?/giu]
  ];
  for (const [type, pattern] of matchers) {
    const matches = raw.match(pattern) || [];
    if (!matches.length) continue;
    types.add(type);
    count += matches.length;
  }
  return { types: Array.from(types), count };
}

export function buildChatLanguagePlan({
  message = "",
  interfaceLanguage,
  history = [],
  runtimeAnswerLanguage
} = {}) {
  const normalizedInterfaceLanguage = normalizeChatLanguage(interfaceLanguage) || "et";
  const currentDetection = detectQueryLanguage(message);
  const historyDetection = !currentDetection.language && isShortContextDependentLanguageTurn(message)
    ? latestHistoryLanguage(history)
    : null;
  const queryDetection = currentDetection.language
    ? currentDetection
    : historyDetection
      ? {
          language: historyDetection.language,
          confidence: 0.65,
          reason: "context_dependent_history_language"
        }
      : currentDetection;
  const explicitAnswerLanguage = detectExplicitAnswerLanguage(message);
  const recommendedAnswerLanguage = explicitAnswerLanguage
    || queryDetection.language
    || normalizedInterfaceLanguage
    || "et";
  const recommendedAnswerReason = explicitAnswerLanguage
    ? "explicit_turn_instruction"
    : queryDetection.language
      ? queryDetection.reason === "context_dependent_history_language"
        ? "context_dependent_query_language"
        : "query_language"
      : normalizedInterfaceLanguage
        ? "interface_fallback"
        : "default_et";
  const normalizedRuntimeAnswerLanguage = normalizeChatLanguage(runtimeAnswerLanguage)
    || normalizedInterfaceLanguage
    || "et";
  const shadowPlan = extractPersonSourceShadowPlan(message, queryDetection.language);
  const literalSummary = literalEntitySummary(message);
  const entityTypes = new Set([
    ...literalSummary.types,
    ...(shadowPlan?.preservedEntityTypes || [])
  ]);

  return {
    version: "language-plan-v1",
    interfaceLanguage: normalizedInterfaceLanguage,
    queryLanguage: queryDetection.language || "unknown",
    queryLanguageConfidence: roundConfidence(queryDetection.confidence),
    queryLanguageReason: queryDetection.reason,
    retrievalLanguage: "et",
    answerLanguage: recommendedAnswerLanguage,
    answerLanguageReason: recommendedAnswerReason,
    recommendedAnswerLanguage,
    recommendedAnswerLanguageReason: recommendedAnswerReason,
    runtimeReplyLanguage: normalizedRuntimeAnswerLanguage,
    runtimeReplyLanguageReason: normalizedRuntimeAnswerLanguage === recommendedAnswerLanguage
      ? "matches_answer_plan"
      : "legacy_interface_priority",
    shadowMode: shadowPlan ? "plan_only" : "not_available",
    canonicalQueryEt: shadowPlan?.canonicalQueryEt || null,
    canonicalIntent: shadowPlan?.canonicalIntent || null,
    canonicalQueryAvailable: !!shadowPlan?.canonicalQueryEt,
    preservedEntityTypes: Array.from(entityTypes).sort(),
    preservedEntityCount: literalSummary.count + Number(shadowPlan?.preservedEntityCount || 0),
    transliterationUsed: shadowPlan?.transliterationUsed === true,
    controlledTopicCount: Number(shadowPlan?.controlledTopicCount || 0),
    controlledTopicTermsEt: shadowPlan?.canonicalQueryEt
      ? controlledTopicTermsEt(message)
      : []
  };
}

export function shouldActivateCanonicalAuthorRetrieval(languagePlan = null, shadowQuestionPlan = null) {
  if (!MULTILINGUAL_AUTHOR_RETRIEVAL_ENABLED) return false;
  if (!languagePlan || typeof languagePlan !== "object") return false;
  if (!languagePlan.canonicalQueryAvailable || !languagePlan.canonicalQueryEt) return false;
  if (languagePlan.canonicalIntent !== "person_source_lookup") return false;
  if (languagePlan.queryLanguage !== "ru" && languagePlan.queryLanguage !== "en") return false;
  if (shadowQuestionPlan && shadowQuestionPlan.mode !== "person_source_lookup") return false;
  return true;
}

export function buildSafeLanguagePlanTrace(languagePlan = null, shadowQuestionPlan = null, options = {}) {
  if (!languagePlan || typeof languagePlan !== "object") return null;
  const canonicalRetrievalActive = options?.canonicalRetrievalActive === true;
  return {
    version: String(languagePlan.version || "language-plan-v1"),
    interface_language: normalizeChatLanguage(languagePlan.interfaceLanguage) || "et",
    query_language: normalizeChatLanguage(languagePlan.queryLanguage) || "unknown",
    query_language_confidence: roundConfidence(languagePlan.queryLanguageConfidence),
    query_language_reason: String(languagePlan.queryLanguageReason || "unknown").slice(0, 80),
    retrieval_language: normalizeChatLanguage(languagePlan.retrievalLanguage) || "et",
    answer_language: normalizeChatLanguage(languagePlan.answerLanguage) || "et",
    answer_language_reason: String(languagePlan.answerLanguageReason || "unknown").slice(0, 80),
    recommended_answer_language: normalizeChatLanguage(languagePlan.recommendedAnswerLanguage) || "et",
    recommended_answer_language_reason: String(languagePlan.recommendedAnswerLanguageReason || "unknown").slice(0, 80),
    runtime_reply_language: normalizeChatLanguage(languagePlan.runtimeReplyLanguage) || "et",
    runtime_reply_language_reason: String(languagePlan.runtimeReplyLanguageReason || "unknown").slice(0, 80),
    shadow_mode: languagePlan.shadowMode === "plan_only" ? "plan_only" : "not_available",
    canonical_query_available: languagePlan.canonicalQueryAvailable === true,
    canonical_intent: languagePlan.canonicalIntent ? String(languagePlan.canonicalIntent).slice(0, 80) : null,
    preserved_entity_types: Array.isArray(languagePlan.preservedEntityTypes)
      ? languagePlan.preservedEntityTypes.map((item) => String(item).slice(0, 40)).slice(0, 8)
      : [],
    preserved_entity_count: Math.max(0, Math.min(20, Number(languagePlan.preservedEntityCount) || 0)),
    transliteration_used: languagePlan.transliterationUsed === true,
    controlled_topic_count: Math.max(0, Math.min(12, Number(languagePlan.controlledTopicCount) || 0)),
    shadow_planner_mode: shadowQuestionPlan?.mode ? String(shadowQuestionPlan.mode).slice(0, 80) : null,
    shadow_planner_confidence: Number.isFinite(Number(shadowQuestionPlan?.confidence))
      ? roundConfidence(shadowQuestionPlan.confidence)
      : null,
    canonical_retrieval_active: canonicalRetrievalActive,
    active_planner_mode: canonicalRetrievalActive && shadowQuestionPlan?.mode
      ? String(shadowQuestionPlan.mode).slice(0, 80)
      : null,
    shadow_planner_matches_intent: !!(
      languagePlan.canonicalIntent
      && shadowQuestionPlan?.mode === languagePlan.canonicalIntent
    )
  };
}
