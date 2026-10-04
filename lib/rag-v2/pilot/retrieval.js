import fs from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { id, hash, stable } from '../contracts.js';
import { verifiedBundle } from '../search/snapshot.js';
import { modelProjection, resolveModelReference, resolveModelReferences } from '../search/model-context.js';
import { PostgresCatalog, processCatalog } from '../search/postgres.js';
import { QdrantIndex } from '../search/qdrant.js';
import { assertProfileGeneration, queryForProfile } from '../search/profiles.js';
import { retrieve } from '../search/retrieval.js';
import { reject } from './contracts.js';
import { locationFields } from '../source-locations.js';
import { StructuredRecordSource, RECORD_RETRIEVAL_VERSION } from '../search/structured-record-source.js';
import { resolveRecordScope, knowledgeRegionScope } from './record-scope.js';
import { checkedPlaces, placeScope, checkedTurnPlaces, personRegionScope, sourceRegionScope, regionTarget } from './person-places.js';
import { validateStateContext, validateStateRegion, REGION_STATE_VERSION } from './dialogue-state.js';
import { unifiedRetrievalEnabled, retrievalPlan } from './retrieval-plan.js';
import { unifiedDirectory, publicationFilters, mergeUnifiedPackets, checkUnifiedDirectory, municipalScope, NATIONAL_LAW_RESERVE } from '../search/unified.js';
import { estonianDate, legalReference, legalValidityScope } from '../search/legal-validity.js';

const WARMING = Symbol.for('sotsiaalai.rag-v2.warming');
export function pilotContext(config, userId) { return { subject: userId, tenant: config.tenant, usage: 'development_only' }; }

// Once per process and generation, the knowledge sources are verified in the background, national
// legal texts first: the national-law reserve reads them on most questions (ADR-032, ADR-033). `then`
// runs after them (the start warm-up reads the vectors again there); its failure only logs.
export function warmKnowledgeSources(postgres, tenant, generationId, directories, { then = null } = {}) {
  const warming = globalThis[WARMING] ||= new Set();
  if (warming.has(generationId)) return false;
  warming.add(generationId);
  const groups = unifiedDirectory(directories), national = groups.nationalLaw.map(row => row.document_id), first = new Set(national);
  const knowledge = [...national, ...groups.knowledge.map(row => row.document_id).filter(doc => !first.has(doc))];
  const started = Date.now();
  postgres.warm(tenant, generationId, knowledge)
    .then(() => console.info('[rag-v2] warmed', knowledge.length, 'sources in', Math.round((Date.now() - started) / 1000), 's'))
    .then(() => then?.())
    .catch(error => { warming.delete(generationId); console.error('[rag-v2] warm-up stopped', error?.code || error?.name); });
  return true;
}

// The generation's vectors, once after the sources: a deploy's build empties Qdrant's page cache and the first
// question then waited 8.4 s per vector query (28.09.2026, ADR-039). One exact query over the plan's active
// versions with a stored vector; no embedding call. Its own state per process and generation (running, done,
// failed): a failure (Qdrant not up yet, a timeout) is tried again by the next start or turn, never twice at once.
const VECTOR_WARMING = Symbol.for('sotsiaalai.rag-v2.vector-warming');
export const vectorWarmState = generationId => (globalThis[VECTOR_WARMING] ||= new Map()).get(generationId) ?? null;
// again: a finished warm-up is repeated (after the sources, whose reading may have pushed vectors out again).
export function warmVectors(qdrant, generation, documents, { again = false } = {}) {
  const states = globalThis[VECTOR_WARMING] ||= new Map();
  if (states.get(generation.id) === 'running' || (states.get(generation.id) === 'done' && !again)) return null;
  states.set(generation.id, 'running');
  const started = Date.now();
  return qdrant.warm(generation, documents).then(queries => {
    states.set(generation.id, 'done');
    if (queries) console.info('[rag-v2] warmed vectors of', documents.length, 'sources in', Math.round((Date.now() - started) / 1000), 's');
  }, error => {
    states.set(generation.id, 'failed');
    console.error('[rag-v2] vector warm-up stopped', error?.code || error?.name);
  });
}
// The vectors at once, beside the sources, and once more after them (ADR-069: a turn of the first minutes then does
// not wait for a cold Qdrant; before, the vectors came only after the sources). When the sources are already warm,
// only a failed vector warm-up is started again. Both run in the background.
function warmSourcesAndVectors(postgres, tenant, generation, directories, vectors) {
  const started = warmKnowledgeSources(postgres, tenant, generation.id, directories, { then: vectors ? () => vectors({ again: true }) : null });
  if (vectors && (started || vectorWarmState(generation.id) === 'failed')) vectors();
  return started;
}
const qdrantFrom = (env, Qdrant = QdrantIndex) => env.RAG_V2_QDRANT_URL && env.RAG_V2_QDRANT_KEY ? new Qdrant(env.RAG_V2_QDRANT_URL, env.RAG_V2_QDRANT_KEY) : null;

