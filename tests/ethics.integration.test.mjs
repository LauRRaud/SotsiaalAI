// Run only against an empty/local probe database, never the application's data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { createEthics, readEthics, listEthics, updateEthics, deleteEthics, handoffEthics, prepareEthicsAssistant, ethicsExport } from '../lib/ethics/records.js';
import { DATA_EXPORT_REGISTRY } from '../lib/dataExport/registry.js';
import { PilotStore } from '../lib/rag-v2/pilot/store.js';
import { restrictPilotSources } from '../lib/rag-v2/pilot/source-scope.js';

const url = new URL(process.env.ETHICS_TEST_DATABASE_URL || 'postgres://invalid/invalid');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.endsWith('_ethics_probe')) throw Error('isolated local ETHICS_TEST_DATABASE_URL required');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }), log: [] });
const options = { db };
test.after(() => db.$disconnect());
const snapshot = 'Kuidas arutada inimese soovi iseseisvalt elada ja lähedaste muret turvalisuse pärast?';
const content = { title: 'PRIVATE_TITLE', question: 'PRIVATE_QUESTION', facts: 'PRIVATE_FACTS', shareDraft: snapshot };
const error = status => e => e.status === status;

test('ethics and general turns share the same actual spending ledger in either creation order', async t => {
  const user = await db.user.create({ data: { email: `ethics-budget-${randomUUID()}@example.invalid` } });
  const ledgerIds = [];
  t.after(async () => { await db.user.delete({ where: { id: user.id } }); await db.m4PilotLedger.deleteMany({ where: { id: { in: ledgerIds } } }); });
  for (const ethicsFirst of [true, false]) {
    const base = { id: randomUUID(), tenant: 'fixture', configHash: randomUUID(), mode: 'test', profile: {}, generationId: 'fixture', retentionHours: 1, expiresAt: null,
      documents: { ethics: 'v1', other: 'v2' }, budget: { attempts: 10, embeddingAttempts: 10, answerAttempts: 10, tokens: 1000, nanoUsd: 1000 } };
    ledgerIds.push(base.id);
    const scoped = restrictPilotSources(base, { id: 'ethics', sources: [{ documentId: 'ethics', versionId: 'v1' }] });
    const conv = await db.conversation.create({ data: { userId: user.id, role: 'SOCIAL_WORKER', metadata: { m4: true } } });
    const store = new PilotStore(db);
    let firstInput;
    for (const config of ethicsFirst ? [scoped, base] : [base, scoped]) {
      const input = { convId: conv.id, clientTurnKey: randomUUID(), question: 'Synthetic reflection', contextMode: 'new' };
      firstInput ??= input;
      const { row } = await store.claim(config, user.id, input);
      await store.reserve(config, row, 'embedding', { tokens: 10, nanoUsd: 10 }, {});
      await store.save(config, row, 'stopped', {});
    }
    const ledger = await db.m4PilotLedger.findUnique({ where: { id: base.id } });
    assert.equal(ledger.configHash, base.configHash);
    assert.equal(ledger.totals.embeddingAttempts, 2);
    assert.equal(ledger.totals.nanoUsd, 20);
    await assert.rejects(store.existing(ethicsFirst ? base : scoped, user.id, firstInput), { code: 'idempotency_conflict' });
  }
});

