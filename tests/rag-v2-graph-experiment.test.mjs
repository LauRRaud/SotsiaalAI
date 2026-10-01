import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { id, hash, stable } from '../lib/rag-v2/contracts.js';
import { MockEmbedding, indexUnit } from '../lib/rag-v2/search/embedding.js';
import { searchConfig } from '../lib/rag-v2/search/indexing.js';
import { LocalPolicy } from '../lib/rag-v2/search/policy.js';
import { retrieve } from '../lib/rag-v2/search/retrieval.js';
import { retrievalDirectory } from '../lib/rag-v2/search/discovery.js';
import { retrievalProfile, queryForProfile, GRAPH_EXPERIMENT_PROFILES, CHAT_PROFILE, CHAT_GRAPH_PROFILE, CHAT_REFERENCES_PROFILE, CHAT_NAMED_ACTS_PROFILE } from '../lib/rag-v2/search/profiles.js';

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

// ADR-063: a municipal procedure whose ranked passage names the Social Welfare Act's § 25 lõige 2. The act is a national
// legal text of the scope (a validity start, no region); its § 25 lies in two passages, lõige 2 in the second. A second
// document with the same title makes the name ambiguous. directory: the search works from the retrieval directory, as
// the chat does; it has no titles, so they come from the unit rows (titles: what those rows say, the documents' own by default).
// source: the pointing document's version fields; pointer: the words it names the section with; sections: the act's
// other section numbers (Codex review of #301: a number is read as exactly as the pointing text keeps it).
function namedActFixture({ twin = false, sameAct = false, directory = false, titles = null, source = {}, pointer: named = null, sections: numbers = null } = {}) {
  const tenant = 'named-acts', embedding = new MockEmbedding(), config = searchConfig(embedding.config);
  const act = (doc, title, fields, sections, versionFields = {}) => {
    const version = `${doc}-v1`, spans = [], chunks = [], source_units = [];
    sections.forEach(([number, passages], unit) => {
      const raw = passages.join('\n'); source_units.push({ raw_text: raw });
      passages.forEach(text => {
        const i = chunks.length, heading = `${title} > § ${number}. Jagu`, start = raw.indexOf(text);
        spans.push({ id: `${doc}-s${i}`, tenant_id: tenant, document_version_id: version, pdf_page: 1, source_unit_index: unit, start, end: start + text.length, source_text: text });
        chunks.push({ id: `${doc}-c${i}`, ordinal: i, parent_section_id: `${doc}-section${unit}`, span_ids: [`${doc}-s${i}`], pdf_pages: [1], source_text: text,
          retrieval_text: `${heading}\n\n${text}`, retrieval_mapping: { prefix_length: heading.length } });
      });
    });
    return { tenant_id: tenant, version: { id: version, pdf_hash: 'a'.repeat(64), ...versionFields },
      document: { id: doc, rights: { access: 'local_private', usage: 'development_only' }, search_aids: {},
        fields: { title: { value: title }, authors: { value: [] }, publication_date: { value: null }, ...fields } },
      spans, chunks, source_units, report: { warnings: [] },
      sections: sections.map(([number], unit) => ({ id: `${doc}-section${unit}`, parent_id: null, title: `§ ${number}. Jagu`, span_ids: [] })),
      relations: chunks.flatMap(c => [{ id: `belongs-${c.id}`, type: 'BELONGS_TO', from_id: c.id, to_id: doc },
        { id: `parent-${c.id}`, type: 'PARENT_SECTION', from_id: c.id, to_id: c.parent_section_id }]) };
  };
  const pointer = named ?? (sameAct ? 'käesoleva korra § 2' : 'sotsiaalhoolekande seaduse § 25 lõikes 2');
  const local = act('kord', 'Abi andmise kord', { valid_from: { value: '2026-01-01' }, regions: { value: ['harku_vald'] } },
    [['15', [`Tugiisikuteenust ei osuta isik, kes on ${pointer} nimetatud isik.`]], ['2', ['Teenuse osutamise otsustab osakond.']]], source);
  // The act itself is a Riigi Teataja XML that keeps its superscripts, whatever the pointing document is.
  const national = (doc = 'shs') => act(doc, 'Sotsiaalhoolekande seadus', { valid_from: { value: '2026-10-01' } },
    [['24', ['Tugiisikuteenuse eesmärk on toetada iseseisvat toimetulekut.']],
      ['25', ['(1)\nKohaliku omavalitsuse üksus loob isikule võimalused teenuse saamiseks.\n(2)', 'Tugiisikuteenust ei või osutada isik, kes on teenuse saaja alaneja või üleneja sugulane.']],
      ...(numbers || []).map(number => [number, [`Paragrahvi ${number} tekst.`]])],
    { source_format: 'xml', processing_config: { normalization: 'source-structure-v30' } });
  const bundles = [local, national(), ...(twin ? [national('shs-teine')] : [])], byDoc = new Map(bundles.map(b => [b.document.id, b]));
  const documents = Object.fromEntries(bundles.map(b => [b.document.id, { version_id: b.version.id }])), snapshot = { source_generation: 'source-v1', documents, snapshot_hash: hash(stable(documents)) };
  const generation = { id: id('search_generation', tenant, snapshot, config), config, snapshot };
  const units = bundles.flatMap(b => b.chunks.map(c => indexUnit(c, b, embedding.config)));
  const rows = [{ ...units[0], score: 100 }];
  const postgres = { active: async () => generation, bundles: async (_t, _g, docs) => docs.map(doc => byDoc.get(doc)).filter(Boolean),
    units: async (_t, _g, docs) => units.filter(unit => docs.includes(unit.document_id)), lexical: async () => rows,
    ...(directory ? { retrievalDirectory: async (_t, _g, docs) => docs.map(doc => retrievalDirectory(byDoc.get(doc), config.embedding, config.directory)),
      documentTitles: async (_t, _g, docs) => new Map(docs.map(doc => [doc, titles?.[doc] ?? byDoc.get(doc).document.fields.title.value])) } : {}) };
  const policy = new LocalPolicy({ tenants: { [tenant]: { operator: [...byDoc.keys()] } } });
  return profileId => retrieve({ postgres, qdrant: { query: async () => rows }, embedding, policy, context: { tenant, subject: 'operator', usage: 'development_only' },
    query: queryForProfile(retrievalProfile(profileId), { text: 'tugiisik', language: 'et' }), allowLexicalFallback: false });
}

