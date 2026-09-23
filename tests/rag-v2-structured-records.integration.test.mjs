import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { IngestBatchQueue } from '../lib/rag-v2/ingest-batch-postgres.js';
import { planIngestBatch, prepareNextBatchItem } from '../lib/rag-v2/ingest-batch.js';
import { createBatchReview, publishReviewedBatch } from '../lib/rag-v2/ingest-publication.js';
import { registeredSource } from '../lib/rag-v2/registered-source.js';
import { hash, validateBundle } from '../lib/rag-v2/contracts.js';
import { loadSnapshot } from '../lib/rag-v2/search/snapshot.js';
import { QdrantIndex } from '../lib/rag-v2/search/qdrant.js';
import { MockEmbedding } from '../lib/rag-v2/search/embedding.js';
import { indexSnapshot } from '../lib/rag-v2/search/indexing.js';
import { LocalPolicy } from '../lib/rag-v2/search/policy.js';
import { resolveModelReference } from '../lib/rag-v2/search/model-context.js';
import { StructuredRecordSource, RECORD_RETRIEVAL_VERSION } from '../lib/rag-v2/search/structured-record-source.js';
import { runtimeAdapters } from '../lib/rag-v2/pilot/retrieval.js';
import { retrievalProfile } from '../lib/rag-v2/search/profiles.js';
import { resolveRecordScope } from '../lib/rag-v2/pilot/record-scope.js';
import { DIALOGUE_VERSION } from '../lib/rag-v2/pilot/dialogue.js';
import { PilotService } from '../lib/rag-v2/pilot/service.js';
import { PilotStore } from '../lib/rag-v2/pilot/store.js';
import { municipalDirectoryAdapter } from '../lib/rag-v2/adapters/municipal-directory.js';
import { resolveModelReferences } from '../lib/rag-v2/search/model-context.js';

