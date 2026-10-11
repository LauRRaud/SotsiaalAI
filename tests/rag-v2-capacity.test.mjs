import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertIndexCapacity, INDEX_CAPACITY } from '../lib/rag-v2/search/capacity.js';
import { DISCOVERY_SCHEMA } from '../lib/rag-v2/search/discovery.js';
import { UNIFIED_LIMITS, unifiedDirectory } from '../lib/rag-v2/search/unified.js';
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

test('the capacity is a measured decision (ADR-100, ADR-108, ADR-143): 150,000 units, 15,000 documents', () => {
  // A change of these numbers needs a new measurement of a turn's search cost (ADR-036), written into an ADR.
  // ADR-108 (08.10.2026): 80,000 -> 100,000 units, measured with six generations up to the live 68,408 units.
  // ADR-143 (11.10.2026): 10,000 -> 15,000 documents, from the directory's measured line up to 9,288 documents.
  // ADR-143 (11.10.2026): 100,000 -> 150,000 units, from the same line, last measured at 88,181 units (ADR-137).
  assert.deepEqual({ ...INDEX_CAPACITY }, { documents: 15000, units: 150000 });
  assert.doesNotThrow(() => assertIndexCapacity({ documents: 8337, units: 68408 + 31592 }));
  assert.doesNotThrow(() => assertIndexCapacity({ documents: 8337, units: 150000 }));
  assert.throws(() => assertIndexCapacity({ documents: 8337, units: 150001 }), /local_index_limit/);
  // Corpus v66 (8179 documents, 57 860 units) with the 30 studies the first attempt of v66 was refused for (3959 units).
  assert.doesNotThrow(() => assertIndexCapacity({ documents: 8209, units: 57860 + 3959 }));
  // Corpus v81 (9735 documents, 90 707 units) with the 479 articles (670 units) that pass the earlier bound of 10,000 documents.
  assert.doesNotThrow(() => assertIndexCapacity({ documents: 9735 + 479, units: 90707 + 670 }));
  assert.throws(() => assertIndexCapacity({ documents: 15001, units: 90707 }), /local_index_limit/);
});

test('the search reads a directory as large as the index may hold', () => {
  // The two bounds are one decision in two files: a generation of 10,001 documents that the index accepted and the
  // search refused (unified_directory_required) would fail every turn of the chat.
  assert.equal(UNIFIED_LIMITS.directoryDocuments, INDEX_CAPACITY.documents);
  const row = n => ({ schema_version: DISCOVERY_SCHEMA, document_id: `document_${n}`, fields: {}, source: { record_kind: null, journal: false } });
  const directory = Array.from({ length: INDEX_CAPACITY.documents }, (unused, n) => row(n));
  assert.equal(unifiedDirectory(directory).knowledge.length, INDEX_CAPACITY.documents);
  assert.throws(() => unifiedDirectory([...directory, row('over')]), { code: 'unified_directory_required' });
});

test('a generation built for purchase must use the lexical analysis of the default retrieval profile', () => {
  const profile = retrievalProfile();
  assert.equal(profile.generation_requirements.lexical, ESTNLTK_LEXICAL);
  assert.doesNotThrow(() => assertProfileGeneration(profile, { config: searchConfig(realEmbeddingConfig(), ESTNLTK_LEXICAL) }));
  assert.throws(() => assertProfileGeneration(profile, { config: searchConfig(realEmbeddingConfig(), LEGACY_LEXICAL) }), /profile_generation_mismatch/);
});
