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
import { actGenitive, actSections, internalReferences, keepsSuperscripts, namedActReferences, provisionChunks, readReferences, regulationGenitive, regulationReferences, resolveSection, sectionReferences } from './legal-references.js';
import { directoryScope, retrievalDirectory } from './discovery.js';
import { declaredValidity } from './legal-validity.js';
import { generationIdentity } from './layout.js';
import { legalDates } from './legal-dates.js';
import { legalPlace } from './legal-place.js';
import { dayRefusal, followableNames, passageRelations, relationSection } from './provision-relations.js';
import ACT_ABBREVIATIONS from './act-abbreviations.json' with { type: 'json' };

// ADR-135: whether a question may name a provision of an act at all, before any title is loaded: it has a number and
// either a mark, the word for one, a word for an act, or one of Riigi Teataja's abbreviations as a word of its own.
const escaped = text => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const ABBREVIATIONS = Object.values(ACT_ABBREVIATIONS.abbreviations).filter(Boolean).map(escaped).join('|');
const ABBREVIATION_WORD = new RegExp(`(?<![\\p{L}\\d])(?:${ABBREVIATIONS})(?:-?i)?(?![\\p{L}\\d])`, 'iu');
// ADR-145: whether a selected passage may point at another act at all, before any title is loaded: a list the reader
// gives another act, or an abbreviation written as Riigi Teataja writes it (it may stand in brackets: "(SHS § 17 lg 2)").
const ABBREVIATION_WRITTEN = new RegExp(`(?<![\\p{L}\\d])(?:${ABBREVIATIONS})(?:-?\\p{Ll}{1,4})?(?![\\p{L}\\d])`, 'u');
const pointsOut = text => text.includes('§') && (readReferences(text, []).other.length > 0 || ABBREVIATION_WRITTEN.test(text));
// ADR-142: a word for a municipal regulation counts too ("määruse", "korra", "eeskirja" as a word of its own).
const mayNameProvision = text => /\d/u.test(text) && (/§|paragrahv|seadus|seadustik|määrus|(?<!\p{L})(?:korra|eeskirja)(?!\p{L})/iu.test(text) || ABBREVIATION_WORD.test(text));
const RAISED = '[⁰¹²³⁴⁵⁶⁷⁸⁹]*';
/** A question as the reader of named acts reads it. An ordinary person does not write the paragraph mark (the owner,
 *  10.10.2026): "SHS 133 lg 5", "sotsiaalhoolekande seaduse 133 lõige 5", "SHS par 133", "133. paragrahvi 5. lõige".
 *  The word for the mark and an ordinal become the mark; a number of at most three digits directly after an act's
 *  name becomes a section when a subsection, a punctuation mark or the end follows it, so a year or a count ("seaduse
 *  15 aastat") stays what it is. names: Map from each way the acts of the scope are written, in lower case, to the
 *  way the reader knows it; an abbreviation typed in small letters ("shs 133") is written as Riigi Teataja writes it. */