const appUrl = new URL(process.env.M4_TEST_DATABASE_URL || 'postgres://invalid/invalid');
if (!['localhost', '127.0.0.1'].includes(appUrl.hostname) || appUrl.pathname !== '/sotsiaal_ai_m4_dev') throw Error('isolated M4 database required');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: appUrl.href }), log: [] });
const tenant = `records-${randomUUID()}`, fetch = globalThis.fetch, connect = net.Socket.prototype.connect;
const context = { tenant, subject: 'reader', usage: 'development_only' };
const directory = [{ region: 'harku_vald', names: ['Harku vald', 'Harku'] }, { region: 'kose_vald', names: ['Kose vald', 'Kose'] }];
let root, postgres, qdrant, snapshot, generation, policy, embedding, connections;
let contactAllowed = true;
const authorizeContact = async ({ record }) => contactAllowed && record.aliases.includes('contact_ok');
const requests = [];
before(async () => {
  connections = JSON.parse(await fs.readFile('tmp/rag-v2-services/connections.json', 'utf8'));
  const pgUrl = new URL(connections.postgresUrl);
  assert.equal(pgUrl.hostname, '127.0.0.1'); assert.equal(pgUrl.pathname, '/rag_v2_dev');
  const allowedPorts = new Set([pgUrl.port, new URL(connections.qdrantUrl).port, appUrl.port || '5432']);
  globalThis.fetch = (input, options) => {
    assert.equal(new URL(typeof input === 'string' ? input : input.url).origin, connections.qdrantUrl);
    return fetch(input, options);
  };
  net.Socket.prototype.connect = function (...args) {
    const normalized = Array.isArray(args[0]) ? args[0] : args;
    const target = typeof normalized[0] === 'object' ? normalized[0] : { port: normalized[0], host: normalized[1] };
    assert(['localhost', '127.0.0.1'].includes(target.host)); assert(allowedPorts.has(String(target.port)));
    return connect.apply(this, args);
  };
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-records-'));
  postgres = new IngestBatchQueue(connections.postgresUrl); qdrant = new QdrantIndex(connections.qdrantUrl, connections.qdrantKey);
  const inputs = [];
  for (const region of directory) {
    const items = Array.from({ length: 6 }, (_, i) => ({ id: `service_${i}`, itemType: i ? 'benefit' : 'service',
      title: `Näidisteenus ${i}`, summary: `Sünteetiline teenus ${i} aitab igapäevastes toimingutes.`,
      conditions: ['Esimene näidistingimus', 'Teine näidistingimus'], application: 'Esita näidisavaldus.',
      relatedContacts: ['contact_ok', 'hidden_contact_sentinel', 'another_region_only'], relatedForms: ['form'] }));
    items.push({ id: 'contact_ok', itemType: 'contact', name: 'Näidiskontakt', role: 'Näidisnõustaja',
      phone: '+372 0000000', email: 'contact@example.invalid', relatedTo: ['service_0'] },
    { id: 'hidden_contact_sentinel', itemType: 'contact', name: 'HIDDEN NAME', phone: 'HIDDEN PHONE' },
    { id: 'form', itemType: 'form', title: 'Näidisavaldus', url: `https://example.invalid/${region.region}/form`, relatedTo: ['service_0'] });
    if (region.region === 'kose_vald') items.push({ id: 'another_region_only', itemType: 'contact', name: 'OTHER REGION SECRET' });
    for (const item of items) Object.assign(item, { canonical_item_id: `${region.region}:${item.id}`, municipality_id: region.region,
      municipality_name: region.names[0], source_type: `municipal_${item.itemType}`, language: 'et', last_checked: '2026-09-23' });
    const file = `${region.region}.json`, bytes = JSON.stringify({ items });
    await fs.writeFile(path.join(root, file), bytes);
    for (const item of items) inputs.push(await registeredSource(root, { role: 'source', path: file, sha256: hash(bytes) }, { itemId: item.id }));
  }
  const plan = await planIngestBatch({ tenant, inputRoot: root, inputs, rights: { access: 'local_private', usage: 'development_only' },
    profile: { id: 'generic', version: '1', months: [], categoryLabels: [] } });
  await postgres.enqueue(plan);
  const options = { tenant, inputRoot: root, storeRoot: path.join(root, 'store'), queue: postgres, batchId: plan.id };
  while (await prepareNextBatchItem(options)) { /* one isolated publication */ }
  const review = await createBatchReview(options);
  assert(review.items.every(item => !item.blockers.length));
  review.reviewed_by = 'synthetic-test-reviewer';
  for (const item of review.items) { item.decision = 'include'; item.note = 'Fictional records for local transport/identity tests only.'; }
  await publishReviewedBatch({ ...options, review });
  snapshot = await loadSnapshot(options.storeRoot, tenant, review.items.map(item => item.document_id));
  embedding = new MockEmbedding();
  await indexSnapshot({ snapshot, postgres, qdrant, embedding });
  generation = await postgres.active(tenant);
  policy = new LocalPolicy({ tenants: { [tenant]: { reader: Object.keys(snapshot.documents) } } });
});
after(async () => {
  try {
    if (generation) await qdrant.request(`/collections/${generation.collection}`, 'DELETE');
    for (const table of ['rag_v2_ingest_item', 'rag_v2_ingest_batch', 'rag_v2_unit', 'rag_v2_generation_document', 'rag_v2_head',
      'rag_v2_generation', 'rag_v2_object', 'rag_v2_version', 'rag_v2_document', 'rag_v2_vector_cache']) await postgres?.pool.query(`DELETE FROM ${table} WHERE tenant=$1`, [tenant]);
  } finally {
    await db.$disconnect(); await postgres?.close(); globalThis.fetch = fetch; net.Socket.prototype.connect = connect;
    if (root) {
      assert(path.dirname(path.resolve(root)) === path.resolve(os.tmpdir()) && path.basename(root).startsWith('rag-records-'));
      await fs.rm(root, { recursive: true, force: true });
    }
  }
});
const source = extra => new StructuredRecordSource({ postgres, policy, authorizeContact, ...extra });
const query = extra => ({ context, region: 'harku_vald', generationId: generation.id, ...extra });

