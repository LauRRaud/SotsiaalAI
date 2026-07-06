import { isLegalSource } from "./sourceMetadata.js";

function traceData(row) {
  if (row?.data && typeof row.data === "object") return row.data;
  return row && typeof row === "object" ? row : {};
}

function uniqueIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(id => String(id || "").trim()).filter(Boolean))];
}

function numericCount(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function idsOrCount(data, idsField, countField) {
  const ids = uniqueIds(data?.[idsField]);
  const count = ids.length || numericCount(data?.[countField], 0);
  return { ids, count };
}

function addDistributionCount(target, key) {
  const normalized = String(key || "").trim();
  if (!normalized) return;
  target[normalized] = (target[normalized] || 0) + 1;
}

function sourceDisplayMode(data = {}) {
  return String(data.source_display_mode || data.display_mode || "").trim() || "unknown";
}

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function expectedMunicipalityScope(data = {}) {
  const queryPlan = data?.query_plan && typeof data.query_plan === "object" ? data.query_plan : {};
  const names = uniqueIds(queryPlan.municipality_names || queryPlan.municipalityNames).map(normalizeKey).filter(Boolean);
  const ids = uniqueIds(queryPlan.municipality_ids || queryPlan.municipalityIds).map(normalizeKey).filter(Boolean);
  const filterName = queryPlan?.filters?.municipality_name || queryPlan?.search_filters?.municipality_name;
  const filterId = queryPlan?.filters?.municipality_id || queryPlan?.search_filters?.municipality_id;
  if (filterName) names.push(normalizeKey(filterName));
  if (filterId) ids.push(normalizeKey(filterId));
  return {
    names: new Set(names),
    ids: new Set(ids)
  };
}

function selectedContextDetails(data = {}) {
  return Array.isArray(data.selected_context_details) ? data.selected_context_details : [];
}

function legalLookupPlan(data = {}) {
  const queryPlan = data?.query_plan && typeof data.query_plan === "object" ? data.query_plan : {};
  return queryPlan?.legalLookupPlan && typeof queryPlan.legalLookupPlan === "object"
    ? queryPlan.legalLookupPlan
    : null;
}

function legalAllowedParagraphRefs(data = {}) {
  const plan = legalLookupPlan(data);
  return uniqueIds(plan?.paragraphRefs);
}

function displayedLegalDecisionDetails(data = {}) {
  return (Array.isArray(data.attribution_decisions) ? data.attribution_decisions : [])
    .filter((decision) => decision?.decision === "display" && isLegalSource({ source_type: decision?.source_type }));
}

function overviewSynthesisDetails(data = {}) {
  const nested = data?.overview_synthesis && typeof data.overview_synthesis === "object"
    ? data.overview_synthesis
    : null;
  if (nested) return nested;
  if (
    data?.overview_synthesis_used === true ||
    data?.mode === "overview_synthesis" ||
    data?.query_plan?.mode === "overview_synthesis"
  ) {
    return data;
  }
  return null;
}

function numericRatio(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function summarizeRagTraceSourceQuality(rows = [], options = {}) {
  const issueLimit = numericCount(options.issueLimit, 25);
  const summary = {
    traces: 0,
    traces_with_retrieved_sources: 0,
    traces_with_answer_sources: 0,
    traces_with_displayed_sources: 0,
    retrieved_source_count: 0,
    selected_context_source_count: 0,
    answer_source_count: 0,
    displayed_source_count: 0,
    displayed_source_valid_count: 0,
    displayed_source_violation_count: 0,
    displayed_selected_source_valid_count: 0,
    displayed_selected_source_violation_count: 0,
    traces_with_display_contract_violation: 0,
    traces_with_display_selected_contract_violation: 0,
    retrieved_but_not_displayed_count: 0,
    traces_with_retrieved_but_not_displayed: 0,
    selected_but_not_displayed_count: 0,
    traces_with_selected_but_not_displayed: 0,
    filtered_out_source_count: 0,
    displayed_source_precision: 1,
    displayed_source_precision_basis: 0,
    display_contract_violation_rate: 0,
    retrieved_filter_rate: 0,
    selected_filter_rate: 0,
    municipality_scope_expected_traces: 0,
    municipality_source_count: 0,
    wrong_municipality_source_count: 0,
    traces_with_wrong_municipality: 0,
    wrong_municipality_rate: 0,
    legal_displayed_paragraph_precision: 1,
    legal_displayed_paragraph_precision_basis: 0,
    legal_displayed_wrong_paragraph_count: 0,
    legal_selected_paragraph_precision: 1,
    legal_selected_paragraph_precision_basis: 0,
    legal_selected_wrong_paragraph_count: 0,
    legal_wrong_paragraph_count: 0,
    legal_wrong_paragraph_examples: [],
    legal_current_source_violation_count: 0,
    displayed_source_contract_violation_rate: 0,
    displayed_selected_source_contract_violation_rate: 0,
    source_display_mode_distribution: {},
    attribution_decision_reason_distribution: {},
    attribution_decision_distribution: {
      display: 0,
      hide: 0
    },
    overview_synthesis_trace_count: 0,
    overview_synthesis_used_count: 0,
    overview_distinct_candidate_document_count: 0,
    overview_distinct_relevant_candidate_document_count: 0,
    overview_distinct_selected_document_count: 0,
    overview_distinct_candidate_document_average: 0,
    overview_distinct_relevant_candidate_document_average: 0,
    overview_distinct_selected_document_average: 0,
    overview_low_source_diversity_count: 0,
    overview_source_diversity_limited_count: 0,
    overview_source_diversity_limited_rate: 0,
    overview_source_diversity_reason_distribution: {},
    overview_dominant_document_allowed_count: 0,
    overview_unallowed_dominant_document_count: 0,
    overview_dominant_document_share_basis: 0,
    overview_dominant_document_share_average: 0,
    overview_dominant_document_share_max: 0,
    overview_depth_pass_added_chunks: 0
  };
  const issues = [];

  for (const row of rows || []) {
    const data = traceData(row);
    summary.traces += 1;

    const retrieved = idsOrCount(data, "retrieved_source_ids", "retrieved_count");
    const selected = idsOrCount(data, "selected_context_source_ids", "selected_context_count");
    const answerIds = uniqueIds(data.answer_source_ids);
    const displayedIds = uniqueIds(data.displayed_source_ids);
    const filteredOutIds = uniqueIds(data.filtered_out_source_ids);
    const overview = overviewSynthesisDetails(data);

    if (retrieved.count > 0) summary.traces_with_retrieved_sources += 1;
    if (answerIds.length > 0) summary.traces_with_answer_sources += 1;
    if (displayedIds.length > 0) summary.traces_with_displayed_sources += 1;

    summary.retrieved_source_count += retrieved.count;
    summary.selected_context_source_count += selected.count;
    summary.answer_source_count += answerIds.length;
    summary.displayed_source_count += displayedIds.length;
    summary.filtered_out_source_count += filteredOutIds.length;
    addDistributionCount(summary.source_display_mode_distribution, sourceDisplayMode(data));
    const municipalityScope = expectedMunicipalityScope(data);
    const expectsMunicipality = municipalityScope.names.size > 0 || municipalityScope.ids.size > 0;
    let traceHasWrongMunicipality = false;
    const allowedLegalParagraphRefs = legalAllowedParagraphRefs(data);
    if (expectsMunicipality) summary.municipality_scope_expected_traces += 1;

    const answerSet = new Set(answerIds);
    const selectedSet = new Set(selected.ids);
    const displayedSet = new Set(displayedIds);
    const invalidDisplayed = displayedIds.filter(id => !answerSet.has(id));
    const invalidDisplayedSelected = displayedIds.filter(id => selected.ids.length && !selectedSet.has(id));
    const validDisplayed = displayedIds.length - invalidDisplayed.length;
    const validDisplayedSelected = displayedIds.length - invalidDisplayedSelected.length;
    summary.displayed_source_valid_count += validDisplayed;
    summary.displayed_source_violation_count += invalidDisplayed.length;
    summary.displayed_selected_source_valid_count += validDisplayedSelected;
    summary.displayed_selected_source_violation_count += invalidDisplayedSelected.length;
    summary.displayed_source_precision_basis += displayedIds.length;

    if (invalidDisplayed.length > 0) {
      summary.traces_with_display_contract_violation += 1;
      if (issues.length < issueLimit) {
        issues.push({
          type: "displayed_source_not_in_answer_sources",
          severity: "error",
          displayed_source_ids: displayedIds,
          answer_source_ids: answerIds,
          offending_source_ids: invalidDisplayed,
          source_display_mode: sourceDisplayMode(data)
        });
      }
    }
    if (invalidDisplayedSelected.length > 0) {
      summary.traces_with_display_selected_contract_violation += 1;
      if (issues.length < issueLimit) {
        issues.push({
          type: "displayed_source_not_in_selected_context",
          severity: "error",
          displayed_source_ids: displayedIds,
          selected_context_source_ids: selected.ids,
          offending_source_ids: invalidDisplayedSelected,
          source_display_mode: sourceDisplayMode(data)
        });
      }
    }

    const retrievedButNotDisplayed = retrieved.ids.length
      ? retrieved.ids.filter(id => !displayedSet.has(id)).length
      : Math.max(0, retrieved.count - displayedIds.length);
    summary.retrieved_but_not_displayed_count += retrievedButNotDisplayed;
    if (retrievedButNotDisplayed > 0) summary.traces_with_retrieved_but_not_displayed += 1;

    const selectedButNotDisplayed = selected.ids.length
      ? selected.ids.filter(id => !displayedSet.has(id)).length
      : Math.max(0, selected.count - displayedIds.length);
    summary.selected_but_not_displayed_count += selectedButNotDisplayed;
    if (selectedButNotDisplayed > 0) summary.traces_with_selected_but_not_displayed += 1;

    for (const decision of Array.isArray(data.attribution_decisions) ? data.attribution_decisions : []) {
      if (decision?.decision === "display") summary.attribution_decision_distribution.display += 1;
      if (decision?.decision === "hide") summary.attribution_decision_distribution.hide += 1;
      addDistributionCount(summary.attribution_decision_reason_distribution, decision?.reason);
    }

    if (overview) {
      summary.overview_synthesis_trace_count += 1;
      if (overview.overview_synthesis_used === true) summary.overview_synthesis_used_count += 1;
      const candidateDocuments = numericCount(overview.distinct_candidate_document_count, 0);
      const relevantDocuments = numericCount(overview.distinct_relevant_candidate_document_count, 0);
      const selectedDocuments = numericCount(
        overview.distinct_selected_document_count,
        uniqueIds(overview.selected_document_ids).length
      );
      summary.overview_distinct_candidate_document_count += candidateDocuments;
      summary.overview_distinct_relevant_candidate_document_count += relevantDocuments;
      summary.overview_distinct_selected_document_count += selectedDocuments;
      summary.overview_depth_pass_added_chunks += numericCount(overview.depth_pass_added_chunks, 0);
      if (overview.source_diversity_limited === true) summary.overview_source_diversity_limited_count += 1;
      addDistributionCount(
        summary.overview_source_diversity_reason_distribution,
        overview.source_diversity_reason || (overview.source_diversity_limited === true ? "unknown" : "not_limited")
      );
      const dominantShare = numericRatio(overview.dominant_document_share, -1);
      if (dominantShare >= 0) {
        summary.overview_dominant_document_share_basis += 1;
        summary.overview_dominant_document_share_average += dominantShare;
        summary.overview_dominant_document_share_max = Math.max(summary.overview_dominant_document_share_max, dominantShare);
      }
      if (overview.dominant_document_allowed === true) {
        summary.overview_dominant_document_allowed_count += 1;
      }
      if (relevantDocuments >= 3 && selectedDocuments < 3) {
        summary.overview_low_source_diversity_count += 1;
        if (issues.length < issueLimit) {
          issues.push({
            type: "overview_synthesis_low_source_diversity",
            severity: "error",
            distinct_relevant_candidate_document_count: relevantDocuments,
            distinct_selected_document_count: selectedDocuments,
            selected_document_ids: uniqueIds(overview.selected_document_ids),
            source_diversity_limited: overview.source_diversity_limited === true,
            source_diversity_reason: overview.source_diversity_reason || null
          });
        }
      }
      if (relevantDocuments >= 3 && dominantShare > 0.4 && overview.dominant_document_allowed !== true) {
        summary.overview_unallowed_dominant_document_count += 1;
        if (issues.length < issueLimit) {
          issues.push({
            type: "overview_synthesis_unallowed_dominant_document",
            severity: "error",
            dominant_document_id: overview.dominant_document_id || null,
            dominant_document_share: dominantShare,
            dominant_document_allowed: overview.dominant_document_allowed === true,
            dominant_document_reason: overview.dominant_document_reason || null,
            distinct_relevant_candidate_document_count: relevantDocuments,
            distinct_selected_document_count: selectedDocuments
          });
        }
      }
    }

    const displayedLegalDetails = displayedLegalDecisionDetails(data);
    for (const detail of displayedLegalDetails) {
      const paragraphNumber = String(detail?.paragraph_number || "").trim();
      if (paragraphNumber) {
        summary.legal_displayed_paragraph_precision_basis += 1;
        if (allowedLegalParagraphRefs.length && !allowedLegalParagraphRefs.includes(paragraphNumber)) {
          summary.legal_displayed_wrong_paragraph_count += 1;
          summary.legal_wrong_paragraph_count += 1;
          if (summary.legal_wrong_paragraph_examples.length < issueLimit) {
            summary.legal_wrong_paragraph_examples.push({
              layer: "displayed",
              source_id: detail?.source_id || null,
              paragraph_number: paragraphNumber,
              allowed_paragraph_refs: allowedLegalParagraphRefs
            });
          }
          if (issues.length < issueLimit) {
            issues.push({
              type: "legal_displayed_wrong_paragraph",
              severity: "error",
              source_id: detail?.source_id || null,
              paragraph_number: paragraphNumber,
              allowed_paragraph_refs: allowedLegalParagraphRefs
            });
          }
        }
      }
      if (detail?.historical === true || (detail?.source_status && String(detail.source_status).trim().toLowerCase() !== "active")) {
        summary.legal_current_source_violation_count += 1;
      }
    }

    if (expectsMunicipality) {
      for (const detail of selectedContextDetails(data)) {
        const municipalityId = normalizeKey(detail?.municipality_id || detail?.municipalityId);
        const municipalityName = normalizeKey(detail?.municipality_name || detail?.municipalityName || detail?.municipality);
        if (!municipalityId && !municipalityName) continue;
        summary.municipality_source_count += 1;
        const idMatches = municipalityId && municipalityScope.ids.has(municipalityId);
        const nameMatches = municipalityName && municipalityScope.names.has(municipalityName);
        const hasComparableId = municipalityId && municipalityScope.ids.size > 0;
        const hasComparableName = municipalityName && municipalityScope.names.size > 0;
        const matches = idMatches || nameMatches;
        if ((hasComparableId || hasComparableName) && !matches) {
          summary.wrong_municipality_source_count += 1;
          traceHasWrongMunicipality = true;
          if (issues.length < issueLimit) {
            issues.push({
              type: "selected_context_wrong_municipality",
              severity: "error",
              expected_municipality_ids: Array.from(municipalityScope.ids),
              expected_municipality_names: Array.from(municipalityScope.names),
              source_id: detail?.source_id || null,
              municipality_id: municipalityId || null,
              municipality_name: municipalityName || null,
              source_type: detail?.source_type || null
            });
          }
        }
      }
      if (traceHasWrongMunicipality) summary.traces_with_wrong_municipality += 1;
    }

    for (const detail of selectedContextDetails(data)) {
      if (!isLegalSource({ source_type: detail?.source_type })) continue;
      const paragraphNumber = String(detail?.paragraph_number || "").trim();
      if (paragraphNumber) {
        summary.legal_selected_paragraph_precision_basis += 1;
        if (allowedLegalParagraphRefs.length && !allowedLegalParagraphRefs.includes(paragraphNumber)) {
          summary.legal_selected_wrong_paragraph_count += 1;
          summary.legal_wrong_paragraph_count += 1;
          if (summary.legal_wrong_paragraph_examples.length < issueLimit) {
            summary.legal_wrong_paragraph_examples.push({
              layer: "selected",
              source_id: detail?.source_id || null,
              paragraph_number: paragraphNumber,
              allowed_paragraph_refs: allowedLegalParagraphRefs
            });
          }
          if (issues.length < issueLimit) {
            issues.push({
              type: "legal_selected_wrong_paragraph",
              severity: "error",
              source_id: detail?.source_id || null,
              paragraph_number: paragraphNumber,
              allowed_paragraph_refs: allowedLegalParagraphRefs
            });
          }
        }
      }
      if (detail?.historical === true || (detail?.source_status && String(detail.source_status).trim().toLowerCase() !== "active")) {
        summary.legal_current_source_violation_count += 1;
      }
    }
  }

  if (summary.displayed_source_precision_basis > 0) {
    summary.displayed_source_precision = summary.displayed_source_valid_count / summary.displayed_source_precision_basis;
  }
  if (summary.traces > 0) {
    summary.display_contract_violation_rate = summary.traces_with_display_contract_violation / summary.traces;
  }
  if (summary.retrieved_source_count > 0) {
    summary.retrieved_filter_rate = summary.retrieved_but_not_displayed_count / summary.retrieved_source_count;
  }
  if (summary.selected_context_source_count > 0) {
    summary.selected_filter_rate = summary.selected_but_not_displayed_count / summary.selected_context_source_count;
  }
  if (summary.municipality_source_count > 0) {
    summary.wrong_municipality_rate = summary.wrong_municipality_source_count / summary.municipality_source_count;
  }
  if (summary.legal_displayed_paragraph_precision_basis > 0) {
    summary.legal_displayed_paragraph_precision =
      (summary.legal_displayed_paragraph_precision_basis - summary.legal_displayed_wrong_paragraph_count) /
      summary.legal_displayed_paragraph_precision_basis;
  }
  if (summary.legal_selected_paragraph_precision_basis > 0) {
    summary.legal_selected_paragraph_precision =
      (summary.legal_selected_paragraph_precision_basis - summary.legal_selected_wrong_paragraph_count) /
      summary.legal_selected_paragraph_precision_basis;
  }
  if (summary.traces > 0) {
    summary.displayed_source_contract_violation_rate = summary.traces_with_display_contract_violation / summary.traces;
    summary.displayed_selected_source_contract_violation_rate =
      summary.traces_with_display_selected_contract_violation / summary.traces;
  }
  if (summary.overview_synthesis_trace_count > 0) {
    summary.overview_distinct_candidate_document_average =
      summary.overview_distinct_candidate_document_count / summary.overview_synthesis_trace_count;
    summary.overview_distinct_relevant_candidate_document_average =
      summary.overview_distinct_relevant_candidate_document_count / summary.overview_synthesis_trace_count;
    summary.overview_distinct_selected_document_average =
      summary.overview_distinct_selected_document_count / summary.overview_synthesis_trace_count;
    summary.overview_source_diversity_limited_rate =
      summary.overview_source_diversity_limited_count / summary.overview_synthesis_trace_count;
  }
  if (summary.overview_dominant_document_share_basis > 0) {
    summary.overview_dominant_document_share_average =
      summary.overview_dominant_document_share_average / summary.overview_dominant_document_share_basis;
  }

  return {
    ok:
      summary.displayed_source_violation_count === 0 &&
      summary.displayed_selected_source_violation_count === 0 &&
      summary.wrong_municipality_source_count === 0 &&
      summary.legal_wrong_paragraph_count === 0 &&
      summary.legal_current_source_violation_count === 0 &&
      summary.overview_low_source_diversity_count === 0 &&
      summary.overview_unallowed_dominant_document_count === 0,
    summary,
    issues
  };
}
