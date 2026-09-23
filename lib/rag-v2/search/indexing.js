import { DEFAULT_CONFIG, fail, id, stable } from '../contracts.js';
import { assertSnapshot } from './snapshot.js';
import { embeddingConfig, indexUnit, cacheKey, validateVector } from './embedding.js';
import { collectionName } from './qdrant.js';
import { LEGACY_LEXICAL, LEXICAL_CONFIGS } from './morphology.js';
import { DISCOVERY_SCHEMA, DISCOVERY_SCHEMAS, LEGACY_DISCOVERY_SCHEMA } from './discovery.js';

export function searchConfig(embedding, lexical = LEGACY_LEXICAL, directory = DISCOVERY_SCHEMA) {
  if (!LEXICAL_CONFIGS.includes(lexical)) fail('unknown_lexical_config');
  if (!DISCOVERY_SCHEMAS.includes(directory)) fail('unsupported_retrieval_directory');
  const config = { embedding: embeddingConfig(embedding), lexical, ranking: 'rrf-v1', rrf_constant: 60,
    ...(directory !== LEGACY_DISCOVERY_SCHEMA ? { directory } : {}) };
  return { ...config, id: id('search_config', config) };
}
export function verifySearchConfig(config) {
  if (stable(searchConfig(config.embedding, config.lexical, config.directory || LEGACY_DISCOVERY_SCHEMA)) !== stable(config)) fail('search_config_mismatch');
}
/** Directory metadata changes do not change the vector space. Import an exact
 * legacy cache row into the new immutable namespace, preserving its validation. */
export async function cachedIndexVector({ postgres, tenant, rights, config, unit, embedding, readOnly = false }) {
  const baseKey = cacheKey(tenant, rights, config.embedding, unit.input_text);
  const previousKey = config.lexical === LEGACY_LEXICAL ? baseKey : id('lexical_embedding_cache', baseKey, config.lexical);
  const key = config.directory ? id('directory_embedding_cache', previousKey, config.directory) : previousKey;
  let vector = await postgres.cacheGet(tenant, key, config.id, unit.input_hash), imported = false;
  if (!vector && config.directory && !readOnly) {
    vector = await postgres.cacheGet(tenant, previousKey, searchConfig(config.embedding, config.lexical, LEGACY_DISCOVERY_SCHEMA).id, unit.input_hash);
    imported = Boolean(vector);
  }
  if (vector) {
    validateVector(vector, config.embedding);
    if (config.embedding.embedding_mode === 'real' && stable(vector) !== stable(await embedding.embed(unit.input_text))) fail('embedding_cache_integrity_failed');
    if (imported) {
      await postgres.cachePut(tenant, key, config.id, unit.input_hash, vector);
      if (stable(await postgres.cacheGet(tenant, key, config.id, unit.input_hash)) !== stable(vector)) fail('embedding_cache_integrity_failed');
    }
  }
  return { key, vector };
}

export async function indexSnapshot({ snapshot, postgres, qdrant, embedding, lexical = LEGACY_LEXICAL, directory = DISCOVERY_SCHEMA, hooks = {} }) {
  assertSnapshot(snapshot);
  const config = searchConfig(embedding.config, lexical, directory);
  if (config.embedding.embedding_mode === 'real' && embedding.source !== 'persisted_vectors') fail('persisted_real_vectors_required');
  const units = snapshot.bundles.flatMap(b => b.chunks.map(c => indexUnit(c, b, config.embedding)));
  if (units.length > 5000) fail('local_index_limit');
  for (const bundle of snapshot.bundles) {
    const expanded = units.filter(unit => unit.document_id === bundle.document.id).reduce((total, unit) => total
      + unit.input_text.length + unit.title.length + unit.authors.length + unit.body.length + unit.search_aids.length, 0);
    if (expanded > (bundle.version.processing_config.maxExpandedChars ?? DEFAULT_CONFIG.maxExpandedChars)) fail('expanded_index_too_large');
  }
  const source = { source_generation: snapshot.source_generation, documents: snapshot.documents, snapshot_hash: snapshot.snapshot_hash };
  const generationId = id('search_generation', snapshot.tenant, source, config);
  const generation = await postgres.beginGeneration(snapshot.tenant, { id: generationId, snapshot: source, config,
    collection: collectionName(snapshot.tenant, generationId, config.embedding.embedding_mode), expected_count: units.length });
  await postgres.importSnapshot(snapshot, generation.id, units);
  if (hooks.afterPostgres) await hooks.afterPostgres(generation);
  const vectors = []; let hits = 0, generated = 0;
  for (const unit of units) {
    const rights = snapshot.bundles.find(b => b.document.id === unit.document_id).document.rights;
    let { key, vector } = await cachedIndexVector({ postgres, tenant: snapshot.tenant, rights, config, unit, embedding });
    if (vector) hits++;
    else { vector = await embedding.embed(unit.input_text); validateVector(vector, config.embedding); await postgres.cachePut(snapshot.tenant, key, config.id, unit.input_hash, vector); generated++; }
    vectors.push(validateVector(vector, config.embedding));
  }
  await qdrant.ensure(generation);
  await qdrant.upsert(generation, units, vectors);
  await qdrant.verify(generation, units, vectors);
  await postgres.lexical(snapshot.tenant, generation.id, Object.keys(snapshot.documents), 'validation', 1);
  if (hooks.beforeActivate) await hooks.beforeActivate(generation);
  await postgres.activate(snapshot.tenant, generation);
  return { generation_id: generation.id, config_id: config.id, embedding_mode: config.embedding.embedding_mode, units: units.length,
    knowledge_cards: snapshot.bundles.reduce((count, bundle) => count + (bundle.knowledge_cards?.length || 0), 0),
    dependencies: snapshot.bundles.reduce((count, bundle) => count + (bundle.dependencies?.length || 0), 0),
    knowledge_gaps: snapshot.bundles.reduce((count, bundle) => count + (bundle.knowledge_gaps?.length || 0), 0),
    cache_hits: hits, mock_vectors_created: config.embedding.embedding_mode === 'mock' ? generated : 0,
    stored_real_vectors_indexed: config.embedding.embedding_mode === 'real' ? units.length : 0, external_embedding_calls: 0, generation_calls: 0 };
}
