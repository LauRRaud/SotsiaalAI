// Compares query-time retrieval variants (channel weights, query stopwords) on the 05.09 multi-source
// corpus with the production retrieve()/evaluateRetrieval(). No API calls and no persistent DB writes:
// the lexical channel runs the production SQL on a session TEMP table, the vector channel uses stored
// real text-embedding-3-large vectors (corpus pilots in tmp/, plus optional stored query vectors).
//
//   node scripts/rag-v2-query-variants.mjs --set 05-09 --set holdout-2 \
//     --query-vectors tmp/rag-v2-multi-source/holdout-2-query-vectors.json
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import pg from 'pg';
import { loadSnapshot } from '../lib/rag-v2/search/snapshot.js';
import { readActive } from '../lib/rag-v2/catalog.js';
import { reusableEmbeddingCatalog } from '../lib/rag-v2/search/pilot-runner.js';
import { evaluateRetrieval } from '../lib/rag-v2/search/evaluator.js';
import { searchConfig } from '../lib/rag-v2/search/indexing.js';
import { indexUnit } from '../lib/rag-v2/search/embedding.js';
import { retrievalDirectory, DISCOVERY_SCHEMA } from '../lib/rag-v2/search/discovery.js';
import { lexicalFields, lexicalQuery } from '../lib/rag-v2/search/lexical-analysis.js';
import { ESTNLTK_LEXICAL } from '../lib/rag-v2/search/morphology.js';
import { LocalPolicy } from '../lib/rag-v2/search/policy.js';
import { hash, id } from '../lib/rag-v2/contracts.js';
import { defaultEstnltkAnalyzer } from '../lib/rag-v2/search/estnltk.js';
import { QUERY_STOPWORDS_VERSION } from '../lib/rag-v2/search/query-stopwords.js';

const SETS = {
  '05-09': ['tests/evaluation/multi-source/questions.json', 'tests/evaluation/multi-source/anchor-groups.json'],
  'holdout-2': ['tests/evaluation/multi-source/questions-holdout-2.json', 'tests/evaluation/multi-source/anchor-groups-holdout-2.json'],
};
const VARIANTS = { base: {}, stopwords: { lexicalStopwords: QUERY_STOPWORDS_VERSION }, vector2: { channelWeights: { lexical: 1, vector: 2 } },
  'vector2+stopwords': { channelWeights: { lexical: 1, vector: 2 }, lexicalStopwords: QUERY_STOPWORDS_VERSION } };
const CORPUS_VECTORS = ['tmp/rag-v2-m2-2/usage/pilot_e14470663fbf87b5ad1b1313e2f9945bf7e9afd96ec43a15c0dce380b95e2508',
  'tmp/rag-v2-multi-source/usage/pilot_2be546a0b998b304f89bb42d0a46d41efaf8bca48cafeba7e4a22c0a48687d40'];

