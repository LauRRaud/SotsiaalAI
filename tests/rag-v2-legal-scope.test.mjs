import test from 'node:test';
import assert from 'node:assert/strict';
import { estonianDate, declaredValidity, validityState, legalReference, legalValidityScope, LEGAL_VALIDITY_VERSION } from '../lib/rag-v2/search/legal-validity.js';
import { municipalScope, mergeUnifiedPackets, UNIFIED_RETRIEVAL_VERSION } from '../lib/rag-v2/search/unified.js';
import { DISCOVERY_SCHEMA } from '../lib/rag-v2/search/discovery.js';
import { retrievalPlan } from '../lib/rag-v2/pilot/retrieval-plan.js';
import { resolveRecordScope, knowledgeRegionScope } from '../lib/rag-v2/pilot/record-scope.js';
import { TYPED_DIALOGUE_STATE_VERSION } from '../lib/rag-v2/pilot/dialogue-state.js';

// Codex review 27.09.2026: legal validity at the asked date, and a municipality's own texts only for that
// municipality. Synthetic directory rows; no network, no database, no morphology service.
const row = (id, fields = {}, regions = []) => ({ schema_version: DISCOVERY_SCHEMA, document_id: id, version_id: `${id}-v`,
  source: { journal: false, record_kind: null }, fields: { publication_date: { value: null }, regions: { value: regions },
    valid_from: { value: fields.from ?? null }, valid_to: { value: fields.to ?? null, ...(fields.open ? { open_end: true } : {}) } } });
const corpus = [
  row('shs-future', { from: '2026-10-01', to: '2026-11-30' }), // the social welfare act text from 1 October
  row('hms', { from: '2024-01-01', to: '2026-12-31' }),
  row('lasteks', { from: '2025-01-10', open: true }), // in force with a proven open end
  row('old-act', { from: '2020-01-01', to: '2023-06-30' }), // expired
  row('no-end', { from: '2025-01-01' }), // an end date neither given nor proven open
  row('no-start', { to: '2030-12-31' }),
  row('article'), // declares no validity: never filtered here
];

test('the Estonian calendar date, not the UTC one, is today', () => {
  assert.equal(estonianDate(new Date('2026-09-30T20:59:59Z')), '2026-09-30');
  assert.equal(estonianDate(new Date('2026-09-30T21:00:00Z')), '2026-10-01'); // EEST, UTC+3
  assert.equal(estonianDate(new Date('2026-12-31T21:59:59Z')), '2026-12-31');
  assert.equal(estonianDate(new Date('2026-12-31T22:00:00Z')), '2027-01-01'); // EET, UTC+2
});

test('validity state: both boundary days are in force, the day before and after are not, a missing date is unknown', () => {
  const future = declaredValidity(corpus[0].fields);
  assert.deepEqual(['2026-09-30', '2026-10-01', '2026-11-30', '2026-12-01'].map(day => validityState(future, day)),
    ['not_yet_in_force', 'in_force', 'in_force', 'expired']);
  const open = declaredValidity(corpus[2].fields);
  assert.deepEqual(['2025-01-09', '2025-01-10', '2099-12-31'].map(day => validityState(open, day)), ['not_yet_in_force', 'in_force', 'in_force']);
  assert.equal(validityState(declaredValidity(corpus[4].fields), '2026-09-27'), 'unknown_validity');
  assert.equal(validityState(declaredValidity(corpus[5].fields), '2026-09-27'), 'unknown_validity');
  assert.equal(declaredValidity(corpus[6].fields), null);
  // A period: in force at some day of it.
  assert.equal(validityState(future, '2026-11-01', '2026-12-31'), 'in_force');
  assert.equal(validityState(declaredValidity(corpus[3].fields), '2023-01-01', '2023-12-31'), 'in_force');
});

test('today: a future, expired or unknown version is left out and reported; articles and acts in force stay', () => {
  const { eligible, excluded } = legalValidityScope(corpus, legalReference('2026-09-27'));
  assert.deepEqual(eligible.map(r => r.document_id), ['hms', 'lasteks', 'article']);
  assert.deepEqual(excluded.map(r => [r.document_id, r.state]), [['shs-future', 'not_yet_in_force'], ['old-act', 'expired'],
    ['no-end', 'unknown_validity'], ['no-start', 'unknown_validity']]);
  assert.deepEqual(excluded[0], { document_id: 'shs-future', valid_from: '2026-10-01', valid_to: '2026-11-30', open_end: false, state: 'not_yet_in_force' });
  // On its first day the new text is in force.
  assert.ok(legalValidityScope(corpus, legalReference('2026-10-01')).eligible.some(r => r.document_id === 'shs-future'));
});

