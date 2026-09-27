import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { digest } from '../lib/rag-v2/pilot/contracts.js';
import { activateChatPlan, approvedChatPlan, approvedScope, codeContract, newChatPlan, preflightChatPlan, renewChatPlan,
  RELEASE_RENEWAL } from '../lib/rag-v2/pilot/chat-plan.js';

// ADR-037: a release renews the approved chat plan for its code; everything the owner approved stays the same.
const embedding = { embedding_mode: 'real', provider: 'openai', model: 'text-embedding-3-large', dimensions: 3072,
  endpoint: 'https://api.openai.com/v1/embeddings' };
const generation = { id: `search_generation_${'1'.repeat(64)}`, config: { embedding },
  snapshot: { documents: { [`document_${'a'.repeat(64)}`]: { version_id: `version_${'b'.repeat(64)}` } } } };
const now = new Date('2026-09-27T18:30:00Z');
const plan = () => newChatPlan({ generation, tenant: 'sotsiaalai-corpus', profileId: 'hybrid-estnltk-chat-v1', users: ['owner-user'],
  accountProject: 'proj_synthetic', prices: { embeddingInput: 130, answerInput: 125, answerOutput: 500 }, reasoning: 'medium',
  nanoUsd: 4e9, basis: 'Synthetic owner instruction', now });
// An approved plan made by an earlier release: other code fields, signed as the owner's request was then.
function earlier(current) {
  const { approval, ...unsigned } = current;
  const old = { ...unsigned, implementationHash: 'e'.repeat(64), promptVersion: 'm4-grounded-dialogue-10' };
  return { ...old, approval: { ...approval, planHash: digest(old) } };
}

test('a renewal keeps everything the owner approved and takes only the code fields of this release', async () => {
  const previous = earlier(await plan()), code = await codeContract();
  assert(approvedChatPlan(previous));
  const renewed = await renewChatPlan(previous, { release: 'da69c0e', now: new Date('2026-09-27T18:31:00Z') });
  assert(approvedChatPlan(renewed));
  assert.equal(approvedScope(renewed), approvedScope(previous));
  for (const [key, value] of Object.entries(code)) assert.deepEqual(renewed[key], value, key);
  assert.equal(renewed.id, 'm4-sotsiaalai-corpus-chat-20260927-1831-rda69c0e');
  assert.deepEqual(renewed.approval.renewedFrom, { id: previous.id, planHash: previous.approval.planHash });
  assert.equal(renewed.approval.authorization, RELEASE_RENEWAL);
  assert.equal(renewed.approval.approvedBy, 'owner-user');
  assert.deepEqual([renewed.approval.queryAndSourceEgress, renewed.approval.dialogueEgress, renewed.approval.dynamicQuestions], [true, true, true]);
  assert.equal(renewed.authorizationBasis.ownerInstruction, 'Synthetic owner instruction');
  assert.equal(renewed.authorizationBasis.renewal.from, previous.id);
  // A renewed plan renews again the same way.
  assert(approvedChatPlan(await renewChatPlan(renewed, { release: 'abcdef1' })));
});

test('only an approved open development plan is renewed, and only for a named release', async () => {
  const current = await plan();
  const tampered = { ...current, budget: { ...current.budget, nanoUsd: 9e9 } };
  assert.equal(approvedChatPlan(tampered), false);
  await assert.rejects(renewChatPlan(tampered, { release: 'da69c0e' }), { code: 'renewal_requires_approved_plan' });
  const resign = changes => { const { approval, ...unsigned } = { ...current, ...changes }; return { ...unsigned, approval: { ...approval, planHash: digest(unsigned) } }; };
  await assert.rejects(renewChatPlan(resign({ mode: 'test' }), { release: 'da69c0e' }), { code: 'renewal_requires_approved_plan' });
  await assert.rejects(renewChatPlan(resign({ questionPolicy: { mode: 'locked', inputs: [] } }), { release: 'da69c0e' }), { code: 'renewal_requires_approved_plan' });
  const other = resign({}); other.approval = { ...other.approval, approvedBy: 'someone-else' };
  assert.equal(approvedChatPlan(other), false);
  for (const release of [undefined, '', 'main', 'DA69C0E;rm']) await assert.rejects(renewChatPlan(current, { release }), { code: 'renewal_release_required' });
});

