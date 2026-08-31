import { createHash } from "node:crypto";

export const QUESTION_REQUIREMENTS_VERSION = "question_requirements_shadow_v1";
const kinds = new Set(["known_value_interpretation", "time", "order_comparison", "numeric", "qualitative"]);
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const folded = text => text.normalize("NFD").replace(/\p{Diacritic}+/gu, "").toLowerCase();
const sourceCue = /\b(?:artikl|uuring|aruan|raport|dokument|article|study|report)\p{L}*/u;
const cuePattern = /(?<![\p{L}\p{N}])(?:kui\s+palju|kui\s+suur|mitu|mida|mis|millis\p{L}*|millin\p{L}*|kuidas|millal|kelle|kes|kus|what|which|how|when|whose|who|where|какой|какая|какие|как|когда|кто|где)(?![\p{L}\p{N}])/giu;

// This is a request-local observation, NOT an answer key or production planner.
// Offsets always refer to the original UTF-16 string, never a translated query.
export function buildQuestionRequirementsShadow({ originalMessage = "", resolvedQuestionPlan = null } = {}) {
  const text = String(originalMessage);
  const bibliographicSpans = Array.from(text.matchAll(/[„“"][^„“”"\r\n]{3,200}[”"]/gu))
    .filter(match => sourceCue.test(folded(text.slice(Math.max(0, match.index - 80), match.index))))
    .map(match => ({ start: match.index, end: match.index + match[0].length, role: "quoted_source_title" }));
  const allCues = Array.from(text.matchAll(cuePattern)).filter(match =>
    !bibliographicSpans.some(span => match.index >= span.start && match.index < span.end));
  const modifiers = allCues.filter(match => /^mida$/iu.test(match[0]) && /,\s*$/u.test(text.slice(0, match.index)) &&
    /^mida\s+vorreldakse\b/u.test(folded(text.slice(match.index))) && sourceCue.test(folded(text.slice(match.index))));
  const cues = allCues.filter(match => !modifiers.includes(match));
  const requirements = cues.slice(0, 24).map((match, index) => {
    const next = [...cues.slice(index + 1), ...modifiers].map(item => item.index).filter(at => at > match.index);
    const end = next.length ? Math.min(...next) : text.length;
    const clause = text.slice(match.index, end);
    let masked = clause;
    for (const span of bibliographicSpans.filter(span => span.start >= match.index && span.end <= end)) {
      const from = span.start - match.index, to = span.end - match.index;
      masked = masked.slice(0, from) + " ".repeat(to - from) + masked.slice(to);
    }
    const normalized = folded(masked);
    const knownAnchors = Array.from(masked.matchAll(/(?<![\p{L}\d])\d+(?:[.,]\d+)?\s*%/gu), anchor => ({
      value: anchor[0].replace(/\s+/gu, "").replace(",", "."), unit: "percent",
      origin_span: { start: match.index + anchor.index, end: match.index + anchor.index + anchor[0].length }
    }));
    const kind = knownAnchors.length && /\b(?:tahenda\p{L}*|meaning|mean|interpret\p{L}*)\b/u.test(normalized)
      ? "known_value_interpretation"
      : /\b(?:millal|mis\s+ajast|millisest\s+ajast|mis\s+aasta\p{L}*|when)\b/u.test(normalized) ? "time"
      : /\b(?:jarjekor\p{L}*|order|sequence)\b/u.test(normalized) ? "order_comparison"
      : /^(?:mitu|kui\s+palju|kui\s+suur|how\s+(?:many|much))\b/u.test(normalized) ? "numeric" : "qualitative";
    return { id: `requirement_${index + 1}`, kind, origin_span: { start: match.index, end },
      text: clause, known_anchors: knownAnchors, origin: "original_question", authority: "shadow_only" };
  });
  const result = { version: QUESTION_REQUIREMENTS_VERSION, offset_basis: "original_utf16_half_open", shadow_only: true,
    used_for_retrieval: false, used_for_generation: false, used_for_validation: false,
    parser_coverage: "BOUNDED_HEURISTIC", original_message_hash: hash(text), requirements,
    bibliographic_spans: bibliographicSpans, source_modifier_count: modifiers.length,
    requirements_omitted: Math.max(0, cues.length - 24),
    resolved_plan_slot_count: resolvedQuestionPlan?.semantic_candidates?.requested_fact_slots?.slots?.length ?? null };
  return { ...result, contract_hash: hash(result) };
}

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
