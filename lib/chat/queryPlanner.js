import { CONTEXT_GROUPS_MAX, RAG_TOP_K } from "@/lib/chat/settings";
import { buildTemporalYearSearchQuery } from "@/lib/chat/retrievalPlanning";
import { buildSourceAnchoredRagQueries } from "@/lib/chat/retrievalOrchestrator";
import { buildLegalLookupQueryEntries, detectLegalLookupPlan } from "@/lib/chat/legalLookup";
import { selectRetrievalStrategy } from "@/lib/chat/retrievalStrategySelector";

const THEMATIC_SYNTHESIS_SOURCE_TYPES = [
  "journal_article",
  "official_guideline",
  "information_material",
  "research_report",
  "study",
  "survey_report",
  "evaluation_report",
  "statistics",
  "statistical_report",
  "official_report",
  "methodology_guide",
  "state_guide",
  "quality_guideline",
  "service_standard",
  "practice_example",
  "project_description",
  "academic_paper",
  "policy_report",
  "policy_analysis",
  "guide",
  "manual",
  "training_material",
  "methodology_material",
  "template"
];

const THEMATIC_SYNTHESIS_COLLECTION_IDS = [
  "sotsiaaltoo_articles",
  "journal_articles",
  "studies",
  "research_reports",
  "national_guidelines",
  "policy_analyses",
  "organization_guidelines",
  "organization_materials",
  "training_materials",
  "statistics",
  "guides",
  "methodology_guides",
  "templates"
];

const RESOURCE_DISCOVERY_SOURCE_TYPES = [
  "organization_profile",
  "organization_page",
  "public_body_info",
  "partner_service_info",
  "service_provider_info",
  "contact_page",
  "contacts",
  "journal_article",
  "official_guideline",
  "information_material",
  "analysis",
  "policy_analysis",
  "research_report",
  "study",
  "survey_report",
  "evaluation_report",
  "training_material",
  "methodology_material",
  "methodology_guide",
  "worksheet",
  "guide",
  "manual",
  "kov_service_info",
  "municipality_service",
  "municipality_web"
];

const RESOURCE_DISCOVERY_RESOURCE_TYPES = [
  "organization_page",
  "information_material",
  "method_guidance",
  "best_practice_guidance",
  "training_material",
  "worksheet",
  "pdf_document",
  "contact_page",
  "service_info",
  "organization_material"
];

const RESOURCE_DISCOVERY_COLLECTION_IDS = [
  "organizations",
  "organization_materials",
  "public_body_info",
  "partner_service_info",
  "service_provider_info",
  "contacts",
  "sotsiaaltoo_articles",
  "journal_articles",
  "studies",
  "research_reports",
  "policy_analyses",
  "national_guidelines",
  "training_materials",
  "organization_guidelines",
  "guides",
  "methodology_guides",
  "kov_services"
];

const LIFE_SITUATION_SOURCE_TYPES = [
  "national_law",
  "municipality_web",
  "municipality_service",
  "kov_service_info",
  "public_body_info",
  "official_guideline",
  "information_material",
  "journal_article"
];

const LIFE_SITUATION_RESOURCE_TYPES = [
  "service_info",
  "information_material",
  "best_practice_guidance",
  "contact_page",
  "organization_page"
];

const LIFE_SITUATION_COLLECTION_IDS = [
  "kov_services",
  "kov_web",
  "kov_rt",
  "national_law",
  "national_guidelines",
  "public_body_info",
  "sotsiaaltoo_articles",
  "journal_articles"
];

const COMPARISON_SOURCE_TYPES = [
  "national_law",
  "law",
  "kov_regulation",
  "regulation",
  "riigiteataja_regulation",
  "municipality_web",
  "municipality_service",
  "kov_service_info",
  "official_guideline",
  "methodology_guide",
  "methodology_material",
  "information_material",
  "journal_article"
];

const COMPARISON_RESOURCE_TYPES = [
  "service_info",
  "method_guidance",
  "best_practice_guidance",
  "information_material"
];

const COMPARISON_COLLECTION_IDS = [
  "national_law",
  "kov_rt",
  "kov_legal",
  "kov_services",
  "kov_web",
  "national_guidelines",
  "methodology_guides",
  "guides",
  "sotsiaaltoo_articles",
  "journal_articles"
];

const KOV_REGULATION_COLLECTION_FILTER = Object.freeze({
  $in: ["kov_legal", "kov_regulations"]
});

function buildThematicSynthesisFilters(audienceFilter = null) {
  return {
    ...(audienceFilter || {}),
    $or: [
      {
        source_type: {
          $in: THEMATIC_SYNTHESIS_SOURCE_TYPES
        }
      },
      {
        collection_id: {
          $in: THEMATIC_SYNTHESIS_COLLECTION_IDS
        }
      }
    ]
  };
}

function buildResourceDiscoveryFilters(audienceFilter = null) {
  return {
    ...(audienceFilter || {}),
    $or: [
      {
        collection_id: {
          $in: RESOURCE_DISCOVERY_COLLECTION_IDS
        }
      },
      {
        source_type: {
          $in: RESOURCE_DISCOVERY_SOURCE_TYPES
        }
      },
      {
        resource_type: {
          $in: RESOURCE_DISCOVERY_RESOURCE_TYPES
        }
      }
    ]
  };
}

function buildLifeSituationGuidanceFilters(audienceFilter = null) {
  return {
    ...(audienceFilter || {}),
    $or: [
      {
        collection_id: {
          $in: LIFE_SITUATION_COLLECTION_IDS
        }
      },
      {
        source_type: {
          $in: LIFE_SITUATION_SOURCE_TYPES
        }
      },
      {
        resource_type: {
          $in: LIFE_SITUATION_RESOURCE_TYPES
        }
      }
    ]
  };
}

