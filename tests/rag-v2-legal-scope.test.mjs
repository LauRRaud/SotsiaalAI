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
const lemmas = { narvas: 'narva', 'narva-jõesuus': 'narva-jõesuu', tartus: 'tartu', tartu: 'tartu', vallas: 'vald', linnas: 'linn', tallinnas: 'tallinn' };
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

// ADR-041 (Codex's cases after the 28.09 conversation run): the date in the question itself, day or month exact.
const shsVersions = [row('shs-now', { from: '2026-06-12', to: '2026-09-30' }), row('shs-oct', { from: '2026-10-01', to: '2026-11-30' }),
  row('shs-jan27', { from: '2027-01-01', to: '2027-01-31' }), row('shs-feb27', { from: '2027-02-01', to: '2027-03-31' }),
  row('shs-apr27', { from: '2027-04-01', to: '2027-12-31' }), row('rls-aug', { from: '2026-08-01', to: '2026-10-30' }), row('rls-nov', { from: '2026-11-01', to: '2026-12-31' })];
const firstTurn = text => retrievalPlan({ scopeTurns: [{ turnId: 'first', text, mode: 'new' }], previousState: null });
const keptOn = (text, asOf = '2026-09-28') => legalValidityScope(shsVersions, legalReference(asOf, firstTurn(text).legalPeriods)).eligible.map(r => r.document_id);

test('an exact day or month in the first question keeps the version in force then beside today\'s, not the whole year', () => {
  assert.deepEqual(keptOn('Mida ütleb sotsiaalhoolekande seadus koduteenuse kohta 1. märtsil 2027?'), ['shs-now', 'shs-feb27', 'rls-aug']);
  assert.deepEqual(keptOn('Kui suur on riigilõiv 2027. aasta jaanuaris?'), ['shs-now', 'shs-jan27', 'rls-aug']);
  assert.deepEqual(keptOn('Seisuga 01.03.2027'), ['shs-now', 'shs-feb27', 'rls-aug']);
  // A bare year is still the whole year.
  assert.deepEqual(keptOn('Mis muutub 2027. aastal?'), ['shs-now', 'shs-jan27', 'shs-feb27', 'shs-apr27', 'rls-aug']);
  // A day or month is not a publication period of journals.
  assert.deepEqual(firstTurn('1. märtsil 2027').publicationCandidates, []);
});

test('"now" drops an earlier period, also one the model recorded, and a date in the same question still wins', () => {
  const recorded = { version: TYPED_DIALOGUE_STATE_VERSION, sourceTurnIds: ['first'], value: { periods: [
    { from: '2027-03-01', to: '2027-03-01', basis: 'validity', support: [{ turn: 1, quote: '1. märtsil 2027' }] }] } };
  const next = text => retrievalPlan({ previousState: recorded, scopeTurns: [{ turnId: 'first', text: 'Mida ütleb seadus 1. märtsil 2027?', mode: 'new' },
    { turnId: 'second', text, mode: 'same' }] });
  assert.equal(next('Selgita lihtsamalt.').legalPeriods[0].from, '2027-03-01', 'without "now" the recorded period stays');
  for (const text of ['Aga praegu kehtiva seaduse järgi?', 'Ja täna?', 'What applies now?', 'А сейчас?']) {
    assert.deepEqual([next(text).temporal.state, next(text).legalPeriods], ['now', []], text);
  }
  assert.deepEqual(next('Mis muutub 1. oktoobril 2026 võrreldes praegusega?').legalPeriods.map(p => p.from), ['2026-10-01']);
});

test('a birth date or an appointment never removes today\'s law; two periods of a comparison stay; a missing version stays visible', () => {
  assert.ok(keptOn('Olen sündinud 1. märtsil 1958. Mis toetus mulle kehtib?').includes('shs-now'));
  assert.ok(keptOn('Mul on aeg sotsiaaltöötaja juures 5. oktoobril 2026.').includes('shs-now'));
  assert.deepEqual(keptOn('Võrdle koduteenust 1. märtsil 2027 ja 1. mail 2027.'), ['shs-now', 'shs-feb27', 'shs-apr27', 'rls-aug']);
  // 31.10.2026 has no RLS text: nothing kept covers that day, so the answer has to say the text is missing.
  const reference = legalReference('2026-09-28', firstTurn('Kui suur on riigilõiv 31. oktoobril 2026?').legalPeriods);
  const rls = legalValidityScope(shsVersions, reference).eligible.filter(r => r.document_id.startsWith('rls'));
  assert.deepEqual(rls.map(r => r.document_id), ['rls-aug']);
  assert.equal(validityState(declaredValidity(rls[0].fields), '2026-10-31'), 'expired');
});

