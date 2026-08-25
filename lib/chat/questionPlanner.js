const RESOURCE_DISCOVERY_SOURCE_LAYERS = Object.freeze([
  "organizations",
  "organization_materials",
  "public_body_info",
  "partner_service_info",
  "service_provider_info",
  "contact_page",
  "contacts",
  "sotsiaaltoo_articles",
  "journal_articles",
  "studies",
  "research_reports",
  "research",
  "analysis",
  "national_guidelines",
  "training_materials",
  "official_guideline",
  "information_material",
  "method_guidance",
  "worksheet",
  "journal_article",
  "research_report",
  "organization_profile",
  "organization_page"
]);

const RESOURCE_DISCOVERY_AVOID_SOURCE_LAYERS = Object.freeze([
  "legal_only_answer",
  "national_law_as_primary"
]);

function normalizePlannerText(value = "") {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[õ]/g, "o")
    .replace(/[ä]/g, "a")
    .replace(/[ö]/g, "o")
    .replace(/[ü]/g, "u")
    .replace(/[š]/g, "s")
    .replace(/[ž]/g, "z")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePlannerRole(role = "") {
  const value = String(role || "").trim().toLowerCase();
  if (value === "client" || value === "citizen" || value === "kodanik") return "client";
  if (value === "social_worker" || value === "specialist" || value === "spetsialist") return "social_worker";
  if (value === "admin") return "admin";
  return "unknown";
}

function makePlan(overrides = {}) {
  return {
    planner_version: "v2.2",
    mode: "default",
    role: "unknown",
    input_role: "unknown",
    role_confidence: 0.4,
    confidence: 0.4,
    needs_rag: true,
    needs_multiple_sources: false,
    preferred_source_count: null,
    topics: [],
    life_situation: null,
    needs_location: false,
    municipality_hint: null,
    risk_level: "low",
    source_layers: [],
    avoid_source_layers: [],
    source_layer_filter_mode: null,
    retrieval_strategy: "default_hybrid",
    answer_contract: "grounded_answer",
    planner_reason: "default",
    ...overrides
  };
}

function inferPlannerRole(text = "", normalizedRole = "unknown") {
  const clientFirstPerson = /\b(mul|minul|mind|mina|mu|minu|meil|meie|ema|isa|laps|lapsel|perel|kodust|kodus)\b/.test(text);
  const immediateHelp = /\b(pole|ei ole|ei saa|ei jaksa|vajan|vajame|mida teha|kuhu poorduda|kelle poole poorduda|abi vaja|hakkama)\b/.test(text);
  const professionalFrame = /\b(spetsialist|sotsiaalt(?:oo|ootaja)|lastekaitsetootaja|juhtumit(?:oo|o)|hindamine|dokumenteerimine|metoodika|praktika|menetlus|eristada|vordle|vordlus)\b/.test(text);
  if (professionalFrame && !clientFirstPerson) {
    return {
      role: "social_worker",
      confidence: normalizedRole === "social_worker" ? 0.9 : 0.72,
      reason: "professional_or_method_frame"
    };
  }
  if (clientFirstPerson && immediateHelp) {
    return {
      role: "client",
      confidence: 0.86,
      reason: "first_person_life_situation"
    };
  }
  return {
    role: normalizedRole,
    confidence: normalizedRole === "unknown" ? 0.4 : 0.75,
    reason: "session_role"
  };
}

function detectLifeSituation(text = "") {
  const topics = new Set();
  let lifeSituation = null;
  let confidence = 0;

  if (/\b(pole|ei ole|puudub).{0,24}\b(raha|sissetulek|toit|suua|süüa|uur|uuri|üüri|arve|arved)\b/.test(text) ||
      /\b(toidu jaoks|uuri jaoks|üüri jaoks|ei jaksa maksta|makseraskus|volg|võlg)\b/.test(text)) {
    lifeSituation = "financial_hardship";
    confidence = Math.max(confidence, 0.88);
    ["toimetulekutoetus", "valtimatu_sotsiaalabi", "taiendav_sotsiaaltoetus", "volanoustamine", "kov_sotsiaalosakond"].forEach(topic => topics.add(topic));
  }

  if (/\b(ema|isa|vanem|eakas|vanaema|vanaisa|lahedane|lähedane)\b.{0,60}\b(ei saa|ei tule|ei jaksa|enam uksi|üksi|hakkama|kodust|kodus)\b/.test(text) ||
      /\b(hoolduskoormus|hooldusvajadus|koduteenus|uldhooldusteenus|üldhooldusteenus)\b/.test(text)) {
    lifeSituation = lifeSituation || "elderly_relative_care_difficulty";
    confidence = Math.max(confidence, 0.84);
    ["koduteenus", "abivajaduse_hindamine", "taisealise_isiku_hooldus", "uldhooldusteenus", "sotsiaaltransport", "hoolduskoormus"].forEach(topic => topics.add(topic));
  }

  if (/\b(puudega|erivajadusega)\b.{0,30}\b(laps|lapse|lapsel|perel|pere)\b/.test(text) ||
      /\b(mul on puudega laps|puudega laps kuhu poorduda|puudega lapse pere)\b/.test(text)) {
    lifeSituation = lifeSituation || "disabled_child_family_support";
    confidence = Math.max(confidence, 0.84);
    ["puudega_lapse_toetus", "lapsehoiuteenus", "tugiisikuteenus", "rehabilitatsioon", "ska", "kov_lastekaitse"].forEach(topic => topics.add(topic));
  }

  if (!lifeSituation) return null;
  return {
    lifeSituation,
    topics: Array.from(topics),
    confidence
  };
}

