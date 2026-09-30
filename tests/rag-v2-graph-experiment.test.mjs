import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { id, hash, stable } from '../lib/rag-v2/contracts.js';
import { MockEmbedding, indexUnit } from '../lib/rag-v2/search/embedding.js';
import { searchConfig } from '../lib/rag-v2/search/indexing.js';
import { LocalPolicy } from '../lib/rag-v2/search/policy.js';
import { retrieve } from '../lib/rag-v2/search/retrieval.js';
import { retrievalProfile, queryForProfile, GRAPH_EXPERIMENT_PROFILES, CHAT_PROFILE, CHAT_GRAPH_PROFILE, CHAT_REFERENCES_PROFILE } from '../lib/rag-v2/search/profiles.js';

const savedFetch = globalThis.fetch, savedConnect = net.Socket.prototype.connect;
let network = 0;
before(() => {
  globalThis.fetch = () => { network++; throw Error('unexpected_network'); };
  net.Socket.prototype.connect = () => { network++; throw Error('unexpected_network'); };
});
after(() => { globalThis.fetch = savedFetch; net.Socket.prototype.connect = savedConnect; assert.equal(network, 0); });

// A fictional act of five sections; § 1 names an exception in § 4, which the search does not rank. With numbers, the
// sections are § 1, § 1¹, § 2, § 11 and § 12, and § 1 names "§ 11": ambiguous (§ 1¹ that lost its superscript?) unless the
// version keeps its superscripts (ADR-056).
function fixture({ numbers = null, versionFields = {}, padding = 0 } = {}) {
  const tenant = 'graph-experiment', doc = 'act', version = 'act-v1', embedding = new MockEmbedding(), config = searchConfig(embedding.config);
  const texts = [`Toetust saab täisealine isik, välja arvatud käesoleva seaduse § ${numbers ? '11' : '4'} lõikes 2 nimetatud isik.`, 'Toetus makstakse kord kuus.',
    'Taotlus esitatakse vallale.', '(1) Erandid. (2) Toetust ei saa isik, kes elab hooldekodus.', 'Seadus jõustub 1. jaanuaril.']
    // padding: long sections, so the ranked seeds nearly fill the seeds' budget and a cross-reference passes it.
    .map((text, i) => padding && i !== 4 ? text + ' Selgitus: toetuse andmise kord ja tingimused.'.repeat(i === 3 ? padding / 2 : padding) : text);
  const number = i => numbers ? numbers[i] : String(i + 1);
  const spans = texts.map((text, i) => ({ id: `s${i}`, tenant_id: tenant, document_version_id: version, pdf_page: 1, start: i * 200, source_text: text }));
  const chunks = texts.map((text, i) => {
    const heading = `Väljamõeldud seadus > § ${number(i)}. Jagu ${i + 1}`;
    return { id: `c${i}`, ordinal: i, parent_section_id: `section${i}`, span_ids: [`s${i}`], pdf_pages: [1], source_text: text,
      retrieval_text: `${heading}\n\n${text}`, retrieval_mapping: { prefix_length: heading.length } };
  });
  const bundle = { tenant_id: tenant, version: { id: version, pdf_hash: 'a'.repeat(64), ...versionFields },
    document: { id: doc, rights: { access: 'local_private', usage: 'development_only' }, search_aids: {}, fields: {
      title: { value: 'Väljamõeldud seadus' }, authors: { value: [] }, publication_date: { value: null } } },
    spans, chunks, report: { warnings: [] },
    sections: chunks.map((c, i) => ({ id: `section${i}`, parent_id: null, title: `§ ${number(i)}. Jagu ${i + 1}`, span_ids: [`s${i}`] })),
    relations: chunks.flatMap(c => [{ id: `belongs-${c.id}`, type: 'BELONGS_TO', from_id: c.id, to_id: doc },
      { id: `parent-${c.id}`, type: 'PARENT_SECTION', from_id: c.id, to_id: c.parent_section_id }]) };
  const documents = { [doc]: { version_id: version } }, snapshot = { source_generation: 'source-v1', documents, snapshot_hash: hash(stable(documents)) };
  const generation = { id: id('search_generation', tenant, snapshot, config), config, snapshot };
  const units = chunks.map(c => indexUnit(c, bundle, embedding.config));
  const rows = [0, 1].map(i => ({ ...units[i], score: 100 - i }));
  const postgres = { active: async () => generation, bundles: async (_t, _g, docs) => docs.includes(doc) ? [bundle] : [],
    units: async (_t, _g, docs) => docs.includes(doc) ? units : [], lexical: async () => rows };
  const policy = new LocalPolicy({ tenants: { [tenant]: { operator: [doc] } } });
  const run = (arm, profileId = GRAPH_EXPERIMENT_PROFILES[arm]) => retrieve({ postgres, qdrant: { query: async () => rows }, embedding, policy,
    context: { tenant, subject: 'operator', usage: 'development_only' }, query: queryForProfile(retrievalProfile(profileId), { text: 'toetus', language: 'et' }), allowLexicalFallback: false });
  return { run };
}