test('reviewed JSON -> indexed record catalogue keeps every service, typed fields and source-declared links in one region', async () => {
  const calls = embedding.calls;
  const packet = await source().retrieve(query());
  assert.equal(packet.record_context.catalogue_count, 6); // Not limited to search top-5.
  assert.equal(embedding.calls, calls);
  assert(packet.record_context.entries.every(entry => entry.region === 'harku_vald'));
  assert.doesNotMatch(JSON.stringify(packet), /HIDDEN NAME|HIDDEN PHONE|hidden_contact_sentinel|OTHER REGION SECRET|another_region_only/);
  const contact = packet.record_context.entries.find(entry => entry.kind === 'contact');
  assert.equal(contact.fields.phone.value, '+372 0000000');
  assert.equal(contact.fields.email.value, 'contact@example.invalid');
  for (const link of packet.record_context.relations.filter(link => link.to)) assert(link.refs.length);
  const record = snapshot.bundles.find(bundle => bundle.document.fields.structured_record?.value.id === 'harku_vald:service_0').document.fields.structured_record.value;
  assert.deepEqual(record.fields.conditions.value, ['Esimene näidistingimus', 'Teine näidistingimus']);
  assert.equal(record.links[0].path, '/items/0/relatedContacts/0');
  for (const ref of Object.keys(packet.reference_map)) await resolveModelReference({ packet, reference: ref, context, policy,
    queryId: packet.query_id, sourceResolver: expected => postgres.canonicalReference(expected) });
  let loads = 0;
  class CountingCatalog extends IngestBatchQueue {
    constructor() { super(connections.postgresUrl); }
    async bundles(...args) { loads++; return super.bundles(...args); }
  }
  const counted = new CountingCatalog();
  try {
    await resolveModelReferences({ packet, context, policy, sourceResolver: refs => counted.canonicalReferences(refs) });
    assert.equal(loads, 1);
    const altered = structuredClone(packet); altered.reference_map.S1.source_text_sha256 = 'forged';
    await assert.rejects(resolveModelReferences({ packet: altered, context, policy, sourceResolver: refs => counted.canonicalReferences(refs) }), { code: 'invalid_model_reference' });
    const references = Object.values(packet.reference_map);
    await assert.rejects(counted.canonicalReferences([references[0], { ...references[1], tenant: 'another' }]), { code: 'reference_scope_mismatch' });
    await assert.rejects(counted.canonicalReferences([{ ...references[0], unit_id: 'missing' }]), { code: 'canonical_reference_missing' });
  } finally { await counted.close(); }
  const original = snapshot.bundles.find(bundle => bundle.document.fields.structured_record?.value.id === 'harku_vald:service_0');
  const forged = structuredClone(original); forged.document.fields.structured_record.value.fields.summary.value = 'Forged';
  assert.throws(() => validateBundle(forged), { code: 'record_field_source_mismatch' });
});

test('unverified or unauthorized contacts stay unavailable; detail selection retains exact conditions and scope', async () => {
  const packet = await source({ authorizeContact: undefined }).retrieve(query({ recordIds: ['service_0'] }));
  assert(!packet.record_context.entries.some(entry => entry.kind === 'contact'));
  assert.doesNotMatch(JSON.stringify(packet), /0000000|contact@example/);
  const detail = packet.record_context.entries.find(entry => entry.record_id === 'harku_vald:service_0');
  assert.deepEqual(detail.fields.conditions.value, ['Esimene näidistingimus', 'Teine näidistingimus']);
  assert(detail.fields.conditions.refs.length);
  await assert.rejects(source().retrieve(query({ recordIds: ['kose_vald:service_0'] })), { code: 'record_not_available' });
  const denied = snapshot.bundles.find(bundle => bundle.document.fields.structured_record?.value.id === 'harku_vald:contact_ok').document.id;
  const limitedPolicy = new LocalPolicy({ tenants: { [tenant]: { reader: Object.keys(snapshot.documents).filter(doc => doc !== denied) } } });
  const restricted = await source({ policy: limitedPolicy }).retrieve(query());
  assert(!restricted.record_context.entries.some(entry => entry.kind === 'contact'));
  assert(!restricted.evidence.some(entry => entry.document_id === denied));
});

test('catalogue budgets fail explicitly; permission and contact revocation during retrieval cannot publish a packet', async () => {
  await assert.rejects(source().retrieve(query({ limits: { records: 1 } })), { code: 'record_count_budget_exceeded' });
  await assert.rejects(source().retrieve(query({ limits: { contextTokens: 1 } })), { code: 'record_context_budget_exceeded' });
  let reads = 0;
  await assert.rejects(source({ policy: { allowed: async () => ({ documents: Object.keys(snapshot.documents), revision: ++reads }) } }).retrieve(query()),
    { code: 'access_changed_during_retrieval' });
  let approvedReads = 0;
  await assert.rejects(source({ authorizeContact: async ({ record }) => record.aliases.includes('contact_ok') && ++approvedReads === 1 }).retrieve(query()),
    { code: 'record_contact_access_changed' });
});