function isComparisonQuestion(text = "") {
  const comparisonIntent = /\b(vordle|vordlus|erista|eristada|erinevus|erinevad|vahe|mis vahe)\b/.test(text);
  const serviceSignal = /\b[a-z0-9]*teenus[a-z0-9]*\b/.test(text) ||
    /\b(koduteen|tugiisik|isikliku abistaja|lapsehoid|lapsehoi|uldhooldus|sotsiaaltransport|toetus)\b/.test(text);
  return comparisonIntent && serviceSignal;
}

function comparisonTopics(text = "") {
  const topics = new Set();
  if (/\bkoduteen/.test(text)) topics.add("koduteenus");
  if (/\btugiisikuteen|\btugiisik/.test(text)) topics.add("tugiisikuteenus");
  if (/\bisikliku abistaja/.test(text)) topics.add("isikliku_abistaja_teenus");
  if (/\blapsehoi|\blapsehoid/.test(text)) topics.add("lapsehoiuteenus");
  if (/\buldhooldus/.test(text)) topics.add("uldhooldusteenus");
  if (/\bsotsiaaltransport/.test(text)) topics.add("sotsiaaltransporditeenus");
  return Array.from(topics);
}

function isLegalExactQuestion(text = "") {
  return /(?:§|paragrahv)\s*\d{1,3}[a-z]?/.test(text) ||
    /\b(shs|sotsiaalhoolekande seadus|riigi teataja|riigiteataja)\b.{0,40}\b\d{1,3}[a-z]?\b/.test(text);
}

function isSpecificDocumentSummaryQuestion(text = "") {
  return /\b(kokkuvote|kokkuvotte|refereeri|summeeri)\b/.test(text) &&
    /\b(artikkel|artiklist|dokumendist|dokument|failist|pdf|uuringust|juhendist)\b/.test(text);
}

function isSpecificDocumentGuidanceQuestion(text = "") {
  const documentSignal = /\b(artikkel|artikli|artiklis|artiklist|dokument|dokumendi|dokumendis|dokumendist|fail|faili|failis|failist|pdf|uuring|uuringu|uuringus|uuringust|aruanne|aruande|aruandes|aruandest|raport|raporti|raportis|raportist|juhend|juhendi|juhendis|juhendist|juhendmaterjal|juhendmaterjali|tooleht|toolehe|toolehel|tooleht)\b/.test(text);
  const guidanceSignal = /\b(kuidas|mida|milline|millised|mis)\b.{0,80}\b(soovitab|kirjeldab|selgitab|utleb|juhendab|alustada|kaituda|teha|arvestada|valtida|rakendada|kasutada)\b/.test(text) ||
    /\b(soovitab|kirjeldab|selgitab|utleb|juhendab)\b.{0,80}\b(kuidas|mida|milline|millised|mis)\b/.test(text);
  return documentSignal && guidanceSignal;
}

const RESEARCH_FACT_SOURCE_RE = /\b([a-z0-9]*uuring[a-z0-9]*|uurimus|uurimuse|uurimuses|uurimusest|artikkel|artikli|artiklis|artiklist|kirjutis|kirjutise|kirjutises|kirjutisest|aruanne|aruande|aruandes|aruandest|raport|raporti|raportis|raportist|seire|seirearuanne|seirearuande|seirearuandes|analuus|analuusi|analuusis|analuusist|kaardistus|kaardistuse|kaardistuses|kusitlus|kusitluse|kusitluses|e-kurs[a-z0-9-]*)\b/;
const RESEARCH_FACT_SHAPE_RE = /(?:\b(mitu|kui\s+palju|kui\s+suur\s+osa|arv\w*|aasta\w*|millal|intervju\w*|valim\w*|osalej\w*|vastaj\w*|meetod\w*|analuusimeetod\w*|jareld\w*|protsent\w*|osakaal\w*)\b|%)/;
const RESEARCH_FACT_BROAD_RE = /\b(eri|mitme|mitmest|paljude)\s+(uuringute|uurimuste|artiklite|aruannete|raportite|analuuside)\b/;
const RESEARCH_FACT_COMPACT_EXCLUDE_RE = /\b(seadus|paragrahv|maarus|kov|vald|valla|linn|linna|omavalitsus|teenus|teenused|toetus|toetused|kontakt|kontaktid)\b/;
const RESEARCH_FACT_STOP_PREFIXES = Object.freeze([
  "aasta", "analuus", "arv", "artikkel", "artikli", "aruande", "intervju",
  "jareld", "kaardist", "kaasat", "kelle", "kirjeld", "kirjutis", "kokku", "kui", "kusitlus", "meetod", "millal",
  "milline", "millised", "mis", "mitu", "naidud", "need", "ning", "oli", "olid", "osakaal", "osalej", "palju", "pohjal", "protsent", "raport",
  "seire", "seotud", "sinna", "tehakse", "tehti", "uuring", "uurimus", "valim", "vastaj", "hinnang", "kolm"
]);
const RESEARCH_FACT_SUBJECT_NOISE_RE = /^(?:mida|kohta|kohaselt|sobiv\p{L}*|soovita\p{L}*)$/u;

