import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { registeredSource } from '../lib/rag-v2/registered-source.js';
import { IngestBatchQueue } from '../lib/rag-v2/ingest-batch-postgres.js';
import { planIngestBatch, prepareNextBatchItem } from '../lib/rag-v2/ingest-batch.js';
import { createBatchReview, publishReviewedBatch } from '../lib/rag-v2/ingest-publication.js';
import { loadSnapshot } from '../lib/rag-v2/search/snapshot.js';
import { indexSnapshot } from '../lib/rag-v2/search/indexing.js';
import { QdrantIndex } from '../lib/rag-v2/search/qdrant.js';
import { embeddingConfig, OPENAI_EMBEDDING_ENDPOINT } from '../lib/rag-v2/search/embedding.js';
import { ESTNLTK_LEXICAL } from '../lib/rag-v2/search/morphology.js';
import { retrievalProfile } from '../lib/rag-v2/search/profiles.js';
import { RECORD_RETRIEVAL_VERSION } from '../lib/rag-v2/search/structured-record-source.js';
import { runtimeAdapters } from '../lib/rag-v2/pilot/retrieval.js';
import { DIALOGUE_VERSION } from '../lib/rag-v2/pilot/dialogue.js';
import { TYPED_DIALOGUE_STATE_VERSION, projectDialogueAnswer } from '../lib/rag-v2/pilot/dialogue-state.js';
import { UNIFIED_RETRIEVAL_VERSION } from '../lib/rag-v2/pilot/retrieval-plan.js';
import { PilotService } from '../lib/rag-v2/pilot/service.js';
import { PilotStore } from '../lib/rag-v2/pilot/store.js';
import { pilotChatResult } from '../lib/chat/m4PilotClientContract.js';
import { providerCall } from '../lib/rag-v2/pilot/provider.js';

// Real pilot service on the unified route over real municipal packages and real service vectors
// (bought once, tmp/rag-v2-scenarios). By default only the answer model is a stand-in, so this checks
// what reaches the model at each turn, not answer quality; no network except local services.
// SCENARIO_ANSWER_MODEL=gpt-6-luna (with OPENAI_API_KEY and SCENARIO_ACCOUNT_PROJECT) makes paid real
// calls instead: real query embeddings and real answers, reported per turn, capped by the budget below.
const REAL_MODEL = process.env.SCENARIO_ANSWER_MODEL || null;
if (REAL_MODEL && (!process.env.OPENAI_API_KEY || !/^proj_[A-Za-z0-9_-]+$/.test(process.env.SCENARIO_ACCOUNT_PROJECT || ''))) throw Error('real scenario run needs OPENAI_API_KEY and SCENARIO_ACCOUNT_PROJECT');
const appUrl = new URL(process.env.M4_TEST_DATABASE_URL || 'postgres://invalid/invalid');
if (!['localhost', '127.0.0.1'].includes(appUrl.hostname) || appUrl.pathname !== '/sotsiaal_ai_m4_dev') throw Error('isolated app database required');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: appUrl.href }), log: [] });
const scenarios = JSON.parse(await fs.readFile('tests/evaluation/dialogue/scenarios-1.json', 'utf8'));
const DATA = 'tmp/rag-v2-scenarios', tenant = `scenarios-${randomUUID()}`;
const embedding = embeddingConfig({ embedding_mode: 'real', provider: 'openai', model: 'text-embedding-3-large', dimensions: 3072, endpoint: OPENAI_EMBEDDING_ENDPOINT });
const savedEnv = { RAG_V2_QDRANT_URL: process.env.RAG_V2_QDRANT_URL, RAG_V2_QDRANT_KEY: process.env.RAG_V2_QDRANT_KEY };
const decode = b64 => { const buf = Buffer.from(b64, 'base64'); return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4); };
let root, postgres, qdrant, snapshot, generation, connections;
const unitVectors = new Map(), queryVectors = new Map(), report = [];

