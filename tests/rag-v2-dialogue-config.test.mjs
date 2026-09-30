import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readPilotConfig } from '../lib/rag-v2/pilot/config.js';
import { embeddingConfig } from '../lib/rag-v2/search/embedding.js';
import { implementationManifest } from '../lib/rag-v2/pilot/provenance.js';
import { PROMPT_VERSION, QUESTION_VERSION, digest } from '../lib/rag-v2/pilot/contracts.js';
import { DIALOGUE_VERSION, DIALOGUE_PROMPT_VERSION, DIALOGUE_SEARCH_VERSION } from '../lib/rag-v2/pilot/dialogue.js';
import { RECORD_RETRIEVAL_VERSION } from '../lib/rag-v2/search/structured-record-source.js';
import { DIALOGUE_STATE_VERSION, DIALOGUE_ANSWER_SCHEMA, TYPED_DIALOGUE_STATE_VERSION, TYPED_DIALOGUE_ANSWER_SCHEMA, PERSON_DIALOGUE_STATE_VERSION,
  PERSON_DIALOGUE_ANSWER_SCHEMA, FACT_STATE_VERSION, REGION_STATE_VERSION, FACT_STATE_ANSWER_SCHEMA } from '../lib/rag-v2/pilot/dialogue-state.js';
import { UNIFIED_RETRIEVAL_VERSION } from '../lib/rag-v2/pilot/retrieval-plan.js';