function compactResearchFactShape(normalized = "") {
  const [subject = "", facts = "", ...rest] = String(normalized || "").split(":");
  if (!subject.trim() || !facts.trim() || rest.length || RESEARCH_FACT_COMPACT_EXCLUDE_RE.test(normalized)) {
    return false;
  }
  const subjectTerms = (subject.match(/[a-z0-9]+/gu) || []).filter(token =>
    token.length >= 4 &&
    !RESEARCH_FACT_STOP_PREFIXES.some(prefix => token.startsWith(prefix))
  );
  const factSlots = new Set((facts.match(/[a-z0-9]+/gu) || []).flatMap(token => {
    for (const prefix of ["aasta", "arv", "intervju", "jareld", "meetod", "osakaal", "osalej", "protsent", "valim", "vastaj"]) {
      if (token.startsWith(prefix)) return [prefix];
    }
    return [];
  }));
  return subjectTerms.length >= 2 && factSlots.size >= 2;
}

function implicitMultiCohortNumericFactShape(normalized = "") {
  if (RESEARCH_FACT_COMPACT_EXCLUDE_RE.test(normalized) || RESEARCH_FACT_BROAD_RE.test(normalized)) {
    return false;
  }
  const numericSlots = normalized.match(/\b(?:kui\s+palju|mitu|osakaal\w*|protsent\w*)\b/gu) || [];
  const ageScopes = normalized.match(/\b(?:ule|alla)\s+\d{1,3}(?:\s*-\s*|\s+)aasta\w*/gu) || [];
  return numericSlots.length >= 2 && ageScopes.length >= 2 && /\b(?:ja|ning)\b/u.test(normalized);
}

const BOUNDED_EPISODE_RE = /(?<![\p{L}\p{N}])(?:katseetap\p{L}*|piloot\p{L}*|projekti?etap\p{L}*|etap\p{L}*|voor\p{L}*|faas\p{L}*|pilot\p{L}*|project\s+phase\p{L}*|trial\s+phase\p{L}*|round\p{L}*|phase\p{L}*|пилот\p{L}*|этап\p{L}*|фаз\p{L}*|раунд\p{L}*)(?![\p{L}\p{N}])/u;
const BOUNDED_EPISODE_METRIC_RE = /(?<![\p{L}\p{N}])(?:inimes\p{L}*|osalej\p{L}*|vabatahtlik\p{L}*|tootund\p{L}*|tund\p{L}*|maakon\p{L}*|omavalits\p{L}*|riik\p{L}*|kohtum\p{L}*|juhtum\p{L}*|vastaj\p{L}*|spetsialist\p{L}*|tootaj\p{L}*|people|person\p{L}*|participant\p{L}*|volunteer\p{L}*|hour\p{L}*|count\p{L}*|municipalit\p{L}*|countr\p{L}*|meeting\p{L}*|case\p{L}*|respondent\p{L}*|specialist\p{L}*|worker\p{L}*|человек\p{L}*|участник\p{L}*|волонтер\p{L}*|час\p{L}*|уезд\p{L}*|муниципал\p{L}*|стран\p{L}*|встреч\p{L}*|случа\p{L}*|респондент\p{L}*|специалист\p{L}*|работник\p{L}*)(?![\p{L}\p{N}])/gu;
const BOUNDED_EPISODE_PERIOD_RE = /(?<!\d)(\d{4})\.?\s*(?:(?:-|–|—|kuni|to)\s*(\d{4})\.?|aastast\s+(\d{4})\.?\s+aastani)(?!\d)/u;

function boundedEpisodeMetricCategory(term = "") {
  const value = normalizePlannerText(term);
  if (/^(?:inimes|people|person|человек)/u.test(value)) return "people";
  if (/^(?:osalej|participant|участник)/u.test(value)) return "participants";
  if (/^(?:vabatahtlik|volunteer|волонтер)/u.test(value)) return "volunteers";
  if (/^(?:tootund|tund|hour|час)/u.test(value)) return "hours";
  if (/^(?:maakon|уезд)/u.test(value)) return "counties";
  if (/^(?:omavalits|municipalit|муниципал)/u.test(value)) return "municipalities";
  if (/^(?:riik|countr|стран)/u.test(value)) return "countries";
  if (/^(?:kohtum|meeting|встреч)/u.test(value)) return "meetings";
  if (/^(?:juhtum|case|случа)/u.test(value)) return "cases";
  if (/^(?:vastaj|respondent|респондент)/u.test(value)) return "respondents";
  if (/^(?:spetsialist|specialist|специалист)/u.test(value)) return "specialists";
  if (/^(?:tootaj|worker|работник)/u.test(value)) return "workers";
  return value;
}

function boundedEpisodePeriodYears(normalized = "") {
  const match = normalized.match(BOUNDED_EPISODE_PERIOD_RE);
  return match ? [match[1], match[2] || match[3]].filter(Boolean) : [];
}

function boundedEpisodePhaseOrdinal(normalized = "") {
  const tokens = normalized.match(/[\p{L}\d]+/gu) || [];
  const phaseTokenIndexes = tokens.flatMap((token, index) =>
    /^(?:katseetap|projekti?etap|etap|voor|faas|piloot|pilot|trial|phase|stage|round|пилот|этап|фаз|раунд)\p{L}*$/u.test(token)
      ? [index]
      : []
  );
  const modifierPatterns = [
    { ordinal: "first", pattern: /^(?:esim(?:ene|ese\p{L}*|est\p{L}*|esi\p{L}*)|first|перв\p{L}*)$/u },
    { ordinal: "second", pattern: /^(?:tei(?:ne|se\p{L}*|st\p{L}*|si\p{L}*)|second|втор\p{L}*)$/u },
    { ordinal: "third", pattern: /^(?:kolm(?:as|and\p{L}*)|third|трет\p{L}*)$/u },
    { ordinal: "next", pattern: /^(?:(?:jargmi|jargnev)\p{L}*|next|following|subsequent|(?:следующ|последующ)\p{L}*)$/u },
    { ordinal: "later", pattern: /^(?:hilisem\p{L}*|later|поздн\p{L}*)$/u }
  ];
  for (let index = 0; index < tokens.length; index += 1) {
    const modifier = modifierPatterns.find(item => item.pattern.test(tokens[index]));
    if (modifier && phaseTokenIndexes.some(phaseIndex => Math.abs(phaseIndex - index) <= 2)) {
      return modifier.ordinal;
    }
  }
  return null;
}

