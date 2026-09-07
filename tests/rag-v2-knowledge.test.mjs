import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { ingest } from '../lib/rag-v2/ingestion.js';
import { hash, id, stable, validateBundle } from '../lib/rag-v2/contracts.js';
import { KNOWLEDGE_SCHEMA, conditionGroupState, validateKnowledgeInput } from '../lib/rag-v2/knowledge.js';
import { MockEmbedding, indexUnit } from '../lib/rag-v2/search/embedding.js';
import { searchConfig } from '../lib/rag-v2/search/indexing.js';
import { PostgresCatalog } from '../lib/rag-v2/search/postgres.js';
import { retrievalProfile, queryForProfile } from '../lib/rag-v2/search/profiles.js';
import { retrieve } from '../lib/rag-v2/search/retrieval.js';
import { dependencyContext } from '../lib/rag-v2/search/dependencies.js';

let root, base, guide;
const tenant = 'knowledge-synthetic', rights = { access: 'local_private', usage: 'development_only' };
const savedFetch = globalThis.fetch, savedConnect = net.Socket.prototype.connect;
const texts = {
  base: 'The synthetic garden handbook describes a planting activity. This statement is a fictional source fixture for the software contract, not practical advice.',
  relation: 'The activity requires either the dry-soil condition or the cold-room condition described in the separate synthetic guide. The alternatives belong to the same activity.',
  dry: 'The fictional dry-soil condition is described here. This source text does not establish that any particular user meets this condition, or that this is a real gardening rule.',
  cold: 'The fictional cold-room condition is described here. This source text does not establish that any particular user meets this condition, or that this is a real gardening rule.',
};
const anchor = (quote, pdf_page) => ({ quote, pdf_page });
const card = (key, quote, page, kind = 'assertion') => ({ key, kind, statement: quote, scope: 'Synthetic development fixture only', anchors: [anchor(quote, page)] });
function parsed(pages) {
  return { info: {}, pages: pages.map((text, i) => ({ pdf_page: i + 1, parser_page_index: i, view: [0, 0, 600, 800],
    items: [{ text, item_index: 0, x: 50, y: 700, height: 12, width: 400, font: 'synthetic', transform: [12, 0, 0, 12, 50, 700] }] })) };
}
async function importDocument(name, pages, knowledge) {
  const dir = path.join(root, name); await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'source.pdf'), `%PDF-1.4\n% synthetic ${name}`);
  await fs.writeFile(path.join(dir, 'metadata.json'), JSON.stringify({ document_id: name, source_type: 'synthetic', title: `Synthetic ${name}`,
    language: 'en', source_path: 'source.pdf', knowledge }));
  return (await ingest({ tenant, inputRoot: dir, metadataFile: 'metadata.json', storeRoot: path.join(root, 'store'), rights,
    profile: { id: 'synthetic', version: '1', months: [], categoryLabels: [] }, config: { chunkMaxChars: 100 } }, { parsePdf: async () => parsed(pages) })).bundle;
}
before(async () => {
  globalThis.fetch = () => { throw Error('unexpected_network'); };
  net.Socket.prototype.connect = () => { throw Error('unexpected_network'); };
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-knowledge-'));
  guide = await importDocument('guide', [texts.dry, texts.cold], { schema_version: KNOWLEDGE_SCHEMA,
    cards: [card('dry', texts.dry, 1, 'condition'), card('cold', texts.cold, 2, 'condition')], dependencies: [] });
  base = await importDocument('base', [texts.base, texts.relation], { schema_version: KNOWLEDGE_SCHEMA,
    cards: [card('activity', texts.base, 1)], dependencies: [{ key: 'needs', type: 'REQUIRES', from: 'activity', operator: 'any',
      scope: 'Synthetic fixture only', anchors: [anchor(texts.relation, 2)],
      targets: ['dry', 'cold'].map(key => ({ key, document_id: guide.document.id, version_id: guide.version.id })) }] });
});
after(async () => {
  globalThis.fetch = savedFetch; net.Socket.prototype.connect = savedConnect;
  const resolved = path.resolve(root);
  assert(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('rag-v2-knowledge-'));
  await fs.rm(resolved, { recursive: true, force: true });
});