test('M4-C approval: dialogue needs its own contract and egress grant; old v3 remains readable and fixed-packet/reuse experiments cannot activate it', async t => {
  const original = { ...process.env }, dir = await fs.mkdtemp(path.join(os.tmpdir(), 'm4c-config-')), file = path.join(dir, 'config.json');
  t.after(async () => { await fs.unlink(file); await fs.rmdir(dir); for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key]; Object.assign(process.env, original); });
  process.env.M4_PILOT_CONFIG = file; process.env.M4_PILOT_ENABLED = '1'; process.env.OPENAI_MODEL = 'gpt-6-luna'; process.env.OPENAI_API_KEY = 'synthetic-no-network';
  const base = { id: 'synthetic-dialogue-config', tenant: 'test', users: ['tester'], mode: 'real', usage: 'development_only', expiresAt: null, retentionHours: null,
    timeoutMs: 1000, documents: { doc: 'v1' }, profileId: 'vector-ranked-first-v1',
    embedding: embeddingConfig({ embedding_mode: 'real', provider: 'openai', model: 'text-embedding-3-large', dimensions: 3072, endpoint: 'https://api.openai.com/v1/embeddings' }),
    model: 'gpt-6-luna', endpoint: 'https://api.openai.com/v1/responses', accountProject: 'proj_synthetic', modelContract: 'responses-strict-reasoning-v1',
    reasoning: 'medium', maxInputTokens: 64000, maxOutputTokens: 2048, generationId: 'test-generation', implementationHash: (await implementationManifest()).hash,
    promptVersion: PROMPT_VERSION, questionVersion: QUESTION_VERSION, prices: { embeddingInput: 130, answerInput: 125, answerOutput: 500 },
    budget: { attempts: 8, embeddingAttempts: 4, answerAttempts: 4, tokens: 300000, nanoUsd: 100000000 },
    questionPolicy: { mode: 'locked', inputs: [{ question: 'Esimene', contextMode: 'new', language: 'et' }] } };
  const write = async (plan, extra = {}) => fs.writeFile(file, JSON.stringify({ ...plan, approval: { approvedBy: 'synthetic-config-test', approvedAt: new Date().toISOString(), planHash: digest(plan), queryAndSourceEgress: true, ...extra } }));
  await write(base);
  assert.equal((await readPilotConfig('tester', { purpose: 'read' })).questionVersion, QUESTION_VERSION);
  const dialogue = { ...base, dialogueVersion: DIALOGUE_VERSION, promptVersion: DIALOGUE_PROMPT_VERSION, questionVersion: DIALOGUE_SEARCH_VERSION,
    questionPolicy: { mode: 'locked', inputs: ['new', 'same', 'correction', 'new_person'].map((contextMode, i) => ({ question: `Question ${i}`, contextMode, language: ['et', 'en', 'ru', 'et'][i] })) } };
  await write(dialogue);
  await assert.rejects(readPilotConfig('tester'), { code: 'pilot_approval_required' });
  await write(dialogue, { dialogueEgress: true });
  assert.equal((await readPilotConfig('tester')).dialogueVersion, DIALOGUE_VERSION);
  const withState = { ...dialogue, dialogueStateVersion: DIALOGUE_STATE_VERSION, dialogueStateSchemaHash: digest(DIALOGUE_ANSWER_SCHEMA) };
  await write(withState, { dialogueEgress: true });
  assert.equal((await readPilotConfig('tester')).dialogueStateVersion, DIALOGUE_STATE_VERSION);
  const unified = { ...withState, dialogueStateVersion: REGION_STATE_VERSION, dialogueStateSchemaHash: digest(FACT_STATE_ANSWER_SCHEMA),
    retrievalRouting: UNIFIED_RETRIEVAL_VERSION, recordCatalogue: RECORD_RETRIEVAL_VERSION };
  await write(unified, { dialogueEgress: true });
  assert.equal((await readPilotConfig('tester')).retrievalRouting, UNIFIED_RETRIEVAL_VERSION);
  // ADR-049, ADR-051, Codex J1-J3: a unified plan with the typed state v2, v3 or v4 restores its turns but cannot start a new model call.
  for (const [version, schema] of [[TYPED_DIALOGUE_STATE_VERSION, TYPED_DIALOGUE_ANSWER_SCHEMA], [PERSON_DIALOGUE_STATE_VERSION, PERSON_DIALOGUE_ANSWER_SCHEMA],
    [FACT_STATE_VERSION, FACT_STATE_ANSWER_SCHEMA]]) {
    await write({ ...unified, dialogueStateVersion: version, dialogueStateSchemaHash: digest(schema) }, { dialogueEgress: true });
    assert.equal((await readPilotConfig('tester', { purpose: 'read' })).dialogueStateVersion, version);
    await assert.rejects(readPilotConfig('tester'), { code: 'invalid_unified_retrieval_plan' });
  }
  for (const change of [{ recordCatalogue: undefined }, { dialogueStateVersion: undefined },
    { budget: { ...unified.budget, embeddingAttempts: 0 } }, { mode: 'test' }]) {
    await write({ ...unified, ...change }, { dialogueEgress: true });
    await assert.rejects(readPilotConfig('tester'), { code: 'invalid_unified_retrieval_plan' });
  }
  // A historical v1 catalogue plan restores history but cannot start a new model call.
  await write({ ...unified, recordCatalogue: 'rag-v2/record-catalogue-1' }, { dialogueEgress: true });
  assert.equal((await readPilotConfig('tester', { purpose: 'read' })).recordCatalogue, 'rag-v2/record-catalogue-1');
  await assert.rejects(readPilotConfig('tester'), { code: 'invalid_unified_retrieval_plan' });
  await write({ ...unified, retrievalRouting: 'unknown' }, { dialogueEgress: true });
  await assert.rejects(readPilotConfig('tester'), { code: 'unsupported_retrieval_routing' });
  await write({ ...dialogue, promptVersion: 'm4-grounded-dialogue-5', questionVersion: 'm4-user-scope-search-4' }, { dialogueEgress: true });
  assert.equal((await readPilotConfig('tester', { purpose: 'read' })).promptVersion, 'm4-grounded-dialogue-5');
  await assert.rejects(readPilotConfig('tester'), { code: 'implementation_approval_mismatch' });
  for (const change of [{ dialogueVersion: undefined }, { dialogueStateSchemaHash: 'wrong' }, { dialogueStateSchemaHash: undefined }]) {
    await write({ ...withState, ...change }, { dialogueEgress: true });
    await assert.rejects(readPilotConfig('tester'), { code: 'invalid_dialogue_state_plan' });
  }
  await write({ ...withState, dialogueStateVersion: 'unknown' }, { dialogueEgress: true });
  await assert.rejects(readPilotConfig('tester'), { code: 'unsupported_dialogue_state_version' });
  await write({ ...dialogue, promptVersion: 'm4-grounded-dialogue-4', questionVersion: 'm4-user-scope-search-3' }, { dialogueEgress: true });
  assert.equal((await readPilotConfig('tester', { purpose: 'read' })).promptVersion, 'm4-grounded-dialogue-4');
  await assert.rejects(readPilotConfig('tester'), { code: 'implementation_approval_mismatch' });
  await write({ ...dialogue, recordCatalogue: RECORD_RETRIEVAL_VERSION, budget: { ...dialogue.budget, embeddingAttempts: 0 } }, { dialogueEgress: true });
  assert.equal((await readPilotConfig('tester')).recordCatalogue, RECORD_RETRIEVAL_VERSION);
  await write({ ...dialogue, recordCatalogue: 'rag-v2/record-catalogue-1', budget: { ...dialogue.budget, embeddingAttempts: 0 } }, { dialogueEgress: true });
  assert.equal((await readPilotConfig('tester', { purpose: 'read' })).recordCatalogue, 'rag-v2/record-catalogue-1');
  await assert.rejects(readPilotConfig('tester'), { code: 'invalid_record_catalogue_plan' });
  await write({ ...dialogue, recordCatalogue: 'unknown' }, { dialogueEgress: true });
  await assert.rejects(readPilotConfig('tester', { purpose: 'read' }), { code: 'invalid_record_catalogue_plan' });
  await write({ ...base, recordCatalogue: RECORD_RETRIEVAL_VERSION });
  await assert.rejects(readPilotConfig('tester'), { code: 'invalid_record_catalogue_plan' });
  await write({ ...dialogue, promptVersion: 'm4-grounded-dialogue-3', questionVersion: 'm4-user-scope-search-2' }, { dialogueEgress: true });
  assert.equal((await readPilotConfig('tester', { purpose: 'read' })).questionVersion, 'm4-user-scope-search-2');
  await assert.rejects(readPilotConfig('tester'), { code: 'implementation_approval_mismatch' });
  await write({ ...dialogue, questionVersion: 'm4-user-scope-search-1' }, { dialogueEgress: true });
  assert.equal((await readPilotConfig('tester', { purpose: 'read' })).questionVersion, 'm4-user-scope-search-1');
  await assert.rejects(readPilotConfig('tester'), { code: 'implementation_approval_mismatch' });
  // A new prompt may read still-authorized old turns, never execute an old grant.
  await write({ ...dialogue, promptVersion: 'm4-grounded-dialogue-1' }, { dialogueEgress: true });
  assert.equal((await readPilotConfig('tester', { purpose: 'read' })).promptVersion, 'm4-grounded-dialogue-1');
  await assert.rejects(readPilotConfig('tester'), { code: 'implementation_approval_mismatch' });
  await write({ ...base, promptVersion: 'm4-grounded-answer-3' });
  assert.equal((await readPilotConfig('tester', { purpose: 'read' })).promptVersion, 'm4-grounded-answer-3');
  await assert.rejects(readPilotConfig('tester'), { code: 'implementation_approval_mismatch' });
  for (const change of [{ promptVersion: PROMPT_VERSION }, { questionVersion: QUESTION_VERSION }, { implementationHash: 'old' }]) {
    await write({ ...dialogue, ...change }, { dialogueEgress: true });
    await assert.rejects(readPilotConfig('tester'), { code: 'implementation_approval_mismatch' });
  }
  for (const change of [{ fixedPacketFile: 'unused' }, { queryReuse: {} }, { evidenceDraftVersion: 'm4-evidence-draft-1' }]) {
    await write({ ...dialogue, ...change }, { dialogueEgress: true });
    await assert.rejects(readPilotConfig('tester'), { code: 'incompatible_dialogue_plan' });
  }
  await write({ ...dialogue, dialogueVersion: 'unknown' }, { dialogueEgress: true });
  await assert.rejects(readPilotConfig('tester'), { code: 'unsupported_dialogue_version' });
});