function boundedEpisodeMetricFactShape(normalized = "", { hasSourceAnchor = false } = {}) {
  if (boundedEpisodePeriodYears(normalized).length !== 2) return false;
  if (!BOUNDED_EPISODE_RE.test(normalized)) return false;
  if (/\b(?:iga\s+aasta|aasta\s+kohta|aastate\s+kaupa|ajatelg|timeline|kronoloog\p{L}*|vordl\p{L}*|vordle\p{L}*|muutus\p{L}*|trend\p{L}*)\b/u.test(normalized)) return false;
  if (/\b(?:praegu|hetkel|tana|kehtiv\p{L}*|seadus\p{L}*|paragrahv\p{L}*|maarus\p{L}*)\b/u.test(normalized)) return false;
  if (!hasSourceAnchor && /\b(?:teenus\p{L}*|toetus\p{L}*|kontakt\p{L}*|telefon\p{L}*|taotl\p{L}*)\b/u.test(normalized)) return false;
  const countSlots = normalized.match(/(?<![\p{L}\p{N}])(?:kui\s+palju|mitu|mitmesse|mitmest|how\s+many|number\s+of|count\s+of|сколько|число|количество)(?![\p{L}\p{N}])/gu) || [];
  const metricTerms = Array.from(normalized.matchAll(BOUNDED_EPISODE_METRIC_RE), match => match[0]);
  const metricCategories = new Set(metricTerms.map(boundedEpisodeMetricCategory));
  const commaCount = (normalized.match(/,/gu) || []).length;
  return metricCategories.size >= 3 && (countSlots.length >= 3 || (countSlots.length >= 1 && commaCount >= 2));
}

const SOURCELESS_ENUMERATED_OPERATIONAL_RE = /\b(?:teenus\p{L}*|toetus\p{L}*|kontakt\p{L}*|telefon\p{L}*|taotl\p{L}*|vorm\p{L}*|hind\p{L}*|tasu\p{L}*|praegu|hetkel|tana|kehtiv\p{L}*|pakub|pakuvad|saab|seadus\p{L}*|paragrahv\p{L}*|maarus\p{L}*|allik\p{L}*|materjal\p{L}*|organisatsioon\p{L}*|veebileh\p{L}*)\b/u;
const SOURCELESS_ENUMERATED_PAST_RE = /\b(?:avati|loodi|asutati|kaivitati|korraldati|toimus\p{L}*|osales\p{L}*|holmas\p{L}*|sai|said|tehti|oli|olid|opened|created|founded|launched|held|participated|covered|was|were)\b/u;
const SOURCELESS_ENUMERATED_ANAPHOR_RE = /\b(?:nende|neile|selle|seda|need|their|them|its|these)\b/u;
const SOURCELESS_ENUMERATED_GENERIC_NAME_RE = /^(?:Millis\p{L}*|Mida|Mis|Kui|Need|Nende|Selle|See|Eesti|Eestis|Estonia)$/u;
const ESTONIAN_ENUMERATED_COUNT_RE = /^(?:uks|uh(?:e(?:s|st|l|le|lt|ks|ga)?|te)|kaks|kah(?:e(?:s|st|l|le|lt|ks|ga)?|t(?:e)?)|kolm(?:e(?:s|st|l|le|lt|ks|ga)?)?|neli|nelja(?:s|st|l|le|lt|ks|ga)?|viis|viie(?:s|st|l|le|lt|ks|ga)?|viit|kuus|kuue(?:s|st|l|le|lt|ks|ga)?|kuut|seitse|seitsme(?:s|st|l|le|lt|ks|ga)?|seitset|kaheksa(?:s|st|l|le|lt|ks|ga)?|uheksa(?:s|st|l|le|lt|ks|ga)?|kum(?:me|ne(?:s|st|l|le|lt|ks|ga)?|met))$/u;

function isEnumeratedCountToken(token = "") {
  if (/^\d{1,3}$/u.test(token)) return true;
  return ESTONIAN_ENUMERATED_COUNT_RE.test(token);
}

