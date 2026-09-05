import { performance } from 'node:perf_hooks';
import { fail, hash, id, stable } from '../contracts.js';
import { accessContext } from './policy.js';
import { filtersMatch, rrf, validateQuery } from './ranking.js';
import { indexUnit, tokenCount, validateVector } from './embedding.js';
import { verifySearchConfig } from './indexing.js';

function sourceEntry(unit, bundle, reason, rank) {
  const chunk = bundle.chunks.find(c => c.id === unit.chunk_id);
  if (!chunk || unit.version_id !== bundle.version.id || unit.document_id !== bundle.document.id) fail('evidence_scope_mismatch');
  const spans = chunk.span_ids.map(s => bundle.spans.find(x => x.id === s));
  if (spans.some(s => !s || s.document_version_id !== bundle.version.id || s.tenant_id !== bundle.tenant_id)
    || chunk.source_text !== spans.map(s => s.source_text).join('\n')) fail('evidence_span_mismatch');
  return { evidence_id: id('evidence', bundle.tenant_id, bundle.version.id, unit.id), document_id: bundle.document.id,
    document_version_id: bundle.version.id, unit_id: unit.id, chunk_id: chunk.id, span_ids: chunk.span_ids,
    pdf_pages: chunk.pdf_pages, source_text: chunk.source_text,
    bibliography: { title: bundle.document.fields.title.value, authors: bundle.document.fields.authors.value,
      publication_date: bundle.document.fields.publication_date.value },
    search_aids: { heading_prefix: chunk.retrieval_text.slice(0, chunk.retrieval_mapping.prefix_length),
      legacy_description: bundle.document.search_aids.description, role: 'not_source_quote' },
    selection: { reason, ranks: rank?.ranks ?? {}, rrf_contributions: rank?.contributions ?? {}, rrf_score: rank?.score ?? null },
    limitations: bundle.report.warnings,
  };
}
function neighbors(bundle, chunkId) {
  const seed = bundle.chunks.find(c => c.id === chunkId), candidates = new Map();
  const membership = bundle.relations.find(e => e.type === 'BELONGS_TO' && e.from_id === chunkId && e.to_id === bundle.document.id);
  const parent = bundle.relations.find(e => e.type === 'PARENT_SECTION' && e.from_id === chunkId && e.to_id === seed.parent_section_id);
  if (!membership || !parent) return [];
  for (const chunk of bundle.chunks.filter(c => Math.abs(c.ordinal - seed.ordinal) === 1)) {
    const edge = bundle.relations.find(e => e.type === 'NEXT_SPAN' && (
      e.from_id === seed.span_ids.at(-1) && e.to_id === chunk.span_ids[0] || e.from_id === chunk.span_ids.at(-1) && e.to_id === seed.span_ids[0]));
    if (edge) candidates.set(chunk.id, { chunk, edges: [membership.id, edge.id], via: 'NEXT_SPAN' });
    else if (chunk.parent_section_id === seed.parent_section_id) {
      const sibling = bundle.relations.find(e => e.type === 'PARENT_SECTION' && e.from_id === chunk.id && e.to_id === parent.to_id);
      if (sibling) candidates.set(chunk.id, { chunk, edges: [membership.id, parent.id, sibling.id], via: 'PARENT_SECTION' });
    }
  }
  return [...candidates.values()].sort((a, b) => a.chunk.ordinal - b.chunk.ordinal);
}