function searchFixture(bundles = [base, guide], seedDocument = base) {
  const embedding = new MockEmbedding(), config = searchConfig(embedding.config);
  const documents = Object.fromEntries(bundles.map(bundle => [bundle.document.id, { version_id: bundle.version.id }]));
  const snapshot = { source_generation: 'synthetic', documents, snapshot_hash: hash(stable(documents)) };
  const generation = { id: id('search_generation', tenant, snapshot, config), snapshot, config };
  const units = bundles.flatMap(bundle => bundle.chunks.map(chunk => indexUnit(chunk, bundle, embedding.config)));
  const seed = units.find(unit => unit.document_id === seedDocument.document.id && unit.ordinal === 0), rows = [{ ...seed, score: 1 }];
  let allowed = Object.keys(documents), revision = 'one';
  const postgres = { active: async () => generation,
    bundles: async (_tenant, _generation, ids) => bundles.filter(bundle => ids.includes(bundle.document.id)),
    units: async (_tenant, _generation, ids) => units.filter(unit => ids.includes(unit.document_id)), lexical: async () => rows };
  const policy = { allowed: async () => ({ documents: allowed, revision }) };
  const run = (profile = 'vector-source-dependencies-v1', extra = {}) => retrieve({ postgres, qdrant: { query: async () => rows }, embedding, policy,
    context: { tenant, subject: 'synthetic-operator', usage: 'development_only' }, query: queryForProfile(retrievalProfile(profile), { text: 'planting activity', language: 'en' }), ...extra });
  return { run, units, snapshot, restrict(ids) { allowed = ids; revision = 'two'; } };
}

test('knowledge ingestion preserves exact anchors and unreviewed provenance; changed or fabricated input cannot reuse the version', async () => {
  assert.equal(base.knowledge_cards.length, 1); assert.equal(base.dependencies.length, 1);
  assert.equal(base.dependencies[0].verification_state, 'source_anchored_unreviewed');
  assert.equal(base.dependencies[0].targets[0].document_version_id, guide.version.id);
  for (const entity of [...base.knowledge_cards, ...base.dependencies]) for (const anchor of entity.anchors) {
    assert.equal(base.pages[anchor.pdf_page - 1].raw_text.slice(anchor.start, anchor.end), anchor.quote);
    assert(anchor.span_ids.every(id => base.spans.some(span => span.id === id)));
  }
  for (const field of ['statement', 'verification_state']) {
    const forged = structuredClone(base); forged.knowledge_cards[0][field] = 'forged';
    assert.throws(() => validateBundle(forged), { code: 'knowledge_provenance_mismatch' });
  }
  const changed = structuredClone(base.document.legacy_metadata.knowledge); changed.cards[0].statement += ' A changed imported interpretation.';
  const next = await importDocument('base', [texts.base, texts.relation], changed);
  assert.notEqual(next.version.id, base.version.id);
  const bad = structuredClone(changed); bad.cards[0].anchors[0].quote = 'Text absent from the PDF';
  await assert.rejects(importDocument('base', [texts.base, texts.relation], bad), { code: 'knowledge_anchor_text_mismatch' });
  const reviewed = structuredClone(changed); reviewed.cards[0].verification_state = 'verified';
  assert.throws(() => validateKnowledgeInput(reviewed), { code: 'invalid_knowledge_shape' });
});

