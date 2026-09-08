import { createHash } from "node:crypto";
import { bibliographicSourceModifierSpans, bibliographicTitleSpans } from "./questionClauseRoles.js";

import { QUESTION_REQUIREMENTS_VERSION } from "./questionRequirementsContract.js";
export { QUESTION_REQUIREMENTS_VERSION, projectQuestionRequirementsShadow } from "./questionRequirementsContract.js";
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const folded = text => text.normalize("NFD").replace(/\p{Diacritic}+/gu, "").toLowerCase();
const cuePattern = /(?<![\p{L}\p{N}])(?:kui\s+palju|kui\s+suur|mitu|mida|mis|millis\p{L}*|millin\p{L}*|kuidas|millal|kelle|kes|kus|what|which|how|when|whose|who|where|какой|какая|какие|как|когда|кто|где)(?![\p{L}\p{N}])/giu;

// This is a request-local observation, NOT an answer key or production planner.
// Offsets always refer to the original UTF-16 string, never a translated query.
export function buildQuestionRequirementsShadow({ originalMessage = "", resolvedQuestionPlan = null } = {}) {
  const text = String(originalMessage);
  const bibliographicSpans = bibliographicTitleSpans(text);
  const allCues = Array.from(text.matchAll(cuePattern)).filter(match =>
    !bibliographicSpans.some(span => match.index >= span.start && match.index < span.end));
  const modifierStarts = new Set(bibliographicSourceModifierSpans(text, allCues).map(span => span.start));
  const modifiers = allCues.filter(match => modifierStarts.has(Number(match.index)));
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
