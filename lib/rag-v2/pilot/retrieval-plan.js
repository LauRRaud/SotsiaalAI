import { reject } from './contracts.js';
import { TYPED_DIALOGUE_STATE_VERSION } from './dialogue-state.js';
import { UNIFIED_RETRIEVAL_VERSION } from '../search/unified.js';
export { UNIFIED_RETRIEVAL_VERSION } from '../search/unified.js';

export function unifiedRetrievalEnabled(config) {
  if (config.retrievalRouting === undefined) return false;
  if (config.retrievalRouting !== UNIFIED_RETRIEVAL_VERSION) reject('unsupported_retrieval_routing', 403);
  return true;
}

const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString().slice(0, 10) === value;
const bound = (value, upper) => value.length === 4 ? `${value}-${upper ? '12-31' : '01-01'}` : value;

/** Numeric syntax only, not an intent classifier. These are publication-search
 * candidates alongside an unrestricted knowledge lane, never eligibility rules. */
export function dateCandidates(text, turn) {
  const dates = '(?:[12][0-9]{3}-[0-9]{2}-[0-9]{2}|[12][0-9]{3})';
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(${dates})(?:\\s*[–—-]\\s*(${dates}))?(?![\\p{L}\\p{N}-])`, 'gu');
  const matches = [...text.matchAll(pattern)], periods = [];
  for (const match of matches) {
    const from = bound(match[1], false), to = bound(match[2] || match[1], true);
    if (!validDate(from) || !validDate(to) || from > to) return { state: 'invalid_date_candidate', periods: [] };
    const value = { from, to, basis: 'unspecified', support: [{ turn, quote: match[0] }] };
    if (!periods.some(previous => previous.from === from && previous.to === to)) periods.push(value);
  }
  return periods.length > 2 ? { state: 'too_many_date_candidates', periods: [] }
    : { state: periods.length ? 'numeric_candidates_not_confirmed_intent' : 'no_numeric_candidates', periods };
}

export function retrievalPlan(query) {
  const turns = query.scopeTurns, previous = query.previousState;
  if (!Array.isArray(turns) || !turns.length || turns.length > 8) reject('invalid_unified_query');
  const offset = previous?.sourceTurnIds.length || 0;
  if (previous && (previous.version !== TYPED_DIALOGUE_STATE_VERSION || offset >= turns.length
    || previous.sourceTurnIds.some((id, index) => turns[index]?.turnId !== id))) reject('invalid_unified_query');
  let temporal = null;
  for (let i = turns.length - 1; i >= offset; i--) {
    const found = dateCandidates(turns[i].text, i + 1);
    if (found.state !== 'no_numeric_candidates') { temporal = found; break; }
    if (turns[i].mode === 'correction') { temporal = { state: 'cleared_by_correction', periods: [] }; break; }
  }
  temporal ||= { state: previous ? 'previous_model_interpretation' : 'no_period', periods: previous?.value.periods || [] };
  return { version: UNIFIED_RETRIEVAL_VERSION, temporal,
    // Event/validity ranges stay visible as intent context but cannot filter publication dates.
    publicationCandidates: temporal.periods.filter(period => ['publication', 'unspecified'].includes(period.basis)),
    knowledgeFilters: {}, interpretation: 'bounded_evidence_selection_not_verified_intent' };
}

export const UNIFIED_RETRIEVAL_INSTRUCTIONS = ' Unified retrieval: evidence.retrieval describes bounded candidate lanes, not a decision about the user\'s intent. '
  + 'Answer the current request using relevant evidence across lanes; an available municipal catalogue does not make every question a service request. Ask for locality only if the requested local help needs it. '
  + 'Period lanes filter ONLY publication dates of indexed journal documents. Numeric date candidates may describe a birth, an event, an appointment or an example; do not treat them as confirmed publication intent. The unrestricted knowledge lane remains available. '
  + 'Use publication-period evidence only when the requested time meaning matches. Preserve event time, rule/service validity, source publication, collection and checking dates separately. '
  + 'Coverage counts indexed source documents, not chunks, people, events or deduplicated articles. Selected excerpts are a sample; coverage metadata does not prove every document was read or every topic found. '
  + 'For a comparison use evidence from each relevant period, attribute observations to those sources, and state a narrow gap if one side is missing. Never infer prevalence, absence, causality or a corpus-wide trend from top-ranked excerpts. '
  + 'Do not present unrelated numeric candidates or the internal routing report to the user. If period meaning or requested range is unclear and affects the answer, ask a focused question in natural language. No additional planning call is needed.';
