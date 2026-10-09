import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { GATE_RUN_VERSION, DECIDES, qdrantOnly, validateGateCatalogue, releasedPlan, gateQuery, forcedScope, questionInput, searchIdentity, observeKnowledge, observeRecords, gateRow, replayQuestion,
  compareRow, refusal, compareRuns } from '../scripts/lib/rag-v2-search-gate.mjs';
import { id, hash, stable } from '../lib/rag-v2/contracts.js';
import { runtimeAdapters } from '../lib/rag-v2/pilot/retrieval.js';
import { retrievalPlan } from '../lib/rag-v2/pilot/retrieval-plan.js';
import { DIALOGUE_VERSION, DIALOGUE_SEARCH_VERSION } from '../lib/rag-v2/pilot/dialogue.js';
import { REGION_STATE_VERSION } from '../lib/rag-v2/pilot/dialogue-state.js';
import { SEARCH_ASSIST_VERSION } from '../lib/rag-v2/pilot/search-assist.js';
import { RECORD_RETRIEVAL_VERSION } from '../lib/rag-v2/search/structured-record-source.js';
import { MockEmbedding, indexUnit } from '../lib/rag-v2/search/embedding.js';
import { searchConfig } from '../lib/rag-v2/search/indexing.js';
import { retrievalDirectory } from '../lib/rag-v2/search/discovery.js';
import { ESTNLTK_LEXICAL } from '../lib/rag-v2/search/morphology.js';
import { retrievalProfile, CHAT_SUBSECTIONS_PROFILE } from '../lib/rag-v2/search/profiles.js';
import { collectionName, pointId } from '../lib/rag-v2/search/qdrant.js';
import { UNIFIED_RETRIEVAL_VERSION, NATIONAL_LAW_RESERVE } from '../lib/rag-v2/search/unified.js';

// ADR-122 (10.10.2026): the search gate's rules, on made-up passages and packets. No database, no model: the search is
// a stand-in that hands the hook its candidates and returns a packet of the shape the chat's search returns (the merged
// packet of retrieval.js: evidence, lanes, the catalogue, timings). The last test runs the chat's own search instead,
// over a made-up index held in memory.
const config = { id: 'm4-gate-test', dialogueVersion: DIALOGUE_VERSION, dialogueStateVersion: REGION_STATE_VERSION, searchAssist: SEARCH_ASSIST_VERSION, recordCatalogue: RECORD_RETRIEVAL_VERSION,
  generationId: 'generation-a', profileId: 'hybrid-estnltk-chat-v6', documents: { 'doc-act': 'version-1', 'doc-guide': 'version-1' }, embedding: { model: 'mock-sha256-v1', dimensions: 4 }, configHash: 'c'.repeat(64) };
const QUESTION = { id: 'subsistence-housing-limit', kind: 'within_document', text: 'Kas toimetulekutoetuse arvestamisel võetakse arvesse ka kodulaenu makse?',
  queries: ['toimetulekutoetuse arvestamisel arvesse võetavad eluasemekulud', 'eluasemelaenu tagasimakse toimetulekutoetus'],
  evidence_text: ['eluruumi soetamiseks võetud laenu tagasimakse', 'kuni kuue kuu jooksul'] };
const LOCAL = { id: 'harku-home-service', kind: 'across_documents', region: 'harku_vald', text: 'Kuidas koduteenust taotleda?', queries: ['Harku valla koduteenuse taotlemine'], evidence_text: ['koduteenuse taotlus esitatakse'] };
const vector = seed => [seed, 0.5, 0.25, 0.125];
const VECTORS = new Map([QUESTION.text, ...QUESTION.queries, LOCAL.text, ...LOCAL.queries].map((text, index) => [text, vector(index + 1)]));

