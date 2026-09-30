#!/usr/bin/env node
// The graph experiment (Codex follow-up review 29.09, 7.7): does a graph add the deciding condition that the chat's search
// leaves out, compared with the same extra room for plain ranked text? Each question runs through five retrieval profiles
// of the chat's knowledge lane (profiles.js GRAPH_EXPERIMENT_PROFILES: A no graph, B more ranked text, C knowledge cards,
// D the act's own cross-references, E structural neighbours; B-E with the same 13 sources and 13000 tokens).
// Frozen: the corpus generation, the date (legal versions in force on it), no municipality (no municipal texts), the
// search plan's queries (written into the catalogue before any run) and no reranker, so every arm is repeatable. The
// question and its queries are embedded once and the vectors kept in --out, so a repeat run makes no model call at all.
// It measures whether the catalogue's deciding phrases reach the evidence, what each arm added and at what size and time;
// whether the answer would use them is a separate, paid measurement. Usage (server, eval copy):
//   node --env-file=... scripts/rag-v2-graph-experiment.mjs --catalogue tests/evaluation/graph/hard-conditions-1.json --out <dir>
import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { PostgresCatalog } from '../lib/rag-v2/search/postgres.js';
import { QdrantIndex } from '../lib/rag-v2/search/qdrant.js';
import { retrieve } from '../lib/rag-v2/search/retrieval.js';
import { retrievalProfile, queryForProfile, assertProfileGeneration, GRAPH_EXPERIMENT_PROFILES } from '../lib/rag-v2/search/profiles.js';
import { unifiedDirectory, municipalScope } from '../lib/rag-v2/search/unified.js';
import { legalReference, legalValidityScope } from '../lib/rag-v2/search/legal-validity.js';

const args = process.argv.slice(2), option = name => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : null; };
const cataloguePath = option('--catalogue'), out = option('--out'), tenant = option('--tenant') || 'sotsiaalai-corpus';
if (!cataloguePath || !out) { console.error('usage: --catalogue <json> --out <dir> [--tenant <id>]'); process.exit(2); }
const catalogue = JSON.parse(await fs.readFile(cataloguePath, 'utf8'));
const problems = [];
if (!/^\d{4}-\d{2}-\d{2}$/u.test(catalogue.date || '')) problems.push('date');
for (const q of catalogue.questions || []) {
  if (!/^[a-z0-9-]+$/u.test(q.id || '') || typeof q.text !== 'string' || !Array.isArray(q.queries) || q.queries.length > 3
    || !Array.isArray(q.evidence_text) || !q.evidence_text.length || !['within_document', 'across_documents'].includes(q.kind)) problems.push(q.id || '?');
}
if (problems.length || !catalogue.questions?.length) { console.error(JSON.stringify({ ok: false, problems })); process.exit(2); }
await fs.mkdir(out, { recursive: true });

