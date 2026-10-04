import { locationFields } from '../source-locations.js';
import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import { fail, hash, id, stable } from '../contracts.js';
import { accessContext } from './policy.js';
import { channelKind, filtersMatch, publicationYear, rrf, validateQuery } from './ranking.js';
import { withoutStopwords } from './query-stopwords.js';
import { indexUnit, tokenCount, validateVector } from './embedding.js';
import { verifySearchConfig } from './indexing.js';
import { modelProjection, modelSourceMetadata } from './model-context.js';
import { structuralRole, STRUCTURAL_ROLE_VERSION } from './structural-role.js';
import { dependencyContext, expandDependencies } from './dependencies.js';
import { actGenitive, actSections, internalReferences, keepsSuperscripts, namedActReferences, provisionChunks, readReferences, resolveSection, sectionReferences } from './legal-references.js';
import { directoryScope, retrievalDirectory } from './discovery.js';
import { declaredValidity } from './legal-validity.js';
import { generationIdentity } from './layout.js';
import { legalDates } from './legal-dates.js';

// Journal year, issue and page range belong to an article citation even when no full
// publication date is known. Absent values stay absent; nothing is guessed.
function bibliography(fields) {
  const optional = { publication_year: fields.publication_year?.value, journal_title: fields.journal_title?.value,
    issue_label: fields.issue_label?.value, page_range: fields.journal_page_range?.value };
  return { title: fields.title.value, authors: fields.authors.value, publication_date: fields.publication_date.value,
    ...Object.fromEntries(Object.entries(optional).filter(([, value]) => value !== null && value !== undefined && value !== '')) };
}

const spanLookups = new WeakMap();
const spanLookup = bundle => {
  if (!spanLookups.has(bundle)) spanLookups.set(bundle, new Map(bundle.spans.map(span => [span.id, span])));
  return spanLookups.get(bundle);
};
export function sourceEntry(unit, bundle, reason, rank) {
  const chunk = bundle.chunks.find(c => c.id === unit.chunk_id);
  if (!chunk || unit.version_id !== bundle.version.id || unit.document_id !== bundle.document.id) fail('evidence_scope_mismatch');
  const byId = spanLookup(bundle), spans = chunk.span_ids.map(s => byId.get(s));
  if (spans.some(s => !s || s.document_version_id !== bundle.version.id || s.tenant_id !== bundle.tenant_id)
    || chunk.source_text !== spans.map(s => s.source_text).join('\n')) fail('evidence_span_mismatch');
  // The act's own dates and the chunk's amendment notes (ADR-062): what the bundle says, the same for every query.
  const dates = legalDates(bundle, chunk);
  return { evidence_id: id('evidence', bundle.tenant_id, bundle.version.id, unit.id), document_id: bundle.document.id,
    document_version_id: bundle.version.id, unit_id: unit.id, chunk_id: chunk.id, span_ids: chunk.span_ids,
    ...locationFields(chunk), pdf_pages: chunk.pdf_pages, source_text: chunk.source_text,
    bibliography: bibliography(bundle.document.fields),
    source_metadata: modelSourceMetadata(bundle),
    search_aids: { heading_prefix: chunk.retrieval_text.slice(0, chunk.retrieval_mapping.prefix_length),
      legacy_description: bundle.document.search_aids.description, role: 'not_source_quote' },
    selection: { reason, ranks: rank?.ranks ?? {}, rrf_contributions: rank?.contributions ?? {}, rrf_score: rank?.score ?? null },
    limitations: bundle.report.warnings,
    ...(dates ? { legal_dates: dates } : {}),
  };
}
// What a budget counts of an audit entry: never its legal dates, so a bundle with them selects what it selects without.
const budgetEntry = ({ legal_dates: _dates, ...entry }) => entry;
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

