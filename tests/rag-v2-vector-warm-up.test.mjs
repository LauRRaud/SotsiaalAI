import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { warmPilotAtStart, warmVectors, vectorWarmState } from '../lib/rag-v2/pilot/retrieval.js';
import { UNIFIED_RETRIEVAL_VERSION } from '../lib/rag-v2/pilot/retrieval-plan.js';

// ADR-039, Codex review of #228 (P2): a failed vector warm-up is tried again by the next start or turn, never twice
// at once, and a finished one is not repeated. No network: a catalog and a Qdrant stand in.
const settle = () => new Promise(resolve => setTimeout(resolve, 10));
const failure = () => Object.assign(new Error('synthetic'), { code: 'qdrant_request_failed' });

test('a failed vector warm-up is tried again; a running or finished one is not', async () => {
  const generation = { id: `vector-retry-${Date.now()}` };
  let calls = 0;
  const qdrant = { warm: async () => { if (++calls === 1) throw failure(); return 1; } };
  assert.ok(warmVectors(qdrant, generation, ['guide']));
  assert.equal(warmVectors(qdrant, generation, ['guide']), null, 'never twice at once');
  await settle();
  assert.equal(vectorWarmState(generation.id), 'failed');
  assert.ok(warmVectors(qdrant, generation, ['guide']));
  await settle();
  assert.equal(vectorWarmState(generation.id), 'done');
  assert.equal(warmVectors(qdrant, generation, ['guide']), null);
  assert.equal(calls, 2);
});

// ADR-069: the start reads the vectors at once and again after the sources, so a start makes two tries.
test('the start warm-up tries the vectors again after a failure, without warming the sources again', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-vector-retry-')), file = path.join(dir, 'plan.json');
  const url = `postgresql://127.0.0.1:1/vector-retry-${Date.now()}`; // never connected: the catalog below stands in for it
  const generation = { id: `vector-retry-start-${Date.now()}`, tenant: 'retry', snapshot: { documents: { guide: { version_id: 'v1' } } } };
  const sources = [];
  (globalThis[Symbol.for('sotsiaalai.rag-v2.postgres-catalogs')] ||= new Map()).set(url,
    { active: async () => generation, retrievalDirectory: async () => [], warm: async () => { sources.push('warmed'); } });
  let calls = 0;
  class Qdrant { async warm() { if (++calls <= 2) throw failure(); return 1; } }
  const env = { M4_PILOT_ENABLED: '1', M4_PILOT_CONFIG: file, RAG_V2_POSTGRES_URL: url,
    RAG_V2_QDRANT_URL: 'http://127.0.0.1:56333', RAG_V2_QDRANT_KEY: 'k'.repeat(24) };
  try {
    await fs.writeFile(file, JSON.stringify({ mode: 'real', tenant: generation.tenant, generationId: generation.id,
      documents: { guide: 'v1' }, retrievalRouting: UNIFIED_RETRIEVAL_VERSION }));
    assert.equal(await warmPilotAtStart({ env, Qdrant }), true);
    await settle();
    assert.deepEqual([sources.length, calls, vectorWarmState(generation.id)], [1, 2, 'failed']);
    assert.equal(await warmPilotAtStart({ env, Qdrant }), false, 'the sources are already warm');
    await settle();
    assert.deepEqual([sources.length, calls, vectorWarmState(generation.id)], [1, 3, 'done']);
    assert.equal(await warmPilotAtStart({ env, Qdrant }), false);
    await settle();
    assert.equal(calls, 3, 'a finished vector warm-up is not repeated');
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
