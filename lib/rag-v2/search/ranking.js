import { fail } from '../contracts.js';

export function rrf(channels, constant = 60) {
  if (!Number.isInteger(constant) || constant < 1 || constant > 1000) fail('invalid_rrf_constant');
  const merged = new Map();
  for (const [channel, rows] of Object.entries(channels)) {
    const seen = new Set();
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      const rank = seen.size, contribution = 1 / (constant + rank);
      const item = merged.get(row.id) || { id: row.id, score: 0, ranks: {}, contributions: {} };
      item.score += contribution; item.ranks[channel] = rank; item.contributions[channel] = contribution;
      merged.set(row.id, item);
    }
  }
  return [...merged.values()].sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
export function filtersMatch(bundle, filters = {}) {
  const f = bundle.document.fields;
  if (filters.region && (!Array.isArray(f.regions?.value) || !f.regions.value.includes(filters.region))) return false;
  const date = f.publication_date.value;
  if ((filters.publication_from || filters.publication_to) && !date) return false;
  if (filters.publication_from && date < filters.publication_from || filters.publication_to && date > filters.publication_to) return false;
  if (filters.valid_at && (!f.valid_from.value || !f.valid_to.value || filters.valid_at < f.valid_from.value || filters.valid_at > f.valid_to.value)) return false;
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
  const limits = { topK: 5, perDocument: 3, candidates: 40, contextTokens: 6000, graphSteps: 8, graphAdditions: 2, ...query.limits };
  const maximum = { topK: 20, perDocument: 20, candidates: 100, contextTokens: 32000, graphSteps: 50, graphAdditions: 10 };
  for (const [key, value] of Object.entries(limits)) {
    if (!(key in maximum) || !Number.isInteger(value) || value < (key.startsWith('graph') ? 0 : 1) || value > maximum[key]) fail('invalid_query_limit');
  }
  if (query.graph !== undefined && typeof query.graph !== 'boolean') fail('invalid_graph_flag');
  if (!['hybrid', 'lexical', 'vector'].includes(query.method ?? 'hybrid') || !['audit', 'compact'].includes(query.contextMode ?? 'audit')) fail('invalid_retrieval_method');
  if (query.includeDocumentLabels !== undefined && typeof query.includeDocumentLabels !== 'boolean') fail('invalid_structural_role_flag');
  const finalLimit = query.finalLimit ?? (limits.topK + limits.graphAdditions);
  if (!Number.isInteger(finalLimit) || finalLimit < 1 || finalLimit > 30) fail('invalid_final_limit');
  return { ...query, text: query.text.trim(), filters, limits, graph: query.graph ?? false,
    method: query.method ?? 'hybrid', contextMode: query.contextMode ?? 'audit', includeDocumentLabels: query.includeDocumentLabels ?? true, finalLimit };
}
