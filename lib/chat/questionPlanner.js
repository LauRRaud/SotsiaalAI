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

function isKovServiceOrBenefitQuestion(text = "") {
  const municipalitySignal = /\b(vald|valla|linn|linna|kov|omavalitsus|omavalitsuse)\b/.test(text);
  const serviceSignal = /\b(koduteenus|sotsiaaltransport|tugiisikuteenus|lapsehoiuteenus|uldhooldusteenus|teenus|teenused|toetus|toetused|tingimus|tingimused|taotleda|vormid|kontaktid)\b/.test(text);
  return municipalitySignal && serviceSignal;
}

function isOverviewSynthesisQuestion(text = "") {
  const issueSignal = /\b(murekoht|murekohad|probleem|probleemid|kitsaskoht|kitsaskohad|raskus|raskused|teemad korduvad|ulevaade probleemidest|peamised teemad)\b/.test(text);
  const broadDomainSignal = /\b(lastekaitse|lastekaitses|sotsiaaltoo|omastehooldaja|hooldajad|puudega lapse pere|valdkond|praktika)\b/.test(text);
  return issueSignal && broadDomainSignal;
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

  if (isOverviewSynthesisQuestion(normalized)) {
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