// The candidates the hook receives (retrieval.js): id, title, the indexed text, and a legal act's validity.
const ACT = 'Sotsiaalhoolekande seadus', GUIDE = 'Toimetulekutoetuse juhend kohalikule omavalitsusele', ORDER = 'Sotsiaalhoolekandelise abi andmise kord';
const passage = (place, title, text, act = false) => ({ id: `P${place}`, title, ...(act ? { valid_from: '2026-01-01', valid_to: null } : {}), text: `${title}\n\n${text}` });
const POOL = [
  passage(1, GUIDE, 'Toimetulekutoetuse arvestamise aluseks on eelmise kuu sissetulek.'),
  passage(2, ACT, 'Eluasemekulude hulka arvatakse eluruumi soetamiseks\n   võetud laenu  tagasimakse.', true),
  passage(3, ACT, 'Toimetulekupiiri kehtestab Riigikogu riigieelarvega.', true),
  passage(4, GUIDE, 'Laenu arvestatakse kuni kuue kuu jooksul kalendriaastas.'),
  passage(5, ACT, 'Toetuse määramisel võib arvestada vara.', true),
  passage(6, ORDER, 'Koduteenuse taotlus esitatakse vallavalitsusele.', true),
];
// A contact of the catalogue, with a made-up person: its name and address must never reach a row, hashed or not.
const CONTACT = { name: 'Näidis Isik', email: 'naidis.isik@example.invalid' };
const entry = (key, kind, detail, id, title) => ({ key, record_id: id, kind, region: 'harku_vald', detail, fields: { [kind === 'contact' ? 'name' : 'title']: { value: title, refs: ['S3'] } } });
function packet({ evidence = [POOL[0], POOL[1]], rerank = null, records = true, tokens = 9100 } = {}) {
  const knowledge = evidence.map((item, index) => ({ evidence_id: `evidence_${index}`, document_id: `doc-${index}`, unit_id: `unit_${index}`, source_text: item.text.split('\n\n')[1],
    bibliography: { title: item.title }, selection: { reason: 'ranked_seed' } }));
  return { tenant: 'tenant', generation_id: config.generationId, state: 'ok', ...(rerank ? { rerank } : {}),
    evidence: [...knowledge, { evidence_id: 'evidence_record', document_id: 'harku-contact-1', unit_id: 'unit_record', source_text: `${CONTACT.name}\nsotsiaaltööspetsialist\n${CONTACT.email}`,
      bibliography: { title: CONTACT.name }, selection: { reason: 'structured_record' } }],
    retrieval_context: { lanes: [{ key: 'knowledge', kind: 'knowledge', refs: knowledge.map((_, index) => `S${index + 1}`) }, { key: 'records', kind: 'local_records', refs: [`S${knowledge.length + 1}`] }] },
    ...(records ? { record_context: { version: RECORD_RETRIEVAL_VERSION, region: 'harku_vald', view: 'titles', catalogue_count: 41, listed_count: 41, relevant_summaries: 9, completeness: 'complete_within_authorized_indexed_scope',
      entries: [entry('R1', 'service', 'relevant_detail', 'harku-koduteenus', 'Koduteenus'), entry('R2', 'service', 'relevant_summary', 'harku-sotsiaaltransport', 'Sotsiaaltransport'),
        entry('R3', 'benefit', 'catalogue', 'harku-sunnitoetus', 'Sünnitoetus'), entry('R4', 'resource', 'contact_directory', 'harku-kontaktid', 'Sotsiaalosakonna kontaktid'),
        entry('R5', 'contact', 'catalogue', 'harku-contact-1', CONTACT.name)], scope: forcedScope('harku_vald') } } : {}),
    measurements: { model_context_tokens: tokens }, search_timings: { since_start_ms: { directory: 20, merged: 812 }, lanes: { knowledge: { lane: 640, lexical: 210 }, records: { lane: 330 } } } };
}
// The chat's search as the gate calls it, without an index: the place check, the scope decision and the search, in the
// order they were called.
function stand({ pool = POOL, returned = packet(), fails = null } = {}) {
  const calls = [];
  return { calls,
    async checkedPlaces(_config, query, places) { calls.push({ step: 'places', places, turns: query.scopeTurns.length }); return []; },
    async searchScope() { calls.push({ step: 'own_scope' }); return { scope: { state: 'region_required', region: null }, knowledgeRegion: { state: 'region_required', region: null } }; },
    async unifiedSearch(_config, query, questionVector, assist) {
      const { knowledgeRegion } = await this.searchScope();
      if (fails) throw Object.assign(new Error(`${fails}: ${query.text}`), { code: fails });
      calls.push({ step: 'search', text: query.text, places: query.places, language: query.language, region: knowledgeRegion.region, vector: questionVector, variants: assist.variants,
        vectors: [...(await assist.vectors)], selected: await assist.rerank(pool) });
      return returned;
    } };
}

test('the repository\'s graph catalogues are questions the gate takes, all together; a question the plan, the row or the scope could not carry is named', async () => {
  const questions = [];
  for (const name of ['abbreviation-municipal-1', 'hard-conditions-1', 'hard-conditions-2', 'hard-conditions-3', 'maintenance-duty-1']) {
    questions.push(...JSON.parse(await fs.readFile(new URL(`./evaluation/graph/${name}.json`, import.meta.url), 'utf8')).questions);
  }
  assert.equal(questions.length > 30, true);
  assert.deepEqual(validateGateCatalogue({ questions }), []);
  assert.deepEqual(validateGateCatalogue({ questions: [QUESTION, LOCAL] }), []);
  // A question without a deciding phrase is still replayed: its candidates and its catalogue are compared.
  assert.deepEqual(validateGateCatalogue({ questions: [{ id: 'no-phrase', text: 'Kes maksab hooldekodu koha eest?', queries: [] }] }), []);
  const bad = change => validateGateCatalogue({ questions: [QUESTION, { ...LOCAL, ...change }] });
  assert.deepEqual(bad({ id: QUESTION.id }), [QUESTION.id]);
  assert.deepEqual(bad({ id: 'Harku teenus' }), ['Harku teenus']);
  assert.deepEqual(bad({ text: ' Kuidas koduteenust taotleda?' }), [LOCAL.id]);
  assert.deepEqual(bad({ region: 'Harku vald' }), [LOCAL.id]);
  assert.deepEqual(bad({ evidence_text: [''] }), [LOCAL.id]);
  assert.deepEqual(bad({ queries: undefined }), [LOCAL.id]);
  // Queries the plan's own check would not keep as written: a fourth one, a repeat, the question itself, loose spacing.
  for (const queries of [['a', 'b', 'c', 'd'], ['koduteenus', 'Koduteenus'], [LOCAL.text], ['Harku  valla koduteenus'], ['x'.repeat(301)], [7]]) assert.deepEqual(bad({ queries }), [LOCAL.id]);
  assert.deepEqual(validateGateCatalogue({ questions: [] }), ['questions']);
  assert.deepEqual(validateGateCatalogue({ acts: [] }), ['questions']);
});

test('the query is a first message\'s, and the adapter\'s own place check, scope and period reading take it; the forced scope is what a plan that names the municipality gives', async () => {
  const query = gateQuery(LOCAL, config);
  assert.deepEqual({ ...query, hash: null, cacheKey: null, tokens: null }, { text: LOCAL.text, question: LOCAL.text, version: DIALOGUE_SEARCH_VERSION, hash: null, tokens: null, cacheKey: null,
    strictFilters: {}, scopeTurns: [{ turnId: `gate-${LOCAL.id}`, text: LOCAL.text, mode: 'new' }], previousState: null, recordFocus: [], language: 'et' });
  // The adapter of retrieval.js with a directory and a stand-in for EstNLTK, as tests/rag-v2-question-region.test.mjs has it.
  const lemmas = { valla: 'vald', vallas: 'vald' };
  const analyzer = { analyze: async words => words.map(word => { const lower = word.toLowerCase(); return `vmet${lower}${lemmas[lower] ? ` vmet${lemmas[lower]}` : ''}`; }) };
  const directory = [['harku_vald', 'Harku vald', 'Harku'], ['kose_vald', 'Kose vald', 'Kose']].map(([region, ...names]) => ({ region, names }));
  const runtime = runtimeAdapters(async () => config, 'user-1', { loadRegions: async () => directory, analyzer });
  query.places = await runtime.checkedPlaces(config, query, []);
  assert.deepEqual(query.places, []);
  assert.deepEqual((await runtime.searchScope(config, query, directory, LOCAL.queries)).knowledgeRegion, forcedScope('harku_vald'));
  assert.equal((await runtime.searchScope(config, query, directory, [])).knowledgeRegion.region, null);
  assert.deepEqual(retrievalPlan(query, '2026-10-10').temporal, { state: 'no_period', periods: [] });
});

