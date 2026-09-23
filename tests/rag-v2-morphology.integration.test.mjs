import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ingest } from '../lib/rag-v2/ingestion.js';
import { PostgresCatalog } from '../lib/rag-v2/search/postgres.js';
import { QdrantIndex } from '../lib/rag-v2/search/qdrant.js';
import { MockEmbedding } from '../lib/rag-v2/search/embedding.js';
import { loadSnapshot } from '../lib/rag-v2/search/snapshot.js';
import { indexSnapshot } from '../lib/rag-v2/search/indexing.js';
import { MORPHOLOGY_LEXICAL } from '../lib/rag-v2/search/morphology.js';
import { retrieve } from '../lib/rag-v2/search/retrieval.js';
import { LocalPolicy } from '../lib/rag-v2/search/policy.js';

test('real PostgreSQL and Qdrant: inflected queries retrieve exact canonical evidence with zero query model calls', async () => {
  const connections = JSON.parse(await fs.readFile('tmp/rag-v2-services/connections.json', 'utf8'));
  const postgres = new PostgresCatalog(connections.postgresUrl), qdrant = new QdrantIndex(connections.qdrantUrl, connections.qdrantKey);
  const embedding = new MockEmbedding(), tenant = `morphology-${randomUUID()}`;
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-morphology-')), collections = [];
  const savedFetch = globalThis.fetch;
  globalThis.fetch = (input, options) => {
    assert.equal(new URL(typeof input === 'string' ? input : input.url).origin, connections.qdrantUrl, 'Only local Qdrant calls allowed');
    return savedFetch(input, options);
  };
  try {
    const documents = [], sourceTexts = ['Koduteenus aitab kodus.', 'Toetus.', 'Services are available.', 'Astronomy studies planets.'];
    for (let i = 0; i < sourceTexts.length; i++) {
      const source_path = `${i}.html`; await fs.writeFile(path.join(root, source_path), `<article><p>${sourceTexts[i]}</p></article>`);
      const { bundle } = await ingest({ tenant, inputRoot: root, storeRoot: path.join(root, 'store'),
        metadata: { document_id: String(i), title: `Document ${i}`, source_type: 'fixture', language: i < 2 ? 'et' : 'en', source_path, source_format: 'html' },
        profile: { id: 'generic', version: '1', months: [], categoryLabels: [] }, rights: { access: 'local_private', usage: 'development_only' } });
      documents.push(bundle.document.id);
    }
    const snapshot = await loadSnapshot(path.join(root, 'store'), tenant, documents);
    const old = await indexSnapshot({ snapshot, postgres, qdrant, embedding });
    collections.push((await postgres.active(tenant)).collection);
    assert.equal((await postgres.lexical(tenant, old.generation_id, documents, 'koduteenust', 5)).length, 0);
    const next = await indexSnapshot({ snapshot, postgres, qdrant, embedding, lexical: MORPHOLOGY_LEXICAL });
    collections.push((await postgres.active(tenant)).collection);
    assert.notEqual(next.generation_id, old.generation_id);
    const policy = new LocalPolicy({ tenants: { [tenant]: { operator: documents.slice(0, 3) } } });
    const callsBefore = embedding.calls;
    for (const [text, language, expected] of [['koduteenust', 'et', documents[0]], ['toetust', 'et', documents[1]], ['service', 'en', documents[2]]]) {
      const packet = await retrieve({ postgres, qdrant, embedding, policy, context: { tenant, subject: 'operator', usage: 'development_only' },
        query: { text, language, method: 'lexical', semanticGraph: true, contextMode: 'compact' } });
      assert.equal(packet.state, 'ok', packet.error);
      assert.equal(packet.evidence[0].document_id, expected);
      assert(packet.evidence.every(e => !e.source_text.includes('sbet') && e.source_locations.length));
      assert.equal(packet.measurements.generation_calls, 0);
    }
    assert.equal(embedding.calls, callsBefore, 'Lexical queries never embed');
    assert.deepEqual(await postgres.lexical('another-tenant', next.generation_id, [], 'koduteenust', 5), []);
    assert.equal((await postgres.lexical(tenant, next.generation_id, [documents[1]], 'koduteenust', 5)).length, 0);
    const again = await indexSnapshot({ snapshot, postgres, qdrant, embedding, lexical: MORPHOLOGY_LEXICAL });
    assert.equal(again.mock_vectors_created, 0);
    await postgres.pool.query("UPDATE rag_v2_unit SET morphology='{}' WHERE tenant=$1 AND generation_id=$2", [tenant, next.generation_id]);
    await assert.rejects(postgres.units(tenant, next.generation_id, documents), { code: 'index_morphology_integrity_failed' });
  } finally {
    for (const collection of collections) await qdrant.request(`/collections/${collection}`, 'DELETE');
    for (const table of ['rag_v2_unit', 'rag_v2_generation_document', 'rag_v2_head', 'rag_v2_generation', 'rag_v2_object', 'rag_v2_version', 'rag_v2_document', 'rag_v2_vector_cache']) await postgres.pool.query(`DELETE FROM ${table} WHERE tenant=$1`, [tenant]);
    await postgres.close(); globalThis.fetch = savedFetch;
    assert(path.dirname(path.resolve(root)) === path.resolve(os.tmpdir()) && path.basename(root).startsWith('rag-v2-morphology-'));
    await fs.rm(root, { recursive: true, force: true });
  }
});