test('owner isolation, concurrent saves, confirmed minimal handoff and deletion boundaries', async t => {
  const users = [];
  for (const role of ['SOCIAL_WORKER', 'SOCIAL_WORKER', 'ADMIN']) users.push(await db.user.create({ data: { role, email: `ethics-${randomUUID()}@example.invalid` } }));
  const [owner, stranger, admin] = users;
  t.after(async () => {
    await db.covisionCase.deleteMany({ where: { ownerId: { in: users.map(u => u.id) } } });
    await db.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } });
  });
  const creationKey = randomUUID();
  const repeated = await Promise.all([1, 2].map(() => createEthics(owner.id, { creationKey, content }, options)));
  assert.equal(repeated[0].id, repeated[1].id);
  let row = repeated[0];
  await assert.rejects(createEthics(owner.id, { creationKey, content: { ...content, facts: 'different' } }, options), error(409));
  for (const other of [stranger, admin]) {
    assert.equal((await listEthics(other.id, options)).items.length, 0);
    await assert.rejects(readEthics(other.id, row.id, options), error(404));
    await assert.rejects(updateEthics(other.id, row.id, { expectedVersion: 1, content }, options), error(404));
    await assert.rejects(deleteEthics(other.id, row.id, 1, options), error(404));
    await assert.rejects(handoffEthics(other.id, row.id, { expectedVersion: 1, confirmed: true }, options), error(404));
    await assert.rejects(prepareEthicsAssistant(other.id, row.id, { expectedVersion: 1, confirmed: true }, options), error(404));
  }
  const races = await Promise.allSettled(['A', 'B'].map(facts => updateEthics(owner.id, row.id, { expectedVersion: 1, content: { ...content, facts } }, options)));
  assert.equal(races.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(races.find(r => r.status === 'rejected').reason.status, 409);
  row = await readEthics(owner.id, row.id, options);
  assert.equal(row.version, 2);
  await assert.rejects(deleteEthics(owner.id, row.id, 1, options), error(409));
  await assert.rejects(prepareEthicsAssistant(owner.id, row.id, { expectedVersion: 1, confirmed: true }, options), error(409));
  await assert.rejects(handoffEthics(owner.id, row.id, { expectedVersion: 2, confirmed: false }, options), error(400));
  assert.equal(await db.covisionCase.count({ where: { ownerId: owner.id } }), 0);
  for (const locale of ['et', 'en', 'ru']) {
    const prepared = await prepareEthicsAssistant(owner.id, row.id, { expectedVersion: 2, confirmed: true, locale }, options);
    assert.ok(prepared.question.endsWith(snapshot));
    assert.ok(prepared.question.length < 4000);
    assert.ok(!JSON.stringify(prepared).includes('PRIVATE_'));
    assert.equal(prepared.language, locale);
    assert.deepEqual(Object.keys(prepared).sort(), ['language', 'question']);
  }
  // A failing downstream insert must roll back the entire handoff.
  const failing = { $transaction: work => db.$transaction(tx => work(new Proxy(tx, { get: (target, key) => key === 'covisionPrivateState' ? { create: async () => { throw Error('SYNTHETIC_FAILURE'); } } : target[key] }))) };
  await assert.rejects(handoffEthics(owner.id, row.id, { expectedVersion: 2, confirmed: true }, { db: failing }), /SYNTHETIC_FAILURE/);
  assert.equal(await db.covisionCase.count({ where: { ownerId: owner.id } }), 0);
  assert.equal((await readEthics(owner.id, row.id, options)).version, 2);
  const copies = await Promise.all([1, 2].map(() => handoffEthics(owner.id, row.id, { expectedVersion: 2, confirmed: true }, options)));
  assert.equal(copies[0].covisionCaseId, copies[1].covisionCaseId);
  assert.equal(copies.filter(copy => copy.created).length, 1);
  const caseId = copies[0].covisionCaseId;
  const destination = await db.covisionCase.findUnique({ where: { id: caseId }, include: { participants: true } });
  assert.equal(destination.visibility, 'PRIVATE');
  assert.equal(destination.title, 'Kovisioon');
  assert.equal(destination.summary, null);
  assert.equal(destination.anonymizedDescription, null);
  assert.equal(destination.participants.length, 1);
  assert.equal(destination.participants[0].userId, owner.id);
  const copied = await db.covisionPrivateState.findFirst({ where: { userId: owner.id, session: { covisionCaseId: caseId } } });
  assert.deepEqual(copied.content, { text: snapshot });
  row = await readEthics(owner.id, row.id, options);
  assert.equal(row.sharedText, snapshot);
  assert.equal(row.version, 3);
  row = await updateEthics(owner.id, row.id, { expectedVersion: 3, content: { ...content, shareDraft: 'Muudetud tekst' } }, options);
  assert.equal(row.sharedText, snapshot, 'the confirmed copy stays frozen');
  const exported = ethicsExport(await db.ethicsReflection.findUnique({ where: { id: row.id } }));
  assert.equal(exported.content.title, content.title);
  assert.ok(!('creationHash' in exported) && !('creationKey' in exported) && !('ownerUserId' in exported));
  const surface = DATA_EXPORT_REGISTRY.find(item => item.name === 'ethics_reflections');
  const ownExport = await surface.collect({ db, userId: owner.id });
  assert.equal(JSON.parse(ownExport[0].content.toString()).id, row.id);
  for (const other of [stranger, admin]) assert.equal((await surface.collect({ db, userId: other.id }))[0].count, 0);
  await deleteEthics(owner.id, row.id, row.version, options);
  await assert.rejects(readEthics(owner.id, row.id, options), error(404));
  assert.equal(await db.covisionCase.count({ where: { id: caseId } }), 1, 'separate destination is not silently deleted');
  const cascade = await createEthics(stranger.id, { creationKey: randomUUID(), content }, options);
  await db.user.delete({ where: { id: stranger.id } });
  assert.equal(await db.ethicsReflection.count({ where: { id: cascade.id } }), 0);
});

test('additive migration creates the same columns and indexes as the schema without altering User', async () => {
  const client = new pg.Client({ connectionString: url.href });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('CREATE SCHEMA ethics_migration_probe');
    await client.query('SET LOCAL search_path = ethics_migration_probe');
    await client.query('CREATE TABLE "User" (id TEXT PRIMARY KEY)');
    await client.query(readFileSync(new URL('../prisma/migrations/20261015100000_ethics_reflection/migration.sql', import.meta.url), 'utf8'));
    const columns = async schema => (await client.query('SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY column_name', [schema, 'EthicsReflection'])).rows;
    assert.deepEqual(await columns('ethics_migration_probe'), await columns('public'));
    const indexes = await client.query('SELECT indexname FROM pg_indexes WHERE schemaname=$1 AND tablename=$2', ['ethics_migration_probe', 'EthicsReflection']);
    assert.equal(indexes.rowCount, 3);
    assert.equal((await client.query('SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2', ['ethics_migration_probe', 'User'])).rowCount, 1);
  } finally { await client.query('ROLLBACK'); await client.end(); }
});