test('a question is replayed in the service\'s order with the saved vectors, and the hook keeps the candidates and selects nothing', async () => {
  const search = stand(), row = await replayQuestion(search, config, QUESTION, VECTORS);
  assert.deepEqual(search.calls.map(call => call.step), ['places', 'own_scope', 'search']);
  assert.deepEqual(search.calls[0], { step: 'places', places: [], turns: 1 });
  const call = search.calls[2];
  assert.deepEqual([call.text, call.places, call.language, call.region, call.variants, call.selected], [QUESTION.text, [], 'et', null, QUESTION.queries, null]);
  assert.deepEqual(call.vector, VECTORS.get(QUESTION.text));
  assert.deepEqual(call.vectors, QUESTION.queries.map(text => [text, VECTORS.get(text)]));
  assert.deepEqual([row.id, row.state, row.pool.length], [QUESTION.id, 'ok', POOL.length]);

  // A question that names its municipality is searched there, for that call only: the adapter's own scope is not asked,
  // and the adapter is left as it was.
  const local = stand(), own = local.searchScope;
  await replayQuestion(local, config, LOCAL, VECTORS);
  assert.deepEqual(local.calls.map(call => call.step), ['places', 'search']);
  assert.equal(local.calls[1].region, 'harku_vald');
  assert.equal(local.searchScope, own);
  assert.deepEqual(Object.keys(local), ['calls', 'checkedPlaces', 'searchScope', 'unifiedSearch']);

  // One text without a saved vector: the question is skipped and nothing of the search is called.
  for (const missing of [QUESTION.text, QUESTION.queries[1]]) {
    const untouched = stand(), partial = new Map(VECTORS);
    partial.delete(missing);
    assert.deepEqual(await replayQuestion(untouched, config, QUESTION, partial), { id: QUESTION.id, state: 'skipped_no_vector' });
    assert.deepEqual(untouched.calls, []);
  }
  // A failed search is the question's row: its code, never the message, which here quotes the question.
  const failed = await replayQuestion(stand({ fails: 'active_index_mismatch' }), config, QUESTION, VECTORS);
  assert.deepEqual(failed, { id: QUESTION.id, state: 'error', error: 'active_index_mismatch' });
  // A lane with no candidate never calls the hook: the row has an empty list, not an error.
  const empty = { ...stand(), async unifiedSearch() { return packet({ evidence: [] }); } };
  assert.deepEqual((await replayQuestion(empty, config, QUESTION, VECTORS)).pool, []);
});

test('a row holds hashes, places, counts and times: no text, title, phrase, id or name of the fixture', async () => {
  const row = await replayQuestion(stand(), config, QUESTION, VECTORS), text = JSON.stringify(row);
  assert.deepEqual(Object.keys(row), ['id', 'state', 'pool', 'reserve_from', 'largest_document', 'deciding', 'fallback', 'records', 'ms']);
  assert.equal(row.pool.length, POOL.length);
  for (const pair of row.pool) assert.match(pair.join(' '), /^[0-9a-f]{16} [0-9a-f]{16}$/u);
  // One title, one hash: the three passages of the act share theirs, and the act is the largest document.
  assert.deepEqual([new Set(row.pool.map(([, title]) => title)).size, row.largest_document], [3, 3]);
  assert.equal(row.pool[1][1], row.pool[2][1]);
  // Each phrase by its own place; the first one stands in its passage over a line break and other spacing.
  assert.deepEqual(row.deciding, [2, 4]);
  assert.deepEqual(row.fallback, { evidence: row.fallback.evidence, context_tokens: 9100 });
  // The knowledge lane's two excerpts; the catalogue's excerpt, a contact's own text, is not hashed at all.
  assert.equal(row.fallback.evidence.length, 2);
  assert.deepEqual(row.records, { region: 'harku_vald', view: 'titles', catalogue_count: 41, listed_count: 41, relevant_summaries: 9, completeness: 'complete_within_authorized_indexed_scope',
    details: { relevant_detail: 1, relevant_summary: 1, catalogue: 2, contact_directory: 1 }, contacts: 1 });
  assert.deepEqual(row.ms, { search: 812, knowledge: 640, records: 330 });
  const clear = [QUESTION.text, ...QUESTION.queries, ...QUESTION.evidence_text, ACT, GUIDE, ORDER, CONTACT.name, CONTACT.email, 'Koduteenus', 'harku-koduteenus', 'harku-contact-1', 'doc-0', 'unit_0', 'evidence_0', 'P1',
    ...POOL.flatMap(item => item.text.split('\n\n')), 'sotsiaaltööspetsialist', '2026-01-01'];
  for (const part of clear) assert.equal(text.includes(part), false, part);
  // Nothing longer than a hash or a label: every word of the fixture's passages is absent too.
  for (const word of new Set(POOL.flatMap(item => item.text.split(/\s+/u)).filter(word => word.length > 6))) assert.equal(text.toLowerCase().includes(word.toLowerCase()), false, word);
  // A phrase no candidate holds has no place; a question without phrases has none to place.
  assert.deepEqual(observeKnowledge({ ...QUESTION, evidence_text: ['seda lauset ei ole'] }, POOL, packet()).deciding, [null]);
  assert.deepEqual(observeKnowledge({ id: 'no-phrase' }, POOL, packet()).deciding, []);
  assert.equal(observeRecords(packet({ records: false })), null);
  assert.deepEqual(observeRecords({ record_context: { entries: [], catalogue_count: 0, catalogue_scope: 'not_selected', completeness: 'not_assessed', scope: { state: 'region_required', region: null } } }),
    { region: null, view: null, catalogue_count: 0, listed_count: null, relevant_summaries: null, completeness: 'not_assessed', details: {}, contacts: 0 });
});