test('the PostgreSQL importer persists cards and dependencies as immutable scoped index objects', async () => {
  const versions = new Map(), objects = new Map(), rows = new Map();
  const client = { async query(sql, p) {
    if (sql.startsWith('INSERT INTO rag_v2_version')) versions.set(p[1], { bundle_hash: p[4], bundle: p[3] });
    if (sql.startsWith('SELECT bundle_hash')) return { rows: [versions.get(p[1])] };
    if (sql.startsWith('INSERT INTO rag_v2_object')) objects.set(`${p[1]}/${p[2]}`, { version: p[1], id: p[2], kind: p[3], data: p[4], from: p[5], to: p[6] });
    if (sql.startsWith('SELECT id,data FROM rag_v2_object')) return { rows: [...objects.values()].filter(row => row.version === p[1]) };
    if (sql.startsWith('INSERT INTO rag_v2_unit')) rows.set(p[2], { id: p[2], data: p[7] });
    if (sql.startsWith('SELECT id,data FROM rag_v2_unit')) return { rows: [...rows.values()] };
    return { rows: [] };
  } };
  const postgres = Object.create(PostgresCatalog.prototype); postgres.transaction = fn => fn(client);
  const f = searchFixture();
  await postgres.importSnapshot({ tenant, bundles: [base, guide], assets: { [base.version.id]: {}, [guide.version.id]: {} } }, 'synthetic-generation', f.units);
  assert.equal([...objects.values()].filter(row => row.kind === 'knowledge_card').length, 3);
  const dependency = [...objects.values()].find(row => row.kind === 'dependency');
  assert.deepEqual(dependency.data, base.dependencies[0]); assert.equal(dependency.from, null); assert.equal(dependency.to, null);
  assert.equal(dependency.version, base.version.id);
});

test('dependency retrieval brings a distant relation and cross-document alternatives with real reference bindings', async () => {
  const f = searchFixture(), plain = await f.run('vector-ranked-first-v1'), packet = await f.run();
  assert.equal(packet.state, 'ok'); assert.equal(plain.evidence.length, 1); assert.equal(plain.model_context.dependencies, undefined);
  assert.equal(packet.evidence[0].chunk_id, plain.evidence[0].chunk_id);
  assert.equal(packet.evidence.length, 4); assert.equal(packet.measurements.dependency_additions, 3);
  const context = packet.model_context.dependencies;
  assert.equal(context.known_context, 'included'); assert.equal(context.claims.length, 3);
  assert.equal(context.relations[0].operator, 'any'); assert.equal(context.relations[0].applicability, 'unknown');
  assert.equal(context.relations[0].verification_state, 'source_anchored_unreviewed');
  for (const item of [...context.claims, ...context.relations]) assert(item.refs.every(ref => packet.reference_map[ref]));
  assert(context.relations[0].refs.some(ref => packet.model_context.evidence.find(e => e.ref === ref).text === texts.relation));
});

test('unavailable versions, live revocation and token limits retain explicit missing-context state without leaking source text', async () => {
  const f = searchFixture(); f.restrict([base.document.id]);
  const denied = await f.run();
  assert.equal(denied.state, 'ok'); assert.equal(denied.model_context.dependencies.known_context, 'incomplete');
  assert(!JSON.stringify(denied.model_context).includes(texts.dry));
  const revoked = searchFixture();
  const late = await revoked.run(undefined, { hooks: { beforePolicyCheck: async () => revoked.restrict([base.document.id]) } });
  assert(!JSON.stringify(late.model_context).includes(texts.cold));
  assert.equal(late.model_context.dependencies.known_context, 'incomplete');
  const query = queryForProfile(retrievalProfile('vector-source-dependencies-v1'), { text: 'planting activity', language: 'en' });
  query.limits.dependencyAdditions = 1;
  const limited = await searchFixture().run(undefined, { query });
  assert.equal(limited.model_context.dependencies.known_context, 'incomplete');
  assert(limited.measurements.context_tokens <= query.limits.contextTokens);
  assert.equal(limited.measurements.dependency_additions, 1);
  const changedKnowledge = structuredClone(guide.document.legacy_metadata.knowledge);
  changedKnowledge.cards[0].statement += ' Updated interpretation.';
  const newerGuide = await importDocument('guide', [texts.dry, texts.cold], changedKnowledge);
  const stale = await searchFixture([base, newerGuide]).run();
  assert.equal(stale.model_context.dependencies.known_context, 'incomplete');
  assert(stale.model_context.dependencies.unresolved.some(item => item.reason === 'dependency_target_unavailable'));
  assert(!stale.evidence.some(entry => entry.document_id === guide.document.id));
  const full = await searchFixture().run();
  const wrongOwner = structuredClone(base.dependencies[0]);
  wrongOwner.document_id = base.document.id;
  wrongOwner.targets[0].document_id = base.document.id;
  const cards = [...base.knowledge_cards.map(card => ({ ...card, document_id: base.document.id })),
    ...guide.knowledge_cards.map(card => ({ ...card, document_id: guide.document.id }))];
  const mismatch = dependencyContext({ cards: new Map(cards.map(card => [card.id, card])), relevant: new Set(cards.map(card => card.id)),
    edges: [wrongOwner], unresolved: [] }, full.evidence, [base.document.id, guide.document.id]);
  assert.equal(mismatch.relations.length, 0); assert.equal(mismatch.known_context, 'incomplete');
});

