const SUPPORTED_LANGUAGES = new Set(["et", "ru", "en"]);
const MULTILINGUAL_AUTHOR_RETRIEVAL_ENABLED =
  String(process.env.RAG_MULTILINGUAL_AUTHOR_RETRIEVAL_ENABLED || "1").trim() !== "0";
const CYRILLIC_LETTER_RE = /[\u0400-\u04FF]/gu;
const LETTER_RE = /\p{Letter}/gu;
const ESTONIAN_WORD_HINT_RE = /\b(aga|aitäh|aitah|eakas|eakate|ei|ja|kas|kuidas|kus|mida|miks|millal|milline|mis|olen|oled|olete|palun|seadus|soovin|tahan|teenus|tere|vajan|vald|või|voi)\b/iu;
const ESTONIAN_DIACRITIC_RE = /[äöõüšž]/iu;
const ENGLISH_HINT_RE = /\b(about|answer|can|could|elderly|english|estonian|help|hello|hi|how|older|please|reply|russian|thanks|thank you|what|when|where|which|who|why|write|written)\b/iu;
const ROMANIZED_RUSSIAN_HINT_RE = /\b(a|chto|gde|i|kak|kto|napisal|napisala|o|otvet|otvette|pisal|pisala|pochemu|pro|russki|russkom)\b/iu;
const LEADING_RUSSIAN_CONNECTOR_RE = /^\s*(?:а|и|но)(?=\s)/iu;

const ANSWER_LANGUAGE_PATTERNS = Object.freeze([
  { language: "ru", pattern: /\bvasta(?:ke)?\b[^.!?]{0,40}\bvene\s+keeles\b/iu },
  { language: "en", pattern: /\bvasta(?:ke)?\b[^.!?]{0,40}\binglise\s+keeles\b/iu },
  { language: "et", pattern: /\bvasta(?:ke)?\b[^.!?]{0,40}\beesti\s+keeles\b/iu },
  { language: "ru", pattern: /(?:^|[^\p{Letter}])(?:ответь|ответьте)(?=\s|:)[^.!?]{0,40}(?:по-русски|на\s+русском)/iu },
  { language: "en", pattern: /(?:^|[^\p{Letter}])(?:ответь|ответьте)(?=\s|:)[^.!?]{0,40}(?:по-английски|на\s+английском)/iu },
  { language: "et", pattern: /(?:^|[^\p{Letter}])(?:ответь|ответьте)(?=\s|:)[^.!?]{0,40}(?:по-эстонски|на\s+эстонском)/iu },
  { language: "ru", pattern: /\b(?:answer|reply)\b[^.!?]{0,40}\bin\s+russian\b/iu },
  { language: "en", pattern: /\b(?:answer|reply)\b[^.!?]{0,40}\bin\s+english\b/iu },
  { language: "et", pattern: /\b(?:answer|reply)\b[^.!?]{0,40}\bin\s+estonian\b/iu }
]);