export async function retrieve({ postgres, qdrant, embedding, policy, context, query: input, allowLexicalFallback = true, hooks = {} }) {
  accessContext(context);
  const query = validateQuery(input), started = performance.now(), timings = {};
  const result = { schema_version: 'rag-v2/evidence-1', query_id: id('query', context.tenant, hash(query.text), new Date().toISOString()),
    query: { text_hash: hash(query.text), language: query.language, filters: query.filters }, tenant: context.tenant,
    state: 'error', embedding_mode: 'mock', generation_id: null, corpus: null, config: null, channels: [], warnings: [], evidence: [],
    limitations: { semantic_quality: 'NOT_PROVEN', corpus_completeness: 'not_assessed', authentication: 'trusted_local_policy_only' },
    measurements: { timings_ms: timings, candidate_counts: {}, context_tokens: 0, external_embedding_calls: 0, generation_calls: 0, mock_embedding_calls: 0 },
  };
  try {
    const access = await policy.allowed(context);
    const generation = await postgres.active(context.tenant);
    verifySearchConfig(generation.config);
    if (generation.snapshot.snapshot_hash !== hash(stable(generation.snapshot.documents))
      || generation.id !== id('search_generation', context.tenant, generation.snapshot, generation.config)) fail('search_generation_integrity_failed');
    if (stable(embedding.config) !== stable(generation.config.embedding)) fail('query_embedding_space_mismatch');
    if (query.generation_id && query.generation_id !== generation.id) fail('requested_generation_not_active');
    result.generation_id = generation.id; result.config = generation.config;
    if (hooks.afterPin) await hooks.afterPin(generation);
    const visible = Object.keys(generation.snapshot.documents).filter(d => access.documents.includes(d));
    const bundles = await postgres.bundles(context.tenant, generation.id, visible);
    if (bundles.length !== visible.length) fail('missing_generation_source');
    const allowedBundles = bundles.filter(b => filtersMatch(b, query.filters)), documentIds = allowedBundles.map(b => b.document.id);
    const units = await postgres.units(context.tenant, generation.id, documentIds);
    const bundleByDoc = new Map(allowedBundles.map(b => [b.document.id, b]));
    for (const u of units) {
      const b = bundleByDoc.get(u.document_id), c = b?.chunks.find(x => x.id === u.chunk_id);
      if (!c || stable(indexUnit(c, b, generation.config.embedding)) !== stable(u)) fail('search_unit_source_mismatch');
    }
    const expectedCount = allowedBundles.reduce((n, b) => n + b.chunks.length, 0);
    if (expectedCount !== units.length) fail('missing_generation_units');
    const unitMap = new Map(units.map(u => [u.id, u]));
    timings.registry = performance.now() - started;
    const time = async (name, fn) => { const start = performance.now(); try { return await fn(); } finally { timings[name] = performance.now() - start; } };
    let channels = { lexical: [], vector: [] }, degraded = false;
    if (query.text && documentIds.length) {
      const [lexical, vector] = await Promise.allSettled([
        time('lexical', () => postgres.lexical(context.tenant, generation.id, documentIds, query.text, query.limits.candidates)),
        time('vector', async () => {
          const v = validateVector(await embedding.embed(query.text), embedding.config); result.measurements.mock_embedding_calls++;
          return qdrant.query(generation, documentIds, v, query.limits.candidates);
        }),
      ]);
      if (lexical.status === 'rejected') fail('lexical_service_failed');
      channels.lexical = lexical.value; result.channels.push('postgres_lexical');
      if (vector.status === 'rejected') {
        // Only transport/service errors permit degradation; configuration/scope violations never do.
        const code = vector.reason?.code;
        if (!allowLexicalFallback || code && code !== 'qdrant_request_failed') fail(code || 'vector_service_failed');
        degraded = true; result.warnings.push('vector_service_failed_lexical_fallback');
      } else { channels.vector = vector.value; result.channels.push('qdrant_mock_vector'); }
    }
    for (const rows of Object.values(channels)) for (const row of rows) if (!unitMap.has(row.id)) fail('channel_result_outside_scope');
    for (const row of channels.vector) {
      const unit = unitMap.get(row.id);
      if (row.document_id !== unit.document_id || row.version_id !== unit.version_id || row.input_hash !== unit.input_hash) fail('vector_source_mismatch');
    }
    result.measurements.candidate_counts = Object.fromEntries(Object.entries(channels).map(([k, rows]) => [k, rows.length]));
    const mergeStart = performance.now(), ranked = rrf(channels, generation.config.rrf_constant);
    const seen = new Set(), textSeen = new Set(), perDoc = new Map(), selected = [];
    let contextTokens = 0;
    function add(unit, reason, rank) {
      if (seen.has(unit.id)) return false;
      const b = bundleByDoc.get(unit.document_id);
      const entry = sourceEntry(unit, b, reason, rank);
      const duplicate = id('text', unit.document_id, unit.version_id, b.document.rights, entry.source_text);
      if (textSeen.has(duplicate) || (perDoc.get(unit.document_id) || 0) >= query.limits.perDocument) return false;
      const cost = tokenCount(JSON.stringify(entry));
      if (contextTokens + cost > query.limits.contextTokens) { if (!result.warnings.includes('context_budget_limited')) result.warnings.push('context_budget_limited'); return false; }
      contextTokens += cost; selected.push(entry); seen.add(unit.id); textSeen.add(duplicate);
      perDoc.set(unit.document_id, (perDoc.get(unit.document_id) || 0) + 1); return true;
    }
    for (const rank of ranked) { if (selected.length >= query.limits.topK) break; add(unitMap.get(rank.id), 'ranked_seed', rank); }
    timings.fusion_selection = performance.now() - mergeStart;
    const expandStart = performance.now(); let steps = 0, additions = 0;
    const queue = [...selected];
    if (query.graph) for (let i = 0; i < queue.length && steps < query.limits.graphSteps && additions < query.limits.graphAdditions; i++) {
      const seed = queue[i], b = bundleByDoc.get(seed.document_id);
      for (const neighbor of neighbors(b, seed.chunk_id)) {
        if (steps >= query.limits.graphSteps || additions >= query.limits.graphAdditions) break;
        steps++;
        const unit = units.find(u => u.document_id === b.document.id && u.version_id === b.version.id && u.chunk_id === neighbor.chunk.id);
        if (unit && add(unit, { type: 'structural_expansion', seed_evidence_id: seed.evidence_id, via: neighbor.via, edge_ids: neighbor.edges })) {
          additions++; queue.push(selected.at(-1));
        }
      }
    }
    timings.expansion = performance.now() - expandStart;
    if (hooks.beforePolicyCheck) await hooks.beforePolicyCheck();
    const current = await policy.allowed(context);
    result.evidence = selected.filter(e => current.documents.includes(e.document_id));
    if (current.revision !== access.revision) {
      result.warnings.push('access_policy_changed_rechecked'); result.measurements.candidate_counts = {};
    }
    result.corpus = { source_generation: generation.snapshot.source_generation,
      documents: Object.fromEntries(Object.entries(generation.snapshot.documents).filter(([d]) => documentIds.includes(d) && current.documents.includes(d))) };
    result.measurements.context_tokens = result.evidence.reduce((n, e) => n + tokenCount(JSON.stringify(e)), 0);
    result.measurements.graph_steps = steps;
    result.measurements.graph_additions = result.evidence.filter(e => typeof e.selection.reason === 'object').length;
    result.state = degraded ? 'degraded' : result.evidence.length ? 'ok' : 'empty';
  } catch (error) {
    result.state = 'error'; result.evidence = []; result.corpus = null;
    result.error = typeof error.code === 'string' && /^[a-z][a-z0-9_]+$/.test(error.code) ? error.code : 'search_service_failed';
  }
  timings.total = performance.now() - started;
  return result;
}