test('chat profile v4 adds the passage that holds the subsection a selected passage names in another act; v3 adds nothing', async () => {
  const picture = packet => packet.evidence.map(entry => [entry.document_id, entry.selection.reason?.type ?? entry.selection.reason, entry.source_text.slice(0, 22)]);
  const v3 = await namedActFixture()(CHAT_REFERENCES_PROFILE);
  assert.deepEqual(picture(v3), [['kord', 'ranked_seed', 'Tugiisikuteenust ei os']]);
  assert.equal(v3.measurements.named_act_references, undefined);
  const v4 = await namedActFixture()(CHAT_NAMED_ACTS_PROFILE);
  assert.equal(v4.state, 'ok');
  // Lõige 2 lies in § 25's second passage: that one is added, not the section's start.
  assert.deepEqual(picture(v4), [['kord', 'ranked_seed', 'Tugiisikuteenust ei os'], ['shs', 'cross_reference', 'Tugiisikuteenust ei võ']]);
  assert.deepEqual(v4.evidence[1].selection.reason, { type: 'cross_reference', seed_evidence_id: v4.evidence[0].evidence_id, section: '25', named_act: 'shs' });
  assert.deepEqual(v4.measurements.named_act_references, { candidates: 1, additions: 1, acts: ['shs:25'] });
  // The chat's route, from the retrieval directory: the same addition, the act found by the title its unit rows carry.
  const viaDirectory = await namedActFixture({ directory: true })(CHAT_NAMED_ACTS_PROFILE);
  assert.equal(viaDirectory.measurements.loading.strategy, 'candidate_documents');
  assert.deepEqual([picture(viaDirectory), viaDirectory.measurements.named_act_references], [picture(v4), v4.measurements.named_act_references]);
  // A unit row's title that the loaded source does not have names nothing.
  const mistitled = await namedActFixture({ directory: true, twin: true, titles: { shs: 'Muu seadus', 'shs-teine': 'Muu seadus', kord: 'Sotsiaalhoolekande seadus' } })(CHAT_NAMED_ACTS_PROFILE);
  assert.deepEqual([picture(mistitled).length, mistitled.measurements.named_act_references], [1, { candidates: 0, additions: 0, acts: [] }]);
  // Two documents of the scope with the act's title: the name is nobody's, nothing is added.
  const twin = await namedActFixture({ twin: true })(CHAT_NAMED_ACTS_PROFILE);
  assert.deepEqual([picture(twin).length, twin.measurements.named_act_references], [1, { candidates: 0, additions: 0, acts: [] }]);
  // The act's own cross-reference is v3's addition in both profiles; v4 adds nothing more to it.
  const own = profileId => namedActFixture({ sameAct: true })(profileId).then(packet => [picture(packet), packet.measurements.cross_references]);
  assert.deepEqual((await own(CHAT_NAMED_ACTS_PROFILE)), await own(CHAT_REFERENCES_PROFILE));
  assert.deepEqual((await own(CHAT_NAMED_ACTS_PROFILE))[1], { candidates: 1, additions: 1, sections: ['2'] });
});