test('an open development chat: search assist needs the unified route; attempt caps rise only for dynamic questions', async t => {
  const original = { ...process.env }, dir = await fs.mkdtemp(path.join(os.tmpdir(), 'm4-assist-')), file = path.join(dir, 'config.json');
  t.after(async () => { await fs.unlink(file); await fs.rmdir(dir); for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key]; Object.assign(process.env, original); });
  process.env.M4_PILOT_CONFIG = file; process.env.M4_PILOT_ENABLED = '1'; process.env.OPENAI_MODEL = 'gpt-6-luna'; process.env.OPENAI_API_KEY = 'synthetic-no-network';
  const { SEARCH_ASSIST_VERSION } = await import('../lib/rag-v2/pilot/search-assist.js');
  const unified = { id: 'synthetic-open-chat', tenant: 'test', users: ['tester'], mode: 'real', usage: 'development_only', expiresAt: null, retentionHours: null,
    timeoutMs: 1000, documents: { doc: 'v1' }, profileId: 'hybrid-estnltk-chat-v1',
    embedding: embeddingConfig({ embedding_mode: 'real', provider: 'openai', model: 'text-embedding-3-large', dimensions: 3072, endpoint: 'https://api.openai.com/v1/embeddings' }),
    model: 'gpt-6-luna', endpoint: 'https://api.openai.com/v1/responses', accountProject: 'proj_synthetic', modelContract: 'responses-strict-reasoning-v1',
    reasoning: 'medium', maxInputTokens: 300000, maxOutputTokens: 4096, generationId: 'test-generation', implementationHash: (await implementationManifest()).hash,
    dialogueVersion: DIALOGUE_VERSION, promptVersion: DIALOGUE_PROMPT_VERSION, questionVersion: DIALOGUE_SEARCH_VERSION,
    dialogueStateVersion: REGION_STATE_VERSION, dialogueStateSchemaHash: digest(FACT_STATE_ANSWER_SCHEMA),
    retrievalRouting: UNIFIED_RETRIEVAL_VERSION, recordCatalogue: RECORD_RETRIEVAL_VERSION, searchAssist: SEARCH_ASSIST_VERSION,
    prices: { embeddingInput: 130, answerInput: 125, answerOutput: 500 }, questionPolicy: { mode: 'bounded_dynamic' },
    budget: { attempts: 4000, embeddingAttempts: 2000, answerAttempts: 2000, tokens: 400000000, nanoUsd: 3000000000 } };
  const write = async plan => fs.writeFile(file, JSON.stringify({ ...plan, approval: { approvedBy: 'synthetic-config-test', approvedAt: new Date().toISOString(),
    planHash: digest(plan), queryAndSourceEgress: true, dialogueEgress: true, dynamicQuestions: true } }));
  await write(unified);
  assert.equal((await readPilotConfig('tester')).searchAssist, SEARCH_ASSIST_VERSION);
  const { retrievalRouting: _routing, recordCatalogue: _catalogue, ...withoutRoute } = unified;
  await write(withoutRoute);
  await assert.rejects(readPilotConfig('tester'), { code: 'invalid_search_assist_plan' });
  await write({ ...unified, searchAssist: 'rag-v2/search-assist-0' });
  await assert.rejects(readPilotConfig('tester'), { code: 'unsupported_search_assist' });
  // A fixed-question run keeps its small attempt caps.
  await write({ ...unified, questionPolicy: { mode: 'locked', inputs: [{ question: 'Q', contextMode: 'new', language: 'et' }] } });
  await assert.rejects(readPilotConfig('tester'), { code: 'stage_budget_not_configured' });
});
