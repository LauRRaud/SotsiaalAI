import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertIndexCapacity, INDEX_CAPACITY } from '../lib/rag-v2/search/capacity.js';
import { searchConfig } from '../lib/rag-v2/search/indexing.js';
import { realEmbeddingConfig } from '../lib/rag-v2/search/pilot-manifest.js';
import { assertProfileGeneration, retrievalProfile } from '../lib/rag-v2/search/profiles.js';
import { ESTNLTK_LEXICAL, LEGACY_LEXICAL } from '../lib/rag-v2/search/morphology.js';

test('index capacity is one shared bound for planning, purchase and indexing', () => {
  assert.doesNotThrow(() => assertIndexCapacity({ documents: INDEX_CAPACITY.documents, units: INDEX_CAPACITY.units }));
  assert.throws(() => assertIndexCapacity({ documents: 1, units: INDEX_CAPACITY.units + 1 }), /local_index_limit/);
  assert.throws(() => assertIndexCapacity({ documents: INDEX_CAPACITY.documents + 1, units: 1 }), /local_index_limit/);
  assert.throws(() => assertIndexCapacity({ documents: -1, units: 1 }), /local_index_limit/);
});

test('a generation built for purchase must use the lexical analysis of the default retrieval profile', () => {
  const profile = retrievalProfile();
  assert.equal(profile.generation_requirements.lexical, ESTNLTK_LEXICAL);
  assert.doesNotThrow(() => assertProfileGeneration(profile, { config: searchConfig(realEmbeddingConfig(), ESTNLTK_LEXICAL) }));
  assert.throws(() => assertProfileGeneration(profile, { config: searchConfig(realEmbeddingConfig(), LEGACY_LEXICAL) }), /profile_generation_mismatch/);
});
