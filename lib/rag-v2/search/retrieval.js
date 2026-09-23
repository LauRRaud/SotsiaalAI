import { locationFields } from '../source-locations.js';
import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import { fail, hash, id, stable } from '../contracts.js';
import { accessContext } from './policy.js';
import { filtersMatch, rrf, validateQuery } from './ranking.js';
import { indexUnit, tokenCount, validateVector } from './embedding.js';
import { verifySearchConfig } from './indexing.js';
import { modelProjection, modelSourceMetadata } from './model-context.js';
import { structuralRole, STRUCTURAL_ROLE_VERSION } from './structural-role.js';
import { dependencyContext, expandDependencies } from './dependencies.js';
import { directoryScope, retrievalDirectory } from './discovery.js';

// Journal year, issue and page range belong to an article citation even when no full
// publication date is known. Absent values stay absent; nothing is guessed.
function bibliography(fields) {
  const optional = { publication_year: fields.publication_year?.value, journal_title: fields.journal_title?.value,
    issue_label: fields.issue_label?.value, page_range: fields.journal_page_range?.value };
  return { title: fields.title.value, authors: fields.authors.value, publication_date: fields.publication_date.value,
    ...Object.fromEntries(Object.entries(optional).filter(([, value]) => value !== null && value !== undefined && value !== '')) };
}

