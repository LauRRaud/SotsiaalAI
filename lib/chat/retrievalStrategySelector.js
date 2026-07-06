const STRATEGY_BY_MODE = Object.freeze({
  legal_exact: {
    retrieval_strategy: "legal_exact",
    selection_strategy: "legal_exact",
    query_order: "targeted_source_lookup",
    answer_contract: "legal_exact_source_required",
    reason: "planner_mode_legal_exact"
  },
  kov_service_or_benefit: {
    retrieval_strategy: "kov_source_package_or_scoped_rag",
    selection_strategy: "municipality_service_benefit_balance",
    query_order: "source_focus_first",
    answer_contract: "municipality_source_package_preferred",
    reason: "planner_mode_kov_service_or_benefit"
  },
  overview_synthesis: {
    retrieval_strategy: "overview_diversity_then_depth",
    selection_strategy: "overview_diversity_then_depth",
    query_order: "broad_first",
    needs_multiple_sources: true,
    preferred_source_count: { min: 5, max: 8 },
    context_group_target_min: 14,
    reason: "planner_mode_overview_synthesis"
  },
  resource_discovery: {
    retrieval_strategy: "resource_discovery_hybrid",
    selection_strategy: "resource_discovery_diversity",
    query_order: "broad_first",
    needs_multiple_sources: true,
    preferred_source_count: { min: 3, max: 8 },
    source_layer_filter_mode: "prefer",
    context_group_target_min: 10,
    rag_top_k_min: 36,
    reason: "planner_mode_resource_discovery"
  },
  life_situation_guidance: {
    retrieval_strategy: "life_situation_guidance_hybrid",
    selection_strategy: "multi_source_diversity",
    query_order: "broad_first",
    needs_multiple_sources: true,
    preferred_source_count: { min: 3, max: 6 },
    source_layer_filter_mode: "prefer",
    context_group_target_min: 10,
    rag_top_k_min: 36,
    answer_contract: "client_next_steps_no_entitlement_promise",
    reason: "planner_mode_life_situation_guidance"
  },
  comparison: {
    retrieval_strategy: "comparison_balanced_sources",
    selection_strategy: "multi_source_diversity",
    query_order: "broad_first",
    needs_multiple_sources: true,
    preferred_source_count: { min: 2, max: 6 },
    source_layer_filter_mode: "prefer",
    context_group_target_min: 8,
    rag_top_k_min: 36,
    answer_contract: "compare_each_side_with_source_support",
    reason: "planner_mode_comparison"
  },
  specific_document_summary: {
    retrieval_strategy: "specific_document_lookup",
    selection_strategy: "source_focus_first",
    query_order: "targeted_source_lookup",
    needs_multiple_sources: false,
    answer_contract: "summarize_requested_document_only",
    reason: "planner_mode_specific_document_summary"
  }
});

function modeOf(questionPlan = {}) {
  return String(questionPlan?.mode || "default").trim() || "default";
}

function makeDefaultSelection(questionPlan = {}, reason = "planner_mode_default") {
  return {
    planner_version: "v2.3",
    mode: modeOf(questionPlan),
    retrieval_strategy: questionPlan?.retrieval_strategy || "default_hybrid",
    selection_strategy: "mmr_diversity",
    query_order: "default",
    needs_multiple_sources: !!questionPlan?.needs_multiple_sources,
    preferred_source_count: questionPlan?.preferred_source_count || null,
    source_layers: Array.isArray(questionPlan?.source_layers) ? questionPlan.source_layers : [],
    avoid_source_layers: Array.isArray(questionPlan?.avoid_source_layers) ? questionPlan.avoid_source_layers : [],
    source_layer_filter_mode: questionPlan?.source_layer_filter_mode || null,
    answer_contract: questionPlan?.answer_contract || "grounded_answer",
    force_rag: questionPlan?.mode && questionPlan.mode !== "default" && questionPlan.needs_rag === true,
    route_override: false,
    reason
  };
}

function routeOverride(routeContext = {}) {
  if (routeContext?.legalLookupEnabled) {
    return {
      retrieval_strategy: routeContext?.legalLookupMode === "explicit_paragraph" ? "legal_exact" : "legal_lookup",
      selection_strategy: routeContext?.legalLookupMode === "explicit_paragraph" ? "legal_exact" : "mmr_diversity",
      query_order: routeContext?.legalLookupMode === "explicit_paragraph" ? "targeted_source_lookup" : "default",
      reason: "route_override_legal_lookup"
    };
  }
  if (routeContext?.sourceLookupRequest) {
    return {
      retrieval_strategy: routeContext?.sourceLookupTargetsNationalLaw ? "national_source_lookup" : "source_lookup",
      selection_strategy: "mmr_diversity",
      query_order: "targeted_source_lookup",
      reason: "route_override_source_lookup"
    };
  }
  if (routeContext?.temporalEnabled) {
    return {
      retrieval_strategy: "temporal_year_coverage",
      selection_strategy: "temporal_year_coverage",
      query_order: "temporal_year_queries",
      reason: "route_override_temporal"
    };
  }
  if (routeContext?.municipalityServiceBenefitListRequest) {
    return {
      retrieval_strategy: "kov_service_benefit_list",
      selection_strategy: "municipality_service_benefit_balance",
      query_order: "default",
      reason: "route_override_municipality_service_benefit_list"
    };
  }
  if (routeContext?.municipalityServiceBenefitRagRequest || routeContext?.allowMunicipalityScopedRag) {
    return {
      retrieval_strategy: "municipality_scoped_rag",
      selection_strategy: "mmr_diversity",
      query_order: "default",
      reason: "route_override_municipality_scoped"
    };
  }
  if (routeContext?.nationalServiceBenefitQuestion) {
    return {
      retrieval_strategy: "national_service_benefit",
      selection_strategy: "mmr_diversity",
      query_order: "default",
      reason: "route_override_national_service_benefit"
    };
  }
  if (routeContext?.serviceJurisdictionQuestion) {
    return {
      retrieval_strategy: "service_jurisdiction",
      selection_strategy: "mmr_diversity",
      query_order: "default",
      reason: "route_override_service_jurisdiction"
    };
  }
  return null;
}

export function selectRetrievalStrategy({ questionPlan = {}, routeContext = {} } = {}) {
  const base = makeDefaultSelection(questionPlan);
  const override = routeOverride(routeContext);
  if (override) {
    return {
      ...base,
      ...override,
      route_override: true
    };
  }

  const mode = modeOf(questionPlan);
  const mapped = STRATEGY_BY_MODE[mode];
  if (!mapped) return base;

  return {
    ...base,
    ...mapped,
    mode,
    source_layers: Array.isArray(questionPlan?.source_layers) ? questionPlan.source_layers : base.source_layers,
    avoid_source_layers: Array.isArray(questionPlan?.avoid_source_layers) ? questionPlan.avoid_source_layers : base.avoid_source_layers,
    source_layer_filter_mode: questionPlan?.source_layer_filter_mode || mapped.source_layer_filter_mode || null,
    preferred_source_count: questionPlan?.preferred_source_count || mapped.preferred_source_count || null,
    answer_contract: questionPlan?.answer_contract || mapped.answer_contract || base.answer_contract
  };
}