test('a question about another date also keeps the version in force then, and never removes today\'s law', () => {
  const history = legalValidityScope(corpus, legalReference('2026-09-27', [{ from: '2023-01-01', to: '2023-12-31', basis: 'unspecified' }]));
  assert.deepEqual(history.eligible.map(r => r.document_id), ['hms', 'lasteks', 'old-act', 'article']);
  const ahead = legalValidityScope(corpus, legalReference('2026-09-27', [{ from: '2026-10-15', to: '2026-10-15', basis: 'validity' }]));
  assert.ok(ahead.eligible.some(r => r.document_id === 'shs-future'));
  // Invalid or reversed periods are ignored; at most two periods count; the as-of date must be a date.
  const reference = legalReference('2026-09-27', [{ from: '2023-12-31', to: '2023-01-01' }, { from: 'x', to: 'y' },
    { from: '2020-01-01', to: '2020-12-31' }, { from: '2021-01-01', to: '2021-12-31' }, { from: '2022-01-01', to: '2022-12-31' }]);
  assert.deepEqual(reference, { version: LEGAL_VALIDITY_VERSION, as_of: '2026-09-27', periods: [{ from: '2020-01-01', to: '2020-12-31' }, { from: '2021-01-01', to: '2021-12-31' }] });
  assert.throws(() => legalReference('27.09.2026'), { code: 'invalid_legal_reference' });
});

test('the asked period comes from the question or the dialogue state, but never from a publication period', () => {
  const query = (text, periods = []) => ({ scopeTurns: [{ turnId: 'first', text: 'Algus', mode: 'new' }, { turnId: 'second', text, mode: 'same' }],
    previousState: { version: TYPED_DIALOGUE_STATE_VERSION, sourceTurnIds: ['first'], value: { periods } } });
  assert.deepEqual(retrievalPlan(query('Milline oli toetus 2023. aastal?')).legalPeriods.map(({ from, to, basis }) => ({ from, to, basis })),
    [{ from: '2023-01-01', to: '2023-12-31', basis: 'unspecified' }]);
  const stated = { from: '2024-01-01', to: '2024-12-31', support: [{ turn: 1, quote: '2024' }] };
  assert.equal(retrievalPlan(query('Jätka.', [{ ...stated, basis: 'validity' }])).legalPeriods.length, 1);
  assert.equal(retrievalPlan(query('Jätka.', [{ ...stated, basis: 'event' }])).legalPeriods.length, 1);
  assert.equal(retrievalPlan(query('Jätka.', [{ ...stated, basis: 'publication' }])).legalPeriods.length, 0);
});

// Municipalities: the catalogue's directory names (base name and full name), with a stub morphology.
const regions = [
  { region: 'narva_linn', names: ['Narva linn', 'Narva'] }, { region: 'narva_joesuu_linn', names: ['Narva-Jõesuu linn', 'Narva-Jõesuu'] },
  { region: 'tartu_linn', names: ['Tartu linn', 'Tartu'] }, { region: 'tartu_vald', names: ['Tartu vald', 'Tartu'] },
  { region: 'tallinn', names: ['Tallinn'] }];
const lemmas = { narvas: 'narva', 'narva-jõesuus': 'narva-jõesuu', tartus: 'tartu', tartu: 'tartu', vallas: 'vald', linnas: 'linn' };
const analyzer = { analyze: async words => words.map(word => `vmet${lemmas[word.toLowerCase()] ?? word.toLowerCase()}`) };
const scopeOf = text => resolveRecordScope([{ turnId: 't1', text, mode: 'same' }], regions, analyzer);
const municipal = [row('national-act', { from: '2024-01-01', open: true }), row('article'),
  ...regions.map(r => row(`kord-${r.region}`, { from: '2024-01-01', open: true }, [r.region]))];
const kept = scope => municipalScope(municipal, scope).eligible.map(r => r.document_id);

test('Narva and Narva-Jõesuu: each keeps only its own municipal texts, national texts and articles stay', async () => {
  const narva = await scopeOf('Mu isa elab Narvas ega saa kodus üksi hakkama.');
  assert.deepEqual([narva.state, narva.region], ['mentioned_region', 'narva_linn']);
  assert.deepEqual(kept(narva), ['national-act', 'article', 'kord-narva_linn']);
  const joesuu = await scopeOf('Ta elab Narva-Jõesuus.');
  assert.equal(joesuu.region, 'narva_joesuu_linn');
  assert.deepEqual(kept(joesuu), ['national-act', 'article', 'kord-narva_joesuu_linn']);
  assert.deepEqual(municipalScope(municipal, narva).report, { state: 'mentioned_region', regions: ['narva_linn'], excluded_documents: 4 });
});

test('Tartu linn and Tartu vald: a full name selects one, the shared base name keeps both candidates and no third', async () => {
  const vald = await scopeOf('Elan Tartu vallas.');
  assert.equal(vald.region, 'tartu_vald');
  assert.deepEqual(kept(vald), ['national-act', 'article', 'kord-tartu_vald']);
  const ambiguous = await scopeOf('Ema elab Tartus.');
  assert.deepEqual(ambiguous, { state: 'ambiguous_region', region: null, candidates: ['tartu_linn', 'tartu_vald'] });
  assert.deepEqual(kept(ambiguous), ['national-act', 'article', 'kord-tartu_linn', 'kord-tartu_vald']);
});

