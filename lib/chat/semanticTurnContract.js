const EXPLICIT_SOURCE_ANAPHORA_PATTERNS = Object.freeze([
  /\b(?:samas|selles|eelmises|viimases)\s+(?:artiklis|allikas|dokumendis|uuringus|raportis|loos)\b/u,
  /\b(?:selle|sama|eelmise|viimase)\s+(?:artikli|allika|dokumendi|uuringu|raporti|loo)\s+(?:jargi|järgi|pohjal|põhjal|kohta)\b/u,
  /\b(?:nende|samade|eelmiste)\s+(?:artiklite|allikate|dokumentide|uuringute|raportite)\b/u,
  /\b(?:in|from)\s+(?:the\s+)?(?:same|previous|last)\s+(?:article|source|document|study|report)\b/u,
  /\baccording\s+to\s+(?:that|the\s+same|the\s+previous)\s+(?:article|source|document|study|report)\b/u,
  /\b(?:в|из)\s+(?:той\s+же|этой|предыдущей)\s+(?:статье|источнике|документе|исследовании|отчете)\b/u
]);

const RECOGNIZED_SOCIAL_COLLECTIONS = new Set([
  "contacts",
  "journal_articles",
  "national_guidelines",
  "organization_guidelines",
  "organization_materials",
  "organizations",
  "partner_service_info",
  "policy_analyses",
  "public_body_info",
  "research_reports",
  "service_provider_info",
  "sotsiaaltoo_articles",
  "studies"
]);

const RECOGNIZED_SOCIAL_SOURCE_TYPES = new Set([
  "academic_paper",
  "analysis",
  "contact_page",
  "contacts",
  "evaluation_report",
  "information_material",
  "journal_article",
  "kov_regulation",
  "kov_service",
  "kov_service_info",
  "kov_web",
  "methodology_guide",
  "municipal_regulation",
  "municipality_kov",
  "municipality_service",
  "municipality_web",
  "national_law",
  "official_contact",
  "official_guideline",
  "official_report",
  "organization_page",
  "organization_profile",
  "partner_service_info",
  "policy_analysis",
  "policy_report",
  "practice_example",
  "public_body_info",
  "research",
  "research_report",
  "service_map_contact",
  "service_provider_info",
  "state_guide",
  "statistical_report",
  "statistics",
  "study",
  "survey_report"
]);

const STRONG_DOMAIN_SOURCE_TYPES = new Set([
  "academic_paper",
  "analysis",
  "journal_article",
  "kov_regulation",
  "kov_service",
  "kov_service_info",
  "methodology_guide",
  "municipal_regulation",
  "municipality_service",
  "national_law",
  "official_guideline",
  "official_report",
  "policy_analysis",
  "policy_report",
  "research",
  "research_report",
  "state_guide",
  "statistical_report",
  "statistics",
  "study",
  "survey_report"
]);

const STRONG_DOMAIN_COLLECTIONS = new Set([
  "journal_articles",
  "national_guidelines",
  "policy_analyses",
  "research_reports",
  "sotsiaaltoo_articles",
  "studies"
]);

const DOMAIN_CONFIRMATION_GENERIC_TERMS = new Set([
  "aga", "artikl", "artikkel", "artiklid", "artikkel", "autor", "enda", "ja", "kas", "kes",
  "kirjutanud", "kirjutas", "kuidas", "millal", "millest", "milline", "millised", "mis", "mida",
  "ning", "olema", "oli", "on", "see", "sellest", "sotsiaal", "tema", "teema", "teemad", "uuring",
  "who", "what", "when", "where", "which", "write", "wrote", "author", "article", "study"
]);

export function normalizeSemanticText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}%]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function semanticTokens(value = "", { minLength = 1 } = {}) {
  const minimum = Math.max(1, Number(minLength) || 1);
  return normalizeSemanticText(value)
    .split(" ")
    .map(token => token.trim())
    .filter(token => token.length >= minimum);
}

export function hasExplicitSourceAnaphora(message = "") {
  const normalized = normalizeSemanticText(message);
  return !!normalized && EXPLICIT_SOURCE_ANAPHORA_PATTERNS.some(pattern => pattern.test(normalized));
}