const { values } = parseArgs({ options: { set: { type: 'string', multiple: true, default: ['05-09'] }, 'query-vectors': { type: 'string' } } });
const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const corpus = await readJson('tests/evaluation/multi-source/corpus.json'), tenant = corpus.tenant, storeRoot = 'tmp/rag-v2-multi-source/store';
const active = await readActive(path.join(storeRoot, id('tenant', tenant)));
const snapshot = await loadSnapshot(storeRoot, tenant, Object.keys(active.documents));
const { embedding } = await reusableEmbeddingCatalog(CORPUS_VECTORS, tenant);
if (values['query-vectors']) {
  // Paid query vectors bought for a new question set: keyed exactly as retrieve() embeds query.text.
  const stored = await readJson(values['query-vectors']);
  if (stored.model !== embedding.config.model || stored.dimensions !== embedding.config.dimensions || stored.vectors.length !== stored.input.length) throw Error('query_vector_config_mismatch');
  stored.input.forEach((text, i) => embedding.vectors.set(hash(text), stored.vectors[i]));
}
const config = searchConfig(embedding.config, ESTNLTK_LEXICAL, DISCOVERY_SCHEMA);
const source = { source_generation: snapshot.source_generation, documents: snapshot.documents, snapshot_hash: snapshot.snapshot_hash };
const generation = { id: id('search_generation', tenant, source, config), tenant, snapshot: source, config, state: 'ready' };
const units = snapshot.bundles.flatMap(b => b.chunks.map(c => indexUnit(c, b, config.embedding)));
const morph = await lexicalFields(units, ESTNLTK_LEXICAL);
const vectors = new Map(); for (const unit of units) vectors.set(unit.id, await embedding.embed(unit.input_text));
const directories = snapshot.bundles.map(b => retrievalDirectory(b, config.embedding, DISCOVERY_SCHEMA));
const client = new pg.Client({ connectionString: (await readJson('tmp/rag-v2-services/connections.json')).postgresUrl });
await client.connect();
try {
  await client.query(`CREATE TEMP TABLE eval_units (id text, document_id text, title text, authors text, body text, aids text, mt text, mb text, ma text,
    search_vector tsvector GENERATED ALWAYS AS (setweight(to_tsvector('pg_catalog.simple',title || ' ' || authors),'A') ||
      setweight(to_tsvector('pg_catalog.simple',body),'B') || setweight(to_tsvector('pg_catalog.simple',aids),'D')) STORED,
    morphology_vector tsvector GENERATED ALWAYS AS (setweight(to_tsvector('pg_catalog.simple',coalesce(mt,'')),'A') ||
      setweight(to_tsvector('pg_catalog.simple',coalesce(mb,'')),'B') || setweight(to_tsvector('pg_catalog.simple',coalesce(ma,'')),'D')) STORED)`);
  for (const [i, u] of units.entries()) await client.query('INSERT INTO eval_units VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [u.id, u.document_id, u.title, u.authors, u.body, u.search_aids, morph[i].title ?? null, morph[i].body ?? null, morph[i].aids ?? null]);
  const postgres = {
    active: async () => generation,
    retrievalDirectory: async (t, g, ids) => directories.filter(d => ids.includes(d.document_id)),
    bundles: async (t, g, ids) => snapshot.bundles.filter(b => ids.includes(b.document.id)),
    units: async (t, g, ids) => units.filter(u => ids.includes(u.document_id)),
    // Same SQL as PostgresCatalog.lexical for the EstNLTK contract.
    async lexical(t, g, documentIds, text, limit, unitIds = null) {
      if (!documentIds.length || !text.trim()) return [];
      return (await client.query(`WITH q AS (SELECT replace(plainto_tsquery('pg_catalog.simple',$1)::text,' & ',' | ')::tsquery AS exact,
        replace(plainto_tsquery('pg_catalog.simple',$5)::text,' & ',' | ')::tsquery AS stems)
        SELECT u.id,ts_rank_cd(u.search_vector,q.exact) + 0.35 * ts_rank_cd(u.morphology_vector,q.stems) AS score FROM eval_units u,q
        WHERE u.document_id=ANY($2::text[]) AND (u.search_vector @@ q.exact OR u.morphology_vector @@ q.stems) AND ($4::text[] IS NULL OR u.id=ANY($4::text[]))
        ORDER BY score DESC,u.id COLLATE "C" ASC LIMIT $3`, [text, documentIds, limit, unitIds, await lexicalQuery(text, ESTNLTK_LEXICAL)])).rows;
    },
  };
  const cos = (a, b) => { let d = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; } return d / Math.sqrt(x * y); };
  const qdrant = { async query(g, documentIds, vector, limit, unitIds = null) {
    return units.filter(u => documentIds.includes(u.document_id) && (!unitIds || unitIds.includes(u.id)))
      .map(u => ({ id: u.id, score: cos(vector, vectors.get(u.id)), document_id: u.document_id, version_id: u.version_id, input_hash: u.input_hash }))
      .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1)).slice(0, limit);
  } };
  const policy = new LocalPolicy({ tenants: { [tenant]: { operator: Object.keys(active.documents) } } });
  const context = { tenant, subject: 'operator', usage: 'development_only' };
  for (const name of values.set) {
    if (!SETS[name]) throw Error(`unknown set ${name}; known: ${Object.keys(SETS).join(', ')}`);
    const [questions, groups] = await Promise.all(SETS[name].map(readJson));
    const passed = {}, metadata = {};
    console.log(`\n${name}: correct source passage in the final context (full-support questions; source finding, not answer quality)`);
    for (const [variant, queryOptions] of Object.entries(VARIANTS)) {
      const { rows } = await evaluateRetrieval({ snapshot, questions, groups, postgres, qdrant, embedding, policy, context, queryOptions });
      const full = rows.filter(r => r.expected_support === 'full' && r.all_required_in_final_context !== null);
      const cell = method => { const own = full.filter(r => r.method === method);
        return `${own.filter(r => r.all_required_in_final_context).length}/${own.length} (top-1 ${own.filter(r => r.top_k[1].all_required).length})`; };
      passed[variant] = new Set(full.filter(r => r.method === 'hybrid' && r.all_required_in_final_context).map(r => r.question_id));
      // Bibliography questions have no source anchors; their success is the resolved metadata field.
      for (const row of rows.filter(r => r.method === 'hybrid' && r.outcome.startsWith('metadata_'))) (metadata[row.question_id] ||= {})[variant] = row.outcome;
      const errors = rows.filter(r => r.outcome === 'technical_error').length;
      console.log(`  ${variant.padEnd(18)} lexical ${cell('lexical')}  vector ${cell('vector')}  hybrid ${cell('hybrid')}${errors ? `  technical errors ${errors}` : ''}`);
    }
    const anchored = [...new Set(questions.cases.filter(c => c.expected_support === 'full' && !c.expected_metadata).map(c => c.id))];
    for (const question of anchored) {
      const marks = Object.keys(VARIANTS).map(v => (passed[v].has(question) ? '✓' : '·'));
      if (marks.some(mark => mark !== marks[0]) || marks[0] === '·') console.log(`    ${question.padEnd(40)} hybrid ${Object.keys(VARIANTS).map((v, i) => `${v} ${marks[i]}`).join(', ')}`);
    }
    for (const [question, outcomes] of Object.entries(metadata)) console.log(`    ${question.padEnd(40)} metadata ${Object.entries(outcomes).map(([v, o]) => `${v} ${o}`).join(', ')}`);
  }
} finally { await client.end(); defaultEstnltkAnalyzer().close(); }
