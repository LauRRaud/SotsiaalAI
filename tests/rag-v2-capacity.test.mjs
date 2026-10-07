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

test('the capacity is a measured decision (ADR-100): 80,000 units holds corpus v66 and the documents that waited for it', () => {
  // A change of these numbers needs a new measurement of a turn's search cost (ADR-036), written into an ADR.
  assert.deepEqual({ ...INDEX_CAPACITY }, { documents: 10000, units: 80000 });
  // Corpus v66 (8179 documents, 57 860 units) with the 30 studies the first attempt of v66 was refused for (3959 units).
  assert.doesNotThrow(() => assertIndexCapacity({ documents: 8209, units: 57860 + 3959 }));
});

test('a generation built for purchase must use the lexical analysis of the default retrieval profile', () => {
  const profile = retrievalProfile();
  assert.equal(profile.generation_requirements.lexical, ESTNLTK_LEXICAL);
  assert.doesNotThrow(() => assertProfileGeneration(profile, { config: searchConfig(realEmbeddingConfig(), ESTNLTK_LEXICAL) }));
  assert.throws(() => assertProfileGeneration(profile, { config: searchConfig(realEmbeddingConfig(), LEGACY_LEXICAL) }), /profile_generation_mismatch/);
});
