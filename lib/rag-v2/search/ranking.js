import { fail } from '../contracts.js';
import { QUERY_STOPWORDS_VERSION } from './query-stopwords.js';

// Lexical score versions. The cover-density rank stays the default of every existing profile; the
// plain rank is the cheaper score chosen per query (Codex lexical audit, 26.09.2026).
export const LEXICAL_RANK_CD = 'ts-rank-cd-v1', LEXICAL_RANK_PLAIN = 'ts-rank-v1', LEXICAL_RANKS = Object.freeze([LEXICAL_RANK_CD, LEXICAL_RANK_PLAIN]);

/** Channel weights are a query-time choice; the generation's rrf-v1 constant and indexes do not change. */
export function rrf(channels, constant = 60, weights = {}) {
  if (!Number.isInteger(constant) || constant < 1 || constant > 1000) fail('invalid_rrf_constant');
  validateChannelWeights(weights);
  const merged = new Map();
  for (const [channel, rows] of Object.entries(channels)) {
    const seen = new Set();
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      const rank = seen.size, contribution = (weights[channel] ?? 1) / (constant + rank);
      const item = merged.get(row.id) || { id: row.id, score: 0, ranks: {}, contributions: {} };
      item.score += contribution; item.ranks[channel] = rank; item.contributions[channel] = contribution;
      merged.set(row.id, item);
    }
  }
  return [...merged.values()].sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