test('a negated place is left out when another one is affirmed; a turn that only negates selects none (Codex G8)', async () => {
  assert.equal((await scopeOf('Elan Tartu vallas, mitte Tartu linnas.')).region, 'tartu_vald');
  assert.equal((await scopeOf('Mitte Tartu linnas, vaid Tartu vallas.')).region, 'tartu_vald');
  assert.equal((await scopeOf('Ma ei ela Tallinnas vaid Narvas.')).region, 'narva_linn');
  assert.deepEqual(await scopeOf('Ma ei ela enam Tallinnas.'), { state: 'region_required_after_negation', region: null });
  // An earlier mention is not found again after the user negated the place.
  const turns = [{ turnId: 't1', text: 'Elan Tallinnas.', mode: 'new' }, { turnId: 't2', text: 'Tegelikult ei ela ma Tallinnas.', mode: 'same' }];
  assert.equal((await resolveRecordScope(turns, regions, analyzer)).region, null);
  // Without a negation both full names stay candidates, as before.
  assert.deepEqual((await scopeOf('Tartu vallas ja Tartu linnas')).candidates, ['tartu_linn', 'tartu_vald']);
});

test('ADR-044: a negated action keeps the place; a negation never reaches over a sentence or comma (Codex review 28.09)', async () => {
  for (const text of ['Ma ei saa Tallinnas abi.', 'Ma ei tea. Elan Tallinnas.', 'Ma ei tea, elan Tallinnas.', 'Ma ei leia Tallinnas tööd.', 'Tallinnas ei ole koduteenust?']) {
    assert.equal((await scopeOf(text)).region, 'tallinn', text);
  }
  for (const text of ['Ma pole enam Tallinnas.', 'Tegelikult ei ela ma enam Tallinnas.', "I don't live in Tallinn.", 'I am not in Tallinn.']) {
    assert.deepEqual(await scopeOf(text), { state: 'region_required_after_negation', region: null }, text);
  }
  assert.equal((await scopeOf('I live in Narva, not in Tallinn.')).region, 'narva_linn');
});

test('ADR-044: a range of days or months is one period, so a version in force only in between stays', () => {
  for (const text of ['Mis muutus 01.01.2027–31.03.2027?', 'Mis muutus 01.01.2027 - 31.03.2027?', 'Mis muutus 01.01.–31.03.2027?',
    'Mis muutus 1. jaanuarist kuni 31. märtsini 2027?', 'Mis muutus jaanuarist märtsini 2027?', 'Mis muutus 2027-01-01–2027-03-31?']) {
    assert.deepEqual(keptOn(text), ['shs-now', 'shs-jan27', 'shs-feb27', 'rls-aug'], text);
    assert.deepEqual(firstTurn(text).legalPeriods.map(p => [p.from, p.to]), [['2027-01-01', '2027-03-31']], text);
  }
  // Two dates without a dash or "kuni" stay two days (a comparison), and a reversed range is not a date.
  assert.deepEqual(keptOn('Võrdle 1. jaanuaril 2027 ja 1. aprillil 2027.'), ['shs-now', 'shs-jan27', 'shs-apr27', 'rls-aug']);
  assert.deepEqual(firstTurn('31.03.2027–01.01.2027').legalPeriods, []);
  // A day range is a legal period, not a publication period of journals; a year range stays both.
  assert.deepEqual(firstTurn('01.01.–31.03.2027').publicationCandidates, []);
  assert.equal(firstTurn('2020 kuni 2022').publicationCandidates.length, 1);
});

// ADR-075 (the live questionnaire of 04.10.2026, Codex's review): "Mis muutub ... alates 6. oktoobrist?" named no year,
// so the search got no period and the version in force from 06.10 was left out. Fictional acts; the day is fixed.
const yearless = (text, today = '2026-10-04') => retrievalPlan({ scopeTurns: [{ turnId: 'first', text, mode: 'new' }], previousState: null }, today);
const daysOf = (text, today) => yearless(text, today).legalPeriods.map(period => period.from === period.to ? period.from : `${period.from}..${period.to}`);

test('a day and a month without a year is the nearest such day, and its version is kept beside today\'s', () => {
  const versions = [row('kord-kuni-05-10', { from: '2025-09-01', to: '2026-10-05' }), row('kord-alates-06-10', { from: '2026-10-06', open: true })];
  const kept = text => legalValidityScope(versions, legalReference('2026-10-04', yearless(text).legalPeriods)).eligible.map(item => item.document_id);
  assert.deepEqual(kept('Mis muutub valla sotsiaalabi korras?'), ['kord-kuni-05-10']);
  assert.deepEqual(kept('Mis muutub valla sotsiaalabi korras alates 6. oktoobrist?'), ['kord-kuni-05-10', 'kord-alates-06-10']);
  const plan = yearless('Mis muutub valla sotsiaalabi korras alates 6. oktoobrist?');
  assert.deepEqual(plan.temporal.periods.map(({ from, to, basis, precision, support }) => ({ from, to, basis, precision, support })), [
    { from: '2026-10-06', to: '2026-10-06', basis: 'unspecified', precision: 'day', support: [{ turn: 1, quote: '6. oktoobrist' }] }]);
  // A single day is not a publication period of journals.
  assert.deepEqual(plan.publicationCandidates, []);
  for (const text of ['6. oktoobril', '6 oktoober', 'Kehtib kuni 6. oktoobrini.', '6. oktoobriks', 'Mis kehtis enne 6. oktoobrit?', 'Alates 6. Oktoobrist', 'alates 6.10', 'kuni 06.10 kehtib', 'seisuga 6.10.', 'с 6 октября', 'from 6 october']) {
    assert.deepEqual(daysOf(text), ['2026-10-06'], text);
  }
});