// At server start (instrumentation.js), so the first question after a deploy or a plan rebuild does
// not wait for source verification or compete with it (27.09.2026: 43 s, 33 s of it search). It reads
// the plan's tenant, index generation and documents only; it calls no model and grants no access.
// Anything unexpected leaves the warm-up to the first turn's preflight.
export async function warmPilotAtStart({ env = process.env, Qdrant = QdrantIndex } = {}) {
  if (env.M4_PILOT_ENABLED !== '1' || !env.M4_PILOT_CONFIG || !env.RAG_V2_POSTGRES_URL) return false;
  const plan = JSON.parse(await fs.readFile(env.M4_PILOT_CONFIG, 'utf8'));
  if (plan.mode !== 'real' || !unifiedRetrievalEnabled(plan) || typeof plan.tenant !== 'string' || !plan.documents || typeof plan.documents !== 'object') return false;
  const postgres = processCatalog(env.RAG_V2_POSTGRES_URL), generation = await postgres.active(plan.tenant);
  if (generation.id !== plan.generationId) return false;
  // ADR-069: the marks earlier processes left for the same row versions. Without them (no table yet, a failed read)
  // this process verifies before use, as before.
  try { console.info('[rag-v2] inherited', await postgres.inheritVerified?.() ?? 0, 'verified marks'); }
  catch (error) { console.error('[rag-v2] verified marks not read', error?.code || error?.name); }
  const documents = Object.keys(plan.documents).filter(doc => generation.snapshot.documents[doc]?.version_id === plan.documents[doc]);
  const qdrant = qdrantFrom(env, Qdrant), vectors = qdrant ? options => warmVectors(qdrant, generation, documents, options) : null;
  return warmSourcesAndVectors(postgres, plan.tenant, generation, await postgres.retrievalDirectory(plan.tenant, generation, documents), vectors);
}
// The newest user turns that fit the query limit order the catalogue; older turns stay in the dialogue.
function relevanceText(turns = []) {
  let text = '';
  for (const turn of [...turns].reverse()) {
    const next = text ? `${turn.text}\n\n${text}` : turn.text;
    if (next.length > 8000) break;
    text = next;
  }
  return text.trim() ? text : null;
}
// Where a chat turn's search spends its time (audit only, never in the model context): milliseconds since the search
// started at each step, and each lane's own timings. Lanes run side by side, so their times are not summed.
export const SEARCH_TIMINGS_VERSION = 'rag-v2/search-timings-1';
const roundedTimings = timings => Object.fromEntries(Object.entries(timings || {}).filter(([, ms]) => Number.isFinite(ms)).map(([name, ms]) => [name, Math.round(ms)]));