// A channel is lexical or vector, for the question itself or for one of its search variants (_1.._3).
const CHANNEL = /^(?:lexical|vector)(?:_[1-3])?$/;
export const channelKind = channel => channel.split('_')[0];
export function validateChannelWeights(weights) {
  if (!weights || typeof weights !== 'object' || Array.isArray(weights)
    || Object.entries(weights).some(([channel, value]) => !CHANNEL.test(channel) || !Number.isFinite(value) || value <= 0 || value > 4)) fail('invalid_channel_weights');
}
/** An imported bibliographic year, as a four-digit string; never a guessed date. */
export function publicationYear(value) {
  const year = typeof value === 'number' && Number.isInteger(value) ? String(value) : value;
  return typeof year === 'string' && /^[12]\d{3}$/.test(year) ? year : null;
}
export function filtersMatch(bundle, filters = {}) {
  const f = bundle.document.fields;
  if (filters.region && (!Array.isArray(f.regions?.value) || !f.regions.value.includes(filters.region))) return false;
  const date = f.publication_date.value, year = date ? null : publicationYear(f.publication_year?.value);
  if ((filters.publication_from || filters.publication_to) && !date && !year) return false;
  // A year-only source matches only when its whole calendar year lies inside the range.
  const [first, last] = date ? [date, date] : [`${year}-01-01`, `${year}-12-31`];
  if (filters.publication_from && first < filters.publication_from || filters.publication_to && last > filters.publication_to) return false;
  // Validity needs a start, and an end or a proven open end (in force with no end date yet).
  if (filters.valid_at) {
    const from = f.valid_from?.value, to = f.valid_to?.value, openEnd = !to && f.valid_to?.open_end === true;
    if (!from || !to && !openEnd || filters.valid_at < from || to && filters.valid_at > to) return false;
  }
  return true;
}
export function validateQuery(query) {
  if (!query || typeof query.text !== 'string' || query.text.length > 8000 || !['et', 'en', 'ru'].includes(query.language)) fail('invalid_query');
  const filters = query.filters || {};
  for (const [key, value] of Object.entries(filters)) {
    if (!['region', 'publication_from', 'publication_to', 'valid_at'].includes(key) || typeof value !== 'string' || !value.trim() || value.length > 100) fail('invalid_filter');
    if (key !== 'region' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) fail('invalid_filter');
  }
  if (filters.publication_from && filters.publication_to && filters.publication_from > filters.publication_to) fail('invalid_filter');
  const limits = { topK: 5, perDocument: 3, candidates: 40, contextTokens: 6000, graphSteps: 8, graphAdditions: 2, ...query.limits,
    ...(query.semanticGraph ? { dependencySteps: query.limits?.dependencySteps ?? 16, dependencyAdditions: query.limits?.dependencyAdditions ?? 4 } : {}) };
  const maximum = { topK: 20, perDocument: 20, candidates: 100, contextTokens: 32000, graphSteps: 50, graphAdditions: 10, dependencySteps: 64, dependencyAdditions: 20,
    dependencyContextTokens: 16000, expansionContextTokens: 16000, referenceAdditions: 10, namedActAdditions: 10, poolPerDocument: 30 };
  for (const [key, value] of Object.entries(limits)) {
    if (!(key in maximum) || !Number.isInteger(value) || value < (key.startsWith('graph') ? 0 : 1) || value > maximum[key]) fail('invalid_query_limit');
  }
  if (query.graph !== undefined && typeof query.graph !== 'boolean') fail('invalid_graph_flag');
  if (query.semanticGraph !== undefined && typeof query.semanticGraph !== 'boolean') fail('invalid_dependency_flag');
  // The act's own cross-references of the selected passages (graph experiment, Codex 7.7 arm D).
  if (query.references !== undefined && typeof query.references !== 'boolean') fail('invalid_references_flag');
  // A named other act's section, pointed at from a selected passage (ADR-063).
  if (query.namedActs !== undefined && typeof query.namedActs !== 'boolean') fail('invalid_named_acts_flag');
  // An own-act cross-reference adds the passages of the subsection it names, not the section's start (ADR-068).
  if (query.referenceSubsections !== undefined && typeof query.referenceSubsections !== 'boolean') fail('invalid_reference_subsections_flag');
  if (query.semanticGraph && limits.contextTokens < 512) fail('dependency_context_budget_too_small');
  if (!['hybrid', 'lexical', 'vector'].includes(query.method ?? 'hybrid') || !['audit', 'compact'].includes(query.contextMode ?? 'audit')) fail('invalid_retrieval_method');
  if (query.includeDocumentLabels !== undefined && typeof query.includeDocumentLabels !== 'boolean') fail('invalid_structural_role_flag');
  if (query.channelWeights !== undefined) validateChannelWeights(query.channelWeights);
  if (query.lexicalStopwords !== undefined && query.lexicalStopwords !== QUERY_STOPWORDS_VERSION) fail('unsupported_query_stopwords');
  if (query.lexicalRank !== undefined && !LEXICAL_RANKS.includes(query.lexicalRank)) fail('unsupported_lexical_rank');
  // Search variants (rewritten queries of the same request) run beside the question in every channel.
  if (query.variants !== undefined && (!Array.isArray(query.variants) || query.variants.length > 3
    || query.variants.some(text => typeof text !== 'string' || !text.trim() || text.length > 1000))) fail('invalid_query_variants');
  // Reserved rerank places (ADR-032): the best candidates of these documents join the reranker's pool
  // even when the whole corpus search ranks them below it. Without a reranker the reserve is unused.
  if (query.poolReserve !== undefined && (!query.poolReserve || typeof query.poolReserve !== 'object'
    || Object.keys(query.poolReserve).some(key => !['documents', 'size', 'perDocument', 'perQuery'].includes(key))
    || !Array.isArray(query.poolReserve.documents) || query.poolReserve.documents.length > 100
    || query.poolReserve.documents.some(doc => typeof doc !== 'string' || !doc)
    || [query.poolReserve.size, query.poolReserve.perDocument ?? 1].some(value => !Number.isInteger(value) || value < 1 || value > 10)
    || query.poolReserve.perQuery !== undefined && (!Number.isInteger(query.poolReserve.perQuery) || query.poolReserve.perQuery < 1 || query.poolReserve.perQuery > 3))) fail('invalid_pool_reserve');
  // Version-change places (ADR-091): groups of units that hold one provision which differs between two versions of an
  // act, the newer version's passages and the older one's together. The best groups join the reranker's pool whole.
  if (query.changeReserve !== undefined && (!query.changeReserve || typeof query.changeReserve !== 'object'
    || Object.keys(query.changeReserve).some(key => !['groups', 'size'].includes(key))
    || !Number.isInteger(query.changeReserve.size) || query.changeReserve.size < 1 || query.changeReserve.size > 12
    || !Array.isArray(query.changeReserve.groups) || query.changeReserve.groups.length > 2000
    || query.changeReserve.groups.some(group => !Array.isArray(group) || !group.length || group.length > query.changeReserve.size
      || new Set(group).size !== group.length || group.some(unit => typeof unit !== 'string' || !unit)))) fail('invalid_change_reserve');
  const finalLimit = query.finalLimit ?? (limits.topK + limits.graphAdditions);
  if (!Number.isInteger(finalLimit) || finalLimit < 1 || finalLimit > 30) fail('invalid_final_limit');
  return { ...query, text: query.text.trim(), ...(query.variants ? { variants: query.variants.map(text => text.trim()) } : {}),
    ...(query.poolReserve ? { poolReserve: { documents: [...new Set(query.poolReserve.documents)].sort(), size: query.poolReserve.size,
      perDocument: query.poolReserve.perDocument ?? query.poolReserve.size,
      ...(query.poolReserve.perQuery ? { perQuery: query.poolReserve.perQuery } : {}) } } : {}),
    ...(query.changeReserve ? { changeReserve: { groups: query.changeReserve.groups.map(group => [...group]), size: query.changeReserve.size } } : {}), filters, limits, graph: query.graph ?? false, semanticGraph: query.semanticGraph ?? false,
    method: query.method ?? 'hybrid', contextMode: query.contextMode ?? 'audit', includeDocumentLabels: query.includeDocumentLabels ?? true, finalLimit,
    ...(query.references ? { references: true } : {}), ...(query.namedActs ? { namedActs: true } : {}),
    ...(query.referenceSubsections ? { referenceSubsections: true } : {}) };
}
