import { currentStatusEvidenceRequested } from "./currentStatusEvidence.js";
import {
  canonicalMorphologyPersonCandidate,
  cleanPersonCandidate,
  extractSemanticEntities,
  isLikelyPersonCandidate,
  morphologyPersonCandidates,
  surfacePersonCandidates
} from "./entityExtraction.js";
import { normalizeSemanticText } from "./semanticTurnContract.js";

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
  return normalizeSemanticText(value);
}

function normalizeRequestedFactText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}%.,;:!?\-–—]+/gu, " ")
    .replace(/\s+/gu, " ")
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
    social_scope: "unknown",
    social_scope_reason: "not_classified",
    requested_year_role: "none",
    current_evidence_scope: null,
    planner_reason: "default",
    ...overrides
  };
}

const STRONG_SOCIAL_SCOPE_TOKEN_PREFIXES = Object.freeze([
  // Estonian (the planner text is already diacritic-folded).
  "sotsiaaltoo", "sotsiaalhoole", "sotsiaalteen", "sotsiaaltoetus",
  "sotsiaalkindlust", "sotsiaalabi", "sotsiaalvaldk", "hoolekan",
  "toimetulek", "abivajad", "seltsilis",
  "lastekait", "puue", "puudega", "erivajad", "hooldaja", "hoolduskoorm",
  "hooldusvajad", "hooldusteen", "uldhoold", "rehabilitats",
  "eestkost", "vaimse", "depress", "autism", "suitsiid",
  "enesetap", "vagivall", "ohvri", "varjupa", "kodutu", "soltuv",
  "vaes", "pension", "toovoime", "perekonnasead",
  "juhtumitoo", "sotsiaaltoot", "lastekaitsetoot", "tugiisik", "koduteen",
  "sotsiaaltransp", "lapsehoi",
  // English.
  "caregiv", "disabil", "rehabilitat", "guardianship", "homeless", "casework",
  "poverty", "pension", "suicid",
  // Russian.
  "соцработ", "соцзащит", "соцобеспеч", "пособ", "льгот", "опек", "инвалид", "реабилит",
  "бездом", "насили", "самоубий"
]);

const STRONG_SOCIAL_SCOPE_EXACT_TOKENS = new Set([
  "ska", "shs", "ath"
]);

const WEAK_SOCIAL_TARGET_TOKEN_PREFIXES = Object.freeze([
  "sissetulek", "omavalits", "kriis",
  "income", "elder", "municipal",
  "доход", "пожил", "муницип"
]);

const WEAK_SOCIAL_TARGET_EXACT_TOKENS = new Set([
  "laps", "lapse", "last", "lapsel", "lapsele", "lapselt", "lapsed", "laste", "lapsi",
  "lastele", "lastel", "lastelt", "lapsest", "lapsesse", "lapsega", "lapseta",
  "pere", "peret", "peres", "perel", "perele", "perelt", "pered", "perede", "peresid",
  "peredel", "peredele", "peredelt", "perega", "pereta",
  "eakas", "eaka", "eakat", "eakal", "eakale", "eakalt", "eakad", "eakate", "eakaid",
  "eakatel", "eakatele", "eakatelt", "kov",
  "vald", "valla", "valda", "vallas", "vallal", "vallale", "vallalt", "vallad",
  "valdade", "valdades", "linn", "linna", "linnas", "linnal", "linnale", "linnalt",
  "linnad", "linnade", "linnades",
  "child", "family", "crisis",
  "ребенок", "семья", "кризис"
]);

const WEAK_SOCIAL_SUPPORT_TOKEN_PREFIXES = Object.freeze([
  "abi", "tug", "toetus", "teenus", "noust", "social", "welfare", "benefit", "service",
  "counsell", "counsel", "услуг"
]);

const WEAK_SOCIAL_SUPPORT_EXACT_TOKENS = new Set([
  "abi", "tugi", "help", "support", "care", "помощь", "поддержка"
]);

const SOCIAL_SCOPE_PHRASES = Object.freeze([
  "vaimne tervis", "vaimse tervise", "lapse heaolu",
  "isikliku abistaja", "mental health", "child protection", "domestic violence",
  "social work", "social welfare", "social benefit",
  "психическое здоровье", "защита детей",
  "социальная работа", "социальное обеспечение", "социальная защита",
  "социальная помощь", "социальные услуги"
]);

const INTRINSICALLY_SOCIAL_MODES = new Set([
  "life_situation_guidance",
  "professional_method_guidance",
  "kov_service_and_local_rule"
]);

const POSITIVE_OUT_OF_SCOPE_PATTERNS = Object.freeze([
  /\b(?:ilmaennustus|ilm homme|weather forecast|прогноз погоды)\b/u,
  /\b(?:jalgpalli|korvpalli|hoki|tennise|football|basketball|hockey|tennis)\s+(?:tulemus|seis|skoor|result|score)\b/u,
  /\b(?:aktsia|bitcoin|ethereum|crypto|stock)\s+(?:hind|kurss|price|quote)\b/u,
  /\b(?:retsept|kuidas valmistada|kuidas kupsetada|kuidas küpsetada|recipe|как приготовить)\b/u,
  /\b(?:javascript|typescript|python|react|next\.js|programmeerimine|coding)\s+(?:viga|error|bug|kood|code)\b/u
]);