test('the pre-turn check runs the chat adapters on the plan; activation keeps a copy of rag.env', async () => {
  const current = await plan();
  let seen;
  await preflightChatPlan(current, (read, user) => ({ preflight: async config => { seen = { config, user, read: await read() }; } }));
  assert.equal(seen.user, 'owner-user'); assert.equal(seen.config.profile.id, 'hybrid-estnltk-chat-v1'); assert.equal(seen.config.configHash, digest(current));
  await assert.rejects(preflightChatPlan(current, () => ({ preflight: async () => { throw Object.assign(new Error('x'), { code: 'active_index_mismatch' }); } })), { code: 'active_index_mismatch' });
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-chat-plan-')), ragEnv = path.join(dir, 'rag.env');
  try {
    await fs.writeFile(ragEnv, 'RAG_V2_POSTGRES_URL=postgres://x\nM4_PILOT_ENABLED=1\nM4_PILOT_CONFIG=/etc/sotsiaalai/old.json\n');
    const backup = await activateChatPlan({ ragEnv, file: '/etc/sotsiaalai/new.json', plan: current });
    assert.equal(await fs.readFile(backup, 'utf8'), 'RAG_V2_POSTGRES_URL=postgres://x\nM4_PILOT_ENABLED=1\nM4_PILOT_CONFIG=/etc/sotsiaalai/old.json\n');
    const next = await fs.readFile(ragEnv, 'utf8');
    assert.match(next, /^RAG_V2_POSTGRES_URL=postgres:\/\/x\n/); assert.match(next, /M4_PILOT_CONFIG=\/etc\/sotsiaalai\/new\.json\n/);
    assert.equal(next.match(/M4_PILOT_CONFIG=/g).length, 1);
    await assert.rejects(activateChatPlan({ ragEnv, file: '/etc/sotsiaalai/new.json', plan: current }), { code: 'EEXIST' });
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('the release command reports a plan it cannot use without printing it, and refuses an unapproved one', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-plan-release-'));
  const run = (args, env = {}) => spawnSync(process.execPath, ['--import', './scripts/register-node-source-loader.mjs', 'scripts/rag-v2-plan-release.mjs', ...args],
    { encoding: 'utf8', env: { ...process.env, M4_PILOT_ENABLED: '', M4_PILOT_CONFIG: '', ...env } });
  try {
    assert.equal(run(['prepare', '--release', 'da69c0e']).stdout.trim(), 'disabled');
    const bad = path.join(dir, 'bad.json'); await fs.writeFile(bad, '{not json');
    assert.equal(run(['prepare', '--release', 'da69c0e'], { M4_PILOT_ENABLED: '1', M4_PILOT_CONFIG: bad }).stdout.trim(), 'unready invalid_plan');
    const current = await plan(), unapproved = path.join(dir, 'unapproved.json');
    await fs.writeFile(unapproved, JSON.stringify({ ...current, reasoning: 'high' }));
    const result = run(['prepare', '--release', 'da69c0e'], { M4_PILOT_ENABLED: '1', M4_PILOT_CONFIG: unapproved });
    assert.equal(result.stdout.trim(), 'unready unapproved_plan'); assert(!result.stdout.includes('owner-user'));
    const activation = run(['activate', '--plan', unapproved, '--rag-env', path.join(dir, 'rag.env')]);
    assert.equal(activation.status, 1); assert.match(activation.stderr, /unapproved_plan/);
    const ready = run(['ready']);
    assert.equal(ready.status, 1); assert.match(ready.stderr, /pilot_disabled/);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