test('chat profile v4 is v3 with two more places for a named other act, in the cross-references\' room', () => {
  const settings = profileId => {
    const { finalLimit, limits, ...flags } = queryForProfile(retrievalProfile(profileId), { text: 'x', language: 'et' });
    return { finalLimit, limits, flags };
  };
  const v3 = settings(CHAT_REFERENCES_PROFILE), v4 = settings(CHAT_NAMED_ACTS_PROFILE);
  assert.deepEqual([v3.finalLimit, v3.limits.perDocument, v3.flags.namedActs, v3.limits.namedActAdditions], [13, 13, undefined, undefined]);
  assert.deepEqual(v4, { finalLimit: 15, limits: { ...v3.limits, perDocument: 15, namedActAdditions: 2 }, flags: { ...v3.flags, namedActs: true } });
});

// Codex review of #301: the number of a named section is read as exactly as the POINTING text keeps its numbers. The act
// here always keeps its superscripts (XML v30); what decides is the document the pointer stands in.
test('chat profile v4 reads a named section\'s number by the pointing document: a text that may have lost a superscript names § 131 only when it can be nothing else', async () => {
  const pdf = { source_format: 'pdf' }, older = { source_format: 'xml', processing_config: { normalization: 'source-structure-v27' } };
  const exact = { source_format: 'xml', processing_config: { normalization: 'source-structure-v30' } };
  const added = async options => {
    const result = {};
    for (const directory of [false, true]) {
      const packet = await namedActFixture({ ...options, directory })(CHAT_NAMED_ACTS_PROFILE);
      assert.equal(packet.state, 'ok');
      result[directory ? 'directory' : 'eager'] = packet.evidence.filter(entry => entry.selection.reason?.named_act).map(entry => [entry.selection.reason.section, entry.source_text]);
    }
    assert.deepEqual(result.directory, result.eager);
    return result.eager;
  };
  const plain = 'sotsiaalhoolekande seaduse § 131', written = 'sotsiaalhoolekande seaduse § 13¹';
  for (const source of [pdf, older]) {
    // The act has § 13¹ and § 131: the pointing text's "131" could be either, so neither is added.
    assert.deepEqual(await added({ source, pointer: plain, sections: ['13¹', '131'] }), []);
    // The act has only § 13¹: that is the one section the number can be.
    assert.deepEqual(await added({ source, pointer: plain, sections: ['13¹'] }), [['13^1', 'Paragrahvi 13¹ tekst.']]);
    // A superscript the text does have is exact in any source.
    assert.deepEqual(await added({ source, pointer: written, sections: ['13¹', '131'] }), [['13^1', 'Paragrahvi 13¹ tekst.']]);
  }
  // A pointing text that keeps its superscripts: "131" is § 131, and with only § 13¹ in the act it names nothing.
  assert.deepEqual(await added({ source: exact, pointer: plain, sections: ['13¹', '131'] }), [['131', 'Paragrahvi 131 tekst.']]);
  assert.deepEqual(await added({ source: exact, pointer: plain, sections: ['13¹'] }), []);
});
