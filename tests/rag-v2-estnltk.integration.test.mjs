import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ingest } from '../lib/rag-v2/ingestion.js';
import { EstnltkAnalyzer } from '../lib/rag-v2/search/estnltk.js';
import { ESTNLTK_LEXICAL, MORPHOLOGY_LEXICAL, morphologyText } from '../lib/rag-v2/search/morphology.js';
import { lexicalFields, lexicalQuery } from '../lib/rag-v2/search/lexical-analysis.js';
import { IndexJobStore } from '../lib/rag-v2/search/index-jobs-postgres.js';
import { planIndexJob, runIndexJob } from '../lib/rag-v2/search/index-jobs.js';
import { indexSnapshot } from '../lib/rag-v2/search/indexing.js';
import { loadSnapshot } from '../lib/rag-v2/search/snapshot.js';
import { QdrantIndex } from '../lib/rag-v2/search/qdrant.js';
import { MockEmbedding } from '../lib/rag-v2/search/embedding.js';
import { LocalPolicy } from '../lib/rag-v2/search/policy.js';
import { retrieve } from '../lib/rag-v2/search/retrieval.js';
import { assertProfileGeneration, retrievalProfile } from '../lib/rag-v2/search/profiles.js';

const overlap = (a, b) => a.split(' ').some(term => term && b.split(' ').includes(term));
test('real EstNLTK resolves inflections, preserves ambiguity and names, and keeps English/Russian search', async t => {
  const analyzer = new EstnltkAnalyzer();
  try {
    const pairs = [['toimetulek', 'toimetuleku'], ['laps', 'lapse'], ['laps', 'lastele'], ['puue', 'puudega'], ['vald', 'vallas'],
      ['linn', 'linnas'], ['inimene', 'inimeste'], ['töö', 'tööd'], ['abi', 'abiks'], ['toetus', 'toetust'], ['elukoht', 'elukohas'],
      ['sotsiaaltöötaja', 'sotsiaaltöötajaga'], ['koduteenus', 'koduteenuseid'], ['pereliige', 'pereliikme'], ['õigus', 'õigused'],
      ['teenus', 'teenuseid'], ['hooldaja', 'hooldajale'], ['sissetulek', 'sissetulekuta'], ['omavalitsus', 'omavalitsuses'],
      ['taotlus', 'taotluse'], ['raha', 'rahaga'], ['võlg', 'võlgadest'], ['elama', 'elan'], ['saama', 'saan'], ['olema', 'olen']];
    const started = performance.now(), terms = await analyzer.analyze(pairs.flat());
    const coldMs = Math.round(performance.now() - started);
    for (let i = 0; i < pairs.length; i++) assert(overlap(terms[2 * i], terms[2 * i + 1]), pairs[i].join(' / '));
    const snowball = pairs.filter(([a, b]) => overlap(morphologyText(a), morphologyText(b))).length;
    t.diagnostic(`Illustrative pairs: EstNLTK ${pairs.length}/${pairs.length}, any Snowball language ${snowball}/${pairs.length}; cold batch ${coldMs} ms. Not corpus recall.`);
    const [ambiguous, name, other] = await analyzer.analyze(['puudega', 'Maie', 'astronoomia']);
    assert(ambiguous.includes('vmetpuu ') && ambiguous.includes('vmetpuue'));
    assert.equal(name, 'vmetmaie'); assert(!overlap(name, other));
    assert.deepEqual(await analyzer.analyze(['TÖÖTAN', 'TO\u0308O\u0308TAN']), [
      ...(await analyzer.analyze(['TÖÖTAN'])), ...(await analyzer.analyze(['TÖÖTAN'])),
    ]);
    // Real Kose record text: "m²" is a Python \w word but not a protocol letter; it used to fail the batch.
    const [area, fraction] = await analyzer.analyze(['Üüripiirmäär 2 eurot/m² kuus', 'pool ½ ja Ⅻ peatükk']);
    assert(area.includes('vmeteuro') && !/[²\d]/.test(area));
    assert(fraction.includes('vmetpeatükk') && !/[½Ⅻ]/.test(fraction));
    for (const [document, query] of [['Services', 'service'], ['работа', 'работы']]) {
      const fields = await lexicalFields([{ title: '', body: document, search_aids: '' }], ESTNLTK_LEXICAL, analyzer);
      assert(overlap(fields[0].body, await lexicalQuery(query, ESTNLTK_LEXICAL, analyzer)));
    }
  } finally { analyzer.close(); }
});