// How many fused candidates a reranker reads (about 20k tokens of source text at ~700 per chunk).
export const RERANK_POOL = 30;
// Ranked candidates whose sources load before selection (topK 9 with room for rejections).
const HYDRATE_AHEAD = 24;
export async function retrieve({ postgres, qdrant, embedding, policy, context, query: input, allowLexicalFallback = true, hooks = {} }) {
  accessContext(context);
  const query = validateQuery(input), started = performance.now(), timings = {};
  const result = { schema_version: 'rag-v2/evidence-1', query_id: id('query', context.tenant, randomUUID()),
    query: { text_hash: hash(query.text), language: query.language, filters: query.filters }, tenant: context.tenant,
    state: 'error', embedding_mode: embedding.config.embedding_mode, generation_id: null, corpus: null, config: null, channels: [], warnings: [], evidence: [],
    raw_rankings: {}, selection_trace: [],
    selection_config: { version: query.semanticGraph ? 'selection-v3-dependencies' : 'selection-v2', method: query.method, semantic_graph: query.semanticGraph,
      context_mode: query.contextMode, structural_role_version: STRUCTURAL_ROLE_VERSION,
      include_document_labels: query.includeDocumentLabels, limits: query.limits, final_limit: query.finalLimit,
      ...(query.lexicalRank ? { lexical_rank: query.lexicalRank } : {}) },
    limitations: { semantic_quality: 'NOT_PROVEN', corpus_completeness: 'not_assessed', authentication: 'trusted_local_policy_only' },
    measurements: { timings_ms: timings, candidate_counts: {}, context_tokens: 0, external_embedding_calls: 0, generation_calls: 0, mock_embedding_calls: 0 },
  };
  try {
    const access = await policy.allowed(context);
    const generation = await postgres.active(context.tenant);
    verifySearchConfig(generation.config);
    if (generation.snapshot.snapshot_hash !== hash(stable(generation.snapshot.documents))
      || generation.id !== generationIdentity(context.tenant, generation.snapshot, generation.config, generation.layout)) fail('search_generation_integrity_failed');
    if (stable(embedding.config) !== stable(generation.config.embedding)) fail('query_embedding_space_mismatch');
    if (embedding.config.embedding_mode === 'real' && embedding.source !== 'persisted_vectors') fail('persisted_real_vectors_required');
    if (query.generation_id && query.generation_id !== generation.id) fail('requested_generation_not_active');
    result.generation_id = generation.id; result.config = generation.config;
    if (hooks.afterPin) await hooks.afterPin(generation);
    const allowed = new Set(access.documents), visible = Object.keys(generation.snapshot.documents).filter(d => allowed.has(d));
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
    const time = async (name, fn) => {
      const start = performance.now();
      let value;
      try { value = await fn(); return value; } finally {
        timings[name] = performance.now() - start;
        if (Number.isFinite(value?.server_ms)) timings[`${name}_server`] = value.server_ms; // Qdrant's own time for a vector query
      }
    };
    let channels = { lexical: [], vector: [] }, reserveChannels = {}, degraded = false;
    // The question and each of its search variants query both channels; RRF fuses every list.
    const texts = [query.text, ...(query.variants || [])];
    // Reserved rerank places (ADR-032) search only their own documents, with the same texts and vectors.
    const reserve = hooks.rerank && query.poolReserve ? (() => {
      const scoped = new Set(documentIds), docs = new Set(query.poolReserve.documents.filter(doc => scoped.has(doc)));
      return { documentIds: [...docs], eligibleIds: eligibleIds.filter(unit => docs.has(addresses.get(unit).document_id)) };
    })() : null;
    if (reserve) result.selection_config.pool_reserve = { documents: reserve.documentIds.length, size: query.poolReserve.size, per_document: query.poolReserve.perDocument,
      ...(query.poolReserve.perQuery ? { per_query: query.poolReserve.perQuery } : {}) };
    if (query.text && documentIds.length && eligibleIds.length) {
      // One lexical query carries the words of the question and all its variants (an OR query, so a
      // variant's official term still matches); the vector channel embeds each text on its own.
      const lexicalText = texts.join('\n'), vectors = new Map();
      const vectorFor = text => {
        if (!vectors.has(text)) vectors.set(text, (async () => {
          const v = validateVector(await embedding.embed(text), embedding.config);
          if (embedding.config.embedding_mode === 'mock') result.measurements.mock_embedding_calls++;
          else result.measurements.stored_query_vector_reads = (result.measurements.stored_query_vector_reads || 0) + 1;
          return v;
        })());
        return vectors.get(text);
      };
      const search = (scopeDocuments, scopeUnits, prefix) => Promise.all(texts.map((text, index) => {
        const suffix = index ? `_${index}` : '';
        return Promise.allSettled([
          query.method === 'vector' || index ? Promise.resolve([]) : time(`${prefix}lexical`, () => postgres.lexical(context.tenant, generation.id, scopeDocuments,
            query.lexicalStopwords ? withoutStopwords(lexicalText) : lexicalText, query.limits.candidates, scopeUnits,
            query.lexicalRank ? { rank: query.lexicalRank } : {})),
          query.method === 'lexical' ? Promise.resolve([]) : time(`${prefix}vector${suffix}`, async () =>
            qdrant.query(generation, scopeDocuments, await vectorFor(text), query.limits.candidates, scopeUnits)),
        ]).then(([lexical, vector]) => ({ suffix, lexical, vector }));
      }));
      const [runs, reserveRuns] = await Promise.all([search(documentIds, eligibleIds, ''),
        reserve?.eligibleIds.length ? search(reserve.documentIds, reserve.eligibleIds, 'reserve_') : []]);
      for (const [target, list, main] of [[channels, runs, true], [reserveChannels, reserveRuns, false]]) for (const { suffix, lexical, vector } of list) {
        if (lexical.status === 'rejected') fail('lexical_service_failed');
        if (!suffix) { target.lexical = lexical.value; if (main && query.method !== 'vector') result.channels.push('postgres_lexical'); }
        if (vector.status === 'rejected') {
          // Only transport/service errors permit degradation; configuration/scope violations never do.
          const code = vector.reason?.code;
          if (query.method === 'vector' || !allowLexicalFallback || code && code !== 'qdrant_request_failed') fail(code || 'vector_service_failed');
          degraded = true; if (!result.warnings.includes('vector_service_failed_lexical_fallback')) result.warnings.push('vector_service_failed_lexical_fallback');
        } else { target[`vector${suffix}`] = vector.value; if (main && !suffix && query.method !== 'lexical') result.channels.push(`qdrant_${embedding.config.embedding_mode}_vector`); }
      }
      if (query.variants?.length) result.channels.push(`search_variants_${query.variants.length}`);
      if (reserveRuns.length) result.channels.push('pool_reserve');
    }
    for (const rows of Object.values(channels)) for (const row of rows) if (!addresses.has(row.id) || !eligible.has(row.id)) fail('channel_result_outside_scope');
    const reserveUnits = new Set(reserve?.eligibleIds);
    for (const rows of Object.values(reserveChannels)) for (const row of rows) if (!reserveUnits.has(row.id)) fail('channel_result_outside_scope');
    result.measurements.candidate_counts = Object.fromEntries([...Object.entries(channels), ...Object.entries(reserveChannels).map(([k, rows]) => [`reserve_${k}`, rows])]
      .map(([k, rows]) => [k, rows.length]));
    const weights = lists => query.channelWeights && Object.fromEntries(Object.keys(lists).map(name => [name, query.channelWeights[channelKind(name)] ?? 1]));
    const mergeStart = performance.now(), ranked = rrf(channels, generation.config.rrf_constant, weights(channels));
    // A reserved candidate's ranks name the reserve channels, so its evidence shows how it was found.
    const prefixed = values => Object.fromEntries(Object.entries(values).map(([name, value]) => [`reserve_${name}`, value]));
    const reserveRanked = reserve ? rrf(reserveChannels, generation.config.rrf_constant, weights(reserveChannels))
      .map(rank => ({ ...rank, ranks: prefixed(rank.ranks), contributions: prefixed(rank.contributions) })) : [];
    const vectorRows = () => [...Object.entries(channels), ...Object.entries(reserveChannels)].filter(([name]) => channelKind(name) === 'vector').flatMap(([, rows]) => rows);
    // Fusion needs only the verified directory addresses. Full sources load for the documents whose
    // units can reach the context: the rerank pool or the leading ranked candidates; a seed further
    // down loads when the selection reaches it. (Without a directory every source is already loaded.)
    const hydrateStart = performance.now();
    if (!hooks.rerank) await hydrate(ranked.slice(0, HYDRATE_AHEAD).map(rank => addresses.get(rank.id).document_id));
    timings.hydration = performance.now() - hydrateStart;
    // Every vector hit must name its unit's document and version; a loaded unit also its input text.
    for (const row of vectorRows()) {
      const address = addresses.get(row.id), unit = unitMap.get(row.id);
      if (row.document_id !== address.document_id || row.version_id !== address.version_id || unit && row.input_hash !== unit.input_hash) fail('vector_source_mismatch');
    }
    const seen = new Set(), textSeen = new Set(), perDoc = new Map(), selected = [];
    let contextTokens = 0;
    const rejected = (unit, reason) => { result.selection_trace.push({ unit_id: unit.id, reason }); return false; };
    function add(unit, reason, rank) {
      if (!eligible.has(unit.id)) return rejected(unit, 'structural_document_label');
      if (seen.has(unit.id)) return rejected(unit, 'duplicate_unit');
      // A named other act's passages have places of their own (ADR-063): every other addition keeps the places it had.
      if (selected.length >= query.finalLimit - (query.namedActs && !reason?.named_act ? query.limits.namedActAdditions ?? 2 : 0)) return rejected(unit, 'final_limit');
      const b = bundleByDoc.get(unit.document_id);
      const entry = sourceEntry(unit, b, reason, rank);
      const duplicate = id('text', unit.document_id, unit.version_id, b.document.rights, entry.source_text);
      if (textSeen.has(duplicate)) return rejected(unit, 'duplicate_text');
      if ((perDoc.get(unit.document_id) || 0) >= query.limits.perDocument) return rejected(unit, 'document_cap');
      const nextTokens = query.contextMode === 'compact' ? modelProjection([...selected, entry], result, { measure: 'budget' }).measurements.model_context_tokens : contextTokens + tokenCount(JSON.stringify(budgetEntry(entry)));
      // Leave room for an explicit unresolved-dependency marker even when full
      // derived graph context cannot fit. Never silently label a clipped graph complete.
      // A profile's dependency budget (ADR-054) is room only a semantic dependency may use: the ranked seeds keep theirs. An
      // expansion budget (graph experiment, Codex 7.7) is the same room for structural neighbours or cross-references.
      const budget = query.limits.contextTokens + (reason?.type === 'semantic_dependency' ? query.limits.dependencyContextTokens ?? 0
        : ['structural_expansion', 'cross_reference'].includes(reason?.type) ? query.limits.expansionContextTokens ?? 0 : 0);
      if (nextTokens > budget - (query.semanticGraph ? 256 : 0)) { if (!result.warnings.includes('context_budget_limited')) result.warnings.push('context_budget_limited'); return rejected(unit, 'context_budget'); }
      contextTokens = nextTokens; selected.push(entry); seen.add(unit.id); textSeen.add(duplicate);
      perDoc.set(unit.document_id, (perDoc.get(unit.document_id) || 0) + 1); return true;
    }
    // An optional reranker (the chat's answer model) reads the best fused candidates and keeps, in
    // its order, only passages that bear on the request; the seeds then follow its judgement.
    let order = ranked;
    if (hooks.rerank && ranked.length) {
      // Reserved candidates that the corpus-wide order left outside the pool follow it (ADR-032), at most
      // perDocument from one document, so one long act cannot take every reserved place.
      // With a per-document limit (ADR-065) the fused candidates are taken in their order, a document's passages past its
      // limit left out and the next candidates of other documents taken in their place.
      const rerankStart = performance.now(), fused = [], fusedPerDoc = new Map();
      for (const rank of ranked) {
        if (fused.length >= RERANK_POOL) break;
        const doc = addresses.get(rank.id).document_id;
        if ((fusedPerDoc.get(doc) || 0) >= (query.limits.poolPerDocument ?? RERANK_POOL)) continue;
        fused.push(rank); fusedPerDoc.set(doc, (fusedPerDoc.get(doc) || 0) + 1);
      }
      const inPool = new Set(fused.map(rank => rank.id));
      const reserved = [], reservedPerDoc = new Map(), reservedIds = new Set();
      const take = rank => {
        const doc = addresses.get(rank.id).document_id;
        if (reserved.length >= query.poolReserve.size || inPool.has(rank.id) || reservedIds.has(rank.id)
          || (reservedPerDoc.get(doc) || 0) >= query.poolReserve.perDocument) return;
        reserved.push(rank); reservedIds.add(rank.id); reservedPerDoc.set(doc, (reservedPerDoc.get(doc) || 0) + 1);
      };
      // ADR-079: each search variant's own nearest reserved passages come first (perQuery of each, in the variants' order),
      // so a query written for one legal basis is not outvoted by the question's other words; the fused order fills the rest.
      if (reserve && query.poolReserve.perQuery) {
        const fusedById = new Map(reserveRanked.map(rank => [rank.id, rank]));
        for (const [name, rows] of Object.entries(reserveChannels)) {
          if (!/^vector_\d+$/u.test(name)) continue;
          for (const row of rows.slice(0, query.poolReserve.perQuery)) if (fusedById.has(row.id)) take(fusedById.get(row.id));
        }
      }
      for (const rank of reserveRanked) take(rank);
      const pool = [...fused, ...reserved];
      // The reranker reads the pool from its verified unit rows (heading prefix and chunk text); only
      // the passages it keeps load their full sources below. A pool unit's vector hit must also name
      // the unit's input text.
      const poolUnits = new Map(unitMap);
      const unloaded = [...new Set(pool.map(rank => addresses.get(rank.id).document_id))].filter(doc => !bundleByDoc.has(doc));
      if (unloaded.length) for (const unit of await postgres.units(context.tenant, generation.id, unloaded)) poolUnits.set(unit.id, unit);
      for (const row of vectorRows()) {
        if (poolUnits.has(row.id) && row.input_hash !== poolUnits.get(row.id).input_hash) fail('vector_source_mismatch');
      }
      const passages = pool.map((rank, index) => {
        const unit = poolUnits.get(rank.id);
        if (!unit || unit.document_id !== addresses.get(rank.id).document_id || unit.version_id !== addresses.get(rank.id).version_id) fail('search_unit_source_mismatch');
        const f = scope ? scope.byDocument.get(unit.document_id).fields : bundleByDoc.get(unit.document_id).document.fields;
        const year = f.publication_date.value?.slice(0, 4) || publicationYear(f.publication_year?.value);
        // Versions of one act share their title and often their text: the reranker tells them apart by validity (ADR-042).
        const validity = declaredValidity(f);
        return { id: `P${index + 1}`, title: unit.title, ...(year ? { year } : {}),
          ...(validity ? { valid_from: validity.from, valid_to: validity.to } : {}), text: unit.input_text };
      });
      // null: the reranker was unavailable; the fused order stands and the packet says so.
      let chosen;
      // The hook's own refusals (access, scope, budget) stop the search as they are.
      try { chosen = await hooks.rerank(passages); } catch (error) { throw Object.assign(error, { fromHook: true }); }
      if (chosen === null) result.warnings.push('rerank_unavailable_fused_order');
      else {
        if (!Array.isArray(chosen) || new Set(chosen).size !== chosen.length || chosen.some(ref => !passages.some(p => p.id === ref))) fail('invalid_rerank_selection');
        order = chosen.map(ref => pool[Number(ref.slice(1)) - 1]);
      }
      result.rerank = { candidates: pool.map(rank => rank.id), selected: chosen === null ? null : order.map(rank => rank.id),
        ...(reserve ? { reserved: reserved.map(rank => rank.id) } : {}) };
      timings.rerank = performance.now() - rerankStart;
    }
    for (const rank of order) {
      if (selected.length >= query.limits.topK) { rejected({ id: rank.id }, 'seed_limit'); continue; }
      if (!unitMap.has(rank.id)) await hydrate([addresses.get(rank.id).document_id]);
      add(unitMap.get(rank.id), 'ranked_seed', rank);
    }
    timings.fusion_selection = performance.now() - mergeStart;
    const dependencyPlan = query.semanticGraph ? await expandDependencies({ bundles: allowedBundles, units, selected, add, limits: query.limits,
      ...(scope ? { incomingDocuments: scope.incomingDocuments, loadDocument: async (documentId, versionId) => {
        if (scope.byDocument.get(documentId)?.version_id !== versionId) return null;
        await hydrate([documentId]);
        return { bundle: bundleByDoc.get(documentId), units: units.filter(unit => unit.document_id === documentId) };
      }, documentVersions: new Map([...scope.byDocument].map(([doc, directory]) => [doc, directory.version_id])) } : {}) }) : null;
    // Graph experiment arm D (Codex 7.7): the act's own cross-references in the selected passages ("käesoleva seaduse § 72
    // lõikes 2"), read by the deterministic reader, add the first passage of each referenced section, in the reading order.
    // What the pointers below read: the ranked seeds and the cards' additions, not each other's additions.
    const pointing = [...selected], sectionsOf = new Map();
    if (query.references) {
      const audit = { candidates: 0, additions: 0, sections: [] }, full = () => audit.additions >= (query.limits.referenceAdditions ?? 4), later = [];
      const follow = (entry, b, key, chunk) => {
        const unit = units.find(u => u.document_id === b.document.id && u.version_id === b.version.id && u.chunk_id === chunk.id);
        if (!unit) return;
        audit.candidates++;
        if (add(unit, { type: 'cross_reference', seed_evidence_id: entry.evidence_id, section: key })) { audit.additions++; audit.sections.push(key); }
      };
      for (const entry of pointing) {
        if (full()) break;
        const b = bundleByDoc.get(entry.document_id);
        if (!b) continue;
        const chunks = [...b.chunks].sort((x, y) => x.ordinal - y.ordinal);
        if (!sectionsOf.has(b.document.id)) { try { sectionsOf.set(b.document.id, actSections(chunks)); } catch { sectionsOf.set(b.document.id, []); } }
        const sections = sectionsOf.get(b.document.id);
        if (!sections.length) continue;
        // The section's first passage; with referenceSubsections (ADR-068) the passage where each subsection the
        // reference names begins, and the section's start only when some mention names the section alone. A subsection
        // that runs on into a second passage gets that one after every reference has had its first.
        const exactNumbers = keepsSuperscripts(b.version);
        const targets = query.referenceSubsections ? sectionReferences(entry.source_text, sections, { exactNumbers })
          : internalReferences(entry.source_text, sections, { exactNumbers }).map(key => ({ key, subsections: [], whole: true }));
        for (const { key, subsections, whole } of targets) {
          if (full()) break;
          const held = [...(whole ? [provisionChunks(b, chunks, key)] : []), ...subsections.map(subsection => provisionChunks(b, chunks, key, subsection, { exactNumbers }))];
          const first = new Set(held.map(passages => passages[0]).filter(Boolean));
          for (const chunk of first) if (!full()) follow(entry, b, key, chunk);
          for (const chunk of new Set(held.flatMap(passages => passages.slice(1)))) if (!first.has(chunk)) later.push([entry, b, key, chunk]);
        }
      }
      for (const [entry, b, key, chunk] of later) if (!full()) follow(entry, b, key, chunk);
      result.measurements.cross_references = audit;
    }
    // ADR-063: a selected passage that names another act in full directly before a section ("sotsiaalhoolekande seaduse
    // § 25 lõikes 2") adds the passages that hold that subsection. The act is the one national legal text of the search
    // scope with that title: the scope holds the version in force, and a title two of its documents share names none.
    // These follow every addition above and have places of their own, so they displace nothing; their text shares the
    // cross-references' room.
    if (query.namedActs) {
      const namedStart = performance.now(), limit = query.limits.namedActAdditions ?? 2, audit = { candidates: 0, additions: 0, acts: [] };
      const names = new Map();
      // The titles are read only when a selected passage has another act's list at all. With a directory (which has no
      // titles) they come from the unit rows, and the loaded source's own title is checked below.
      if (pointing.some(entry => readReferences(entry.source_text, []).other.length)) {
        const national = fields => fields.valid_from?.value && !(Array.isArray(fields.regions?.value) && fields.regions.value.length);
        const inScope = scope ? [...scope.byDocument].filter(([, directory]) => national(directory.fields)).map(([doc]) => doc) : [];
        const titles = scope ? await postgres.documentTitles?.(context.tenant, generation.id, inScope) ?? new Map()
          : new Map(allowedBundles.filter(b => national(b.document.fields)).map(b => [b.document.id, b.document.fields.title?.value]));
        for (const [documentId, title] of titles) {
          const name = actGenitive(title);
          if (name) names.set(name, names.has(name) ? null : documentId);
        }
        for (const [name, documentId] of [...names]) if (!documentId) names.delete(name);
      }
      pointers: for (const entry of names.size ? pointing : []) {
        for (const reference of namedActReferences(entry.source_text, names)) {
          if (audit.additions >= limit) break pointers;
          if (reference.act === entry.document_id) continue;
          await hydrate([reference.act]);
          const b = bundleByDoc.get(reference.act), chunks = [...b.chunks].sort((x, y) => x.ordinal - y.ordinal);
          if (names.get(actGenitive(b.document.fields.title?.value)) !== b.document.id) continue;
          if (!sectionsOf.has(b.document.id)) { try { sectionsOf.set(b.document.id, actSections(chunks)); } catch { sectionsOf.set(b.document.id, []); } }
          // How exactly the number is read depends on the text it stands in, the pointing passage's own document
          // (Codex review of #301): a PDF's or an older XML's "§ 131" may be § 13¹, whatever the other act's text keeps.
          const exactNumbers = keepsSuperscripts(bundleByDoc.get(entry.document_id)?.version);
          const key = resolveSection(reference.base, reference.superscript, sectionsOf.get(b.document.id), exactNumbers);
          if (!key) continue;
          const holding = reference.subsections.length ? reference.subsections.flatMap(subsection => provisionChunks(b, chunks, key, subsection, { exactNumbers }))
            : provisionChunks(b, chunks, key);
          for (const chunk of new Set(holding)) {
            if (audit.additions >= limit) break;
            const unit = units.find(u => u.document_id === b.document.id && u.version_id === b.version.id && u.chunk_id === chunk.id);
            if (!unit) continue;
            audit.candidates++;
            if (add(unit, { type: 'cross_reference', seed_evidence_id: entry.evidence_id, section: key, named_act: b.document.id })) {
              audit.additions++; audit.acts.push(`${b.document.id}:${key}`);
            }
          }
        }
      }
      result.measurements.named_act_references = audit;
      timings.named_acts = performance.now() - namedStart;
    }
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
        if (unit && eligible.has(unit.id)) graphAudit.edge_candidates_seen++;
        if (unit && add(unit, { type: 'structural_expansion', seed_evidence_id: seed.evidence_id, via: neighbor.via, edge_ids: neighbor.edges })) {
          additions++; queue.push(selected.at(-1));
        }
      }
    }
    timings.expansion = performance.now() - expandStart;
    if (hooks.beforePolicyCheck) await hooks.beforePolicyCheck();
    const current = await policy.allowed(context);
    const currentDocuments = new Set(current.documents);
    result.evidence = selected.filter(e => currentDocuments.has(e.document_id));
    if (dependencyPlan) {
      const visibleEdges = new Set(dependencyPlan.edges.filter(edge => currentDocuments.has(edge.document_id)).map(edge => edge.id));
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
    const requested = new Set(documentIds);
    result.corpus = { source_generation: generation.snapshot.source_generation,
      documents: Object.fromEntries(Object.entries(generation.snapshot.documents).filter(([d]) => requested.has(d) && currentDocuments.has(d))) };
    // The whole context may use the room its additions were given: the seeds' budget, the dependencies' room and, when a
    // structural neighbour or a cross-reference was added, the expansion room (Codex 7.7). Without that room a chat turn of
    // profile v3 whose cross-references passed the seeds' budget failed as a whole, and the cards' context was dropped
    // before that (30.09.2026).
    const expanded = result.evidence.some(entry => ['structural_expansion', 'cross_reference'].includes(entry.selection.reason?.type));
    const contextLimit = query.limits.contextTokens + (query.limits.dependencyContextTokens ?? 0) + (expanded ? query.limits.expansionContextTokens ?? 0 : 0);
    if (dependencyPlan) {
      result.dependency_context = dependencyContext(dependencyPlan, result.evidence, current.documents);
      if (modelProjection(result.evidence, result, { measure: 'budget' }).measurements.model_context_tokens > contextLimit) {
        result.dependency_context = { schema_version: 'rag-v2/dependency-context-1', known_context: 'incomplete', corpus_completeness: 'not_assessed',
          verification_state: 'source_anchored_unreviewed', claims: [], relations: [], unresolved: [{ reason: 'dependency_context_budget' }] };
      }
      result.measurements.dependency_steps = dependencyPlan.steps;
      result.measurements.dependency_additions = result.evidence.filter(e => e.selection.reason?.type === 'semantic_dependency').length;
    }
    // The limit reads the context without the legal dates (budget_context_tokens), as every selection step above did: they
    // have their own cap (LEGAL_DATES_TOKENS), cost a turn no excerpt and fail it over no token limit (ADR-062).
    // context_tokens stays what the budget counted; model_context_tokens is the context as sent.
    const projection = modelProjection(result.evidence, result);
    if (query.semanticGraph && projection.measurements.budget_context_tokens > contextLimit) fail('dependency_context_budget_exceeded');
    result.model_context = projection.context; result.reference_map = projection.references;
    Object.assign(result.measurements, projection.measurements);
    result.measurements.context_tokens = query.contextMode === 'compact' ? projection.measurements.budget_context_tokens : result.evidence.reduce((n, e) => n + tokenCount(JSON.stringify(budgetEntry(e))), 0);
    const stillAllowed = unit => currentDocuments.has(addresses.get(unit)?.document_id);
    result.raw_rankings = { ...Object.fromEntries(Object.entries(channels).map(([name, rows]) => [name, rows.filter(r => stillAllowed(r.id))])),
      hybrid: ranked.filter(r => stillAllowed(r.id)), ...(reserve ? { reserve: reserveRanked.filter(r => stillAllowed(r.id)) } : {}) };
    result.selection_trace = result.selection_trace.filter(r => stillAllowed(r.unit_id));
    result.measurements.graph_steps = steps;
    result.measurements.graph_additions = result.evidence.filter(e => e.selection.reason?.type === 'structural_expansion').length;
    result.measurements.graph_opportunity = !query.graph ? 'disabled' : additions ? 'exercised' : 'not_exercised';
    graphAudit.rejection_reasons = result.selection_trace.slice(graphTraceStart).reduce((counts, row) => ({ ...counts, [row.reason]: (counts[row.reason] || 0) + 1 }), {});
    result.graph_audit = graphAudit;
    result.state = degraded ? 'degraded' : result.evidence.length ? 'ok' : 'empty';
  } catch (error) {
    if (error.fromHook) throw error;
    result.state = 'error'; result.evidence = []; result.corpus = null; result.raw_rankings = {}; result.selection_trace = [];
    result.model_context = null; result.reference_map = {}; delete result.dependency_context;
    result.error = typeof error.code === 'string' && /^[a-z][a-z0-9_]+$/.test(error.code) ? error.code : 'search_service_failed';
  }
  timings.total = performance.now() - started;
  return result;
}