test('no named municipality keeps no municipal texts; a Cyrillic name is not resolved, so none is kept either', async () => {
  const none = await scopeOf('Mida teha, kui omavalitsus keeldub teenusest?');
  assert.equal(none.state, 'region_required');
  assert.deepEqual(kept(none), ['national-act', 'article']);
  const russian = await scopeOf('Какую помощь может получить пожилой человек в Нарве?');
  assert.equal(russian.state, 'region_required');
  assert.deepEqual(kept(russian), ['national-act', 'article']);
});

test('a name the user wrote in another script is read from the search plan\'s Estonian queries; a retracted place is not', async () => {
  const russian = await scopeOf('Когда в Нарва-Йыэсуу можно подать заявление на школьное пособие?');
  const planned = await knowledgeRegionScope(russian, ['Narva-Jõesuu koolitoetuse taotlemine', 'koolitoetuse väljamaksmise aeg'], regions, analyzer);
  assert.deepEqual(planned, { state: 'search_plan_region', region: 'narva_joesuu_linn', interpretation: 'source_scope_only_not_confirmed_residence' });
  assert.deepEqual(kept(planned), ['national-act', 'article', 'kord-narva_joesuu_linn']);
  const both = await knowledgeRegionScope(russian, ['Tartu eakate koduteenus'], regions, analyzer);
  assert.deepEqual(both, { state: 'search_plan_ambiguous_region', region: null, candidates: ['tartu_linn', 'tartu_vald'] });
  // The user's own resolution wins, and a correction that cleared the place is not overridden by the plan.
  const own = await scopeOf('Elan Narvas.');
  assert.equal(await knowledgeRegionScope(own, ['Narva-Jõesuu hooldus'], regions, analyzer), own);
  const corrected = await resolveRecordScope([{ turnId: 't1', text: 'Ma ei ela Narvas enam.', mode: 'correction' }], regions,
    { analyze: async words => words.map(() => 'vmetmuu') });
  assert.equal(corrected.state, 'region_required_after_correction');
  assert.equal(await knowledgeRegionScope(corrected, ['Narva hooldus'], regions, analyzer), corrected);
  assert.equal((await knowledgeRegionScope(russian, [], regions, analyzer)).state, 'region_required');
});

test('merged packet: knowledge evidence outside the kept documents stops the answer; the scope report reaches the model', () => {
  const directories = [row('hms', { from: '2024-01-01', to: '2026-12-31' }), row('shs-future', { from: '2026-10-01', to: '2026-11-30' }),
    row('kord-narva_joesuu_linn', { from: '2024-01-01', open: true }, ['narva_joesuu_linn'])];
  const entry = doc => ({ evidence_id: `${doc}-e`, document_id: doc, document_version_id: `${doc}-v`, unit_id: `${doc}-u`, chunk_id: `${doc}-c`,
    span_ids: [`${doc}-s`], pdf_pages: [], source_text: `Synthetic ${doc}`, bibliography: { title: doc, authors: [], publication_date: null },
    selection: { reason: 'ranked_seed' }, limitations: [] });
  const plan = { version: UNIFIED_RETRIEVAL_VERSION, temporal: { state: 'no_period', periods: [] }, publicationCandidates: [], legalPeriods: [],
    interpretation: 'bounded_evidence_selection_not_verified_intent' };
  const report = { legal_validity: { ...legalReference('2026-09-27'), excluded: [{ title: 'Sotsiaalhoolekande seadus', valid_from: '2026-10-01',
    valid_to: '2026-11-30', open_end: false, state: 'not_yet_in_force' }], excluded_municipal_documents: 0 },
  municipality: { state: 'mentioned_region', regions: ['narva_linn'], excluded_documents: 1 } };
  const scope = { knowledge: new Set(['hms']), report };
  const lane = doc => [{ key: 'knowledge', kind: 'knowledge', packet: { tenant: 't', generation_id: 'g', state: 'ok', evidence: [entry(doc)] } }];
  const merged = mergeUnifiedPackets({ tenant: 't', generationId: 'g', directories, plan, lanes: lane('hms'), scope });
  assert.deepEqual(merged.retrieval_context.scope, report);
  assert.deepEqual(merged.model_context.retrieval.scope, report);
  assert.equal(merged.retrieval_context.lanes[0].coverage.indexed_documents, 1);
  for (const doc of ['shs-future', 'kord-narva_joesuu_linn']) {
    assert.throws(() => mergeUnifiedPackets({ tenant: 't', generationId: 'g', directories, plan, lanes: lane(doc), scope }), { code: 'unified_lane_scope_mismatch' });
  }
});
