import test from 'node:test';
import assert from 'node:assert/strict';
import { dateCandidates, retrievalPlan } from '../lib/rag-v2/pilot/retrieval-plan.js';
import { validateDialogueState, TYPED_DIALOGUE_STATE_VERSION, TYPED_DIALOGUE_ANSWER_SCHEMA, dialogueStateContract } from '../lib/rag-v2/pilot/dialogue-state.js';
import { UNIFIED_RETRIEVAL_VERSION, mergeUnifiedPackets, checkUnifiedDirectory } from '../lib/rag-v2/search/unified.js';
import { retrievalDirectory, DISCOVERY_SCHEMA, LEGACY_DISCOVERY_SCHEMA, verifyDirectory } from '../lib/rag-v2/search/discovery.js';
import { searchConfig, verifySearchConfig } from '../lib/rag-v2/search/indexing.js';
import { embeddingConfig } from '../lib/rag-v2/search/embedding.js';
import { hash, stable } from '../lib/rag-v2/contracts.js';

test('numeric date candidates keep exact ET/EN/RU quotes, inclusive years and real date bounds without claiming publication intent', () => {
  for (const text of ['Võrdle 2010–2014 ja 2020–2024.', 'Compare 2010–2014 and 2020–2024.', 'Сравни 2010–2014 и 2020–2024.']) {
    const result = dateCandidates(text, 2);
    assert.equal(result.state, 'numeric_candidates_not_confirmed_intent');
    assert.deepEqual(result.periods.map(({ from, to, basis }) => ({ from, to, basis })), [
      { from: '2010-01-01', to: '2014-12-31', basis: 'unspecified' }, { from: '2020-01-01', to: '2024-12-31', basis: 'unspecified' }]);
    assert(result.periods.every(period => period.support[0].turn === 2 && text.includes(period.support[0].quote)));
  }
  assert.equal(dateCandidates('2024-02-29 – 2024-03-01', 1).periods[0].from, '2024-02-29');
  assert.equal(dateCandidates('2025-02-29', 1).state, 'invalid_date_candidate');
  assert.equal(dateCandidates('2024–2010', 1).state, 'invalid_date_candidate');
  assert.equal(dateCandidates('2010 2015 2020', 1).state, 'too_many_date_candidates');
  assert.equal(dateCandidates('+372 55551234', 1).periods.length, 0);
});

test('new dates replace previous candidates, explicit correction clears them, event/validity periods never filter publications', () => {
  const period = { from: '2010-01-01', to: '2014-12-31', basis: 'publication', support: [{ turn: 1, quote: '2010–2014' }] };
  const previous = { version: TYPED_DIALOGUE_STATE_VERSION, sourceTurnIds: ['first'], value: { periods: [period] } };
  const query = (text, mode = 'same') => ({ previousState: previous, scopeTurns: [
    { turnId: 'first', text: '2010–2014', mode: 'new' }, { turnId: 'second', text, mode }] });
  assert.deepEqual(retrievalPlan(query('Selgita lihtsamalt.')).publicationCandidates, [period]);
  assert.equal(retrievalPlan(query('Aga 2020–2024?')).publicationCandidates[0].from, '2020-01-01');
  assert.deepEqual(retrievalPlan(query('Ära piira aastatega.', 'correction')).publicationCandidates, []);
  for (const basis of ['event', 'validity']) {
    previous.value.periods = [{ ...period, basis }];
    const plan = retrievalPlan(query('Jätka.'));
    assert.deepEqual(plan.publicationCandidates, []); assert.deepEqual(plan.knowledgeFilters, {});
    assert.equal(plan.temporal.periods[0].basis, basis);
  }
  previous.value.periods = [];
  assert.deepEqual(retrievalPlan(query('Aga hiljem?')).publicationCandidates, []);
  assert.throws(() => retrievalPlan({ ...query('Jätka.'), scopeTurns: [{ turnId: 'foreign', text: '2010' }] }), { code: 'invalid_unified_query' });
});

