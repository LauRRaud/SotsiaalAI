// Shared by the on-demand UI and Markdown export; inputs are the safe projection.
export function diagnosticExplanationRows(diagnostic, translate) {
  const evidence = diagnostic?.evidence || {};
  const rows = [];
  const add = (key, value) => rows.push({ key, label: translate(`decision_fields.${key}`), value });
  const unknown = translate("evidence_unknown");
  const years = values => Array.isArray(values) ? values.length ? values.join(", ") : translate("none_recorded") : unknown;
  const count = value => Number.isSafeInteger(value) ? String(value) : unknown;
  const plan = evidence.plan?.years;
  if (plan?.observed) {
    add("source_years", years(plan.source_years));
    add("evidence_period_years", years(plan.evidence_period_years));
    if (plan.mentions?.length) add("year_roles", plan.mentions.map(item => `${item.value}: ${translate(`year_roles.${item.role || "ambiguous"}`)}`).join("; "));
    if (plan.unselected_source_years?.length) add("unselected_source_years", years(plan.unselected_source_years));
  }
  const decision = evidence.identity?.decision;
  if (decision?.reason) {
    add("gate", translate(`decisions.${decision.reason}`));
    if (decision.candidate_document_id) add("candidate", decision.candidate_document_id);
    add("selected_source_year", decision.selected_source_year || unknown);
    if (decision.required_source_years?.length) {
      add("required_source_years", years(decision.required_source_years));
      add("confirmed_source_years", years(decision.confirmed_source_years));
    }
    if (typeof decision.checks?.all_authors_confirmed === "boolean") add("authors_confirmed", translate(decision.checks.all_authors_confirmed ? "yes" : "no"));
  } else if (evidence.identity?.required) add("gate", unknown);
  const metric = evidence.metric_contract;
  if (metric?.observed) {
    const mappingStatus = typeof metric.complete === "boolean" ? translate(metric.complete ? "metric_mapping_complete" : "metric_mapping_incomplete") : unknown;
    add("metric_mapping", `${count(metric.mapped_slot_count)} / ${count(metric.requested_slot_count)} — ${mappingStatus}`);
    if (metric.reason) add("metric_reason", metric.reason);
    add("metric_candidates", count(metric.mapping?.evidence_candidate_count));
    const scopeChecks = [...(evidence.validation?.metric_bindings || []), ...(evidence.validation?.relation_diagnostics || [])]
      .filter(check => typeof check.named_scope_bound === "boolean");
    if (scopeChecks.length) add("named_scope_checks", scopeChecks.map(check =>
      `${check.slot_index || "?"}: ` + ["named_scope_bound", "age_scope_bound", "observation_year_bound"]
        .filter(key => typeof check[key] === "boolean")
        .map(key => `${translate(`named_scope_parts.${key}`)}: ${translate(check[key] ? "yes" : "no")}`).join(", ")
    ).join("; "));
    if (metric.slots?.some(slot => slot.qualifier === "range")) {
      add("range_endpoints", metric.slots.filter(slot => slot.qualifier === "range").map(slot => `${slot.slot_index}: ${count(slot.range_endpoint_count)}`).join("; "));
      const bindings = evidence.validation?.metric_bindings || [];
      add("bound_range_claims", metric.slots.filter(slot => slot.qualifier === "range").map(slot => {
        const binding = bindings.find(item => item.slot_index === slot.slot_index);
        return `${slot.slot_index}: ${Array.isArray(binding?.claim_indexes) ? binding.claim_indexes.length : unknown}`;
      }).join("; "));
    }
  }
  const qualitative = evidence.qualitative_contract;
  if (qualitative?.observed) {
    add("qualitative_mapping", `${count(qualitative.mapped_slot_count)} / ${count(qualitative.requested_slot_count)} — ${translate("qualitative_mapping_boundary")}`);
    if (qualitative.reason) add("qualitative_reason", qualitative.reason === "qualitative_evidence_conflict"
      ? `${translate("qualitative_evidence_conflict")}: ${(qualitative.conflicting_slot_indexes || []).join(", ")}` : qualitative.reason);
    if (qualitative.slots?.length) add("qualitative_fragments", qualitative.slots.map(slot => `${slot.slot_index}: ${slot.value_type || unknown} · ${slot.evidence_fragment_hash || unknown}`).join("; "));
    const checks = evidence.validation?.qualitative_gate_checks;
    add("qualitative_rejections", Array.isArray(checks) ? checks.map(slot => {
      const reasons = Object.entries(slot.rejection_counts || {}).map(([reason, value]) => `${translate(`qualitative_rejections.${reason}`)}: ${count(value)}`);
      if (slot.assignment_conflict) reasons.push(translate("qualitative_rejections.assignment_conflict"));
      return `${slot.slot_index}: ${count(slot.candidate_unit_count)} / ${count(slot.evaluated_unit_count)}; ${reasons.join(", ") || translate("none_recorded")}`;
    }).join("; ") : unknown);
  }
  const history = evidence.history;
  if (history?.observed) {
    add("request_history", count(history.request_raw_count));
    add("retrieval_history", `${count(history.retrieval_input_count)} → ${count(history.retrieval_selected_count)}`);
    if (history.retrieval_exclusion_reasons?.length) add("retrieval_reason", history.retrieval_exclusion_reasons.map(code => translate(`history_reasons.${code}`)).join("; "));
    add("model_history", `${count(history.model_available_count)} → ${count(history.model_selected_count)}`);
    if (history.model_selection_reason) add("model_reason", translate(`history_reasons.${history.model_selection_reason}`));
  } else add("history_unknown", unknown);
  return rows;
}