test('the nearest day may be past or coming; a day that does not exist then is not a date', () => {
  assert.deepEqual(daysOf('alates 6. oktoobrist', '2026-10-10'), ['2026-10-06']);
  assert.deepEqual(daysOf('alates 6. oktoobrist', '2027-03-01'), ['2026-10-06']);
  assert.deepEqual(daysOf('alates 1. jaanuarist', '2026-10-04'), ['2027-01-01']);
  assert.deepEqual(daysOf('alates 1. jaanuarist', '2026-02-10'), ['2026-01-01']);
  assert.deepEqual(daysOf('alates 2. juulist', '2026-12-31'), ['2026-07-02']); // 182 days back, 183 ahead
  assert.deepEqual(daysOf('alates 1. juulist', '2026-12-31'), ['2027-07-01']); // 183 days back, 182 ahead
  // Equally far both ways (183 days, across the leap day of 2028): the coming one.
  assert.deepEqual(daysOf('alates 6. oktoobrist', '2028-04-06'), ['2028-10-06']);
  assert.deepEqual(daysOf('1. mail', '2026-10-04'), ['2026-05-01']);
  assert.deepEqual(daysOf('29. veebruaril', '2026-10-04'), []);
  assert.deepEqual(daysOf('29. veebruaril', '2028-01-15'), ['2028-02-29']);
  assert.deepEqual(daysOf('31. aprillil'), []);
  assert.deepEqual(daysOf('alates 31.04'), []);
  assert.deepEqual(daysOf('alates 6.13'), []);
});

test('digits alone are a date only after a word that asks for one; a price, a time, a clause and a count are not dates', () => {
  for (const text of ['Hind on 6.10 eurot.', 'Toetus on kuni 6.10 eurot.', 'kuni 6.10 % sissetulekust', 'Tule kell 6.10.', 'Avatud alates kell 6.10', '§ 6 lg 10 järgi', '§ 6.10 järgi', 'punkt 6.10', 'versioon 6.10',
    'Hooldasin teda 1.5 aastat.', 'Hind oli 6.10.', 'Mis muutub 6.10?', 'alates 6.10.26', 'tel 5550 0610', '3 mainitud toetust', 'Saatsin 5 maili.', 'Sain 5 juulikuu arvet.',
    '10 augustikuist päeva', 'Elan aadressil Mai 6.', 'kokku 6,10 eurot alates maist']) {
    assert.deepEqual([yearless(text).temporal.state, daysOf(text)], ['no_period', []], text);
  }
});

test('a date with a year is read as before, once; more than two dates are still too many', () => {
  assert.deepEqual(daysOf('Mida ütleb seadus 1. märtsil 2027?'), ['2027-03-01']);
  assert.deepEqual(daysOf('Seisuga 01.03.2027'), ['2027-03-01']);
  assert.deepEqual(daysOf('Jaanuarist märtsini 2027'), ['2027-01-01..2027-03-31']);
  assert.deepEqual(daysOf('Olen sündinud 1. märtsil 1958. Mis muutub alates 6. oktoobrist?'), ['1958-03-01', '2026-10-06']);
  assert.deepEqual(daysOf('Võrdle 6. oktoobrit 2025 ja 6. oktoobrit.'), ['2025-10-06', '2026-10-06']);
  assert.equal(yearless('6. oktoobrist, 7. novembrist ja 8. detsembrist').temporal.state, 'too_many_date_candidates');
  // A later turn without a date keeps the period the model recorded, as before.
  const recorded = { version: TYPED_DIALOGUE_STATE_VERSION, sourceTurnIds: ['first'], value: { periods: [
    { from: '2026-10-06', to: '2026-10-06', basis: 'validity', support: [{ turn: 1, quote: '6. oktoobrist' }] }] } };
  const next = retrievalPlan({ previousState: recorded, scopeTurns: [{ turnId: 'first', text: 'Mis muutub alates 6. oktoobrist?', mode: 'new' },
    { turnId: 'second', text: 'Selgita lihtsamalt.', mode: 'same' }] }, '2026-10-04');
  assert.deepEqual(next.legalPeriods.map(period => period.from), ['2026-10-06']);
});