before(async () => {
  // On the server the RAG services come from the service environment; locally from tmp/rag-v2-services.
  connections = process.env.RAG_V2_POSTGRES_URL && process.env.RAG_V2_QDRANT_URL
    ? { postgresUrl: process.env.RAG_V2_POSTGRES_URL, qdrantUrl: process.env.RAG_V2_QDRANT_URL, qdrantKey: process.env.RAG_V2_QDRANT_KEY }
    : JSON.parse(await fs.readFile('tmp/rag-v2-services/connections.json', 'utf8'));
  process.env.RAG_V2_QDRANT_URL = connections.qdrantUrl; process.env.RAG_V2_QDRANT_KEY = connections.qdrantKey || '';
  const inputs = JSON.parse(await fs.readFile(`${DATA}/kov-unit-inputs.json`, 'utf8')).input;
  for (const line of (await fs.readFile(`${DATA}/kov-unit-vectors.ndjson`, 'utf8')).trim().split('\n').map(JSON.parse)) {
    line.embeddings.forEach((b64, i) => unitVectors.set(inputs[line.offset + i], decode(b64)));
  }
  const queries = JSON.parse(await fs.readFile(`${DATA}/situation-query-inputs.json`, 'utf8')).input;
  JSON.parse(await fs.readFile(`${DATA}/situation-query-vectors.json`, 'utf8')).vectors.forEach((vector, i) => queryVectors.set(queries[i], vector));
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-scenarios-'));
  postgres = new IngestBatchQueue(connections.postgresUrl); qdrant = new QdrantIndex(connections.qdrantUrl, connections.qdrantKey);
  const register = JSON.parse(await fs.readFile('Andmebaasi/REGISTER.json', 'utf8')), sources = [];
  for (const kov of scenarios.municipalities) {
    const entry = register.entries.find(e => e.path === `KOV/${kov}/${kov}.json` && e.role === 'source');
    const pkg = JSON.parse(await fs.readFile(`Andmebaasi/${entry.path}`, 'utf8'));
    for (const item of pkg.items) sources.push(await registeredSource('Andmebaasi', entry, { itemId: item.id }));
  }
  const profile = JSON.parse(await fs.readFile('lib/rag-v2/domain-profiles/sotsiaalai.json', 'utf8'));
  const plan = await planIngestBatch({ tenant, inputRoot: 'Andmebaasi', inputs: sources, rights: { access: 'local_private', usage: 'development_only' }, profile });
  await postgres.enqueue(plan);
  const options = { tenant, inputRoot: 'Andmebaasi', storeRoot: path.join(root, 'store'), queue: postgres, batchId: plan.id };
  while (await prepareNextBatchItem(options)) { /* real municipal packages */ }
  const review = await createBatchReview(options);
  // A reviewer cannot include a record with a metadata conflict; it is excluded and reported, as in real review.
  review.reviewed_by = 'scenario-reviewer';
  for (const item of review.items) Object.assign(item, item.blockers.length
    ? { decision: 'exclude', note: 'Blocked in review: ' + item.warnings.filter(w => w.code.endsWith('_conflict')).map(w => w.detail || w.code).join(', ') }
    : { decision: 'include', note: 'Real public municipal package; local scenario index only.' });
  const blocked = review.items.filter(item => item.decision === 'exclude');
  report.push('Review: ' + (review.items.length - blocked.length) + '/' + review.items.length + ' records included; excluded for metadata conflicts: '
    + (blocked.map(item => (item.fields?.title?.value || item.document_id) + ' [' + item.note.replace('Blocked in review: ', '') + ']').join('; ') || 'none'));
  await publishReviewedBatch({ ...options, review });
  snapshot = await loadSnapshot(options.storeRoot, tenant, review.items.filter(item => item.decision === 'include').map(item => item.document_id));
  // Stored real vectors only: a unit without one fails the index instead of mixing vector spaces.
  const stored = { config: embedding, source: 'persisted_vectors', calls: 0,
    async embed(text) { const vector = unitVectors.get(text); if (!vector) throw Error('scenario_unit_vector_missing'); return Array.from(vector); } };
  await indexSnapshot({ snapshot, postgres, qdrant, embedding: stored, lexical: ESTNLTK_LEXICAL });
  generation = await postgres.active(tenant);
});