function hasSourceLessNamedEnumerationAnchor(message = "", normalized = "") {
  const text = String(message || "").trim();
  if (!text) return false;
  if (!SOURCELESS_ENUMERATED_PAST_RE.test(normalized) || !SOURCELESS_ENUMERATED_ANAPHOR_RE.test(normalized)) {
    return false;
  }
  if (/[„“"][^„“”"]{3,}[”"]?/u.test(text)) return true;
  const firstTextIndex = text.search(/\S/u);
  return Array.from(text.matchAll(
    /(?<![\p{L}\p{N}])(?:\p{Lu}[\p{Ll}\p{M}\p{N}'’-]{3,}|[\p{Lu}\d]{3,})(?![\p{L}\p{N}])/gu
  )).some(match =>
    Number(match.index) > firstTextIndex &&
    !SOURCELESS_ENUMERATED_GENERIC_NAME_RE.test(String(match[0] || ""))
  );
}

function namedEnumeratedResearchFactShape(normalized = "", sourceMatch = null, message = "") {
  if (!/\b(?:nimeta|loetle|millis\p{L}*)\b/u.test(normalized)) return false;
  const countWords = (normalized.match(/[a-z0-9]+/gu) || []).filter(isEnumeratedCountToken);
  if (countWords.length < 2 || !/\b(?:ja|ning)\b/u.test(normalized)) return false;
  if (sourceMatch) return true;
  if (SOURCELESS_ENUMERATED_OPERATIONAL_RE.test(normalized)) return false;
  return hasSourceLessNamedEnumerationAnchor(message, normalized);
}

function extractResearchFactPersonName(message = "") {
  const text = String(message || "").replace(/\s+/g, " ").trim();
  const patterns = [
    /\b([\p{Lu}][\p{L}'’-]{1,}\s+[\p{Lu}][\p{L}'’-]{1,})\s+(?:kirjeldatud|uuring\w*|uurimus\w*|artikl\w*|aruand\w*|raport\w*)/u,
    /\b(?:autor\w*|kirjutas|koostas)\s+([\p{Lu}][\p{L}'’-]{1,}\s+[\p{Lu}][\p{L}'’-]{1,})\b/u
  ];
  for (const pattern of patterns) {
    const candidate = cleanPersonCandidate(text.match(pattern)?.[1] || "");
    if (isLikelyPersonCandidate(candidate)) return candidate;
  }
  return null;
}

function extractSpecificResearchFactIntent(message = "") {
  const normalized = normalizePlannerText(message);
  const sourceMatch = normalized.match(RESEARCH_FACT_SOURCE_RE);
  const compactShape = !sourceMatch && compactResearchFactShape(normalized);
  const implicitNumericShape = !sourceMatch && !compactShape && implicitMultiCohortNumericFactShape(normalized);
  const boundedEpisodeShape = !compactShape && !implicitNumericShape && boundedEpisodeMetricFactShape(normalized, {
    hasSourceAnchor: !!sourceMatch
  });
  const episodeYears = boundedEpisodeShape ? boundedEpisodePeriodYears(normalized) : [];
  const episodePhaseOrdinal = boundedEpisodeShape ? boundedEpisodePhaseOrdinal(normalized) : null;
  const enumeratedListShape = namedEnumeratedResearchFactShape(normalized, sourceMatch, message);
  if (
    (!sourceMatch && !compactShape && !implicitNumericShape && !boundedEpisodeShape && !enumeratedListShape) ||
    (!RESEARCH_FACT_SHAPE_RE.test(normalized) && !boundedEpisodeShape && !enumeratedListShape)
  ) return null;
  if (RESEARCH_FACT_BROAD_RE.test(normalized)) return null;

  const personName = extractResearchFactPersonName(message);
  const personTokens = new Set(normalizePlannerText(personName || "").split(/\s+/u).filter(Boolean));
  const tokens = normalized.match(/[\p{L}\d]+/gu) || [];
  const numericFactTerms = Array.from(new Set(
    Array.from(String(message || "").matchAll(/(?<![\p{L}\d])\d+(?:[.,]\d+)?\s*%/gu))
      .map(match => String(match[0] || "").replace(/\s+/gu, "").replace(",", "."))
      .filter(Boolean)
  ));
  const numericAnchorTerms = Array.from(new Set(
    Array.from(String(message || "").matchAll(/(?<![\p{L}\d])\d{2,4}(?!\s*%|[\p{L}\d])/gu))
      .map(match => String(match[0] || "").trim())
      .filter(Boolean)
  ));
  const inferredAgeSubjectTerms = /\b(?:ule|alla)\s+\d{1,3}(?:\s*-\s*|\s+)aasta\w*/u.test(normalized)
    ? ["vanemaealiste"]
    : [];
  const boundedMetricTerms = boundedEpisodeShape
    ? Array.from(new Set(Array.from(normalized.matchAll(BOUNDED_EPISODE_METRIC_RE), match => match[0])))
    : [];
  const boundedMetricSlotMap = new Map();
  for (const term of boundedMetricTerms) {
    const category = boundedEpisodeMetricCategory(term);
    const terms = boundedMetricSlotMap.get(category) || [];
    if (!terms.includes(term)) terms.push(term);
    boundedMetricSlotMap.set(category, terms);
  }
  const boundedMetricSlots = Array.from(boundedMetricSlotMap, ([category, terms]) => ({ category, terms }));
  const boundedMetricQueryTerms = boundedMetricSlots.map(slot => slot.terms[0]).filter(Boolean);
  const episodeYearSet = new Set(episodeYears);
  const publicationYearSubjectTerms = tokens
    .filter(token => /^(?:19|20)\d{2}$/u.test(token) && !episodeYearSet.has(token))
    .slice(0, 2);
  const lexicalSubjectTerms = Array.from(new Set([
    ...inferredAgeSubjectTerms,
    ...tokens.flatMap(token => {
      if (
        token.length < 4 ||
        /^\d+$/u.test(token) ||
        RESEARCH_FACT_SUBJECT_NOISE_RE.test(token) ||
        personTokens.has(token) ||
        RESEARCH_FACT_STOP_PREFIXES.some(prefix => token.startsWith(prefix))
      ) return [];
      for (const suffix of ["uuring", "uurimus", "kaardistus", "kusitlus", "analuus"]) {
        if (!token.endsWith(suffix) || token.length - suffix.length < 4) continue;
        return [token.slice(0, -suffix.length)];
      }
      return [token];
    })
  ])).slice(0, 10);
  const subjectTerms = Array.from(new Set([
    ...publicationYearSubjectTerms,
    ...lexicalSubjectTerms
  ]));
  const factTerms = Array.from(new Set([
    ...boundedMetricQueryTerms,
    ...episodeYears,
    ...tokens.filter(token =>
      RESEARCH_FACT_STOP_PREFIXES.some(prefix => token.startsWith(prefix)) &&
      /^(?:aasta|analuus|arv|intervju|jareld|meetod|osakaal|osalej|protsent|valim|vastaj)/u.test(token)
    ),
    ...numericFactTerms,
    ...numericAnchorTerms
  ])).slice(0, 8);
  const sourceToken = String(sourceMatch?.[1] || "");
  const sourceKind = /uuring/u.test(sourceToken)
    ? "uuring"
    : /uurimus/u.test(sourceToken)
      ? "uurimus"
      : !sourceMatch && (boundedEpisodeShape || enumeratedListShape)
        ? ""
        : sourceToken || "uuring";
  return {
    personName,
    subjectTerms,
    factTerms,
    sourceKind,
    compactShape,
    implicitNumericShape,
    boundedEpisodeShape,
    episodeYears,
    episodePhaseOrdinal,
    boundedMetricTerms,
    boundedMetricSlots,
    publicationYearSubjectTerms,
    enumeratedListShape
  };
}

function isKovServiceOrBenefitQuestion(text = "") {
  const municipalitySignal = /\b(vald|valla|linn|linna|kov|omavalitsus|omavalitsuse)\b/.test(text);
  const serviceSignal = /\b(koduteenus|sotsiaaltransport|tugiisikuteenus|lapsehoiuteenus|uldhooldusteenus|teenus|teenused|toetus|toetused|tingimus|tingimused|taotleda|vormid|kontaktid)\b/.test(text);
  return municipalitySignal && serviceSignal;
}

function isOverviewSynthesisQuestion(text = "") {
  const issueSignal = /\b(murekoh\w*|probleem\w*|kitsaskoh\w*|raskus\w*|valjakutse\w*|teemad korduvad|ulevaade probleemidest|peamised teemad)\b/.test(text);
  const broadDomainSignal = /\b(lastekaitse\w*|sotsiaaltoo\w*|omastehooldaja\w*|hooldaja\w*|puudega lapse pere|valdkond\w*|praktika\w*)\b/.test(text);
  return issueSignal && broadDomainSignal;
}

function isExplicitJournalSynthesisQuestion(text = "") {
  const journalSignal = /\bsotsiaaltoo\b/.test(text);
  const sourceSignal = /\b(artikl\w*|lugu\w*|tekst\w*|kirjutis\w*|allik\w*|kasitlus\w*)\b/.test(text);
  const crossSourceSignal = /\b(eri|mitm\w*|ulevaad\w*|vordl\w*)\b/.test(text);
  return journalSignal && sourceSignal && crossSourceSignal;
}

function cleanPersonCandidate(value = "") {
  return String(value || "")
    .replace(/^[^\p{Letter}]+|[^\p{Letter}'’ -]+$/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyPersonCandidate(value = "") {
  const candidate = cleanPersonCandidate(value);
  const words = candidate.split(/\s+/u).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  const excluded = new Set([
    "sa", "te", "tema", "mina", "sotsiaalai", "chatgpt", "openai",
    "ta on", "tema on",
    "minu kontakt", "lapse eestkostja", "sotsiaalne tootaja", "sotsiaaltöötaja",
    "teenuse saaja"
  ]);
  const normalized = normalizePlannerText(candidate);
  if (excluded.has(normalized)) return false;
  if (/^(kes|mis|mida|millest|kuidas|millal|kus|kust|miks|kas|milline|millised)\b/.test(normalized)) return false;
  if (/\b(sotsiaaltoo|artikkel|artiklid|artikleid|autorlus)\b/.test(normalized)) return false;
  return words.every(word => /^[\p{Letter}][\p{Letter}'’-]{1,}$/u.test(word));
}

export function extractNamedPersonIntent(message = "") {
  const text = String(message || "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  const patterns = [
    /^\s*(.+?)\s+(?:on\s+)?(?:kirjutanud|avaldanud)\s+(?:kui\s+palju|mitu)\s+(?:artiklit|artikleid|lugu|lugusid|teksti|tekste|kirjutist|kirjutisi)\b/iu,
    /^\s*kes\s+on\s+(.+?)\s+ja\s+(?:mida|millest)\s+(?:ta|tema)\s+(?:on\s+)?(?:kirjutanud|avaldanud)\b/iu,
    /\b(?:millest|mida)\s+(?:on\s+)?(.+?)(?:\s+ise)?\s+ajakirjas\s+["'„“”]?Sotsiaaltöö["'„“”]?\s+kirjutanud\b/iu,
    /\bmillest\s+(?:on\s+)?(.+?)\s+kirjutanud\b/iu,
    /\bmida\s+(?:on\s+)?(.+?)\s+kirjutanud\b/iu,
    /^\s*kes\s+on\s+(.+?)[?.!]*\s*$/iu,
    /^\s*(.+?)\s+(?:artiklid|artikleid|autorlus)\b/iu
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const candidate = cleanPersonCandidate(match?.[1] || "")
      .replace(/\s+ise$/iu, "")
      .trim();
    if (isLikelyPersonCandidate(candidate)) return candidate;
  }
  return null;
}

function personSourceIntent(message = "") {
  const text = String(message || "").replace(/\s+/g, " ").trim();
  if (/\b(?:kui\s+palju|mitu)\s+(?:artiklit|artikleid|lugu|lugusid|teksti|tekste|kirjutist|kirjutisi)\b/iu.test(text)) {
    return {
      kind: "authored_works_count",
      scope: /\bajakirjas\s+["'„“”]?Sotsiaaltöö["'„“”]?/iu.test(text)
        ? "sotsiaaltoo_articles"
        : null
    };
  }
  if (/\b(?:millest|mida)\s+(?:on\s+)?.+?\s+kirjutanud\b/iu.test(text) || /\b(?:artiklid|artikleid|autorlus)\b/iu.test(text)) {
    return {
      kind: "authored_works",
      scope: /\bajakirjas\s+["'„“”]?Sotsiaaltöö["'„“”]?/iu.test(text)
        ? "sotsiaaltoo_articles"
        : null
    };
  }
  return {
    kind: "person_profile",
    scope: null
  };
}

function isResourceDiscoveryQuestion(text = "") {
  const questionSignal = /\?/.test(text) ||
    /\b(millised|mis|mida|kust|kelle poole|kas on|leida abi|aitavad|aitab|pakub|pakuvad)\b/.test(text);
  if (!questionSignal) return false;

  const organizationSignal = /\b(organisatsioon|organisatsioonid|uhendus|uhing|koda|liit|fond|tugiliit|tugivorgustik|vorgustik|partner|teenusepakkuja|teenusepakkujad|keskus|asutus|kontakt|kontaktid)\b/.test(text);
  const materialSignal = /\b(materjal|materjale|materjalid|juhendmaterjal|juhendmaterjale|juhendmaterjalid|juhend|juhendid|pdf|infoleht|teemaleht|kataloog|vorm|vormid|taotlus|taotlused|praktikamaterjal|koolitusmaterjal|tooleht|toolehe|toolehed|toolehte|toolehti|toolehtede)\b/.test(text);
  const helpSignal = /\b(kust leida abi|kelle poole poorduda|milline organisatsioon aitab|millised organisatsioonid|abivoimalus|abivoimalused|tugiteenus|tugiteenused|noustamine|ligipaasetavus)\b/.test(text);
  const disabilitySignal = /\b(puudega inimene|puudega inimesed|erivajadus|erivajadusega|nagemispuue|kuulmispuue|liitpuue|pimekurtus|viipekeel)\b/.test(text);
  const schoolMentalHealthMaterialSignal = /\b(laps|laste|noor|noorte|kool|koolis|opetaja)\b/.test(text) &&
    /\b(vaimne tervis|vaimse tervise|materjal|materjale|juhend|juhendmaterjal)\b/.test(text);

  return organizationSignal ||
    materialSignal ||
    helpSignal ||
    (disabilitySignal && (organizationSignal || materialSignal || helpSignal || /\b(aitab|aitavad|abi|toetab|toetavad)\b/.test(text))) ||
    schoolMentalHealthMaterialSignal;
}

export function buildQuestionPlan({ message = "", role = "" } = {}) {
  const normalized = normalizePlannerText(message);
  const inputRole = normalizePlannerRole(role);
  const roleInference = inferPlannerRole(normalized, inputRole);
  const normalizedRole = roleInference.role || inputRole;

  if (!normalized) {
    return makePlan({
      role: normalizedRole,
      input_role: inputRole,
      role_confidence: roleInference.confidence,
      needs_rag: false,
      planner_reason: "empty_message"
    });
  }

  if (isLegalExactQuestion(normalized)) {
    return makePlan({
      mode: "legal_exact",
      role: normalizedRole,
      input_role: inputRole,
      role_confidence: roleInference.confidence,
      confidence: 0.9,
      needs_rag: true,
      retrieval_strategy: "legal_exact",
      answer_contract: "legal_exact_source_required",
      planner_reason: "explicit_law_or_paragraph_reference"
    });
  }

  if (isKovServiceOrBenefitQuestion(normalized)) {
    return makePlan({
      mode: "kov_service_or_benefit",
      role: normalizedRole,
      input_role: inputRole,
      role_confidence: roleInference.confidence,
      confidence: 0.82,
      needs_rag: true,
      needs_location: true,
      retrieval_strategy: "kov_source_package_or_scoped_rag",
      answer_contract: "municipality_source_package_preferred",
      planner_reason: "municipality_and_service_or_benefit_terms"
    });
  }

  const namedPerson = extractNamedPersonIntent(message);
  if (namedPerson) {
    const namedPersonIntent = personSourceIntent(message);
    return makePlan({
      planner_version: "v2.6",
      mode: "person_source_lookup",
      role: normalizedRole,
      input_role: inputRole,
      role_confidence: roleInference.confidence,
      confidence: 0.9,
      needs_rag: true,
      needs_multiple_sources: true,
      preferred_source_count: { min: 2, max: 8 },
      person_name: namedPerson,
      person_source_intent: namedPersonIntent.kind,
      person_source_scope: namedPersonIntent.scope,
      source_layers: ["sotsiaaltoo_articles", "journal_articles", "research_reports", "organization_materials"],
      source_layer_filter_mode: "prefer",
      retrieval_strategy: "exact_person_metadata_then_content",
      answer_contract: "describe_person_only_from_attributed_sources_and_list_authored_topics",
      planner_reason: "named_person_or_author_request"
    });
  }

  const specificResearchFact = extractSpecificResearchFactIntent(message);
  if (specificResearchFact) {
    return makePlan({
      planner_version: "v2.6",
      mode: "specific_research_fact",
      role: normalizedRole,
      input_role: inputRole,
      role_confidence: roleInference.confidence,
      confidence: specificResearchFact.personName ? 0.92 : 0.82,
      needs_rag: true,
      needs_multiple_sources: false,
      person_name: specificResearchFact.personName,
      document_subject_terms: specificResearchFact.subjectTerms,
      document_fact_terms: specificResearchFact.factTerms,
      document_source_kind: specificResearchFact.sourceKind,
      document_source_years: specificResearchFact.publicationYearSubjectTerms,
      period_role: specificResearchFact.boundedEpisodeShape ? "evidence_episode" : null,
      evidence_period_years: specificResearchFact.episodeYears,
      evidence_phase_ordinal: specificResearchFact.episodePhaseOrdinal,
      evidence_metric_terms: specificResearchFact.boundedMetricTerms,
      evidence_metric_slots: specificResearchFact.boundedMetricSlots,
      bounded_episode_metric_fact: specificResearchFact.boundedEpisodeShape === true,
      source_layers: ["journal_article", "research_report", "study", "survey_report", "evaluation_report", "analysis"],
      source_layer_filter_mode: "prefer",
      retrieval_strategy: "document_identity_then_fact",
      answer_contract: "same_identified_document_fact_required",
      planner_reason: specificResearchFact.compactShape
        ? "compact_single_research_fact_shape"
        : specificResearchFact.implicitNumericShape
          ? "implicit_multi_cohort_numeric_fact_shape"
          : specificResearchFact.boundedEpisodeShape
            ? "bounded_episode_metric_fact_shape"
          : specificResearchFact.enumeratedListShape
            ? "named_enumerated_research_fact_shape"
            : "singular_research_source_and_fact_shape"
    });
  }

  if (isSpecificDocumentSummaryQuestion(normalized)) {
    return makePlan({
      mode: "specific_document_summary",
      role: normalizedRole,
      input_role: inputRole,
      role_confidence: roleInference.confidence,
      confidence: 0.84,
      needs_rag: true,
      retrieval_strategy: "specific_document_lookup",
      answer_contract: "summarize_requested_document_only",
      planner_reason: "specific_document_summary_request"
    });
  }

  if (isSpecificDocumentGuidanceQuestion(normalized)) {
    return makePlan({
      planner_version: "v2.7",
      mode: "specific_document_question",
      role: normalizedRole,
      input_role: inputRole,
      role_confidence: roleInference.confidence,
      confidence: 0.84,
      needs_rag: true,
      needs_multiple_sources: false,
      source_layers: ["official_guideline", "information_material", "method_guidance", "worksheet", "research_report", "journal_article"],
      source_layer_filter_mode: "prefer",
      retrieval_strategy: "specific_document_lookup",
      answer_contract: "answer_from_requested_document_only",
      planner_reason: "specific_document_guidance_request"
    });
  }

  if (isOverviewSynthesisQuestion(normalized) || isExplicitJournalSynthesisQuestion(normalized)) {
    return makePlan({
      mode: "overview_synthesis",
      role: normalizedRole,
      input_role: inputRole,
      role_confidence: roleInference.confidence,
      confidence: 0.78,
      needs_rag: true,
      needs_multiple_sources: true,
      preferred_source_count: { min: 5, max: 8 },
      retrieval_strategy: "overview_diversity_then_depth",
      answer_contract: "multi_source_overview_synthesis",
      planner_reason: "broad_issue_or_overview_question"
    });
  }

  const lifeSituation = detectLifeSituation(normalized);
  if (lifeSituation) {
    return makePlan({
      mode: "life_situation_guidance",
      role: "client",
      input_role: inputRole,
      role_confidence: Math.max(roleInference.confidence || 0, lifeSituation.confidence),
      confidence: lifeSituation.confidence,
      needs_rag: true,
      needs_multiple_sources: true,
      preferred_source_count: { min: 3, max: 6 },
      topics: lifeSituation.topics,
      life_situation: lifeSituation.lifeSituation,
      needs_location: true,
      source_layers: ["kov_services", "national_law", "public_body_info", "national_guidelines"],
      source_layer_filter_mode: "prefer",
      retrieval_strategy: "life_situation_guidance_hybrid",
      answer_contract: "client_next_steps_no_entitlement_promise",
      planner_reason: "client_life_situation_mapping"
    });
  }

  if (isComparisonQuestion(normalized)) {
    const topics = comparisonTopics(normalized);
    return makePlan({
      mode: "comparison",
      role: normalizedRole === "client" ? "client" : "social_worker",
      input_role: inputRole,
      role_confidence: roleInference.confidence,
      confidence: 0.76,
      needs_rag: true,
      needs_multiple_sources: true,
      preferred_source_count: { min: 2, max: 6 },
      topics,
      source_layers: ["national_law", "national_guidelines", "methodology_guides", "sotsiaaltoo_articles"],
      source_layer_filter_mode: "prefer",
      retrieval_strategy: "comparison_balanced_sources",
      answer_contract: "compare_each_side_with_source_support",
      planner_reason: "comparison_question"
    });
  }

  if (isResourceDiscoveryQuestion(normalized)) {
    return makePlan({
      mode: "resource_discovery",
      role: normalizedRole,
      input_role: inputRole,
      role_confidence: roleInference.confidence,
      confidence: 0.8,
      needs_rag: true,
      needs_multiple_sources: true,
      preferred_source_count: { min: 3, max: 8 },
      source_layers: [...RESOURCE_DISCOVERY_SOURCE_LAYERS],
      avoid_source_layers: [...RESOURCE_DISCOVERY_AVOID_SOURCE_LAYERS],
      source_layer_filter_mode: "prefer",
      retrieval_strategy: "resource_discovery_hybrid",
      answer_contract: "prefer_organization_material_contact_and_guideline_sources",
      planner_reason: "organization_material_contact_or_help_seeking_terms"
    });
  }

  return makePlan({
    role: normalizedRole,
    input_role: inputRole,
    role_confidence: roleInference.confidence,
    planner_reason: roleInference.reason || "default"
  });
}