test('real PostgreSQL/Qdrant: resumable EstNLTK index serves canonical evidence, permissions and errors without model calls', async () => {
  const connections = JSON.parse(await fs.readFile('tmp/rag-v2-services/connections.json', 'utf8'));
  const analyzer = new EstnltkAnalyzer(), postgres = new IndexJobStore(connections.postgresUrl, { analyzer });
  const qdrant = new QdrantIndex(connections.qdrantUrl, connections.qdrantKey), embedding = new MockEmbedding();
  const tenant = `estnltk-${randomUUID()}`, root = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-estnltk-'));
  const savedFetch = globalThis.fetch;
  globalThis.fetch = (input, options) => {
    assert.equal(new URL(typeof input === 'string' ? input : input.url).origin, connections.qdrantUrl, 'Only local Qdrant is allowed');
    return savedFetch(input, options);
  };
  try {
    const texts = ['Toimetulek.', 'Laps.', 'Puue.', 'Vald.', 'Koduteenus.', 'Services.', 'Работа.', 'Astronoomia.'];
    const documents = [];
    for (let i = 0; i < texts.length; i++) {
      await fs.writeFile(path.join(root, `${i}.html`), `<article><p>${texts[i]}</p></article>`);
      const { bundle } = await ingest({ tenant, inputRoot: root, storeRoot: path.join(root, 'store'),
        metadata: { document_id: String(i), title: `Document ${i}`, language: i === 5 ? 'en' : i === 6 ? 'ru' : 'et', source_type: 'fixture', source_path: `${i}.html`, source_format: 'html' },
        profile: { id: 'generic', version: '1', months: [], categoryLabels: [] }, rights: { access: 'local_private', usage: 'development_only' } });
      documents.push(bundle.document.id);
    }
    const snapshot = await loadSnapshot(path.join(root, 'store'), tenant, documents);
    const old = await indexSnapshot({ snapshot, postgres, qdrant, embedding, lexical: MORPHOLOGY_LEXICAL });
    assert.equal((await postgres.lexical(tenant, old.generation_id, documents, 'toimetuleku', 5)).length, 0);
    const plan = await planIndexJob({ storeRoot: path.join(root, 'store'), tenant, documents, embedding: embedding.config });
    assert.equal(plan.config.lexical, ESTNLTK_LEXICAL);
    const first = await runIndexJob({ plan, storeRoot: path.join(root, 'store'), postgres, qdrant, embedding, maxBatches: 1 });
    assert.equal(first.completed_documents, 1); assert.equal((await postgres.active(tenant)).id, old.generation_id);
    const completed = await runIndexJob({ plan, storeRoot: path.join(root, 'store'), postgres, qdrant, embedding });
    assert.equal(completed.state, 'ready'); assert.equal(completed.external_embedding_calls, 0);
    assertProfileGeneration(retrievalProfile('hybrid-estnltk-dependencies-v1'), await postgres.active(tenant));
    const policy = new LocalPolicy({ tenants: { [tenant]: { operator: documents.slice(0, -1) } } });
    const context = { tenant, subject: 'operator', usage: 'development_only' }, callsBefore = embedding.calls;
    for (const [text, language, index] of [['toimetuleku', 'et', 0], ['lapsele', 'et', 1], ['puudega', 'et', 2], ['vallas', 'et', 3],
      ['koduteenuseid', 'et', 4], ['service', 'en', 5], ['работы', 'ru', 6]]) {
      const packet = await retrieve({ postgres, qdrant, embedding, policy, context,
        query: { text, language, method: 'lexical', semanticGraph: true, contextMode: 'compact' } });
      assert.equal(packet.state, 'ok', packet.error); assert.equal(packet.evidence[0].document_id, documents[index]);
      assert.equal(packet.evidence[0].source_text, texts[index]);
      assert(packet.evidence[0].source_locations.length); assert(packet.evidence[0].span_ids.length);
      assert(!JSON.stringify(packet.model_context).includes('vmet')); assert.equal(packet.measurements.generation_calls, 0);
    }
    assert.equal(embedding.calls, callsBefore);
    const denied = await retrieve({ postgres, qdrant, embedding, policy, context, query: { text: 'astronoomiast', language: 'et', method: 'lexical' } });
    assert.equal(denied.state, 'empty');
    assert.equal((await postgres.lexical(tenant, plan.generation_id, [documents[0]], 'lapsele', 5)).length, 0);
    await assert.rejects(postgres.lexical('other-tenant', plan.generation_id, documents, 'lapsele', 5), { code: 'unknown_lexical_config' });
    const working = postgres.analyzer;
    postgres.analyzer = { async analyze() { throw Object.assign(new Error('morphology_unavailable'), { code: 'morphology_unavailable' }); } };
    const unavailable = await retrieve({ postgres, qdrant, embedding, policy, context, query: { text: 'lapsele', language: 'et', method: 'lexical' } });
    assert.equal(unavailable.state, 'error'); assert.equal(unavailable.evidence.length, 0);
    assert.equal((await postgres.lexical(tenant, old.generation_id, documents, 'koduteenust', 5)).length, 1);
    postgres.analyzer = working;
    const resumed = await runIndexJob({ plan, storeRoot: path.join(root, 'store'), postgres, qdrant, embedding });
    assert.equal(resumed.reused, true);
    await postgres.pool.query("UPDATE rag_v2_unit SET morphology='{}' WHERE tenant=$1 AND generation_id=$2", [tenant, plan.generation_id]);
    await assert.rejects(postgres.units(tenant, plan.generation_id, documents), { code: 'index_morphology_integrity_failed' });
  } finally {
    const generations = (await postgres.pool.query('SELECT * FROM rag_v2_generation WHERE tenant=$1', [tenant])).rows;
    for (const generation of generations) await qdrant.request(qdrant.route(generation), 'DELETE').catch(error => { if (error.status !== 404) throw error; });
    for (const table of ['rag_v2_index_job', 'rag_v2_unit', 'rag_v2_generation_document', 'rag_v2_head', 'rag_v2_generation', 'rag_v2_object', 'rag_v2_version', 'rag_v2_document', 'rag_v2_vector_cache']) {
      await postgres.pool.query(`DELETE FROM ${table} WHERE tenant=$1`, [tenant]);
    }
    analyzer.close(); await postgres.close(); globalThis.fetch = savedFetch;
    assert(path.dirname(path.resolve(root)) === path.resolve(os.tmpdir()) && path.basename(root).startsWith('rag-v2-estnltk-'));
    await fs.rm(root, { recursive: true, force: true });
  }
});