function buildComparisonFilters(audienceFilter = null) {
  return {
    ...(audienceFilter || {}),
    $or: [
      {
        collection_id: {
          $in: COMPARISON_COLLECTION_IDS
        }
      },
      {
        source_type: {
          $in: COMPARISON_SOURCE_TYPES
        }
      },
      {
        resource_type: {
          $in: COMPARISON_RESOURCE_TYPES
        }
      }
    ]
  };
}

function collectFilterKeys(value, out = new Set()) {
  if (!value || typeof value !== "object") return out;
  for (const [key, nested] of Object.entries(value)) {
    if (!key) continue;
    out.add(key);
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      collectFilterKeys(nested, out);
    }
  }
  return out;
}

function queryHasFilters(query) {
  return !!query && typeof query === "object" && !!query.filters && typeof query.filters === "object";
}

function summarizeQueryFilters(queries = [], baseFilters = null) {
  const keys = collectFilterKeys(baseFilters);
  for (const query of Array.isArray(queries) ? queries : []) {
    if (queryHasFilters(query)) collectFilterKeys(query.filters, keys);
  }
  return Array.from(keys).sort();
}

function normalizeRagQueryEntries(ragQueries = []) {
  return (Array.isArray(ragQueries) ? ragQueries : [ragQueries])
    .map((entry) => {
      const query = String(typeof entry === "string" ? entry : entry?.query || "").trim();
      if (!query) return null;
      const filters = entry && typeof entry === "object" && !Array.isArray(entry)
        ? entry.filters || null
        : null;
      return {
        query,
        ...(filters ? { filters } : {})
      };
    })
    .filter(Boolean);
}

export function buildSourceLookupRagQueries(ragQueryText = "") {
  const base = String(ragQueryText || "").trim();
  return base ? [{ query: base }] : [];
}

function mergeQueryFilters(entry, filters) {
  return {
    ...(entry?.filters || {}),
    ...(filters || {})
  };
}

export function buildGeneralBackgroundQueries(ragQueries = [], baseQuery = "") {
  const normalizedQueries = (Array.isArray(ragQueries) ? ragQueries : [ragQueries])
    .map((entry) => (typeof entry === "string" ? entry : entry?.query))
    .map((query) => String(query || "").trim())
    .filter(Boolean);
  const base = String(baseQuery || normalizedQueries[0] || "").trim();
  const backgroundAnchor = "uldine taust sotsiaalhoolekanne sotsiaalkaitse riiklik korraldus Sotsiaaltoo";
  return Array.from(new Set([
    base ? [base, backgroundAnchor].join("\n") : backgroundAnchor,
    ...normalizedQueries
  ].filter(Boolean))).map((query) => ({ query }));
}

export function buildNationalServiceBenefitQuery(message = "") {
  return [
    String(message || "").trim(),
    "Sotsiaalhoolekande seadus",
    "kohaliku omavalitsuse yksuse ylesanded",
    "kohaliku omavalitsuse kohustus sotsiaalteenuseid ja muud abi korraldada",
    "sotsiaalteenuste osutamine abivajadusest lahtudes",
    "riiklikud sotsiaalteenused riiklikud sotsiaaltoetused",
    "erihoolekandeteenus rehabilitatsiooniteenus sotsiaalkindlustusamet riigieelarvest rahastatav"
  ].filter(Boolean).join("\n");
}

export function buildServiceJurisdictionQuery(message = "") {
  return [
    String(message || "").trim(),
    "Sotsiaalhoolekande seadus",
    "kohaliku omavalitsuse yksuse korraldatav sotsiaalteenus",
    "kohaliku omavalitsuse yksuse ylesanded",
    "kohaliku omavalitsuse kohustus sotsiaalteenuseid korraldada",
    "riiklik teenus riigi tasandi teenus Sotsiaalkindlustusamet"
  ].filter(Boolean).join("\n");
}

function buildMunicipalityScopedQueries(ragQueries = [], municipalities = [], options = {}) {
  const municipalityEntries = [];
  const seenMunicipalities = new Set();
  for (const item of Array.isArray(municipalities) ? municipalities : []) {
    const displayName = String(item?.displayName || "").trim();
    const municipalityId = String(item?.id || item?.municipalityId || item?.municipality_id || "").trim();
    const key = municipalityId || displayName;
    if (!key || seenMunicipalities.has(key)) continue;
    seenMunicipalities.add(key);
    municipalityEntries.push({
      displayName,
      municipalityId
    });
    if (municipalityEntries.length >= 3) break;
  }
  const queryEntries = normalizeRagQueryEntries(ragQueries);
  if (!municipalityEntries.length || !queryEntries.length) return queryEntries;

  const serviceAnchor = "sotsiaalteenused toetused sotsiaalabi KOV";
  return queryEntries.flatMap((entry) =>
    municipalityEntries.flatMap(({ displayName: municipalityName, municipalityId }) => {
      const municipalityFilters = {
        ...(municipalityId ? { municipality_id: municipalityId } : {}),
        ...(!municipalityId && municipalityName ? { municipality_name: municipalityName } : {})
      };
      const scoped = {
        ...entry,
        query: [municipalityName, entry.query, serviceAnchor].filter(Boolean).join("\n"),
        filters: Object.keys(municipalityFilters).length
          ? mergeQueryFilters(entry, municipalityFilters)
          : entry.filters
      };
      if (!options?.expandServiceBenefitList) return [scoped];
      const wantsServices = options?.serviceBenefitIntent?.wantsServices !== false;
      const wantsBenefits = options?.serviceBenefitIntent?.wantsBenefits !== false;
      const expanded = [scoped];
      if (wantsServices) {
        expanded.push({
          query: [municipalityName, entry.query, "sotsiaalteenused teenused koduteenus tugiisik sotsiaaltransport eluruum volanoustamine lapsehoid hooldus"].join("\n"),
          filters: mergeQueryFilters(entry, {
            ...municipalityFilters,
            collection_id: "kov_services",
            item_type: "service"
          })
        });
      }
      if (wantsBenefits) {
        expanded.push({
          query: [municipalityName, entry.query, "toetused sotsiaaltoetus sotsiaaltoetused sotsiaaltoetusi toimetulekutoetus vajaduspohine toetus hooldajatoetus eestkostetoetus matusetoetus tervisetoetus sissetulekust soltuv toetus toetuse taotlus"].join("\n"),
          filters: mergeQueryFilters(entry, {
            ...municipalityFilters,
            collection_id: "kov_services",
            item_type: "benefit"
          })
        });
      }
      if (wantsServices && wantsBenefits) {
        expanded.push({
          query: [municipalityName, "Sotsiaalhoolekandelise abi andmise kord abi liigid sotsiaalteenused sotsiaaltoetused"].join("\n"),
          filters: mergeQueryFilters(entry, {
            ...municipalityFilters,
            collection_id: KOV_REGULATION_COLLECTION_FILTER
          })
        });
      }
      return expanded;
    })
  );
}

