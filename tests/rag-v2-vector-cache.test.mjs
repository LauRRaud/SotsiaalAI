import test from 'node:test';
import assert from 'node:assert/strict';
import { cachedIndexVector, searchConfig } from '../lib/rag-v2/search/indexing.js';
import { embeddingConfig } from '../lib/rag-v2/search/embedding.js';
import { ESTNLTK_LEXICAL } from '../lib/rag-v2/search/morphology.js';
import { LEGACY_DISCOVERY_SCHEMA, TYPED_DISCOVERY_SCHEMA, DISCOVERY_SCHEMA } from '../lib/rag-v2/search/discovery.js';

// Same row semantics as PostgresCatalog.cacheGet/cachePut: immutable rows, a key bound to one config and input.
function memoryCache() {
  const rows = new Map(), writes = [];
  return { writes,
    async cacheGet(tenant, key, configId, inputHash) {
      const row = rows.get(tenant + '/' + key);
      if (row && (row.configId !== configId || row.inputHash !== inputHash)) throw Object.assign(Error('embedding_cache_mismatch'), { code: 'embedding_cache_mismatch' });
      return row?.vector;
    },
    async cachePut(tenant, key, configId, inputHash, vector) {
      writes.push(key);
      if (!rows.has(tenant + '/' + key)) rows.set(tenant + '/' + key, { configId, inputHash, vector });
    } };
}
const embedding = embeddingConfig(), vector = Array.from({ length: embedding.dimensions }, (_, i) => (i === 3 ? 1 : 0));
const unit = { input_text: 'Koduteenus aitab igapäevastes toimingutes.', input_hash: 'a'.repeat(64) };
const base = { tenant: 't', rights: { access: 'local_private', usage: 'development_only' }, unit, embedding: null };
async function seed(postgres, directory) {
  const config = searchConfig(embedding, ESTNLTK_LEXICAL, directory);
  const { key, vector: found } = await cachedIndexVector({ ...base, postgres, config, readOnly: true });
  assert.equal(found, undefined);
  await postgres.cachePut(base.tenant, key, config.id, unit.input_hash, vector);
}

for (const directory of [TYPED_DISCOVERY_SCHEMA, LEGACY_DISCOVERY_SCHEMA]) {
  test(`a vector cached only under ${directory} is reused and imported by the v3 directory`, async () => {
    const postgres = memoryCache();
    await seed(postgres, directory);
    const config = searchConfig(embedding, ESTNLTK_LEXICAL, DISCOVERY_SCHEMA);
    const read = await cachedIndexVector({ ...base, postgres, config, readOnly: true });
    assert.equal(read.vector, undefined, 'a read-only checkpoint never imports');
    const imported = await cachedIndexVector({ ...base, postgres, config });
    assert.deepEqual(imported.vector, vector);
    assert.equal(postgres.writes.at(-1), imported.key);
    assert.deepEqual((await cachedIndexVector({ ...base, postgres, config, readOnly: true })).vector, vector);
  });
}

test('the newest earlier directory wins and an unrelated input is never reused', async () => {
  const postgres = memoryCache();
  await seed(postgres, TYPED_DISCOVERY_SCHEMA);
  const config = searchConfig(embedding, ESTNLTK_LEXICAL, DISCOVERY_SCHEMA);
  const other = { ...base, unit: { input_text: 'Teine tekst.', input_hash: 'b'.repeat(64) } };
  assert.equal((await cachedIndexVector({ ...other, postgres, config })).vector, undefined);
  assert.deepEqual((await cachedIndexVector({ ...base, postgres, config })).vector, vector);
});
