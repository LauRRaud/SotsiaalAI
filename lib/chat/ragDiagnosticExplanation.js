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