test('the reserve\'s first place comes from the lane\'s rerank audit, and is unknown for a packet without one', () => {
  const units = POOL.map((_, index) => `unit_${index}`);
  assert.equal(observeKnowledge(QUESTION, POOL, packet({ rerank: { candidates: units, selected: null, reserved: units.slice(4) } })).reserve_from, 5);
  assert.equal(observeKnowledge(QUESTION, POOL, packet({ rerank: { candidates: units, selected: null, reserved: [] } })).reserve_from, null);
  assert.equal(gateRow(QUESTION, POOL, packet()).reserve_from, null);
});

const rowOf = (pool = POOL, returned = packet(), question = QUESTION) => gateRow(question, pool, returned);
const verdict = (pool, returned) => compareRow(rowOf(), rowOf(pool, returned));
const moved = (from, to) => { const list = [...POOL]; list.splice(to, 0, ...list.splice(from, 1)); return list; };
const OTHER = passage(7, 'Perehüvitiste seadus', 'Lapsetoetust makstakse iga lapse kohta.', true);
// The same candidates with both deciding passages one place later than in POOL.
const LATER = [POOL[0], POOL[2], POOL[1], POOL[4], POOL[3], POOL[5]];

test('each verdict comes from the change that should give it, and an unchanged question is the same', () => {
  assert.deepEqual(verdict(), { id: QUESTION.id, verdict: 'same', deciding: [{ before: 2, after: 2 }, { before: 4, after: 4 }] });

  // The passage that holds the first phrase left the candidates.
  const lost = verdict([POOL[0], OTHER, ...POOL.slice(2)]);
  assert.deepEqual([lost.verdict, lost.deciding[0], lost.candidates], ['deciding_lost', { before: 2, after: null }, { entered: 1, left: 1 }]);
  // The same passage three places later, the same candidates.
  const worse = verdict(moved(1, 4));
  assert.deepEqual([worse.verdict, worse.deciding, worse.candidates, worse.moved > 0], ['deciding_worse', [{ before: 2, after: 5 }, { before: 4, after: 3 }], undefined, true]);
  // One phrase lost and the other earlier: the loss decides.
  assert.equal(verdict([POOL[3], POOL[0], OTHER, POOL[2], POOL[4], POOL[5]]).verdict, 'deciding_lost');

  // One phrase earlier and the other later: the later one decides.
  assert.deepEqual(verdict(moved(3, 0)).deciding, [{ before: 2, after: 3 }, { before: 4, after: 1 }]);
  assert.equal(verdict(moved(3, 0)).verdict, 'deciding_worse');

  // Earlier, or among the candidates where it was not: better, with what it moved listed and not held against it.
  const up = compareRow(rowOf(LATER), rowOf());
  assert.deepEqual([up.verdict, up.deciding, up.moved], ['better', [{ before: 3, after: 2 }, { before: 5, after: 4 }], 4]);
  const found = compareRow(rowOf([POOL[0], OTHER, ...POOL.slice(2)]), rowOf());
  assert.deepEqual([found.verdict, found.deciding[0], found.candidates], ['better', { before: null, after: 2 }, { entered: 1, left: 1 }]);

  // Candidates entered and left, the deciding passages where they were: counts, and the largest document's places.
  const swapped = verdict([...POOL.slice(0, 4), OTHER, POOL[5]]);
  assert.deepEqual(swapped, { id: QUESTION.id, verdict: 'changed', deciding: [{ before: 2, after: 2 }, { before: 4, after: 4 }], candidates: { entered: 1, left: 1 }, largest_document: [3, 2] });
  const longer = verdict([...POOL, OTHER, { ...OTHER, id: 'P8' }]);
  assert.deepEqual([longer.verdict, longer.candidates], ['changed', { entered: 2, left: 0 }]);
  // A passage that two versions of an act share word for word is two candidates: the second one entered.
  assert.deepEqual(compareRow(rowOf([...POOL, OTHER]), rowOf([...POOL, OTHER, { ...OTHER, id: 'P8' }])).candidates, { entered: 1, left: 0 });
  // The same candidates in another order, no deciding passage moved.
  assert.deepEqual(verdict([...POOL.slice(0, 4), POOL[5], POOL[4]]), { id: QUESTION.id, verdict: 'changed', deciding: [{ before: 2, after: 2 }, { before: 4, after: 4 }], moved: 2 });

  // The evidence of a failed selection, and the size of the context.
  const seeds = verdict(POOL, packet({ evidence: [POOL[0], POOL[2]] }));
  assert.deepEqual([seeds.verdict, seeds.fallback], ['changed', { entered: 1, left: 1, context_tokens: [9100, 9100] }]);
  assert.deepEqual(verdict(POOL, packet({ tokens: 9400 })).fallback, { entered: 0, left: 0, context_tokens: [9100, 9400] });

  // The catalogue: its view, its municipality, how many summaries fitted (ADR-121's fault would read 9 -> 1).
  const catalogue = change => { const returned = packet(); Object.assign(returned.record_context, change); return verdict(POOL, returned); };
  assert.deepEqual(catalogue({ view: 'summary' }), { id: QUESTION.id, verdict: 'changed', deciding: [{ before: 2, after: 2 }, { before: 4, after: 4 }], records: { view: ['titles', 'summary'] } });
  assert.deepEqual(catalogue({ region: 'kose_vald' }).records, { region: ['harku_vald', 'kose_vald'] });
  assert.deepEqual(catalogue({ relevant_summaries: 1 }).records, { relevant_summaries: [9, 1] });
  const fewer = catalogue({ entries: packet().record_context.entries.slice(0, 4), completeness: 'partial_context_budget', listed_count: 12 });
  assert.deepEqual(fewer.records, { listed_count: [41, 12], completeness: ['complete_within_authorized_indexed_scope', 'partial_context_budget'],
    details: [{ relevant_detail: 1, relevant_summary: 1, catalogue: 2, contact_directory: 1 }, { relevant_detail: 1, relevant_summary: 1, catalogue: 1, contact_directory: 1 }], contacts: [1, 0] });
  assert.deepEqual(verdict(POOL, packet({ records: false })).verdict, 'changed');
  // A catalogue change beside a better place is still to be read: it is another lane's.
  const summarised = packet(); summarised.record_context.view = 'summary';
  const both = compareRow(rowOf(LATER), rowOf(POOL, summarised));
  assert.deepEqual([both.verdict, both.deciding[0], both.records], ['changed', { before: 3, after: 2 }, { view: ['titles', 'summary'] }]);
  // Times are a run's own: never a difference.
  const slower = packet(); slower.search_timings.since_start_ms.merged = 5000;
  assert.equal(verdict(POOL, slower).verdict, 'same');

  // What could not be searched or was not there to compare.
  const error = { id: QUESTION.id, state: 'error', error: 'retrieval_failed' }, skipped = { id: QUESTION.id, state: 'skipped_no_vector' };
  assert.deepEqual(compareRow(rowOf(), error), { id: QUESTION.id, verdict: 'error', error: 'retrieval_failed' });
  assert.deepEqual(compareRow(error, error).verdict, 'error');
  assert.deepEqual(compareRow(error, rowOf()), { id: QUESTION.id, verdict: 'not_compared', reason: 'baseline_error' });
  assert.deepEqual(compareRow(skipped, skipped), { id: QUESTION.id, verdict: 'skipped', reason: 'skipped_no_vector' });
  assert.deepEqual(compareRow(rowOf(), skipped), { id: QUESTION.id, verdict: 'not_compared', reason: 'skipped_no_vector' });
  assert.deepEqual(compareRow(skipped, rowOf()), { id: QUESTION.id, verdict: 'not_compared', reason: 'baseline_skipped_no_vector' });
  assert.deepEqual(compareRow(undefined, rowOf()), { id: QUESTION.id, verdict: 'not_compared', reason: 'no_baseline' });
  assert.deepEqual(compareRow(rowOf()), { id: QUESTION.id, verdict: 'not_compared', reason: 'only_in_baseline' });
});