test('EstNLTK resolves canonical locality forms, preserves ambiguity and clears an unrecognized correction', async () => {
  const turns = texts => texts.map((text, i) => ({ turnId: String(i), text, mode: 'same' }));
  assert.equal((await resolveRecordScope(turns(['Elan Harkus.', 'Kellele helistan?']), directory)).region, 'harku_vald');
  assert.equal((await resolveRecordScope(turns(['Elan Harkus.', 'Nüüd Kose vallas.']), directory)).region, 'kose_vald');
  assert.equal((await resolveRecordScope(turns(['Elan Harku vallas, ema Koses.']), directory)).state, 'ambiguous_region');
  assert.equal((await resolveRecordScope([{ text: 'Elan Harkus.', mode: 'same' }, { text: 'Elukoht on muutunud.', mode: 'correction' }], directory)).region, null);
  const tartu = [{ region: 'tartu_linn', names: ['Tartu linn', 'Tartu'] }, { region: 'tartu_vald', names: ['Tartu vald', 'Tartu'] }];
  assert.equal((await resolveRecordScope(turns(['Tartus']), tartu)).state, 'ambiguous_region');
  assert.equal((await resolveRecordScope(turns(['Tartu vallas']), tartu)).region, 'tartu_vald');
});

test('real local dialogue store uses one answer call per turn, carries source focus and switches municipality without query embeddings', async t => {
  const user = await db.user.create({ data: { email: `record-dialogue-${randomUUID()}@example.invalid` } });
  const conversation = await db.conversation.create({ data: { userId: user.id, role: 'CLIENT', metadata: { m4: true }, expiresAt: null } });
  const config = { id: randomUUID(), configHash: randomUUID(), tenant, mode: 'real', users: [user.id],
    documents: Object.fromEntries(snapshot.bundles.map(bundle => [bundle.document.id, bundle.version.id])), generationId: generation.id,
    profile: retrievalProfile('hybrid-ranked-first-v1'), recordCatalogue: RECORD_RETRIEVAL_VERSION, dialogueVersion: DIALOGUE_VERSION,
    embedding: embedding.config, model: 'test-transport', reasoning: 'low', maxInputTokens: 128000, maxOutputTokens: 1000,
    expiresAt: null, retentionHours: null, prices: { embeddingInput: 1, answerInput: 1, answerOutput: 1 },
    budget: { attempts: 20, embeddingAttempts: 0, answerAttempts: 20, tokens: 3000000, nanoUsd: 3000000 } };
  t.after(async () => { contactAllowed = true; await db.user.delete({ where: { id: user.id } }); await db.m4PilotLedger.deleteMany({ where: { id: config.id } }); });
  class Catalog extends IngestBatchQueue { constructor() { super(connections.postgresUrl); } }
  const adapters = runtimeAdapters(async () => config, user.id, { Catalog, loadRegions: async () => directory, authorizeContact });
  const service = new PilotService({ store: new PilotStore(db), readConfig: async () => config, adapters, call: async ({ stage, body }) => {
    assert.equal(stage, 'answer');
    const input = JSON.parse(body.input[0].content), records = input.evidence.records;
    requests.push(input);
    const entry = records.entries.find(entry => entry.kind === 'service');
    return { value: entry ? { kind: 'grounded', blocks: [{ text: 'Sünteetilise näidisteenuse kirjeldus.', factual: true, refs: entry.fields.summary.refs }], limitations: [], clarification: null }
      : { kind: 'clarification', blocks: [], limitations: [], clarification: 'Millises omavalitsuses abi otsid?' },
    usage: { input: 20, output: 20 }, requestId: 'synthetic-answer' };
  } });
  const run = (question, contextMode = 'same') => service.run(user.id, { question, contextMode, convId: conversation.id,
    clientTurnKey: randomUUID(), language: 'et' });
  const initialCalls = embedding.calls;
  await run('Olen üksi ja kodus on raske toime tulla.', 'new');
  await run('Elan Harkus.');
  await run('Kellele helistan?');
  const switched = await run('Parandus: Kose vallas.', 'correction');
  const simpler = await run('Selgita lihtsamalt.');
  assert.equal(requests.length, 5); assert.equal(embedding.calls, initialCalls);
  assert.equal(requests[0].evidence.records.scope.state, 'region_required');
  assert(requests[1].evidence.records.entries.every(entry => entry.region === 'harku_vald'));
  assert(requests[2].evidence.records.entries.some(entry => entry.detail === 'selected_detail' && entry.fields.application));
  assert(requests[3].evidence.records.entries.every(entry => entry.region === 'kose_vald'));
  const first = await db.m4PilotTurn.findUnique({ where: { id: switched.id } }), second = await db.m4PilotTurn.findUnique({ where: { id: simpler.id } });
  for (const block of first.payload.answer.blocks) for (const ref of block.refs) {
    const old = first.payload.packet.reference_map[ref];
    assert(second.payload.packet.evidence.some(entry => entry.evidence_id === old.evidence_id));
  }
  contactAllowed = false;
  await assert.rejects(service.restore(second), { code: 'record_contact_access_changed' });
});