const CYRILLIC_TRANSLITERATION = Object.freeze({
  А: "A", а: "a", Б: "B", б: "b", В: "V", в: "v", Г: "G", г: "g",
  Д: "D", д: "d", Е: "E", е: "e", Ё: "Ö", ё: "ö", Ж: "Ž", ж: "ž",
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
  if (cyrillicCount >= 1 && LEADING_RUSSIAN_CONNECTOR_RE.test(raw)) {
    return { language: "ru", confidence: 0.86, reason: "russian_leading_connector" };
  }
  if (ESTONIAN_WORD_HINT_RE.test(raw)) {
    return { language: "et", confidence: 0.92, reason: "estonian_lexical_hint" };
  }
  if (ROMANIZED_RUSSIAN_HINT_RE.test(raw) && /\b(?:chto|kto|pisal|pisala|napisal|napisala|otvet|otvette)\b/iu.test(raw)) {
    return { language: "ru", confidence: 0.86, reason: "romanized_russian_hint" };
  }
  if (ENGLISH_HINT_RE.test(raw)) {
    return { language: "en", confidence: 0.9, reason: "english_lexical_hint" };
  }
  if (ESTONIAN_DIACRITIC_RE.test(raw)) {
    return { language: "et", confidence: 0.72, reason: "estonian_diacritic_hint" };
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
  if (/health\s+literacy|грамотност.*здоров|gramotnost.*zdorov/u.test(normalized)) terms.add("tervisealane kirjaoskus");
  if (/research\s+ethics|научн.*этик|исследовательск.*этик/u.test(normalized)) terms.add("uurimiseetika");
  if (/restorative\s+justice|восстановительн.*правосуд/u.test(normalized)) terms.add("taastav õigus");
  if (/life\s+stor(?:y|ies)|жизненн.*истори/u.test(normalized)) terms.add("elulootöö");
  if (/substitute\s+care|замещающ.*опек|учрежден.*(?:дет|реб)/u.test(normalized)) terms.add("asendushooldus");
  if (/imprisonment|prison|тюрем|лишени.*свобод/u.test(normalized)) terms.add("vangistus");
  if (/probation|пробаци|криминальн.*надзор/u.test(normalized)) terms.add("kriminaalhooldus");
  if (/maternity\s+ward|родильн.*отдел|синнитус/u.test(normalized)) terms.add("sünnitusosakond");
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
    else if (term.startsWith("tervisealane kirjaoskus")) roots.add("terviseal");
    else if (term.startsWith("uurimiseet")) roots.add("uurimiseet");
    else if (term.startsWith("taastav oigus")) roots.add("taastav");
    else if (term.startsWith("eluloo")) roots.add("eluloo");
    else if (term.startsWith("asendushool")) roots.add("asendushool");
    else if (term.startsWith("vangist")) roots.add("vangist");
    else if (term.startsWith("kriminaalhool")) roots.add("kriminaalhool");
    else if (term.startsWith("sunnitusosak")) roots.add("sunnitusosak");
  }
  return Array.from(roots);
}

export function matchesControlledEstonianTopic(value = "", terms = []) {
  const text = normalizeControlledTopicText(value);
  const roots = controlledTopicRoots(terms);
  if (!text || !roots.length) return false;
  return roots.some(root => text.includes(root));
}

function stripExplicitAnswerInstruction(text = "") {
  return String(text || "")
    .replace(/^\s*(?:ответь|ответьте)\s+(?:(?:по-русски|по-английски|по-эстонски)|(?:на\s+(?:русском|английском|эстонском)(?:\s+языке)?))\s*[:;,—-]?\s*/iu, "")
    .replace(/^\s*(?:answer|reply)\s+in\s+(?:english|russian|estonian)\s*[:;,—-]?\s*/iu, "")
    .replace(/^\s*vasta(?:ke)?\s+(?:eesti|inglise|vene)\s+keeles\s*[:;,—-]?\s*/iu, "")
    .trim();
}

function looksLikeStandalonePerson(value = "") {
  const parts = String(value || "").split(/\s+/u).filter(Boolean);
  return parts.length >= 2
    && parts.length <= 4
    && parts.every(part => /^\p{Lu}[\p{Letter}'’.-]{1,}$/u.test(part));
}

function buildPersonShadowPlan({
  personRaw,
  coauthorRaw = null,
  includesIdentity = false,
  topicText = "",
  coauthorRequested = false
} = {}) {
  const person = transliterateCyrillicName(cleanPersonCandidate(personRaw) || "");
  const personCanonical = cleanPersonCandidate(person.value);
  if (!personCanonical) return null;
  const coauthor = coauthorRaw
    ? transliterateCyrillicName(cleanPersonCandidate(coauthorRaw) || "")
    : null;
  const coauthorCanonical = cleanPersonCandidate(coauthor?.value || "");
  const topicTerms = controlledTopicTermsEt(topicText);
  const topicSuffix = topicTerms.length ? ` teemal ${topicTerms.join(" ")}` : "";
  return {
    canonicalQueryEt: includesIdentity
      ? `Kes on ${personCanonical} ja mida ta on kirjutanud${topicSuffix}?`
      : `Mida on ${personCanonical} kirjutanud${topicSuffix}?`,
    canonicalIntent: "person_source_lookup",
    personCanonical,
    coauthorNames: coauthorCanonical ? [coauthorCanonical] : [],
    coauthorRequested: coauthorRequested || !!coauthorCanonical,
    preservedEntityTypes: coauthorCanonical ? ["person_name", "coauthor_name"] : ["person_name"],
    preservedEntityCount: coauthorCanonical ? 2 : 1,
    transliterationUsed: person.used || coauthor?.used === true,
    controlledTopicTermsEt: topicTerms,
    controlledTopicCount: topicTerms.length
  };
}

function extractPersonSourceShadowPlan(message = "", queryLanguage = null) {
  if (queryLanguage !== "ru" && queryLanguage !== "en") return null;
  const raw = stripExplicitAnswerInstruction(message).replace(/[?!.]+$/u, "").trim();
  const patterns = queryLanguage === "ru"
    ? [
        { pattern: /^(?:что|о\s+ч[её]м)\s+(?:писал|писала|написал|написала)\s+(.+?)\s+вместе\s+с\s+(.+?)\s+о\s+.*$/iu, coauthorGroup: 2, coauthorRequested: true },
        { pattern: /^кто\s+(?:такой|такая)\s+(.+?)\s+и\s+(?:что|о\s+ч[её]м)\s+.*$/iu, includesIdentity: true },
        { pattern: /^кто\s+(?:такой|такая)\s+(.+)$/iu, includesIdentity: true },
        { pattern: /^(?:что|о\s+ч[её]м)\s+(?:писал|писала|написал|написала)\s+(.+?)\s+о\s+.*$/iu },
        { pattern: /^(?:что|о\s+ч[её]м)\s+(?:писал|писала|написал|написала)\s+(.+)$/iu },
        { pattern: /^(?:chto|o\s+chem)\s+(?:pisal|pisala|napisal|napisala)\s+(.+?)\s+o\s+.*$/iu },
        { pattern: /^(?:chto|o\s+chem)\s+(?:pisal|pisala|napisal|napisala)\s+(.+)$/iu }
      ]
    : [
        { pattern: /^who\s+is\s+(.+?)\s+and\s+what\b.*$/iu, includesIdentity: true },
        { pattern: /^who\s+is\s+(.+)$/iu, includesIdentity: true },
        { pattern: /^what\s+(?:has|had)\s+(.+?)\s+written\s+about\s+.+$/iu },
        { pattern: /^what\s+(?:has|had)\s+(.+?)\s+written$/iu },
        { pattern: /^what\s+did\s+(.+?)\s+co-write\s+about\s+.+$/iu, coauthorRequested: true },
        { pattern: /^what\s+did\s+(.+?)\s+(?:write|писать|писал|писала)\s+(?:about|о)\s+.+$/iu },
        { pattern: /^what\s+did\s+(.+?)\s+write$/iu }
      ];

  for (const entry of patterns) {
    const match = raw.match(entry.pattern);
    const plan = buildPersonShadowPlan({
      personRaw: match?.[1],
      coauthorRaw: entry.coauthorGroup ? match?.[entry.coauthorGroup] : null,
      includesIdentity: entry.includesIdentity === true,
      topicText: raw,
      coauthorRequested: entry.coauthorRequested === true
    });
    if (plan) return plan;
  }

  const standalone = raw.match(/^(?:а|и|and)\s+(.+)$/iu);
  const standaloneCandidate = cleanPersonCandidate(standalone?.[1]);
  if (standaloneCandidate && looksLikeStandalonePerson(standaloneCandidate)) {
    return buildPersonShadowPlan({
      personRaw: standaloneCandidate,
      includesIdentity: true,
      topicText: raw
    });
  }
  return null;
}

function latestHistoryPersonPlan(history = []) {
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
    const plan = extractPersonSourceShadowPlan(content, detected.language);
    if (plan?.personCanonical) return plan;
  }
  return null;
}

function buildContextualAuthorFollowupPlan(message = "", history = [], queryLanguage = null) {
  if (queryLanguage !== "ru" && queryLanguage !== "en") return null;
  const raw = String(message || "").trim();
  const isFollowup = queryLanguage === "ru"
    ? /^\s*(?:а\s+)?что\s+о(?=\s)/iu.test(raw)
    : /^\s*(?:and\s+)?what\s+about(?=\s)/iu.test(raw);
  if (!isFollowup) return null;
  const previous = latestHistoryPersonPlan(history);
  if (!previous?.personCanonical) return null;
  return buildPersonShadowPlan({
    personRaw: previous.personCanonical,
    coauthorRaw: previous.coauthorNames?.[0] || null,
    topicText: raw,
    coauthorRequested: previous.coauthorRequested === true
  });
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
  const shadowPlan = extractPersonSourceShadowPlan(message, queryDetection.language)
    || buildContextualAuthorFollowupPlan(message, history, queryDetection.language);
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
    canonicalPersonName: shadowPlan?.personCanonical || null,
    canonicalCoauthorNames: Array.isArray(shadowPlan?.coauthorNames) ? shadowPlan.coauthorNames : [],
    coauthorRequested: shadowPlan?.coauthorRequested === true,
    preservedEntityTypes: Array.from(entityTypes).sort(),
    preservedEntityCount: literalSummary.count + Number(shadowPlan?.preservedEntityCount || 0),
    transliterationUsed: shadowPlan?.transliterationUsed === true,
    controlledTopicCount: Number(shadowPlan?.controlledTopicCount || 0),
    controlledTopicTermsEt: Array.isArray(shadowPlan?.controlledTopicTermsEt)
      ? shadowPlan.controlledTopicTermsEt
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
    coauthor_count: Math.max(0, Math.min(4, Array.isArray(languagePlan.canonicalCoauthorNames)
      ? languagePlan.canonicalCoauthorNames.length
      : 0)),
    coauthor_requested: languagePlan.coauthorRequested === true,
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
