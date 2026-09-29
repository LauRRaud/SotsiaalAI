#!/usr/bin/env node
// Coverage of conditions and exceptions in the chat's own retrieval (ADR-054). Each question's evidence packet is read
// for the exact text its answer depends on; run once on the index without knowledge cards and once with them. Only the
// question is embedded (one small call per question); no search plan, rerank or answer, so the graph is the only
// difference between the two runs. Needs the plan in M4_PILOT_CONFIG to be the tenant's active generation.
//   M4_PILOT_CONFIG=<plan> node --env-file=... scripts/rag-v2-knowledge-coverage.mjs --questions tests/evaluation/knowledge/coverage-1.json --out <file>
import fs from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { hash } from '../lib/rag-v2/contracts.js';

const { values } = parseArgs({ options: { questions: { type: 'string' }, out: { type: 'string' } } });
if (!values.questions || !values.out) { console.error('usage: --questions <file> --out <file>'); process.exit(1); }
const { default: prisma } = await import('../lib/prisma.js');
const { readPilotConfig } = await import('../lib/rag-v2/pilot/config.js');
const { runtimeAdapters } = await import('../lib/rag-v2/pilot/retrieval.js');
const { municipalDirectoryAdapter } = await import('../lib/rag-v2/adapters/municipal-directory.js');
const { providerCall } = await import('../lib/rag-v2/pilot/provider.js');

const plan = JSON.parse(await fs.readFile(process.env.M4_PILOT_CONFIG, 'utf8')), userId = plan.users[0];
const readConfig = options => readPilotConfig(userId, options);
const config = await readConfig({ purpose: 'read' }), adapters = runtimeAdapters(readConfig, userId, municipalDirectoryAdapter(prisma));
const catalogue = JSON.parse(await fs.readFile(values.questions, 'utf8'));
const norm = text => text.replace(/\s+/gu, ' ');
const reasonOf = evidence => (typeof evidence.selection?.reason === 'string' ? evidence.selection.reason : evidence.selection?.reason?.type ?? 'unknown');
const report = { schema_version: 'rag-v2/knowledge-coverage-report-1', plan: config.id, generation: config.generationId, questions: [] };
try {
  for (const item of catalogue.questions) {
    const body = { input: item.text, model: config.embedding.model, dimensions: config.embedding.dimensions, encoding_format: 'float' };
    const embedded = await providerCall({ stage: 'embedding', body, config: { ...config, mode: 'real' }, apiKey: process.env.OPENAI_API_KEY });
    // The query a first chat message makes (buildDialogueQuery), without the search plan's queries or places.
    const query = { text: item.text, question: item.text, language: 'et', hash: hash(item.text), strictFilters: {},
      scopeTurns: [{ turnId: `coverage-${item.id}`, text: item.text, mode: 'new' }], previousState: null, recordFocus: [] };
    const packet = await adapters.search(config, query, embedded.value, null);
    const evidence = packet.evidence || [];
    const holding = evidence.filter(entry => norm(entry.source_text).includes(norm(item.expect)));
    const reasons = evidence.reduce((counts, entry) => { const reason = reasonOf(entry); counts[reason] = (counts[reason] || 0) + 1; return counts; }, {});
    // What the graph did: the claims and relations it put in the context, and why it stopped where it did.
    const graph = packet.dependency_context || null;
    const unresolved = (graph?.unresolved || []).reduce((counts, entry) => { counts[entry.reason] = (counts[entry.reason] || 0) + 1; return counts; }, {});
    report.questions.push({ id: item.id, found: holding.length > 0, found_by: holding.map(reasonOf), evidence: evidence.length, reasons,
      dependency_titles: evidence.filter(entry => reasonOf(entry) === 'semantic_dependency').map(entry => entry.bibliography?.title || ''),
      graph: graph ? { claims: graph.claims?.length ?? 0, relations: graph.relations?.length ?? 0, known_context: graph.known_context, unresolved } : null });
    console.log(JSON.stringify(report.questions.at(-1)));
  }
  report.summary = { found: report.questions.filter(q => q.found).length, of: report.questions.length,
    by_dependency: report.questions.filter(q => q.found_by.includes('semantic_dependency')).length,
    dependency_additions: report.questions.reduce((n, q) => n + (q.reasons.semantic_dependency || 0), 0) };
  await fs.writeFile(values.out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report.summary));
} finally { await prisma.$disconnect(); }