export function sourceEntry(unit, bundle, reason, rank) {
  const chunk = bundle.chunks.find(c => c.id === unit.chunk_id);
  if (!chunk || unit.version_id !== bundle.version.id || unit.document_id !== bundle.document.id) fail('evidence_scope_mismatch');
  const spans = chunk.span_ids.map(s => bundle.spans.find(x => x.id === s));
  if (spans.some(s => !s || s.document_version_id !== bundle.version.id || s.tenant_id !== bundle.tenant_id)
    || chunk.source_text !== spans.map(s => s.source_text).join('\n')) fail('evidence_span_mismatch');
  return { evidence_id: id('evidence', bundle.tenant_id, bundle.version.id, unit.id), document_id: bundle.document.id,
    document_version_id: bundle.version.id, unit_id: unit.id, chunk_id: chunk.id, span_ids: chunk.span_ids,
    ...locationFields(chunk), pdf_pages: chunk.pdf_pages, source_text: chunk.source_text,
    bibliography: bibliography(bundle.document.fields),
    source_metadata: modelSourceMetadata(bundle),
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
  const result = { schema_version: 'rag-v2/evidence-1', query_id: id('query', context.tenant, randomUUID()),
    query: { text_hash: hash(query.text), language: query.language, filters: query.filters }, tenant: context.tenant,
    state: 'error', embedding_mode: embedding.config.embedding_mode, generation_id: null, corpus: null, config: null, channels: [], warnings: [], evidence: [],
    raw_rankings: {}, selection_trace: [],
    selection_config: { version: query.semanticGraph ? 'selection-v3-dependencies' : 'selection-v2', method: query.method, semantic_graph: query.semanticGraph,
      context_mode: query.contextMode, structural_role_version: STRUCTURAL_ROLE_VERSION,
      include_document_labels: query.includeDocumentLabels, limits: query.limits, final_limit: query.finalLimit },
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
    if (embedding.config.embedding_mode === 'real' && embedding.source !== 'persisted_vectors') fail('persisted_real_vectors_required');
    if (query.generation_id && query.generation_id !== generation.id) fail('requested_generation_not_active');
    result.generation_id = generation.id; result.config = generation.config;
    if (hooks.afterPin) await hooks.afterPin(generation);
    const visible = Object.keys(generation.snapshot.documents).filter(d => access.documents.includes(d));
    const directories = await postgres.retrievalDirectory?.(context.tenant, generation, visible);
    const scope = directories ? directoryScope(directories, query) : null;
    if (scope && query.semanticGraph) {
      result.selection_config.version = 'selection-v4-lazy-dependencies';
      result.selection_config.dependency_document_limit = query.limits.dependencySteps;
    }
    const allowedBundles = [], units = [], bundleByDoc = new Map(), unitMap = new Map(), roleMap = new Map();
    let documentIds = scope?.documentIds;
    result.measurements.loading = { strategy: scope ? 'candidate_documents' : 'legacy_eager', directory_documents: directories?.length ?? 0,
      loaded_documents: 0, loaded_units: 0 };
    async function hydrate(requested, suppliedBundles) {
      const missing = [...new Set(requested)].filter(doc => !bundleByDoc.has(doc));
      if (!missing.length) return;
      if (missing.some(doc => !documentIds.includes(doc))) fail('channel_result_outside_scope');
      const bundles = suppliedBundles || await postgres.bundles(context.tenant, generation.id, missing);
      if (bundles.length !== missing.length || new Set(bundles.map(b => b.document.id)).size !== missing.length) fail('missing_generation_source');
      const loaded = await postgres.units(context.tenant, generation.id, missing);
      const local = new Map(bundles.map(b => [b.document.id, b]));
      for (const bundle of bundles) {
        if (!missing.includes(bundle.document.id) || generation.snapshot.documents[bundle.document.id]?.version_id !== bundle.version.id
          || !filtersMatch(bundle, query.filters)) fail('source_scope_mismatch');
        if (scope && stable(retrievalDirectory(bundle, generation.config.embedding, scope.byDocument.get(bundle.document.id).schema_version)) !== stable(scope.byDocument.get(bundle.document.id))) fail('retrieval_directory_integrity_failed');
      }
      for (const unit of loaded) {
        const bundle = local.get(unit.document_id), chunk = bundle?.chunks.find(c => c.id === unit.chunk_id);
        if (!chunk || stable(indexUnit(chunk, bundle, generation.config.embedding)) !== stable(unit)) fail('search_unit_source_mismatch');
      }
      if (bundles.reduce((n, b) => n + b.chunks.length, 0) !== loaded.length || new Set(loaded.map(u => u.id)).size !== loaded.length) fail('missing_generation_units');
      for (const bundle of bundles) { allowedBundles.push(bundle); bundleByDoc.set(bundle.document.id, bundle); }
      for (const unit of loaded) {
        units.push(unit); unitMap.set(unit.id, unit);
        const bundle = bundleByDoc.get(unit.document_id);
        roleMap.set(unit.id, structuralRole(bundle.chunks.find(c => c.id === unit.chunk_id), bundle));
      }
      result.measurements.loading.loaded_documents = Math.max(result.measurements.loading.loaded_documents, allowedBundles.length);
      result.measurements.loading.loaded_units = units.length;
    }
    if (!scope) {
      const bundles = await postgres.bundles(context.tenant, generation.id, visible);
      if (bundles.length !== visible.length) fail('missing_generation_source');
      result.measurements.loading.loaded_documents = bundles.length;
      const filtered = bundles.filter(b => filtersMatch(b, query.filters));
      documentIds = filtered.map(b => b.document.id);
      await hydrate(documentIds, filtered);
    }
    const addresses = scope?.units || unitMap;
    const eligibleIds = scope?.eligibleIds || units.filter(u => query.includeDocumentLabels || roleMap.get(u.id).evidence_eligible).map(u => u.id);
    const eligible = new Set(eligibleIds);
    for (const unit of addresses.values()) if (!eligible.has(unit.id)) result.selection_trace.push({ unit_id: unit.id, reason: 'structural_document_label', role: unit.role || roleMap.get(unit.id) });
    timings.registry = performance.now() - started;
    const time = async (name, fn) => { const start = performance.now(); try { return await fn(); } finally { timings[name] = performance.now() - start; } };
    let channels = { lexical: [], vector: [] }, degraded = false;
    if (query.text && documentIds.length && eligibleIds.length) {
      const [lexical, vector] = await Promise.allSettled([
        query.method === 'vector' ? Promise.resolve([]) : time('lexical', () => postgres.lexical(context.tenant, generation.id, documentIds, query.text, query.limits.candidates, eligibleIds)),
        query.method === 'lexical' ? Promise.resolve([]) : time('vector', async () => {
          const v = validateVector(await embedding.embed(query.text), embedding.config);
          if (embedding.config.embedding_mode === 'mock') result.measurements.mock_embedding_calls++;
          else result.measurements.stored_query_vector_reads = (result.measurements.stored_query_vector_reads || 0) + 1;
          return qdrant.query(generation, documentIds, v, query.limits.candidates, eligibleIds);
        }),
      ]);
      if (lexical.status === 'rejected') fail('lexical_service_failed');
      channels.lexical = lexical.value; if (query.method !== 'vector') result.channels.push('postgres_lexical');
      if (vector.status === 'rejected') {
        // Only transport/service errors permit degradation; configuration/scope violations never do.
        const code = vector.reason?.code;
        if (query.method === 'vector' || !allowLexicalFallback || code && code !== 'qdrant_request_failed') fail(code || 'vector_service_failed');
        degraded = true; result.warnings.push('vector_service_failed_lexical_fallback');
      } else { channels.vector = vector.value; if (query.method !== 'lexical') result.channels.push(`qdrant_${embedding.config.embedding_mode}_vector`); }
    }
    for (const rows of Object.values(channels)) for (const row of rows) if (!addresses.has(row.id) || !eligible.has(row.id)) fail('channel_result_outside_scope');
    const hydrateStart = performance.now();
    await hydrate(Object.values(channels).flat().map(row => addresses.get(row.id).document_id));
    timings.hydration = performance.now() - hydrateStart;
    for (const row of channels.vector) {
      const unit = unitMap.get(row.id);
      if (row.document_id !== unit.document_id || row.version_id !== unit.version_id || row.input_hash !== unit.input_hash) fail('vector_source_mismatch');
    }
    result.measurements.candidate_counts = Object.fromEntries(Object.entries(channels).map(([k, rows]) => [k, rows.length]));
    const mergeStart = performance.now(), ranked = rrf(channels, generation.config.rrf_constant);
    const seen = new Set(), textSeen = new Set(), perDoc = new Map(), selected = [];
    let contextTokens = 0;
    const rejected = (unit, reason) => { result.selection_trace.push({ unit_id: unit.id, reason }); return false; };
    function add(unit, reason, rank) {
      if (!eligible.has(unit.id)) return rejected(unit, 'structural_document_label');
      if (seen.has(unit.id)) return rejected(unit, 'duplicate_unit');
      if (selected.length >= query.finalLimit) return rejected(unit, 'final_limit');
      const b = bundleByDoc.get(unit.document_id);
      const entry = sourceEntry(unit, b, reason, rank);
      const duplicate = id('text', unit.document_id, unit.version_id, b.document.rights, entry.source_text);
      if (textSeen.has(duplicate)) return rejected(unit, 'duplicate_text');
      if ((perDoc.get(unit.document_id) || 0) >= query.limits.perDocument) return rejected(unit, 'document_cap');
      const nextTokens = query.contextMode === 'compact' ? modelProjection([...selected, entry], result).measurements.model_context_tokens : contextTokens + tokenCount(JSON.stringify(entry));
      // Leave room for an explicit unresolved-dependency marker even when full
      // derived graph context cannot fit. Never silently label a clipped graph complete.
      if (nextTokens > query.limits.contextTokens - (query.semanticGraph ? 256 : 0)) { if (!result.warnings.includes('context_budget_limited')) result.warnings.push('context_budget_limited'); return rejected(unit, 'context_budget'); }
      contextTokens = nextTokens; selected.push(entry); seen.add(unit.id); textSeen.add(duplicate);
      perDoc.set(unit.document_id, (perDoc.get(unit.document_id) || 0) + 1); return true;
    }
    for (const rank of ranked) {
      if (selected.length >= query.limits.topK) rejected(unitMap.get(rank.id), 'seed_limit');
      else add(unitMap.get(rank.id), 'ranked_seed', rank);
    }
    timings.fusion_selection = performance.now() - mergeStart;
    const dependencyPlan = query.semanticGraph ? await expandDependencies({ bundles: allowedBundles, units, selected, add, limits: query.limits,
      ...(scope ? { incomingDocuments: scope.incomingDocuments, loadDocument: async (documentId, versionId) => {
        if (scope.byDocument.get(documentId)?.version_id !== versionId) return null;
        await hydrate([documentId]);
        return { bundle: bundleByDoc.get(documentId), units: units.filter(unit => unit.document_id === documentId) };
      }, documentVersions: new Map([...scope.byDocument].map(([doc, directory]) => [doc, directory.version_id])) } : {}) }) : null;
    const expandStart = performance.now(); let steps = 0, additions = 0;
    const queue = [...selected];
    const graphTraceStart = result.selection_trace.length;
    const graphAudit = { enabled: query.graph, initial_seed_count: queue.filter(entry => entry.selection.reason === 'ranked_seed').length, edge_candidates_seen: 0,
      free_final_slots_at_start: Math.max(0, query.finalLimit - queue.length),
      available_document_slots_at_start: [...perDoc.values()].reduce((n, count) => n + Math.max(0, query.limits.perDocument - count), 0),
      available_context_tokens_at_start: Math.max(0, query.limits.contextTokens - contextTokens) };
    if (query.graph) for (let i = 0; i < queue.length && steps < query.limits.graphSteps && additions < query.limits.graphAdditions; i++) {
      const seed = queue[i], b = bundleByDoc.get(seed.document_id);
      for (const neighbor of neighbors(b, seed.chunk_id)) {
        if (steps >= query.limits.graphSteps || additions >= query.limits.graphAdditions) break;
        steps++;
        const unit = units.find(u => u.document_id === b.document.id && u.version_id === b.version.id && u.chunk_id === neighbor.chunk.id);
        if (unit && eligibleIds.includes(unit.id)) graphAudit.edge_candidates_seen++;
        if (unit && add(unit, { type: 'structural_expansion', seed_evidence_id: seed.evidence_id, via: neighbor.via, edge_ids: neighbor.edges })) {
          additions++; queue.push(selected.at(-1));
        }
      }
    }
    timings.expansion = performance.now() - expandStart;
    if (hooks.beforePolicyCheck) await hooks.beforePolicyCheck();
    const current = await policy.allowed(context);
    result.evidence = selected.filter(e => current.documents.includes(e.document_id));
    if (dependencyPlan) {
      const visibleEdges = new Set(dependencyPlan.edges.filter(edge => current.documents.includes(edge.document_id)).map(edge => edge.id));
      for (const entry of result.evidence) {
        const reason = entry.selection.reason;
        if (reason?.type === 'semantic_dependency' && reason.dependency_id && !visibleEdges.has(reason.dependency_id)) {
          entry.selection = { ...entry.selection, reason: { ...reason, dependency_id: null } };
        }
      }
    }
    if (current.revision !== access.revision) {
      result.warnings.push('access_policy_changed_rechecked'); result.measurements.candidate_counts = {};
    }
    result.corpus = { source_generation: generation.snapshot.source_generation,
      documents: Object.fromEntries(Object.entries(generation.snapshot.documents).filter(([d]) => documentIds.includes(d) && current.documents.includes(d))) };
    if (dependencyPlan) {
      result.dependency_context = dependencyContext(dependencyPlan, result.evidence, current.documents);
      if (modelProjection(result.evidence, result).measurements.model_context_tokens > query.limits.contextTokens) {
        result.dependency_context = { schema_version: 'rag-v2/dependency-context-1', known_context: 'incomplete', corpus_completeness: 'not_assessed',
          verification_state: 'source_anchored_unreviewed', claims: [], relations: [], unresolved: [{ reason: 'dependency_context_budget' }] };
      }
      result.measurements.dependency_steps = dependencyPlan.steps;
      result.measurements.dependency_additions = result.evidence.filter(e => e.selection.reason?.type === 'semantic_dependency').length;
    }
    const projection = modelProjection(result.evidence, result);
    if (query.semanticGraph && projection.measurements.model_context_tokens > query.limits.contextTokens) fail('dependency_context_budget_exceeded');
    result.model_context = projection.context; result.reference_map = projection.references;
    Object.assign(result.measurements, projection.measurements);
    result.measurements.context_tokens = query.contextMode === 'compact' ? projection.measurements.model_context_tokens : result.evidence.reduce((n, e) => n + tokenCount(JSON.stringify(e)), 0);
    const stillAllowed = unit => current.documents.includes(addresses.get(unit)?.document_id);
    result.raw_rankings = { lexical: channels.lexical.filter(r => stillAllowed(r.id)), vector: channels.vector.filter(r => stillAllowed(r.id)), hybrid: ranked.filter(r => stillAllowed(r.id)) };
    result.selection_trace = result.selection_trace.filter(r => stillAllowed(r.unit_id));
    result.measurements.graph_steps = steps;
    result.measurements.graph_additions = result.evidence.filter(e => e.selection.reason?.type === 'structural_expansion').length;
    result.measurements.graph_opportunity = !query.graph ? 'disabled' : additions ? 'exercised' : 'not_exercised';
    graphAudit.rejection_reasons = result.selection_trace.slice(graphTraceStart).reduce((counts, row) => ({ ...counts, [row.reason]: (counts[row.reason] || 0) + 1 }), {});
    result.graph_audit = graphAudit;
    result.state = degraded ? 'degraded' : result.evidence.length ? 'ok' : 'empty';
  } catch (error) {
    result.state = 'error'; result.evidence = []; result.corpus = null; result.raw_rankings = {}; result.selection_trace = [];
    result.model_context = null; result.reference_map = {}; delete result.dependency_context;
    result.error = typeof error.code === 'string' && /^[a-z][a-z0-9_]+$/.test(error.code) ? error.code : 'search_service_failed';
  }
  timings.total = performance.now() - started;
  return result;
}