export function questionWithMarks(text, names) {
  let question = text.replace(new RegExp(`(\\d+${RAISED})\\.\\s*paragrahv\\p{L}*`, 'giu'), '§ $1')
    .replace(/(?<![\p{L}\d])(?:paragrahv\p{L}*|par\.?|prg\.?)\s*(?=\d)/giu, '§ ')
    .replace(new RegExp(`(\\d+${RAISED})\\.\\s*lõi(?:ge|ke|kes)(?!\\p{L})`, 'giu'), 'lg $1');
  for (const [name, written] of [...names].sort((a, b) => b[0].length - a[0].length)) {
    question = question.replace(new RegExp(`(?<![\\p{L}\\d])${escaped(name)}\\s+(\\d{1,3}${RAISED})(?=\\s*(?:lg(?!\\p{L})|lõi|[?.,;:!)]|$))`, 'giu'), (_, number) => `${written} § ${number}`)
      .replace(new RegExp(`(?<![\\p{L}\\d])${escaped(name)}(?=\\s*§)`, 'giu'), () => written);
  }
  return question;
}

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
  // ADR-123 (10.10.2026): which provision of its act the passage is. Only a section's first passage has "§ N" in its
  // text, and the heading path that names the section is not shown to the answer model. Read from the bundle alone too.
  const place = legalPlace(bundle, chunk);
  return { evidence_id: id('evidence', bundle.tenant_id, bundle.version.id, unit.id), document_id: bundle.document.id,
    document_version_id: bundle.version.id, unit_id: unit.id, chunk_id: chunk.id, span_ids: chunk.span_ids,
    ...locationFields(chunk), pdf_pages: chunk.pdf_pages, source_text: chunk.source_text,
    bibliography: bibliography(bundle.document.fields),
    source_metadata: modelSourceMetadata(bundle),
    search_aids: { heading_prefix: chunk.retrieval_text.slice(0, chunk.retrieval_mapping.prefix_length),
      legacy_description: bundle.document.search_aids.description, role: 'not_source_quote' },
    selection: { reason, ranks: rank?.ranks ?? {}, rrf_contributions: rank?.contributions ?? {}, rrf_score: rank?.score ?? null },
    limitations: bundle.report.warnings,
    ...(dates ? { legal_dates: dates } : {}), ...(place ? { legal_place: place } : {}),
  };
}
// What a budget counts of an audit entry: never its legal dates, so a bundle with them selects what it selects without.
// Its place in the act (ADR-123) is left out the same way: evidence is selected as before the entries carried it.
const budgetEntry = ({ legal_dates: _dates, legal_place: _place, ...entry }) => entry;
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
// ADR-149: when a law's provision comes with a selected passage that says the same and names no section. Measured free
// on corpus v88 (734 passages of texts and municipal records against the 6846 passages of the 40 national acts in force,
// pairs read by hand): at a similarity of 0.65 and over the nearest provision was of the passage's own matter in each of the 27 pairs read;
// between 0.60 and 0.65 in about seven of ten, the misses leading to a similarly worded provision of another act. So below
// 0.65 the provision must also be one the question's own search found. At most two a turn, read from the first nine
// selected passages, the five nearest of each.
export const COMPANION_PROVISIONS = Object.freeze({ near: 0.65, nearAndFound: 0.6, additions: 2, seeds: 9, nearest: 5 });
// ADR-154: how many passages may follow selected passages that end announcing what comes next (a colon), all together.
export const LIST_CONTINUATION = Object.freeze({ additions: 10 });
// ADR-154: the lanes after the cross-references whose provisions point on as a ranked passage does: the section the
// question names, a named other act's section and a companion provision. An own-act cross-reference does not.
const laterLane = reason => reason?.type === 'question_reference' || reason?.type === 'companion_provision' || reason?.type === 'cross_reference' && Boolean(reason.named_act);
// The heading path of a chunk, as the chunker writes it on the first line of the retrieval text ("site > page > section").
const headingPath = chunk => (chunk.retrieval_text ?? '').slice(0, chunk.retrieval_mapping?.prefix_length ?? 0).split('\n')[0].trim();
// ADR-166: a candidate's own headings under its document's title, from the heading path of its search text ("site > page
// > section" gives "section"); null for a passage with no heading of its own. The path is the text's first line, or its
// second where the input puts the title on a line of its own (embedding.js, indexUnit); the passage's text never counts.
const SECTION_CHARS = 200;
function passageSection(unit) {
  const marker = `${unit.title} > `, line = (unit.input_text ?? '').split('\n', 2).find(text => text.includes(marker));
  return line ? line.slice(line.indexOf(marker) + marker.length).trim().slice(0, SECTION_CHARS) || null : null;
}
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
        // ADR-159: 1 when the HNSW index gave a vector query's hits, 0 when it fell short and the exact query followed.
        if (typeof value?.indexed === 'boolean') timings[`${name}_hnsw`] = value.indexed ? 1 : 0;
      }
    };
    let channels = { lexical: [], vector: [] }, reserveChannels = {}, changeChannels = {}, degraded = false;
    // The question and each of its search variants query both channels; RRF fuses every list.
    const texts = [query.text, ...(query.variants || [])];
    // Reserved rerank places (ADR-032) search only their own documents, with the same texts and vectors.
    const reserve = hooks.rerank && query.poolReserve ? (() => {
      const scoped = new Set(documentIds), docs = new Set(query.poolReserve.documents.filter(doc => scoped.has(doc)));
      return { documentIds: [...docs], eligibleIds: eligibleIds.filter(unit => docs.has(addresses.get(unit).document_id)) };
    })() : null;
    if (reserve) result.selection_config.pool_reserve = { documents: reserve.documentIds.length, size: query.poolReserve.size, per_document: query.poolReserve.perDocument,
      ...(query.poolReserve.perQuery ? { per_query: query.poolReserve.perQuery } : {}) };
    // Version-change places (ADR-091): the passages that hold the provisions which differ between two versions of an
    // act, in groups (one provision's passages of both versions). They are searched among themselves with the same
    // texts and vectors, and the best groups join the pool whole: the same provision in both versions, or neither.
    const change = hooks.rerank && query.changeReserve ? (() => {
      const scoped = new Set(eligibleIds), groups = query.changeReserve.groups.map(group => group.filter(unit => scoped.has(unit))).filter(group => group.length);
      const unitIds = [...new Set(groups.flat())];
      return unitIds.length ? { groups, unitIds, documentIds: [...new Set(unitIds.map(unit => addresses.get(unit).document_id))] } : null;
    })() : null;
    if (change) result.selection_config.change_reserve = { groups: change.groups.length, units: change.unitIds.length, documents: change.documentIds.length, size: query.changeReserve.size };
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
      const [runs, reserveRuns, changeRuns] = await Promise.all([search(documentIds, eligibleIds, ''),
        reserve?.eligibleIds.length ? search(reserve.documentIds, reserve.eligibleIds, 'reserve_') : [],
        change ? search(change.documentIds, change.unitIds, 'change_') : []]);
      for (const [target, list, main] of [[channels, runs, true], [reserveChannels, reserveRuns, false], [changeChannels, changeRuns, false]]) for (const { suffix, lexical, vector } of list) {
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
      if (changeRuns.length) result.channels.push('change_reserve');
    }
    for (const rows of Object.values(channels)) for (const row of rows) if (!addresses.has(row.id) || !eligible.has(row.id)) fail('channel_result_outside_scope');
    const reserveUnits = new Set(reserve?.eligibleIds);
    for (const rows of Object.values(reserveChannels)) for (const row of rows) if (!reserveUnits.has(row.id)) fail('channel_result_outside_scope');
    const changeUnits = new Set(change?.unitIds);
    for (const rows of Object.values(changeChannels)) for (const row of rows) if (!changeUnits.has(row.id)) fail('channel_result_outside_scope');
    result.measurements.candidate_counts = Object.fromEntries([...Object.entries(channels), ...Object.entries(reserveChannels).map(([k, rows]) => [`reserve_${k}`, rows]),
      ...Object.entries(changeChannels).map(([k, rows]) => [`change_${k}`, rows])].map(([k, rows]) => [k, rows.length]));
    const weights = lists => query.channelWeights && Object.fromEntries(Object.keys(lists).map(name => [name, query.channelWeights[channelKind(name)] ?? 1]));
    const mergeStart = performance.now(), ranked = rrf(channels, generation.config.rrf_constant, weights(channels));
    // A reserved candidate's ranks name the reserve channels, so its evidence shows how it was found.
    const prefixed = (values, prefix = 'reserve_') => Object.fromEntries(Object.entries(values).map(([name, value]) => [`${prefix}${name}`, value]));
    const reserveRanked = reserve ? rrf(reserveChannels, generation.config.rrf_constant, weights(reserveChannels))
      .map(rank => ({ ...rank, ranks: prefixed(rank.ranks), contributions: prefixed(rank.contributions) })) : [];
    const changeRanked = change ? rrf(changeChannels, generation.config.rrf_constant, weights(changeChannels))
      .map(rank => ({ ...rank, ranks: prefixed(rank.ranks, 'change_'), contributions: prefixed(rank.contributions, 'change_') })) : [];
    const vectorRows = () => [...Object.entries(channels), ...Object.entries(reserveChannels), ...Object.entries(changeChannels)]
      .filter(([name]) => channelKind(name) === 'vector').flatMap(([, rows]) => rows);
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
        : ['structural_expansion', 'cross_reference', 'companion_provision', 'list_continuation'].includes(reason?.type) ? query.limits.expansionContextTokens ?? 0 : 0);
      if (nextTokens > budget - (query.semanticGraph ? 256 : 0)) { if (!result.warnings.includes('context_budget_limited')) result.warnings.push('context_budget_limited'); return rejected(unit, 'context_budget'); }
      contextTokens = nextTokens; selected.push(entry); seen.add(unit.id); textSeen.add(duplicate);
      perDoc.set(unit.document_id, (perDoc.get(unit.document_id) || 0) + 1); return true;
    }
    // An optional reranker (the chat's answer model) reads the best fused candidates and keeps, in
    // its order, only passages that bear on the request; the seeds then follow its judgement.
    let order = ranked, counterparts = null;
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
      // ADR-091: in the order the differing provisions' own passages rank for the request, each group whole. A group
      // that no longer fits is passed over, so a later, smaller one can still come; a passage the pool already has
      // keeps its place there and takes none here.
      const changed = [], groupsOf = new Map(), changeById = new Map(changeRanked.map(rank => [rank.id, rank]));
      const changeRank = unit => changeById.get(unit) ?? { id: unit, score: 0, ranks: {}, contributions: {} };
      if (change) {
        const taken = new Set(), done = new Set();
        for (const group of change.groups) for (const unit of group) groupsOf.set(unit, [...(groupsOf.get(unit) || []), group]);
        for (const rank of changeRanked) for (const group of groupsOf.get(rank.id) || []) {
          if (done.has(group)) continue;
          const fresh = group.filter(unit => !inPool.has(unit) && !reservedIds.has(unit) && !taken.has(unit));
          if (changed.length + fresh.length > query.changeReserve.size) continue;
          done.add(group);
          // A passage of the group that neither channel ranked comes with its group all the same.
          for (const unit of fresh) { changed.push(changeRank(unit)); taken.add(unit); }
        }
      }
      const pool = [...fused, ...reserved, ...changed];
      // The reranker reads the pool from its verified unit rows (heading prefix and chunk text); only
      // the passages it keeps load their full sources below. A pool unit's vector hit must also name
      // the unit's input text.
      const poolUnits = new Map(unitMap);
      const unloaded = [...new Set(pool.map(rank => addresses.get(rank.id).document_id))].filter(doc => !bundleByDoc.has(doc));
      if (unloaded.length) for (const unit of await postgres.units(context.tenant, generation.id, unloaded)) poolUnits.set(unit.id, unit);
      for (const row of vectorRows()) {
        if (poolUnits.has(row.id) && row.input_hash !== poolUnits.get(row.id).input_hash) fail('vector_source_mismatch');
      }
      // ADR-166 (owner 21.10.2026): the card names the passage's own section, the kind of source and its issuer. Two
      // passages of one page under one title ("… ravikindlustamata inimestele": its subsistence benefit and its health
      // care) were told apart by their text alone, and the selection took the wrong one. A loaded source gives its own
      // fields; the others are read once per document (documentSources).
      const poolDocs = [...new Set(pool.map(rank => addresses.get(rank.id).document_id))];
      const sources = await postgres.documentSources?.(context.tenant, generation.id, poolDocs.filter(doc => !bundleByDoc.has(doc))) ?? new Map();
      const sourceOf = doc => {
        const fields = bundleByDoc.get(doc)?.document.fields;
        return fields ? { source_type: fields.source_type?.value ?? null, authority: fields.authority?.value ?? null } : sources.get(doc) ?? {};
      };
      const passages = pool.map((rank, index) => {
        const unit = poolUnits.get(rank.id);
        if (!unit || unit.document_id !== addresses.get(rank.id).document_id || unit.version_id !== addresses.get(rank.id).version_id) fail('search_unit_source_mismatch');
        const f = scope ? scope.byDocument.get(unit.document_id).fields : bundleByDoc.get(unit.document_id).document.fields;
        const year = f.publication_date.value?.slice(0, 4) || publicationYear(f.publication_year?.value);
        // Versions of one act share their title and often their text: the reranker tells them apart by validity (ADR-042).
        const validity = declaredValidity(f);
        const section = passageSection(unit), { source_type: kind, authority } = sourceOf(unit.document_id);
        return { id: `P${index + 1}`, title: unit.title, ...(section ? { section } : {}),
          ...(typeof kind === 'string' && kind ? { source_type: kind } : {}), ...(typeof authority === 'string' && authority ? { authority } : {}),
          ...(year ? { year } : {}), ...(validity ? { valid_from: validity.from, valid_to: validity.to } : {}), text: unit.input_text };
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
        // The admin's turn view (21.10.2026): why each candidate stood where it did, in the pool's order: its place in each
        // channel, what each place gave the fused score (RRF) and the score. ADR-158: and the title and start the selection
        // model read, so the lane's own audit names its candidates.
        fused: pool.map((rank, index) => ({ document_id: addresses.get(rank.id).document_id, title: passages[index]?.title ?? null,
          lead: typeof passages[index]?.text === 'string' ? passages[index].text.replace(/\s+/gu, ' ').trim().slice(0, 160) : null,
          score: rank.score ?? null, ranks: rank.ranks ?? {}, contributions: rank.contributions ?? {} })),
        ...(reserve ? { reserved: reserved.map(rank => rank.id) } : {}),
        ...(change ? { change_reserved: changed.map(rank => rank.id), change_completed: [] } : {}) };
      if (change && chosen !== null) counterparts = { groupsOf, changeRank };
      timings.rerank = performance.now() - rerankStart;
    }
    const seeds = [];
    for (const rank of order) {
      if (selected.length >= query.limits.topK) { rejected({ id: rank.id }, 'seed_limit'); continue; }
      if (!unitMap.has(rank.id)) await hydrate([addresses.get(rank.id).document_id]);
      if (add(unitMap.get(rank.id), 'ranked_seed', rank)) seeds.push(selected.at(-1));
    }
    // ADR-091 (places-3): a section the selection kept in one version comes in the other too. The selection reads 44
    // passages and kept the newer version's passages of a rewritten section without the older one's, although both
    // were among them (measured 05.10.2026); nothing can be compared then. Which passages are one section's in the two
    // versions the server knows, so it adds the rest of each kept passage's group after the seeds, in their order. The
    // selection's own passages all stay; an added one takes room only where the final limit and the budget leave it.
    if (counterparts) for (const seed of seeds) for (const group of counterparts.groupsOf.get(seed.unit_id) || []) for (const unit of group) {
      if (seen.has(unit)) continue;
      if (!unitMap.has(unit)) await hydrate([addresses.get(unit).document_id]);
      if (add(unitMap.get(unit), { type: 'version_counterpart', seed_evidence_id: seed.evidence_id }, counterparts.changeRank(unit))) result.rerank.change_completed.push(unit);
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
    const referenceAudit = query.references ? { candidates: 0, additions: 0, sections: [] } : null;
    // The act's own cross-references of `entries`, in their order, while the profile's reference additions last. ADR-154: it
    // reads the passages above here, and once more the provisions the later lanes bring (below), with what is left.
    const followReferences = entries => {
      const audit = referenceAudit, full = () => audit.additions >= (query.limits.referenceAdditions ?? 4), later = [];
      const follow = (entry, b, key, chunk) => {
        const unit = units.find(u => u.document_id === b.document.id && u.version_id === b.version.id && u.chunk_id === chunk.id);
        if (!unit) return;
        audit.candidates++;
        if (add(unit, { type: 'cross_reference', seed_evidence_id: entry.evidence_id, section: key })) { audit.additions++; audit.sections.push(key); }
      };
      for (const entry of entries) {
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
    };
    if (referenceAudit) { followReferences(pointing); result.measurements.cross_references = referenceAudit; }
    // ADR-063: a selected passage that names another act in full directly before a section ("sotsiaalhoolekande seaduse
    // § 25 lõikes 2") adds the passages that hold that subsection. The act is the one national legal text of the search
    // scope with that title: the scope holds the version in force, and a title two of its documents share names none.
    // These follow every addition above and have places of their own, so they displace nothing; their text shares the
    // cross-references' room.
    if (query.namedActs) {
      const namedStart = performance.now(), limit = query.limits.namedActAdditions ?? 2, audit = { candidates: 0, additions: 0, acts: [] };
      const names = new Map();
      // ADR-135 (10.10.2026): whether the question itself may name a provision (read below, once the titles are known).
      const asks = mayNameProvision(query.text);
      // The titles are read only when a selected passage has another act's list at all, or the question names a section.
      // With a directory (which has no titles) they come from the unit rows, and the loaded source's own title is
      // checked below.
      let titles = new Map();
      if (asks || pointing.some(entry => pointsOut(entry.source_text))) {
        const national = fields => fields.valid_from?.value && !(Array.isArray(fields.regions?.value) && fields.regions.value.length);
        const inScope = scope ? [...scope.byDocument].filter(([, directory]) => national(directory.fields)).map(([doc]) => doc) : [];
        titles = scope ? await postgres.documentTitles?.(context.tenant, generation.id, inScope) ?? new Map()
          : new Map(allowedBundles.filter(b => national(b.document.fields)).map(b => [b.document.id, b.document.fields.title?.value]));
        for (const [documentId, title] of titles) {
          const name = actGenitive(title);
          if (name) names.set(name, names.has(name) ? null : documentId);
        }
        for (const [name, documentId] of [...names]) if (!documentId) names.delete(name);
      }
      // ADR-142: the municipal regulations a question can name are those of the scope, which holds the acts of the
      // turn's municipality only (a validity start and a region). Their titles come as the national acts' do.
      const regulations = [], municipal = fields => Boolean(fields.valid_from?.value) && Array.isArray(fields.regions?.value) && fields.regions.value.length > 0;
      const sameTitle = (one, other) => typeof one === 'string' && typeof other === 'string' && one.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('et') === other.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('et');
      if (asks) {
        const local = scope ? [...scope.byDocument].filter(([, directory]) => municipal(directory.fields)).map(([doc, directory]) => [doc, directory.fields.regions.value])
          : allowedBundles.filter(b => municipal(b.document.fields)).map(b => [b.document.id, b.document.fields.regions.value]);
        const localTitles = !local.length ? new Map() : scope ? await postgres.documentTitles?.(context.tenant, generation.id, local.map(([doc]) => doc)) ?? new Map()
          : new Map(allowedBundles.map(b => [b.document.id, b.document.fields.title?.value]));
        for (const [doc, regions] of local) if (typeof localTitles.get(doc) === 'string' && localTitles.get(doc).trim()) regulations.push({ act: doc, title: localTitles.get(doc), regions });
      }
      // ADR-135: a provision the question itself names ("Mida ütleb SHS § 133 lg 5?") is fetched by its place in the
      // act. The search found such a passage only by chance (2 of 4 tries on 10.10.2026: a passage's text often begins
      // in the middle of its section and holds neither the number nor the act's name), and the answer then says
      // honestly that it has no such text. The act is named as a person writes it: the title in the genitive or as it
      // stands, or Riigi Teataja's abbreviation ("SHS", "SHS-i"). These take the named acts' places before the
      // passages' own pointers do, because the question asks for them. A name two acts of the scope share names none.
      // ADR-142 (11.10.2026): a municipal regulation of the scope is named by its title and fetched the same way.
      if (asks && (titles.size || regulations.length)) {
        const asked = new Map(), written = new Map(), askedAudit = { candidates: 0, additions: 0, acts: [] };
        for (const [documentId, title] of titles) {
          if (typeof title !== 'string' || names.get(actGenitive(title)) !== documentId) continue;
          const short = ACT_ABBREVIATIONS.abbreviations[title];
          for (const key of [actGenitive(title), title, ...(short ? [short, `${short}-i`, `${short}i`] : [])]) {
            const lower = key.toLocaleLowerCase('et');
            asked.set(lower, asked.has(lower) && asked.get(lower) !== documentId ? null : documentId);
            // A title is read in small letters as it is; an abbreviation only as Riigi Teataja writes it.
            written.set(lower, short && key.startsWith(short) ? key : lower);
          }
        }
        for (const [key, documentId] of [...asked]) if (!documentId) { asked.delete(key); written.delete(key); }
        // ADR-142: a regulation's title, as it stands and in the genitive, is a name a number may follow without the
        // mark too ("sotsiaalhoolekandelise abi andmise korra 15 lg 3"). Which regulation a list names its own reader
        // says (regulationReferences): the title before the mark, and the municipality the words name.
        for (const { title } of regulations) for (const key of [regulationGenitive(title), title.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('et')]) if (key && !written.has(key)) written.set(key, key);
        // A person writes a raised digit when they mean one; a plain number is the section of that number.
        const exactNumbers = true, question = questionWithMarks(query.text, written), listed = new Map(regulations.map(item => [item.act, item.title]));
        const references = [...namedActReferences(question, asked), ...regulationReferences(question, regulations).map(reference => ({ ...reference, regulation: true }))].sort((a, b) => a.at - b.at);
        naming: for (const reference of references) {
          if (askedAudit.additions >= limit) break;
          await hydrate([reference.act]);
          const b = bundleByDoc.get(reference.act);
          // The loaded source's own title (and, for a regulation, its own region) must be what the unit rows said.
          if (!b || (reference.regulation ? !municipal(b.document.fields) || !sameTitle(b.document.fields.title?.value, listed.get(b.document.id))
            : names.get(actGenitive(b.document.fields.title?.value)) !== b.document.id)) continue;
          const chunks = [...b.chunks].sort((x, y) => x.ordinal - y.ordinal);
          if (!sectionsOf.has(b.document.id)) { try { sectionsOf.set(b.document.id, actSections(chunks)); } catch { sectionsOf.set(b.document.id, []); } }
          const key = resolveSection(reference.base, reference.superscript, sectionsOf.get(b.document.id), exactNumbers);
          if (!key) continue;
          const holding = reference.subsections.length ? reference.subsections.flatMap(subsection => provisionChunks(b, chunks, key, subsection, { exactNumbers }))
            : provisionChunks(b, chunks, key);
          for (const chunk of new Set(holding)) {
            if (askedAudit.additions >= limit) break naming;
            const unit = units.find(u => u.document_id === b.document.id && u.version_id === b.version.id && u.chunk_id === chunk.id);
            if (!unit) continue;
            askedAudit.candidates++;
            if (add(unit, { type: 'question_reference', section: key, named_act: b.document.id })) { askedAudit.additions++; askedAudit.acts.push(`${b.document.id}:${key}`); }
          }
        }
        result.measurements.question_references = askedAudit;
      }
      // ADR-145 (11.10.2026): the passage of any document, a guide, a study or a page as much as an act, names the law
      // as texts do: its title in the genitive (ADR-063), the same joined or split otherwise, the title as it stands,
      // or Riigi Teataja's abbreviation ("SHS § 17 lg 2", "(TLS § 88)"). Places and room are as they were; what is not
      // followed is counted with its reason (left_out): a range of sections, a number the act does not have or that
      // could be two of its sections, a text older than the act it would lead to (the act of that name was then
      // another one), and what the two places had no room for. The references written with the genitive, the one
      // form read until now, keep their turn before the others, each in the order of the passages: a turn is given
      // what it was given before, and the other forms what room that leaves.
      const followed = names.size ? followableNames(titles) : null, leftOut = {};
      const leave = reason => { leftOut[reason] = (leftOut[reason] || 0) + 1; };
      const read = (followed ? pointing : []).flatMap(entry => passageRelations(entry.source_text, followed).filter(reference => reference.act !== entry.document_id).map(reference => ({ entry, reference })));
      const genitive = ({ reference }) => reference.named === actGenitive(titles.get(reference.act));
      for (const { entry, reference } of [...read.filter(genitive), ...read.filter(item => !genitive(item))]) {
        if (audit.additions >= limit) { leave('over_limit'); continue; }
        if (reference.to) { leave('range'); continue; }
        await hydrate([reference.act]);
        const b = bundleByDoc.get(reference.act), chunks = [...b.chunks].sort((x, y) => x.ordinal - y.ordinal);
        if (names.get(actGenitive(b.document.fields.title?.value)) !== b.document.id) continue;
        const stale = dayRefusal(bundleByDoc.get(entry.document_id)?.document.fields, b.document.fields);
        if (stale) { leave(stale); continue; }
        if (!sectionsOf.has(b.document.id)) { try { sectionsOf.set(b.document.id, actSections(chunks)); } catch { sectionsOf.set(b.document.id, []); } }
        // How exactly the number is read depends on the text it stands in, the pointing passage's own document
        // (Codex review of #301): a PDF's or an older XML's "§ 131" may be § 13¹, whatever the other act's text keeps.
        const exactNumbers = keepsSuperscripts(bundleByDoc.get(entry.document_id)?.version);
        const { key, reason } = relationSection(reference, sectionsOf.get(b.document.id), exactNumbers);
        if (!key) { leave(reason); continue; }
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
      result.measurements.named_act_references = Object.keys(leftOut).length ? { ...audit, left_out: leftOut } : audit;
      timings.named_acts = performance.now() - namedStart;
    }
    // ADR-149 (12.10.2026): a selected passage of a text that is no legal act (a guide, a page, an article, a municipal
    // record) often says what a provision of a national law says and names no section. The page states the sum, and the
    // provision that sets it stays among the candidates behind the pages that repeat it (after corpus v88 the provision
    // of a control question stood at place 21, behind three new texts with the same sum). The provision that stands
    // nearest to such a passage, by the vectors the index holds (the passage's own stored vector is the query; nothing
    // is embedded), comes with it when the two stand very near, or near and the question's own search found the
    // provision too. It follows every addition above and takes a place only where the final limit leaves one, and room
    // only from the references' room: nothing a turn had is displaced.
    if (query.namedActs && scope && typeof qdrant?.vectors === 'function' && !degraded) {
      const companionStart = performance.now(), audit = { seeds: 0, near: 0, additions: 0, provisions: [] };
      const act = doc => Boolean(scope.byDocument.get(doc)?.fields.valid_from?.value);
      const national = [...scope.byDocument].filter(([, directory]) => directory.fields.valid_from?.value
        && !(Array.isArray(directory.fields.regions?.value) && directory.fields.regions.value.length)).map(([doc]) => doc);
      const speaking = pointing.filter(entry => !act(entry.document_id)).slice(0, COMPANION_PROVISIONS.seeds);
      // The vector store not answering leaves the turn what it had: this lane only adds. Any other refusal stops the search as elsewhere.
      const nearest = national.length && speaking.length ? await (async () => {
        const vectors = await qdrant.vectors(generation, speaking.map(entry => entry.unit_id));
        audit.seeds = speaking.filter(entry => vectors.has(entry.unit_id)).length;
        return Promise.all(speaking.map(async entry => (vectors.has(entry.unit_id)
          ? (await qdrant.query(generation, national, vectors.get(entry.unit_id), COMPANION_PROVISIONS.nearest)).map(hit => ({ entry, hit })) : [])));
      })().catch(error => { if (error?.code !== 'qdrant_request_failed') throw error; audit.unavailable = true; return null; }) : null;
      if (nearest) {
        const found = new Set([...ranked, ...reserveRanked].map(rank => rank.id));
        const near = nearest.flat().filter(({ hit }) => eligible.has(hit.id) && !seen.has(hit.id)
          && (hit.score >= COMPANION_PROVISIONS.near || hit.score >= COMPANION_PROVISIONS.nearAndFound && found.has(hit.id)))
          .sort((a, b) => b.hit.score - a.hit.score || (a.hit.id < b.hit.id ? -1 : 1));
        audit.near = new Set(near.map(({ hit }) => hit.id)).size;
        for (const { entry, hit } of near) {
          if (audit.additions >= COMPANION_PROVISIONS.additions) break;
          if (seen.has(hit.id)) continue;
          if (!unitMap.has(hit.id)) await hydrate([hit.document_id]);
          const unit = unitMap.get(hit.id);
          if (!unit) continue;
          if (add(unit, { type: 'companion_provision', seed_evidence_id: entry.evidence_id, score: Math.round(hit.score * 1000) / 1000,
            found_by_question: found.has(hit.id), named_act: hit.document_id })) {
            audit.additions++; audit.provisions.push({ act: hit.document_id, score: Math.round(hit.score * 1000) / 1000, found_by_question: found.has(hit.id) });
          }
        }
      }
      result.measurements.companion_provisions = audit;
      timings.companion_provisions = performance.now() - companionStart;
    }
    // ADR-154 (21.10.2026): a provision a later lane brought points on as a ranked passage does. In Sol's test of 20.10
    // (G33) SHS § 95 came as a companion provision and its "välja arvatud käesoleva seaduse § 72 lõikes 2 nimetatud
    // isikul" was not read, while the same exception came with § 88 and § 98, which were ranked. What the first reading
    // left of the reference additions and room is used; an own-act cross-reference still points no further.
    if (referenceAudit) {
      const brought = selected.filter(entry => !pointing.includes(entry) && laterLane(entry.selection.reason));
      if (brought.length) {
        const before = { candidates: referenceAudit.candidates, additions: referenceAudit.additions };
        followReferences(brought);
        if (referenceAudit.candidates > before.candidates) referenceAudit.later_lanes = { candidates: referenceAudit.candidates - before.candidates, additions: referenceAudit.additions - before.additions };
      }
    }
    // ADR-154: a selected passage that ends with a colon announces what follows ("Neist täiskasvanutele mõeldud teenused
    // on:") and says little without it. In Sol's test of 21.10 (E9) the search found the announcement of the municipality's
    // thirteen services and none of the services. The passages under the announcing passage's own heading come with it in
    // their order; when none is under it, the next passage alone (a list a chunk boundary cut). In the expansion room and
    // where the final limit leaves places: nothing a turn had is displaced.
    if (query.namedActs) {
      const audit = { announcing: 0, additions: 0 }, full = () => audit.additions >= LIST_CONTINUATION.additions;
      for (const entry of [...selected]) {
        if (full()) break;
        if (!/:\s*$/u.test(entry.source_text ?? '')) continue;
        const b = bundleByDoc.get(entry.document_id);
        if (!b) continue;
        const chunks = [...b.chunks].sort((x, y) => x.ordinal - y.ordinal), at = chunks.findIndex(chunk => chunk.id === entry.chunk_id);
        if (at < 0 || at === chunks.length - 1) continue;
        audit.announcing++;
        const own = headingPath(chunks[at]), under = [];
        for (const chunk of chunks.slice(at + 1)) { if (own && headingPath(chunk).startsWith(`${own} > `)) under.push(chunk); else break; }
        for (const chunk of under.length ? under : [chunks[at + 1]]) {
          if (full()) break;
          const unit = units.find(u => u.document_id === b.document.id && u.version_id === b.version.id && u.chunk_id === chunk.id);
          if (unit && add(unit, { type: 'list_continuation', seed_evidence_id: entry.evidence_id })) audit.additions++;
        }
      }
      if (audit.announcing) result.measurements.list_continuations = audit;
      // The items stand right after the passage that announces them, in their order (ADR-156): with two provisions
      // between them the answer read the announcement and seven services as unrelated passages (21.10, E9).
      if (audit.additions) {
        const items = selected.filter(entry => entry.selection.reason?.type === 'list_continuation');
        const ordered = selected.filter(entry => !items.includes(entry)).flatMap(entry => [entry, ...items.filter(item => item.selection.reason.seed_evidence_id === entry.evidence_id)]);
        selected.splice(0, selected.length, ...ordered);
      }
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
    // ADR-154: every addition that add() let into the expansion room counts here, the companion provision (ADR-149) too.
    const expanded = result.evidence.some(entry => ['structural_expansion', 'cross_reference', 'companion_provision', 'list_continuation'].includes(entry.selection.reason?.type));
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
      hybrid: ranked.filter(r => stillAllowed(r.id)), ...(reserve ? { reserve: reserveRanked.filter(r => stillAllowed(r.id)) } : {}),
      ...(change ? { change: changeRanked.filter(r => stillAllowed(r.id)) } : {}) };
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
