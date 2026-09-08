// Browser-safe projection of server-produced diagnostics; contains no question text or hashing.
export const QUESTION_REQUIREMENTS_VERSION = "question_requirements_shadow_v1";
const kinds = new Set(["known_value_interpretation", "time", "order_comparison", "numeric", "qualitative"]);

export function projectQuestionRequirementsShadow(value) {
  if (value?.version !== QUESTION_REQUIREMENTS_VERSION) return null;
  const digest = input => typeof input === "string" && /^[a-f0-9]{64}$/u.test(input) ? input : null;
  const count = input => Number.isSafeInteger(input) && input >= 0 && input <= 1e6 ? input : null;
  return { version: QUESTION_REQUIREMENTS_VERSION, shadow_only: true, parser_coverage: "BOUNDED_HEURISTIC",
    used_for_retrieval: false, used_for_generation: false, used_for_validation: false,
    offset_basis: "original_utf16_half_open", contract_hash: digest(value.contract_hash), original_message_hash: digest(value.original_message_hash),
    requirement_count: Array.isArray(value.requirements) ? Math.min(24, value.requirements.length) : count(value.requirement_count),
    requirements_omitted: count(value.requirements_omitted), source_modifier_count: count(value.source_modifier_count),
    resolved_plan_slot_count: count(value.resolved_plan_slot_count),
    requirements: (Array.isArray(value.requirements) ? value.requirements : []).slice(0, 24).map((item, index) => ({
      index: index + 1, kind: kinds.has(item.kind) ? item.kind : null,
      origin_span: count(item.origin_span?.start) !== null && count(item.origin_span?.end) !== null && item.origin_span.end > item.origin_span.start
        ? { start: item.origin_span.start, end: item.origin_span.end } : null,
      known_anchor_count: Array.isArray(item.known_anchors) ? item.known_anchors.length : count(item.known_anchor_count)
    })) };
}