export function runtimeAdapters(readConfig, userId, { Catalog = PostgresCatalog, loadRegions, authorizeContact, analyzer } = {}) {
  // The production catalog is shared per process, so verified sources stay verified between turns;
  // an injected catalog class (tests) keeps its own per-call lifecycle.
  // Each use by a chat turn is marked (foreground): the start warm-up waits for a quiet moment (ADR-069).
  const openCatalog = () => {
    const catalog = Catalog === PostgresCatalog ? processCatalog(process.env.RAG_V2_POSTGRES_URL) : new Catalog(process.env.RAG_V2_POSTGRES_URL);
    catalog.foreground?.();
    return catalog;
  };
  const release = async postgres => { postgres.foreground?.(); if (Catalog !== PostgresCatalog) await postgres.close(); };
  const policy = { async allowed() { const config = await readConfig(); return { documents: Object.keys(config.documents), revision: config.configHash }; } };
  const checkContact = config => async bundle => {
    if (bundle.document.fields.structured_record?.value.kind === 'contact'
      && (!authorizeContact || await authorizeContact({ context: pilotContext(config, userId), bundle,
        record: bundle.document.fields.structured_record.value }) !== true)) reject('record_contact_access_changed', 403);
  };
  return {
    async dialogueStateContext() { return validateStateContext({ regions: loadRegions ? await loadRegions() : [] }); },
    validateDialogueStateRegion: (value, context, userTurns) => validateStateRegion(value, context, analyzer, userTurns),
    async canonicalPacket(config, packet) {
      if (config.mode === 'test') {
        for (const ref of Object.keys(packet.reference_map)) await this.canonical(config, packet, ref);
        return;
      }
      if (Object.values(packet.reference_map).some(ref => config.documents[ref.document_id] !== ref.document_version_id)) reject('reference_access_denied', 403);
      const postgres = openCatalog();
      try {
        if (unifiedRetrievalEnabled(config) || packet.retrieval_audit) {
          if (!unifiedRetrievalEnabled(config)) reject('invalid_unified_retrieval_plan');
          const generation = await postgres.active(config.tenant), access = await policy.allowed(pilotContext(config, userId));
          if (generation.id !== packet.generation_id || generation.id !== config.generationId) reject('active_index_mismatch');
          const allowed = new Set(access.documents);
          checkUnifiedDirectory(packet, await postgres.retrievalDirectory(config.tenant, generation,
            Object.keys(generation.snapshot.documents).filter(doc => allowed.has(doc))));
        }
        return await resolveModelReferences({ packet, context: pilotContext(config, userId), policy,
          sourceResolver: refs => postgres.canonicalReferences(refs, { checkBundle: checkContact(config) }) });
      }
      finally { await release(postgres); }
    },
    async records(config, query) {
      return unifiedRetrievalEnabled(config) ? null : this.recordCatalogue(config, query);
    },
    // The municipality the conversation names (a source scope, not a verified residence); one resolution per turn
    // bounds both the catalogue and the knowledge lane's municipal texts. query.person and planQueries: whose need the
    // search plan says the current message is about, and its queries (ADR-049).
    async recordScope(config, query, regions = null, planQueries = []) {
      if (config.recordCatalogue !== RECORD_RETRIEVAL_VERSION || typeof loadRegions !== 'function') reject('record_catalogue_not_configured');
      const directory = regions || await loadRegions();
      // State v4 (ADR-051): the checked places decide for the person the plan names; otherwise the resolver as before.
      // State v5 (Codex J1-J3): the person's region state from resolvePersonRegions, the reading the saved state keeps.
      if (Array.isArray(query.places)) {
        const scopeOf = config.dialogueStateVersion === REGION_STATE_VERSION ? personRegionScope : placeScope;
        const decided = await scopeOf({ previousValue: query.previousState?.value, places: query.places, person: query.person,
          turn: query.scopeTurns.at(-1), turnNumber: query.scopeTurns.length, directory, analyzer });
        if (decided) return decided;
      }
      return resolveRecordScope(query.scopeTurns, directory, analyzer, query.previousState, { person: query.person ?? null, planQueries });
    },
    // The municipality of the turn for both lanes, the knowledge lane's municipal texts and the catalogue (Codex J1-J3):
    // the person's region state first; the plan's queries only where the conversation decided nobody's place.
    // ADR-074 (state v5): a municipality the current message asks about, in another mention the plan's queries are about,
    // is the turn's source scope instead; scope stays the person's own, and the saved state does not read this.
    async searchScope(config, query, regions, planQueries = []) {
      const scope = await this.recordScope(config, query, regions, planQueries);
      const knowledgeRegion = config.dialogueStateVersion === REGION_STATE_VERSION && Array.isArray(query.places)
        ? await sourceRegionScope(scope, { places: query.places, planQueries, turnNumber: query.scopeTurns.length, directory: regions || await loadRegions(), analyzer })
        : await knowledgeRegionScope(scope, planQueries, regions, analyzer);
      return { scope, knowledgeRegion };
    },
    // The search plan's place attributions, checked against the messages the saved state has not read (ADR-051).
    async checkedPlaces(config, query, places) {
      if (config.recordCatalogue !== RECORD_RETRIEVAL_VERSION || typeof loadRegions !== 'function') return [];
      const read = query.previousState?.sourceTurnIds.length || 0;
      // State v5: every message, the read ones marked, and whose place an unattributed municipality is (Codex V1).
      if (config.dialogueStateVersion === REGION_STATE_VERSION) {
        return checkedTurnPlaces(places, query.scopeTurns.map((turn, index) => ({ turn: index + 1, text: turn.text, read: index < read })), await loadRegions(),
          analyzer, { target: regionTarget(query.person, query.previousState?.value, query.scopeTurns.at(-1)?.text), previousPeople: query.previousState?.value?.people || [] });
      }
      const unread = query.scopeTurns.slice(read).map((turn, index) => ({ turn: read + index + 1, text: turn.text }));
      return checkedPlaces(places, unread, await loadRegions(), analyzer);
    },
    async recordCatalogue(config, query, vector = null, resolved = null) {
      if (!config.recordCatalogue) return null;
      const scope = resolved || await this.recordScope(config, query);
      const postgres = openCatalog();
      try {
        const packet = scope.region
          ? await new StructuredRecordSource({ postgres, policy, authorizeContact,
            ...(vector ? { qdrant: new QdrantIndex(process.env.RAG_V2_QDRANT_URL, process.env.RAG_V2_QDRANT_KEY) } : {}) }).retrieve({ context: pilotContext(config, userId),
            region: scope.region, generationId: config.generationId, question: relevanceText(query.scopeTurns), queryVector: vector,
            recordIds: [...new Set((query.recordFocus || []).filter(record => record.region === scope.region).map(record => record.id))] })
          : { tenant: config.tenant, query_id: id('query', config.tenant, query.hash, Date.now()), generation_id: config.generationId,
            evidence: [], state: 'ok', record_context: { version: RECORD_RETRIEVAL_VERSION, entries: [], relations: [], catalogue_count: 0,
              catalogue_scope: 'not_selected', completeness: 'not_assessed' } };
        packet.record_context.scope = scope;
        const projection = modelProjection(packet.evidence, packet);
        return { ...packet, model_context: projection.context, reference_map: projection.references, measurements: projection.measurements };
      } finally { await release(postgres); }
    },
    async preflight(config) {
      if (config.mode === 'test') return;
      const postgres = openCatalog();
      try {
        const generation = await postgres.active(config.tenant);
        assertProfileGeneration(config.profile, generation);
        if (generation.id !== config.generationId || stable(generation.config.embedding) !== stable(config.embedding)) reject('active_index_mismatch');
        for (const [doc, version] of Object.entries(config.documents)) if (generation.snapshot.documents[doc]?.version_id !== version) reject('active_source_version_mismatch');
        // Verify small, version-bound directories here. Retrieval verifies the
        // selected bundles in full before any evidence reaches the answer model.
        const directories = await postgres.retrievalDirectory(config.tenant, generation, Object.keys(config.documents));
        // Normally already started at server start; this covers a failed or skipped start warm-up (sources and vectors).
        if (unifiedRetrievalEnabled(config) && Catalog === PostgresCatalog) {
          const qdrant = qdrantFrom(process.env), documents = Object.keys(config.documents);
          warmSourcesAndVectors(postgres, config.tenant, generation, directories, qdrant ? options => warmVectors(qdrant, generation, documents, options) : null);
        }
        await postgres.checkLexicalAnalyzer(generation.config.lexical);
      } finally { await release(postgres); }
    },
    async search(config, query, vector, assist = null) {
      if (unifiedRetrievalEnabled(config)) return this.unifiedSearch(config, query, vector, assist);
      if (config.mode === 'test') {
        const bundle = verifiedBundle(JSON.parse(await fs.readFile(config.testBundlePath, 'utf8')), config.tenant);
        if (config.documents[bundle.document.id] !== bundle.version.id) reject('test_source_version_mismatch');
        // Fixed transport fixture, explicitly NOT vector retrieval or Luna quality evidence.
        const chunk = bundle.chunks.find(c => c.source_text.length > 150 && c.pdf_pages[0] > 1) || bundle.chunks[0];
        const packet = { tenant: config.tenant, query_id: id('query', config.tenant, query.hash, Date.now()), generation_id: 'test-fixture-1', state: 'ok',
          evidence: [{ evidence_id: id('evidence', bundle.version.id, chunk.id), document_id: bundle.document.id, document_version_id: bundle.version.id,
            unit_id: chunk.id, chunk_id: chunk.id, span_ids: chunk.span_ids, pdf_pages: chunk.pdf_pages, ...locationFields(chunk), source_text: chunk.source_text,
            bibliography: { title: bundle.document.fields.title.value, authors: bundle.document.fields.authors.value, publication_date: bundle.document.fields.publication_date.value },
            limitations: [{ code: 'test_transport_fixed_selection' }] }] };
        const projection = modelProjection(packet.evidence, packet);
        return { ...packet, model_context: projection.context, reference_map: projection.references, measurements: projection.measurements };
      }
      const postgres = openCatalog();
      try {
        const generation = await postgres.active(config.tenant);
        assertProfileGeneration(config.profile, generation);
        if (generation.id !== config.generationId || stable(generation.config.embedding) !== stable(config.embedding)) reject('active_index_mismatch');
        for (const [doc, version] of Object.entries(config.documents)) if (generation.snapshot.documents[doc]?.version_id !== version) reject('active_source_version_mismatch');
        const packet = await retrieve({ postgres, qdrant: new QdrantIndex(process.env.RAG_V2_QDRANT_URL, process.env.RAG_V2_QDRANT_KEY),
          embedding: { config: config.embedding, source: 'persisted_vectors', embed: async () => vector }, policy,
          context: pilotContext(config, userId), query: queryForProfile(config.profile, { text: query.text, language: query.language,
            filters: query.strictFilters || {}, generation_id: config.generationId }), allowLexicalFallback: false });
        if (packet.state === 'error' || packet.state === 'degraded') reject(packet.error || 'retrieval_failed', 502);
        return packet;
      } finally { await release(postgres); }
    },
    // assist (search-assist.js): the knowledge lane also searches the planned queries (their vectors
    // are the turn's own, bought with the question) and lets the answer model select its evidence.
    // vector and assist.vectors may be promises (the turn's embedding request runs while the search starts); every use
    // awaits them, so the scope, directory and lexical work do not wait for the request.
    async unifiedSearch(config, query, vector, assist = null) {
      if (config.mode === 'test') reject('unified_retrieval_requires_local_index');
      const postgres = openCatalog(), context = pilotContext(config, userId);
      const started = performance.now(), sinceStart = {}, laneTimings = {};
      const mark = step => { sinceStart[step] = Math.round(performance.now() - started); };
      try {
        const generation = await postgres.active(config.tenant);
        assertProfileGeneration(config.profile, generation);
        if (generation.id !== config.generationId || stable(generation.config.embedding) !== stable(config.embedding)) reject('active_index_mismatch');
        for (const [doc, version] of Object.entries(config.documents)) if (generation.snapshot.documents[doc]?.version_id !== version) reject('active_source_version_mismatch');
        const access = await policy.allowed(context), allowedDocuments = new Set(access.documents);
        const directories = await postgres.retrievalDirectory(config.tenant, generation,
          Object.keys(generation.snapshot.documents).filter(doc => allowedDocuments.has(doc)));
        mark('directory');
        const groups = unifiedDirectory(directories), plan = retrievalPlan(query), lanes = [];
        // The knowledge lane keeps legal texts in a version in force on the reference date (today in Estonia, or a
        // period the user asked about) and a municipality's own texts only for the municipality the conversation names.
        const regions = config.recordCatalogue === RECORD_RETRIEVAL_VERSION && typeof loadRegions === 'function' ? await loadRegions() : null;
        const { knowledgeRegion } = await this.searchScope(config, query, regions, assist?.variants || []);
        const reference = legalReference(estonianDate(), plan.legalPeriods), legal = legalValidityScope(groups.knowledge, reference);
        const local = municipalScope(legal.eligible, knowledgeRegion), kept = new Set(local.eligible.map(row => row.document_id));
        const national = new Set(groups.nationalLaw.map(row => row.document_id));
        const excludedNational = legal.excluded.filter(row => national.has(row.document_id));
        const titles = new Map(excludedNational.length ? (await postgres.bundles(config.tenant, generation.id, excludedNational.map(row => row.document_id)))
          .map(bundle => [bundle.document.id, bundle.document.fields.title.value]) : []);
        const knowledgeScope = { knowledge: kept, report: { legal_validity: { ...reference,
          excluded: excludedNational.map(({ document_id: doc, ...row }) => ({ title: titles.get(doc) ?? null, ...row })),
          excluded_municipal_documents: legal.excluded.length - excludedNational.length }, municipality: local.report } };
        mark('scope');
        const searchLane = async (key, kind, documents, period = null, laneAssist = null) => {
          const allowed = new Set(documents.map(row => row.document_id));
          const lanePolicy = { async allowed(ctx) { const current = await policy.allowed(ctx);
            return { ...current, documents: current.documents.filter(doc => allowed.has(doc)) }; } };
          const selected = queryForProfile(config.profile, { text: query.text, language: query.language,
            generation_id: config.generationId, filters: period ? publicationFilters(period) : {} });
          // A period gets its own quota, so a prolific first period cannot displace
          // all evidence from the second. General context still searches without dates.
          if (period) Object.assign(selected, { finalLimit: 4, limits: { ...selected.limits, topK: 2, perDocument: 1, contextTokens: 3000 } });
          if (laneAssist?.variants.length) selected.variants = laneAssist.variants;
          // The reranker also reads the national legal texts' best candidates (ADR-032).
          const reserve = groups.nationalLaw.filter(row => kept.has(row.document_id));
          if (laneAssist?.rerank && kind === 'knowledge' && reserve.length) {
            selected.poolReserve = { documents: reserve.map(row => row.document_id), ...NATIONAL_LAW_RESERVE };
          }
          const embed = async text => (text === query.text ? await vector : (await laneAssist?.vectors)?.get(text));
          const laneStarted = performance.now();
          const packet = await retrieve({ postgres,
            qdrant: new QdrantIndex(process.env.RAG_V2_QDRANT_URL, process.env.RAG_V2_QDRANT_KEY),
            embedding: { config: config.embedding, source: 'persisted_vectors', embed },
            policy: lanePolicy, context, query: selected, allowLexicalFallback: false, hooks: laneAssist?.rerank ? { rerank: laneAssist.rerank } : {} });
          laneTimings[key] = { lane: Math.round(performance.now() - laneStarted), ...roundedTimings(packet.measurements?.timings_ms) };
          if (['error', 'degraded'].includes(packet.state)) reject(packet.error || 'retrieval_failed', 502);
          lanes.push({ key, kind, packet, ...(period ? { period } : {}) });
        };
        const recordLane = async () => {
          const laneStarted = performance.now();
          // One municipality for both lanes (Codex review 29.09, F4): a place only the search plan read (another script,
          // "в Нарва-Йыэсуу") selects the catalogue too, not only the knowledge lane's municipal texts.
          try { return await this.recordCatalogue(config, query, await vector, knowledgeRegion); } finally { laneTimings.records = { lane: Math.round(performance.now() - laneStarted) }; }
        };
        // The knowledge lane and the region's catalogue run side by side; lane order stays fixed.
        // The turn's query vector is already paid for; it also ranks the region's services (ADR-026).
        // A lone greeting (greeting.js) searches nothing: its knowledge lane is empty and the catalogue needs no vector.
        const greeting = assist?.greeting === true;
        const noSearch = () => lanes.push({ key: 'knowledge', kind: 'knowledge',
          packet: { tenant: config.tenant, query_id: id('query', config.tenant, query.hash, Date.now()), generation_id: generation.id, state: 'empty', evidence: [] } });
        const [, records] = await Promise.all([greeting ? noSearch() : searchLane('knowledge', 'knowledge', local.eligible, null, assist), recordLane()]);
        mark('knowledge_and_records');
        lanes.push({ key: 'records', kind: 'local_records', packet: records });
        for (const [index, period] of greeting ? [] : plan.publicationCandidates.entries()) await searchLane(`period_${index + 1}`, 'publication_period', groups.journals, period);
        if (plan.publicationCandidates.length) mark('periods');
        const current = await policy.allowed(context), currentDocuments = new Set(current.documents);
        if (current.revision !== access.revision || directories.some(row => !currentDocuments.has(row.document_id))) reject('access_changed_during_retrieval');
        if ((await postgres.active(config.tenant)).id !== generation.id) reject('search_generation_changed');
        const merged = mergeUnifiedPackets({ tenant: config.tenant, generationId: generation.id, directories, plan, lanes, scope: knowledgeScope });
        mark('merged');
        return { ...merged, search_timings: { version: SEARCH_TIMINGS_VERSION, since_start_ms: sinceStart, lanes: laneTimings } };
      } finally { await release(postgres); }
    },
    // The original web address of a verified reference's document (Riigi Teataja, the municipality's
    // service page, the agency's guide): the source view links it, so a reader need not search for it
    // (acceptance report 27.09.2026). Declared https addresses only; the model never supplies them.
    async sourceLinks(config, reference) {
      if (config.documents[reference.document_id] !== reference.document_version_id) reject('reference_access_denied', 403);
      const bundle = config.mode === 'test' ? verifiedBundle(JSON.parse(await fs.readFile(config.testBundlePath, 'utf8')), config.tenant)
        : await (async () => { const postgres = openCatalog();
          try { return (await postgres.bundles(config.tenant, reference.generation_id, [reference.document_id]))[0]; } finally { await release(postgres); } })();
      if (bundle?.document.id !== reference.document_id || bundle.version.id !== reference.document_version_id) return [];
      const urls = bundle.document.fields.source_urls?.value;
      return (Array.isArray(urls) ? urls : []).filter(url => typeof url === 'string' && url.length <= 2000 && /^https:\/\/[^\s"<>]+$/u.test(url)).slice(0, 3);
    },
    async canonical(config, packet, ref) {
      const expected = packet.reference_map[ref];
      if (!expected || config.documents[expected.document_id] !== expected.document_version_id) reject('reference_access_denied', 403);
      if (config.mode === 'test') {
        const bundle = verifiedBundle(JSON.parse(await fs.readFile(config.testBundlePath, 'utf8')), config.tenant);
        const chunk = bundle.chunks.find(c => c.id === expected.chunk_id);
        if (bundle.document.id !== expected.document_id || bundle.version.id !== expected.document_version_id || !chunk
          || hash(chunk.source_text) !== expected.source_text_sha256 || stable(chunk.pdf_pages) !== stable(expected.pdf_pages)
          || stable(chunk.span_ids) !== stable(expected.span_ids) || stable(chunk.source_locations) !== stable(expected.source_locations)) reject('canonical_reference_mismatch');
        return expected;
      }
      const postgres = openCatalog();
      try { return await resolveModelReference({ packet, reference: ref, context: pilotContext(config, userId), policy,
        queryId: packet.query_id, sourceResolver: expectedRef => postgres.canonicalReference(expectedRef, { checkBundle: checkContact(config) }) }); }
      finally { await release(postgres); }
    },
  };
}