const identity = searchIdentity(config, '2026-10-10');
const run = (rows = [rowOf(), rowOf(POOL, packet(), LOCAL)], search = {}, questions = [QUESTION, LOCAL]) => ({ schema_version: GATE_RUN_VERSION, recorded_at: '2026-10-10T09:00:00.000Z', plan: config.id,
  search: { ...identity, ...search }, inputs: Object.fromEntries(questions.map(question => [question.id, questionInput(question, VECTORS)])), rows });

test('an unchanged run compares as the same; the exit code follows the gravest verdict', () => {
  const same = compareRuns(run(), structuredClone(run()));
  assert.deepEqual([same.ok, same.exit, same.allowed, same.rows.map(row => row.verdict)], [true, 0, [], ['same', 'same']]);
  assert.deepEqual(same.summary, { questions: 2, error: 0, deciding_lost: 0, deciding_worse: 0, changed: 0, not_compared: 0, better: 0, same: 2, skipped: 0, median_search_ms: { baseline: 812, present: 812 } });
  const local = rowOf(POOL, packet(), LOCAL), exitOf = row => compareRuns(run(), run([row, local])).exit;
  const improved = compareRuns(run([rowOf(LATER), local]), run());
  assert.deepEqual([improved.exit, improved.summary.better, improved.summary.same], [0, 1, 1]);
  assert.equal(exitOf(rowOf([...POOL.slice(0, 4), OTHER, POOL[5]])), 10); // candidates
  assert.equal(exitOf(rowOf(moved(1, 4))), 10); // a deciding place worse
  assert.equal(exitOf(rowOf([POOL[0], OTHER, ...POOL.slice(2)])), 20); // a deciding passage lost
  assert.equal(exitOf({ id: QUESTION.id, state: 'error', error: 'retrieval_failed' }), 20);
  // The gravest decides: a loss beside a difference.
  const mixed = compareRuns(run(), run([rowOf([POOL[0], OTHER, ...POOL.slice(2)]), rowOf([...POOL, OTHER], packet(), LOCAL)]));
  assert.deepEqual([mixed.exit, mixed.summary.deciding_lost, mixed.summary.changed], [20, 1, 1]);
});

