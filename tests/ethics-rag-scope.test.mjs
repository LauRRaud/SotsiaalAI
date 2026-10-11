import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { restrictPilotSources } from '../lib/rag-v2/pilot/source-scope.js';
import { ethicsRagConfig, validateEthicsTurn } from '../lib/ethics/ragScope.js';
import { runtimeAdapters } from '../lib/rag-v2/pilot/retrieval.js';
import { searchConfig } from '../lib/rag-v2/search/indexing.js';
import { retrievalProfile } from '../lib/rag-v2/search/profiles.js';
import { ESTNLTK_LEXICAL } from '../lib/rag-v2/search/morphology.js';
import { UNIFIED_RETRIEVAL_VERSION } from '../lib/rag-v2/pilot/retrieval-plan.js';
import { pilotPost } from '../lib/chat/m4PilotServer.js';

const collection = { id: 'ethics-fixture', sources: [{ documentId: 'ethics', versionId: 'v1' }, { documentId: 'revoked', versionId: 'v2' }] };
const base = { id: 'base-plan', configHash: 'base-hash', documents: { ethics: 'v1', unrelated: 'v3' }, budget: { attempts: 10 } };

test('collection intersects current authorization and exact versions, has separate replay identity, shares budget and fails closed', () => {
  const scoped = restrictPilotSources(base, collection);
  assert.deepEqual(scoped.documents, { ethics: 'v1' });
  assert.deepEqual(base.documents, { ethics: 'v1', unrelated: 'v3' });
  assert.notEqual(scoped.configHash, base.configHash);
  assert.equal(scoped.configHash, restrictPilotSources(base, collection).configHash);
  assert.equal(scoped.budget, base.budget);
  assert.equal(scoped.budgetLedger, base.id);
  assert.equal(scoped.budgetConfigHash, base.configHash);
  assert.equal(restrictPilotSources({ ...base, budgetLedger: 'original-budget' }, collection).budgetLedger, 'original-budget');
  for (const documents of [{ unrelated: 'v3' }, { ethics: 'new-version' }, {}]) {
    assert.throws(() => restrictPilotSources({ ...base, documents }, collection), { code: 'source_scope_unavailable' });
  }
  for (const special of [{ fixedPacketFile: 'cached-full-corpus' }, { queryReuse: {} }]) {
    assert.throws(() => restrictPilotSources({ ...base, ...special }, collection), { code: 'source_scope_incompatible' });
  }
  const actual = JSON.parse(readFileSync(new URL('../config/ethics-sources.json', import.meta.url)));
  assert.equal(new Set(actual.sources.map(s => s.documentId)).size, actual.sources.length);
  for (const source of actual.sources) {
    assert.match(source.documentId, /^document_[a-f0-9]{64}$/);
    assert.match(source.versionId, /^version_[a-f0-9]{64}$/);
  }
  assert.throws(() => ethicsRagConfig(base), { code: 'source_scope_unavailable' });
});

test('runtime narrows preflight and unified directory before any lane; unrelated citations are rejected before hydration', async () => {
  const indexed = searchConfig(undefined, ESTNLTK_LEXICAL);
  const config = restrictPilotSources({ ...base, mode: 'real', tenant: 'fixture', generationId: 'generation',
    embedding: indexed.embedding, profile: retrievalProfile(), retrievalRouting: UNIFIED_RETRIEVAL_VERSION }, collection);
  let directoryReads = 0;
  class Catalog {
    async active() { return { id: 'generation', config: indexed, snapshot: { documents: { ethics: { version_id: 'v1' }, unrelated: { version_id: 'v3' } } } }; }
    async retrievalDirectory(tenant, generation, ids) {
      assert.deepEqual(ids, ['ethics']); directoryReads++;
      if (directoryReads > 1) throw Object.assign(Error('directory_boundary'), { code: 'directory_boundary' });
      return null;
    }
    async checkLexicalAnalyzer() {}
    async close() {}
    async bundles() { assert.fail('Unrelated source content must never load'); }
  }
  const adapters = runtimeAdapters(async () => config, 'owner', { Catalog });
  await adapters.preflight(config);
  await assert.rejects(adapters.unifiedSearch(config, { text: 'unrelated services', language: 'et' }, null), { code: 'directory_boundary' });
  assert.equal(directoryReads, 2);
  const packet = { reference_map: { S1: { document_id: 'unrelated', document_version_id: 'v3' } } };
  await assert.rejects(adapters.canonicalPacket(config, packet), { code: 'reference_access_denied' });
});

test('HTTP scope is server supplied and past general dialogue cannot enter an ethics answer', async () => {
  let sessions = 0, turns = 0;
  const authenticate = async () => ({ userId: 'owner' });
  const session = async (auth, { configurationScope }) => {
    sessions++; assert.equal(configurationScope, ethicsRagConfig);
    return { config: {}, store: {}, service: { run: async () => { turns++; return { id: 'turn', state: 'completed', mode: 'test',
      answer: { kind: 'unsupported', blocks: [], limitations: ['No ethics evidence'], clarification: null }, sources: [] }; } } };
  };
  const send = input => pilotPost(new Request('http://localhost:3000/api/ethics/chat', { method: 'POST', headers: {
    'content-type': 'application/json', origin: new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000').origin, 'x-rag-pilot-format': 'chat'
  }, body: JSON.stringify(input) }), { authenticate, session, configurationScope: ethicsRagConfig, inputPolicy: validateEthicsTurn });
  for (const input of [null, { contextMode: 'same' }, { contextMode: 'new', contextTurnId: 'general-turn' },
    { contextMode: 'new', replyToTurnId: 'general-turn' }, { contextMode: 'new', replyToBlock: 1 }]) assert.equal((await send(input)).status, 400);
  assert.equal(sessions, 0);
  assert.equal((await send({ contextMode: 'new', question: 'Ethical reflection' })).status, 200);
  assert.equal(turns, 1);
});