after(async () => {
  try {
    if (generation) await qdrant.request(`/collections/${generation.collection}`, 'DELETE');
    for (const table of ['rag_v2_ingest_item', 'rag_v2_ingest_batch', 'rag_v2_unit', 'rag_v2_generation_document', 'rag_v2_head',
      'rag_v2_generation', 'rag_v2_object', 'rag_v2_version', 'rag_v2_document', 'rag_v2_vector_cache']) await postgres?.pool.query(`DELETE FROM ${table} WHERE tenant=$1`, [tenant]);
  } finally {
    await db.$disconnect(); await postgres?.close();
    for (const [key, value] of Object.entries(savedEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    if (root) await fs.rm(root, { recursive: true, force: true });
    console.log('\n' + report.join('\n'));
  }
});

const titleOf = entry => entry.fields.title?.value || entry.fields.name?.value || '';
const emptyState = () => ({ facts: [], needs: [], unknowns: [], region: { id: null, status: 'unknown', support: [] }, periods: [], language_hint: 'et' });

async function conversation(t) {
  const user = await db.user.create({ data: { email: `scenario-${randomUUID()}@example.invalid` } });
  const conv = await db.conversation.create({ data: { userId: user.id, role: 'CLIENT', metadata: { m4: true }, expiresAt: null } });
  const config = { id: randomUUID(), configHash: randomUUID(), tenant, mode: 'real', users: [user.id], generationId: generation.id,
    documents: Object.fromEntries(snapshot.bundles.map(bundle => [bundle.document.id, bundle.version.id])),
    profile: retrievalProfile(), recordCatalogue: RECORD_RETRIEVAL_VERSION, dialogueVersion: DIALOGUE_VERSION,
    dialogueStateVersion: TYPED_DIALOGUE_STATE_VERSION, retrievalRouting: UNIFIED_RETRIEVAL_VERSION,
    embedding, model: REAL_MODEL || 'scenario-stand-in', reasoning: 'medium', maxInputTokens: 128000, maxOutputTokens: 4096,
    retentionHours: null, expiresAt: null, timeoutMs: 60000, accountProject: process.env.SCENARIO_ACCOUNT_PROJECT,
    // Real runs use the server pilot's approved prices (nano-USD per token) and a 1 USD cap per conversation.
    prices: REAL_MODEL ? { embeddingInput: 130, answerInput: 125, answerOutput: 500 } : { embeddingInput: 1, answerInput: 1, answerOutput: 1 },
    budget: { attempts: 40, embeddingAttempts: 20, answerAttempts: 20, tokens: 10000000, nanoUsd: REAL_MODEL ? 1000000000 : 100000000 } };
  t.after(async () => { await db.user.delete({ where: { id: user.id } }); await db.m4PilotLedger.deleteMany({ where: { id: config.id } }); });
  class Catalog extends IngestBatchQueue { constructor() { super(connections.postgresUrl); } }
  // Stand-in for the municipal contact registry: every published contact counts as verified here.
  const adapters = runtimeAdapters(async () => config, user.id, { Catalog, loadRegions: async () => scenarios.regions,
    authorizeContact: async ({ record }) => record.kind === 'contact' });
  let turn = null, scopeFirst = null, region = null, lastInput = null, approximated = false;
  const realCall = async args => {
    if (args.stage === 'answer') lastInput = JSON.parse(args.body.input[0].content);
    approximated = false;
    return providerCall(args);
  };
  const service = new PilotService({ store: new PilotStore(db), readConfig: async () => config, adapters, call: REAL_MODEL ? realCall : async ({ stage, body }) => {
    if (stage === 'embedding') {
      // Follow-up query texts join the scope's turns and have no bought vector: reuse the scope's first sentence.
      approximated = !queryVectors.has(body.input);
      const vector = queryVectors.get(body.input) || queryVectors.get(scopeFirst);
      if (!vector) throw Error('scenario_query_vector_missing: ' + scopeFirst);
      return { value: vector, usage: { input: 20, output: 0 } };
    }
    const input = lastInput = JSON.parse(body.input[0].content), userTurns = input.dialogue.userTurns;
    if (turn.state_region === 'clear') region = null;
    else if (turn.state_region) region = { id: turn.state_region.id, status: 'reported', support: [{ turn: userTurns.length, quote: turn.state_region.quote }] };
    const state = { ...emptyState(), ...(region ? { region } : {}) };
    const entries = input.evidence.records?.entries || [];
    const cited = turn.cite ? entries.find(entry => new RegExp(turn.cite, 'i').test(titleOf(entry)) && entry.fields.summary) : null;
    const refs = cited ? cited.fields.summary.refs : [];
    return { value: { kind: refs.length ? 'grounded' : 'clarification', blocks: refs.length ? [{ text: 'Asendusmudeli vastus.', factual: true, refs }] : [],
      limitations: [], clarification: refs.length ? null : 'Millises omavalitsuses sa elad?', dialogue_state: state },
    usage: { input: 20, output: 40 }, requestId: 'scenario-stand-in' };
  } });
  return async (scenarioTurn, index) => {
    turn = scenarioTurn;
    if (['new', 'new_person'].includes(turn.mode)) { scopeFirst = turn.text; region = null; }
    let result;
    try { result = await service.run(user.id, { question: turn.text, contextMode: turn.mode, convId: conv.id, clientTurnKey: randomUUID(), language: 'et' }); }
    catch (error) { return { index, error: error.code || 'turn_failed', input: lastInput }; } // A rejected real answer is a finding, not a crash.
    const row = await db.m4PilotTurn.findUnique({ where: { id: result.id } });
    return { index, result, row, input: lastInput, approximated, crisis: pilotChatResult(result, conv.id).isCrisis };
  };
}

for (const scenario of scenarios.scenarios) {
  test(`scenario ${scenario.id}: ${scenario.title}`, async t => {
    const run = await conversation(t), problems = [];
    report.push(`\n## ${scenario.title}`);
    for (const [index, turn] of scenario.turns.entries()) {
      const { result, row, input, approximated, crisis, error } = await run(turn, index);
      if (error) { problems.push(`turn ${index + 1}: ${error}`); report.push(`- ${index + 1}. [${turn.mode}] "${turn.text}" -> FAILED ${error}`); continue; }
      const records = input.evidence.records || {}, entries = records.entries || [], expect = turn.expect || {};
      const scope = records.scope?.region ?? null;
      const summarized = entries.filter(entry => entry.fields.summary && entry.detail !== 'selected_detail');
      // Every service the previous answer cited is a selected detail, not only the first one.
      const details = entries.filter(entry => entry.detail === 'selected_detail');
      // Contact persons come from the packages; phone/e-mail channels only from the verified municipal registry,
      // which this harness does not load (the packages carry no channels: 0 of 68 contacts in six municipalities).
      const contacts = entries.filter(entry => entry.kind === 'contact');
      const channels = contacts.filter(entry => entry.fields.phone || entry.fields.email);
      const check = (ok, message) => { if (!ok) problems.push(`turn ${index + 1}: ${message}`); };
      check(result.state === 'completed', `state ${result.state}`);
      if ('region' in expect) check(scope === expect.region, `region ${scope}, expected ${expect.region}`);
      if (expect.service_summary) check(summarized.some(entry => new RegExp(expect.service_summary, 'i').test(titleOf(entry))), `no summary for /${expect.service_summary}/`);
      if (expect.details) check(details.some(entry => new RegExp(expect.details, 'i').test(titleOf(entry))), `details for /${expect.details}/ missing`);
      if (expect.contacts) check(contacts.length > 0, 'no contact person for the focused service in context');
      if ('crisis' in expect) check(crisis === expect.crisis, `crisis ${crisis}, expected ${expect.crisis}`);
      if (expect.previous_state_cleared) check(input.dialogue.previousState === null, 'previous state leaked into the new person');
      report.push(`- ${index + 1}. [${turn.mode}] "${turn.text}" -> region ${scope ?? '-'}, catalogue ${records.listed_count ?? 0}/${records.catalogue_count ?? 0}`
        + `, summaries ${summarized.length}${details.length ? `, details: ${details.map(titleOf).join(' & ')}` : ''}${contacts.length ? `, contact persons ${contacts.map(titleOf).join(' & ')} (phone/e-mail channels ${channels.length})` : ''}`
        + `, answer ${row.payload.answer.kind}${crisis ? ', CRISIS NOTICE' : ''}${approximated ? ' (query vector approximated)' : ''}`);
      // Real runs: the model's own answer, its state and cited services, for human review.
      if (REAL_MODEL) {
        const answer = row.payload.answer, citedRefs = new Set(answer.blocks.flatMap(block => block.refs));
        const citedServices = entries.filter(entry => Object.values(entry.fields).some(field => field.refs?.some(ref => citedRefs.has(ref)))).map(titleOf);
        const text = [...answer.blocks.map(block => block.text), answer.clarification].filter(Boolean).join(' ').replace(/\s+/g, ' ');
        report.push(`     model: ${text.slice(0, 700)}${text.length > 700 ? '…' : ''}`);
        report.push(`     cites: ${citedServices.join(', ') || '-'} | state region: ${row.payload.dialogueState?.value?.region?.id ?? '-'}${row.payload.dialogueStateFallback ? ` (state fallback ${row.payload.dialogueStateFallback.code})` : ''}`);
        // A rejected state is reproduced from the stored draft (as recovery does) to name the failed check.
        if (row.payload.dialogueStateFallback) {
          const draft = JSON.parse(row.payload.responseAudit.draft.text);
          let reason = 'reproduced as valid';
          try { projectDialogueAnswer(draft, row.payload.packet, row.payload.contextAudit, row.payload.dialogueStateContext, row.payload.previousDialogueState ?? null, TYPED_DIALOGUE_STATE_VERSION); }
          catch (error) { reason = error.reason || error.code; }
          const proposed = draft.dialogue_state || {};
          report.push(`     rejected state: ${reason} | proposed region ${JSON.stringify(proposed.region ?? null)}, facts ${JSON.stringify((proposed.facts || []).map(fact => [fact.topic, fact.status, fact.support?.map(source => source.turn)]))}`);
        }
      }
    }
    report.push(problems.length ? `  PROBLEMS: ${problems.join('; ')}` : '  all expectations met');
    assert.deepEqual(problems, []);
  });
}
