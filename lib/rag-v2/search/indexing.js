import { fail, id, stable } from '../contracts.js';
import { assertSnapshot } from './snapshot.js';
import { embeddingConfig, indexUnit, cacheKey, validateVector } from './embedding.js';
import { collectionName } from './qdrant.js';

export function searchConfig(embedding) {
  const config = { embedding: embeddingConfig(embedding), lexical: 'pg-simple-weighted-or-v1', ranking: 'rrf-v1', rrf_constant: 60 };
  return { ...config, id: id('search_config', config) };
}
export function verifySearchConfig(config) {
  if (stable(searchConfig(config.embedding)) !== stable(config)) fail('search_config_mismatch');
}
export async function indexSnapshot({ snapshot, postgres, qdrant, embedding, hooks = {} }) {
  assertSnapshot(snapshot);
  const config = searchConfig(embedding.config);
  const units = snapshot.bundles.flatMap(b => b.chunks.map(c => indexUnit(c, b, config.embedding)));
  if (units.length > 5000) fail('local_index_limit');
  const source = { source_generation: snapshot.source_generation, documents: snapshot.documents, snapshot_hash: snapshot.snapshot_hash };
  const generationId = id('search_generation', snapshot.tenant, source, config);
  const generation = await postgres.beginGeneration(snapshot.tenant, { id: generationId, snapshot: source, config,
    collection: collectionName(snapshot.tenant, generationId), expected_count: units.length });
  await postgres.importSnapshot(snapshot, generation.id, units);
  if (hooks.afterPostgres) await hooks.afterPostgres(generation);
  const vectors = []; let hits = 0, generated = 0;
  for (const unit of units) {
    const rights = snapshot.bundles.find(b => b.document.id === unit.document_id).document.rights;
    const key = cacheKey(snapshot.tenant, rights, config.embedding, unit.input_text);
    let vector = await postgres.cacheGet(snapshot.tenant, key, config.id, unit.input_hash);
    if (vector) hits++;
    else { vector = await embedding.embed(unit.input_text); validateVector(vector, config.embedding); await postgres.cachePut(snapshot.tenant, key, config.id, unit.input_hash, vector); generated++; }
    vectors.push(validateVector(vector, config.embedding));
  }
  await qdrant.ensure(generation);
  await qdrant.upsert(generation, units, vectors);
  await qdrant.verify(generation, units);
  await postgres.lexical(snapshot.tenant, generation.id, Object.keys(snapshot.documents), 'validation', 1);
  if (hooks.beforeActivate) await hooks.beforeActivate(generation);
  await postgres.activate(snapshot.tenant, generation);
  return { generation_id: generation.id, config_id: config.id, embedding_mode: 'mock', units: units.length,
    cache_hits: hits, mock_vectors_created: generated, external_embedding_calls: 0, generation_calls: 0 };
}