test('an incoming exception is retrieved from its source without reversing the relation or inventing applicability', async () => {
  const quote = 'This fictional source describes an exception to the planting activity. The exception is not a real service rule and has no known applicability to a user.';
  const exception = await importDocument('exception', [quote], { schema_version: KNOWLEDGE_SCHEMA,
    cards: [card('exception', quote, 1, 'exception')], dependencies: [{ key: 'qualifies-base', type: 'EXCEPTION_TO', from: 'exception', operator: 'all',
      scope: 'Synthetic fixture only', anchors: [anchor(quote, 1)], targets: [{ key: 'activity', document_id: base.document.id, version_id: base.version.id }] }] });
  const packet = await searchFixture([base, guide, exception]).run();
  const context = packet.model_context.dependencies, relation = context.relations.find(item => item.type === 'EXCEPTION_TO');
  assert.equal(packet.state, 'ok'); assert(relation);
  assert.equal(context.claims.find(item => item.key === relation.from).kind, 'exception');
  assert.equal(context.claims.find(item => item.key === relation.targets[0]).statement, texts.base);
  assert.equal(relation.applicability, 'unknown');
  assert(packet.evidence.some(entry => entry.source_text === quote));
  const fromException = await searchFixture([exception, guide, base], exception).run();
  assert.equal(fromException.state, 'ok');
  assert(fromException.evidence.some(entry => entry.source_text === texts.base));
  assert(fromException.model_context.dependencies.relations.some(item => item.type === 'EXCEPTION_TO'));
  const revoked = searchFixture([exception, guide, base], exception);
  const late = await revoked.run(undefined, { hooks: { beforePolicyCheck: async () => revoked.restrict([base.document.id, guide.document.id]) } });
  assert(!JSON.stringify(late.model_context).includes(quote));
  assert(!JSON.stringify(late.evidence).includes(exception.dependencies[0].id));
});

test('cyclic local dependencies terminate and missing user facts remain unknown in all/any groups', async () => {
  const pages = [texts.base, texts.dry];
  const cyclic = await importDocument('cycle', pages, { schema_version: KNOWLEDGE_SCHEMA,
    cards: [card('a', pages[0], 1), card('b', pages[1], 2, 'condition')],
    dependencies: [{ key: 'ab', type: 'REQUIRES', from: 'a', targets: [{ key: 'b' }], operator: 'all', scope: 'Synthetic cycle', anchors: [anchor(pages[0], 1)] },
      { key: 'ba', type: 'REQUIRES', from: 'b', targets: [{ key: 'a' }], operator: 'all', scope: 'Synthetic cycle', anchors: [anchor(pages[1], 2)] }] });
  const previous = base; base = cyclic;
  try {
    const packet = await searchFixture([cyclic]).run();
    assert.equal(packet.state, 'ok'); assert.equal(packet.measurements.dependency_steps, 2);
    assert.equal(packet.model_context.dependencies.relations.length, 2);
  } finally { base = previous; }
  assert.equal(conditionGroupState('all', ['true', 'unknown']), 'unknown');
  assert.equal(conditionGroupState('any', ['false', 'unknown']), 'unknown');
  assert.equal(conditionGroupState('all', ['true', 'false']), 'false');
  assert.equal(conditionGroupState('any', ['true', 'false']), 'true');
  assert.equal(conditionGroupState('any', ['true', 'conflict']), 'conflict');
});