test('graph experiment arm D adds the start of the section an own-act cross-reference names; the base adds nothing', async () => {
  const f = fixture();
  const base = await f.run('A');
  assert.deepEqual(base.evidence.map(entry => entry.source_text.slice(0, 20)), ['Toetust saab täiseal', 'Toetus makstakse kor']);
  const references = await f.run('D');
  const added = references.evidence.filter(entry => entry.selection.reason?.type === 'cross_reference');
  assert.deepEqual(added.map(entry => [entry.selection.reason.section, entry.source_text.slice(0, 10)]), [['4', '(1) Erandi']]);
  assert.deepEqual(references.measurements.cross_references, { candidates: 1, additions: 1, sections: ['4'] });
});

test('arm D follows a plain number exactly when the version keeps its superscripts (ADR-056), and leaves it out otherwise', async () => {
  const numbers = ['1', '1¹', '2', '11', '12'];
  const kept = fixture({ numbers, versionFields: { source_format: 'xml', processing_config: { normalization: 'source-structure-v28' } } });
  const added = (await kept.run('D')).evidence.filter(entry => entry.selection.reason?.type === 'cross_reference');
  assert.deepEqual(added.map(entry => [entry.selection.reason.section, entry.source_text.slice(0, 10)]), [['11', '(1) Erandi']]);
  const older = await fixture({ numbers, versionFields: { source_format: 'xml', processing_config: { normalization: 'source-structure-v27' } } }).run('D');
  assert.deepEqual(older.measurements.cross_references, { candidates: 0, additions: 0, sections: [] });
});

test('chat profile v3: a cross-reference past the seeds\' budget stays within its own room; the turn does not fail (30.09.2026)', async () => {
  const packet = await fixture({ padding: 290 }).run(null, CHAT_REFERENCES_PROFILE);
  const added = packet.evidence.filter(entry => entry.selection.reason?.type === 'cross_reference');
  assert.deepEqual(added.map(entry => entry.selection.reason.section), ['4']);
  const { contextTokens, expansionContextTokens } = retrievalProfile(CHAT_REFERENCES_PROFILE).query.limits;
  assert.ok(packet.measurements.context_tokens > contextTokens, 'the case passes the seeds\' budget');
  assert.ok(packet.measurements.context_tokens <= contextTokens + expansionContextTokens);
  assert.notDeepEqual(packet.dependency_context?.unresolved, [{ reason: 'dependency_context_budget' }]);
});

test('graph experiment arms share one extra room; the chat profiles are unchanged', () => {
  const settings = Object.fromEntries(Object.entries(GRAPH_EXPERIMENT_PROFILES).map(([arm, profileId]) => {
    const query = queryForProfile(retrievalProfile(profileId), { text: 'x', language: 'et' });
    return [arm, [query.finalLimit, query.limits.topK, query.limits.contextTokens + (query.limits.dependencyContextTokens ?? 0) + (query.limits.expansionContextTokens ?? 0),
      query.semanticGraph, query.graph, query.references ?? false]];
  }));
  assert.deepEqual(settings, { A: [9, 9, 10000, false, false, false], B: [13, 13, 13000, false, false, false], C: [13, 9, 13000, true, false, false],
    D: [13, 9, 13000, false, false, true], E: [13, 9, 13000, false, true, false] });
  for (const profileId of [CHAT_PROFILE, CHAT_GRAPH_PROFILE]) {
    const query = queryForProfile(retrievalProfile(profileId), { text: 'x', language: 'et' });
    assert.equal('references' in query, false);
    assert.equal(query.limits.expansionContextTokens, undefined);
  }
});
