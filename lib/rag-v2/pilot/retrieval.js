import fs from 'node:fs/promises';
import { id, hash, stable } from '../contracts.js';
import { verifiedBundle } from '../search/snapshot.js';
import { modelProjection, resolveModelReference, resolveModelReferences } from '../search/model-context.js';
import { PostgresCatalog } from '../search/postgres.js';
import { QdrantIndex } from '../search/qdrant.js';
import { assertProfileGeneration, queryForProfile } from '../search/profiles.js';
import { retrieve } from '../search/retrieval.js';
import { reject } from './contracts.js';
import { locationFields } from '../source-locations.js';
import { StructuredRecordSource, RECORD_RETRIEVAL_VERSION } from '../search/structured-record-source.js';
import { resolveRecordScope } from './record-scope.js';
import { validateStateContext, validateStateRegion } from './dialogue-state.js';

export function pilotContext(config, userId) { return { subject: userId, tenant: config.tenant, usage: 'development_only' }; }
export function runtimeAdapters(readConfig, userId, { Catalog = PostgresCatalog, loadRegions, authorizeContact, analyzer } = {}) {
  const policy = { async allowed() { const config = await readConfig(); return { documents: Object.keys(config.documents), revision: config.configHash }; } };
  const checkContact = config => async bundle => {
    if (bundle.document.fields.structured_record?.value.kind === 'contact'
      && (!authorizeContact || await authorizeContact({ context: pilotContext(config, userId), bundle,
        record: bundle.document.fields.structured_record.value }) !== true)) reject('record_contact_access_changed', 403);
  };
  return {
    async dialogueStateContext() { return validateStateContext({ regions: loadRegions ? await loadRegions() : [] }); },
    validateDialogueStateRegion: (value, context) => validateStateRegion(value, context, analyzer),
    async canonicalPacket(config, packet) {
      if (config.mode === 'test') {
        for (const ref of Object.keys(packet.reference_map)) await this.canonical(config, packet, ref);
        return;
      }
      if (Object.values(packet.reference_map).some(ref => config.documents[ref.document_id] !== ref.document_version_id)) reject('reference_access_denied', 403);
      const postgres = new Catalog(process.env.RAG_V2_POSTGRES_URL);
      try { return await resolveModelReferences({ packet, context: pilotContext(config, userId), policy,
        sourceResolver: refs => postgres.canonicalReferences(refs, { checkBundle: checkContact(config) }) }); }
      finally { await postgres.close(); }
    },
    async records(config, query) {
      if (!config.recordCatalogue) return null;
      if (config.recordCatalogue !== RECORD_RETRIEVAL_VERSION || typeof loadRegions !== 'function') reject('record_catalogue_not_configured');
      const scope = await resolveRecordScope(query.scopeTurns, await loadRegions(), analyzer, query.previousState);
      const postgres = new Catalog(process.env.RAG_V2_POSTGRES_URL);
      try {
        const packet = scope.region
          ? await new StructuredRecordSource({ postgres, policy, authorizeContact }).retrieve({ context: pilotContext(config, userId),
            region: scope.region, generationId: config.generationId,
            recordIds: [...new Set((query.recordFocus || []).filter(record => record.region === scope.region).map(record => record.id))] })
          : { tenant: config.tenant, query_id: id('query', config.tenant, query.hash, Date.now()), generation_id: config.generationId,
            evidence: [], state: 'ok', record_context: { version: RECORD_RETRIEVAL_VERSION, entries: [], relations: [], catalogue_count: 0,
              catalogue_scope: 'not_selected', completeness: 'not_assessed' } };
        packet.record_context.scope = scope;
        const projection = modelProjection(packet.evidence, packet);
        return { ...packet, model_context: projection.context, reference_map: projection.references, measurements: projection.measurements };
      } finally { await postgres.close(); }
    },
    async preflight(config) {
      if (config.mode === 'test') return;
      const postgres = new Catalog(process.env.RAG_V2_POSTGRES_URL);
      try {
        const generation = await postgres.active(config.tenant);
        assertProfileGeneration(config.profile, generation);
        if (generation.id !== config.generationId || stable(generation.config.embedding) !== stable(config.embedding)) reject('active_index_mismatch');
        for (const [doc, version] of Object.entries(config.documents)) if (generation.snapshot.documents[doc]?.version_id !== version) reject('active_source_version_mismatch');
        // Verify small, version-bound directories here. Retrieval verifies the
        // selected bundles in full before any evidence reaches the answer model.
        await postgres.retrievalDirectory(config.tenant, generation, Object.keys(config.documents));
        await postgres.checkLexicalAnalyzer(generation.config.lexical);
      } finally { await postgres.close(); }
    },
    async search(config, query, vector) {
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
      const postgres = new Catalog(process.env.RAG_V2_POSTGRES_URL);
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
      } finally { await postgres.close(); }
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
      const postgres = new Catalog(process.env.RAG_V2_POSTGRES_URL);
      try { return await resolveModelReference({ packet, reference: ref, context: pilotContext(config, userId), policy,
        queryId: packet.query_id, sourceResolver: expectedRef => postgres.canonicalReference(expectedRef, { checkBundle: checkContact(config) }) }); }
      finally { await postgres.close(); }
    },
  };
}
