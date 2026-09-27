import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { ingest } from '../lib/rag-v2/ingestion.js';
import { readJson } from '../lib/rag-v2/catalog.js';
import { hash } from '../lib/rag-v2/contracts.js';
import { planIndexJob, runIndexJob } from '../lib/rag-v2/search/index-jobs.js';
import { IndexJobStore } from '../lib/rag-v2/search/index-jobs-postgres.js';
import { embeddingConfig, OPENAI_EMBEDDING_ENDPOINT } from '../lib/rag-v2/search/embedding.js';
import { StoredEmbedding } from '../lib/rag-v2/search/pilot-runner.js';
import { ESTNLTK_LEXICAL } from '../lib/rag-v2/search/morphology.js';
import { QdrantIndex } from '../lib/rag-v2/search/qdrant.js';
import { VERSION_LAYOUT } from '../lib/rag-v2/search/layout.js';
import { digest } from '../lib/rag-v2/pilot/contracts.js';
import { approvedChatPlan, approvedScope, newChatPlan } from '../lib/rag-v2/pilot/chat-plan.js';

// ADR-037 on a real local catalogue: the release command against an active real-mode index (synthetic stored vectors,
// real EstNLTK), with no provider call.
let root, postgres, qdrant, connections;
const tenant = `plan-release-${randomUUID()}`;
const rights = { access: 'local_private', usage: 'development_only' }, profile = { id: 'generic', version: '1', months: [], categoryLabels: [] };
const config = embeddingConfig({ embedding_mode: 'real', provider: 'openai', model: 'text-embedding-3-large', dimensions: 3072, endpoint: OPENAI_EMBEDDING_ENDPOINT });
before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-plan-release-'));
  connections = await readJson('tmp/rag-v2-services/connections.json');
  postgres = new IndexJobStore(connections.postgresUrl); qdrant = new QdrantIndex(connections.qdrantUrl, connections.qdrantKey);
});
after(async () => {
  try {
    const generations = (await postgres.pool.query('SELECT * FROM rag_v2_generation WHERE tenant=$1', [tenant])).rows;
    for (const generation of generations) await qdrant.request(qdrant.route(generation), 'DELETE').catch(error => { if (error.status !== 404) throw error; });
    for (const table of ['rag_v2_index_job', 'rag_v2_unit', 'rag_v2_version_unit', 'rag_v2_version_index', 'rag_v2_generation_document', 'rag_v2_head', 'rag_v2_generation',
      'rag_v2_object', 'rag_v2_version', 'rag_v2_document', 'rag_v2_vector_cache']) await postgres.pool.query(`DELETE FROM ${table} WHERE tenant=$1`, [tenant]);
  } finally {
    await postgres?.close();
    assert(path.basename(root).startsWith('rag-v2-plan-release-'));
    await fs.rm(root, { recursive: true, force: true });
  }
});

const inputRoot = () => path.join(root, 'input'), storeRoot = () => path.join(root, 'input', 'store');
async function addDocument(name, text) {
  await fs.mkdir(inputRoot(), { recursive: true });
  await fs.writeFile(path.join(inputRoot(), `${name}.html`), `<article><h1>${name}</h1><p>${text}</p><p>${text} Teine lõik.</p></article>`);
  const { bundle } = await ingest({ tenant, inputRoot: inputRoot(), storeRoot: storeRoot(), rights, profile, config: { chunkMaxChars: 140 },
    metadata: { document_id: name, title: name, source_type: 'fixture', language: 'et', source_format: 'html', source_path: `${name}.html` } });
  return bundle;
}
// Indexes the documents as the corpus is indexed (versions-v1, EstNLTK) with stored synthetic vectors.
async function index(bundles) {
  const vectors = new Map(bundles.flatMap(bundle => bundle.chunks.map(chunk => [hash(chunk.retrieval_text), Array.from({ length: 3072 }, (_, i) => i === 0 ? 1 : 0)])));
  const embedding = new StoredEmbedding('synthetic-local-fixture', { config, transport: 'synthetic' }, vectors);
  const plan = await planIndexJob({ storeRoot: storeRoot(), tenant, documents: bundles.map(b => b.document.id), embedding: config, lexical: ESTNLTK_LEXICAL,
    layout: VERSION_LAYOUT, sealedItems: (configId, versions) => postgres.sealedItems(tenant, configId, versions) });
  assert.equal((await runIndexJob({ plan, storeRoot: storeRoot(), postgres, qdrant, embedding, maxBatches: 10000 })).state, 'ready');
  return postgres.active(tenant);
}
const env = file => ({ ...process.env, M4_PILOT_ENABLED: '1', M4_PILOT_CONFIG: file, RAG_V2_POSTGRES_URL: connections.postgresUrl,
  OPENAI_MODEL: 'gpt-6-luna', OPENAI_API_KEY: 'synthetic-key-never-sent', TZ: 'UTC' });