function classifyTemporalType(message = "", requestedYearRole = "none") {
  const normalized = normalizeSemanticText(message);
  if (!normalized) return "none";
  if (requestedYearRole === "publication_year" || requestedYearRole === "evidence_year") {
    return "calendar_year";
  }
  if (/\b(?:mis aastal|millisel aastal|what year|which year|каком году)\b/u.test(normalized)) {
    return "calendar_year";
  }
  if (/\b(?:kui kaua|kaua kest|kestus|mitu paeva|mitu nadalat|mitu kuud|how long|duration|сколько времени|как долго)\b/u.test(normalized)) {
    return "duration";
  }
  if (/\b(?:mis ajavahem|millisel periood|ajavahemikul|perioodil|between|during|period|в период|периоде)\b/u.test(normalized)) {
    return "period";
  }
  if (/\b(?:millal|when|когда)\b/u.test(normalized)) return "timepoint_or_condition";
  return "none";
}

function boundedStringList(values, limit = 32, maxLength = 120) {
  const out = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const text = String(value || "").trim().slice(0, maxLength);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

function morphologyTerms(morphology = null) {
  const tokens = Array.isArray(morphology?.tokens) ? morphology.tokens : [];
  return {
    lemmas: boundedStringList(tokens.flatMap(token => token?.lemmas || []), 48),
    compound_roots: boundedStringList(tokens.flatMap(token => token?.root_tokens || []), 48),
    proper_name_spans: boundedStringList(
      (morphology?.proper_name_spans || []).map(span =>
        typeof span === "string" ? span : span?.canonical_text || span?.text
      ),
      12,
      160
    )
  };
}

export function buildSemanticTurnContract({
  message = "",
  languagePlan = null,
  questionPlan = null,
  morphology = null
} = {}) {
  const morphologyData = morphologyTerms(morphology);
  const plannedScope = ["in_scope", "out_of_scope", "unknown"].includes(questionPlan?.social_scope)
    ? questionPlan.social_scope
    : "unknown";
  const requestedYearRole = ["publication_year", "evidence_year", "none", "ambiguous"].includes(
    questionPlan?.requested_year_role
  ) ? questionPlan.requested_year_role : "none";
  const explicitSourceReference = hasExplicitSourceAnaphora(message);
  const personNames = boundedStringList([
    questionPlan?.person_name,
    ...(Array.isArray(questionPlan?.entity_names) ? questionPlan.entity_names : []),
    ...morphologyData.proper_name_spans
  ], 12, 160);
  const entityCandidates = (Array.isArray(questionPlan?.entity_candidates)
    ? questionPlan.entity_candidates
    : []).slice(0, 12).map(entity => ({
      type: String(entity?.type || "unknown").slice(0, 40),
      canonical: String(entity?.canonical || entity?.surface || "").trim().slice(0, 160),
      provenance: String(entity?.provenance || "unknown").slice(0, 40)
    })).filter(entity => entity.canonical);
  if (questionPlan?.municipality_hint) {
    entityCandidates.push({
      type: "municipality",
      canonical: String(questionPlan.municipality_hint).trim().slice(0, 160),
      provenance: "municipality_resolver"
    });
  }
  const currentDocumentIdentity = questionPlan?.semantic_candidates?.current_turn_document_identity || {};
  const organizationEntity = entityCandidates.find(entity => entity.type === "organization") || null;
  const requestedFacts = questionPlan?.semantic_candidates?.requested_fact_slots;
  return {
    version: "semantic_turn_contract_v2",
    language: String(languagePlan?.queryLanguage || "unknown").slice(0, 20),
    input_form: String(questionPlan?.semantic_input_form || "original").slice(0, 32),
    domain_scope: {
      planned: plannedScope,
      effective: plannedScope,
      reason: String(questionPlan?.social_scope_reason || "not_classified").slice(0, 100),
      promoted_by_retrieval: false
    },
    intent: String(questionPlan?.mode || "default").slice(0, 80),
    source_scope: explicitSourceReference ? "previous_explicit_source" : "independent_or_unspecified",
    history_reference: {
      explicit_source_anaphora: explicitSourceReference,
      carry_previous_source_filter: explicitSourceReference
    },
    persons: personNames,
    entities: entityCandidates,
    document_identity: {
      author_surface: String(currentDocumentIdentity?.author?.value || questionPlan?.person_name || "").trim() || null,
      author_key: String(currentDocumentIdentity?.author_key || "").trim() || null,
      organization: String(currentDocumentIdentity?.organization?.value || organizationEntity?.canonical || "").trim() || null,
      document_kind: String(currentDocumentIdentity?.document_kind?.value || questionPlan?.document_source_kind || "").trim() || null,
      title_hint: String(currentDocumentIdentity?.title_hint?.value || "").trim() || null,
      title_tokens: boundedStringList(currentDocumentIdentity?.title_tokens, 16, 80),
      source_years: boundedStringList(
        (currentDocumentIdentity?.document_source_years || []).map(item => item?.value || item),
        8,
        8
      ),
      acronyms: boundedStringList(currentDocumentIdentity?.acronyms, 8, 32),
      named_topics: boundedStringList(currentDocumentIdentity?.named_topics, 16, 80),
      confidence: String(currentDocumentIdentity?.confidence || "low").slice(0, 16),
      provenance: String(currentDocumentIdentity?.provenance || "none").slice(0, 40)
    },
    temporal: {
      type: classifyTemporalType(message, requestedYearRole),
      requested_year_role: requestedYearRole,
      document_source_years: boundedStringList(questionPlan?.document_source_years, 8, 8),
      evidence_years: boundedStringList(questionPlan?.evidence_period_years, 8, 8)
    },
    requested_facts: Array.isArray(requestedFacts?.slots) ? requestedFacts.slots.slice(0, 12) : [],
    requested_fact_contract: requestedFacts && typeof requestedFacts === "object"
      ? {
          version: String(requestedFacts.version || "requested_fact_slots_v1").slice(0, 40),
          complete: requestedFacts.complete === true,
          expected_cardinality: Number.isInteger(Number(requestedFacts.expected_cardinality))
            ? Number(requestedFacts.expected_cardinality)
            : null
        }
      : null,
    risk_scope: questionPlan?.current_evidence_scope === "source_bounded"
      ? "source_bounded_description"
      : questionPlan?.current_evidence_scope === "current"
        ? "current_status"
        : "general",
    terms: {
      surface: boundedStringList(semanticTokens(message), 64),
      lemmas: morphologyData.lemmas,
      compound_roots: morphologyData.compound_roots,
      retrieval_et: boundedStringList([
        ...(Array.isArray(languagePlan?.retrievalTermsEt) ? languagePlan.retrievalTermsEt : []),
        ...(Array.isArray(languagePlan?.controlledTopicTermsEt) ? languagePlan.controlledTopicTermsEt : []),
        questionPlan?.municipality_hint
      ], 24, 160)
    },
    morphology: {
      available: morphology?.available === true,
      analyzer_version: String(morphology?.analyzer_version || "").slice(0, 80) || null,
      reason: String(morphology?.reason || "").slice(0, 80) || null,
      language_hint: String(morphology?.language_hint || "").slice(0, 8) || null,
      language_hint_confidence: Number.isFinite(Number(morphology?.language_hint_confidence))
        ? Number(morphology.language_hint_confidence)
        : null,
      proper_name_spans: morphologyData.proper_name_spans
    }
  };
}

function isRecognizedSocialSource(source = {}) {
  const sourceType = String(source?.sourceType || source?.source_type || source?.type || "").trim().toLowerCase();
  const collectionId = String(source?.collectionId || source?.collection_id || "").trim().toLowerCase();
  return RECOGNIZED_SOCIAL_SOURCE_TYPES.has(sourceType) || RECOGNIZED_SOCIAL_COLLECTIONS.has(collectionId);
}

function semanticSourceText(source = {}) {
  return normalizeSemanticText([
    source?.title,
    source?.short_ref,
    source?.section,
    source?.paragraphTitle,
    source?.journalTitle,
    ...(Array.isArray(source?.authors) ? source.authors : []),
    ...(Array.isArray(source?.tags) ? source.tags : []),
    ...(Array.isArray(source?.bodies) ? source.bodies : []),
    source?.evidenceText,
    source?.body
  ].filter(Boolean).join("\n"));
}

function semanticAnchorMatchesSource(anchor = "", sourceText = "") {
  const anchorTokens = semanticTokens(anchor, { minLength: 3 });
  if (!anchorTokens.length || !sourceText) return false;
  const sourceTokens = semanticTokens(sourceText, { minLength: 3 });
  return anchorTokens.every(anchorToken => sourceTokens.some(sourceToken => {
    if (anchorToken === sourceToken) return true;
    const shorterLength = Math.min(anchorToken.length, sourceToken.length);
    return shorterLength >= 5 && (
      anchorToken.startsWith(sourceToken) ||
      sourceToken.startsWith(anchorToken) ||
      anchorToken.slice(0, 5) === sourceToken.slice(0, 5)
    );
  }));
}

function sourceSemanticAnchorEvidence(contract = null, source = {}) {
  const sourceText = semanticSourceText(source);
  if (!sourceText) return { matched: false, namedMatches: [], topicMatches: [] };
  const namedAnchors = [
    ...(Array.isArray(contract?.persons) ? contract.persons : []),
    ...(Array.isArray(contract?.entities)
      ? contract.entities.map(entity => entity?.canonical)
      : [])
  ].map(value => String(value || "").trim()).filter(Boolean);
  const namedMatches = namedAnchors.filter(anchor => semanticAnchorMatchesSource(anchor, sourceText));

  const topicAnchors = [
    ...(Array.isArray(contract?.terms?.lemmas) ? contract.terms.lemmas : []),
    ...(Array.isArray(contract?.terms?.compound_roots) ? contract.terms.compound_roots : []),
    ...(Array.isArray(contract?.terms?.surface) ? contract.terms.surface : []),
    ...(Array.isArray(contract?.terms?.retrieval_et) ? contract.terms.retrieval_et : [])
  ].map(value => normalizeSemanticText(value))
    .filter(value => value.length >= 4 && !/^\d+$/u.test(value))
    .filter(value => !DOMAIN_CONFIRMATION_GENERIC_TERMS.has(value));
  const topicMatches = topicAnchors.filter(anchor => semanticAnchorMatchesSource(anchor, sourceText));
  return {
    matched: namedMatches.length > 0 || topicMatches.length > 0,
    namedMatches,
    topicMatches
  };
}

function semanticSourceDomainStrength(source = {}, anchorEvidence = null) {
  if (!isRecognizedSocialSource(source) || anchorEvidence?.matched !== true) return "none";
  if (anchorEvidence.namedMatches.length) return "strong";
  const sourceType = String(source?.sourceType || source?.source_type || source?.type || "").trim().toLowerCase();
  const collectionId = String(source?.collectionId || source?.collection_id || "").trim().toLowerCase();
  if (STRONG_DOMAIN_SOURCE_TYPES.has(sourceType) || STRONG_DOMAIN_COLLECTIONS.has(collectionId)) {
    return "strong";
  }
  return "weak";
}

function semanticSourceId(source = {}) {
  return String(
    source?.sourceId || source?.source_id || source?.id || source?.key || source?.docId || source?.documentId || ""
  ).trim().slice(0, 240);
}

export function promoteSemanticDomainScope(contract = null, sources = []) {
  if (!contract || typeof contract !== "object") return contract;
  const evidence = (Array.isArray(sources) ? sources : []).map(source => {
    const anchorEvidence = sourceSemanticAnchorEvidence(contract, source);
    return {
      source,
      strength: semanticSourceDomainStrength(source, anchorEvidence),
      namedAnchorCount: anchorEvidence.namedMatches.length,
      topicAnchorCount: anchorEvidence.topicMatches.length
    };
  });
  const strongSources = evidence.filter(item => item.strength === "strong");
  const weakSources = evidence.filter(item => item.strength === "weak");
  const postRetrievalEvidence = {
    strength: strongSources.length ? "strong" : weakSources.length ? "weak" : "none",
    reason: strongSources.length
      ? "recognized_authoritative_or_research_source_and_semantic_anchor"
      : weakSources.length
        ? "recognized_social_source_with_weak_semantic_anchor"
        : "no_recognized_social_source_with_semantic_anchor",
    source_ids: Array.from(new Set(
      (strongSources.length ? strongSources : weakSources)
        .map(item => semanticSourceId(item.source))
        .filter(Boolean)
    )).slice(0, 8),
    named_anchor_matches: (strongSources.length ? strongSources : weakSources)
      .reduce((sum, item) => sum + item.namedAnchorCount, 0),
    topic_anchor_matches: (strongSources.length ? strongSources : weakSources)
      .reduce((sum, item) => sum + item.topicAnchorCount, 0)
  };
  if (contract?.domain_scope?.effective !== "unknown" || !strongSources.length) {
    return {
      ...contract,
      domain_scope: {
        ...contract.domain_scope,
        post_retrieval_evidence: postRetrievalEvidence
      }
    };
  }
  return {
    ...contract,
    domain_scope: {
      ...contract.domain_scope,
      effective: "in_scope",
      reason: "strong_post_retrieval_social_domain_evidence",
      promoted_by_retrieval: true,
      confirmation_source_ids: postRetrievalEvidence.source_ids,
      post_retrieval_evidence: postRetrievalEvidence
    }
  };
}