test('typed dialogue state binds both period meanings to user quotes and preserves the old schema contract', () => {
  const accepted = { context: { scopeId: 'scope', personId: 'person' }, userTurns: [{ turnId: 'first', text: 'Ilmunud 2010–2014; sündmus 2020–2024.' }] };
  const value = { facts: [], needs: [], unknowns: [], region: { id: null, status: 'unknown', support: [] }, language_hint: 'et',
    periods: [{ basis: 'publication', from: '2010-01-01', to: '2014-12-31', support: [{ turn: 1, quote: 'Ilmunud 2010–2014' }] },
      { basis: 'event', from: '2020-01-01', to: '2024-12-31', support: [{ turn: 1, quote: 'sündmus 2020–2024' }] }] };
  assert.deepEqual(validateDialogueState(value, accepted, { regions: [] }, null, TYPED_DIALOGUE_STATE_VERSION), value);
  assert.deepEqual(validateDialogueState(value, accepted, { regions: [], asOfDateUTC: '2026-09-23' }, null, TYPED_DIALOGUE_STATE_VERSION), value);
  assert.throws(() => validateDialogueState(value, accepted, { regions: [], asOfDateUTC: '2026-02-30' }, null, TYPED_DIALOGUE_STATE_VERSION), { code: 'invalid_dialogue_state_context' });
  assert.deepEqual(dialogueStateContract({ dialogueStateVersion: TYPED_DIALOGUE_STATE_VERSION }).schema, TYPED_DIALOGUE_ANSWER_SCHEMA);
  const invalid = structuredClone(value); invalid.periods[1].support[0].quote = 'Source publication is not user intent';
  assert.throws(() => validateDialogueState(invalid, accepted, { regions: [] }, null, TYPED_DIALOGUE_STATE_VERSION), { code: 'invalid_dialogue_state' });
  assert.throws(() => validateDialogueState(value, accepted, { regions: [] }), { code: 'invalid_dialogue_state' });
});

const directory = (document, date, record = null) => ({ schema_version: DISCOVERY_SCHEMA, document_id: document, version_id: `${document}-version`,
  source: { journal: record === null, record_kind: record }, fields: { publication_date: { value: date }, regions: { value: [] } } });
const entry = doc => ({ evidence_id: `${doc}-evidence`, document_id: doc, document_version_id: `${doc}-version`, unit_id: `${doc}-unit`,
  chunk_id: `${doc}-chunk`, span_ids: [`${doc}-span`], pdf_pages: [1], source_text: `Synthetic source ${doc}`,
  bibliography: { title: doc, authors: [], publication_date: '2010-01-01' }, selection: { reason: 'ranked_seed' }, limitations: [] });
const packet = evidence => ({ tenant: 'test', generation_id: 'generation', state: evidence.length ? 'ok' : 'empty', evidence });
const plan = { version: UNIFIED_RETRIEVAL_VERSION, temporal: { state: 'numeric_candidates_not_confirmed_intent', periods: [] },
  publicationCandidates: [], interpretation: 'bounded_evidence_selection_not_verified_intent' };

