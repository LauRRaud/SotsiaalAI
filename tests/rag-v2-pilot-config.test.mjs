import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readPilotConfig } from '../lib/rag-v2/pilot/config.js';
import { embeddingConfig } from '../lib/rag-v2/search/embedding.js';
import { implementationManifest } from '../lib/rag-v2/pilot/provenance.js';
import { PROMPT_VERSION, QUESTION_VERSION, digest } from '../lib/rag-v2/pilot/contracts.js';
import { EVIDENCE_DRAFT_SCHEMA, EVIDENCE_DRAFT_PROMPT } from '../lib/rag-v2/pilot/evidence-draft.js';

test('pilot switch, per-user grant, expiry, real-model config and approval gates fail closed despite key presence', async t => {
  const original = { ...process.env };
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'm4-config-'));
  const file = path.join(dir, 'config.json');
  t.after(async () => { await fs.unlink(file); await fs.rmdir(dir); for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key]; Object.assign(process.env, original); });
  process.env.M4_PILOT_CONFIG = file; process.env.NODE_ENV = 'development'; process.env.OPENAI_API_KEY = 'synthetic-present-key';
  const config = { id: 'test-pilot', mode: 'test', users: ['tester'], tenant: 'test', usage: 'development_only', expiresAt: new Date(Date.now() + 3600000).toISOString(),
    retentionHours: 1, timeoutMs: 1000, documents: { doc: 'version' }, budget: { attempts: 4, embeddingAttempts: 8, answerAttempts: 8, tokens: 10000, nanoUsd: 0 }, profileId: 'vector-ranked-first-v1', embedding: embeddingConfig() };
  await fs.writeFile(file, JSON.stringify(config));
  delete process.env.M4_PILOT_ENABLED;
  await assert.rejects(readPilotConfig('tester'), { code: 'pilot_disabled' });
  process.env.M4_PILOT_ENABLED = '1';
  await assert.rejects(readPilotConfig('other-admin'), { code: 'pilot_access_denied' });
  assert.equal((await readPilotConfig('tester')).mode, 'test');
  await fs.writeFile(file, JSON.stringify({ ...config, expiresAt: '2000-01-01' }));
  await assert.rejects(readPilotConfig('tester'), { code: 'not_configured' });
  await fs.writeFile(file, JSON.stringify({ ...config, mode: 'real' }));
  await assert.rejects(readPilotConfig('tester'), { code: 'not_configured' });
  process.env.OPENAI_MODEL = 'gpt-5.6-luna';
  const real = { ...config, mode: 'real', model: process.env.OPENAI_MODEL, accountProject: 'proj_synthetic', endpoint: 'https://api.openai.com/v1/responses',
    modelContract: 'responses-strict-reasoning-v1', maxInputTokens: 64000, maxOutputTokens: 2048, reasoning: 'low', generationId: 'synthetic-generation',
    promptVersion: PROMPT_VERSION, questionVersion: QUESTION_VERSION, implementationHash: (await implementationManifest()).hash,
    embedding: embeddingConfig({ embedding_mode: 'real', provider: 'openai', model: 'text-embedding-3-large', dimensions: 3072, endpoint: 'https://api.openai.com/v1/embeddings' }),
    prices: { embeddingInput: 130, answerInput: 250, answerOutput: 1200 }, questionPolicy: { mode: 'locked', inputs: [{ question: 'Sünteetiline', contextMode: 'new', language: 'et' }] } };
  await fs.writeFile(file, JSON.stringify(real));
  await assert.rejects(readPilotConfig('tester'), { code: 'pilot_approval_required' });
  const approved = { ...real, approval: { approvedBy: 'synthetic-unit-test', approvedAt: new Date().toISOString(), planHash: digest(real), queryAndSourceEgress: true, dynamicQuestions: false } };
  await fs.writeFile(file, JSON.stringify(approved));
  assert.equal((await readPilotConfig('tester')).mode, 'real'); // Configuration only: no service/transport invocation.
  const noDeadline = { ...real, expiresAt: null, retentionHours: null };
  await fs.writeFile(file, JSON.stringify({ ...noDeadline, approval: approved.approval }));
  await assert.rejects(readPilotConfig('tester'), { code: 'pilot_approval_required' });
  await fs.writeFile(file, JSON.stringify({ ...noDeadline, approval: { ...approved.approval, planHash: digest(noDeadline) } }));
  assert.equal((await readPilotConfig('tester')).expiresAt, null);
  await fs.writeFile(file, JSON.stringify({ ...noDeadline, expiresAt: undefined }));
  await assert.rejects(readPilotConfig('tester'), { code: 'not_configured' });
  const candidate = { ...real, evidenceDraftVersion: 'm4-evidence-draft-1', evidenceDraftSchemaHash: digest(EVIDENCE_DRAFT_SCHEMA), evidenceDraftPromptVersion: EVIDENCE_DRAFT_PROMPT };
  await fs.writeFile(file, JSON.stringify({ ...candidate, approval: approved.approval }));
  await assert.rejects(readPilotConfig('tester'), { code: 'pilot_approval_required' });
  await fs.writeFile(file, JSON.stringify({ ...candidate, approval: { ...approved.approval, planHash: digest(candidate) } }));
  assert.equal((await readPilotConfig('tester')).evidenceDraftVersion, 'm4-evidence-draft-1');
  await fs.writeFile(file, JSON.stringify({ ...candidate, evidenceDraftSchemaHash: 'old' }));
  await assert.rejects(readPilotConfig('tester'), { code: 'evidence_draft_approval_mismatch' });
  const reusePlan = { ...real, budget: { ...real.budget, embeddingAttempts: 0 }, queryReuse: { pilotId: 'prior-pilot', configHash: 'a'.repeat(64),
    expiresAt: real.expiresAt, entries: [{ turnId: 'prior-turn', queryHash: 'b'.repeat(64), vectorHash: 'c'.repeat(64), embeddingBodyHash: 'd'.repeat(64) }] } };
  await fs.writeFile(file, JSON.stringify(reusePlan));
  await assert.rejects(readPilotConfig('tester'), { code: 'pilot_approval_required' });
  const reuseApproved = { ...reusePlan, approval: { ...approved.approval, planHash: digest(reusePlan) } };
  await fs.writeFile(file, JSON.stringify(reuseApproved));
  assert.equal((await readPilotConfig('tester')).budget.embeddingAttempts, 0);
  await fs.writeFile(file, JSON.stringify({ ...reuseApproved, queryReuse: { ...reusePlan.queryReuse, entries: [{ ...reusePlan.queryReuse.entries[0], vectorHash: 'forged' }] } }));
  await assert.rejects(readPilotConfig('tester'), { code: 'invalid_query_reuse_plan' });
  const historicalPlan = { ...real, promptVersion: 'm4-grounded-answer-1', implementationHash: 'historical-immutable-code' };
  const historical = { ...historicalPlan, approval: { ...approved.approval, planHash: digest(historicalPlan) } };
  await fs.writeFile(file, JSON.stringify(historical));
  assert.equal((await readPilotConfig('tester', { purpose: 'read' })).configHash, digest(historical));
  await assert.rejects(readPilotConfig('tester'), { code: 'implementation_approval_mismatch' });
  const historicalV2Plan = { ...historicalPlan, promptVersion: 'm4-grounded-answer-2' };
  const historicalV2 = { ...historicalV2Plan, approval: { ...approved.approval, planHash: digest(historicalV2Plan) } };
  await fs.writeFile(file, JSON.stringify(historicalV2));
  assert.equal((await readPilotConfig('tester', { purpose: 'read' })).configHash, digest(historicalV2));
  await assert.rejects(readPilotConfig('tester'), { code: 'implementation_approval_mismatch' });
  await fs.writeFile(file, JSON.stringify({ ...historical, documents: { forged: 'v2' } }));
  await assert.rejects(readPilotConfig('tester', { purpose: 'read' }), { code: 'pilot_approval_required' });
  await fs.writeFile(file, JSON.stringify({ ...approved, prices: null }));
  await assert.rejects(readPilotConfig('tester'), { code: 'price_not_configured' });
  await fs.writeFile(file, JSON.stringify({ ...approved, implementationHash: 'old-code' }));
  await assert.rejects(readPilotConfig('tester'), { code: 'implementation_approval_mismatch' });
  await fs.writeFile(file, JSON.stringify({ ...approved, documents: { another: 'version' } }));
  await assert.rejects(readPilotConfig('tester'), { code: 'pilot_approval_required' });
});
