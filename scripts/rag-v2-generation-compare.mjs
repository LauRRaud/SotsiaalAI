#!/usr/bin/env node
// Compares two index generations on the same questions with everything else fixed, so a corpus change can be
// told apart from the answer model's varying search queries and selection (Codex review 27.09.2026, v26/v27).
//   - search queries: taken from one stored evaluation run (--plans, its "plans" map), identical for both;
//   - vectors: the stored question vectors (--vectors); planned queries join the lexical channel only, unless their
//     vectors were stored too (--plan-vectors, same shape): then they also query the vector channel, as in the chat.
//     This comparison buys no embedding;
//   - no model call: the reranker's candidate pool (the fused 30 plus the national-law reserve) and the fused
//     top-9 evidence are deterministic, and anchors are counted in both.
// Reads the index only; prints JSON. Model calls 0, embedding calls 0.
//   node --import ./scripts/register-node-source-loader.mjs scripts/rag-v2-generation-compare.mjs \
//     --questions Q.json --vectors V.json --plans RUN.json --policy P.json --connections C.json --generations G1,G2 [--split all] [--ids a,b]
import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { FilePolicy } from '../lib/rag-v2/search/policy.js';
import { PostgresCatalog } from '../lib/rag-v2/search/postgres.js';
import { QdrantIndex } from '../lib/rag-v2/search/qdrant.js';
import { retrieve, RERANK_POOL } from '../lib/rag-v2/search/retrieval.js';
import { retrievalProfile, queryForProfile, CHAT_PROFILE } from '../lib/rag-v2/search/profiles.js';
import { unifiedDirectory, NATIONAL_LAW_RESERVE } from '../lib/rag-v2/search/unified.js';
import { withoutStopwords } from '../lib/rag-v2/search/query-stopwords.js';

const { values } = parseArgs({ options: { questions: { type: 'string' }, vectors: { type: 'string' }, plans: { type: 'string' },
  policy: { type: 'string' }, connections: { type: 'string' }, generations: { type: 'string' }, split: { type: 'string', default: 'all' },
  ids: { type: 'string' }, 'plan-vectors': { type: 'string' },
  tenant: { type: 'string', default: 'sotsiaalai-corpus' } } });
for (const key of ['questions', 'vectors', 'plans', 'policy', 'connections', 'generations']) if (!values[key]) throw new Error(`--${key} is required`);
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const only = values.ids ? new Set(values.ids.split(',')) : null;
const questions = read(values.questions).questions.filter(q => (values.split === 'all' || q.split === values.split) && (!only || only.has(q.id)));
const stored = read(values.vectors), vectors = new Map(stored.input.map((text, i) => [text, stored.vectors[i]]));
if (values['plan-vectors']) { const planned = read(values['plan-vectors']); planned.input.forEach((text, i) => vectors.set(text, planned.vectors[i])); }
const plans = read(values.plans).plans || {};
const connections = read(values.connections), policy = new FilePolicy(values.policy);
const context = { tenant: values.tenant, subject: 'operator', usage: 'development_only' };
const norm = text => text.replace(/\s+/gu, ' ').trim();
const covered = (anchors, texts) => anchors.map(a => texts.some(t => t.document_id === a.document_id && norm(t.text).includes(norm(a.contains))));
const profile = retrievalProfile(CHAT_PROFILE);