function inferLexicalSocialScope(text = "") {
  const normalized = String(text || "").trim();
  if (!normalized) {
    return { scope: "unknown", reason: "empty_message" };
  }
  if (SOCIAL_SCOPE_PHRASES.some(phrase => normalized.includes(phrase))) {
    return { scope: "in_scope", reason: "social_scope_phrase" };
  }
  const tokens = normalized.split(/[^\p{Letter}\p{Number}]+/u).filter(Boolean);
  if (tokens.some(token =>
    STRONG_SOCIAL_SCOPE_EXACT_TOKENS.has(token) ||
    STRONG_SOCIAL_SCOPE_TOKEN_PREFIXES.some(prefix => token.startsWith(prefix))
  )) {
    return { scope: "in_scope", reason: "strong_social_scope_term" };
  }
  const hasWeakTarget = tokens.some(token =>
    WEAK_SOCIAL_TARGET_EXACT_TOKENS.has(token) ||
    WEAK_SOCIAL_TARGET_TOKEN_PREFIXES.some(prefix => token.startsWith(prefix))
  );
  const hasWeakSupport = tokens.some(token =>
    WEAK_SOCIAL_SUPPORT_EXACT_TOKENS.has(token) ||
    WEAK_SOCIAL_SUPPORT_TOKEN_PREFIXES.some(prefix => token.startsWith(prefix))
  );
  if (hasWeakTarget && hasWeakSupport) {
    return { scope: "in_scope", reason: "social_target_and_support_terms" };
  }
  if (POSITIVE_OUT_OF_SCOPE_PATTERNS.some(pattern => pattern.test(normalized))) {
    return { scope: "out_of_scope", reason: "positive_non_social_domain_signal" };
  }
  return { scope: "unknown", reason: "no_deterministic_social_signal" };
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

function isSpecificDocumentGuidanceQuestion(text = "", morphology = null) {
  const morphologyRoots = (Array.isArray(morphology?.tokens) ? morphology.tokens : [])
    .flatMap(token => Array.isArray(token?.root_tokens) ? token.root_tokens : [])
    .map(normalizePlannerText)
    .filter(Boolean)
    .join(" ");
  const searchable = `${text} ${morphologyRoots}`.trim();
  const documentSignal = /\b(artikkel|artikli|artiklis|artiklist|dokument|dokumendi|dokumendis|dokumendist|fail|faili|failis|failist|pdf|uuring|uuringu|uuringus|uuringust|aruanne|aruande|aruandes|aruandest|raport|raporti|raportis|raportist|juhend|juhendi|juhendis|juhendist|kasiraamat|kasiraamatu|kasiraamatus|kasiraamatust|juhendmaterjal|juhendmaterjali|tooleht|toolehe|toolehel|tooleht)\b/.test(searchable);
  const guidanceSignal = /\b(kuidas|mida|milline|millised|mis)\b.{0,80}\b(soovitab|kirjeldab|selgitab|utleb|juhendab|alustada|kaituda|teha|arvestada|valtida|rakendada|kasutada|hinnata|abistada|aidata|toetada|sekkuda)\b/.test(text) ||
    /\b(soovitab|kirjeldab|selgitab|utleb|juhendab)\b.{0,80}\b(kuidas|mida|milline|millised|mis)\b/.test(text);
  return documentSignal && guidanceSignal;
}

function professionalMethodGuidanceFocus(text = "", morphologyTerms = []) {
  const searchable = [text, ...morphologyTerms].filter(Boolean).join(" ");
  const resourceLookup = /\b(?:kust|otsi\w*|leia|leida|leian)\b/.test(text) && isResourceDiscoveryQuestion(text);
  const crossSourceOverview = /\b(?:eri|mitm\w*|vordle|ulevaade)\b.{0,30}\b(?:uuring\w*|artikl\w*|allik\w*)\b/.test(text);
  if (resourceLookup || crossSourceOverview || isOverviewSynthesisQuestion(text) || isExplicitJournalSynthesisQuestion(text)) return null;
  const processQuestion = /\b(?:kuidas|mil\w*\s+(?:samm\w*|etapp\w*|meetod\w*)|mida\s+(?:teha|arvestada)|how\s+to)\b/.test(text);
  if (!processQuestion || detectLifeSituation(text)) return null;
  const assessment = /\b(?:hinda\w*|hinna\w*|kaardista\w*|assess\w*)\b/.test(searchable);
  const practicalAction = /\b(?:aita\w*|aida\w*|abista\w*|toeta\w*|sekk\w*|reageeri\w*|nousta\w*|planeeri\w*|rakenda\w*|kasuta\w*|help|support)\b/.test(searchable);
  const socialMethodObject = /\b(?:abivajad\w*|heaolu\w*|hooldusvajad\w*|risk\w*|kaitsetegur\w*|lastekait\w*|juhtumi\w*|sotsiaaltoo\w*|ohvr\w*|\w*vagivall\w*|toimetulek\w*|welfare|wellbeing|victim\w*)\b/.test(searchable);
  if (!socialMethodObject || (!assessment && !practicalAction)) return null;
  if (assessment) return "assessment";
  if (/\b(?:ohvr\w*|\w*vagivall\w*|victim\w*)\b/.test(searchable)) return "victim_support";
  return "practice";
}

const RESEARCH_FACT_SOURCE_RE = /\b([a-z0-9]*uuring[a-z0-9]*|uurimus|uurimuse|uurimuses|uurimusest|artikkel|artikli|artiklis|artiklist|kirjutis|kirjutise|kirjutises|kirjutisest|aruanne|aruande|aruandes|aruandest|raport|raporti|raportis|raportist|seire|seirearuanne|seirearuande|seirearuandes|analuus|analuusi|analuusis|analuusist|kaardistus|kaardistuse|kaardistuses|kusitlus|kusitluse|kusitluses|e\s+kurs[a-z0-9]*)\b/;
const RESEARCH_FACT_SHAPE_RE = /(?:\b(mitu|kui\s+palju|kui\s+suur\s+osa|kui\s+pika\s+aja|arv\w*|aasta\w*|millal|kelle|intervju\w*|valim\w*|osalej\w*|vastaj\w*|meetod\w*|analuusimeetod\w*|jareld\w*|protsent\w*|osakaal\w*|hinnang\w*|soovitus\w*|ettepanek\w*)\b|%)/;
const RESEARCH_FACT_BROAD_RE = /\b(eri|mitme|mitmest|paljude)\s+(uuringute|uurimuste|artiklite|aruannete|raportite|analuuside)\b/;
const RESEARCH_FACT_COMPACT_EXCLUDE_RE = /\b(seadus|paragrahv|maarus|kov|vald|valla|linn|linna|omavalitsus|teenus|teenused|toetus|toetused|kontakt|kontaktid)\b/;
const IMPLICIT_RESEARCH_FACT_OPERATIONAL_RE = /\b(?:praegu|hetkel|tana|kehtiv\p{L}*|teenus\p{L}*|toetus\p{L}*|taotl\p{L}*|kontakt\p{L}*|omavalitsus\p{L}*|vald\p{L}*|kov)\b/u;
const IMPLICIT_RESEARCH_FACT_QUANTITY_RE = /\b(?:mitu|kui\s+(?:palju|tihti|sageli)|millis\p{L}*|nimeta|loetle)\b/u;
const IMPLICIT_RESEARCH_FACT_EVENT_RE = /\b(?:toimu\p{L}*|tegutse\p{L}*|alusta\p{L}*|ulesande\p{L}*|naid\p{L}*|ole\p{L}*|osale\p{L}*|teht\p{L}*)\b/u;
const RESEARCH_FACT_STOP_PREFIXES = Object.freeze([
  "aasta", "analuus", "arv", "artikkel", "artikli", "aruande", "intervju",
  "jareld", "kaardist", "kaasat", "kasutat", "kelle", "kirjeld", "kirjutis", "kokku", "kui", "kusit", "kusitlus", "meetod", "millal",
  "milline", "millised", "mis", "mitu", "naidud", "need", "ning", "oli", "olid", "osakaal", "osalej", "palju", "pohjal", "protsent", "raport",
  "seire", "seotud", "sinna", "teema", "tehakse", "tehti", "tegutse", "uuring", "uurimus", "ulesan", "vaade", "valim", "vastaj", "vorre", "hinnang", "kolm"
]);
const RESEARCH_FACT_SUBJECT_NOISE_RE = /^(?:mida|kohta|kohaselt|sobiv\p{L}*|soovita\p{L}*|selles|neil|nende|kusitud|linnades|maakonnas|omavalitsuses|teenust|inimesi|vabatahtlikku|tootundi|mitmes|neli)$/u;

function compactResearchFactShape(normalized = "", rawInput = "") {
  const rawParts = String(rawInput || "").split(":");
  const [subject = "", facts = "", ...rest] = rawParts.length > 1
    ? rawParts.map(normalizePlannerText)
    : String(normalized || "").split(":");
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

function implicitExplicitValueRelationShape(normalized = "") {
  if (RESEARCH_FACT_COMPACT_EXCLUDE_RE.test(normalized) || RESEARCH_FACT_BROAD_RE.test(normalized)) {
    return false;
  }
  const explicitValues = normalized.match(/(?<![\p{L}\d])\d+(?:[.,]\d+)?(?![\p{L}\d])/gu) || [];
  return explicitValues.length >= 4 &&
    /\b(?:arvudega|numbritega)\b/u.test(normalized) &&
    /\b(?:naitaj|seos)\p{L}*\b/u.test(normalized) &&
    /\b(?:ja|ning)\b/u.test(normalized);
}

function contractedHistoricalCountResearchFactShape(normalized = "") {
  if (RESEARCH_FACT_COMPACT_EXCLUDE_RE.test(normalized) || RESEARCH_FACT_BROAD_RE.test(normalized)) {
    return false;
  }
  return /\b(?:mitu|kui\s+palju|arv\p{L}*)\b/u.test(normalized) &&
    /\b(?:leping|lepingu|lepingus|kokkulepe|kokkuleppe|kokkuleppes)\p{L}*\b/u.test(normalized) &&
    /\b(?:(?:19|20)\d{2}|pidi|lepiti|toimuma|korraldama)\b/u.test(normalized);
}

function organizationRecipientRecommendationResearchFactShape(normalized = "", message = "") {
  if (IMPLICIT_RESEARCH_FACT_OPERATIONAL_RE.test(normalized)) return false;
  const namedAnchors = namedResearchAnchorTerms(message);
  return namedAnchors.length >= 2 &&
    /\b(?:soovitus|soovitusi|soovituse|soovitused|ettepanek|ettepanekuid|jareldus|jareldusi)\p{L}*\b/u.test(normalized) &&
    /\b(?:andis|esitas|tegi|suunas|pakkus)\b/u.test(normalized);
}

function hasNamedTopicAnchor(message = "") {
  const text = String(message || "").replace(/\s+/g, " ").trim();
  if (!text) return false;
  const firstTextIndex = text.search(/\S/u);
  return Array.from(text.matchAll(
    /(?<![\p{L}\p{N}])(?:[A-ZÕÄÖÜŠŽ][\p{L}\p{M}\d'’-]{2,}|[A-ZÕÄÖÜŠŽ]{2,})(?![\p{L}\p{N}])/gu
  )).some(match => {
    const index = Number(match.index);
    const token = normalizePlannerText(match[0]);
    return index > firstTextIndex && !/^(?:milline|millised|mis|mida|kui|mitu|neli|eesti)$/u.test(token);
  });
}

function namedResearchAnchorTerms(message = "") {
  const text = String(message || "").replace(/\s+/gu, " ").trim();
  if (!text) return [];
  const firstTextIndex = text.search(/\S/u);
  return Array.from(new Set(Array.from(text.matchAll(
    /(?<![\p{L}\p{N}])(?:[A-ZÕÄÖÜŠŽ][\p{L}\p{M}\d'’-]{2,}|[A-ZÕÄÖÜŠŽ]{2,})(?![\p{L}\p{N}])/gu
  ))
    .filter(match => Number(match.index) > firstTextIndex)
    .map(match => normalizePlannerText(match[0]))
    .filter(term => term && !/^(?:milline|millised|millistes|mis|mida|kui|mitu|neli|eesti)$/u.test(term))
  )).slice(0, 6);
}

function implicitNamedResearchFactShape(normalized = "", message = "") {
  if (
    IMPLICIT_RESEARCH_FACT_OPERATIONAL_RE.test(normalized) ||
    !IMPLICIT_RESEARCH_FACT_QUANTITY_RE.test(normalized) ||
    !IMPLICIT_RESEARCH_FACT_EVENT_RE.test(normalized)
  ) return false;
  return hasNamedTopicAnchor(message);
}

const BOUNDED_EPISODE_RE = /(?<![\p{L}\p{N}])(?:katseetap\p{L}*|piloot\p{L}*|projekti?etap\p{L}*|etap\p{L}*|voor\p{L}*|faas\p{L}*|pilot\p{L}*|project\s+phase\p{L}*|trial\s+phase\p{L}*|round\p{L}*|phase\p{L}*|пилот\p{L}*|этап\p{L}*|фаз\p{L}*|раунд\p{L}*)(?![\p{L}\p{N}])/u;
const BOUNDED_EPISODE_METRIC_RE = /(?<![\p{L}\p{N}])(?:inimes\p{L}*|osalej\p{L}*|vabatahtlik\p{L}*|tootund\p{L}*|tund\p{L}*|maakon\p{L}*|omavalits\p{L}*|riik\p{L}*|kohtum\p{L}*|juhtum\p{L}*|vastaj\p{L}*|spetsialist\p{L}*|tootaj\p{L}*|people|person\p{L}*|participant\p{L}*|volunteer\p{L}*|hour\p{L}*|count\p{L}*|municipalit\p{L}*|countr\p{L}*|meeting\p{L}*|case\p{L}*|respondent\p{L}*|specialist\p{L}*|worker\p{L}*|человек\p{L}*|участник\p{L}*|волонтер\p{L}*|час\p{L}*|уезд\p{L}*|муниципал\p{L}*|стран\p{L}*|встреч\p{L}*|случа\p{L}*|респондент\p{L}*|специалист\p{L}*|работник\p{L}*)(?![\p{L}\p{N}])/gu;
const BOUNDED_EPISODE_PERIOD_RE = /(?<!\d)(\d{4})\.?\s*(?:(?:-|–|—|kuni|to)\s*(\d{4})\.?|aastast\s+(\d{4})\.?\s+aastani)(?!\d)/u;
const BOUNDED_EPISODE_QUANTITY_CUE_RE = /(?<![\p{L}\p{N}])(?:kui\s+palju|kui\s+suur(?:e|ed)?|mitu|mitmes|mitmesse|mitmest|how\s+(?:many|much|large|big)|number\s+of|count\s+of|сколько|число|количество)(?![\p{L}\p{N}])/gu;
const BOUNDED_EPISODE_MAGNITUDE_CUE_RE = /^(?:kui\s+suur(?:e|ed)?|how\s+(?:large|big))$/u;
const BOUNDED_EPISODE_COUNT_HEAD_RE = /(?<![\p{L}\p{N}])(?:arv\p{L}*|number\p{L}*|count\p{L}*|числ\p{L}*|количеств\p{L}*)(?![\p{L}\p{N}])/u;

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

function boundedEpisodePeriodYearSpans(normalized = "") {
  const match = normalized.match(BOUNDED_EPISODE_PERIOD_RE);
  if (!match || typeof match.index !== "number" || !Number.isInteger(match.index)) return [];
  return Array.from(String(match[0] || "").matchAll(/(?:19\d{2}|20\d{2}|2100)/gu))
    .flatMap(yearMatch => typeof yearMatch.index === "number"
      ? [{
          value: String(yearMatch[0] || ""),
          index: match.index + yearMatch.index
        }]
      : [])
    .slice(0, 2);
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

function boundedEpisodeMetricBridgeIsCoordinated(value = "") {
  const bridge = String(value || "").trim();
  if (!bridge || !/(?:[,;]|(?<![\p{L}\p{N}])(?:ja|ning|voi|and|or|и)(?![\p{L}\p{N}]))/u.test(bridge)) {
    return false;
  }
  return !bridge
    .replace(/(?<![\p{L}\p{N}])(?:ja|ning|voi|and|or|и)(?![\p{L}\p{N}])/gu, "")
    .replace(/[,;]/gu, "")
    .trim();
}

function boundedEpisodeQuantitativeMetricCategories(normalized = "") {
  const quantityCues = Array.from(String(normalized || "").matchAll(BOUNDED_EPISODE_QUANTITY_CUE_RE));
  const categories = new Set();
  for (let index = 0; index < quantityCues.length; index += 1) {
    const cue = quantityCues[index];
    const cueText = String(cue[0] || "");
    const cueEnd = Number(cue.index) + cueText.length;
    const nextCueIndex = quantityCues[index + 1]
      ? Number(quantityCues[index + 1].index)
      : String(normalized || "").length;
    const candidateSegment = String(normalized || "").slice(cueEnd, nextCueIndex);
    const sentenceBoundary = strongSentenceBoundaryIndex(candidateSegment);
    const periodBoundary = candidateSegment.search(BOUNDED_EPISODE_PERIOD_RE);
    const localBoundaries = [sentenceBoundary, periodBoundary].filter(boundary => boundary >= 0);
    const segment = candidateSegment.slice(0, localBoundaries.length ? Math.min(...localBoundaries) : candidateSegment.length);
    if (BOUNDED_EPISODE_MAGNITUDE_CUE_RE.test(cueText) && !BOUNDED_EPISODE_COUNT_HEAD_RE.test(segment)) {
      continue;
    }

    const metricMatches = Array.from(segment.matchAll(BOUNDED_EPISODE_METRIC_RE), match => ({
      category: boundedEpisodeMetricCategory(match[0]),
      index: Number(match.index),
      end: Number(match.index) + String(match[0] || "").length
    })).filter((match, matchIndex, matches) =>
      matches.findIndex(candidate => candidate.category === match.category) === matchIndex
    );
    if (!metricMatches.length) continue;
    if (metricMatches.length > 1 && !metricMatches.slice(1).every((match, matchIndex) =>
      boundedEpisodeMetricBridgeIsCoordinated(
        segment.slice(metricMatches[matchIndex].end, match.index)
      )
    )) {
      continue;
    }
    metricMatches.forEach(match => categories.add(match.category));
  }
  return categories;
}

function boundedEpisodeMetricFactShape(normalized = "", { hasSourceAnchor = false } = {}) {
  if (boundedEpisodePeriodYears(normalized).length !== 2) return false;
  if (!BOUNDED_EPISODE_RE.test(normalized)) return false;
  if (/\b(?:iga\s+aasta|aasta\s+kohta|aastate\s+kaupa|ajatelg|timeline|kronoloog\p{L}*|vordl\p{L}*|vordle\p{L}*|muutus\p{L}*|trend\p{L}*)\b/u.test(normalized)) return false;
  if (/\b(?:praegu|hetkel|tana|kehtiv\p{L}*|seadus\p{L}*|paragrahv\p{L}*|maarus\p{L}*)\b/u.test(normalized)) return false;
  if (!hasSourceAnchor && /\b(?:teenus\p{L}*|toetus\p{L}*|kontakt\p{L}*|telefon\p{L}*|taotl\p{L}*)\b/u.test(normalized)) return false;
  const metricTerms = Array.from(normalized.matchAll(BOUNDED_EPISODE_METRIC_RE), match => match[0]);
  const metricCategories = new Set(metricTerms.map(boundedEpisodeMetricCategory));
  const quantitativeMetricCategories = boundedEpisodeQuantitativeMetricCategories(normalized);
  return metricCategories.size >= 3 && quantitativeMetricCategories.size >= 3;
}

const SEMANTIC_YEAR_SOURCE_CUES = Object.freeze([
  {
    family: "article",
    pattern: /(?<![\p{L}\p{N}])(?:artik(?:kel|l)\p{L}*|kirjutis\p{L}*|article\p{L}*|paper\p{L}*|стат\p{L}*)(?![\p{L}\p{N}])/gu
  },
  {
    family: "report",
    pattern: /(?<![\p{L}\p{N}])(?:[\p{L}\p{N}-]*aruand\p{L}*|[\p{L}\p{N}-]*raport\p{L}*|[\p{L}\p{N}-]*report\p{L}*|[\p{L}\p{N}-]*отч[её]т\p{L}*)(?![\p{L}\p{N}])/gu
  },
  {
    family: "document",
    pattern: /(?<![\p{L}\p{N}])(?:dokumend\p{L}*|publikatsioon\p{L}*|document\p{L}*|publication\p{L}*|документ\p{L}*|публикац\p{L}*)(?![\p{L}\p{N}])/gu
  },
  {
    family: "publication_verb",
    pattern: /(?<![\p{L}\p{N}])(?:ilmus\p{L}*|avaldat\p{L}*|publitseerit\p{L}*|published|released|опубликован\p{L}*|издан\p{L}*)(?![\p{L}\p{N}])/gu
  }
]);

const SEMANTIC_YEAR_EVIDENCE_CUES = Object.freeze([
  {
    family: "study",
    pattern: /(?<![\p{L}\p{N}])(?:[\p{L}\p{N}-]*uuring\p{L}*|uurimus\p{L}*|study|research|исследован\p{L}*)(?![\p{L}\p{N}])/gu
  },
  {
    family: "data",
    pattern: /(?<![\p{L}\p{N}])(?:andme\p{L}*|data|dataset\p{L}*|данн\p{L}*)(?![\p{L}\p{N}])/gu
  },
  {
    family: "sample",
    pattern: /(?<![\p{L}\p{N}])(?:valim\p{L}*|kusitlus\p{L}*|sample\p{L}*|survey\p{L}*|выборк\p{L}*|опрос\p{L}*)(?![\p{L}\p{N}])/gu
  },
  {
    family: "event",
    pattern: /(?<![\p{L}\p{N}])(?:sundmus\p{L}*|event\p{L}*|событи\p{L}*)(?![\p{L}\p{N}])/gu
  },
  {
    family: "decision_or_case",
    pattern: /(?<![\p{L}\p{N}])(?:otsus\p{L}*|juhtum\p{L}*|kohtum\p{L}*|decision\p{L}*|case\p{L}*|meeting\p{L}*|решени\p{L}*|случа\p{L}*|встреч\p{L}*)(?![\p{L}\p{N}])/gu
  },
  {
    family: "project",
    pattern: /(?<![\p{L}\p{N}])(?:projekt\p{L}*|katseetap\p{L}*|etap\p{L}*|faas\p{L}*|project\p{L}*|trial\p{L}*|phase\p{L}*|проект\p{L}*|этап\p{L}*|фаз\p{L}*)(?![\p{L}\p{N}])/gu
  }
]);

const REQUESTED_NUMERIC_SLOT_CUE_RE = /(?<![\p{L}\p{N}])(?:kui\s+mitu\s+protsenti|mitu\s+protsenti|kui\s+suur\s+osa|mis\s+osakaal|kui\s+suur(?:e|ed)?|kui\s+palju|kui\s+kaua|kui\s+pika\s+aja|mitu|mitmes|what\s+(?:percentages?|proportions?|shares?)|how\s+(?:many|much|large|big|long)|сколько\s+процент\p{L}*|какой\s+процент\p{L}*|какая\s+доля|как\s+долго|сколько)(?![\p{L}\p{N}])/gu;
const REQUESTED_QUALITATIVE_SLOT_CUE_RE = /(?<![\p{L}\p{N}])(?:mida|mis|millis\p{L}*|millin\p{L}*|kuidas|millal|kelle|kes|kus|what|which|how|when|whose|who|where|какой|какая|какие|как|когда|чей|чья|чьи|кто|где)(?![\p{L}\p{N}])/gu;
const REQUESTED_SLOT_SHARED_HEAD_RE = /(?:ruhm\p{L}*|kategoor\p{L}*|tase\p{L}*|risk\p{L}*|osakaal\p{L}*|group\p{L}*|categor\p{L}*|level\p{L}*|risk\p{L}*|share\p{L}*|групп\p{L}*|категор\p{L}*|уров\p{L}*|риск\p{L}*)/u;
const REQUESTED_COUNT_RELATION_RE = /(?:^|[^\p{L}\p{N}])(?:inimes\p{L}*|laps\p{L}*|noor\p{L}*|osalej\p{L}*|vastaj\p{L}*|tootaj\p{L}*|spetsialist\p{L}*|kohtum\p{L}*|intervju\p{L}*|vestlus\p{L}*|kohtujuhtum\p{L}*|juhtum\p{L}*|otsus\p{L}*|kokkulep\p{L}*|lahend\p{L}*|telefon\p{L}*|number\p{L}*|riik\p{L}*|maakon\p{L}*|omavalits\p{L}*|people|persons?|children|participants?|respondents?|workers?|specialists?|meetings?|interviews?|cases?|decisions?|agreements?|rulings?|phones?|numbers?|countries|counties|municipalities|человек\p{L}*|ребен\p{L}*|участник\p{L}*|респондент\p{L}*|работник\p{L}*|специалист\p{L}*|встреч\p{L}*|интервью|случа\p{L}*|решени\p{L}*|соглашени\p{L}*|телефон\p{L}*|номер\p{L}*|стран\p{L}*|муниципал\p{L}*)(?=$|[^\p{L}\p{N}])/u;
const REQUESTED_SLOT_RELATION_NOISE_RE = /^(?:aasta\p{L}*|year\p{L}*|год\p{L}*|artikl\p{L}*|kirjutis\p{L}*|aruand\p{L}*|raport\p{L}*|dokumend\p{L}*|uuring\p{L}*|uurimus\p{L}*|study|research|report|article|document|исследован\p{L}*|отч[её]т\p{L}*|стат\p{L}*|mida|mis|millis\p{L}*|millin\p{L}*|kuidas|millal|kelle|kes|kus|kohta|what|which|how|when|whose|who|where|ja|ning|voi|and|or|и|et|that|что|jargi|pohjal|according|oli|olid|on|oeldi|is|are|was|were|nad|they|need|neid|these|those)$/u;
const REQUESTED_ENUMERATION_COUNT_WORDS = new Map([
  ["uks", 1], ["uhe", 1], ["kaks", 2], ["kahe", 2],
  ["kolm", 3], ["kolme", 3], ["neli", 4], ["nelja", 4],
  ["viis", 5], ["viie", 5], ["kuus", 6], ["kuue", 6]
]);

function indexedPlannerMatches(value = "", patterns = []) {
  return patterns.flatMap(({ family, pattern }) =>
    Array.from(String(value || "").matchAll(pattern), match => ({
      family,
      index: Number(match.index),
      end: Number(match.index) + String(match[0] || "").length,
      matched: String(match[0] || "")
    }))
  );
}

function semanticCueDistance(normalized = "", yearMatch = null, cue = null) {
  if (!yearMatch || !cue) return Number.POSITIVE_INFINITY;
  const yearStart = Number(yearMatch.index);
  const yearEnd = yearStart + String(yearMatch[0] || "").length;
  const gapStart = cue.end <= yearStart ? cue.end : yearEnd;
  const gapEnd = cue.end <= yearStart ? yearStart : cue.index;
  const rawGap = String(normalized || "").slice(Math.min(gapStart, gapEnd), Math.max(gapStart, gapEnd));
  const gap = cue.index >= yearEnd
    ? rawGap.replace(/^\.\s*(?=aasta\p{L}*\b)/u, "")
    : rawGap;
  if (gap.length > 64 || /[.;?!]/u.test(gap)) return Number.POSITIVE_INFINITY;
  return gap.length;
}

function strongSentenceBoundaryIndex(value = "") {
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    const punctuation = text[index];
    if (punctuation === "?" || punctuation === "!") return index;
    if (punctuation !== ".") continue;
    const before = text.slice(Math.max(0, index - 4), index);
    const after = text.slice(index + 1);
    const yearOrdinal = /^(?:19\d{2}|20\d{2}|2100)$/u.test(before) && /^\s*aasta\p{L}*\b/u.test(after);
    const decimalPoint = /\d$/u.test(before) && /^\d/u.test(after);
    if (!yearOrdinal && !decimalPoint) return index;
  }
  return -1;
}

function forwardExplicitYearCue(normalized = "", yearMatch = null, sourceCues = [], evidenceCues = []) {
  if (!yearMatch) return null;
  const yearStart = Number(yearMatch.index);
  const yearEnd = yearStart + String(yearMatch[0] || "").length;
  const localText = String(normalized || "").slice(yearStart);
  const sentenceBoundary = strongSentenceBoundaryIndex(localText);
  const sentenceEnd = sentenceBoundary >= 0
    ? yearStart + sentenceBoundary
    : String(normalized || "").length;
  const yearPhrase = String(normalized || "")
    .slice(yearEnd, sentenceEnd)
    .match(/^\.?\s*aasta\p{L}*\b/u);
  if (!yearPhrase) return null;

  const candidates = [
    ...sourceCues.map(cue => ({ ...cue, role: "document_source_year" })),
    ...evidenceCues.map(cue => ({ ...cue, role: "evidence_year" }))
  ]
    .filter(cue => cue.index >= yearEnd && cue.index < sentenceEnd)
    .filter(cue => cue.index - yearEnd <= 64)
    .filter(cue => !/[;]/u.test(String(normalized || "").slice(yearEnd, cue.index)))
    .filter(cue => !/(?<!\d)(?:19\d{2}|20\d{2}|2100)(?!\d)/u.test(
      String(normalized || "").slice(yearEnd, cue.index)
    ))
    .sort((left, right) => left.index - right.index || left.end - right.end);
  if (!candidates.length) return null;

  const firstIndex = candidates[0].index;
  const firstCandidates = candidates.filter(cue => cue.index === firstIndex);
  const compoundReportCue = firstCandidates.find(cue =>
    cue.family === "report" && cue.role === "document_source_year"
  );
  return compoundReportCue || firstCandidates[0];
}

// Keep punctuation only for explicit range binding. The shared lexical view
// deliberately removes dashes, so its offsets cannot identify a year range.
// Transfer roles by mention order; exported spans stay in normalized_question.
function explicitYearRangeRoles(rawInput = "") {
  const text = normalizeRequestedFactText(String(rawInput || "").replace(/−/gu, "-"));
  const years = Array.from(text.matchAll(/(?<!\d)(?:19\d{2}|20\d{2}|2100)(?!\d)/gu));
  const roles = new Map();
  const ranges = [
    ...text.matchAll(/(?<!\d)(19\d{2}|20\d{2}|2100)\s*(?:[-–—]|kuni|to|through)\s*(19\d{2}|20\d{2}|2100)(?!\d)/gu),
    ...text.matchAll(/(?<!\d)(19\d{2}|20\d{2}|2100)\.?\s+aastast\s+(19\d{2}|20\d{2}|2100)\.?\s+aastani(?!\p{L})/gu)
  ];
  for (const range of ranges) {
    const start = range.index;
    const end = start + range[0].length;
    const before = text.slice(Math.max(0, start - 72), start);
    const after = text.slice(end, end + 80);
    // Genitive "aastate" alone is not a period cue: it can govern articles
    // ("aastate 2019–2022 Sotsiaaltöö artiklid") as well as observations.
    const periodPrefix = /(?:^|[^\p{L}])(?:aastatel|aastail|ajavahemikul|perioodil|perioodi|between|during|from|в\s+период|за\s+период|в)\s*$/u.test(before);
    const periodSuffix = /^\s*\.?\s*(?:aastatel|aastail|(?:aasta\s+)?(?:andme\p{L}*|valim\p{L}*|uuring\p{L}*)|годах|годы)(?!\p{L})/u.test(after);
    // Reuse the existing publication-verb vocabulary, including finite verbs
    // (avaldati, ilmusid), with only a local period expression as a bridge.
    const publicationVerbs = indexedPlannerMatches(before, SEMANTIC_YEAR_SOURCE_CUES.filter(cue => cue.family === "publication_verb"));
    const publicationPrefix = publicationVerbs.some(cue => /^\s+(?:(?:aastatel|aastail|aastate|ajavahemikul|perioodil|perioodi|between|during|from|в\s+период|за\s+период|в)\s+)?$/u.test(before.slice(cue.end))) ||
      /(?:^|[^\p{L}])ilmunud\s+(?:(?:aastatel|aastail|aastate|ajavahemikul|perioodil|perioodi|between|during|from|в\s+период|за\s+период|в)\s+)?$/u.test(before);
    const publicationSuffix = /^\s*\.?\s*(?:(?:aasta\p{L}*|years?|год\p{L}*)\s+)?(?:ilmunud|ilmus\p{L}*|avaldat\p{L}*|publitseerit\p{L}*|published|released|опубликован\p{L}*|издан\p{L}*|artikkel|artikl\p{L}*|articles?|aruanne|aruand\p{L}*|raport\p{L}*|reports?|стат\p{L}*|отчет\p{L}*)(?!\p{L})/u.test(after);
    const role = publicationPrefix || publicationSuffix ? "document_source_year"
      : periodPrefix || periodSuffix || /aastast/u.test(range[0]) ? "evidence_year" : null;
    if (!role) continue;
    years.forEach((mention, index) => {
      if (mention.index >= start && mention.index < end) roles.set(index, role);
    });
  }
  return roles;
}

function semanticYearMentions(normalized = "", episodeYearSpans = [], inputForm = "original", rawInput = normalized) {
  const sourceCues = indexedPlannerMatches(normalized, SEMANTIC_YEAR_SOURCE_CUES);
  const evidenceCues = indexedPlannerMatches(normalized, SEMANTIC_YEAR_EVIDENCE_CUES);
  const rangeRoles = explicitYearRangeRoles(rawInput);
  const valueOccurrences = new Map();
  return Array.from(String(normalized || "").matchAll(/(?<!\d)(?:19\d{2}|20\d{2}|2100)(?!\d)/gu), (yearMatch, mentionIndex) => {
    const value = String(yearMatch[0] || "");
    const occurrenceIndex = (valueOccurrences.get(value) || 0) + 1;
    valueOccurrences.set(value, occurrenceIndex);
    const mentionIdentity = {
      mention_index: mentionIndex + 1,
      occurrence_index: occurrenceIndex,
      span_start: Number(yearMatch.index),
      span_end: Number(yearMatch.index) + value.length,
      span_basis: "normalized_question"
    };
    if (rangeRoles.has(mentionIndex)) {
      return { ...mentionIdentity, value, role: rangeRoles.get(mentionIndex), cue_family: null, method: "explicit_year_range", input_form: inputForm };
    }
    if (episodeYearSpans.some(span =>
      span?.value === value &&
      typeof span?.index === "number" &&
      span.index === yearMatch.index
    )) {
      return {
        ...mentionIdentity,
        value,
        role: "evidence_year",
        cue_family: "project",
        method: "bounded_episode_period",
        input_form: inputForm
      };
    }
    const forwardCue = forwardExplicitYearCue(normalized, yearMatch, sourceCues, evidenceCues);
    if (forwardCue) {
      return {
        ...mentionIdentity,
        value,
        role: forwardCue.role,
        cue_family: forwardCue.family,
        method: "forward_explicit_year_cue",
        input_form: inputForm
      };
    }
    const sourceCandidates = sourceCues
      .map(cue => ({ ...cue, distance: semanticCueDistance(normalized, yearMatch, cue) }))
      .filter(cue => Number.isFinite(cue.distance))
      .sort((a, b) => a.distance - b.distance);
    const evidenceCandidates = evidenceCues
      .map(cue => ({ ...cue, distance: semanticCueDistance(normalized, yearMatch, cue) }))
      .filter(cue => Number.isFinite(cue.distance))
      .sort((a, b) => a.distance - b.distance);
    const sourceCue = sourceCandidates[0] || null;
    const evidenceCue = evidenceCandidates[0] || null;
    if (sourceCue && evidenceCue && Math.abs(sourceCue.distance - evidenceCue.distance) <= 8) {
      const compoundReportCue = sourceCue.family === "report" && sourceCue.index === evidenceCue.index;
      if (sourceCue.family === "publication_verb" || compoundReportCue) {
        return {
          ...mentionIdentity,
          value,
          role: "document_source_year",
          cue_family: sourceCue.family,
          method: "nearest_explicit_year_cue",
          input_form: inputForm
        };
      }
      return {
        ...mentionIdentity,
        value,
        role: "ambiguous",
        cue_family: null,
        method: "conflicting_explicit_year_cues",
        input_form: inputForm
      };
    }
    const selectedCue = !evidenceCue || (sourceCue && sourceCue.distance < evidenceCue.distance)
      ? sourceCue
      : evidenceCue;
    if (!selectedCue) {
      return {
        ...mentionIdentity,
        value,
        role: "ambiguous",
        cue_family: null,
        method: "no_explicit_year_cue",
        input_form: inputForm
      };
    }
    return {
      ...mentionIdentity,
      value,
      role: selectedCue === sourceCue ? "document_source_year" : "evidence_year",
      cue_family: selectedCue.family,
      method: "nearest_explicit_year_cue",
      input_form: inputForm
    };
  }).slice(0, 8);
}

const CURRENT_TURN_DOCUMENT_IDENTITY_VERSION = "current_turn_document_identity_v1";
const CURRENT_TURN_DOCUMENT_IDENTITY_SOURCE_CUES = Object.freeze([
  ...SEMANTIC_YEAR_SOURCE_CUES,
  ...SEMANTIC_YEAR_EVIDENCE_CUES.filter(cue => cue.family === "study")
]);
const CURRENT_TURN_DOCUMENT_IDENTITY_AUTHOR_CONNECTOR_RE = /\b(?:according\s+to|described\s+by|written\s+by|authored\s+by|by|kirjeldatud|kirjutas|koostas|autor\p{L}*|artikli\s+jargi|artikli\s+kohaselt|artikli\s+pohjal)\b/iu;
const CURRENT_TURN_DOCUMENT_IDENTITY_PROPER_NAME_RE = /(?<![\p{L}\p{N}])([\p{Lu}][\p{L}'’-]{1,}(?:\s+[\p{Lu}][\p{L}'’-]{1,}){1,3})(?![\p{L}\p{N}])/gu;

function originalTextPlannerMatches(message = "", cues = []) {
  const text = String(message || "");
  return cues.flatMap(cue => {
    const pattern = cue?.pattern instanceof RegExp
      ? new RegExp(cue.pattern.source, "giu")
      : null;
    if (!pattern) return [];
    return Array.from(text.matchAll(pattern), match => ({
      family: cue.family,
      index: Number(match.index),
      end: Number(match.index) + String(match[0] || "").length
    }));
  });
}

function currentTurnDocumentIdentityTitleHint(message = "", hasDocumentCue = false) {
  if (!hasDocumentCue) return null;
  const match = String(message || "").match(/[„“"]([^„“”"\r\n]{3,160})[“”"]/u);
  const value = String(match?.[1] || "").replace(/\s+/gu, " ").trim();
  return value || null;
}

function currentTurnDocumentIdentityAuthors(message = "", documentCues = [], inputForm = "original") {
  const text = String(message || "");
  if (!text || !documentCues.length) return [];
  const quotedTitleSpans = Array.from(
    text.matchAll(/[„“"]([^„“”"\r\n]{3,160})[“”"]/gu),
    match => ({
      start: Number(match.index),
      end: Number(match.index) + String(match[0] || "").length
    })
  ).filter(span => Number.isInteger(span.start) && span.end > span.start);
  const candidates = Array.from(text.matchAll(CURRENT_TURN_DOCUMENT_IDENTITY_PROPER_NAME_RE))
    .map(match => {
      const value = cleanPersonCandidate(match?.[1] || "");
      const start = Number(match.index);
      const end = start + String(match?.[1] || "").length;
      if (!isLikelyPersonCandidate(value) || !Number.isInteger(start)) return null;
      if (quotedTitleSpans.some(span => start < span.end && end > span.start)) return null;
      const nearestCue = documentCues
        .map(cue => ({
          ...cue,
          distance: start >= cue.end ? start - cue.end : cue.index >= end ? cue.index - end : 0
        }))
        .filter(cue => cue.distance <= 96)
        .sort((left, right) => left.distance - right.distance || left.index - right.index)[0] || null;
      if (!nearestCue) return null;
      const bridgeStart = Math.min(end, nearestCue.end);
      const bridgeEnd = Math.max(start, nearestCue.index);
      const bridge = text.slice(bridgeStart, bridgeEnd);
      const confidence = nearestCue.distance <= 48 || CURRENT_TURN_DOCUMENT_IDENTITY_AUTHOR_CONNECTOR_RE.test(bridge)
        ? "high"
        : "medium";
      return {
        value,
        provenance: "explicit_current_turn",
        confidence,
        span_start: start,
        span_end: end,
        input_form: ["original", "canonical_fallback"].includes(inputForm) ? inputForm : null,
        distance: nearestCue.distance,
        cue_index: nearestCue.index
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.distance - right.distance || left.span_start - right.span_start);
  const nearest = candidates[0] || null;
  if (!nearest) return [];
  const bounded = candidates
    .filter(candidate =>
      candidate.cue_index === nearest.cue_index &&
      candidate.distance <= Math.min(96, nearest.distance + 64)
    )
    .sort((left, right) => left.span_start - right.span_start)
    .filter((candidate, index, values) => values.findIndex(item => item.value === candidate.value) === index);
  const nearestIndex = bounded.findIndex(candidate => candidate.value === nearest.value);
  const connectedIndexes = new Set(nearestIndex >= 0 ? [nearestIndex] : []);
  const authorConnector = value => /^\s*(?:(?:,|&)|(?:ja|ning|and))\s*$/iu.test(value);
  for (let index = nearestIndex - 1; index >= 0; index -= 1) {
    const next = bounded[index + 1];
    if (!authorConnector(text.slice(bounded[index].span_end, next.span_start))) break;
    connectedIndexes.add(index);
  }
  for (let index = nearestIndex + 1; index < bounded.length; index += 1) {
    const previous = bounded[index - 1];
    if (!authorConnector(text.slice(previous.span_end, bounded[index].span_start))) break;
    connectedIndexes.add(index);
  }
  const connectedAuthors = bounded.filter((_, index) => connectedIndexes.has(index));
  const connectedConfidence = nearest.confidence;
  return connectedAuthors
    .map(candidate => {
      const { distance: _distance, cue_index: _cueIndex, ...author } = candidate;
      return { ...author, confidence: connectedConfidence };
    });
}

function currentTurnDocumentIdentityCandidate(message = "", inputForm = "original", yearRoleMentions = []) {
  const documentCues = originalTextPlannerMatches(message, CURRENT_TURN_DOCUMENT_IDENTITY_SOURCE_CUES)
    .filter(cue => Number.isInteger(cue.index) && Number.isInteger(cue.end) && cue.end > cue.index)
    .sort((left, right) => left.index - right.index || left.end - right.end)
    .slice(0, 8);
  const authors = currentTurnDocumentIdentityAuthors(message, documentCues, inputForm);
  const author = authors[0] || null;
  const documentKind = documentCues[0]?.family || null;
  const documentSourceYears = (Array.isArray(yearRoleMentions) ? yearRoleMentions : [])
    .filter(mention => mention?.role === "document_source_year")
    .map(mention => String(mention?.value || ""))
    .filter(value => /^(?:19|20)\d{2}$|^2100$/u.test(value))
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 2)
    .map(value => ({
      value,
      role: "document_source_year",
      provenance: "explicit_current_turn"
    }));
  const titleHint = currentTurnDocumentIdentityTitleHint(message, documentCues.length > 0);
  const acronyms = Array.from(new Set(
    Array.from(String(message || "").matchAll(/(?<![\p{L}\p{N}])([\p{Lu}\d][\p{Lu}\d-]{1,})(?![\p{L}\p{N}])/gu))
      .map(match => String(match?.[1] || "").trim())
      .filter(Boolean)
  )).slice(0, 6);
  const titleTokens = Array.from(new Set(
    normalizePlannerText(titleHint || "").split(/\s+/u).filter(token => token.length >= 3)
  )).slice(0, 12);
  const explicitAnchorCount = Number(Boolean(author?.value)) +
    Number(Boolean(documentKind)) +
    documentSourceYears.length +
    Number(Boolean(titleHint)) +
    Number(acronyms.length > 0);
  return {
    version: CURRENT_TURN_DOCUMENT_IDENTITY_VERSION,
    scope: "current_turn",
    history_fallback_policy: "fill_missing_only",
    author: author || {
      value: null,
      provenance: null,
      confidence: null,
      span_start: null,
      span_end: null,
      input_form: null
    },
    authors,
    author_key: author?.value ? normalizePlannerText(author.value) : null,
    author_keys: authors.map(item => normalizePlannerText(item.value)).filter(Boolean),
    organization: {
      value: null,
      provenance: null
    },
    document_kind: {
      value: documentKind,
      provenance: documentKind ? "explicit_current_turn" : null
    },
    document_source_years: documentSourceYears,
    title_hint: {
      value: titleHint,
      provenance: titleHint ? "explicit_current_turn" : null
    },
    title_tokens: titleTokens,
    acronyms,
    named_topics: titleTokens,
    confidence: explicitAnchorCount >= 2 ? "high" : explicitAnchorCount === 1 ? "medium" : "low",
    provenance: explicitAnchorCount ? "explicit_current_turn" : "none",
    explicit_anchor_count: explicitAnchorCount
  };
}

function requestedYearRole(normalized = "", _yearRoleMentions = []) {
  const yearQuestion = /(?:^|[^\p{L}\p{N}])(?:mis\s+aasta(?:l|st)?|millisel\s+aastal|what\s+year|which\s+year|(?:в\s+)?каком\s+году)(?=$|[^\p{L}\p{N}])/u.exec(
    String(normalized || "")
  );
  if (!yearQuestion) return "none";

  const questionStart = Number(yearQuestion.index);
  const firstYearOffset = String(normalized || "").slice(questionStart)
    .search(/(?<!\d)(?:19\d{2}|20\d{2}|2100)(?!\d)/u);
  const prefixEnd = firstYearOffset >= 0
    ? questionStart + firstYearOffset
    : String(normalized || "").length;
  const sourceCues = indexedPlannerMatches(normalized, SEMANTIC_YEAR_SOURCE_CUES)
    .filter(cue => cue.index >= questionStart && cue.index < prefixEnd);
  const evidenceCues = indexedPlannerMatches(normalized, SEMANTIC_YEAR_EVIDENCE_CUES)
    .filter(cue => cue.index >= questionStart && cue.index < prefixEnd);
  if (sourceCues.length && !evidenceCues.length) return "publication_year";
  if (evidenceCues.length && !sourceCues.length) return "evidence_year";

  return "ambiguous";
}

function currentEvidenceScope(normalized = "", mode = "default") {
  if (mode === "professional_method_guidance" || currentStatusEvidenceRequested(normalized)) {
    return "current";
  }
  if (["specific_research_fact", "specific_document_question", "specific_document_summary", "person_source_lookup"].includes(mode)) {
    return "source_bounded";
  }
  return null;
}

function requestedNumericSlotValueType(cue = "", segment = "", inheritedType = null) {
  if (/(?:kui\s+kaua|kui\s+pika\s+aja|how\s+long|как\s+долго)/u.test(cue)) {
    return { valueType: "duration", inherited: false };
  }
  if (/(?:protsent|osakaal|suur\s+osa|percentage|proportion|share|процент|доля)/u.test(`${cue} ${segment}`) || /%/u.test(segment)) {
    return { valueType: "proportion", inherited: false };
  }
  if (/(?:mitu|mitmes|how\s+many|сколько)/u.test(cue)) {
    return { valueType: "count", inherited: false };
  }
  if (/(?:kui\s+palju|how\s+much)/u.test(cue) && REQUESTED_COUNT_RELATION_RE.test(segment)) {
    return { valueType: "count", inherited: false };
  }
  if (
    /(?:kui\s+palju|how\s+much)/u.test(cue) &&
    inheritedType &&
    /^(?:\s*(?:kokku|neist|sealhulgas|in\s+total|of\s+them|всего|из\s+них)\b|\s*$)/u.test(segment)
  ) {
    return { valueType: inheritedType, inherited: true };
  }
  if (/(?:kui\s+suur(?:e|ed)?|how\s+(?:large|big))/u.test(cue) && inheritedType === "proportion") {
    return { valueType: "proportion", inherited: true };
  }
  if (/(?:kui\s+suur(?:e|ed)?|how\s+(?:large|big))/u.test(cue)) {
    return { valueType: "magnitude", inherited: false };
  }
  return { valueType: "amount", inherited: false };
}

function requestedSlotRelationTerms(value = "", limit = 8) {
  return Array.from(new Set(
    (normalizePlannerText(value).match(/[\p{L}\p{N}-]+/gu) || [])
      .filter(token =>
        token.length >= 3 &&
        !/^\d+(?:[.,]\d+)?$/u.test(token) &&
        !REQUESTED_SLOT_RELATION_NOISE_RE.test(token)
      )
  )).slice(0, Math.max(1, Number(limit) || 8));
}

function requestedSlotMorphologyVariants(relationTerms = [], morphology = null) {
  const requestedTerms = new Set((Array.isArray(relationTerms) ? relationTerms : [])
    .map(normalizePlannerText)
    .filter(Boolean));
  if (!requestedTerms.size) return [];
  const variantsByTerm = new Map();
  for (const token of Array.isArray(morphology?.tokens) ? morphology.tokens : []) {
    const surface = normalizePlannerText(token?.surface || "");
    if (!requestedTerms.has(surface)) continue;
    const variants = Array.from(new Set([
      ...(Array.isArray(token?.lemmas) ? token.lemmas : []),
      ...(Array.isArray(token?.root_tokens) ? token.root_tokens : [])
    ].map(normalizePlannerText).filter(value =>
      value &&
      value !== surface &&
      value.length >= 3 &&
      !/^\d+(?:[.,]\d+)?$/u.test(value) &&
      !REQUESTED_SLOT_RELATION_NOISE_RE.test(value)
    ))).slice(0, 6);
    if (variants.length) variantsByTerm.set(surface, variants);
  }
  return Array.from(variantsByTerm, ([term, variants]) => ({ term, variants })).slice(0, 8);
}

function enrichRequestedFactSlotsWithMorphology(requested = null, morphology = null) {
  if (!requested || typeof requested !== "object") return requested;
  const slots = (Array.isArray(requested.slots) ? requested.slots : []).map(slot => {
    const relationTerms = Array.isArray(slot?.relation_terms) ? slot.relation_terms : [];
    const relationTermVariants = requestedSlotMorphologyVariants(relationTerms, morphology);
    return relationTermVariants.length
      ? { ...slot, relation_term_variants: relationTermVariants }
      : slot;
  });
  return { ...requested, slots };
}

function coordinatedRequestedSlotRelations(segment = "") {
  const cleaned = normalizePlannerText(segment).replace(/[\s,;:.!?]+$/gu, "").trim();
  const match = cleaned.match(/\b([\p{L}-]{3,})\s+(?:ja|ning|voi|and|or|и)\s+([\p{L}-]{3,})\s+((?:[\p{L}-]+\s*){1,5})$/u);
  if (!match || !REQUESTED_SLOT_SHARED_HEAD_RE.test(match[3])) return null;
  const prefix = cleaned.slice(0, Number(match.index)).trim();
  return [
    `${prefix} ${match[1]} ${match[3]}`,
    `${prefix} ${match[2]} ${match[3]}`
  ];
}

function coordinatedRequestedCountRelations(segment = "") {
  const cleaned = normalizePlannerText(segment)
    .replace(/(?:[,;]\s*)?(?:ja|ning|and|и)\s*$/u, "")
    .replace(/[\s,;:.!?]+$/gu, "")
    .trim();
  const conjunctions = Array.from(cleaned.matchAll(/\s+(?:ja|ning|and|or|и)\s+/gu)).reverse();
  for (const conjunction of conjunctions) {
    if (!Number.isInteger(Number(conjunction.index))) continue;
    const left = cleaned.slice(0, Number(conjunction.index)).trim();
    const rightWithContext = cleaned.slice(
      Number(conjunction.index) + String(conjunction[0] || "").length
    ).trim();
    const predicate = rightWithContext.match(
      /\s+(?:oli\p{L}*|on\p{L}*|osale\p{L}*|toimu\p{L}*|tehti|teevad|tegi|joud\p{L}*|kasuta\p{L}*|analuusi\p{L}*|vaadel\p{L}*|parine\p{L}*|was|were|are|is|participat\p{L}*|attend\p{L}*|occur\p{L}*|held|made|analys\p{L}*|бы\p{L}*|участв\p{L}*|провед\p{L}*|анализ\p{L}*)\b/u
    );
    if (!predicate || !Number.isInteger(Number(predicate.index))) continue;
    const right = rightWithContext.slice(0, Number(predicate.index)).trim();
    const sharedContext = rightWithContext.slice(Number(predicate.index)).trim();
    if (
      !left ||
      !right ||
      !sharedContext ||
      !REQUESTED_COUNT_RELATION_RE.test(left) ||
      !REQUESTED_COUNT_RELATION_RE.test(right)
    ) continue;
    return [`${left} ${sharedContext}`, `${right} ${sharedContext}`];
  }
  return null;
}

function coordinatedRequestedQualitativeRelations(segment = "") {
  const cleaned = normalizePlannerText(segment).replace(/[\s,;:.!?]+$/gu, "").trim();
  const conjunction = cleaned.match(/\s+(?:ja|ning)\s+nende\s+/u);
  if (!conjunction || !Number.isInteger(Number(conjunction.index))) return null;
  const left = cleaned.slice(0, Number(conjunction.index)).trim();
  const right = cleaned.slice(
    Number(conjunction.index) + String(conjunction[0] || "").length
  ).replace(/\s+kohta$/u, "").trim();
  if (
    requestedSlotRelationTerms(left).length < 2 ||
    requestedSlotRelationTerms(right).length < 2
  ) return null;
  return [left, right];
}

function requestedSegmentExpectedCardinality(segment = "") {
  const normalized = normalizePlannerText(segment);
  const numeric = normalized.match(/\bigas\s+(\d{1,2})\s+(?:[\p{L}-]+\s+){0,3}(?:ruhm\p{L}*|kategoor\p{L}*)\b/u);
  if (numeric) return Number(numeric[1]);
  const word = normalized.match(
    /\bigas\s+(uks|uhes|uhe|kaks|kahes|kahe|kolm|kolmes|kolme|neli|neljas|nelja|viis|viies|viie|kuus|kuues|kuue)\s+(?:[\p{L}-]+\s+){0,3}(?:ruhm\p{L}*|kategoor\p{L}*)\b/u
  );
  if (!word) return null;
  return ({
    uks: 1, uhes: 1, uhe: 1,
    kaks: 2, kahes: 2, kahe: 2,
    kolm: 3, kolmes: 3, kolme: 3,
    neli: 4, neljas: 4, nelja: 4,
    viis: 5, viies: 5, viie: 5,
    kuus: 6, kuues: 6, kuue: 6
  })[word[1]] || null;
}

function coordinatedRequestedAlternativeRelations(segment = "", { hasFollowingNumericCue = false } = {}) {
  let cleaned = normalizePlannerText(segment).replace(/[\s,;:.!?]+$/gu, "").trim();
  if (hasFollowingNumericCue) {
    cleaned = cleaned
      .replace(/(?:[,;]\s*)?(?:ja|ning|and|и)\s*$/u, "")
      .replace(/[\s,;:.!?]+$/gu, "")
      .trim();
  }
  const separators = Array.from(cleaned.matchAll(/\s+(?:voi|or|или)\s+/gu));
  if (separators.length !== 1) return null;
  const separator = separators[0];
  const separatorStart = Number(separator.index);
  const left = cleaned.slice(0, separatorStart).trim();
  const right = cleaned.slice(separatorStart + String(separator[0] || "").length).trim();
  if (!left || !right || /[,;:.!?]/u.test(right)) return null;
  const leftTerms = requestedSlotRelationTerms(left, 24);
  const rightTerms = requestedSlotRelationTerms(right);
  if (leftTerms.length < 2 || rightTerms.length < 2 || rightTerms.length > 5) return null;
  const leftHead = left.match(/([\p{L}-]{3,})\s*$/u)?.[1] || "";
  const rightHead = right.match(/([\p{L}-]{3,})\s*$/u)?.[1] || "";
  if (!leftHead || leftHead !== rightHead || REQUESTED_SLOT_RELATION_NOISE_RE.test(leftHead)) return null;
  const leftBranchTerms = leftTerms.slice(-2);
  const alternativePredicateRe = /^(?:(?:on|oli|oleb|saab|sai|vajab|vajas|tundis|tunneb|teeb|tegi|kasutab|kasutas|toetab)|(?:is|are|was|were|has|had|needs|needed|wants|wanted|uses|used|receives|received|asks|asked|sought)|(?:есть|был\p{L}*|нужда\p{L}*|получа\p{L}*|использ\p{L}*))$|(?:b|vad|sid|sin|sime|site|nud|tud)$/u;
  if (
    leftBranchTerms.length !== 2 ||
    leftBranchTerms.some(term => alternativePredicateRe.test(term)) ||
    rightTerms.some(term => alternativePredicateRe.test(term))
  ) return null;
  const sharedContextTerms = leftTerms.slice(0, -leftBranchTerms.length).slice(-6);
  return [
    [...leftBranchTerms, ...sharedContextTerms].join(" "),
    [...rightTerms, ...sharedContextTerms].join(" ")
  ];
}

function requestedProportionEnumerationCount(prefix = "", rawPrefix = "") {
  const boundedPrefix = rawPrefix
    ? normalizePlannerText(String(rawPrefix || "").replace(
        /\b((?:19|20)\d{2})\.\s+(?=aasta\p{L}*\b)/gu,
        "$1 "
      ))
    : String(prefix || "");
  if (!/\b(?:millis\p{L}*|nimeta\p{L}*|loetle\p{L}*)\b/u.test(boundedPrefix)) return null;
  const match = boundedPrefix.match(
    /\b(\d{1,2}|uks|uhe|kaks|kahe|kolm|kolme|neli|nelja|viis|viie|kuus|kuue)\b(?=(?:\s+[\p{L}\p{N}-]+){0,8}\s+protsenti\b)/u
  );
  if (!match) return null;
  const numeric = Number(match[1]);
  const expectedCount = Number.isInteger(numeric)
    ? numeric
    : REQUESTED_ENUMERATION_COUNT_WORDS.get(match[1]);
  return Number.isInteger(expectedCount) && expectedCount > 0 && expectedCount <= 12
    ? expectedCount
    : null;
}

function splitRequestedEnumerationClauses(value = "") {
  const initial = normalizePlannerText(value)
    .replace(/[\s.?!]+$/gu, "")
    .split(/\s*[,;]\s*/u)
    .map(part => part.trim())
    .filter(Boolean);
  return initial.flatMap(part => {
    for (const conjunction of part.matchAll(/\s+(?:ning|ja|and|or|и)\s+/gu)) {
      const start = Number(conjunction.index);
      const end = start + String(conjunction[0] || "").length;
      const left = part.slice(0, start).trim();
      const right = part.slice(end).trim();
      if (
        requestedSlotRelationTerms(left).length &&
        coordinatedRequestedSlotRelations(right)
      ) {
        return [left, right];
      }
    }
    return [part];
  });
}

function extractRequestedProportionEnumeration(normalized = "", inputForm = "original", rawInput = "") {
  const rawColonIndex = String(rawInput || "").indexOf(":");
  const normalizedColonIndex = String(normalized || "").indexOf(":");
  if (rawColonIndex < 0 && normalizedColonIndex < 0) return null;
  const rawPrefix = rawColonIndex >= 0 ? String(rawInput || "").slice(0, rawColonIndex) : "";
  const prefix = rawColonIndex >= 0
    ? normalizePlannerText(rawPrefix)
    : normalized.slice(0, normalizedColonIndex);
  const expectedSlotCount = requestedProportionEnumerationCount(prefix, rawPrefix);
  if (!expectedSlotCount) return null;
  const rawFacts = rawColonIndex >= 0 ? String(rawInput || "").slice(rawColonIndex + 1) : "";
  const facts = rawColonIndex >= 0
    ? normalizePlannerText(rawFacts)
    : normalized.slice(normalizedColonIndex + 1);
  const clauses = splitRequestedEnumerationClauses(facts);
  const slots = [];
  let unresolvedClauseCount = 0;
  let coordinationGroup = 0;
  for (const clause of clauses) {
    const coordinatedRelations = coordinatedRequestedSlotRelations(clause);
    const relationParts = coordinatedRelations || [clause];
    if (coordinatedRelations) coordinationGroup += 1;
    let resolvedPartCount = 0;
    for (const relationPart of relationParts) {
      const relationTerms = requestedSlotRelationTerms(relationPart);
      if (!relationTerms.length) continue;
      resolvedPartCount += 1;
      slots.push({
        index: slots.length + 1,
        value_type: "proportion",
        relation_terms: relationTerms,
        derivation: coordinatedRelations ? "coordinated_shared_head" : "enumerated_clause",
        coordination_group: coordinatedRelations ? coordinationGroup : null,
        value_type_source: "enumerated_proportion_cue",
        input_form: inputForm
      });
    }
    if (resolvedPartCount !== relationParts.length) unresolvedClauseCount += 1;
  }
  const truncated = slots.length > 12;
  const emittedSlots = slots.slice(0, 12);
  const expectedCountMismatch = emittedSlots.length !== expectedSlotCount;
  const expectedCountDelta = Math.abs(emittedSlots.length - expectedSlotCount);
  return {
    complete: unresolvedClauseCount === 0 && !truncated && !expectedCountMismatch,
    recognized_clause_count: clauses.length,
    emitted_slot_count: emittedSlots.length,
    unresolved_clause_count: Math.max(unresolvedClauseCount, expectedCountDelta),
    truncated,
    slots: emittedSlots
  };
}

function extractRequestedNumericSlots(normalized = "", inputForm = "original", rawInput = "") {
  const enumeratedProportions = extractRequestedProportionEnumeration(normalized, inputForm, rawInput);
  if (enumeratedProportions) return enumeratedProportions;
  const cueMatches = Array.from(String(normalized || "").matchAll(REQUESTED_NUMERIC_SLOT_CUE_RE));
  const slots = [];
  let unresolvedClauseCount = 0;
  let recognizedClauseCount = 0;
  let previousExplicitType = null;
  let coordinationGroup = 0;
  for (let index = 0; index < cueMatches.length; index += 1) {
    const cueMatch = cueMatches[index];
    const nextCue = cueMatches[index + 1];
    const cue = String(cueMatch[0] || "");
    const cueEnd = Number(cueMatch.index) + cue.length;
    const nextCueIndex = nextCue ? Number(nextCue.index) : normalized.length;
    const candidateSegment = normalized.slice(cueEnd, nextCueIndex);
    const sentenceBoundary = strongSentenceBoundaryIndex(candidateSegment);
    const followingQuestionCue = candidateSegment.search(
      /(?:(?:[,;]\s*)(?:(?:ning|ja|and|и)\s+)?|\s+(?:ning|ja|and|и)\s+)(?:mis|mida|millis\p{L}*|millin\p{L}*|kuidas|millal|kelle|kes|kus|what|which|how|when|whose|who|where|какой|какая|какие|как|когда|чей|чья|чьи|кто|где)\b/u
    );
    const localBoundary = [sentenceBoundary, followingQuestionCue]
      .filter(value => value >= 0)
      .reduce((minimum, value) => Math.min(minimum, value), nextCueIndex - cueEnd);
    const segmentEnd = cueEnd + localBoundary;
    const segment = normalized.slice(cueEnd, segmentEnd);
    const previousCueEnd = index > 0
      ? Number(cueMatches[index - 1].index) + String(cueMatches[index - 1][0] || "").length
      : null;
    const bridgeStart = Math.max(previousCueEnd || 0, Number(cueMatch.index) - 24);
    const parallelBridge = previousCueEnd === null
      ? ""
      : normalized.slice(bridgeStart, Number(cueMatch.index));
    const directParallelRelation = /(?:[,;]\s*)?(?:ja|ning|voi|and|or|и)\s*$/u.test(parallelBridge);
    const provisionalInheritedType = directParallelRelation ? previousExplicitType : null;
    const directValueType = requestedNumericSlotValueType(cue, segment, provisionalInheritedType).valueType;
    const alternativeRelations = directValueType === "proportion"
      ? coordinatedRequestedAlternativeRelations(segment, {
          hasFollowingNumericCue: Boolean(nextCue) && sentenceBoundary < 0
        })
      : null;
    const coordinatedRelations = alternativeRelations ||
      (directValueType === "count" ? coordinatedRequestedCountRelations(segment) : null) ||
      coordinatedRequestedSlotRelations(segment) ||
      coordinatedRequestedLocationRelations(segment);
    const inheritedType = directParallelRelation ? previousExplicitType : null;
    const { valueType, inherited } = requestedNumericSlotValueType(cue, segment, inheritedType);
    if (!inherited) previousExplicitType = valueType;
    const relationParts = coordinatedRelations || [segment];
    recognizedClauseCount += 1;
    if (coordinatedRelations) coordinationGroup += 1;
    let resolvedPartCount = 0;
    for (const relationPart of relationParts) {
      const relationTerms = requestedSlotRelationTerms(relationPart);
      if (!relationTerms.length) continue;
      resolvedPartCount += 1;
      slots.push({
        index: slots.length + 1,
        span_start: Number(cueMatch.index),
        value_type: valueType,
        relation_terms: relationTerms,
        scope_values: requestedSlotScopeValues(relationPart),
        expected_cardinality: requestedSegmentExpectedCardinality(relationPart),
        derivation: coordinatedRelations
          ? "coordinated_shared_head"
          : inherited
            ? "parallel_type_inheritance"
            : "explicit_clause",
        coordination_group: coordinatedRelations ? coordinationGroup : null,
        value_type_source: inherited ? "parallel_inheritance" : "explicit_cue",
        input_form: inputForm
      });
    }
    if (resolvedPartCount !== relationParts.length) unresolvedClauseCount += 1;
  }
  const truncated = slots.length > 12;
  const emittedSlots = slots.slice(0, 12).map((slot, index, values) => {
    const genericProportionRelation =
      slot.value_type === "proportion" &&
      slot.relation_terms.length > 0 &&
      slot.relation_terms.every(term => /^(?:osakaal|protsent|share|proportion)$/u.test(term));
    const nextSlot = values[index + 1];
    if (genericProportionRelation && nextSlot?.value_type === "count" && nextSlot.relation_terms?.length) {
      return {
        ...slot,
        relation_terms: [...nextSlot.relation_terms],
        scope_values: Array.isArray(nextSlot.scope_values) ? [...nextSlot.scope_values] : [],
        relation_terms_source: "paired_count_clause"
      };
    }
    return slot;
  });
  return {
    complete: unresolvedClauseCount === 0 && !truncated && emittedSlots.length >= recognizedClauseCount,
    recognized_clause_count: recognizedClauseCount,
    emitted_slot_count: emittedSlots.length,
    unresolved_clause_count: unresolvedClauseCount,
    truncated,
    slots: emittedSlots
  };
}

function coordinatedRequestedLocationRelations(segment = "") {
  const cleaned = normalizePlannerText(segment).replace(/[\s,;:.!?]+$/gu, "").trim();
  const match = cleaned.match(/^([\p{L}-]{4,})\s+(?:ja|ning|and|or|и)\s+([\p{L}-]{4,})(\s+[\s\S]+)$/u);
  if (!match) return null;
  const locationPair = /(?:maakond|omavalits|county|municipal|регион|муниципал)/u;
  if (!locationPair.test(match[1]) || !locationPair.test(match[2])) return null;
  return [`${match[1]}${match[3]}`, `${match[2]}${match[3]}`];
}

const REQUESTED_FACT_CARDINALITY_WORDS = Object.freeze({
  uks: 1, uhe: 1, kaks: 2, kahe: 2, kolm: 3, kolme: 3, neli: 4, nelja: 4,
  viis: 5, viie: 5, kuus: 6, kuue: 6, seitse: 7, seitsme: 7,
  kaheksa: 8, uheksa: 9, kumme: 10, kumnet: 10
});

function requestedFactExpectedCardinality(normalized = "") {
  const numeric = normalized.match(/\b(\d{1,2})\s+(?:nait\p{L}*|ulesan\p{L}*|osakaal\p{L}*|protsent\p{L}*|teema\p{L}*|punkt\p{L}*|tulemus\p{L}*)\b/u);
  if (numeric) return Number(numeric[1]);
  const word = normalized.match(/\b(uks|uhe|kaks|kahe|kolm|kolme|neli|nelja|viis|viie|kuus|kuue|seitse|seitsme|kaheksa|uheksa|kumme|kumnet)\s+(?:nait\p{L}*|ulesan\p{L}*|osakaal\p{L}*|protsent\p{L}*|teema\p{L}*|punkt\p{L}*|tulemus\p{L}*)\b/u);
  return word ? REQUESTED_FACT_CARDINALITY_WORDS[word[1]] || null : null;
}

function requestedFactValueType(normalized = "") {
  if (/%|\b(?:protsent|osakaal)\p{L}*\b/u.test(normalized)) return "proportion";
  if (/\b(?:summa|euro|maksumus|hind(?!am)|tasu)\p{L}*\b/u.test(normalized)) return "amount";
  if (/\b(?:kuupaev|mis kuupaeval)\p{L}*\b/u.test(normalized)) return "date";
  if (/\b(?:mis kuul|millisel kuul)\b/u.test(normalized)) return "month";
  if (/\b(?:aastaaeg|kevadel|suvel|sugisel|talvel)\b/u.test(normalized)) return "season";
  if (/\b(?:mis\s+aasta(?:l|st)?|millisel\s+aastal|millise\s+aasta)\b/u.test(normalized)) return "calendar_year";
  if (/\b(?:millal|mis ajal|ajapunkt)\p{L}*\b/u.test(normalized)) return "timepoint";
  if (/\b(?:kui kaua|kui pika aja|kestus|paev|nadal|kuu)\p{L}*\b/u.test(normalized)) return "duration";
  if (/\b(?:kus|millises kohas|asukoht)\p{L}*\b/u.test(normalized)) return "location";
  if (/\b(?:kes|kelle|roll|amet)\p{L}*\b/u.test(normalized)) return "person_role";
  if (/\b(?:organisatsioon|asutus|uhing|koda|keskus)\p{L}*\b/u.test(normalized)) return "organization";
  if (/\b(?:kuidas\s+jagunes|jaotus|jagunesid)\p{L}*\b/u.test(normalized)) return "distribution";
  if (/\b(?:meetod|metoodika|analuus\p{L}*|kuidas uuriti|andmeid koguti)\p{L}*\b/u.test(normalized)) return "method";
  if (/\b(?:soovitus|ettepanek)\p{L}*\b/u.test(normalized)) return "recommendation";
  if (/\b(?:mitu|kui palju|arv|loendus)\p{L}*\b/u.test(normalized)) return "count";
  if (/\b(?:loetle|nimeta|millis\p{L}*|millin\p{L}*|mis olid)\b/u.test(normalized)) return "entity_list";
  if (/\b(?:kui suur|maht|ulatus)\p{L}*\b/u.test(normalized)) return "magnitude";
  if (/\b(?:milline|mis kategooria|liik)\p{L}*\b/u.test(normalized)) return "category";
  return "text_relation";
}

function requestedQualitativeMinimumAnswerItems(cue = "", relation = "", valueType = "") {
  const normalized = normalizePlannerText(`${cue} ${relation}`);
  if (
    valueType === "person_role" &&
    /\b(?:vorr\p{L}*|compare\p{L}*|сравн\p{L}*)\b/u.test(normalized)
  ) return 2;
  if (
    valueType === "entity_list" &&
    (
      /\b(?:telefoninumb\p{L}*|phone\s+numbers?|номер\p{L}*\s+телефон\p{L}*)\b/u.test(normalized) ||
      /\bmillis(?:ed|eid|tele|tega|tesse|test)\b/u.test(normalized)
    )
  ) return 2;
  return 1;
}

function requestedFactModality(normalized = "") {
  if (/\b(?:plaaniti|kavandati|kavatseti|plaanis)\b/u.test(normalized)) return "planned";
  if (/\b(?:lepiti kokku|leping|kokkulepe)\p{L}*\b/u.test(normalized)) return "contracted";
  if (/\b(?:toimus|tehti|korraldati|avati|loodi|osales)\p{L}*\b/u.test(normalized)) return "occurred";
  if (/\b(?:teatati|raporteeriti|kirjeldati|tulemused)\p{L}*\b/u.test(normalized)) return "reported";
  if (/\b(?:hinnati|prognoositi|arvati)\p{L}*\b/u.test(normalized)) return "estimated";
  return "unspecified";
}

function extractRequestedQualitativeSlots(normalized = "", inputForm = "original") {
  const numericCueStarts = new Set(
    Array.from(String(normalized || "").matchAll(REQUESTED_NUMERIC_SLOT_CUE_RE), match => Number(match.index))
  );
  const qualitativeCues = Array.from(
    String(normalized || "").matchAll(REQUESTED_QUALITATIVE_SLOT_CUE_RE)
  ).filter(match => !numericCueStarts.has(Number(match.index)));
  const allCueStarts = Array.from(new Set([
    ...qualitativeCues.map(match => Number(match.index)),
    ...numericCueStarts
  ])).sort((left, right) => left - right);
  const emittedByCue = qualitativeCues.map(match => {
    const cueStart = Number(match.index);
    const cue = String(match[0] || "");
    const cueEnd = cueStart + cue.length;
    const nextCueStart = allCueStarts.find(index => index > cueStart) ?? normalized.length;
    const candidateSegment = normalized.slice(cueEnd, nextCueStart);
    const sentenceBoundary = strongSentenceBoundaryIndex(candidateSegment);
    const segmentEnd = sentenceBoundary >= 0 ? cueEnd + sentenceBoundary : nextCueStart;
    const segment = normalized.slice(cueEnd, segmentEnd)
      .replace(/^[\s,;]+(?:ja|ning|and|or|и)\s+/u, "")
      .replace(/[\s,;:.!?]+$/gu, "")
      .trim();
    const requestedClause = `${cue} ${segment}`;
    const relationTerms = requestedSlotRelationTerms(requestedClause);
    if (!relationTerms.length) return [];
    const ellipsisDistributionMatch = requestedClause.match(
      /\bkuidas\s+jagunes\p{L}*\s+([\p{L}]+)-\s+(?:ja|ning)\s+([\p{L}-]+)/u
    );
    if (ellipsisDistributionMatch) {
      const sharedHead = ellipsisDistributionMatch[2].match(
        /(?:intervju\p{L}*|vestlus\p{L}*|kohtum\p{L}*)$/u
      )?.[0] || "";
      const branches = [
        `${ellipsisDistributionMatch[1]}${sharedHead}`.trim(),
        ellipsisDistributionMatch[2]
      ];
      return branches.map((branch, index) => ({
        index: 0,
        span_start: cueStart + index,
        value_type: "count",
        relation_terms: requestedSlotRelationTerms(branch),
        derivation: "distribution_ellipsis_branch",
        coordination_group: cueStart + 1,
        value_type_source: "distribution_clause",
        input_form: inputForm
      }));
    }
    const distributionMatch = requestedClause.match(
      /\bkuidas\s+jagunes\p{L}*\s+([\p{L}-]{4,})\s+(?:ja|ning)\s+([\p{L}-]{4,})/u
    );
    if (distributionMatch) {
      return [distributionMatch[1], distributionMatch[2]].map((branch, index) => ({
        index: 0,
        span_start: cueStart + index,
        value_type: "count",
        relation_terms: requestedSlotRelationTerms(branch),
        derivation: "distribution_branch",
        coordination_group: cueStart + 1,
        value_type_source: "distribution_clause",
        input_form: inputForm
      }));
    }
    const coordinatedRelations = coordinatedRequestedQualitativeRelations(segment);
    const relationParts = coordinatedRelations || [requestedClause];
    return relationParts.flatMap((relationPart, index) => {
      const partTerms = requestedSlotRelationTerms(relationPart);
      if (!partTerms.length) return [];
      const valueType = requestedFactValueType(`${cue} ${relationPart}`);
      return [{
        index: 0,
        span_start: cueStart + index,
        value_type: valueType,
        relation_terms: partTerms,
        minimum_answer_items: requestedQualitativeMinimumAnswerItems(cue, relationPart, valueType),
        derivation: coordinatedRelations ? "coordinated_qualitative_clause" : "qualitative_clause",
        coordination_group: coordinatedRelations ? cueStart + 1 : null,
        value_type_source: "explicit_qualitative_cue",
        input_form: inputForm
      }];
    });
  });
  const extracted = emittedByCue.flat();
  let inheritedRecommendation = false;
  const slots = extracted.map(slot => {
    if (slot.value_type === "recommendation") {
      inheritedRecommendation = true;
      return slot;
    }
    if (
      inheritedRecommendation &&
      ["category", "entity_list", "text_relation"].includes(slot.value_type)
    ) {
      return {
        ...slot,
        value_type: "recommendation",
        value_type_source: "parallel_qualitative_inheritance"
      };
    }
    inheritedRecommendation = false;
    return slot;
  });
  const unresolvedClauseCount = emittedByCue.filter(items => items.length === 0).length;
  return {
    complete: unresolvedClauseCount === 0,
    recognized_clause_count: qualitativeCues.length,
    emitted_slot_count: slots.length,
    unresolved_clause_count: unresolvedClauseCount,
    slots
  };
}

function maskQuotedDocumentTitles(value = "") {
  return String(value || "").replace(
    /[„“"][^„“”"\r\n]{3,160}[”"]/gu,
    match => " ".repeat(match.length)
  );
}

function normalizeQuestionNumericValue(value = "") {
  return String(value || "").replace(/\s+/gu, "").replace(",", ".").replace(/%$/u, "");
}

function requestedSlotScopeValues(value = "") {
  const normalized = normalizePlannerText(value);
  const values = new Set();
  for (const match of normalized.matchAll(
    /\b(?:alla|ule|kuni|vahemalt|enam\s+kui|rohkem\s+kui|vahem\s+kui)\s+(\d{1,3})(?:\s*[-–—]\s*|\s+)?aasta\p{L}*/gu
  )) {
    values.add(normalizeQuestionNumericValue(match[1]));
  }
  for (const match of normalized.matchAll(
    /\b(?:vanuses\s+)?(\d{1,3})\s*[-–—]\s*(\d{1,3})(?:\s*[-–—]\s*|\s+)?aasta\p{L}*/gu
  )) {
    values.add(normalizeQuestionNumericValue(match[1]));
    values.add(normalizeQuestionNumericValue(match[2]));
  }
  return [...values].filter(Boolean);
}

function questionNumericRoles(rawInput = "", yearRoleMentions = []) {
  const text = String(rawInput || "");
  const sourceIdentityValues = new Set(
    (Array.isArray(yearRoleMentions) ? yearRoleMentions : [])
      .filter(mention => mention?.role === "document_source_year")
      .map(mention => normalizeQuestionNumericValue(mention?.value))
      .filter(Boolean)
  );
  const evidenceScopeValues = new Set(
    (Array.isArray(yearRoleMentions) ? yearRoleMentions : [])
      .filter(mention => mention?.role === "evidence_year")
      .map(mention => normalizeQuestionNumericValue(mention?.value))
      .filter(Boolean)
  );
  const scopeValues = new Set(requestedSlotScopeValues(text));
  const mentions = Array.from(text.matchAll(/(?<![\p{L}\d])\d+(?:[.,]\d+)?\s*%?/gu)).map(match => ({
    value: String(match[0] || "").replace(/\s+/gu, "").replace(",", "."),
    normalized_value: normalizeQuestionNumericValue(match[0]),
    span_start: Number(match.index)
  }));
  const requestedAnchorMentions = mentions.filter(mention => {
    const value = mention.normalized_value;
    if (!value) return false;
    if (sourceIdentityValues.has(value) || evidenceScopeValues.has(value) || scopeValues.has(value)) return false;
    if (/^(?:19|20)\d{2}$/u.test(value)) return false;
    return true;
  });
  return {
    source_identity_values: Array.from(sourceIdentityValues),
    evidence_scope_values: Array.from(evidenceScopeValues),
    question_scope_values: Array.from(scopeValues),
    requested_anchor_values: Array.from(new Set(requestedAnchorMentions.map(mention => mention.value))),
    requested_anchor_mentions: requestedAnchorMentions
  };
}

function extractRequestedFactSlots(
  normalized = "",
  inputForm = "original",
  rawInput = "",
  numericSlots = null,
  morphology = null,
  numericRoles = null
) {
  const expectedCardinality = requestedFactExpectedCardinality(normalized);
  const explicitValues = Array.from(new Set(
    (Array.isArray(numericRoles?.requested_anchor_values)
      ? numericRoles.requested_anchor_values
      : Array.from(String(rawInput || normalized).matchAll(/(?<![\p{L}\d])\d+(?:[.,]\d+)?\s*%?/gu))
        .map(match => String(match[0] || "").replace(/\s+/gu, "").replace(",", ".")))
      .filter(Boolean)
  )).slice(0, 12);
  const relationTerms = Array.from(new Set(
    normalized.split(/\s+/u)
      .filter(token => token.length >= 4)
      .filter(token => !/^(?:mill|kuidas|mida|selle|artik|uuring|dokument|aruan|raport|kirjuta|vastus)/u.test(token))
  )).slice(0, 16);
  const temporalScope = /\b(?:praegu|hetkel|tana|kehtiv)\p{L}*\b/u.test(normalized)
    ? "current"
    : /\b(?:varem|ajalool|toimus|oli|aastal)\p{L}*\b/u.test(normalized)
      ? "historical"
      : "unspecified";
  const inherited = Array.isArray(numericSlots?.slots) ? numericSlots.slots : [];
  const explicitValueRelation = explicitValues.length >= 2 && /\b(?:arvudega|numbritega)\b/u.test(normalized);
  const explicitValueSlots = explicitValueRelation
    ? (Array.isArray(numericRoles?.requested_anchor_mentions)
        ? numericRoles.requested_anchor_mentions
        : Array.from(String(rawInput || normalized).matchAll(/(?<![\p{L}\d])\d+(?:[.,]\d+)?\s*%?/gu)).map(match => ({
            value: String(match[0] || "").replace(/\s+/gu, "").replace(",", "."),
            span_start: Number(match.index)
          })))
      .map(mention => {
        const spanStart = Number(mention.span_start);
        const value = String(mention.value || "");
        const localRelation = String(rawInput || normalized).slice(
          Math.max(0, spanStart - 48),
          Math.min(String(rawInput || normalized).length, spanStart + value.length + 48)
        );
        return {
          index: 0,
          span_start: spanStart,
          value_type: "explicit_value_relation",
          expected_cardinality: 1,
          relation_terms: requestedSlotRelationTerms(localRelation),
          category: null,
          explicit_values: [value],
          temporal_scope: temporalScope,
          modality: requestedFactModality(normalized),
          derivation: "explicit_value_relation",
          input_form: inputForm
        };
      })
    : [];
  const qualitative = explicitValueRelation
    ? {
        complete: true,
        recognized_clause_count: 0,
        emitted_slot_count: 0,
        unresolved_clause_count: 0,
        slots: []
      }
    : extractRequestedQualitativeSlots(normalized, inputForm);
  const qualitativeSlots = qualitative.slots;
  const extractedSlots = explicitValueRelation
    ? explicitValueSlots
    : [...inherited, ...qualitativeSlots].sort((left, right) =>
        Number(left?.span_start ?? Number.MAX_SAFE_INTEGER) - Number(right?.span_start ?? Number.MAX_SAFE_INTEGER)
      );
  const fallbackSlots = extractedSlots.length ? extractedSlots : [{
    index: 0,
    span_start: 0,
    value_type: requestedFactValueType(normalized),
    relation_terms: relationTerms,
    input_form: inputForm
  }];
  const slots = fallbackSlots.map((slot, index) => ({
    ...slot,
    index: index + 1,
    expected_cardinality: slot.expected_cardinality ?? expectedCardinality,
    category: slot.category || null,
    explicit_values: Array.isArray(slot.explicit_values) ? slot.explicit_values : explicitValues,
    temporal_scope: slot.temporal_scope || temporalScope,
    modality: slot.modality || requestedFactModality(normalized)
  }));
  const numericClausesRecognized = Number(numericSlots?.recognized_clause_count || 0) > 0;
  const numericComplete = !numericClausesRecognized || numericSlots?.complete === true;
  const qualitativeComplete = qualitative.complete === true;
  const fallbackComplete = extractedSlots.length > 0 || relationTerms.length > 0;
  return enrichRequestedFactSlotsWithMorphology({
    version: "requested_fact_slots_v2",
    complete: numericComplete && qualitativeComplete && fallbackComplete,
    numeric_clause_count: Number(numericSlots?.recognized_clause_count || 0),
    qualitative_clause_count: Number(qualitative.recognized_clause_count || 0),
    unresolved_clause_count: Number(numericSlots?.unresolved_clause_count || 0) +
      Number(qualitative.unresolved_clause_count || 0),
    expected_cardinality: expectedCardinality,
    numeric_roles: numericRoles || null,
    question_scope_values: Array.isArray(numericRoles?.question_scope_values)
      ? numericRoles.question_scope_values
      : [],
    slots: slots.slice(0, 12)
  }, morphology);
}

function buildQuestionSemanticCandidates(normalized = "", inputForm = "original", rawInput = "", morphology = null) {
  const sourceMatch = normalized.match(RESEARCH_FACT_SOURCE_RE);
  const boundedEpisodeShape = boundedEpisodeMetricFactShape(normalized, {
    hasSourceAnchor: !!sourceMatch
  });
  const episodeYearSpans = boundedEpisodeShape ? boundedEpisodePeriodYearSpans(normalized) : [];
  const yearRoleMentions = semanticYearMentions(normalized, episodeYearSpans, inputForm, rawInput);
  const requestedRawInput = maskQuotedDocumentTitles(rawInput);
  const requestedNormalized = normalizeRequestedFactText(requestedRawInput);
  const numericRoles = questionNumericRoles(requestedRawInput, yearRoleMentions);
  const requestedNumericSlots = extractRequestedNumericSlots(requestedNormalized, inputForm, requestedRawInput);
  return {
    version: "question_semantic_candidates_v1",
    year_role_mentions: yearRoleMentions,
    requested_year_role: requestedYearRole(normalized, yearRoleMentions),
    requested_numeric_slots: requestedNumericSlots,
    requested_fact_slots: extractRequestedFactSlots(
      requestedNormalized,
      inputForm,
      requestedRawInput,
      requestedNumericSlots,
      morphology,
      numericRoles
    ),
    current_turn_document_identity: currentTurnDocumentIdentityCandidate(rawInput, inputForm, yearRoleMentions)
  };
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
  const compactShape = !sourceMatch && compactResearchFactShape(normalized, message);
  const implicitNumericShape = !sourceMatch && !compactShape && implicitMultiCohortNumericFactShape(normalized);
  const explicitValueRelationShape = !sourceMatch && !compactShape && !implicitNumericShape &&
    implicitExplicitValueRelationShape(normalized);
  const contractedHistoricalCountShape = !sourceMatch && !compactShape && !implicitNumericShape &&
    !explicitValueRelationShape && contractedHistoricalCountResearchFactShape(normalized);
  const organizationRecipientRecommendationShape = !sourceMatch && !compactShape && !implicitNumericShape &&
    !explicitValueRelationShape && !contractedHistoricalCountShape &&
    organizationRecipientRecommendationResearchFactShape(normalized, message);
  const boundedEpisodeShape = !compactShape && !implicitNumericShape && !explicitValueRelationShape && boundedEpisodeMetricFactShape(normalized, {
    hasSourceAnchor: !!sourceMatch
  });
  const implicitNamedFactShape = !sourceMatch && !compactShape && !implicitNumericShape && !explicitValueRelationShape && !boundedEpisodeShape &&
    implicitNamedResearchFactShape(normalized, message);
  const episodeYears = boundedEpisodeShape ? boundedEpisodePeriodYears(normalized) : [];
  const episodePhaseOrdinal = boundedEpisodeShape ? boundedEpisodePhaseOrdinal(normalized) : null;
  const enumeratedListShape = namedEnumeratedResearchFactShape(normalized, sourceMatch, message);
  if (
    (!sourceMatch && !compactShape && !implicitNumericShape && !explicitValueRelationShape && !contractedHistoricalCountShape && !organizationRecipientRecommendationShape && !boundedEpisodeShape && !implicitNamedFactShape && !enumeratedListShape) ||
    (!RESEARCH_FACT_SHAPE_RE.test(normalized) && !explicitValueRelationShape && !organizationRecipientRecommendationShape && !boundedEpisodeShape && !implicitNamedFactShape && !enumeratedListShape)
  ) return null;
  if (RESEARCH_FACT_BROAD_RE.test(normalized)) return null;

  const personName = extractResearchFactPersonName(message);
  const namedAnchorTerms = namedResearchAnchorTerms(message);
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
  const typedYearRoleMentions = semanticYearMentions(
    normalized,
    boundedEpisodeShape ? boundedEpisodePeriodYearSpans(normalized) : [],
    "original",
    message
  );
  const explicitEvidencePeriodYears = Array.from(new Set(typedYearRoleMentions
    .filter(mention => mention.role === "evidence_year" && mention.method === "explicit_year_range")
    .map(mention => mention.value)));
  const typedDocumentSourceYears = Array.from(new Set(
    typedYearRoleMentions
      .filter(mention => mention?.role === "document_source_year")
      .map(mention => String(mention.value || ""))
      .filter(Boolean)
  )).slice(0, 2);
  const publicationYearSubjectTerms = typedYearRoleMentions.length
    ? typedDocumentSourceYears
    : tokens
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
      : !sourceMatch && (explicitValueRelationShape || contractedHistoricalCountShape || organizationRecipientRecommendationShape || boundedEpisodeShape || implicitNamedFactShape || enumeratedListShape)
        ? ""
        : sourceToken || "uuring";
  return {
    personName,
    namedAnchorTerms,
    subjectTerms,
    factTerms,
    sourceKind,
    compactShape,
    implicitNumericShape,
    explicitValueRelationShape,
    contractedHistoricalCountShape,
    organizationRecipientRecommendationShape,
    implicitNamedFactShape,
    boundedEpisodeShape,
    episodeYears: boundedEpisodeShape ? episodeYears : explicitEvidencePeriodYears,
    episodePhaseOrdinal,
    boundedMetricTerms,
    boundedMetricSlots,
    publicationYearSubjectTerms,
    enumeratedListShape
  };
}

function morphologySearchTerms(morphology = null) {
  return new Set(
    (Array.isArray(morphology?.tokens) ? morphology.tokens : [])
      .flatMap(token => [
        ...(Array.isArray(token?.lemmas) ? token.lemmas : []),
        ...(Array.isArray(token?.root_tokens) ? token.root_tokens : [])
      ])
      .map(normalizePlannerText)
      .filter(Boolean)
  );
}

function isKovServiceOrBenefitQuestion(text = "", resolvedMunicipalities = [], morphology = null) {
  const municipalitySignal =
    (Array.isArray(resolvedMunicipalities) && resolvedMunicipalities.length > 0) ||
    /\b(vald|valla|linn|linna|kov|omavalitsus|omavalitsuse)\b/.test(text);
  const morphologyTerms = morphologySearchTerms(morphology);
  const serviceSignal =
    /\b(koduteen\w*|sotsiaaltranspord\w*|tugiisikuteen\w*|lapsehoiuteen\w*|uldhooldusteen\w*|teenus\w*|toetus\w*|tingimus\w*|taotle\w*|vorm\w*|kontakt\w*)\b/.test(text) ||
    [
      "koduteenus", "sotsiaaltransport", "tugiisikuteenus", "lapsehoiuteenus",
      "uldhooldusteenus", "teenus", "toetus", "tingimus", "taotlema", "vorm", "kontakt"
    ].some(term => morphologyTerms.has(term));
  return municipalitySignal && serviceSignal;
}

function isKovServiceAndLocalRuleQuestion(text = "", resolvedMunicipalities = [], morphology = null, rawText = "") {
  return isKovServiceOrBenefitQuestion(text, resolvedMunicipalities, morphology) &&
    (
      String(rawText || "").includes("§") ||
      /(?:\bparagrahv\p{L}*\b|\b(?:kohalik|valla|linna|omavalitsuse)\s+(?:kord|maarus)\p{L}*\b)/u.test(text)
    );
}

function isOverviewSynthesisQuestion(text = "") {
  const issueSignal = /\b(murekoh\w*|probleem\w*|kitsaskoh\w*|raskus\w*|valjakutse\w*|teemad korduvad|ulevaade probleemidest|peamised teemad)\b/.test(text);
  const broadDomainSignal = /\b(lastekaitse\w*|sotsiaaltoo\w*|omastehooldaja\w*|hooldaja\w*|puudega lapse pere|valdkond\w*|praktika\w*)\b/.test(text);
  return issueSignal && broadDomainSignal;
}

function isExplicitJournalSynthesisQuestion(text = "") {
  const journalSignal = /\bsotsiaaltoo\b/.test(text);
  const sourceSignal = /\b(artikl\w*|lugu\w*|tekst\w*|kirjutis\w*|allik\w*|kasitlus\w*|uuring\w*)\b/.test(text);
  const pluralArticleSignal = /\b(?:artiklid|artiklites|artiklite|kirjutised|lood|allikad|uuringud|uuringutes|uuringute)\b/u.test(text);
  const crossSourceSignal = /\b(eri|mitm\w*|ulevaad\w*|vordl\w*|kirjeldavad|kasitlevad|toovad|raagivad)\b/.test(text);
  const namedJournalScope = /\b(?:ajakiri|ajakirja\w*)\s+sotsiaaltoo\b/u.test(text);
  return namedJournalScope || (sourceSignal && crossSourceSignal && (journalSignal || pluralArticleSignal));
}

export function extractNamedPersonIntent(message = "", morphology = null) {
  const text = String(message || "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  const patterns = [
    /^\s*(.+?)\s+(?:on\s+)?(?:kirjutanud|avaldanud)\s+(?:kui\s+palju|mitu)\s+(?:artiklit|artikleid|lugu|lugusid|teksti|tekste|kirjutist|kirjutisi)\b/iu,
    /^\s*kes\s+on\s+(.+?)\s+ja\s+(?:mida|millest)\s+(?:ta|tema)\s+(?:on\s+)?(?:kirjutanud|avaldanud)\b/iu,
    /\b(?:millest|mida)\s+(?:on\s+)?(.+?)(?:\s+ise)?\s+ajakirjas\s+["'„“”]?Sotsiaaltöö["'„“”]?\s+kirjutanud\b/iu,
    /\bmillest\s+(?:on\s+)?(.+?)\s+kirjutanud\b/iu,
    /\bmida\s+(?:on\s+)?(.+?)\s+kirjutanud\b/iu,
    /\b(?:millest|mida)\s+kirjutas\s+(.+?)[?.!]*\s*$/iu,
    /\bmillistest\s+teemadest.+?\bkirjutas\s+(.+?)[?.!]*\s*$/iu,
    /\bmillistes\s+(?:enda\s+)?artiklites\s+kirjutas\s+(.+?)[?.!]*\s*$/iu,
    /^\s*kes\s+on\s+(.+?)[?.!]*\s*$/iu,
    /^\s*(.+?)\s+(?:artiklid|artikleid|autorlus)\b/iu
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const candidate = cleanPersonCandidate(match?.[1] || "")
      .replace(/\s+ise$/iu, "")
      .trim();
    if (isLikelyPersonCandidate(candidate)) {
      return canonicalMorphologyPersonCandidate(candidate, morphology);
    }
  }
  const personQuestionSignal = /\b(?:kes\s+on|autor\w*|artikl\w*|kirjutas|kirjutanud|avaldanud|teemadest)\b/iu.test(text);
  if (!personQuestionSignal) return null;
  const surfaceCandidates = surfacePersonCandidates(text);
  return surfaceCandidates.at(-1) || morphologyPersonCandidates(morphology).at(-1) || null;
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
  if (
    /\b(?:millest|mida)\s+(?:on\s+)?.+?\s+kirjutanud\b/iu.test(text) ||
    /\b(?:millest|mida)\s+kirjutas\s+.+/iu.test(text) ||
    /\b(?:millistest\s+teemadest|millistes\s+(?:enda\s+)?artiklites)\b.+?\bkirjutas\b/iu.test(text) ||
    /\b(?:artiklid|artikleid|artiklites|autorlus)\b/iu.test(text)
  ) {
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
    /\b(millised|mis|mida|kust|kuidas leida|kuidas otsida|leia|otsi|kelle poole|kas on|leida abi|aitavad|aitab|pakub|pakuvad)\b/.test(text);
  if (!questionSignal) return false;

  const organizationSignal = /\b(organisatsioon|organisatsioonid|uhendus|uhing|koda|liit|fond|tugiliit|tugivorgustik|vorgustik|partner|teenusepakkuja|teenusepakkujad|keskus|asutus|kontakt|kontaktid)\b/.test(text);
  const materialSignal = /\b(?:materjal\w*|juhend(?:materjal\w*|i|it|id|eid|e|ist|ites|ite|iga)?|kasiraamat\w*|pdf|infoleht\w*|teemaleht\w*|kataloog\w*|vorm\w*|taotlus\w*|praktikamaterjal\w*|koolitusmaterjal\w*|tooleh\w*)\b/.test(text);
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

export function buildQuestionPlan({
  message = "",
  role = "",
  semanticInputForm = "original",
  morphology = null,
  resolvedMunicipalities = []
} = {}) {
  const normalized = normalizePlannerText(message);
  const morphologyTerms = Array.from(morphologySearchTerms(morphology));
  const lexicalSocialScope = inferLexicalSocialScope(
    [normalized, ...morphologyTerms].filter(Boolean).join(" ")
  );
  const inputRole = normalizePlannerRole(role);
  const roleInference = inferPlannerRole(normalized, inputRole);
  const normalizedRole = roleInference.role || inputRole;
  const boundedSemanticInputForm = ["original", "canonical_fallback"].includes(semanticInputForm)
    ? semanticInputForm
    : null;
  const semanticCandidates = buildQuestionSemanticCandidates(normalized, boundedSemanticInputForm, message, morphology);
  const makeQuestionPlan = overrides => {
    const routeMode = String(overrides.mode || "default");
    const intrinsicallySocialRoute = INTRINSICALLY_SOCIAL_MODES.has(routeMode);
    return makePlan({
      ...overrides,
      semantic_input_form: boundedSemanticInputForm,
      social_scope: overrides.social_scope || (
        intrinsicallySocialRoute ? "in_scope" : lexicalSocialScope.scope
      ),
      social_scope_reason: overrides.social_scope_reason || (
        intrinsicallySocialRoute
          ? `intrinsically_social_${routeMode}_route`
          : lexicalSocialScope.reason
      ),
      requested_year_role: semanticCandidates.requested_year_role || "none",
      current_evidence_scope: currentEvidenceScope(normalized, overrides.mode || "default"),
      semantic_candidates: semanticCandidates
    });
  };

  if (!normalized) {
    return makeQuestionPlan({
      role: normalizedRole,
      input_role: inputRole,
      role_confidence: roleInference.confidence,
      needs_rag: false,
      planner_reason: "empty_message"
    });
  }

  if (isKovServiceAndLocalRuleQuestion(normalized, resolvedMunicipalities, morphology, message)) {
    const municipalityMatches = Array.isArray(resolvedMunicipalities) ? resolvedMunicipalities : [];
    const resolvedMunicipality = municipalityMatches.length === 1 ? municipalityMatches[0] : null;
    return makeQuestionPlan({
      mode: "kov_service_and_local_rule",
      role: normalizedRole,
      input_role: inputRole,
      role_confidence: roleInference.confidence,
      confidence: 0.92,
      needs_rag: true,
      needs_multiple_sources: true,
      needs_location: municipalityMatches.length !== 1,
      municipality_ambiguous: municipalityMatches.length > 1,
      municipality_candidates: municipalityMatches
        .map(item => item?.displayName || item?.slug)
        .filter(Boolean)
        .slice(0, 4),
      municipality_hint: resolvedMunicipality?.displayName || resolvedMunicipality?.slug || null,
      retrieval_strategy: "municipality_service_plus_local_rule",
      answer_contract: "answer_service_application_and_local_rule_as_two_supported_subgoals",
      subgoals: ["municipality_service_application", "municipality_local_rule"],
      planner_reason: "service_question_with_local_paragraph_reference"
    });
  }

  if (isLegalExactQuestion(normalized)) {
    return makeQuestionPlan({
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

  if (isKovServiceOrBenefitQuestion(normalized, resolvedMunicipalities, morphology)) {
    const municipalityMatches = Array.isArray(resolvedMunicipalities) ? resolvedMunicipalities : [];
    const resolvedMunicipality = municipalityMatches.length === 1 ? municipalityMatches[0] : null;
    return makeQuestionPlan({
      mode: "kov_service_or_benefit",
      role: normalizedRole,
      input_role: inputRole,
      role_confidence: roleInference.confidence,
      confidence: 0.82,
      needs_rag: true,
      needs_location: !resolvedMunicipality,
      municipality_ambiguous: municipalityMatches.length > 1,
      municipality_candidates: municipalityMatches
        .map(item => item?.displayName || item?.slug)
        .filter(Boolean)
        .slice(0, 4),
      municipality_hint: resolvedMunicipality?.displayName || resolvedMunicipality?.slug || null,
      retrieval_strategy: "kov_source_package_or_scoped_rag",
      answer_contract: "municipality_source_package_preferred",
      planner_reason: resolvedMunicipality
        ? "resolved_municipality_and_service_or_benefit_terms"
        : "municipality_and_service_or_benefit_terms"
    });
  }

  const rawSpecificResearchFact = extractSpecificResearchFactIntent(message);
  const currentTurnResearchAuthors = (Array.isArray(
    semanticCandidates?.current_turn_document_identity?.authors
  ) ? semanticCandidates.current_turn_document_identity.authors : [])
    .filter(author => author?.confidence === "high" && author?.value)
    .map(author => String(author.value || "").trim())
    .filter(Boolean);
  const researchFactPersonNames = Array.from(new Set([
    rawSpecificResearchFact?.personName,
    ...currentTurnResearchAuthors
  ].map(value => String(value || "").trim()).filter(Boolean)))
    .map(value => canonicalMorphologyPersonCandidate(value, morphology))
    .filter(Boolean);
  const researchFactPersonName = researchFactPersonNames[0] || null;
  const specificResearchFact = rawSpecificResearchFact && researchFactPersonName
    ? {
        ...rawSpecificResearchFact,
        personName: researchFactPersonName,
        personNames: researchFactPersonNames
      }
    : rawSpecificResearchFact;
  if (specificResearchFact) {
    return makeQuestionPlan({
      planner_version: "v2.6",
      mode: "specific_research_fact",
      role: normalizedRole,
      input_role: inputRole,
      role_confidence: roleInference.confidence,
      confidence: specificResearchFact.personName ? 0.92 : 0.82,
      needs_rag: true,
      needs_multiple_sources: false,
      person_name: specificResearchFact.personName,
      document_author_names: Array.isArray(specificResearchFact.personNames)
        ? specificResearchFact.personNames
        : specificResearchFact.personName
          ? [specificResearchFact.personName]
          : [],
      document_subject_terms: specificResearchFact.subjectTerms,
      document_anchor_terms: specificResearchFact.namedAnchorTerms,
      document_fact_terms: specificResearchFact.factTerms,
      document_fact_query: message,
      document_source_kind: specificResearchFact.sourceKind,
      document_source_years: specificResearchFact.publicationYearSubjectTerms,
      period_role: specificResearchFact.boundedEpisodeShape ? "evidence_episode" : specificResearchFact.episodeYears.length ? "evidence_period" : null,
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
          : specificResearchFact.explicitValueRelationShape
            ? "implicit_explicit_value_relation_shape"
            : specificResearchFact.contractedHistoricalCountShape
              ? "contracted_historical_count_fact_shape"
              : specificResearchFact.organizationRecipientRecommendationShape
                ? "organization_recipient_recommendation_fact_shape"
            : specificResearchFact.implicitNamedFactShape
              ? "implicit_named_research_fact_shape"
              : specificResearchFact.boundedEpisodeShape
                ? "bounded_episode_metric_fact_shape"
                : specificResearchFact.enumeratedListShape
                  ? "named_enumerated_research_fact_shape"
                  : "singular_research_source_and_fact_shape"
    });
  }

  const namedPerson = extractNamedPersonIntent(message, morphology);
  if (namedPerson) {
    const namedPersonIntent = personSourceIntent(message);
    return makeQuestionPlan({
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

  if (isSpecificDocumentSummaryQuestion(normalized)) {
    return makeQuestionPlan({
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

  const namedDocumentGuidance = !!semanticCandidates.current_turn_document_identity?.title_hint?.value ||
    /\b(?:selles|sellest|selle|nimetatud)\s+(?:artikl|dokumen|juhend|kasiraamat|fail)\w*/u.test(normalized);
  if (namedDocumentGuidance && isSpecificDocumentGuidanceQuestion(normalized, morphology)) {
    return makeQuestionPlan({
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

  const methodGuidanceFocus = lexicalSocialScope.scope === "in_scope"
    ? professionalMethodGuidanceFocus(normalized, morphologyTerms)
    : null;
  if (methodGuidanceFocus) {
    return makeQuestionPlan({
      planner_version: "v2.9",
      mode: "professional_method_guidance",
      role: normalizedRole,
      input_role: inputRole,
      role_confidence: roleInference.confidence,
      confidence: 0.84,
      needs_rag: true,
      needs_multiple_sources: true,
      preferred_source_count: { min: 1, max: 4 },
      method_guidance_focus: methodGuidanceFocus,
      source_layers: ["official_guideline", "state_guide", "methodology_guide", "methodology_material", "method_guidance", "quality_guideline", "service_standard", "information_material", "journal_article", "research_report"],
      source_layer_filter_mode: "prefer",
      retrieval_strategy: "authoritative_guidance_then_complementary_evidence",
      answer_contract: "evidence_backed_method_phases_and_complementary_models",
      planner_reason: "professional_method_process_question"
    });
  }

  if (isOverviewSynthesisQuestion(normalized) || isExplicitJournalSynthesisQuestion(normalized)) {
    return makeQuestionPlan({
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
    return makeQuestionPlan({
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
    return makeQuestionPlan({
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
    return makeQuestionPlan({
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

  const entityExtraction = extractSemanticEntities({ message, morphology });
  const namedEntities = entityExtraction.named_entities.slice(0, 8);
  if (namedEntities.length) {
    return makeQuestionPlan({
      planner_version: "v2.8",
      mode: "grounded_question",
      role: normalizedRole,
      input_role: inputRole,
      role_confidence: roleInference.confidence,
      confidence: 0.68,
      needs_rag: true,
      needs_multiple_sources: false,
      entity_names: namedEntities,
      entity_candidates: entityExtraction.entities,
      intent_argument_entities: entityExtraction.entities,
      retrieval_strategy: "semantic_question_with_named_entity_arguments",
      answer_contract: "answer_only_from_matching_internal_corpus_sources",
      planner_reason: "named_entities_preserved_as_intent_arguments"
    });
  }

  return makeQuestionPlan({
    role: normalizedRole,
    input_role: inputRole,
    role_confidence: roleInference.confidence,
    planner_reason: roleInference.reason || "default"
  });
}