function buildResourceDiscoveryQueries(ragQueries = [], baseQuery = "") {
  const normalizedQueries = normalizeRagQueryEntries(ragQueries);
  const base = String(baseQuery || "").trim();
  const preferredFilters = buildResourceDiscoveryFilters(null);
  const resourceTerms = "organisatsioonid kontaktid teenusepakkujad tugivorgustik materjalid juhendid PDF infolehed artiklid uuringud Sotsiaaltoo";
  const preferredMetadataTerms = "organization_profile organization_page information_material official_guideline training_material journal_article research_report public_body_info partner_service_info";
  const preferredQueries = [
    base ? [base, resourceTerms].join("\n") : resourceTerms,
    base ? [base, preferredMetadataTerms].join("\n") : preferredMetadataTerms
  ]
    .map(value => String(value || "").trim())
    .filter(Boolean)
    .map(query => ({
      query,
      filters: preferredFilters
    }));
  const unfilteredQueries = [
    ...normalizedQueries,
    ...(base ? [{ query: base }] : [])
  ];
  const seen = new Set();
  return [...preferredQueries, ...unfilteredQueries].filter((entry) => {
    const key = JSON.stringify({
      query: entry.query,
      filters: entry.filters || null
    });
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function lifeSituationTopicTerms(questionPlan = {}) {
  const topics = Array.isArray(questionPlan?.topics) ? questionPlan.topics : [];
  const normalizedTopics = topics
    .map(topic => String(topic || "").replace(/_/g, " ").trim())
    .filter(Boolean);
  const lifeSituation = String(questionPlan?.life_situation || "");
  const mapped = [];
  if (lifeSituation === "financial_hardship") {
    mapped.push(
      "toimetulekutoetus",
      "valtimatu sotsiaalabi vältimatu sotsiaalabi",
      "taiendav sotsiaaltoetus täiendav sotsiaaltoetus",
      "volanoustamine võlanõustamine",
      "toiduabi",
      "uurivolg üürivõlg",
      "ajutine majutus",
      "varjupaigateenus",
      "KOV sotsiaalosakond"
    );
  }
  if (lifeSituation === "elderly_relative_care_difficulty") {
    mapped.push(
      "koduteenus",
      "abivajaduse hindamine",
      "taisealise isiku hooldus täisealise isiku hooldus",
      "uldhooldusteenus üldhooldusteenus",
      "sotsiaaltransport",
      "hoolduskoormus",
      "KOV sotsiaalosakond"
    );
  }
  if (lifeSituation === "disabled_child_family_support") {
    mapped.push(
      "puudega lapse toetus",
      "lapsehoiuteenus",
      "tugiisikuteenus",
      "rehabilitatsioon",
      "Sotsiaalkindlustusamet SKA",
      "KOV lastekaitse sotsiaalosakond"
    );
  }
  return Array.from(new Set([...normalizedTopics, ...mapped])).join(" ");
}

function buildLifeSituationGuidanceQueries(ragQueries = [], baseQuery = "", questionPlan = {}) {
  const normalizedQueries = normalizeRagQueryEntries(ragQueries);
  const base = String(baseQuery || "").trim();
  const topicTerms = lifeSituationTopicTerms(questionPlan);
  const preferredFilters = buildLifeSituationGuidanceFilters(null);
  const sourceTerms = "KOV sotsiaalosakond sotsiaalteenused sotsiaaltoetused abi taotlemine kontaktid Sotsiaalhoolekande seadus";
  const preferredQueries = [
    [base, topicTerms].filter(Boolean).join("\n"),
    [topicTerms, sourceTerms].filter(Boolean).join("\n")
  ]
    .map(value => String(value || "").trim())
    .filter(Boolean)
    .map(query => ({
      query,
      filters: preferredFilters
    }));
  const unfilteredQueries = [
    ...normalizedQueries,
    ...(base ? [{ query: [base, topicTerms].filter(Boolean).join("\n") }] : [])
  ];
  const seen = new Set();
  return [...preferredQueries, ...unfilteredQueries].filter((entry) => {
    const key = JSON.stringify({
      query: entry.query,
      filters: entry.filters || null
    });
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function comparisonTopicTerms(questionPlan = {}, baseQuery = "") {
  const topics = Array.isArray(questionPlan?.topics) ? questionPlan.topics : [];
  const out = new Set();
  for (const topic of topics) {
    const normalized = String(topic || "").replace(/_/g, " ").trim();
    if (normalized) out.add(normalized);
    if (topic === "koduteenus") {
      out.add("koduteenus koduteenuse eesmärk koduteenuse sisu kõrvalabi kodus");
    }
    if (topic === "tugiisikuteenus") {
      out.add("tugiisikuteenus tugiisikuteenuse eesmärk juhendamine motiveerimine iseseisev toimetulek");
    }
    if (topic === "isikliku_abistaja_teenus") {
      out.add("isikliku abistaja teenus kõrvalabi tegevustes osalemine iseseisvus");
    }
    if (topic === "lapsehoiuteenus") {
      out.add("lapsehoiuteenus lapsehoid lapse hooldamine");
    }
    if (topic === "uldhooldusteenus") {
      out.add("uldhooldusteenus üldhooldusteenus hooldekodu hooldus");
    }
    if (topic === "sotsiaaltransporditeenus") {
      out.add("sotsiaaltransporditeenus sotsiaaltransport transport");
    }
  }
  if (!out.size) out.add(String(baseQuery || "").trim());
  out.add("Sotsiaalhoolekande seadus sotsiaalteenus teenuse eesmärk teenuse sisu KOV");
  return Array.from(out).filter(Boolean).join(" ");
}

function buildComparisonQueries(ragQueries = [], baseQuery = "", questionPlan = {}) {
  const normalizedQueries = normalizeRagQueryEntries(ragQueries);
  const base = String(baseQuery || "").trim();
  const terms = comparisonTopicTerms(questionPlan, base);
  const preferredFilters = buildComparisonFilters(null);
  const preferredQueries = [
    [base, terms].filter(Boolean).join("\n"),
    terms
  ]
    .map(value => String(value || "").trim())
    .filter(Boolean)
    .map(query => ({
      query,
      filters: preferredFilters
    }));
  const unfilteredQueries = [
    ...normalizedQueries,
    ...(base ? [{ query: [base, terms].filter(Boolean).join("\n") }] : [])
  ];
  const seen = new Set();
  return [...preferredQueries, ...unfilteredQueries].filter((entry) => {
    const key = JSON.stringify({
      query: entry.query,
      filters: entry.filters || null
    });
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildMunicipalityScopedFilters(audienceFilter, municipalities = []) {
  const municipalityEntries = (Array.isArray(municipalities) ? municipalities : [])
    .map((item) => ({
      displayName: String(item?.displayName || "").trim(),
      municipalityId: String(item?.id || item?.municipalityId || item?.municipality_id || "").trim()
    }))
    .filter((item) => item.displayName || item.municipalityId);
  const uniqueKeys = Array.from(new Set(municipalityEntries.map((item) => item.municipalityId || item.displayName)));
  if (uniqueKeys.length !== 1) return audienceFilter;
  const municipality = municipalityEntries.find((item) => item.municipalityId || item.displayName) || {};
  return {
    ...audienceFilter,
    ...(municipality.municipalityId ? { municipality_id: municipality.municipalityId } : {}),
    ...(!municipality.municipalityId && municipality.displayName ? { municipality_name: municipality.displayName } : {})
  };
}

function determineSelectionStrategy({
  legalLookupPlan,
  temporalRetrievalPlan,
  municipalityServiceBenefitListRequest,
  resourceDiscoveryQuestion,
  overviewSynthesisQuestion,
  broadMultiSourceQuestion,
  retrievalStrategySelection
}) {
  if (legalLookupPlan?.enabled && legalLookupPlan.mode === "explicit_paragraph") return "legal_exact";
  if (temporalRetrievalPlan?.enabled) return "temporal_year_coverage";
  if (municipalityServiceBenefitListRequest) return "municipality_service_benefit_balance";
  if (resourceDiscoveryQuestion) return "resource_discovery_diversity";
  if (overviewSynthesisQuestion) return "overview_diversity_then_depth";
  if (broadMultiSourceQuestion) return "multi_source_diversity";
  if (retrievalStrategySelection?.selection_strategy) return retrievalStrategySelection.selection_strategy;
  return "mmr_diversity";
}

function determineContextGroupTarget({
  legalLookupPlan,
  sourceLookupRequest,
  sourceLookupTargetsNationalLaw,
  sourceLookupParagraphRefs,
  temporalRetrievalPlan,
  overviewSynthesisQuestion,
  thematicSynthesisQuestion,
  resourceDiscoveryQuestion,
  municipalityServiceBenefitListRequest,
  municipalityServiceBenefitIntent,
  broadMultiSourceQuestion,
  retrievalStrategySelection
}) {
  if (legalLookupPlan?.enabled) {
    if (legalLookupPlan.mode === "explicit_paragraph") {
      const paragraphCount = Array.isArray(legalLookupPlan.paragraphRefs) ? legalLookupPlan.paragraphRefs.length : 0;
      return Math.max(CONTEXT_GROUPS_MAX, paragraphCount > 1 ? Math.min(10, paragraphCount + 2) : 6);
    }
    if (legalLookupPlan.mode === "topic_to_paragraphs") return Math.max(CONTEXT_GROUPS_MAX, 8);
  }
  if (sourceLookupRequest && sourceLookupTargetsNationalLaw) {
    const paragraphCount = Array.isArray(sourceLookupParagraphRefs) ? sourceLookupParagraphRefs.length : 0;
    return Math.max(CONTEXT_GROUPS_MAX, paragraphCount > 1 ? Math.min(10, paragraphCount + 2) : 6);
  }
  if (temporalRetrievalPlan?.enabled) return CONTEXT_GROUPS_MAX;
  if (municipalityServiceBenefitListRequest) {
    if (municipalityServiceBenefitIntent?.wantsServices && municipalityServiceBenefitIntent?.wantsBenefits) {
      return Math.max(CONTEXT_GROUPS_MAX, 28);
    }
    if (municipalityServiceBenefitIntent?.wantsServices) return Math.max(CONTEXT_GROUPS_MAX, 24);
    return Math.max(CONTEXT_GROUPS_MAX, 14);
  }
  if (resourceDiscoveryQuestion) return Math.max(CONTEXT_GROUPS_MAX, 10);
  if (overviewSynthesisQuestion) return Math.max(CONTEXT_GROUPS_MAX, 14);
  if (thematicSynthesisQuestion) return Math.max(CONTEXT_GROUPS_MAX, 12);
  if (broadMultiSourceQuestion) return Math.max(CONTEXT_GROUPS_MAX, 8);
  if (Number.isFinite(Number(retrievalStrategySelection?.context_group_target_min))) {
    return Math.max(CONTEXT_GROUPS_MAX, Number(retrievalStrategySelection.context_group_target_min));
  }
  return CONTEXT_GROUPS_MAX;
}

function determineRagTopK({
  legalLookupPlan,
  sourceLookupRequest,
  sourceLookupTopK,
  municipalityServiceBenefitListRequest,
  municipalityServiceBenefitRagRequest,
  municipalityServiceBenefitIntent,
  nationalServiceBenefitQuestion,
  serviceJurisdictionQuestion,
  allowMunicipalityScopedRag,
  resourceDiscoveryQuestion,
  retrievalStrategySelection
}) {
  if (legalLookupPlan?.enabled) {
    if (legalLookupPlan.mode === "explicit_paragraph") {
      return Math.min(36, Math.max(24, (legalLookupPlan.paragraphRefs || []).length * 6));
    }
    if (legalLookupPlan.mode === "topic_to_paragraphs") {
      return Math.min(36, Math.max(24, RAG_TOP_K * 2));
    }
    return Math.min(24, Math.max(12, RAG_TOP_K));
  }
  if (sourceLookupRequest) return sourceLookupTopK;
  if (municipalityServiceBenefitListRequest) {
    return municipalityServiceBenefitIntent?.wantsServices && municipalityServiceBenefitIntent?.wantsBenefits
      ? Math.min(80, Math.max(56, RAG_TOP_K * 5))
      : Math.min(64, Math.max(40, RAG_TOP_K * 4));
  }
  if (municipalityServiceBenefitRagRequest) return Math.min(40, Math.max(24, RAG_TOP_K * 3));
  if (resourceDiscoveryQuestion) return Math.min(50, Math.max(36, RAG_TOP_K * 3));
  if (nationalServiceBenefitQuestion || serviceJurisdictionQuestion) return Math.min(36, Math.max(18, RAG_TOP_K * 3));
  if (allowMunicipalityScopedRag) return RAG_TOP_K;
  if (Number.isFinite(Number(retrievalStrategySelection?.rag_top_k_min))) {
    return Math.min(50, Math.max(Number(retrievalStrategySelection.rag_top_k_min), RAG_TOP_K * 3));
  }
  return Math.min(50, Math.max(RAG_TOP_K, RAG_TOP_K * 3));
}

function buildQueryPlanTrace({
  legalLookupPlan,
  externalSourcesNeeded,
  shouldRunRag,
  sourceLookupRequest,
  previousSourceUseRequest,
  temporalRetrievalPlan,
  questionPlan,
  resourceDiscoveryQuestion,
  overviewSynthesisQuestion,
  thematicSynthesisQuestion,
  broadMultiSourceQuestion,
  allowMunicipalityScopedRag,
  municipalityServiceBenefitListRequest,
  municipalityServiceBenefitRagRequest,
  nationalServiceBenefitQuestion,
  serviceJurisdictionQuestion,
  sourceLookupTargetsNationalLaw,
  ragQueries,
  primaryRagQueries,
  primaryRagFilters,
  ragSearchTopK,
  selectionStrategy,
  contextGroupTarget,
  ragRiskPolicy,
  effectiveMunicipalities,
  retrievalStrategySelection
}) {
  const hasPerQueryFilters = (Array.isArray(primaryRagQueries) ? primaryRagQueries : []).some(queryHasFilters);
  const sourceFocusedFollowup =
    !legalLookupPlan?.enabled &&
    !sourceLookupRequest &&
    !overviewSynthesisQuestion &&
    !resourceDiscoveryQuestion &&
    !broadMultiSourceQuestion &&
    !municipalityServiceBenefitListRequest &&
    !municipalityServiceBenefitRagRequest &&
    !allowMunicipalityScopedRag &&
    !retrievalStrategySelection?.force_rag &&
    (Array.isArray(ragQueries) ? ragQueries : []).some(queryHasFilters);
  const mode = legalLookupPlan?.enabled
    ? legalLookupPlan.mode
    : sourceLookupRequest
      ? sourceLookupTargetsNationalLaw
        ? "national_source_lookup"
        : "source_lookup"
      : temporalRetrievalPlan?.enabled
        ? "temporal"
        : municipalityServiceBenefitListRequest
          ? "municipality_service_benefit_list"
          : municipalityServiceBenefitRagRequest
            ? "municipality_service_benefit"
            : resourceDiscoveryQuestion
              ? "resource_discovery"
            : overviewSynthesisQuestion
              ? "overview_synthesis"
            : thematicSynthesisQuestion
              ? "thematic_synthesis"
            : broadMultiSourceQuestion
              ? "broad_multi_source"
              : nationalServiceBenefitQuestion
                ? "national_service_benefit"
                : serviceJurisdictionQuestion
                  ? "service_jurisdiction"
                  : sourceFocusedFollowup
                    ? "source_focused_followup"
                  : allowMunicipalityScopedRag
                    ? "municipality_scoped"
                      : retrievalStrategySelection?.force_rag && !retrievalStrategySelection?.route_override && retrievalStrategySelection?.mode && retrievalStrategySelection.mode !== "default"
                        ? retrievalStrategySelection.mode
                        : "default";
  const queryOrder = legalLookupPlan?.enabled
    ? legalLookupPlan.mode === "explicit_paragraph"
      ? "targeted_source_lookup"
      : "default"
    : temporalRetrievalPlan?.enabled
    ? "temporal_year_queries"
    : resourceDiscoveryQuestion || overviewSynthesisQuestion || broadMultiSourceQuestion
      ? "broad_first"
      : sourceFocusedFollowup
        ? "source_focus_first"
        : sourceLookupRequest
          ? "targeted_source_lookup"
          : retrievalStrategySelection?.query_order || "default";

  return {
    planner_version: "v2",
    mode,
    external_sources_needed: !!externalSourcesNeeded,
    should_run_rag: !!shouldRunRag,
    previous_source_use_request: !!previousSourceUseRequest,
    retrieval_strategy: retrievalStrategySelection?.retrieval_strategy || null,
    retrieval_strategy_selection: retrievalStrategySelection ? {
      planner_version: retrievalStrategySelection.planner_version || "v2.3",
      mode: retrievalStrategySelection.mode || null,
      retrieval_strategy: retrievalStrategySelection.retrieval_strategy || null,
      selection_strategy: retrievalStrategySelection.selection_strategy || null,
      query_order: retrievalStrategySelection.query_order || null,
      needs_multiple_sources: !!retrievalStrategySelection.needs_multiple_sources,
      preferred_source_count: retrievalStrategySelection.preferred_source_count || null,
      source_layer_filter_mode: retrievalStrategySelection.source_layer_filter_mode || null,
      answer_contract: retrievalStrategySelection.answer_contract || null,
      force_rag: !!retrievalStrategySelection.force_rag,
      route_override: !!retrievalStrategySelection.route_override,
      reason: retrievalStrategySelection.reason || null
    } : null,
    query_count: Array.isArray(primaryRagQueries) ? primaryRagQueries.length : 0,
    query_order: queryOrder,
    has_per_query_filters: hasPerQueryFilters,
    filter_keys: summarizeQueryFilters(primaryRagQueries, primaryRagFilters),
    municipality_names: Array.from(new Set(
      (Array.isArray(effectiveMunicipalities) ? effectiveMunicipalities : [])
        .map(item => String(item?.displayName || "").trim())
        .filter(Boolean)
    )),
    municipality_ids: Array.from(new Set(
      (Array.isArray(effectiveMunicipalities) ? effectiveMunicipalities : [])
        .map(item => String(item?.id || item?.municipalityId || item?.municipality_id || "").trim())
        .filter(Boolean)
    )),
    selection_strategy: selectionStrategy,
    needs_multiple_sources: !!(overviewSynthesisQuestion || resourceDiscoveryQuestion || questionPlan?.needs_multiple_sources),
    preferred_source_count: resourceDiscoveryQuestion
      ? questionPlan?.preferred_source_count || { min: 3, max: 8 }
      : overviewSynthesisQuestion ? {
        min: 5,
        max: 8
      } : questionPlan?.preferred_source_count || retrievalStrategySelection?.preferred_source_count || null,
    ...(questionPlan ? {
      question_planner: {
        planner_version: questionPlan.planner_version || "v2.2",
        mode: questionPlan.mode || "default",
        role: questionPlan.role || "unknown",
        input_role: questionPlan.input_role || null,
        role_confidence: Number.isFinite(Number(questionPlan.role_confidence)) ? Number(questionPlan.role_confidence) : null,
        confidence: Number.isFinite(Number(questionPlan.confidence)) ? Number(questionPlan.confidence) : null,
        needs_rag: !!questionPlan.needs_rag,
        needs_multiple_sources: !!questionPlan.needs_multiple_sources,
        preferred_source_count: questionPlan.preferred_source_count || null,
        topics: Array.isArray(questionPlan.topics) ? questionPlan.topics : [],
        life_situation: questionPlan.life_situation || null,
        needs_location: !!questionPlan.needs_location,
        municipality_hint: questionPlan.municipality_hint || null,
        risk_level: questionPlan.risk_level || null,
        source_layers: Array.isArray(questionPlan.source_layers) ? questionPlan.source_layers : [],
        avoid_source_layers: Array.isArray(questionPlan.avoid_source_layers) ? questionPlan.avoid_source_layers : [],
        source_layer_filter_mode: questionPlan.source_layer_filter_mode || (resourceDiscoveryQuestion ? "prefer" : null),
        retrieval_strategy: questionPlan.retrieval_strategy || null,
        answer_contract: questionPlan.answer_contract || null,
        planner_reason: questionPlan.planner_reason || null
      }
    } : {}),
    context_group_target: contextGroupTarget,
    rag_top_k: Number.isFinite(Number(ragSearchTopK)) ? Number(ragSearchTopK) : null,
    risk_level: ragRiskPolicy?.riskLevel || "low",
    required_evidence: ragRiskPolicy?.requiredEvidence || "medium",
    ...(resourceDiscoveryQuestion ? {
      source_layer_filter_mode: "prefer",
      resource_discovery_legal_background_policy: "suppress_legal_primary_when_non_legal_sources_exist"
    } : {}),
    ...(!resourceDiscoveryQuestion && retrievalStrategySelection?.source_layer_filter_mode ? {
      source_layer_filter_mode: retrievalStrategySelection.source_layer_filter_mode
    } : {}),
    legalLookupPlan: legalLookupPlan?.enabled
      ? {
          enabled: true,
          mode: legalLookupPlan.mode,
          jurisdictionLevel: legalLookupPlan.jurisdictionLevel,
          sourceTypes: legalLookupPlan.sourceTypes,
          collectionId: legalLookupPlan.collectionId,
          actTitle: legalLookupPlan.actTitle,
          actAliases: legalLookupPlan.actAliases,
          municipalityId: legalLookupPlan.municipalityId,
          paragraphRefs: legalLookupPlan.paragraphRefs,
          topicTerms: legalLookupPlan.topicTerms,
          requireCurrent: legalLookupPlan.requireCurrent
        }
      : { enabled: false },
    flags: {
      source_lookup: !!sourceLookupRequest,
      temporal: !!temporalRetrievalPlan?.enabled,
      resource_discovery: !!resourceDiscoveryQuestion,
      overview_synthesis: !!overviewSynthesisQuestion,
      comparison: !!(questionPlan?.mode === "comparison" && retrievalStrategySelection?.mode === "comparison"),
      thematic_synthesis: !!thematicSynthesisQuestion,
      broad_multi_source: !!broadMultiSourceQuestion,
      source_focused_followup: !!sourceFocusedFollowup,
      municipality_scoped: !!allowMunicipalityScopedRag,
      national_scope: !!(nationalServiceBenefitQuestion || serviceJurisdictionQuestion || sourceLookupTargetsNationalLaw || legalLookupPlan?.jurisdictionLevel === "NATIONAL")
    }
  };
}

export function buildRagQueryPlan({
  baseRagQueryText,
  effectiveMessage,
  rawHistory,
  sourceLookupRequest,
  sourceLookupParagraphRefs,
  temporalRetrievalPlan,
  overviewSynthesisQuestion,
  thematicSynthesisQuestion,
  nationalServiceBenefitQuestion,
  serviceJurisdictionQuestion,
  allowMunicipalityScopedRag,
  municipalityServiceBenefitRagRequest,
  municipalityServiceBenefitListRequest,
  municipalityServiceBenefitIntent,
  effectiveMunicipalities,
  audienceFilter,
  sourceLookupTargetsNationalLaw,
  externalSourcesNeeded,
  shouldRunRag,
  previousSourceUseRequest,
  broadMultiSourceQuestion,
  ragRiskPolicy,
  questionPlan = null,
  resourceDiscoveryQuestion = false
}) {
  const ragQueryText = String(baseRagQueryText || "").trim();
  const legalLookupPlan = detectLegalLookupPlan({
    message: effectiveMessage,
    sourceLookupRequest,
    fallbackParagraphRefs: sourceLookupParagraphRefs,
    effectiveMunicipalities
  });
  const effectiveOverviewSynthesisQuestion = !!overviewSynthesisQuestion || !!(
    thematicSynthesisQuestion &&
    broadMultiSourceQuestion &&
    !sourceLookupRequest &&
    !allowMunicipalityScopedRag &&
    !municipalityServiceBenefitRagRequest &&
    !municipalityServiceBenefitListRequest &&
    !nationalServiceBenefitQuestion &&
    !serviceJurisdictionQuestion &&
    !sourceLookupTargetsNationalLaw
  );

  const baseRagQueries = !ragQueryText
    ? []
    : legalLookupPlan.enabled
      ? buildLegalLookupQueryEntries(legalLookupPlan, effectiveMessage)
      : sourceLookupRequest
        ? buildSourceLookupRagQueries(ragQueryText)
        : temporalRetrievalPlan?.enabled
          ? [
              { query: ragQueryText },
              ...(temporalRetrievalPlan?.years || []).map((year) => ({
                query: buildTemporalYearSearchQuery(temporalRetrievalPlan.focusText || ragQueryText, year),
                filters: {
                  year
                }
              }))
            ]
          : buildSourceAnchoredRagQueries(effectiveMessage, rawHistory, ragQueryText);
  const effectiveResourceDiscoveryQuestion = !!(
    resourceDiscoveryQuestion &&
    !legalLookupPlan.enabled &&
    !sourceLookupRequest &&
    !sourceLookupTargetsNationalLaw &&
    !allowMunicipalityScopedRag &&
    !municipalityServiceBenefitRagRequest &&
    !municipalityServiceBenefitListRequest &&
    !nationalServiceBenefitQuestion &&
    !serviceJurisdictionQuestion
  );
  const effectiveLifeSituationGuidanceQuestion = !!(
    questionPlan?.mode === "life_situation_guidance" &&
    !legalLookupPlan.enabled &&
    !sourceLookupRequest &&
    !sourceLookupTargetsNationalLaw &&
    !allowMunicipalityScopedRag &&
    !municipalityServiceBenefitRagRequest &&
    !municipalityServiceBenefitListRequest &&
    !nationalServiceBenefitQuestion &&
    !serviceJurisdictionQuestion
  );
  const effectiveComparisonQuestion = !!(
    questionPlan?.mode === "comparison" &&
    !legalLookupPlan.enabled &&
    !sourceLookupRequest &&
    !sourceLookupTargetsNationalLaw &&
    !allowMunicipalityScopedRag &&
    !municipalityServiceBenefitRagRequest &&
    !municipalityServiceBenefitListRequest &&
    !nationalServiceBenefitQuestion &&
    !serviceJurisdictionQuestion
  );
  const retrievalStrategySelection = selectRetrievalStrategy({
    questionPlan,
    routeContext: {
      legalLookupEnabled: legalLookupPlan.enabled,
      legalLookupMode: legalLookupPlan.mode,
      sourceLookupRequest,
      sourceLookupTargetsNationalLaw,
      temporalEnabled: temporalRetrievalPlan?.enabled,
      municipalityServiceBenefitListRequest,
      municipalityServiceBenefitRagRequest,
      allowMunicipalityScopedRag,
      nationalServiceBenefitQuestion,
      serviceJurisdictionQuestion,
      comparisonQuestion: effectiveComparisonQuestion,
      resourceDiscoveryQuestion: effectiveResourceDiscoveryQuestion,
      lifeSituationGuidanceQuestion: effectiveLifeSituationGuidanceQuestion,
      overviewSynthesisQuestion: effectiveOverviewSynthesisQuestion,
      broadMultiSourceQuestion
    }
  });
  const ragQueries = effectiveResourceDiscoveryQuestion
    ? buildResourceDiscoveryQueries(baseRagQueries, ragQueryText)
    : effectiveLifeSituationGuidanceQuestion
      ? buildLifeSituationGuidanceQueries(baseRagQueries, ragQueryText, questionPlan)
      : effectiveComparisonQuestion
        ? buildComparisonQueries(baseRagQueries, ragQueryText, questionPlan)
        : baseRagQueries;

  const sourceLookupTopK = sourceLookupRequest && !legalLookupPlan.enabled
    ? sourceLookupTargetsNationalLaw
      ? (Array.isArray(sourceLookupParagraphRefs) && sourceLookupParagraphRefs.length <= 1
          ? Math.min(36, Math.max(24, RAG_TOP_K * 2))
          : Math.min(50, Math.max(24, RAG_TOP_K * 2, (sourceLookupParagraphRefs || []).length * 6)))
      : (Array.isArray(sourceLookupParagraphRefs) && sourceLookupParagraphRefs.length <= 1
          ? Math.min(12, Math.max(8, RAG_TOP_K))
          : Math.min(36, Math.max(RAG_TOP_K, (sourceLookupParagraphRefs || []).length * 5)))
    : null;

  const primaryRagQueries =
    legalLookupPlan.enabled
      ? ragQueries
      : !sourceLookupRequest && (nationalServiceBenefitQuestion || serviceJurisdictionQuestion)
        ? ragQueries
        : !sourceLookupRequest && allowMunicipalityScopedRag
          ? buildMunicipalityScopedQueries(ragQueries, effectiveMunicipalities, {
              expandServiceBenefitList: municipalityServiceBenefitRagRequest,
              serviceBenefitIntent: municipalityServiceBenefitIntent
            })
          : ragQueries;

  const primaryRagFilters =
    legalLookupPlan.enabled
      ? audienceFilter
      : !sourceLookupRequest && (nationalServiceBenefitQuestion || serviceJurisdictionQuestion)
        ? {
            ...audienceFilter,
            jurisdiction_level: "NATIONAL"
          }
        : !sourceLookupRequest && (effectiveOverviewSynthesisQuestion || thematicSynthesisQuestion) && !allowMunicipalityScopedRag
          ? buildThematicSynthesisFilters(audienceFilter)
        : !sourceLookupRequest && allowMunicipalityScopedRag
          ? buildMunicipalityScopedFilters(audienceFilter, effectiveMunicipalities)
          : audienceFilter;

  const searchFilters = legalLookupPlan.enabled
    ? audienceFilter
    : sourceLookupTargetsNationalLaw
      ? {
          ...audienceFilter,
          jurisdiction_level: "NATIONAL"
        }
      : primaryRagFilters;

  const ragSearchTopK = determineRagTopK({
    legalLookupPlan,
    sourceLookupRequest,
    sourceLookupTopK,
    municipalityServiceBenefitListRequest,
    municipalityServiceBenefitRagRequest,
    municipalityServiceBenefitIntent,
    nationalServiceBenefitQuestion,
    serviceJurisdictionQuestion,
    allowMunicipalityScopedRag,
    resourceDiscoveryQuestion: effectiveResourceDiscoveryQuestion,
    retrievalStrategySelection
  });
  const selectionStrategy = determineSelectionStrategy({
    legalLookupPlan,
    temporalRetrievalPlan,
    municipalityServiceBenefitListRequest,
    resourceDiscoveryQuestion: effectiveResourceDiscoveryQuestion,
    overviewSynthesisQuestion: effectiveOverviewSynthesisQuestion,
    broadMultiSourceQuestion,
    retrievalStrategySelection
  });
  const contextGroupTarget = determineContextGroupTarget({
    legalLookupPlan,
    sourceLookupRequest,
    sourceLookupTargetsNationalLaw,
    sourceLookupParagraphRefs,
    temporalRetrievalPlan,
    resourceDiscoveryQuestion: effectiveResourceDiscoveryQuestion,
    overviewSynthesisQuestion: effectiveOverviewSynthesisQuestion,
    thematicSynthesisQuestion,
    municipalityServiceBenefitListRequest,
    municipalityServiceBenefitIntent,
    broadMultiSourceQuestion,
    retrievalStrategySelection
  });
  const queryPlan = buildQueryPlanTrace({
    legalLookupPlan,
    externalSourcesNeeded,
    shouldRunRag,
    sourceLookupRequest,
    previousSourceUseRequest,
    temporalRetrievalPlan,
    questionPlan,
    resourceDiscoveryQuestion: effectiveResourceDiscoveryQuestion,
    overviewSynthesisQuestion: effectiveOverviewSynthesisQuestion,
    thematicSynthesisQuestion,
    broadMultiSourceQuestion,
    allowMunicipalityScopedRag,
    municipalityServiceBenefitListRequest,
    municipalityServiceBenefitRagRequest,
    nationalServiceBenefitQuestion,
    serviceJurisdictionQuestion,
    sourceLookupTargetsNationalLaw,
    ragQueries,
    primaryRagQueries,
    primaryRagFilters: searchFilters,
    ragSearchTopK,
    selectionStrategy,
    contextGroupTarget,
    ragRiskPolicy,
    effectiveMunicipalities,
    retrievalStrategySelection
  });

  return {
    ragQueryText,
    legalLookupPlan,
    ragQueries,
    primaryRagQueries,
    primaryRagFilters,
    searchFilters,
    sourceLookupTopK,
    ragSearchTopK,
    selectionStrategy,
    contextGroupTarget,
    retrievalStrategySelection,
    queryPlan
  };
}
