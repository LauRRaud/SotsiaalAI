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

test('M4-C approval: dialogue needs its own contract and egress grant; old v3 remains readable and fixed-packet/reuse experiments cannot activate it', async t => {
  const original = { ...process.env }, dir = await fs.mkdtemp(path.join(os.tmpdir(), 'm4c-config-')), file = path.join(dir, 'config.json');
  t.after(async () => { await fs.unlink(file); await fs.rmdir(dir); for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key]; Object.assign(process.env, original); });
  process.env.M4_PILOT_CONFIG = file; process.env.M4_PILOT_ENABLED = '1'; process.env.OPENAI_MODEL = 'gpt-5.6-luna'; process.env.OPENAI_API_KEY = 'synthetic-no-network';
  const base = { id: 'synthetic-dialogue-config', tenant: 'test', users: ['tester'], mode: 'real', usage: 'development_only', expiresAt: null, retentionHours: null,
    timeoutMs: 1000, documents: { doc: 'v1' }, profileId: 'vector-ranked-first-v1',
    embedding: embeddingConfig({ embedding_mode: 'real', provider: 'openai', model: 'text-embedding-3-large', dimensions: 3072, endpoint: 'https://api.openai.com/v1/embeddings' }),
    model: 'gpt-5.6-luna', endpoint: 'https://api.openai.com/v1/responses', accountProject: 'proj_synthetic', modelContract: 'responses-strict-reasoning-v1',
    reasoning: 'low', maxInputTokens: 64000, maxOutputTokens: 2048, generationId: 'test-generation', implementationHash: (await implementationManifest()).hash,
    promptVersion: PROMPT_VERSION, questionVersion: QUESTION_VERSION, prices: { embeddingInput: 130, answerInput: 250, answerOutput: 1200 },
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