test('runs that differ in what decides a search are refused, each difference by its name, until the caller allows it', () => {
  assert.deepEqual(refusal(run(), run()), []);
  assert.deepEqual(DECIDES, ['generation', 'documents', 'profile', 'recordCatalogue', 'searchAssist', 'embedding', 'date']);
  assert.deepEqual(compareRuns(run(), run(undefined, { generation: 'generation-b' })), { ok: false, exit: 2, refused: [{ key: 'generation', baseline: 'generation-a', present: 'generation-b' }] });
  assert.deepEqual(compareRuns(run(), run(undefined, { date: '2026-10-11' })), { ok: false, exit: 2, refused: [{ key: 'date', baseline: '2026-10-10', present: '2026-10-11' }] });
  // A run that passed midnight names both days and compares with no single day.
  assert.equal(compareRuns(run(), run(undefined, { date: '2026-10-10/2026-10-11' })).exit, 2);
  // Every value of the plan that the list names changes the identity; its configHash, which each release renews, does not.
  const changed = { generationId: 'generation-b', documents: { ...config.documents, 'doc-guide': 'version-2' }, profileId: 'hybrid-estnltk-chat-v5', recordCatalogue: 'rag-v2/record-catalogue-4',
    searchAssist: 'rag-v2/search-assist-12', embedding: { ...config.embedding, dimensions: 8 } };
  const keys = { generationId: 'generation', documents: 'documents', profileId: 'profile', recordCatalogue: 'recordCatalogue', searchAssist: 'searchAssist', embedding: 'embedding' };
  for (const [field, value] of Object.entries(changed)) {
    const other = run(undefined, searchIdentity({ ...config, [field]: value }, '2026-10-10'));
    assert.deepEqual(refusal(run(), other).map(item => item.key), [keys[field]], field);
    assert.deepEqual(refusal(run(), other, [keys[field]]), []);
  }
  assert.deepEqual(searchIdentity({ ...config, configHash: 'd'.repeat(64), id: 'm4-gate-test-r2' }, '2026-10-10'), identity);
  assert.match(identity.documents, /^[0-9a-f]{64}$/u);
  assert.equal(JSON.stringify(identity).includes('doc-act'), false);
  // Allowed by name: compared, and the summary says across which difference.
  const across = compareRuns(run(), run(undefined, { generation: 'generation-b', date: '2026-10-11' }), { allow: ['generation', 'date'] });
  assert.deepEqual([across.ok, across.exit, across.allowed], [true, 0, ['generation', 'date']]);
  assert.deepEqual(compareRuns(run(), run(undefined, { generation: 'generation-b', date: '2026-10-11' }), { allow: ['generation'] }).refused.map(item => item.key), ['date']);
  // A file that is no run of this version is never compared, whatever is allowed.
  assert.deepEqual(compareRuns({ ...run(), schema_version: 'rag-v2/search-gate-run-0' }, run(), { allow: DECIDES }).refused.map(item => item.key), ['schema_version']);
  assert.deepEqual(compareRuns(run(), { rows: [] }, { allow: DECIDES }).refused.map(item => item.key), ['schema_version']);
});

test('a question that changed, came or went is named, not read as a change of search; runs with nothing to judge are refused', () => {
  // The same id with another deciding phrase, or with a vector bought again.
  const edited = run(undefined, {}, [{ ...QUESTION, evidence_text: ['toimetulekupiiri kehtestab'] }, LOCAL]);
  assert.deepEqual(compareRuns(run(), edited).rows[0], { id: QUESTION.id, verdict: 'not_compared', reason: 'question_changed' });
  assert.equal(compareRuns(run(), edited).exit, 10);
  assert.notEqual(questionInput(QUESTION, VECTORS), questionInput(QUESTION, new Map([...VECTORS, [QUESTION.queries[0], vector(99)]])));
  assert.notEqual(questionInput(LOCAL, VECTORS), questionInput({ ...LOCAL, region: 'kose_vald' }, VECTORS));
  assert.match(questionInput(QUESTION, VECTORS), /^[0-9a-f]{16}$/u);
  // A present error is an error also for a question that changed.
  const failed = { ...edited, rows: [{ id: QUESTION.id, state: 'error', error: 'retrieval_failed' }, edited.rows[1]] };
  assert.deepEqual([compareRuns(run(), failed).rows[0].verdict, compareRuns(run(), failed).exit], ['error', 20]);

  const one = run([rowOf()], {}, [QUESTION]);
  const added = compareRuns(one, run());
  assert.deepEqual([added.exit, added.rows.map(row => [row.verdict, row.reason])], [10, [['same', undefined], ['not_compared', 'no_baseline']]]);
  const removed = compareRuns(run(), one);
  assert.deepEqual([removed.exit, removed.rows.map(row => [row.id, row.verdict, row.reason])], [10, [[QUESTION.id, 'same', undefined], [LOCAL.id, 'not_compared', 'only_in_baseline']]]);

  // Neither run had the vectors of one question: it is skipped in both, and the rest decides.
  const skipped = { id: LOCAL.id, state: 'skipped_no_vector' };
  const partly = compareRuns(run([rowOf(), skipped]), run([rowOf(), skipped]));
  assert.deepEqual([partly.exit, partly.summary.same, partly.summary.skipped], [0, 1, 1]);
  // No question judged at all (a wrong vectors file): no exit 0 that would read as "search is as it was".
  const none = run([{ id: QUESTION.id, state: 'skipped_no_vector' }, skipped]);
  assert.deepEqual(compareRuns(none, none), { ok: false, exit: 2, refused: [{ key: 'nothing_compared', baseline: 2, present: 2 }] });
  assert.deepEqual(compareRuns(run(), none).refused.map(item => item.key), ['nothing_compared']);
  assert.equal(compareRuns(run([]), run([])).exit, 2);
});

test('the network guard lets a request to Qdrant\'s origin through and stops every other host before anything is sent', async () => {
  const sent = [], network = async (input, init) => { sent.push([String(input?.url ?? input), init]); return { ok: true }; };
  const env = { url: 'http://127.0.0.1:56333' }, guarded = qdrantOnly(network, () => env.url);
  assert.deepEqual(await guarded('http://127.0.0.1:56333/collections/c/points/query', { method: 'POST', body: '{}' }), { ok: true });
  await guarded(new URL('http://127.0.0.1:56333/collections'));
  await guarded(new Request('http://127.0.0.1:56333/collections/c'), { redirect: 'follow' });
  // Passed on as it was, except that a redirect can never be followed to another host.
  assert.deepEqual(sent.map(([url, init]) => [url, init]), [['http://127.0.0.1:56333/collections/c/points/query', { method: 'POST', body: '{}', redirect: 'error' }],
    ['http://127.0.0.1:56333/collections', { redirect: 'error' }], ['http://127.0.0.1:56333/collections/c', { redirect: 'error' }]]);
  const refused = ['https://api.openai.com/v1/embeddings', 'https://api.openai.com/v1/responses', 'http://127.0.0.1:56334/collections', 'https://127.0.0.1:56333/collections', 'http://localhost:56333/collections',
    'http://127.0.0.1.example.invalid:56333/collections', '/collections', new Request('https://api.openai.com/v1/embeddings', { method: 'POST', body: '{}' })];
  for (const target of refused) await assert.rejects(guarded(target, { method: 'POST' }), { code: 'search_gate_network_refused' });
  // No address of Qdrant in the environment: nothing passes, Qdrant's own address neither.
  env.url = undefined;
  await assert.rejects(guarded('http://127.0.0.1:56333/collections'), { code: 'search_gate_network_refused' });
  assert.equal(sent.length, 3);
});

