import test from 'node:test';
import assert from 'node:assert/strict';
import { runtimeAdapters } from '../lib/rag-v2/pilot/retrieval.js';
import { retrievalProfile } from '../lib/rag-v2/search/profiles.js';
import { searchConfig } from '../lib/rag-v2/search/indexing.js';
import { ESTNLTK_LEXICAL } from '../lib/rag-v2/search/morphology.js';

test('pilot preflight checks generation, scope, directory and analyzer without reading source bodies', async () => {
  const search = searchConfig(undefined, ESTNLTK_LEXICAL), calls = [];
  let generation = { id: 'generation', config: search, snapshot: { documents: { a: { version_id: 'one' }, b: { version_id: 'two' } } } };
  let directoryError, analyzerError;
  class Catalog {
    async active() { return generation; }
    async retrievalDirectory(tenant, gen, documents) {
      calls.push('directory'); assert.equal(tenant, 'fixture'); assert.equal(gen, generation); assert.deepEqual(documents, ['a', 'b']);
      if (directoryError) throw Object.assign(new Error(directoryError), { code: directoryError });
      return null; // Legacy directories trigger eager validation during retrieval, not here.
    }
    async checkLexicalAnalyzer(lexical) {
      calls.push('analyzer'); assert.equal(lexical, ESTNLTK_LEXICAL);
      if (analyzerError) throw Object.assign(new Error(analyzerError), { code: analyzerError });
    }
    async bundles() { assert.fail('Preflight must not load the entire corpus'); }
    async close() { calls.push('close'); }
  }
  const config = { tenant: 'fixture', generationId: 'generation', mode: 'real', embedding: search.embedding,
    documents: { a: 'one', b: 'two' }, profile: retrievalProfile() };
  const adapters = runtimeAdapters(async () => config, 'operator', { Catalog });
  await adapters.preflight(config); assert.deepEqual(calls, ['directory', 'analyzer', 'close']);
  calls.length = 0; directoryError = 'retrieval_directory_integrity_failed';
  await assert.rejects(adapters.preflight(config), { code: directoryError }); assert.deepEqual(calls, ['directory', 'close']);
  directoryError = null; analyzerError = 'morphology_unavailable';
  await assert.rejects(adapters.preflight(config), { code: analyzerError });
  analyzerError = null;
  for (const [change, code] of [[{ generationId: 'another' }, 'active_index_mismatch'], [{ documents: { a: 'wrong' } }, 'active_source_version_mismatch']]) {
    await assert.rejects(adapters.preflight({ ...config, ...change }), { code });
  }
  generation = { ...generation, config: searchConfig() };
  await assert.rejects(adapters.preflight(config), { code: 'profile_generation_mismatch' });
});
