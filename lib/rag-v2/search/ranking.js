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
    dependencyContextTokens: 16000 };
  for (const [key, value] of Object.entries(limits)) {
    if (!(key in maximum) || !Number.isInteger(value) || value < (key.startsWith('graph') ? 0 : 1) || value > maximum[key]) fail('invalid_query_limit');
  }
  if (query.graph !== undefined && typeof query.graph !== 'boolean') fail('invalid_graph_flag');
  if (query.semanticGraph !== undefined && typeof query.semanticGraph !== 'boolean') fail('invalid_dependency_flag');
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
    || Object.keys(query.poolReserve).some(key => !['documents', 'size', 'perDocument'].includes(key))
    || !Array.isArray(query.poolReserve.documents) || query.poolReserve.documents.length > 100
    || query.poolReserve.documents.some(doc => typeof doc !== 'string' || !doc)
    || [query.poolReserve.size, query.poolReserve.perDocument ?? 1].some(value => !Number.isInteger(value) || value < 1 || value > 10))) fail('invalid_pool_reserve');
  const finalLimit = query.finalLimit ?? (limits.topK + limits.graphAdditions);
  if (!Number.isInteger(finalLimit) || finalLimit < 1 || finalLimit > 30) fail('invalid_final_limit');
  return { ...query, text: query.text.trim(), ...(query.variants ? { variants: query.variants.map(text => text.trim()) } : {}),
    ...(query.poolReserve ? { poolReserve: { documents: [...new Set(query.poolReserve.documents)].sort(), size: query.poolReserve.size,
      perDocument: query.poolReserve.perDocument ?? query.poolReserve.size } } : {}), filters, limits, graph: query.graph ?? false, semanticGraph: query.semanticGraph ?? false,
    method: query.method ?? 'hybrid', contextMode: query.contextMode ?? 'audit', includeDocumentLabels: query.includeDocumentLabels ?? true, finalLimit };
}