const postgres = new PostgresCatalog(process.env.RAG_V2_POSTGRES_URL);
const qdrant = new QdrantIndex(process.env.RAG_V2_QDRANT_URL, process.env.RAG_V2_QDRANT_KEY);
const context = { subject: 'graph-experiment', tenant, usage: 'development_only' };
try {
  const generation = await postgres.active(tenant);
  const documents = Object.keys(generation.snapshot.documents);
  const groups = unifiedDirectory(await postgres.retrievalDirectory(tenant, generation, documents));
  // The knowledge lane as the chat builds it with no municipality: legal versions in force on the date, no municipal texts.
  const legal = legalValidityScope(groups.knowledge, legalReference(catalogue.date, []));
  const eligible = municipalScope(legal.eligible, null).eligible.map(row => row.document_id);
  const policy = { async allowed() { return { documents: eligible, revision: `graph-experiment-${generation.id}` }; } };

  // One embedding per text, kept with the results.
  const vectorFile = path.join(out, 'vectors.json');
  const vectors = new Map(Object.entries(await fs.readFile(vectorFile, 'utf8').then(JSON.parse).catch(() => ({}))));
  const texts = [...new Set(catalogue.questions.flatMap(q => [q.text, ...q.queries]))].filter(text => !vectors.has(text));
  if (texts.length) {
    const config = generation.config.embedding;
    const response = await fetch(config.endpoint || 'https://api.openai.com/v1/embeddings', { method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: config.model, input: texts, dimensions: config.dimensions, encoding_format: 'float' }) });
    if (!response.ok) throw Object.assign(new Error(`embedding_failed_${response.status}`), { code: 'embedding_failed' });
    const body = await response.json();
    body.data.forEach((item, index) => vectors.set(texts[index], item.embedding));
    await fs.writeFile(vectorFile, JSON.stringify(Object.fromEntries(vectors)));
    console.error(JSON.stringify({ embedded: texts.length, tokens: body.usage?.total_tokens ?? null }));
  }

  const spaced = text => text.replace(/\s+/gu, ' ');
  const rows = [];
  for (const question of catalogue.questions) {
    for (const [arm, profileId] of Object.entries(GRAPH_EXPERIMENT_PROFILES)) {
      const profile = retrievalProfile(profileId);
      assertProfileGeneration(profile, generation);
      const query = queryForProfile(profile, { text: question.text, language: 'et', generation_id: generation.id });
      if (question.queries.length) query.variants = question.queries;
      const started = performance.now();
      const packet = await retrieve({ postgres, qdrant, policy, context, query, allowLexicalFallback: false,
        embedding: { config: generation.config.embedding, source: 'persisted_vectors', embed: async text => vectors.get(text) } });
      const ms = Math.round(performance.now() - started);
      if (['error', 'degraded'].includes(packet.state)) throw Object.assign(new Error(packet.error || 'retrieval_failed'), { code: 'retrieval_failed' });
      const evidence = packet.evidence || [], texts = evidence.map(entry => spaced(entry.source_text));
      const cards = spaced(JSON.stringify(packet.dependency_context || {}));
      const found = question.evidence_text.map(phrase => ({ phrase, in_evidence: texts.some(text => text.includes(spaced(phrase))),
        in_cards: cards.includes(spaced(phrase)) }));
      const reasons = {};
      for (const entry of evidence) { const type = entry.selection.reason?.type || entry.selection.reason; reasons[type] = (reasons[type] || 0) + 1; }
      rows.push({ question: question.id, kind: question.kind, arm, profile: profileId, ms, found,
        found_all: found.every(item => item.in_evidence), found_any: found.some(item => item.in_evidence),
        sources: evidence.length, reasons, context_tokens: packet.measurements?.context_tokens ?? null,
        additions: evidence.filter(entry => (entry.selection.reason?.type || entry.selection.reason) !== 'ranked_seed')
          .map(entry => ({ title: entry.bibliography?.title || '', reason: entry.selection.reason?.type || entry.selection.reason,
            ...(entry.selection.reason?.section ? { section: entry.selection.reason.section } : {}) })),
        cross_references: packet.measurements?.cross_references ?? null });
    }
  }
  const summary = {};
  for (const arm of Object.keys(GRAPH_EXPERIMENT_PROFILES)) {
    const own = rows.filter(row => row.arm === arm);
    summary[arm] = { profile: GRAPH_EXPERIMENT_PROFILES[arm], questions: own.length, found_all: own.filter(row => row.found_all).length,
      found_any: own.filter(row => row.found_any).length,
      within_document: own.filter(row => row.kind === 'within_document' && row.found_all).length,
      across_documents: own.filter(row => row.kind === 'across_documents' && row.found_all).length,
      mean_sources: +(own.reduce((n, row) => n + row.sources, 0) / own.length).toFixed(2),
      mean_context_tokens: Math.round(own.reduce((n, row) => n + (row.context_tokens || 0), 0) / own.length),
      median_ms: own.map(row => row.ms).sort((a, b) => a - b)[Math.floor(own.length / 2)] };
  }
  const report = { schema_version: 'rag-v2/graph-experiment-1', generation: generation.id, date: catalogue.date, catalogue: cataloguePath,
    eligible_documents: eligible.length, excluded_legal_versions: legal.excluded.length, summary, rows };
  await fs.writeFile(path.join(out, 'graph-experiment.json'), JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ ok: true, summary }, null, 1));
} finally { await postgres.close?.(); }