// The chat's own search (retrieval.js: unifiedSearch with the knowledge lane's retrieve, the catalogue and the merge)
// over an index held in memory: sources of the shape tests/rag-v2-pool-reserve.test.mjs builds, a catalog class in
// place of Postgres, and Qdrant answered by a function that stands behind the gate's own network guard. Forty passages
// of one parish's regulation rank before a national act's four and a guide's two, until the ranking is changed.
function memoryIndex() {
  const tenant = 'gate-synthetic', embedding = new MockEmbedding(), search = searchConfig(embedding.config, ESTNLTK_LEXICAL);
  const source = (doc, count, text, fields = {}) => {
    const version = `${doc}-v1`, spans = Array.from({ length: count }, (_, i) => ({ id: `${doc}-s${i}`, tenant_id: tenant, document_version_id: version, pdf_page: 1, start: i * 80, source_text: `${text} ${i}.` }));
    const chunks = spans.map((span, i) => ({ id: `${doc}-c${i}`, ordinal: i, parent_section_id: `${doc}-section`, span_ids: [span.id], pdf_pages: [1], source_text: span.source_text,
      retrieval_text: span.source_text, retrieval_mapping: { prefix_length: 0 } }));
    return { tenant_id: tenant, version: { id: version, pdf_hash: 'a'.repeat(64) }, spans, chunks, report: { warnings: [] },
      document: { id: doc, rights: { access: 'local_private', usage: 'development_only' }, search_aids: {}, fields: { title: { value: `Title ${doc}` }, authors: { value: [] }, publication_date: { value: null }, ...fields } },
      sections: [{ id: `${doc}-section`, parent_id: null, title: `Title ${doc}`, span_ids: [spans[0].id] }],
      relations: chunks.flatMap(chunk => [{ id: `belongs-${chunk.id}`, type: 'BELONGS_TO', from_id: chunk.id, to_id: doc }, { id: `parent-${chunk.id}`, type: 'PARENT_SECTION', from_id: chunk.id, to_id: `${doc}-section` }]) };
  };
  const bundles = [source('municipal', 40, 'A parish regulation on contesting a benefit decision, paragraph', { regions: { value: ['synthetic_parish'] }, valid_from: { value: '2024-01-01' }, valid_to: { value: null, open_end: true } }),
    source('law', 4, 'The national act on administrative procedure: a challenge is filed within thirty days, section', { regions: { value: [] }, valid_from: { value: '2024-01-01' }, valid_to: { value: null, open_end: true } }),
    source('guide', 2, 'A guide without validity dates, page')];
  const documents = Object.fromEntries(bundles.map(bundle => [bundle.document.id, { version_id: bundle.version.id }]));
  const snapshot = { source_generation: 'source-v1', documents, snapshot_hash: hash(stable(documents)) }, generationId = id('search_generation', tenant, snapshot, search);
  const generation = { id: generationId, tenant, config: search, snapshot, collection: collectionName(tenant, generationId, 'mock') };
  const units = bundles.flatMap(bundle => bundle.chunks.map(chunk => indexUnit(chunk, bundle, embedding.config))), directories = bundles.map(bundle => retrievalDirectory(bundle, embedding.config));
  let order = [];
  const rank = list => { order = list.flatMap(doc => units.filter(unit => unit.document_id === doc)); };
  const ranked = (docs, limit, keep) => order.filter(unit => docs.includes(unit.document_id) && keep(unit)).slice(0, limit);
  class Catalog {
    async active() { return generation; }
    async retrievalDirectory(_tenant, _generation, docs) { return directories.filter(row => docs.includes(row.document_id)); }
    async bundles(_tenant, _generation, docs) { return bundles.filter(bundle => docs.includes(bundle.document.id)); }
    async units(_tenant, _generation, docs) { return units.filter(unit => docs.includes(unit.document_id)); }
    async lexical(_tenant, _generation, docs, _text, limit, ids) { return ranked(docs, limit, unit => !ids || ids.includes(unit.id)).map((unit, i) => ({ ...unit, score: 100 - i })); }
    async close() {}
  }
  const sent = [], network = async (input, init) => {
    sent.push(String(input));
    const body = JSON.parse(init.body), docs = body.filter.must.find(item => item.key === 'document_id').match.any, points = body.filter.must.find(item => item.has_id)?.has_id;
    return { ok: true, json: async () => ({ status: 'ok', result: { points: ranked(docs, body.limit, unit => !points || points.includes(pointId(unit.id))).map((unit, i) => ({ id: pointId(unit.id), score: 1 - i / 1000,
      payload: { tenant, generation_id: generationId, config_id: search.id, embedding_mode: 'mock', document_id: unit.document_id, version_id: unit.version_id, unit_id: unit.id, input_hash: unit.input_hash } })) } }) };
  };
  const plan = { id: 'm4-gate-memory', mode: 'real', tenant, generationId, embedding: embedding.config, documents: Object.fromEntries(bundles.map(bundle => [bundle.document.id, bundle.version.id])),
    profileId: CHAT_SUBSECTIONS_PROFILE, profile: retrievalProfile(CHAT_SUBSECTIONS_PROFILE), retrievalRouting: UNIFIED_RETRIEVAL_VERSION, recordCatalogue: RECORD_RETRIEVAL_VERSION,
    dialogueVersion: DIALOGUE_VERSION, dialogueStateVersion: REGION_STATE_VERSION, searchAssist: SEARCH_ASSIST_VERSION, configHash: 'c'.repeat(64) };
  const adapters = runtimeAdapters(async () => plan, 'operator', { Catalog, loadRegions: async () => [{ region: 'synthetic_parish', names: ['Synthetic parish', 'Synthetic'] }],
    analyzer: { analyze: async words => words.map(word => `vmet${word.toLowerCase()}`) } });
  return { plan, adapters, embedding, network, sent, rank };
}