test('municipal adapter uses the public verification policy and exact source identity; stale, edited or unpublished contacts fail', async t => {
  const slug = `fixture-${randomUUID()}`, checkedAt = new Date();
  const municipality = await db.municipality.create({ data: { slug, baseName: slug, displayName: slug, type: 'VALD' } });
  let contact, audit;
  t.after(async () => { if (audit) await db.dataAuditLog.delete({ where: { id: audit.id } });
    if (contact) await db.serviceMapEntry.delete({ where: { id: contact.id } }); await db.municipality.delete({ where: { id: municipality.id } }); });
  contact = await db.serviceMapEntry.create({ data: { title: 'Synthetic registry contact', type: 'KOV_SOCIAL_CONTACT',
    municipalityId: municipality.id, status: 'PUBLISHED', sourceNamespace: 'OFFICIAL_KOV_CONTACT', sourceDocId: 'fixture_contact',
    checkedAt, revision: 1, phone: '+372 0000000', email: 'fixture@example.invalid', sourceUrl: 'https://example.invalid/contact' } });
  const meta = { contactVerificationVersion: 4, verifiedContactIds: [contact.id],
    contactDecisionObservedAt: { [contact.id]: checkedAt.toISOString() }, contactDecisionRevision: { [contact.id]: 1 } };
  audit = await db.dataAuditLog.create({ data: { action: 'SERVICE_MAP_CONTACT_FRESHNESS_CHECK', resourceType: 'ServiceMapContactRegistry', meta } });
  const adapter = municipalDirectoryAdapter(db);
  assert((await adapter.loadRegions()).some(row => row.region === slug.replaceAll('-', '_')));
  const record = { aliases: ['fixture_contact'], region: slug.replaceAll('-', '_'), fields: { name: { value: contact.title }, phone: { value: contact.phone }, email: { value: contact.email } } };
  assert.equal(await adapter.authorizeContact({ record }), true);
  assert.equal(await adapter.authorizeContact({ record: { ...record, region: 'other_vald' } }), false);
  assert.equal(await adapter.authorizeContact({ record: { ...record, aliases: ['another_source'] } }), false);
  record.fields.phone.value = 'outdated'; assert.equal(await adapter.authorizeContact({ record }), false); record.fields.phone.value = contact.phone;
  await db.serviceMapEntry.update({ where: { id: contact.id }, data: { status: 'DRAFT' } });
  assert.equal(await adapter.authorizeContact({ record }), false);
  await db.serviceMapEntry.update({ where: { id: contact.id }, data: { status: 'PUBLISHED', revision: 2 } });
  assert.equal(await adapter.authorizeContact({ record }), false);
  await db.serviceMapEntry.update({ where: { id: contact.id }, data: { revision: 1 } });
  meta.contactDecisionObservedAt[contact.id] = '2000-01-01T00:00:00.000Z';
  await db.dataAuditLog.update({ where: { id: audit.id }, data: { meta } });
  assert.equal(await adapter.authorizeContact({ record }), false);
});