const results = {};
for (const generationId of values.generations.split(',')) {
  const postgres = new PostgresCatalog(connections.postgresUrl), qdrant = new QdrantIndex(connections.qdrantUrl, connections.qdrantKey);
  try {
    const generation = await postgres.readyGeneration(values.tenant, generationId);
    if (!generation) throw new Error(`generation not ready: ${generationId}`);
    postgres.active = async () => generation; // this comparison reads the named generation, active or not
    const access = await policy.allowed(context), allowed = new Set(access.documents);
    const directories = await postgres.retrievalDirectory(values.tenant, generation, Object.keys(generation.snapshot.documents).filter(d => allowed.has(d)));
    const groups = unifiedDirectory(directories), knowledge = new Set(groups.knowledge.map(row => row.document_id));
    const lanePolicy = { async allowed(ctx) { const current = await policy.allowed(ctx); return { ...current, documents: current.documents.filter(d => knowledge.has(d)) }; } };
    const embedding = { config: generation.config.embedding, source: 'persisted_vectors', embed: async text => vectors.get(text) };
    const unitDocument = new Map(directories.flatMap(row => row.units.map(unit => [unit.id, row.document_id])));
    // The lexical channel reads the question and the planned queries, as in the chat (one OR query); the vector
    // channel reads the question and, when their vectors were stored, the planned queries.
    const lexical = postgres.lexical.bind(postgres);
    let lexicalText = null;
    postgres.lexical = (tenant, generationId, documents, _text, ...rest) => lexical(tenant, generationId, documents, lexicalText, ...rest);
    const rows = [];
    for (const question of questions) {
      if (!vectors.has(question.query)) { rows.push({ id: question.id, error: 'no_stored_question_vector' }); continue; }
      const anchors = question.anchors.filter(a => knowledge.has(a.document_id));
      const base = queryForProfile(profile, { text: question.query, language: question.language });
      const planned = plans[question.id] || [], vectorPlan = planned.length > 0 && planned.every(text => vectors.has(text));
      const query = { ...base, ...(vectorPlan ? { variants: planned } : {}),
        poolReserve: { documents: groups.nationalLaw.map(row => row.document_id), ...NATIONAL_LAW_RESERVE } };
      lexicalText = withoutStopwords([question.query, ...planned].join('\n'));
      let pool = [];
      const hooks = { rerank: async passages => { pool = passages; return null; } }; // null: keep the fused order
      const packet = await retrieve({ postgres, qdrant, embedding, policy: lanePolicy, context, query, allowLexicalFallback: false, hooks });
      const poolTexts = pool.map((passage, i) => ({ document_id: unitDocument.get(packet.rerank.candidates[i]), text: passage.text }));
      const evidenceTexts = packet.evidence.map(e => ({ document_id: e.document_id, text: e.source_text }));
      const inPool = covered(anchors, poolTexts), inEvidence = covered(anchors, evidenceTexts);
      rows.push({ id: question.id, support: question.expected_support, state: packet.state, pool: pool.length,
        reserved: packet.rerank?.reserved?.length ?? 0, anchors: anchors.length,
        pool_all: anchors.length ? inPool.every(Boolean) : null, pool_some: anchors.length ? inPool.some(Boolean) : null,
        fused_all: anchors.length ? inEvidence.every(Boolean) : null, fused_some: anchors.length ? inEvidence.some(Boolean) : null,
        anchor_ranks: anchors.map(a => { const i = poolTexts.findIndex(t => t.document_id === a.document_id && norm(t.text).includes(norm(a.contains))); return i < 0 ? null : i + 1; }) });
    }
    const answerable = rows.filter(r => r.anchors > 0);
    results[generationId] = { summary: { questions: answerable.length, pool_all: answerable.filter(r => r.pool_all).length,
      pool_some: answerable.filter(r => r.pool_some).length, fused_all: answerable.filter(r => r.fused_all).length,
      fused_some: answerable.filter(r => r.fused_some).length, rerank_pool: RERANK_POOL }, rows };
  } finally { await postgres.close(); }
}
const [first, second] = values.generations.split(',');
const differences = second ? results[first].rows.filter(r => {
  const other = results[second].rows.find(o => o.id === r.id);
  return other && (r.pool_all !== other.pool_all || r.fused_all !== other.fused_all || String(r.anchor_ranks) !== String(other.anchor_ranks));
}).map(r => ({ id: r.id, [first]: r, [second]: results[second].rows.find(o => o.id === r.id) })) : [];
console.log(JSON.stringify({ fixed: { plans: values.plans, model_calls: 0, embedding_calls: 0,
  vectors: values['plan-vectors'] ? 'stored question and planned-query vectors' : 'stored question vectors; planned queries lexical only' },
  summaries: Object.fromEntries(Object.entries(results).map(([g, r]) => [g, r.summary])), differences,
  rows: Object.fromEntries(Object.entries(results).map(([g, r]) => [g, r.rows.map(({ id, pool_all, pool_some, fused_all, fused_some, anchor_ranks, reserved }) =>
    ({ id, pool_all, pool_some, fused_all, fused_some, anchor_ranks, reserved }))])) }, null, 1));
process.exit(0);