test('through the chat\'s own search over an index in memory: the catalogue\'s municipality, the reserved national passages, and a change of ranking told as better, worse or lost', async () => {
  const index = memoryIndex(), fetchBefore = globalThis.fetch;
  const questions = [{ id: 'contest-national', text: 'How do I contest a decision?', queries: ['challenge of an administrative act'], evidence_text: ['filed within thirty days, section 1.'] },
    { id: 'contest-parish', region: 'synthetic_parish', text: 'How do I contest a benefit decision?', queries: [], evidence_text: ['filed within thirty days, section 0.'] }];
  assert.deepEqual(validateGateCatalogue({ questions }), []);
  const saved = new Map();
  for (const text of questions.flatMap(question => [question.text, ...question.queries])) saved.set(text, await index.embedding.embed(text));
  const replay = async order => {
    index.rank(order);
    const rows = [];
    for (const question of questions) rows.push(await replayQuestion(index.adapters, index.plan, question, saved));
    return { schema_version: GATE_RUN_VERSION, search: searchIdentity(index.plan, '2026-10-10'), inputs: Object.fromEntries(questions.map(question => [question.id, questionInput(question, saved)])), rows };
  };
  // The address and the key are made up; no request leaves the process, and the guard would stop one to any other host.
  process.env.RAG_V2_QDRANT_URL = 'http://127.0.0.1:56333'; process.env.RAG_V2_QDRANT_KEY = 'made-up-key-of-the-gate-test';
  globalThis.fetch = qdrantOnly(index.network, () => process.env.RAG_V2_QDRANT_URL);
  try {
    const first = await replay(['municipal', 'guide', 'law']), [national, parish] = first.rows;
    assert.deepEqual(first.rows.map(row => [row.state, row.error]), [['ok', undefined], ['ok', undefined]]);
    // No municipality named: the parish's regulation is out of the search and no catalogue is read.
    assert.deepEqual([national.pool.length, national.largest_document, national.deciding, national.records.region, national.records.view], [6, 4, [4], null, null]);
    assert.equal(national.fallback.evidence.length, 6);
    // The catalogue's municipality: the regulation takes its ten places of the pool, the act's two best passages follow
    // as the reserve (ADR-032), and the municipality's catalogue is read. With the hook selecting nothing the evidence
    // is the first nine of the fused order.
    assert.deepEqual([parish.pool.length, parish.largest_document, parish.deciding, parish.records.region, parish.records.view, parish.records.catalogue_count],
      [10 + NATIONAL_LAW_RESERVE.perDocument, 10, [11], 'synthetic_parish', 'summary', 0]);
    assert.deepEqual(parish.fallback.evidence, parish.pool.slice(0, 9).map(([text]) => text));
    assert.equal(Number.isFinite(parish.ms.search) && Number.isFinite(parish.ms.knowledge) && Number.isFinite(parish.ms.records), true);
    // The merged packet carries no rerank audit, so the reserve's first place is not known from it.
    assert.equal(parish.reserve_from, null);
    assert.equal(JSON.stringify(first).includes('thirty days'), false);

    // The same index searched again is the same.
    const again = compareRuns(first, await replay(['municipal', 'guide', 'law']));
    assert.deepEqual([again.exit, again.rows.map(row => row.verdict)], [0, ['same', 'same']]);
    // The act now ranks first: both deciding passages stand earlier.
    const lawFirst = await replay(['law', 'municipal', 'guide']), better = compareRuns(first, lawFirst);
    assert.deepEqual([better.exit, better.rows.map(row => [row.verdict, row.deciding[0]])], [0, [['better', { before: 4, after: 2 }], ['better', { before: 11, after: 1 }]]]);
    assert.deepEqual(better.rows[1].candidates, { entered: 2, left: 0 });
    // And back: later.
    const worse = compareRuns(lawFirst, first);
    assert.deepEqual([worse.exit, worse.rows.map(row => row.verdict), worse.rows[1].candidates], [10, ['deciding_worse', 'deciding_worse'], { entered: 0, left: 2 }]);
    // The channels no longer return the act at all: the deciding passages are lost.
    const lost = compareRuns(first, await replay(['municipal', 'guide']));
    assert.deepEqual([lost.exit, lost.rows.map(row => [row.verdict, row.deciding[0].after])], [20, [['deciding_lost', null], ['deciding_lost', null]]]);
    assert.equal(index.sent.length > 0 && index.sent.every(url => /^http:\/\/127\.0\.0\.1:56333\/collections\/[^/]+\/points\/query$/u.test(url)), true);

    // The live plan under code that has raised the catalogue's version: as the plan stands, the adapter refuses a
    // question that names no municipality; read as that code's release will renew it, the search is the one above.
    const live = { ...index.plan, recordCatalogue: 'rag-v2/record-catalogue-4', dialogueStateVersion: 'm4-dialogue-state-4', searchAssist: 'rag-v2/search-assist-12' };
    index.rank(['municipal', 'guide', 'law']);
    assert.deepEqual(await replayQuestion(index.adapters, live, questions[0], saved), { id: 'contest-national', state: 'error', error: 'record_catalogue_not_configured' });
    assert.deepEqual(releasedPlan(live), index.plan);
    assert.deepEqual({ ...await replayQuestion(index.adapters, releasedPlan(live), questions[0], saved), ms: null }, { ...national, ms: null });
    assert.deepEqual(refusal({ ...first, search: searchIdentity(live, '2026-10-10') }, first).map(item => item.key), ['recordCatalogue', 'searchAssist']);
  } finally { globalThis.fetch = fetchBefore; }
});