test('combined packet remaps overlapping S references in catalogue fields, relations, dependencies and both period lanes', () => {
  const directories = [directory('early', '2010-01-01'), directory('late', '2020-01-01'), directory('record', null, 'service'), directory('undated', null)];
  const knowledge = { ...packet([entry('early')]), dependency_context: { claims: [{ key: 'K1', refs: ['S1'] }],
    relations: [{ from: 'K1', targets: ['K1'], refs: ['S1'] }], unresolved: [], known_context: 'included' } };
  const records = { ...packet([entry('record')]), record_context: { entries: [{ fields: { title: { value: 'service', refs: ['S1'] } } }], relations: [{ refs: ['S1'] }] } };
  const result = mergeUnifiedPackets({ tenant: 'test', generationId: 'generation', directories, plan,
    lanes: [{ key: 'knowledge', kind: 'knowledge', packet: knowledge }, { key: 'records', kind: 'local_records', packet: records },
      { key: 'period_1', kind: 'publication_period', period: { from: '2010-01-01', to: '2014-12-31' }, packet: knowledge },
      { key: 'period_2', kind: 'publication_period', period: { from: '2020-01-01', to: '2024-12-31' }, packet: packet([entry('late')]) }] });
  assert.equal(result.evidence.length, 3);
  assert.deepEqual(result.record_context.entries[0].fields.title.refs, ['S2']);
  assert.deepEqual(result.record_context.relations[0].refs, ['S2']);
  assert.equal(result.dependency_context.relations[1].from, 'period_1/K1');
  assert.deepEqual(result.dependency_context.relations[1].refs, ['S1']);
  const periods = result.retrieval_context.lanes.filter(lane => lane.kind === 'publication_period');
  assert.deepEqual(periods.map(period => period.refs), [['S1'], ['S3']]);
  assert(periods.every(period => period.coverage.indexed_documents === 1 && period.coverage.missing_publication_date_documents === 1));
  assert.equal(result.reference_map.S3.document_id, 'late');
  checkUnifiedDirectory(result, directories);
  assert.throws(() => checkUnifiedDirectory(result, directories.slice(0, -1)), { code: 'unified_scope_changed' });
  const altered = structuredClone(result); altered.retrieval_context.lanes[0].coverage.indexed_documents = 99;
  assert.throws(() => checkUnifiedDirectory(altered, directories), { code: 'unified_scope_changed' });
});

test('combined packet rejects cross-tenant, wrong-period and record-through-text evidence before it becomes answer context', () => {
  const directories = [directory('early', '2010-01-01'), directory('record', null, 'service')];
  const merge = lane => mergeUnifiedPackets({ tenant: 'test', generationId: 'generation', directories, plan, lanes: [lane] });
  for (const lane of [{ key: 'knowledge', kind: 'knowledge', packet: { ...packet([entry('early')]), tenant: 'foreign' } },
    { key: 'knowledge', kind: 'knowledge', packet: packet([entry('record')]) },
    { key: 'period_1', kind: 'publication_period', period: { from: '2020-01-01', to: null }, packet: packet([entry('early')]) }]) {
    assert.throws(() => merge(lane), { code: 'unified_lane_scope_mismatch' });
  }
  assert.throws(() => merge({ key: 'records', kind: 'local_records', packet: { ...packet([entry('record')]), record_context: { refs: ['S9'] } } }), { code: 'unified_reference_missing' });
});

test('typed source directory creates a new search configuration while legacy generation metadata stays readable', () => {
  const embedding = embeddingConfig(), current = searchConfig(embedding), old = searchConfig(embedding, undefined, LEGACY_DISCOVERY_SCHEMA);
  assert.notEqual(current.id, old.id); assert.equal(old.directory, undefined);
  verifySearchConfig(current); verifySearchConfig(old);
  const bundle = { document: { id: 'doc', fields: { publication_date: { value: '2020-01-01' }, journal_title: { value: 'Any publication name' } } },
    version: { id: 'version' }, chunks: [], dependencies: [] };
  const prior = retrievalDirectory(bundle, embedding, LEGACY_DISCOVERY_SCHEMA), next = retrievalDirectory(bundle, embedding);
  assert.equal(prior.source, undefined); assert.deepEqual(next.source, { record_kind: null, journal: true });
  const unnamed = structuredClone(bundle); delete unnamed.document.fields.journal_title;
  unnamed.document.fields.source_type = { value: 'journal_article' };
  assert.equal(retrievalDirectory(unnamed, embedding).source.journal, true);
  for (const [config, value] of [[old, prior], [current, next]]) {
    const row = { document_id: 'doc', version_id: 'version', bundle_hash: value.bundle_hash, retrieval_directory: value, retrieval_hash: hash(stable(value)) };
    assert.deepEqual(verifyDirectory(row, { config, snapshot: { documents: { doc: { version_id: 'version' } } } }), value);
  }
});
