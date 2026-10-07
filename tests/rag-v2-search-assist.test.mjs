import test from 'node:test';
import assert from 'node:assert/strict';
import { queryPlanRequest, rerankRequest, validateQueryPlan, validateRerank, searchAssistEnabled, SEARCH_ASSIST_VERSION, SEARCH_ASSIST_LIMITS } from '../lib/rag-v2/pilot/search-assist.js';
import { validateQuery, validateChannelWeights, rrf } from '../lib/rag-v2/search/ranking.js';
import { chunkExcerpt } from '../lib/rag-v2/search/excerpt.js';
import { retrievalProfile, CHAT_PROFILE } from '../lib/rag-v2/search/profiles.js';

const config = { model: 'gpt-6-luna' };

test('search assist: both model calls are strict, low-effort, unstored JSON requests; the selection can only name offered passages', () => {
  const plan = queryPlanRequest(config, ['Elan Tallinnas ja üürivõlg kasvab.'], 'et');
  assert.equal(plan.store, false); assert.equal(plan.reasoning.effort, 'low'); assert.equal(plan.text.format.strict, true);
  assert.equal(plan.text.format.schema.properties.queries.maxItems, SEARCH_ASSIST_LIMITS.queries);
  assert.deepEqual(JSON.parse(plan.input[0].content), { language: 'et', messages: ['Elan Tallinnas ja üürivõlg kasvab.'], people: ['user'], place_messages: 1 });
  const passages = [{ id: 'P1', title: 'A', text: 'x' }, { id: 'P2', title: 'B', text: 'y' }];
  const rerank = rerankRequest(config, ['küsimus'], passages);
  assert.deepEqual(rerank.text.format.schema.properties.useful.items.enum, ['P1', 'P2']);
  assert.equal(rerank.text.format.schema.properties.useful.maxItems, SEARCH_ASSIST_LIMITS.selected);
  // Instructions never carry the user's text; the request data is a separate, untrusted JSON input.
  assert(!plan.instructions.includes('üürivõlg') && /untrusted data/.test(plan.instructions) && /untrusted data/.test(rerank.instructions));
  // ADR-042: today's date is the reference for "now" among a legal act's versions.
  assert.deepEqual(Object.keys(JSON.parse(rerank.input[0].content)), ['messages', 'passages']);
  const dated = rerankRequest(config, ['küsimus'], passages, '2026-09-28');
  assert.equal(JSON.parse(dated.input[0].content).today, '2026-09-28');
  assert.match(dated.instructions, /valid_from and valid_to/);
  // ADR-046: a cost question keeps the passages that set the amount, not only the one that names a share.
  assert.match(dated.instructions, /its base, a cap or price limit, the person's own share and the exceptions/);
});

test('search assist: planned queries are trimmed, distinct and differ from the search text; malformed plans and selections are refused', () => {
  assert.deepEqual(validateQueryPlan({ queries: ['  võlanõustamine  Tallinn ', 'Võlanõustamine Tallinn', ''] }, 'küsimus'), ['võlanõustamine Tallinn']);
  assert.deepEqual(validateQueryPlan({ queries: ['Küsimus', 'teine päring'] }, 'küsimus'), ['teine päring']);
  assert.deepEqual(validateQueryPlan({ queries: [] }, 'x'), []);
  for (const value of [null, {}, { queries: 'x' }, { queries: ['a', 'b', 'c', 'd'] }, { queries: [1] }]) {
    assert.throws(() => validateQueryPlan(value, 'x'), { code: 'invalid_query_plan' });
  }
  const passages = [{ id: 'P1' }, { id: 'P2' }];
  assert.deepEqual(validateRerank({ useful: ['P2', 'P1'] }, passages), ['P2', 'P1']);
  assert.deepEqual(validateRerank({ useful: [] }, passages), []);
  for (const value of [null, { useful: ['P3'] }, { useful: ['P1', 'P1'] }, { useful: 'P1' }]) {
    assert.throws(() => validateRerank(value, passages), { code: 'invalid_rerank_selection' });
  }
  assert.equal(searchAssistEnabled({}), false);
  assert.equal(searchAssistEnabled({ searchAssist: SEARCH_ASSIST_VERSION }), true);
  assert.throws(() => searchAssistEnabled({ searchAssist: 'rag-v2/search-assist-0' }), { code: 'unsupported_search_assist' });
});

test('query variants are bounded and trimmed; each variant has its own channels, weighted by channel kind', () => {
  const base = { text: 'küsimus', language: 'et' };
  assert.deepEqual(validateQuery({ ...base, variants: [' a ', 'b'] }).variants, ['a', 'b']);
  for (const variants of [[], 'a', ['a', 'b', 'c', 'd'], [''], ['x'.repeat(1001)]]) {
    if (Array.isArray(variants) && !variants.length) { assert.deepEqual(validateQuery({ ...base, variants }).variants, []); continue; }
    assert.throws(() => validateQuery({ ...base, variants }), { code: 'invalid_query_variants' });
  }
  validateChannelWeights({ lexical: 1, vector: 2, lexical_1: 1, vector_3: 2 });
  for (const weights of [{ lexical_4: 1 }, { vector_0: 1 }, { other: 1 }]) assert.throws(() => validateChannelWeights(weights), { code: 'invalid_channel_weights' });
  // A passage found by the question and by a variant sums both contributions.
  const ranked = rrf({ vector: [{ id: 'a' }, { id: 'b' }], vector_1: [{ id: 'b' }] }, 60, { vector: 2, vector_1: 2 });
  assert.equal(ranked[0].id, 'b');
});

test('a chunk excerpt is an ordered subset of the chunk and rebuilds the same text and locations', () => {
  const units = [0, 1, 2].map(index => ({ id: `u${index}`, index, raw_text: ['Pealkiri', 'Kokkuvõte', '["a_b"]'][index],
    locator: { kind: 'json', path: `/items/0/${['title', 'summary', 'contactRefs'][index]}` }, offset_basis: 'source_unit_text_utf16' }));
  const spans = units.map(unit => ({ id: `s${unit.index}`, source_unit_index: unit.index, start: 0, end: unit.raw_text.length, source_text: unit.raw_text }));
  const bundle = { source_units: units, spans }, chunk = { span_ids: ['s0', 's1', 's2'] };
  const excerpt = chunkExcerpt(bundle, chunk, ['s0', 's1']);
  assert.equal(excerpt.source_text, 'Pealkiri\nKokkuvõte');
  assert.deepEqual(excerpt.source_locations.map(location => location.path), ['/items/0/title', '/items/0/summary']);
  for (const ids of [['s1', 's0'], ['s0', 's0'], [], ['s9'], 's0']) assert.throws(() => chunkExcerpt(bundle, chunk, ids), { code: 'invalid_chunk_excerpt' });
});

test('the chat profile keeps the vector2 fast-lexical choices with nine seeds in a 10000-token budget', () => {
  const profile = retrievalProfile(CHAT_PROFILE);
  assert.deepEqual(profile.query.channelWeights, { lexical: 1, vector: 2 });
  assert.equal(profile.query.limits.topK, 9); assert.equal(profile.query.finalLimit, 9); assert.equal(profile.query.limits.contextTokens, 10000);
  assert.equal(profile.query.lexicalRank, 'ts-rank-v1'); assert.equal(profile.query.semanticGraph, true);
  // Earlier profiles keep their exact budgets.
  assert.equal(retrievalProfile('hybrid-estnltk-vector2-fast-lexical-dependencies-v1').query.limits.topK, 5);
});

test('search-assist-2: the plan names the message language, and the answer follows it', async () => {
  const { planLanguage, SEARCH_ASSIST_VERSIONS } = await import('../lib/rag-v2/pilot/search-assist.js');
  const plan = queryPlanRequest(config, ['My mother needs help at home.'], 'et');
  assert.deepEqual(plan.text.format.schema.required, ['queries', 'language', 'person', 'places']);
  assert.deepEqual(plan.text.format.schema.properties.language.enum, ['et', 'en', 'ru']);
  assert.equal(planLanguage({ searchAssist: SEARCH_ASSIST_VERSION }, { queries: [], language: 'en' }), 'en');
  assert.equal(planLanguage({ searchAssist: SEARCH_ASSIST_VERSION }, { queries: [], language: 'de' }), null);
  assert.equal(planLanguage({ searchAssist: SEARCH_ASSIST_VERSION }, { queries: [] }), null);
  // A plan approved for search-assist-1 keeps the interface language.
  assert.equal(planLanguage({ searchAssist: 'rag-v2/search-assist-1' }, { queries: [], language: 'en' }), null);
  assert.equal(planLanguage({ searchAssist: 'rag-v2/search-assist-2' }, { queries: [], language: 'en' }), 'en');
  assert.deepEqual(SEARCH_ASSIST_VERSIONS, ['rag-v2/search-assist-1', 'rag-v2/search-assist-2', 'rag-v2/search-assist-3', 'rag-v2/search-assist-4', 'rag-v2/search-assist-5', 'rag-v2/search-assist-6', 'rag-v2/search-assist-7', 'rag-v2/search-assist-8', 'rag-v2/search-assist-9', 'rag-v2/search-assist-10', 'rag-v2/search-assist-11']);
});

test('search-assist-6 (ADR-072): a bare correction is about the person its fact belongs to and does not reopen an earlier question', async () => {
  const { planPerson, planPlaces, PLAN_CORRECTION_INSTRUCTIONS } = await import('../lib/rag-v2/pilot/search-assist.js');
  // The line of search-assist-6 is kept as it was in the later versions.
  assert.equal(SEARCH_ASSIST_VERSION, 'rag-v2/search-assist-11');
  const plan = queryPlanRequest(config, ['Kas A võib taotleda toetust?', 'Kui kiiresti otsustatakse?', 'Vabandust, B sissetulek on hoopis teine.'], 'et', ['user', 'A', 'B']);
  const lines = plan.instructions.split('\n');
  // One line, after the rule on person and before the rule on places; the rest of the instructions is unchanged.
  assert.deepEqual([lines.filter(line => line === PLAN_CORRECTION_INSTRUCTIONS).length, lines.indexOf(PLAN_CORRECTION_INSTRUCTIONS) - lines.findIndex(line => line.startsWith('people lists the persons')),
    lines.findIndex(line => line.startsWith('places: every municipality')) - lines.indexOf(PLAN_CORRECTION_INSTRUCTIONS)], [1, 1, 1]);
  // Whom it is about: the person the corrected fact belongs to, whoever the message before was about.
  for (const phrase of ['only corrects or updates a fact the user gave earlier (an amount, a date, a circumstance) and asks nothing new', 'it is about the person that fact belongs to: person is that person',
    'also when the message before it was about someone else']) assert.ok(PLAN_CORRECTION_INSTRUCTIONS.includes(phrase), phrase);
  // What it searches: an answered question is not a new task.
  for (const phrase of ['Such a message does not reopen an earlier question', 'earlier questions have had their answers', 'write queries only for what the corrected fact changes for that person',
    'or none when nothing needs looking up', 'never for an earlier question about another person or about a matter the fact does not change']) assert.ok(PLAN_CORRECTION_INSTRUCTIONS.includes(phrase), phrase);
  // It is limited to corrections: a message that describes a situation or asks something keeps the rules it had.
  assert.match(plan.instructions, /person: whose situation or need the current request is about/);
  assert.match(plan.instructions, /Return an empty list only when the message asks for no information, such as a greeting\./);
  // General: no person, relative, place, amount or subject of the conversations that showed the fault.
  assert.doesNotMatch(PLAN_CORRECTION_INSTRUCTIONS, /\d|\bema\b|\bisa\b|mother|father|parent|Kose|Harku|vald|pension|euro|deadline|application|benefit/iu);
  // The instructions never carry the conversation, and the contract of the answer is the one of search-assist-5.
  assert.ok(!plan.instructions.includes('Vabandust'));
  assert.deepEqual(plan.text.format.schema.required, ['queries', 'language', 'person', 'places']);
  assert.deepEqual(JSON.parse(plan.input[0].content), { language: 'et', messages: ['Kas A võib taotleda toetust?', 'Kui kiiresti otsustatakse?', 'Vabandust, B sissetulek on hoopis teine.'], people: ['user', 'A', 'B'], place_messages: 1 });
  // Plans approved for search-assist-5 and -6 both name a person and places.
  for (const version of ['rag-v2/search-assist-5', 'rag-v2/search-assist-6', 'rag-v2/search-assist-7', 'rag-v2/search-assist-8', SEARCH_ASSIST_VERSION]) {
    assert.equal(planPerson({ searchAssist: version }, { person: 'B' }), 'B');
    assert.deepEqual(planPlaces({ searchAssist: version }, { places: [] }), []);
  }
});

test('search-assist-4 (ADR-051): the plan names whose need the message is about and whose each named place is', async () => {
  const { planPerson, planPlaces } = await import('../lib/rag-v2/pilot/search-assist.js');
  const messages = ['Elan Tartu vallas.', 'Naabrimees elab Kose vallas.', 'Teine asi: mul pole täna kusagil magada.'];
  const plan = queryPlanRequest(config, messages, 'et', ['user', 'naabrimees']);
  assert.deepEqual(JSON.parse(plan.input[0].content).people, ['user', 'naabrimees']);
  // The user is always listed; the person is free text, so someone new keeps their own label.
  assert.deepEqual(JSON.parse(queryPlanRequest(config, messages, 'et').input[0].content).people, ['user']);
  // Places come from the current message, or from every message the saved state has not read, within the messages given.
  assert.equal(JSON.parse(plan.input[0].content).place_messages, 1);
  assert.equal(JSON.parse(queryPlanRequest(config, messages, 'et', [], 2).input[0].content).place_messages, 2);
  assert.equal(JSON.parse(queryPlanRequest(config, messages, 'et', [], 9).input[0].content).place_messages, 3);
  const schema = plan.text.format.schema.properties;
  assert.equal(schema.person.enum, undefined);
  assert.deepEqual(schema.places.items.properties.relation.enum, ['lives', 'not', 'other']);
  assert.match(plan.instructions, /do not put another person's place into a query about someone else/);
  // search-assist-5 (Codex J2): a place names its message and quotes the clause with the person and the relation.
  assert.match(plan.instructions, /turn is the number of the message it is in/);
  assert.match(plan.instructions, /quote is the clause that shows the person and the relation/);
  assert.deepEqual(schema.places.items.required, ['turn', 'quote', 'name', 'person', 'relation']);
  // A place in another script carries its Estonian name, which the server links to a word of the clause.
  assert.match(plan.instructions, /"Kose vald" for "в Козе"/);
  assert.match(plan.instructions, /a village or district keeps its own name/);
  assert.match(plan.instructions, /person is always one person/);
  const current = { searchAssist: SEARCH_ASSIST_VERSION };
  assert.equal(planPerson(current, { person: ' naabrimees ' }), 'naabrimees');
  assert.equal(planPerson(current, { person: '' }), null);
  assert.equal(planPerson(current, {}), null);
  assert.deepEqual(planPlaces(current, { places: [{ quote: 'Kose vallas', person: 'naabrimees', relation: 'lives' }] }), [{ quote: 'Kose vallas', person: 'naabrimees', relation: 'lives' }]);
  // An older plan names nobody and no place, so the scope falls back as before.
  assert.equal(planPerson({ searchAssist: 'rag-v2/search-assist-3' }, { person: 'user' }), null);
  assert.equal(planPlaces({ searchAssist: 'rag-v2/search-assist-3' }, { places: [] }), null);
});

// ADR-077: the plans the live questionnaire of 04.10.2026 recorded for one conversation of five unrelated legal questions
// (docs/audits/evidence/live-questionnaire-2026-10-04.json, Q9-Q13 and the clean repeat R13), word for word. The catalogue's
// checks must fail the plans that searched answered questions again and pass the ones that did not, whatever the answer.
test('ADR-077: the catalogue fails the stored plans that searched answered questions again and passes the clean ones', async () => {
  const fs = await import('node:fs/promises');
  const { checkTurn, validateCatalogue } = await import('../lib/rag-v2/pilot/conversation-eval.js');
  const catalogue = JSON.parse(await fs.readFile('tests/evaluation/dialogue/scenarios-answered-questions-1.json', 'utf8'));
  assert.deepEqual(validateCatalogue(catalogue), []);
  const turns = catalogue.scenarios[0].turns;
  const stored = JSON.parse(await fs.readFile('docs/audits/evidence/live-questionnaire-2026-10-04.json', 'utf8'));
  const recorded = name => Object.values(stored).find(Array.isArray).find(turn => turn.case === name);
  // The catalogue asks the questionnaire's five questions, in its order.
  assert.deepEqual(turns.map(turn => turn.text), ['Q9', 'Q10', 'Q11', 'Q12', 'Q13'].map(name => recorded(name).question));
  assert.deepEqual(turns.map(turn => (turn.expect.plan_queries_must_not || []).length), [0, 1, 2, 3, 4]);
  // Only the plan is judged here: every other check is given what it expects.
  const planOnly = (turn, queries) => checkTurn({ plan_queries_must_not: turn.expect.plan_queries_must_not }, { state: 'completed', summaries: [], details: [], contacts: 0, evidenceTitles: [], cited: [], text: '', queries });
  const failed = result => result.checks.filter(check => !check.ok).map(check => check.detail.match(/^\/([^/]+)\//u)[1]);
  assert.deepEqual(failed(planOnly(turns[1], recorded('Q10').plan.queries)), []);
  assert.deepEqual(failed(planOnly(turns[2], recorded('Q11').plan.queries)), ['toimetulek', 'abivajava']);
  assert.deepEqual(failed(planOnly(turns[3], recorded('Q12').plan.queries)), ['toimetulek', 'abivajava', 'eestkost']);
  assert.deepEqual(failed(planOnly(turns[4], recorded('Q13').plan.queries)), ['toimetulek', 'abivajava', 'eestkost', 'puude raskusast']);
  assert.equal(planOnly(turns[4], recorded('Q13').plan.queries).verdict, 'search');
  // The same question as a first message: its two queries are about the fee and the maintenance duty.
  assert.deepEqual(recorded('R13').plan.queries, ['täisealiste laste ülalpidamiskohustus hooldekodu kohatasu', 'üldhooldusteenuse rahastamine lähedaste ülalpidamiskohustus kohatasu']);
  assert.deepEqual([planOnly(turns[4], recorded('R13').plan.queries).verdict, failed(planOnly(turns[4], recorded('R13').plan.queries))], ['passed', []]);
  // A query that joins an earlier subject to the current one fails too (Q13's third query did).
  assert.deepEqual(failed(planOnly(turns[4], ['hooldekodu kohatasu ülalpidamiskohustus eestkoste'])), ['eestkost']);
  // What the selection kept in those turns: the titles of the kept passages, as the record has them.
  const kept = name => recorded(name).plan.rerank_selected.map(index => recorded(name).plan.rerank_candidates[index]);
  const selectedOnly = (patterns, name) => checkTurn({ selected_must_not: patterns }, { state: 'completed', summaries: [], details: [], contacts: 0, evidenceTitles: [], cited: [], text: '',
    rerank: { candidates: recorded(name).plan.rerank_candidates, selected: kept(name) } });
  const patternsOf = turn => turn.expect.selected_must_not;
  assert.deepEqual(failed(selectedOnly(patternsOf(turns[1]), 'Q10')), ['toimetulekutoetus']);
  assert.deepEqual(failed(selectedOnly(patternsOf(turns[2]), 'Q11')), ['toimetulekutoetus', 'abivajavast lapsest']);
  assert.deepEqual(failed(selectedOnly(patternsOf(turns[3]), 'Q12')), ['toimetulekutoetus', 'abivajavast lapsest']);
  assert.deepEqual(failed(selectedOnly(patternsOf(turns[4]), 'Q13')), ['abivajavast lapsest', 'puude raskusast|puude tuvastam']);
  assert.deepEqual([selectedOnly(patternsOf(turns[4]), 'Q13').verdict, selectedOnly(patternsOf(turns[4]), 'R13').verdict], ['search', 'passed']);
  // The same fault with a clean plan, in another conversation of the questionnaire: a guide on another subject was kept
  // for the third and the fifth question.
  for (const name of ['Q22', 'Q24']) {
    assert.ok(recorded(name).plan.queries.every(query => !/MARAC/iu.test(query)), name);
    assert.deepEqual(failed(selectedOnly(['MARAC'], name)), ['MARAC'], name);
  }
  // A turn without a recorded selection (the greeting route, an unavailable selection) has nothing to fail.
  assert.deepEqual(failed(checkTurn({ selected_must_not: ['x'] }, { state: 'completed', summaries: [], details: [], contacts: 0, evidenceTitles: [], cited: [], text: '' })), []);
  assert.deepEqual(validateCatalogue({ scenarios: [{ id: 'x', turns: [{ mode: 'new', text: 'a', expect: { selected_must_not: 'x' } }] }] }).length, 1);
  // The last turn also asks for the legal basis: R13's record (no passage of the act cited) fails on the citation.
  const last = checkTurn(turns[4].expect, { state: 'completed', region: null, summaries: [], details: [], contacts: 0, queries: recorded('R13').plan.queries,
    evidenceTitles: recorded('R13').evidence.titles.map(item => item.title), cited: recorded('R13').cited.map(item => ({ title: item.title, documentId: item.title })),
    text: 'Täiskasvanud lastel võib olla ülalpidamiskohustus, kuid kogu hooldekodu kohatasu ei lähe automaatselt laste kanda.' });
  assert.deepEqual(last.checks.filter(check => !check.ok).map(check => check.key), ['evidence', 'cited']);
});

test('search-assist-7 (ADR-077): the plan searches the current message only; a question about what changes keeps both versions', async () => {
  const { PLAN_ANSWERED_INSTRUCTIONS, RERANK_ANSWERED_INSTRUCTIONS, RERANK_CHANGE_INSTRUCTIONS, PLAN_CORRECTION_INSTRUCTIONS, candidateRecord, CANDIDATE_LEAD_CHARS } = await import('../lib/rag-v2/pilot/search-assist.js');
  // The lines of search-assist-7 stay in search-assist-8; the plan's line got one more sentence there (ADR-079).
  assert.equal(SEARCH_ASSIST_VERSION, 'rag-v2/search-assist-11');
  const messages = ['Mis on A?', 'Kes otsustab B üle?', 'Kuidas taotleda C-d?'];
  const plan = queryPlanRequest(config, messages, 'et'), lines = plan.instructions.split('\n');
  // One line, right after the rule on what the queries are for; the correction's line stays where it was.
  assert.deepEqual([lines.filter(line => line === PLAN_ANSWERED_INSTRUCTIONS).length,
    lines.indexOf(PLAN_ANSWERED_INSTRUCTIONS) - lines.findIndex(line => line.startsWith('Write up to 3 search queries')),
    lines.filter(line => line === PLAN_CORRECTION_INSTRUCTIONS).length], [1, 1, 1]);
  // What it says: earlier questions are answered; queries are for the current message; a message that continues an earlier
  // request (a reference to it, or a short reply that adds a detail, such as an answer to the assistant's question) is that request.
  for (const phrase of ['Earlier messages are context, not requests', 'every earlier question has had its answer', 'Write queries only for what the current message asks',
    'When the current message continues an earlier one, write the queries for that request as the current message completes it',
    'it continues one when it refers to it (it, that service, there, that person) or is a short reply that only adds a detail to it', 'Facts about the person that still apply are kept',
    'Do not write a query for an earlier question the current message neither asks again nor continues', 'do not add the subject of such a question to a query for the current one']) {
    assert.ok(PLAN_ANSWERED_INSTRUCTIONS.includes(phrase), phrase);
  }
  // General: no subject, act, person or place of the conversation that showed the fault.
  assert.doesNotMatch(PLAN_ANSWERED_INSTRUCTIONS, /\d|toimetulek|eestkost|puue|puude|hooldekodu|laps|child|guardian|disab|benefit|subsistence|care home|vald|Riigikogu/iu);
  // The instructions never carry the conversation; the plan's contract and input are those of search-assist-6.
  assert.ok(!plan.instructions.includes('Kes otsustab'));
  assert.deepEqual(plan.text.format.schema.required, ['queries', 'language', 'person', 'places']);
  assert.deepEqual(JSON.parse(plan.input[0].content), { language: 'et', messages, people: ['user'], place_messages: 1 });
  // The selection: the same rule said for passages, right after the rule on what to return, and one line after the rule on an act's versions.
  const passages = [{ id: 'P1', title: 'Kord', valid_from: '2026-01-01', valid_to: '2026-06-30', text: 'Kord\n§ 1\nvana' }, { id: 'P2', title: 'Kord', valid_from: '2026-07-01', valid_to: null, text: 'Kord\n§ 1\nuus' }];
  const selection = rerankRequest(config, ['Mis muutub korras alates 1. juulist?'], passages, '2026-06-15'), rules = selection.instructions.split('\n');
  assert.deepEqual([rules.filter(line => line === RERANK_CHANGE_INSTRUCTIONS).length,
    rules.indexOf(RERANK_CHANGE_INSTRUCTIONS) - rules.findIndex(line => line.startsWith('A passage from a legal act may give the validity of its version'))], [1, 1]);
  for (const phrase of ['asks what changes, changed or will change in an act on or from a date', 'compares the version in force before that date with the one in force from it',
    'for the provisions that differ keep the passage of each of the two versions (the same provision in both)', 'not only the newer one']) {
    assert.ok(RERANK_CHANGE_INSTRUCTIONS.includes(phrase), phrase);
  }
  assert.doesNotMatch(RERANK_CHANGE_INSTRUCTIONS, /\d|oktoob|Sakala|vald|sotsiaal/iu);
  assert.deepEqual([rules.filter(line => line === RERANK_ANSWERED_INSTRUCTIONS).length,
    rules.indexOf(RERANK_ANSWERED_INSTRUCTIONS) - rules.findIndex(line => line.startsWith('Return the ids of the passages that contain information the answer needs'))], [1, 1]);
  for (const phrase of ['Earlier messages are context, not requests', 'every earlier question has had its answer', 'Keep passages only for what the current message asks',
    'or for the earlier request it continues', 'it continues one when it refers to it (it, that service, there, that person) or is a short reply that only adds a detail to it',
    'Facts about the person that still apply are kept in mind', 'A passage that answers an earlier question the current message neither asks again nor continues is not useful']) {
    assert.ok(RERANK_ANSWERED_INSTRUCTIONS.includes(phrase), phrase);
  }
  assert.doesNotMatch(RERANK_ANSWERED_INSTRUCTIONS, /\d|toimetulek|eestkost|puue|puude|hooldekodu|laps|child|guardian|disab|benefit|MARAC|vald/iu);
  // What the selection is sent is unchanged: the passages as they were, and today's date.
  assert.deepEqual(JSON.parse(selection.input[0].content), { today: '2026-06-15', messages: ['Mis muutub korras alates 1. juulist?'], passages });
  // The turn record tells the candidates apart: two versions of one act share the title, two passages of one act too.
  assert.deepEqual(passages.map(candidateRecord), [{ id: 'P1', title: 'Kord', valid_from: '2026-01-01', lead: 'Kord § 1 vana' }, { id: 'P2', title: 'Kord', valid_from: '2026-07-01', lead: 'Kord § 1 uus' }]);
  assert.deepEqual(candidateRecord({ id: 'P3', title: 'Artikkel', year: '2017', text: `Artikkel\n${'x'.repeat(400)}` }), { id: 'P3', title: 'Artikkel', lead: `Artikkel ${'x'.repeat(CANDIDATE_LEAD_CHARS - 9)}` });
  assert.deepEqual(candidateRecord({ id: 'P4', title: 'Tühi' }), { id: 'P4', title: 'Tühi' });
});

// The ten paid turns of 04.10.2026 on search-assist-7 (the owner's permission): what the run recorded, read against the
// catalogues it ran (docs/audits/evidence/search-assist-7-measured-2026-10-04.json).
test('ADR-077 measured: the follow-up and both versions hold; in the five-question conversation the plan reopened once and the reserved law places went to earlier subjects', async () => {
  const fs = await import('node:fs/promises');
  const { checkTurn } = await import('../lib/rag-v2/pilot/conversation-eval.js');
  const run = JSON.parse(await fs.readFile('docs/audits/evidence/search-assist-7-measured-2026-10-04.json', 'utf8'));
  assert.deepEqual([run.turns.length, run.plan_price_usd, run.measured_commit.slice(0, 8)], [10, 0.05595, 'eb71cf9b']);
  assert.deepEqual(run.catalogues.map(item => [item.name, item.summary.passed, item.summary.search, item.summary.answer]),
    [['answered-questions', 2, 2, 1], ['version-change', 1, 0, 0], ['follow-up', 4, 0, 0]]);
  const of = name => run.turns.filter(turn => turn.run === name);
  const catalogue = async name => JSON.parse(await fs.readFile(`tests/evaluation/dialogue/${name}.json`, 'utf8'));
  const answered = (await catalogue('scenarios-answered-questions-1')).scenarios[0].turns, five = of('answered-questions');
  assert.deepEqual(five.map(turn => turn.text), answered.map(turn => turn.text));
  assert.deepEqual(five.map(turn => [turn.verdict, turn.failed.map(check => check.key)]),
    [['passed', []], ['passed', []], ['search', ['plan_queries_must_not', 'plan_queries_must_not']], ['answer', ['cited']], ['search', ['evidence', 'cited']]]);
  // The plan: the third turn's queries are the morning's, word for word; the fourth and fifth are about their own question.
  const stored = Object.values(JSON.parse(await fs.readFile('docs/audits/evidence/live-questionnaire-2026-10-04.json', 'utf8'))).find(Array.isArray);
  assert.deepEqual(five[2].queries.slice(0, 2), ['toimetulekupiir toimetulekutoetuse arvutamine', 'abivajavast lapsest teatamise kohustus kuhu teatada']);
  assert.equal(five[2].queries[1], stored.find(turn => turn.case === 'Q11').plan.queries[1]);
  const planOnly = (turn, queries) => checkTurn({ plan_queries_must_not: turn.expect.plan_queries_must_not }, { state: 'completed', summaries: [], details: [], contacts: 0, evidenceTitles: [], cited: [], text: '', queries });
  assert.deepEqual([1, 3, 4].map(index => planOnly(answered[index], five[index].queries).verdict), ['passed', 'passed', 'passed']);
  // The selection kept nothing of an earlier subject in any later turn: none of the failed checks is selected_must_not.
  assert.ok(five.every(turn => turn.failed.every(check => check.key !== 'selected_must_not')));
  // Turn 5: what the selection could choose from of national law. The Family Law Act's two candidates are on guardianship;
  // no candidate is a section on maintenance.
  const reserved = five[4].legal_candidates_not_selected;
  assert.deepEqual(reserved.map(lead => lead.match(/> (Sotsiaalhoolekande seadus|Riigilõivuseadus|Perekonnaseadus) >/u)[1]),
    ['Sotsiaalhoolekande seadus', 'Sotsiaalhoolekande seadus', 'Riigilõivuseadus', 'Perekonnaseadus', 'Perekonnaseadus', 'Riigilõivuseadus']);
  assert.deepEqual(reserved.filter(lead => lead.includes('Perekonnaseadus')).map(lead => lead.match(/§ \d+/u)[0]), ['§ 192', '§ 216']);
  assert.ok([...five[4].selected, ...reserved].every(lead => !/lalpidamiskohust|§ 9[67]\b/u.test(lead) || !lead.includes('Perekonnaseadus')));
  // Turn 1: the State Budget Act's one candidate is the first passage of its section, not the one with the amount.
  const budget = five[0].legal_candidates_not_selected.filter(lead => lead.includes('riigieelarve seadus'));
  assert.equal(budget.length, 1);
  assert.ok(!/220/u.test(five[0].answer) && five[0].found_legal.every(source => !source.title.includes('riigieelarve')));
  // Both versions: the same sections of the earlier and the new version were kept, and both are cited.
  const change = of('version-change')[0], sections = start => change.selected.filter(lead => lead.includes(`alates ${start}`)).map(lead => lead.match(/§ (\d+)\./u)[1]).sort();
  assert.deepEqual([sections('2025-09-01'), sections('2026-10-06')], [['1', '3', '4', '5', '6'], ['3', '4', '5', '6']]);
  assert.deepEqual(change.cited.map(source => source.from).sort(), ['2025-09-01', '2026-10-06']);
  // The answer compares ("Varem tuli esitada ..."), and one of its changes is false: the time limit it calls new is in
  // both versions (Codex review of #354 and #356, F1; tests/rag-v2-legal-scope.test.mjs reads the two source files).
  assert.match(change.answer, /Varem tuli esitada/u);
  assert.match(change.answer, /antakse nüüd tähtaeg nende parandamiseks/u);
  assert.equal(change.verdict, 'passed');
  // The follow-up: queries about the asked municipality's price, and its regulation's section on paying.
  const follow = of('follow-up')[2];
  assert.deepEqual([follow.text, follow.region, follow.verdict], ['Ja mis see maksab?', 'maardu_linn', 'passed']);
  assert.ok(follow.queries.every(query => /Maardu|isikliku abistaja/iu.test(query)) && follow.selected.some(lead => /§ 9\. Teenuse eest tasumine/u.test(lead)));
});

test('search-assist-8 (ADR-079): the plan does not fill its list with earlier questions, and a duty gets a query of its own', async () => {
  const { PLAN_ANSWERED_INSTRUCTIONS, PLAN_DUTY_INSTRUCTIONS, planPerson } = await import('../lib/rag-v2/pilot/search-assist.js');
  assert.equal(SEARCH_ASSIST_VERSION, 'rag-v2/search-assist-11');
  const plan = queryPlanRequest(config, ['Mis on A?', 'Kas B-lt võib nõuda C tasumist?'], 'et'), lines = plan.instructions.split('\n');
  // The measured plans (docs/audits/evidence/search-assist-7-measured-2026-10-04.json and the run after ADR-078): the third
  // question needs one query and got it with two for the earlier questions; the last sentence of the line is about that.
  assert.ok(PLAN_ANSWERED_INSTRUCTIONS.endsWith('One query is enough when the current message asks one thing: never fill the list with queries for earlier questions.'));
  assert.match(plan.instructions, /Write up to 3 search queries/u);
  // The duty's line: once, right after the rule on costs.
  assert.deepEqual([lines.filter(line => line === PLAN_DUTY_INSTRUCTIONS).length,
    lines.indexOf(PLAN_DUTY_INSTRUCTIONS) - lines.findIndex(line => line.startsWith('When the request is about what something costs'))], [1, 1]);
  for (const phrase of ['asks whether a person must do or pay something, or can be required to', 'make one query for that duty itself in the terms of the law that sets it',
    '(who owes what to whom, and on what conditions)', 'without the name of the service or the place']) assert.ok(PLAN_DUTY_INSTRUCTIONS.includes(phrase), phrase);
  // General: no duty, service, act, relative or place of the question that showed the fault.
  assert.doesNotMatch(PLAN_DUTY_INSTRUCTIONS, /\d|hooldekodu|care home|ülalpidam|maintenance|laps|child|vanem|parent|perekonna|family|vald/iu);
  // The plan's contract and input are unchanged, and plans approved for search-assist-7 are still read.
  assert.deepEqual(plan.text.format.schema.required, ['queries', 'language', 'person', 'places']);
  assert.deepEqual(JSON.parse(plan.input[0].content), { language: 'et', messages: ['Mis on A?', 'Kas B-lt võib nõuda C tasumist?'], people: ['user'], place_messages: 1 });
  assert.equal(planPerson({ searchAssist: 'rag-v2/search-assist-7' }, { person: 'B' }), 'B');
});