const release = (args, file) => spawnSync(process.execPath, ['--import', './scripts/register-node-source-loader.mjs', 'scripts/rag-v2-plan-release.mjs', ...args],
  { encoding: 'utf8', env: env(file), timeout: 120000 });
const write = async (name, value) => { const file = path.join(root, name); await fs.writeFile(file, JSON.stringify(value)); return file; };
const resign = (plan, changes) => { const { approval, ...unsigned } = { ...plan, ...changes }; return { ...unsigned, approval: { ...approval, planHash: digest(unsigned) } }; };

test('a release keeps a current plan, renews a stale one, activates it and finds it ready; a moved index does not block it', async () => {
  const generation = await index([await addDocument('koduteenus', 'Koduteenus aitab eakat kodus toime tulla.')]);
  const current = await newChatPlan({ generation, tenant, profileId: 'hybrid-estnltk-chat-v1', users: ['owner-user'], accountProject: 'proj_synthetic',
    prices: { embeddingInput: 130, answerInput: 125, answerOutput: 500 }, reasoning: 'medium', nanoUsd: 4e9, basis: 'Synthetic owner instruction' });
  const currentFile = await write('current.json', current);
  assert.equal(release(['prepare', '--release', 'da69c0e', '--out-dir', root], currentFile).stdout.trim(), 'current');

  // A plan from an earlier release: stale here, renewed for this code with the same approved scope, not yet active.
  const staleFile = await write('stale.json', resign(current, { implementationHash: 'e'.repeat(64), promptVersion: 'm4-grounded-dialogue-10' }));
  const prepared = release(['prepare', '--release', 'da69c0e', '--out-dir', root], staleFile);
  assert.equal(prepared.status, 0, prepared.stderr);
  const [state, renewedFile] = prepared.stdout.trim().split(' ');
  assert.equal(state, 'renewed'); assert(!prepared.stdout.includes('owner-user'));
  const renewed = await readJson(renewedFile);
  assert(approvedChatPlan(renewed)); assert.equal(approvedScope(renewed), approvedScope(current));
  assert.equal(renewed.implementationHash, current.implementationHash); assert.match(renewed.id, /-rda69c0e$/);

  const ragEnv = path.join(root, 'rag.env'); await fs.writeFile(ragEnv, `RAG_V2_POSTGRES_URL=x\nM4_PILOT_ENABLED=1\nM4_PILOT_CONFIG=${staleFile}\n`);
  const activated = release(['activate', '--plan', renewedFile, '--rag-env', ragEnv], staleFile);
  assert.equal(activated.status, 0, activated.stderr);
  assert.match(await fs.readFile(ragEnv, 'utf8'), new RegExp(`M4_PILOT_CONFIG=${renewedFile.replace(/[\\.]/g, m => `\\${m}`)}\\n`));
  assert.match(await fs.readFile(activated.stdout.trim(), 'utf8'), /stale\.json/);
  assert.equal(release(['ready'], renewedFile).stdout.trim(), 'ready');
  const stale = release(['ready'], staleFile);
  assert.equal(stale.status, 1); assert.match(stale.stderr, /implementation_approval_mismatch/);

  // The index moved on without a new plan: the plan could not run before the release either.
  await index([await addDocument('paevakeskus', 'Päevakeskus pakub eakatele tegevusi.')]);
  assert.equal(release(['prepare', '--release', 'da69c0e', '--out-dir', root], currentFile).stdout.trim(), 'unready active_index_mismatch');
  assert.equal(release(['prepare', '--release', 'da69c0e', '--out-dir', root], staleFile).stdout.trim(), 'unready active_index_mismatch');
  assert.equal(release(['ready'], currentFile).status, 1);
});

test('a plan that no longer runs on the new code stops the release', async () => {
  const generation = await postgres.active(tenant);
  const current = await newChatPlan({ generation, tenant, profileId: 'hybrid-estnltk-chat-v1', users: ['owner-user'], accountProject: 'proj_synthetic',
    prices: { embeddingInput: 130, answerInput: 125, answerOutput: 500 }, reasoning: 'medium', nanoUsd: 4e9, basis: 'Synthetic owner instruction' });
  // Approved under an earlier release for a retrieval profile this code does not have.
  const file = await write('unknown-profile.json', resign(current, { implementationHash: 'e'.repeat(64), profileId: 'retired-profile-v0' }));
  const before = (await fs.readdir(root)).sort();
  const result = release(['prepare', '--release', 'da69c0e', '--out-dir', root], file);
  assert.equal(result.status, 1, `${result.stdout}${result.stderr}`); assert.equal(result.stdout, ''); assert.match(result.stderr, /unknown_retrieval_profile/);
  // Nothing was written for the release: the deploy restores the previous one with its plan.
  assert.deepEqual((await fs.readdir(root)).sort(), before);
});
