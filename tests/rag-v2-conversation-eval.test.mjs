import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { checkTurn, turnPassages, validateCatalogue, SCENARIO_ROLES } from '../lib/rag-v2/pilot/conversation-eval.js';
import { USER_ROLES } from '../lib/rag-v2/pilot/contracts.js';
import { DIALOGUE_LIMITS } from '../lib/rag-v2/pilot/dialogue.js';
import { loneGreeting } from '../lib/rag-v2/pilot/greeting.js';

// The whole-conversation evaluation names what failed in a turn: search, answer or the conversation state.
const observed = (extra = {}) => ({ state: 'completed', error: null, crisis: false, region: 'harku_vald', previousStateCleared: null,
  summaries: ['Toimetulekutoetus'], details: [], contacts: 0, evidenceTitles: ['Haldusmenetluse seadus', 'Harku valla sotsiaalhoolekande kord'],
  cited: [{ title: 'Haldusmenetluse seadus', documentId: 'hms-2024' }], text: 'Esita vaie 30 päeva jooksul. [S1]', clarification: false, ...extra });
const validity = id => ({ 'hms-2024': { from: '2024-01-01', to: '2026-12-31' }, 'shs-feb-2027': { from: '2027-02-01', to: '2027-03-31' },
  'shs-now': { from: '2026-06-12', to: '2026-09-30' }, 'open-law': { from: '2020-01-01', to: null } })[id] || null;

test('the catalogue has known expectations, modes and a new start for every conversation', async () => {
  for (const name of (await fs.readdir('tests/evaluation/dialogue')).filter(file => file.endsWith('.json'))) {
    const catalogue = JSON.parse(await fs.readFile(`tests/evaluation/dialogue/${name}`, 'utf8'));
    assert.deepEqual(validateCatalogue(catalogue), [], name);
  }
  assert.deepEqual(validateCatalogue({ scenarios: [{ id: 'x', turns: [{ mode: 'same', text: 'a', expect: { wrong: 1, must: 'x', valid_on: 'soon' } }] }] }),
    ["x turn 1: a conversation starts with 'new'", 'x turn 1: unknown expectation wrong', 'x turn 1: must needs a list of patterns', 'x turn 1: valid_on soon']);
});

test('a missing source is a search failure, a wrong answer an answer failure, a wrong municipality a state failure', () => {
  const expect = { region: 'harku_vald', evidence: ['Haldusmenetluse seadus'], cited: ['Haldusmenetluse'], must: ['30 päeva'], valid_on: 'today' };
  assert.equal(checkTurn(expect, observed(), { today: '2026-09-28', validity }).verdict, 'passed');
  assert.equal(checkTurn(expect, observed({ evidenceTitles: ['Muu'], cited: [], text: 'Ei tea.' }), { today: '2026-09-28', validity }).verdict, 'search');
  assert.equal(checkTurn(expect, observed({ text: 'Esita vaie. [S1]' }), { today: '2026-09-28', validity }).verdict, 'answer');
  assert.equal(checkTurn(expect, observed({ region: 'kose_vald' }), { today: '2026-09-28', validity }).verdict, 'state');
  const failed = checkTurn({}, observed({ state: 'answer_rejected', error: 'invalid_answer_reference' }), { today: '2026-09-28' });
  assert.deepEqual([failed.verdict, failed.checks[0].detail], ['answer', 'invalid_answer_reference']);
});

test('a cited legal text must be in force on the asked date; sources without validity are not judged by date', () => {
  const on = (date, cited) => checkTurn({ valid_on: date }, observed({ cited }), { today: '2026-09-28', validity });
  const feb = { title: 'Sotsiaalhoolekande seadus', documentId: 'shs-feb-2027' }, now = { title: 'Sotsiaalhoolekande seadus', documentId: 'shs-now' };
  const other = { title: 'Haldusmenetluse seadus', documentId: 'hms-2024' };
  assert.equal(on('2027-03-01', [feb]).verdict, 'passed');
  const wrong = on('2027-06-01', [feb]);
  assert.equal(wrong.verdict, 'answer');
  assert.match(wrong.checks.find(check => check.key === 'valid_on').detail, /not in force on 2027-06-01: Sotsiaalhoolekande seadus 2027-02-01..2027-03-31/);
  assert.equal(on('today', [{ title: 'Harku kord', documentId: 'municipal' }]).verdict, 'passed');
  // Today's version of the same act beside the asked one (a comparison) is right; today's alone for 1 March 2027 is not.
  assert.equal(on('2027-03-01', [now, feb]).verdict, 'passed');
  assert.equal(on('2027-03-01', [now]).verdict, 'answer');
  // Codex review 28.09: another act in force on the date never vouches for a wrong version of the asked act.
  assert.equal(on('2026-09-28', [now, other]).verdict, 'passed');
  const vouched = on('2027-03-01', [now, { title: 'Teine seadus', documentId: 'open-law' }]);
  assert.equal(vouched.verdict, 'answer');
  assert.match(vouched.checks.find(check => check.key === 'valid_on').detail, /not in force on 2027-03-01: Sotsiaalhoolekande seadus 2026-06-12..2026-09-30$/);
  assert.equal(checkTurn({ must_not: ['Kose'], clarification: true }, observed({ text: 'Kose vallas', clarification: false }), { today: '2026-09-28' }).checks
    .filter(check => !check.ok).map(check => check.key).join(), 'must_not,clarification');
});

test('the search must find a version in force on the asked date: a found title of another version is a search failure', () => {
  const found = [{ title: 'Sotsiaalhoolekande seadus', documentId: 'hms-2024' }, { title: 'Harku kord', documentId: 'municipal' }];
  const turn = (date, extra) => checkTurn({ evidence: ['Sotsiaalhoolekande seadus'], found_valid_on: date }, observed({ evidenceTitles: ['Sotsiaalhoolekande seadus'], found, ...extra }),
    { today: '2026-09-28', validity });
  assert.equal(turn('today').verdict, 'passed');
  const missed = turn('2027-03-01');
  assert.equal(missed.verdict, 'search', 'the title matched, the version did not');
  assert.match(missed.checks.find(check => check.key === 'found_valid_on').detail, /found legal texts for 2027-03-01: Sotsiaalhoolekande seadus 2024-01-01..2026-12-31/);
  assert.equal(turn('2027-03-01', { found: [...found, { title: 'Sotsiaalhoolekande seadus', documentId: 'shs-feb-2027' }] }).verdict, 'passed');
  // Another found act in force on the date does not stand in for the expected one (Codex review 28.09).
  assert.equal(turn('2027-03-01', { found: [...found, { title: 'Teine seadus', documentId: 'open-law' }] }).verdict, 'search');
  // Without evidence patterns the cited ones name the expected act; without either, every found act is judged.
  const byCited = checkTurn({ cited: ['Sotsiaalhoolekande seadus'], found_valid_on: '2027-03-01' },
    observed({ found: [{ title: 'Sotsiaalhoolekande seadus', documentId: 'shs-now' }, { title: 'Teine seadus', documentId: 'open-law' }], cited: [] }), { today: '2026-09-28', validity });
  assert.equal(byCited.checks.find(check => check.key === 'found_valid_on').ok, false);
  assert.deepEqual(validateCatalogue({ scenarios: [{ id: 'x', turns: [{ mode: 'new', text: 'a', expect: { found_valid_on: 'March' } }] }] }), ['x turn 1: found_valid_on March']);
});

test('catalogue v4: an honest limit for a day without a legal text; an invented fee beside an unrelated doubt fails', async () => {
  const catalogue = JSON.parse(await fs.readFile('tests/evaluation/dialogue/scenarios-corpus-4.json', 'utf8'));
  const expect = catalogue.scenarios.find(scenario => scenario.id === 'law-on-dates').turns[3].expect;
  const verdict = text => checkTurn(expect, observed({ text, cited: [] }), { today: '2026-09-28', validity }).verdict;
  // The answers of runs 1-3 (docs/audits/rag-v2-conversation-eval-2026-09-28-run*.md).
  assert.equal(verdict('31. oktoobril 2026 kehtinud tasu ma selle teabe põhjal kinnitada ei saa.'), 'passed');
  assert.equal(verdict('30. oktoobrini oli lõiv 45 eurot. Ma ei saa siin kinnitada 31. oktoobril 2026 kehtinud riigilõivu.'), 'passed');
  assert.equal(verdict('Ma ei saa siin kinnitada, kui suur on ID-kaardi taotlemise riigilõiv 31. oktoobril 2026.'), 'passed');
  // v3 missed this honest answer of the ADR-046 run: 85 characters between the doubt and the day.
  assert.equal(verdict('Ma ei saa siin olemasoleva teabe põhjal kinnitada ID-kaardi taotlemise riigilõivu suurust 31. oktoobril 2026. aastal.'), 'passed');
  // Codex's negative example: a doubt about something else does not excuse an invented fee.
  assert.equal(verdict('31. oktoobril on tasu 999 eurot. Sinu pensioni suurust ei saa kinnitada.'), 'answer');
});

test('the saved state is judged too (Codex F5): a right catalogue with a wrong or rejected state is a state failure', async () => {
  const expect = { region: 'harku_vald', state_region: 'harku_vald', person_regions: { user: 'harku_vald' }, person: 'user', state_kept: true };
  const kept = observed({ stateRegion: 'harku_vald', personRegions: { user: 'harku_vald' }, person: 'user', stateFallback: null });
  assert.equal(checkTurn(expect, kept).verdict, 'passed');
  // Codex's synthetic turn: the catalogue is Harku, the saved state Kose, and the model's new state was rejected.
  const hidden = checkTurn(expect, observed({ stateRegion: 'kose_vald', personRegions: { user: 'kose_vald' }, person: 'user', stateFallback: 'invalid_dialogue_state' }));
  assert.equal(hidden.verdict, 'state');
  assert.deepEqual(hidden.checks.filter(check => !check.ok).map(check => check.key), ['state_region', 'person_regions', 'state_kept']);
  assert.equal(checkTurn({ person: 'ema' }, kept).verdict, 'state');
  // A person the state does not list has no region.
  assert.equal(checkTurn({ person_regions: { user: null } }, observed({ personRegions: { ema: 'kose_vald' } })).verdict, 'passed');
  assert.deepEqual(validateCatalogue({ scenarios: [{ id: 'x', turns: [{ mode: 'new', text: 'a', expect: { person_regions: {}, state_kept: false } }] }] }),
    ['x turn 1: person_regions needs persons', 'x turn 1: state_kept is true or absent']);
  for (const version of [1, 2]) {
    const catalogue = JSON.parse(await fs.readFile(`tests/evaluation/dialogue/scenarios-two-people-${version}.json`, 'utf8'));
    assert.deepEqual(validateCatalogue(catalogue), [], `two people ${version}`);
  }
});

test('ADR-054: a condition\'s exact phrase must be in the evidence text; other whitespace is the same text', async () => {
  const expect = { evidence_text: ['Vaie haldusaktile või toimingule tuleb esitada 30 päeva jooksul'] };
  const found = observed({ evidenceTexts: ['Vaide esitamise tähtaeg\nVaie haldusaktile või toimingule tuleb\nesitada 30 päeva jooksul, kui seadus ei sätesta teisiti.'] });
  assert.equal(checkTurn(expect, found, { today: '2026-09-29' }).verdict, 'passed');
  const missing = checkTurn(expect, observed({ evidenceTexts: ['Vaide läbivaatamise tähtaeg on 10 päeva.'] }), { today: '2026-09-29' });
  assert.equal(missing.verdict, 'search');
  assert.equal(checkTurn(expect, observed(), { today: '2026-09-29' }).verdict, 'search');
  assert.deepEqual(validateCatalogue(JSON.parse(await fs.readFile('tests/evaluation/dialogue/scenarios-coverage-1.json', 'utf8'))), []);
});

test('the fact lifecycle (Codex 7.6): each check has its failing pair, and an accepted model state alone satisfies none', () => {
  const fact = (id, person, quote, status = 'current') => ({ id, person, status, support: [{ turn: 1, quote }] });
  const run = (expect, facts, dropped = []) => checkTurn(expect, observed({ facts, dropped, stateFallback: null }), { today: '2026-09-29' });
  const failed = result => result.checks.filter(check => !check.ok).map(check => check.key);
  // A correct new fact is there / a fact the server left out for its missing quote is not, and its drop needs an allowance.
  const added = { facts_present: [{ person: 'user', quote: '2000 eurot' }] };
  assert.equal(run(added, [fact('F1', 'user', 'Mul on võlgu 2000 eurot.')]).verdict, 'passed');
  const lost = run(added, [], [{ kind: 'new_fact', reason: 'fact_not_quoted', person: 'user' }]);
  assert.deepEqual([lost.verdict, failed(lost)], ['state', ['facts_present', 'allowed_dropped']]);
  // A correction replaces the right person's old fact / the other person's fact of the same topic stays.
  const corrected = { fact_changes: [{ person: 'user', quote: '2000 eurot', status: 'superseded' }], facts_present: [{ person: 'ema', quote: '5000 eurot' }],
    facts_absent: [{ person: 'user', quote: '2000 eurot' }] };
  const right = [fact('F1', 'ema', 'Emal on võlgu 5000 eurot.'), fact('F2', 'user', 'Mul on võlgu 2000 eurot.', 'superseded'), fact('F3', 'user', 'Võlgu on 3000 eurot.')];
  assert.equal(run(corrected, right).verdict, 'passed');
  const wrongPerson = [fact('F1', 'ema', 'Emal on võlgu 5000 eurot.', 'superseded'), fact('F2', 'user', 'Mul on võlgu 2000 eurot.'), fact('F3', 'user', 'Võlgu on 3000 eurot.')];
  assert.deepEqual(failed(run(corrected, wrongPerson)), ['facts_present', 'facts_absent', 'fact_changes']);
  // A retraction ends the fact / the next turn does not bring it back; a replacement may be what the model chose.
  const retracted = { fact_changes: [{ person: 'user', quote: 'töötu', status: ['retracted', 'superseded'] }], facts_absent: [{ person: 'user', quote: 'töötu' }] };
  assert.equal(run(retracted, [fact('F1', 'user', 'Olen töötu.', 'retracted')]).verdict, 'passed');
  assert.deepEqual(failed(run(retracted, [fact('F1', 'user', 'Olen töötu.')])), ['facts_absent', 'fact_changes']);
  // model.accepted=true with no fact satisfies nothing; one allowance covers one drop of its person, not every drop.
  assert.equal(checkTurn(added, observed({ facts: [], dropped: [], stateFallback: null, model: { accepted: true } }), { today: '2026-09-29' }).verdict, 'state');
  const allowed = { allowed_dropped: [{ kind: 'new_fact', reason: 'fact_not_quoted', person: 'ema' }] };
  assert.equal(run(allowed, [], [{ kind: 'new_fact', reason: 'fact_not_quoted', person: 'ema' }]).verdict, 'passed');
  assert.equal(run(allowed, [], [{ kind: 'new_fact', reason: 'fact_not_quoted', person: 'ema' }, { kind: 'new_fact', reason: 'fact_not_quoted', person: 'ema' }]).verdict, 'state');
  assert.equal(run(allowed, [], [{ kind: 'new_fact', reason: 'fact_not_quoted', person: 'user' }]).verdict, 'state');
  // A left-out need is the model's inference, not a lost statement of the user.
  assert.equal(run(added, [fact('F1', 'user', 'Mul on võlgu 2000 eurot.')], [{ kind: 'needs', reason: 'reference_dropped' }]).verdict, 'passed');
  assert.deepEqual(validateCatalogue({ scenarios: [{ id: 'x', turns: [{ mode: 'new', text: 'a', expect: { facts_present: [{ person: 'user' }],
    fact_changes: [{ person: 'user', quote: 'x', status: 'gone' }], allowed_dropped: [{ kind: 'fact' }] } }] }] }),
  ['x turn 1: facts_present needs person and quote', 'x turn 1: fact_changes status', 'x turn 1: allowed_dropped needs kind and reason']);
});

// ADR-070 with two people (owner 03.10.2026: one paid run). The catalogue is fixed before the run; these checks are local.
test('the two-people catalogue: nine messages, the last one a correction, and mixed people or amounts fail it', async () => {
  const catalogue = JSON.parse(await fs.readFile('tests/evaluation/dialogue/scenarios-two-people-boundary-1.json', 'utf8'));
  assert.deepEqual(validateCatalogue(catalogue), []);
  const turns = catalogue.scenarios[0].turns, last = turns.at(-1).expect;
  // The first message is a lone greeting (the cheap route), the ninth the correction. Until ADR-105 eight messages
  // filled a topic and the ninth crossed its boundary; a topic now holds 30, so a run of this catalogue stays in one
  // topic and the boundary itself is covered by tests/rag-v2-dialogue-carry.test.mjs alone.
  assert.deepEqual([catalogue.scenarios.length, turns.length, turns.length < DIALOGUE_LIMITS.scopeTurns, Boolean(loneGreeting(turns[0].text)), turns.slice(1).some(turn => loneGreeting(turn.text))],
    [1, 9, true, true, false]);
  assert.ok(turns[8].text.includes('700') && turns[1].text.includes('600') && turns[3].text.includes('450'));
  const fact = (id, person, quote, status = 'current') => ({ id, person, status, support: [{ turn: 1, quote }] });
  const run = (facts, extra = {}) => checkTurn(last, observed({ region: 'kose_vald', person: 'ema', queries: [], personRegions: { ema: 'kose_vald', isa: 'harku_vald' }, facts, dropped: [], stateFallback: null,
    text: 'Arvestan nüüd, et ema pension on 700 eurot.', ...extra }));
  const failed = result => result.checks.filter(check => !check.ok).map(check => check.key);
  const right = [fact('F1', 'ema', 'tema pension on 600 eurot', 'superseded'), fact('F2', 'isa', 'tema pension on 450 eurot'), fact('F3', 'ema', 'ema pension on hoopis 700 eurot')];
  assert.equal(run(right).verdict, 'passed');
  // The correction lands on the father: his 450 is superseded and 700 is his.
  const onFather = [fact('F1', 'ema', 'tema pension on 600 eurot'), fact('F2', 'isa', 'tema pension on 450 eurot', 'superseded'), fact('F3', 'isa', 'ema pension on hoopis 700 eurot')];
  assert.deepEqual([run(onFather).verdict, failed(run(onFather))], ['state', ['facts_present', 'facts_present', 'facts_absent', 'facts_absent', 'fact_changes']]);
  // The mother's old amount stays current beside the new one; the father's amount is lost over the boundary.
  assert.deepEqual(failed(run([fact('F1', 'ema', 'tema pension on 600 eurot'), right[1], right[2]])), ['facts_absent', 'fact_changes']);
  assert.deepEqual(failed(run([right[0], right[2]])), ['facts_present']);
  // The father's municipality is lost, the search used his municipality, or the new state was rejected.
  assert.deepEqual(failed(run(right, { personRegions: { ema: 'kose_vald', isa: null } })), ['person_regions']);
  assert.deepEqual([run(right, { region: 'harku_vald' }).verdict, failed(run(right, { stateFallback: 'invalid_dialogue_state' }))], ['state', ['state_kept']]);
  // A fact the server left out is a lost change, whatever the remaining facts say.
  assert.deepEqual(failed(run(right, { dropped: [{ kind: 'superseded', reason: 'fact_not_quoted', person: 'ema' }] })), ['allowed_dropped']);
  // The answer: its first sentence names the amount (since ADR-071); it does not ask where the mother lives or give one
  // parent's amount as the other's.
  for (const text of ['Selge, arvestan edaspidi, et ema pension on 700 eurot, mitte 600. Isa pension on endiselt 450 eurot.',
    'Arvestan parandusega: ema pension on 700 eurot. Selle juures tuleb hooldekodu koha eest maksta tal endal.']) assert.equal(run(right, { text }).verdict, 'passed', text);
  for (const text of ['Aitäh, panin kirja.', 'Arvestan, et isa pension on nüüd 700 eurot.', 'Ema pension on 700 eurot. Millises vallas ta elab?',
    'Arvestan 700 euroga. Kus su ema elab?', 'Ema pension oli 450 eurot ja on nüüd 700 eurot.',
    'Aitäh täpsustuse eest. Ema 700-eurose pensioni juures tuleb hooldekodu koha eest maksta tal endal.']) assert.equal(run(right, { text }).verdict, 'answer', text);
  // Before the boundary: an answer about one parent that names the other's municipality or gives the other's pension fails.
  const answer = (index, text) => checkTurn({ must: turns[index].expect.must, must_not: turns[index].expect.must_not }, observed({ text })).verdict;
  assert.deepEqual([answer(4, 'Pöördu Harku valla sotsiaalosakonda.'), answer(4, 'Pöördu Kose valla sotsiaalosakonda.'), answer(6, 'Jah, isa võib toimetulekutoetust taotleda oma vallast.'),
    answer(6, 'Isa pension on 600 eurot, seega tasub taotleda.'), answer(5, 'Ema pensionist 450 eurot ei piisa.')], ['passed', 'answer', 'passed', 'answer', 'answer']);
});

// The comparison for the boundary run of 03.10.2026: the same last messages inside one topic. Fixed before its run; after
// both runs the correction turn's checks became one text in both catalogues (ADR-071). The answers the two runs gave are
// kept here as they were given.
const GIVEN_ACROSS_THE_BOUNDARY = ['Kui mõtled ema Kose valla taotlust, teeb vald teenuse või toetuse määramise või määramata jätmise otsuse kümne tööpäeva jooksul alates vajaliku viimase dokumendi saamisest või dokumendi esitamise tähtpäevast. [S1]',
  'Isa Harku valla taotluse puhul ei saa ma siin kinnitada varem nimetatud viie tööpäeva tähtaega.',
  'Arvestan parandusega: ema pension on 700 eurot. Kas küsid ema Kose valla või isa Harku valla taotluse otsustamise aega?'];
const GIVEN_WITHIN_THE_TOPIC = ['2023. aasta auditis kirjeldati, et kohalik omavalitsus teeb toimetulekutoetuse taotluse kohta otsuse viie tööpäeva jooksul pärast kogu vajaliku info saamist. [S2]',
  'Arvestan parandusega: ema pension on 700 eurot. Ma ei saa selle auditi põhjal kinnitada, kas isa taotluse puhul kehtib praegu sama tähtaeg.'];
test('the within-topic comparison holds the boundary scenario\'s last messages; both catalogues check the correction alike, and the answers of 03.10 fail', async () => {
  const read = async name => JSON.parse(await fs.readFile(`tests/evaluation/dialogue/${name}`, 'utf8'));
  const catalogue = await read('scenarios-two-people-within-topic-1.json'), boundary = (await read('scenarios-two-people-boundary-1.json')).scenarios[0].turns;
  assert.deepEqual(validateCatalogue(catalogue), []);
  const turns = catalogue.scenarios[0].turns, last = turns.at(-1).expect;
  // No boundary: the whole conversation fits one topic. The introductions are the boundary scenario's, joined; the
  // last three messages are its seventh to ninth, word for word.
  assert.ok(turns.length <= DIALOGUE_LIMITS.scopeTurns && !turns.some(turn => loneGreeting(turn.text)));
  assert.deepEqual(turns.map(turn => turn.text), [`${boundary[1].text} ${boundary[3].text}`, boundary[6].text, boundary[7].text, boundary[8].text]);
  // The correction turn is checked alike across the boundary and inside the topic: state and answer.
  assert.deepEqual(last, boundary[8].expect);
  assert.deepEqual([Object.keys(last), last.must.length, last.must_not.length],
    [['region', 'person', 'person_regions', 'state_kept', 'plan_queries_must_not', 'facts_present', 'fact_changes', 'facts_absent', 'must', 'must_not'], 1, 7]);
  const fact = (id, person, quote, status = 'current') => ({ id, person, status, support: [{ turn: 1, quote }] });
  const facts = [fact('F1', 'ema', 'tema pension on 600 eurot', 'superseded'), fact('F2', 'isa', 'tema pension on 450 eurot'), fact('F3', 'ema', 'ema pension on hoopis 700 eurot')];
  const run = (text, clarification = false) => checkTurn(last, observed({ region: 'kose_vald', person: 'ema', queries: [], personRegions: { ema: 'kose_vald', isa: 'harku_vald' }, facts, dropped: [], stateFallback: null, text, clarification }));
  // A failed must_not check is named by its pattern's place in the catalogue's list.
  const failed = result => result.checks.filter(check => !check.ok).map(check => check.key === 'must_not'
    ? `must_not ${last.must_not.indexOf(check.detail.slice(1, check.detail.lastIndexOf('/ not in the answer')))}` : check.key);
  // The answers the two runs of 03.10 gave, as given. Across the boundary: the confirmation not first, the answered
  // question solved again, an earlier statement called unconfirmable, and whose application is meant. Inside the topic:
  // the first three of these.
  assert.deepEqual([run(GIVEN_ACROSS_THE_BOUNDARY.join('\n\n'), true).verdict, failed(run(GIVEN_ACROSS_THE_BOUNDARY.join('\n\n'), true))],
    ['answer', ['must', 'must_not 4', 'must_not 5', 'must_not 6']]);
  assert.deepEqual([run(GIVEN_WITHIN_THE_TOPIC.join('\n\n')).verdict, failed(run(GIVEN_WITHIN_THE_TOPIC.join('\n\n')))], ['answer', ['must', 'must_not 4', 'must_not 5']]);
  // Each on its own.
  assert.deepEqual(failed(run('Aitäh täpsustuse eest. Arvestan parandusega: ema pension on 700 eurot.')), ['must']);
  assert.deepEqual(failed(run(`Arvestan parandusega: ema pension on 700 eurot.\n\n${GIVEN_ACROSS_THE_BOUNDARY[1].replace('viie tööpäeva tähtaega', 'väidet')}`)), ['must_not 5']);
  for (const again of ['Ema taotluse üle otsustab vald kümne tööpäeva jooksul.', 'Isa taotluse üle otsustab vald viie päeva jooksul.', 'Isa taotluse menetlemise tähtaeg ei muutu.']) {
    assert.deepEqual(failed(run(`Arvestan parandusega: ema pension on 700 eurot. ${again}`)), ['must_not 4'], again);
  }
  assert.deepEqual(failed(run('Arvestan parandusega: ema pension on 700 eurot. Kas küsid ema või isa kohta?')), ['must_not 6']);
  // Answers that only take the correction into account pass; so does one that says what it changes for the mother,
  // and one that asks for a circumstance the correction itself makes decisive.
  for (const text of ['Arvestan parandusega: ema pension on 700 eurot.', 'Arvestan parandusega: ema pension on 700 eurot. Isa pension on endiselt 450 eurot ja tema toimetulekutoetuse kohta öeldu jääb samaks.',
    'Selge, ema pension on 700 eurot, mitte 600. Hooldekodu kohatasu arvestamisel lähtutakse nüüd sellest summast.']) assert.equal(run(text).verdict, 'passed', text);
  assert.equal(run('Arvestan parandusega: ema pension on 700 eurot. Kas see on tema ainus sissetulek?', true).verdict, 'passed');
});

// ADR-071 (owner 03.10.2026: local cases): the three situations dialogue instructions 24 tell apart, each checked with
// example answers. No paid run has been made with this catalogue.
test('the correction cases: a bare correction, a correction with a new question, and a request to verify the earlier answer', async () => {
  const read = async name => JSON.parse(await fs.readFile(`tests/evaluation/dialogue/${name}`, 'utf8'));
  const catalogue = await read('scenarios-correction-cases-1.json'), within = (await read('scenarios-two-people-within-topic-1.json')).scenarios[0].turns;
  assert.deepEqual(validateCatalogue(catalogue), []);
  assert.deepEqual(catalogue.scenarios.map(scenario => scenario.id), ['correction-only', 'correction-with-new-question', 'verification-request']);
  // One conversation up to its third message (the within-topic comparison's), three different fourth messages.
  for (const scenario of catalogue.scenarios) assert.deepEqual(scenario.turns.slice(0, 3).map(turn => turn.text), within.slice(0, 3).map(turn => turn.text), scenario.id);
  const lastOf = id => catalogue.scenarios.find(scenario => scenario.id === id).turns.at(-1);
  assert.deepEqual([lastOf('correction-only').text, lastOf('correction-with-new-question').text.startsWith(`${within[3].text} `), lastOf('verification-request').text],
    [within[3].text, true, 'Kas see viie tööpäeva tähtaeg on ikka õige?']);
  const fact = (id, person, quote, status = 'current') => ({ id, person, status, support: [{ turn: 1, quote }] });
  const corrected = [fact('F1', 'ema', 'tema pension on 600 eurot', 'superseded'), fact('F2', 'isa', 'tema pension on 450 eurot'), fact('F3', 'ema', 'ema pension on hoopis 700 eurot')];
  const unchanged = [fact('F1', 'ema', 'tema pension on 600 eurot'), fact('F2', 'isa', 'tema pension on 450 eurot')];
  const ACT = { title: 'Sotsiaalhoolekande seadus', documentId: 'shs-now' };
  const run = (id, text, extra = {}) => checkTurn(lastOf(id).expect, observed({ region: id === 'verification-request' ? 'harku_vald' : 'kose_vald', person: id === 'verification-request' ? 'isa' : 'ema', queries: [],
    personRegions: { ema: 'kose_vald', isa: 'harku_vald' },
    facts: id === 'verification-request' ? unchanged : corrected, dropped: [], stateFallback: null, cited: id === 'verification-request' ? [ACT] : [], text, ...extra }));
  const failed = result => result.checks.filter(check => !check.ok).map(check => check.key);

  // 1. A bare correction: the within-topic comparison's turn, with the same checks; the answers of 03.10 fail it.
  assert.deepEqual(lastOf('correction-only').expect, within[3].expect);
  assert.equal(run('correction-only', 'Arvestan parandusega: ema pension on 700 eurot. Hooldekodu kohatasu arvestamisel lähtutakse nüüd sellest summast.').verdict, 'passed');
  assert.equal(run('correction-only', GIVEN_WITHIN_THE_TOPIC.join('\n\n')).verdict, 'answer');
  assert.equal(run('correction-only', GIVEN_ACROSS_THE_BOUNDARY.join('\n\n')).verdict, 'answer');

  // 2. A correction with a new question: the confirmation first, then the answer to that question.
  const asked = 'Arvestan parandusega: ema pension on 700 eurot. Hooldekodu koha eest maksab ema ise majutuse ja toitlustuse; hoolduskulu katab vald kehtestatud piirmäära ulatuses. [S1]';
  assert.equal(run('correction-with-new-question', asked).verdict, 'passed');
  // A limit of the evidence about the new question may be said: it was asked.
  assert.equal(run('correction-with-new-question', `${asked}\n\nMa ei saa siin kinnitada, kui suur on Kose valla piirmäär.`).verdict, 'passed');
  assert.deepEqual(failed(run('correction-with-new-question', 'Hooldekodu koha eest maksab ema ise majutuse ja toitlustuse. Arvestan parandusega: ema pension on 700 eurot.')), ['must']);
  assert.deepEqual(failed(run('correction-with-new-question', 'Arvestan parandusega: ema pension on 700 eurot.')), ['must'], 'the new question is not answered');
  assert.deepEqual(failed(run('correction-with-new-question', `${asked} Isa taotluse üle otsustab vald viie tööpäeva jooksul.`)), ['must_not'], 'the answered question is solved again');
  assert.deepEqual(failed(run('correction-with-new-question', asked, { facts: unchanged })), ['facts_present', 'facts_absent', 'fact_changes'], 'the correction is not saved');

  // 3. A request to verify the earlier answer: the claim is examined against the current evidence and cited from it.
  const verified = 'Jah. Toimetulekutoetuse taotluse kohta teeb vald otsuse viie tööpäeva jooksul pärast kõigi dokumentide esitamist. [S1]';
  assert.equal(run('verification-request', verified).verdict, 'passed');
  // Asked for, the limit of the evidence may be said too, as long as the Act is what the answer rests on.
  assert.equal(run('verification-request', `${verified}\n\nMa ei saa kinnitada, kas Harku vald otsustab tegelikult kiiremini.`).verdict, 'passed');
  // The earlier answer as the ground, with no source of this turn: not a verification.
  assert.deepEqual(failed(run('verification-request', 'Jah, nagu varem ütlesin, on tähtaeg viis tööpäeva ehk viie tööpäeva jooksul.', { cited: [] })), ['cited', 'must_not']);
  assert.deepEqual(failed(run('verification-request', 'Eelmise vastuse järgi on tähtaeg viie tööpäeva jooksul.', { cited: [ACT] })), ['must_not']);
  assert.deepEqual(failed(run('verification-request', 'Jah, viie tööpäeva jooksul.', { cited: [] })), ['cited'], 'stated again without this turn\'s source');
  assert.deepEqual(failed(run('verification-request', 'Vald teeb otsuse mõistliku aja jooksul. [S1]')), ['must'], 'the asked deadline is not addressed');
  // The question is about the father: the mother's municipality or a change to anyone's amount is a failure of state.
  assert.equal(run('verification-request', verified, { region: 'kose_vald' }).verdict, 'state');
  assert.deepEqual(failed(run('verification-request', verified, { facts: corrected })), ['facts_present']);
  // ADR-072, the search plan of each case: a correction with a new question searches that question for the mother; a
  // verification request is the father's, and there the deadline is what the plan is meant to look up.
  const careHome = ['hooldekodu kohatasu inimese omaosalus', 'üldhooldusteenuse eest tasumine pension'];
  assert.equal(run('correction-with-new-question', asked, { queries: careHome }).verdict, 'passed');
  assert.deepEqual(failed(run('correction-with-new-question', asked, { queries: [...careHome, 'toimetulekutoetuse taotluse menetlemise tähtaeg'] })), ['plan_queries_must_not', 'plan_queries_must_not']);
  assert.deepEqual(failed(run('correction-with-new-question', asked, { person: 'isa', queries: careHome })), ['person']);
  assert.equal(run('verification-request', verified, { queries: ['toimetulekutoetuse taotluse menetlemise tähtaeg'] }).verdict, 'passed');
  assert.deepEqual(failed(run('verification-request', verified, { person: 'ema' })), ['person']);

  // The one run of two of the cases with the model (03.10.2026, owner's permission): the answers as given, with the plans
  // the turns stored. The correction with a new question passed every check.
  const givenWithQuestion = ['Arvestan parandusega: ema pension on 700 eurot. Kose vallas tasub teenuse saaja majutus-, toitlustus- ja muud teenusega seotud kulud. Kose valla teenusekirjelduses on valla makstava hoolduskulu piirmäär 650 eurot kuus. Piirmäära ületavad kulud tasub inimene või tema pereliige; kui nad ei suuda maksta, hindab ametnik nende maksevõimet ja otsustab, kas vald katab kulud. [S1, S2, S60]',
    'Ema ei pea tingimata kõiki kulusid ise katma. Kui vald on välja selgitanud, et ta vajab ööpäevaringset üldhooldusteenust, rahastavad kohta vald ja teenuse saaja. Kui ema arvestatav sissetulek jääb alla võrdluseks oleva keskmise vanaduspensioni, katab vald teenuse saaja tasutavate kulude ja tema sissetuleku vahe, kuid mitte rohkem kui selle pensionisuuruse ja sissetuleku vahe. Riiklik pension on selle sissetuleku arvestuses üks arvesse minev tulu. [S2]',
    'Järgmise sammuna esita Kose Vallavalitsusele üldhooldusteenuse taotlus. Kose vallal on selleks taotlusvorm. [S32, S60]',
    'Ma ei saa 700-eurose pensioni põhjal öelda, kas ema jääb keskmise vanaduspensioni võrdluspiirist allapoole ega arvutada tema omaosalust. Siin ei ole võrdluspiiri suurust ega konkreetse teenuskoha kogukulu.'];
  assert.equal(run('correction-with-new-question', givenWithQuestion.join('\n\n'), { queries: ['Üldhooldusteenuse rahastamine hoolduskulud omaosalus ja erandid',
    'Kose vald üldhooldusteenuse kulude katmine inimese omaosalus', 'Üldhooldusteenuse eest tasumine pensioni ja sissetuleku arvestamine'] }).verdict, 'passed');
  // The verification answer examined the claim and cited the Act, with the numeral in the nominative ("viis tööpäeva").
  // The pattern of that day accepted "viie tööpäeva" and "5 tööpäeva" only, so the run recorded one failed check. The
  // pattern now accepts the numeral in any case form, and the answer passes; another deadline still does not.
  const givenVerified = 'Jah. Isa toimetulekutoetuse määramise tähtaeg on viis tööpäeva pärast kõigi vajalike dokumentide esitamist. See on otsuse tegemise tähtaeg, mitte väljamakse tähtaeg: arvestatud toetus makstakse välja kolme tööpäeva jooksul otsuse tegemisest. [S1, S2]';
  assert.equal(checkTurn({ must: ['(viie|5)\\s+tööpäeva'] }, observed({ text: givenVerified })).verdict, 'answer', 'the pattern the run of 03.10 used');
  assert.equal(run('verification-request', givenVerified, { queries: ['toimetulekutoetuse taotluse menetlemise tähtaeg viis tööpäeva'] }).verdict, 'passed');
  for (const text of ['Jah, viiel tööpäeval pärast dokumentide esitamist. [S1]', 'Jah, 5 tööpäeva jooksul. [S1]', 'Jah, otsus tuleb viie tööpäeva jooksul. [S1]',
    'Otsuseks on aega viis tööpäeva. [S1]', 'Vald peab hakkama saama viie tööpäevaga, see tähendab viit tööpäeva dokumentide esitamisest. [S1]']) assert.equal(run('verification-request', text).verdict, 'passed', text);
  for (const text of ['Ei, tähtaeg on kümme tööpäeva. [S1]', 'Tähtaeg on 15 tööpäeva. [S1]', 'Toetus makstakse välja kolme tööpäeva jooksul. [S1]']) assert.deepEqual(failed(run('verification-request', text)), ['must'], text);
  // Codex's review of #332 (P2): the pattern of #332 took any word beginning with "viis" or "viie" for the numeral five.
  // The answer of the run with only the numeral replaced: a larger number in words, in the nominative or the genitive, as
  // the last word of a compound numeral, or in digits, is another deadline and fails.
  const widened = '(?<![\\p{L}\\d])(vii[se]\\p{L}*|5)\\s+tööpäev\\p{L}*';
  for (const numeral of ['viisteist', 'viisteistkümmend', 'viiskümmend', 'viissada', 'viieteistkümne', 'viiekümne', 'viiesaja', 'kakskümmend viis', 'kahekümne viie', 'sada viis', 'saja viie',
    '15', '25', '50', '500', 'viiendal']) {
    const text = givenVerified.replace('viis tööpäeva', `${numeral} tööpäeva`);
    assert.notEqual(text, givenVerified);
    assert.deepEqual([run('verification-request', text).verdict, failed(run('verification-request', text))], ['answer', ['must']], numeral);
  }
  // What the pattern of #332 let through, so that the fault stays shown.
  for (const numeral of ['viisteist', 'viiskümmend', 'viissada']) {
    assert.equal(checkTurn({ must: [widened] }, observed({ text: givenVerified.replace('viis tööpäeva', `${numeral} tööpäeva`) })).verdict, 'passed', numeral);
  }
  // The pattern lists the numeral's forms as whole words; nothing in it stands for "any letters".
  const pattern = lastOf('verification-request').expect.must[0];
  assert.ok(pattern.includes('(viis|viit|viie|viiel|viiele|viielt|viieks|viiest|viiega|viieni|5)\\s+tööpäev') && !pattern.includes('vii[se]'));
});

// ADR-072 (owner 03.10.2026: local regression checks from the stored faulty plans). The search plans the correction turn
// got in the four runs of 03.10, as the evaluator's reports stored them (docs/audits/evidence keeps the queries). Two
// kinds of fault, and one plan with none.
const STORED_PLANS = {
  // Across the boundary, dialogue instructions 23: the right person and municipality, the answered question searched again.
  boundaryRun: { person: 'ema', region: 'kose_vald', queries: ['Kose vald koduteenuse taotluse menetlemise tähtaeg', 'sotsiaalteenuse taotluse otsustamise tähtaeg kohaliku omavalitsuse korraldus',
    'koduteenuse määramine taotlus abivajaduse hindamine tähtaeg'] },
  // The same fault across the boundary in the round of dialogue instructions 24.
  boundaryRound: { person: 'ema', region: 'kose_vald', queries: ['Kose vald sotsiaalteenuse taotluse otsustamise tähtaeg', 'Kohaliku omavalitsuse sotsiaalhoolekande otsuse tegemise tähtaeg'] },
  // Inside the topic, the round of instructions 24: the correction read as the father's turn, his subject searched.
  withinRound: { person: 'isa', region: 'harku_vald', queries: ['Harku valla toimetulekutoetus pension võlad taotlemine', 'Toimetulekutoetuse taotluse menetlemise tähtaeg kohaliku omavalitsuse otsus'] },
  // Inside the topic, the run of instructions 23: the mother, no query.
  withinRun: { person: 'ema', region: 'kose_vald', queries: [] },
};
test('ADR-072: the stored plans of the correction turn fail the catalogues\' plan checks; the right municipality with the wrong subject is caught', async () => {
  const read = async name => JSON.parse(await fs.readFile(`tests/evaluation/dialogue/${name}`, 'utf8'));
  const turns = [(await read('scenarios-two-people-boundary-1.json')).scenarios[0].turns[8], (await read('scenarios-two-people-within-topic-1.json')).scenarios[0].turns[3],
    (await read('scenarios-correction-cases-1.json')).scenarios[0].turns[3]];
  // The three correction turns check the plan alike: whom it read the message as about, and what its queries ask for.
  for (const turn of turns) assert.deepEqual([turn.text, turn.expect.person, turn.expect.plan_queries_must_not], ['Vabandust, ema pension on hoopis 700 eurot.', 'ema', turns[0].expect.plan_queries_must_not]);
  assert.equal(turns[0].expect.plan_queries_must_not.length, 2);
  const fact = (id, person, quote, status = 'current') => ({ id, person, status, support: [{ turn: 1, quote }] });
  const facts = [fact('F1', 'ema', 'tema pension on 600 eurot', 'superseded'), fact('F2', 'isa', 'tema pension on 450 eurot'), fact('F3', 'ema', 'ema pension on hoopis 700 eurot')];
  // The state and the answer are right in every case below: only the plan differs.
  const run = plan => checkTurn(turns[0].expect, observed({ personRegions: { ema: 'kose_vald', isa: 'harku_vald' }, facts, dropped: [], stateFallback: null,
    text: 'Arvestan parandusega: ema pension on 700 eurot.', ...plan }));
  const failed = result => result.checks.filter(check => !check.ok).map(check => check.key);
  const passed = (result, key) => result.checks.filter(check => check.key === key).every(check => check.ok);
  // The right person and the right municipality, the wrong subject: only the check of the queries fails, and it is a
  // failure of the search.
  for (const name of ['boundaryRun', 'boundaryRound']) {
    const result = run(STORED_PLANS[name]);
    assert.deepEqual([result.verdict, failed(result), passed(result, 'region'), passed(result, 'person')], ['search', ['plan_queries_must_not'], true, true], name);
    assert.match(result.checks.find(check => !check.ok).detail, /tähtaeg/u, name);
  }
  // The other person: the municipality, the person and both subjects (the answered question, and his own matter).
  const other = run(STORED_PLANS.withinRound);
  assert.deepEqual([other.verdict, failed(other)], ['search', ['region', 'person', 'plan_queries_must_not', 'plan_queries_must_not']]);
  // No fault: a plan with no query, or one that looks up what the corrected amount changes for the mother.
  assert.equal(run(STORED_PLANS.withinRun).verdict, 'passed');
  assert.equal(run({ person: 'ema', region: 'kose_vald', queries: ['hooldekodu kohatasu inimese omaosalus pension', 'koduteenuse tasu suurus sissetulek'] }).verdict, 'passed');
  // The right municipality again, with the father's subject instead of the answered question.
  assert.deepEqual(failed(run({ person: 'ema', region: 'kose_vald', queries: ['Kose vald toimetulekutoetuse taotlemine pension'] })), ['plan_queries_must_not']);
  assert.deepEqual(failed(run({ person: 'ema', region: 'kose_vald', queries: ['võlanõustamine Kose vallas'] })), ['plan_queries_must_not']);
  // The right queries with the wrong person, or with the wrong municipality, are failures of state.
  assert.deepEqual([run({ person: 'isa', region: 'kose_vald', queries: [] }).verdict, failed(run({ person: 'isa', region: 'kose_vald', queries: [] }))], ['state', ['person']]);
  assert.deepEqual(failed(run({ person: 'ema', region: 'harku_vald', queries: [] })), ['region']);
  // The check reads the plan's queries, never the answer: the same words in the answer are the answer checks' matter.
  assert.deepEqual(failed(checkTurn({ plan_queries_must_not: ['tähtaeg'] }, observed({ queries: [], text: 'Tähtaeg on viis tööpäeva.' }))), []);
  assert.deepEqual(failed(checkTurn({ plan_queries_must_not: ['tähtaeg'] }, observed({ text: 'x' }))), [], 'a turn with no stored plan has no query');
  assert.deepEqual(validateCatalogue({ scenarios: [{ id: 'x', turns: [{ mode: 'new', text: 'a', expect: { plan_queries_must_not: 'tähtaeg' } }] }] }), ['x turn 1: plan_queries_must_not needs a list of patterns']);
});

test('Codex R4: the hard-conditions answer patterns keep the direction of the condition; the opposite answer fails', async () => {
  const catalogue = JSON.parse(await fs.readFile('tests/evaluation/dialogue/scenarios-hard-conditions-2.json', 'utf8'));
  const expectOf = id => catalogue.scenarios.find(scenario => scenario.id === id).turns[0].expect;
  const verdict = (id, text) => checkTurn(expectOf(id), observed({ text, evidenceTexts: expectOf(id).evidence_text })).verdict;
  // Answers the chat gave in the v38 and v39 runs (30.09), each a correct statement of the rule.
  for (const text of ['Seejärel jäetakse kahel kuul palk täielikult arvestusest välja.', 'siis ei lähe töötasu arvestusse esimesel kahel kuul pärast selle saama hakkamist.',
    'jäetakse uus töötasu kahel esimesel kuul täielikult arvestamata.', 'siis ei võeta su palka toetuse arvestamisel esimesel kahel palga saamisele järgneval kuul üldse arvesse.']) {
    assert.equal(verdict('subsistence-new-job', text), 'passed', text);
  }
  for (const text of ['Jah, palk vähendab kohe toetust: kogu töötasu võetakse esimesest kuust täielikult arvesse.',
    'Palk läheb kohe arvestusse ja vähendab toetust juba järgmisel kuul.']) assert.equal(verdict('subsistence-new-job', text), 'answer', text);
  assert.equal(verdict('coach-reports-child', 'Edasta ainult lapse õiguste kaitseks vajalik teave.'), 'passed');
  assert.equal(verdict('coach-reports-child', 'Võid vallale edastada kõik andmed, mitte ainult vajalikud.'), 'answer');
});

test('ADR-063: every pattern of the third hard catalogue passes a right answer and fails the opposite one', async () => {
  const catalogue = JSON.parse(await fs.readFile('tests/evaluation/dialogue/scenarios-hard-conditions-3.json', 'utf8'));
  const graph = JSON.parse(await fs.readFile('tests/evaluation/graph/hard-conditions-3.json', 'utf8'));
  // The twin holds the graph catalogue's questions and phrases, one conversation each.
  assert.deepEqual(catalogue.scenarios.map(scenario => [scenario.id, scenario.turns[0].text, scenario.turns[0].expect.evidence_text, scenario.turns[0].expect.region ?? null]),
    graph.questions.map(question => [question.id, question.text, question.evidence_text, question.region ?? null]));
  const expectOf = id => catalogue.scenarios.find(scenario => scenario.id === id).turns[0].expect;
  // A question that names its provision is given that provision's passage, in the evidence and in the answer's references.
  const passagesOf = id => (expectOf(id).evidence_provision || []).map(item => ({ title: item.title.replace(/^\^|\$$/g, ''), section: item.section, text: item.text }));
  const verdict = (id, text, extra = {}) => checkTurn(expectOf(id), observed({ region: expectOf(id).region ?? null, text, evidenceTexts: expectOf(id).evidence_text,
    evidencePassages: passagesOf(id), citedPassages: passagesOf(id), ...extra })).verdict;
  // [right answer, opposite answer]: the right one states the deciding condition, the opposite one the rule without it.
  const answers = {
    'subsistence-home-loan': ['Jah, eluaseme soetamiseks võetud laenu tagasimakse koos intressiga võetakse eluasemekuluna arvesse valla piirmäära ulatuses.', 'Ei, laenumakse ei ole eluasemekulu.'],
    'referral-deadline-emergency': ['Eriolukorra ajal pikeneb tähtaeg 14 päevani. Kui sa selle aja jooksul teenuseosutaja poole ei pöördu, ei saa sa sama suunamisotsuse alusel enam teenust.', 'Pead pöörduma seitsme päeva jooksul kokkulepitud tähtpäevast.'],
    'student-turns-25': ['Ei. Kuul, mil poeg saab 25-aastaseks, õppija erisust enam ei kohaldata, seega teda sel alusel pere koosseisu ei arvata.', 'Jah, kuni 24-aastane üliõpilane arvatakse pere koosseisu, kui ta on teie juurde sisse kirjutatud.'],
    'refusal-only-home': ['Ei tohi. Vald ei või jätta toetust määramata vara tõttu, kui sul on ainult üks aastaringselt elamiseks kasutatav eluruum.', 'Jah, vald võib keelduda, kui vara tagab piisavad elatusvahendid.'],
    'service-ended-martial-law': ['Jah. Sõjaseisukorra ajal lõpetab teenuseosutaja teenuse, kui isik ei kasuta seda kauem kui 14 päeva, välja arvatud haiglaravi korral.', 'Ei, teenuse võib lõpetada alles siis, kui seda pole kasutatud kauem kui kaks kuud järjest.'],
    'rent-from-mother': ['Ei. Kui üürileandja on sinu ema, siis üüri toimetulekutoetuse arvestamisel arvesse ei võeta.', 'Jah, üür läheb eluasemekuluna arvesse valla piirmäära ulatuses.'],
    'pensioner-with-student-child': ['Jah, õigus säilib: üksi elamise nõuet ei kohaldata, kui sinuga elab laps, kes õpib ja ei ole veel 21-aastane.', 'Ei, sul ei ole õigust toetusele, sest sa ei ela registri järgi üksi.'],
    'child-rehabilitation-need': ['Lapse abivajadust hindab lastekaitsetöötaja või lapsega töötav isik; rehabilitatsiooni vajaduse määrab vald.', 'Abivajadust hindab perearst.'],
    'harku-support-person-relative': ['Ei. Tugiisikuteenust ei tohi vahetult osutada teenuse saaja esimese või teise astme sugulane, ja vanaema on teise astme üleneja sugulane.', 'Jah, vanaema võib olla tugiisik, kui vald ta määrab.'],
    'guardian-ward-family': ['Ei. Eestkostetavat, kelle eestkostja on temaga koos elav pereliige, ei loeta toimetulekutoetuse määramisel perekonna liikmeks.', 'Jah, venna sissetulek arvestatakse pere sissetulekuks, sest elate ühes korteris.'],
    'rent-debt-not-counted': ['Ei. Varem tekkinud võlgnevust ei arvata jooksva kuu eluasemekulude hulka.', 'Jah, võlg võetakse eluasemekuluna arvesse.'],
    'household-definition': ['Jah, kui teid seob ühine kodune majapidamine, loetakse teid perekonnaliikmeteks.', 'Ei, sõpru ei loeta perekonnaks, sest te ei ole sugulased.'],
    'kuusalu-limits-since': ['Määrust rakendatakse alates 1. maist 2026.', 'Piirmäärad kehtivad 15. septembrist 2026.'],
    'special-care-decision-time': ['Amet otsustab 40 tööpäeva jooksul taotluse ja kõigi nõutavate dokumentide saamisest.', 'Amet otsustab 30 päeva jooksul.'],
    'pensioner-day-centre': ['Ei võta. Õigus toetusele kaob ainult sellel, kellele osutatakse ööpäevaringset hooldusteenust väljaspool kodu; päevakeskus seda ei ole.', 'Jah, võtab: hooldusteenust saades sul ei ole õigust toetusele.'],
  };
  assert.deepEqual(Object.keys(answers), catalogue.scenarios.map(scenario => scenario.id));
  for (const [id, [right, opposite]] of Object.entries(answers)) {
    assert.equal(verdict(id, right), 'passed', `${id}: ${right}`);
    assert.equal(verdict(id, opposite), 'answer', `${id}: ${opposite}`);
  }
  // Harku's support person question is Põlva's in another municipality: the same checks (Codex review of #321). The deciding
  // sentence also stands under SHS § 29, and a prohibition about something else is not the answer.
  const harku = 'harku-support-person-relative', municipal = JSON.parse(await fs.readFile('tests/evaluation/dialogue/scenarios-abbreviation-municipal-1.json', 'utf8'));
  assert.deepEqual({ ...expectOf(harku), region: null }, { ...municipal.scenarios.find(scenario => scenario.id === 'polva-support-person-relative').turns[0].expect, region: null });
  const section29 = [{ title: 'Sotsiaalhoolekande seadus', section: '29', text: `Isikliku abistaja teenust ei tohi vahetult osutada isik, ${expectOf(harku).evidence_text[0]}.` }];
  assert.equal(verdict(harku, answers[harku][0], { evidencePassages: section29, citedPassages: section29 }), 'search', 'only § 29 in the evidence');
  assert.equal(verdict(harku, answers[harku][0], { citedPassages: section29 }), 'answer', 'cites § 29 only');
  assert.equal(verdict(harku, 'Vanaema võib olla lapse tugiisik. Tugiisik ei tohi avaldada lapse isikuandmeid.'), 'answer');
});

// The municipal abbreviation catalogue (measured 02.10.2026, no rule built): chosen with --scenarios, never part of a standing run.
test('the municipal abbreviation catalogue is the twin of its search catalogue; it names the provision itself, and its patterns bind the condition to its subject', async () => {
  const catalogue = JSON.parse(await fs.readFile('tests/evaluation/dialogue/scenarios-abbreviation-municipal-1.json', 'utf8'));
  const graph = JSON.parse(await fs.readFile('tests/evaluation/graph/abbreviation-municipal-1.json', 'utf8'));
  assert.deepEqual(catalogue.scenarios.map(scenario => [scenario.id, scenario.turns.length, scenario.turns[0].text, scenario.turns[0].expect.evidence_text, scenario.turns[0].expect.region]),
    graph.questions.map(question => [question.id, 1, question.text, question.evidence_text, question.region]));
  const expectOf = id => catalogue.scenarios.find(scenario => scenario.id === id).turns[0].expect;
  // Every turn names the Act's section for the evidence and for the answer's references, with the twin's phrase.
  for (const scenario of catalogue.scenarios) {
    const expect = scenario.turns[0].expect;
    assert.deepEqual([expect.evidence_provision.map(item => [item.section, item.text]), expect.cited_provision.map(item => item.section)],
      [[[expect.evidence_provision[0].section, expect.evidence_text[0]]], [expect.evidence_provision[0].section]], scenario.id);
  }
  // What a turn's evidence and references look like to the checks: the deciding passage of the Act, and the regulation.
  const SHS = 'Sotsiaalhoolekande seadus';
  const deciding = id => ({ title: SHS, section: expectOf(id).evidence_provision[0].section, text: `Sätte algus. ${expectOf(id).evidence_text[0]}; sätte lõpp.` });
  const regulation = { title: 'Valla kord', section: '4', text: 'Teenust võib osutada isik, kes vastab SHS § 25 esitatud nõuetele.' };
  const verdictOf = (id, text, extra = {}) => {
    const passages = extra.evidencePassages ?? [deciding(id), regulation];
    return checkTurn(expectOf(id), observed({ region: expectOf(id).region, text, evidenceTexts: passages.map(passage => passage.text), evidencePassages: passages,
      citedPassages: [deciding(id), regulation], ...extra }));
  };
  const verdict = (...args) => verdictOf(...args).verdict;
  // Right answers state the Act's condition; opposite ones deny it, give the rule without it, or use the same words about
  // something else (Codex review of #320: a bare number, or a prohibition elsewhere in the answer, passed before; of #321:
  // the monthly amount of another cost, or the duty to spend the amount denied, passed).
  const answers = {
    'narva-substitute-care-personal-costs': {
      right: ['Lapse isiklike kulude katteks tuleb iga kuu teha kulutusi keskmiselt 240 euro ulatuses ja vähemalt 2880 eurot aastas.',
        'Narva kord ise summat ei nimeta, vaid viitab seadusele: lapse isiklikeks kuludeks tuleb kulutada keskmiselt 240 eurot kuus.',
        'Miinimum ei ole kirjas Narva korras, vaid seaduses: lapse isiklikeks kuludeks keskmiselt 240 eurot kuus.',
        'Teenuseosutaja peab kulutama keskmiselt 240 eurot kuus lapse isiklike kulude katteks; perekodu muid kulusid see ei hõlma.'],
      opposite: ['Narva kord tagab seaduses sätestatud miinimumi, aga summat ma öelda ei saa.',
        'Narvas ei ole lapse isiklike kulude jaoks 240-eurost miinimumi; piisab 100 eurost kuus.',
        'Seaduses miinimumi ei ole. Teenuse hind on 240 eurot.',
        'Perekodu kohatasu on 240 eurot kuus. Lapse isiklikele kuludele kohustuslikku miinimumi ei ole.',
        'Lapse isiklike kulude katteks ei pea kulutama 240 eurot kuus; piisab 100 eurost kuus.',
        'Perekodu kohatasu on 240 eurot kuus. Lapse isiklike kulude suuruse otsustab perevanem.',
        'Lapse isiklikeks kuludeks 240 eurot kuus kulutama ei pea.',
        'Lapse isiklike kulude katteks on soovituslik 240 eurot kuus, kuid see ei ole kohustuslik.',
        'Lapse isiklike kulude jaoks on seaduses 240 eurot kuus, aga Narvas piisab 150 eurost.'] },
    'sillamae-aftercare-student': {
      right: ['Jah. Kui jätkad õppimist kutseõppes, tagab linn järelhooldusteenuse nominaalse õppeaja lõpuni, kuid mitte kauem kui sinu 25-aastaseks saamiseni.',
        'Jah. Linn peab sulle järelhooldusteenuse tagama seni, kuni õpid, kõige kauem kuni 25-aastaseks saamiseni. Kui õpingud katkestad, linn teenust enam ei taga.'],
      opposite: ['Ei. Järelhooldusteenus lõpeb täisealiseks saamisel.',
        'Järelhooldust ei tagata kuni 25-aastaseks saamiseni; teenus lõpeb 21-aastaselt.',
        'Linn ei pea sulle järelhooldusteenust tagama, sest oled juba 20-aastane; kuni 25-aastaseks saamiseni saad taotleda toimetulekutoetust.'] },
    'polva-support-person-relative': {
      right: ['Ei. Vanaema ei saa olla lapse tugiisikuteenuse vahetu osutaja, sest ta on teise astme üleneja sugulane.',
        'Ei. Tugiisikuteenust ei tohi vahetult osutada teenuse saaja esimese või teise astme sugulane, ja vanaema on teise astme üleneja sugulane.',
        'Vanaema ei või olla tugiisik, aga tugiisikuks võib olla muu isik, kes vastab nõuetele.'],
      opposite: ['Jah, vanaema võib olla tugiisik, kui ta annab kirjaliku nõusoleku.',
        'Vanaema võib olla lapse tugiisik. Tugiisik ei tohi avaldada lapse isikuandmeid.',
        'Vanaema võib olla tugiisik, kui ta ei saa lapsega koos elada.'] },
  };
  assert.deepEqual(Object.keys(answers), catalogue.scenarios.map(scenario => scenario.id));
  for (const [id, { right, opposite }] of Object.entries(answers)) {
    for (const text of right) assert.equal(verdict(id, text), 'passed', `${id}: ${text} — ${JSON.stringify(verdictOf(id, text).checks.filter(check => !check.ok))}`);
    for (const text of opposite) assert.equal(verdict(id, text), 'answer', `${id}: ${text}`);
    // The Act's words missing from the evidence, or the Act's passage of another section holding them: a search failure.
    assert.equal(verdict(id, right[0], { evidencePassages: [regulation] }), 'search', id);
    assert.equal(verdict(id, right[0], { evidencePassages: [{ ...deciding(id), section: '29' }, regulation] }), 'search', `${id}: the same words in § 29`);
    assert.equal(verdict(id, right[0], { evidencePassages: [{ ...deciding(id), title: 'Lastekaitseseadus' }, regulation] }), 'search', `${id}: another act`);
    // A right answer that cites only the regulation, or another section of the Act: an answer failure.
    assert.equal(verdict(id, right[0], { citedPassages: [regulation] }), 'answer', id);
    assert.equal(verdict(id, right[0], { citedPassages: [{ ...deciding(id), section: '29' }] }), 'answer', `${id}: cites § 29`);
    assert.equal(verdict(id, right[0], { region: 'kose_vald' }), 'state', id);
  }
  // Codex's own case: only § 29's sentence in the evidence, the answer right and citing that source. No longer passed.
  const section29 = { title: SHS, section: '29', text: 'Isikliku abistaja teenust ei tohi vahetult osutada isik, kes on teenuse saaja esimese või teise astme üleneja või alaneja sugulane.' };
  const wrongSection = verdictOf('polva-support-person-relative', answers['polva-support-person-relative'].right[0], { evidencePassages: [section29, regulation], citedPassages: [section29] });
  assert.deepEqual([wrongSection.verdict, wrongSection.checks.filter(check => !check.ok).map(check => check.key)], ['search', ['evidence_provision', 'cited_provision']]);
});

test('the provision checks read a saved turn\'s passages by their own section; a catalogue must name title, section and text', () => {
  const entry = (id, title, heading, text) => ({ evidence_id: id, bibliography: { title }, search_aids: { heading_prefix: heading }, source_text: text });
  const packet = { evidence: [entry('e1', 'Sotsiaalhoolekande seadus', 'Riigikogu > Sotsiaalhoolekande seadus > 3. jaotis Tugiisikuteenus > § 25. Nõuded teenust vahetult osutavale isikule', '§ 25. Nõuded … (2) Teenust ei tohi …'),
    entry('e2', 'Sotsiaalhoolekande seadus', 'Riigikogu > Sotsiaalhoolekande seadus > 12. jaotis Asendushooldusteenus > § 45¹¹. Asendushooldusteenuse rahastamine', '(3) Lapse isiklike kulude katteks …'),
    entry('e3', 'Teenuste kogumik', 'Teenuste kogumik > Sissejuhatus', 'Vaata SHS § 25.'), { evidence_id: 'e4', source_text: 'Kataloogikirje' }],
    reference_map: { S1: { evidence_id: 'e1' }, S2: { evidence_id: 'e3' }, S3: { evidence_id: 'missing' } } };
  const passages = turnPassages(packet, { blocks: [{ refs: ['S1', 'S2'] }, { refs: ['S1', 'S3'] }] });
  // The section is the passage's place in the document (the heading path), not a number its text mentions.
  assert.deepEqual(passages.evidencePassages.map(passage => [passage.title, passage.section]), [['Sotsiaalhoolekande seadus', '25'], ['Sotsiaalhoolekande seadus', '45^11'], ['Teenuste kogumik', null], ['', null]]);
  assert.deepEqual(passages.citedPassages.map(passage => [passage.title, passage.section]), [['Sotsiaalhoolekande seadus', '25'], ['Teenuste kogumik', null]]);
  assert.deepEqual(turnPassages(null, null), { evidencePassages: [], citedPassages: [] });
  const turn = expect => validateCatalogue({ scenarios: [{ id: 'x', turns: [{ mode: 'new', text: 'a', expect }] }] });
  assert.deepEqual(turn({ evidence_provision: [{ title: 'Seadus', section: '45^11', text: 'lause' }], cited_provision: [{ title: 'Seadus', section: '25' }] }), []);
  assert.deepEqual(turn({ evidence_provision: [{ title: 'Seadus', section: '§ 25', text: 'lause' }], cited_provision: [{ title: 'Seadus', section: '25', text: 'lause' }] }),
    ['x turn 1: evidence_provision needs title, section and text', 'x turn 1: cited_provision needs title, section']);
  assert.deepEqual(turn({ evidence_provision: [{ title: 'Seadus', section: '25' }], cited_provision: [] }),
    ['x turn 1: evidence_provision needs title, section and text', 'x turn 1: cited_provision needs title, section']);
});

test('ADR-062: the provision-date patterns fail the 30.09 answers and pass an answer that dates the rule by the act\'s own provision', async () => {
  const catalogue = JSON.parse(await fs.readFile('tests/evaluation/dialogue/scenarios-provision-dates-1.json', 'utf8'));
  const turnOf = id => catalogue.scenarios.find(scenario => scenario.id === id).turns[0];
  const failed = (id, text) => checkTurn(turnOf(id).expect, observed({ region: turnOf(id).expect.region, text,
    cited: [{ title: 'Sotsiaaltoetuste määrad ja piirmäärad', documentId: 'marjamaa' }] })).checks.filter(check => !check.ok).map(check => check.detail.slice(0, 24));
  // The questions of the 30.09 live check: Märjamaa's unchanged, Kuusalu's with one clause that asks for the date.
  assert.equal(turnOf('provision-date-marjamaa').text, 'Meil sündis augustis laps ja elame Märjamaa vallas, kus olen ise elanud juba mitu aastat. Kui suure sünnitoetuse vald maksab ja kas see makstakse kõik korraga välja?');
  assert.ok(turnOf('provision-date-kuusalu').text.endsWith('arvesse ja mis ajast see piirmäär kehtib?'));
  // Märjamaa's answer of 30.09 as the chat gave it: its first block, its limitation and its question.
  const given = ['Märjamaa vallas kehtib alates 4. septembrist 2026 sünnitoetusena kokku 800 eurot lapse kohta: 500 eurot lapse sünni registreerimisel ja 300 eurot pärast lapse aastaseks saamist. Seega ei maksta kogu toetust korraga.',
    'Ma ei saa öelda, kas alates 4. septembrist 2026 kehtiv summa rakendub augustis sündinud lapsele. Siin esitatud teave ei ütle, milline summa kehtis enne 4. septembrit ega seda, kuidas uus summa augustis tekkinud õiguse korral rakendub.',
    'Kas lapse sünd registreeriti enne või pärast 4. septembrit 2026?'];
  assert.deepEqual(failed('provision-date-marjamaa', given.join('\n')), ['/(?<!\\d)4\\.\\s*septemb|(?', '/(ei saa|ei oska)\\s+(öel']);
  assert.deepEqual(failed('provision-date-marjamaa', given[1]).length, 4, 'the doubt alone: both amounts missing, the day and the doubt present');
  // The answer the act supports: both parts, no start day of the version, no doubt; the day the amounts are applied from may be named.
  for (const text of ['Märjamaa vald maksab sünnitoetust kahes osas: 500 eurot lapse sünni registreerimisel ja 300 eurot lapse aastaseks saamisel. Korraga kogu summat ei maksta.',
    'Sünnitoetus on 500 eurot sünni registreerimisel ja 300 eurot lapse aastaseks saamisel. Neid summasid rakendatakse alates 1. jaanuarist 2026, seega ka augustis sündinud lapsele.',
    'Toetus on 500 + 300 eurot. Summad jõustusid 24.09.2025 ja 14. septembril esitatud taotlus ei muuda seda.']) assert.deepEqual(failed('provision-date-marjamaa', text), [], text);
  // The act's year of entry into force beside the amount, in any written form of the day, is the other wrong date.
  for (const text of ['Sünnitoetus on 500 eurot ja 300 eurot ning see kehtib alates 1. juulist 2018.', 'Alates 01.07.2018 on sünnitoetus 500 eurot ja 300 eurot.',
    'Määrus jõustus 2018. aastal ja sünnitoetus on 500 eurot ning 300 eurot.']) assert.deepEqual(failed('provision-date-marjamaa', text), ['/2018(?:[^.\\n]|(?<=\\d)\\.'], text);
  // Kuusalu: the amount and the day the regulation is applied from, in each written form; never the version's start day.
  for (const day of ['1. maist 2026', '01.05.2026', '1.05.2026', '2026. aasta 1. maist']) assert.deepEqual(failed('provision-date-kuusalu', `Vald võtab üürist arvesse kuni 480 eurot (40 m² × 12 eurot). Määrust rakendatakse alates ${day}.`), [], day);
  // The audit notes of 30.09 do not hold the answer with this day; the sentence is the defect as ADR-062 describes it.
  assert.deepEqual(failed('provision-date-kuusalu', 'Vald võtab arvesse kuni 480 eurot. See piirmäär kehtib alates 15. septembrist 2026.'), ['/(?<!\\d)1\\.\\s*mai\\p{L}*\\', '/(?<!\\d)15\\.\\s*septemb|(']);
  for (const text of ['Arvesse läheb 480 eurot. Piirmäär kehtib alates 15.09.2026, määrust rakendatakse alates 01.05.2026.', 'Arvesse läheb 480 eurot alates 11. maist 2026.', 'Arvesse läheb 480 eurot alates 31.05.2026.']) {
    assert.equal(failed('provision-date-kuusalu', text).length, 1, text);
  }
});

// ADR-107 left open that the runner could not set the user's role, so no specialist's or provider's conversation could be
// replayed. A scenario may name one of the chat service's roles; the runner sends it with every turn.
test('a scenario may name the role of its user: one of the roles of the chat service or none', () => {
  assert.deepEqual(SCENARIO_ROLES, USER_ROLES);
  const scenario = role => ({ scenarios: [{ id: 'x', ...(role === undefined ? {} : { role }), turns: [{ mode: 'new', text: 'a' }] }] });
  for (const role of [undefined, ...USER_ROLES]) assert.deepEqual(validateCatalogue(scenario(role)), [], String(role));
  for (const role of ['admin', 'SPECIALIST', '', null, 7]) assert.deepEqual(validateCatalogue(scenario(role)), [`x: role ${role}`], String(role));
});

// ADR-129 (10.10.2026): an answer names the provision a claim rests on, and the server counts and checks every one it
// names (provision-check.js, the turn's provisionAudit). The evaluation judges a turn by that count, not by a pattern
// over the answer's text.
const zeroKinds = { a: 0, b: 0, c: 0, v: 0, s: 0, p: 0, q: 0, d: 0 };
const provisionAudit = (mentions, naming, kinds = {}, extra = {}) => ({ version: 'rag-v2/provision-check-1', labelled: 3, mentions, blocks_naming: naming, kinds: { ...zeroKinds, ...kinds }, outside_blocks: 0, act_named: 0, act_not_shown: 0,
  from_other_sources: 0, collisions: 0, word_forms: 0, bare_subsections: 0, items: [], ...extra });

test('ADR-129: names_provision and provisions_at_most read the server\'s count; every turn with the audit is checked for an unsupported provision', () => {
  const failedOf = (expect, provisions, extra = {}) => checkTurn(expect, observed({ provisions, ...extra }), { today: '2026-10-10' }).checks.filter(check => !check.ok).map(check => check.key);
  // The catalogue's shape: true or false, a whole number.
  const catalogue = expect => ({ scenarios: [{ id: 'x', turns: [{ mode: 'new', text: 'a', expect }] }] });
  assert.deepEqual(validateCatalogue(catalogue({ names_provision: true, provisions_at_most: 3 })), []);
  assert.deepEqual(validateCatalogue(catalogue({ names_provision: false, provisions_at_most: 0 })), []);
  assert.deepEqual(validateCatalogue(catalogue({ names_provision: 'yes', provisions_at_most: 2.5 })), ['x turn 1: names_provision is true or false', 'x turn 1: provisions_at_most needs a whole number']);
  assert.deepEqual(validateCatalogue(catalogue({ provisions_at_most: -1 })), ['x turn 1: provisions_at_most needs a whole number']);
  // names_provision true: a block names one. A provision in a limitation alone, or a subsection without its section, is none.
  assert.deepEqual(failedOf({ names_provision: true }, provisionAudit(2, 1, { a: 2 })), []);
  assert.deepEqual(failedOf({ names_provision: true }, provisionAudit(1, 0, { q: 1 })), ['names_provision']);
  assert.deepEqual(failedOf({ names_provision: true }, provisionAudit(0, 0, {}, { bare_subsections: 1 })), ['names_provision']);
  assert.deepEqual(failedOf({ names_provision: true }, null), ['names_provision'], 'no audit: nothing labelled and nothing named');
  // names_provision false: none anywhere, also none the reader does not read.
  assert.deepEqual(failedOf({ names_provision: false }, null), []);
  assert.deepEqual(failedOf({ names_provision: false }, provisionAudit(0, 0)), []);
  assert.deepEqual(failedOf({ names_provision: false }, provisionAudit(1, 1, { a: 1 })), ['names_provision']);
  assert.deepEqual(failedOf({ names_provision: false }, provisionAudit(0, 0, {}, { bare_subsections: 1 })), ['names_provision']);
  // provisions_at_most: the mentions of the whole answer.
  assert.deepEqual([failedOf({ provisions_at_most: 3 }, provisionAudit(3, 2, { a: 3 })), failedOf({ provisions_at_most: 3 }, provisionAudit(4, 2, { a: 4 })), failedOf({ provisions_at_most: 0 }, null)], [[], ['provisions_at_most'], []]);
  // Always, when the turn has the audit: no provision that nothing gives, whatever the policy did with it; a check that
  // failed by itself is a failure too. It is an answer fault, and its detail lists what to read by hand.
  assert.deepEqual(failedOf({}, provisionAudit(2, 1, { a: 1, c: 1 })), []);
  const refused = checkTurn({ names_provision: true }, observed({ state: 'answer_rejected', error: 'unsupported_provision', text: '',
    provisions: provisionAudit(2, 1, { a: 1, d: 1 }, { items: [{ at: '$.blocks[0].text', provision: '§ 999 lg 1', kind: 'd', act: 'not_shown' }, { at: '$.blocks[1].text', provision: '§ 200', kind: 'b', act: 'unnamed', source: 'not_an_act' },
      { at: '$.blocks[2].text', provision: '§ 6 lg 2', kind: 'a', act: 'unnamed', after_other_act: true }] }) }), { today: '2026-10-10' });
  assert.deepEqual([refused.verdict, refused.checks.filter(check => !check.ok).map(check => [check.key, check.kind])], ['answer', [['completed', 'answer'], ['provisions_supported', 'answer']]]);
  assert.equal(refused.checks.find(check => check.key === 'provisions_supported').detail, 'kinds a 1, d 1; to read by hand: § 999 lg 1 (d, $.blocks[0].text); § 200 (b, not an act, $.blocks[1].text); § 6 lg 2 (a, no act named after another act, $.blocks[2].text)');
  assert.deepEqual(failedOf({}, { version: 'rag-v2/provision-check-1', failed: true }), ['provisions_supported']);
  // A turn without the audit gets no such check: the catalogues written before ADR-129 read as they did.
  assert.equal(checkTurn({}, observed(), { today: '2026-10-10' }).checks.some(check => check.key === 'provisions_supported'), false);
});

test('ADR-129: the provisions catalogue: its roles and turns, the turns where the user names a provision, and its patterns against written answers', async () => {
  const catalogue = JSON.parse(await fs.readFile('tests/evaluation/dialogue/scenarios-provisions-1.json', 'utf8')), turns = catalogue.scenarios.flatMap(scenario => scenario.turns.map(turn => ({ ...turn, id: scenario.id, role: scenario.role })));
  assert.deepEqual(validateCatalogue(catalogue), []);
  assert.deepEqual([catalogue.scenarios.length, turns.length], [20, 22]);
  const byRole = role => catalogue.scenarios.filter(scenario => scenario.role === role).length;
  assert.deepEqual([byRole('help_seeker'), byRole('specialist'), byRole('service_provider'), catalogue.scenarios.every(scenario => SCENARIO_ROLES.includes(scenario.role))], [8, 11, 1, true]);
  // The run is paid and no standing run includes it: the catalogue itself says how it may be run.
  for (const phrase of ['PAID', '--max-usd 0.15', 'run it ONCE', 'A repeat', 'needs a new yes']) assert.ok(catalogue.purpose.includes(phrase), phrase);
  // The questions the owner named: what a named section and subsection says, a help seeker's follow-up, specialist questions.
  const text = id => catalogue.scenarios.find(scenario => scenario.id === id).turns.map(turn => turn.text);
  assert.deepEqual(text('specialist-named-provision'), ['Mida ütleb SHS § 133 lg 5?']);
  assert.deepEqual(text('subsistence-deadline')[1], 'Mis paragrahv seda ütleb?');
  assert.deepEqual(text('specialist-home-loan')[1], 'Mis lõige seda täpselt ütleb?');
  // The review's additions: a subsection that does not exist, an act outside the corpus, a false premise, a raised
  // digit, two municipalities' regulations of one title, a question a guide alone supports.
  for (const id of ['specialist-named-missing-subsection', 'specialist-named-act-outside-corpus', 'false-premise-flat', 'specialist-raised-digit', 'specialist-two-municipalities', 'specialist-guide-only']) assert.equal(text(id).length, 1, id);
  // The named-provision turn tells a miss of the search from an answer fault: the passage that holds the subsection.
  const named = turns.find(turn => turn.id === 'specialist-named-provision').expect;
  assert.deepEqual([named.evidence_provision[0].section, named.cited_provision[0].section, named.names_provision], ['133', '133', true]);
  assert.equal(checkTurn(named, observed({ provisions: provisionAudit(1, 1, { a: 1 }), evidencePassages: [], citedPassages: [] }), { today: '2026-10-10' }).verdict, 'search');
  const passage = { title: 'Sotsiaalhoolekande seadus', section: '133', text: '(5)\nArvestades piirmäärasid, võetakse toimetulekutoetuse arvestamisel arvesse järgmised jooksval kuul tasumisele kuuluvad eluasemekulud:' };
  assert.equal(checkTurn(named, observed({ provisions: provisionAudit(1, 1, { a: 1 }), evidencePassages: [passage], citedPassages: [passage] }), { today: '2026-10-10' }).verdict, 'passed');
  // A help seeker is never given an abbreviation: the pattern against a written right answer and a written wrong one.
  const helpSeeker = turns.filter(turn => turn.role === 'help_seeker' && turn.expect.must_not);
  assert.equal(helpSeeker.length, 3);
  for (const turn of helpSeeker) {
    const failed = answer => checkTurn({ must_not: turn.expect.must_not }, observed({ text: answer }), { today: '2026-10-10' }).verdict;
    assert.deepEqual([failed('Vald peab otsustama viie tööpäeva jooksul (sotsiaalhoolekande seaduse § 134 lg 1).'), failed('Vald peab otsustama viie tööpäeva jooksul (SHS § 134 lg 1).')], ['passed', 'answer'], turn.id);
  }
  // A provision the user named and nothing gives: saying that its text is not at hand passes, stating something under it does not.
  const missing = turns.find(turn => turn.id === 'specialist-named-missing-subsection').expect, outside = turns.find(turn => turn.id === 'specialist-named-act-outside-corpus').expect;
  const verdict = (expect, answer) => checkTurn(expect, observed({ text: answer }), { today: '2026-10-10' }).verdict;
  assert.deepEqual([verdict(missing, 'Mul ei ole sotsiaalhoolekande seaduse § 133 lg 99 teksti; sellist lõiget ma siin ei näe.'), verdict(missing, 'Sotsiaalhoolekande seaduse § 133 lg 99 järgi makstakse toetust.'),
    verdict(missing, 'Paragrahvi 133 lõike 99 kohaselt makstakse toetust.')], ['passed', 'answer', 'answer']);
  // The honest limitation as the paid check of 10.10.2026 got it ("... mida § 133 lg 99 sätestab: ...") is no statement
  // under that number; "sätestab, et ..." is one.
  assert.deepEqual([verdict(missing, 'Ma ei saa siin oleva teabe põhjal öelda, mida sotsiaalhoolekande seaduse § 133 lg 99 sätestab: selle sätte teksti ei ole siin kasutada.'),
    verdict(missing, 'Sotsiaalhoolekande seaduse § 133 lg 99 sätestab, et toetust makstakse.')], ['passed', 'answer']);
  assert.deepEqual([verdict(outside, 'Võlaõigusseadust minu kogus ei ole, seega ma ei saa öelda, mida § 208 lõige 1 ütleb.'), verdict(outside, 'Võlaõigusseaduse § 208 lõike 1 kohaselt võib ostja lepingust taganeda.')], ['passed', 'answer']);
});

test('ADR-129: the run\'s provision totals for each role and in all: answers that name one, the kinds, kind b from a source that is no act, the cost a turn', async () => {
  const { provisionTotals } = await import('../lib/rag-v2/pilot/conversation-eval.js');
  const { PROVISION_KINDS } = await import('../lib/rag-v2/pilot/provision-check.js');
  const turn = (state, usd, provisions, error = null) => ({ observed: { state, error, usd, provisions } });
  const totals = provisionTotals([
    { id: 'a', role: 'help_seeker', turns: [turn('completed', 0.004, provisionAudit(2, 2, { a: 2 }, { act_named: 2 })), turn('completed', 0.004, provisionAudit(1, 0, { q: 1 }, { outside_blocks: 1 }))] },
    { id: 'b', role: 'help_seeker', turns: [turn('completed', 0.004, null)] },
    { id: 'c', role: 'specialist', turns: [turn('completed', 0.005, provisionAudit(6, 3, { a: 4, b: 1, c: 1 }, { from_other_sources: 1, collisions: 1, after_other_act: 2, act_named: 5, bare_subsections: 1 })),
      turn('answer_rejected', 0.005, provisionAudit(2, 1, { a: 1, d: 1 }, { act_not_shown: 1 }), 'unsupported_provision'), turn('completed', 0.005, { version: 'rag-v2/provision-check-1', failed: true })] },
    { id: 'd', turns: [turn('stopped', 0, null, 'pilot_budget_exhausted')] }]);
  assert.deepEqual(Object.keys(totals), ['all', 'help_seeker', 'specialist', 'no_role']);
  assert.deepEqual(totals.help_seeker, { turns: 3, completed: 3, refused: 0, check_failed: 0, answers_naming: 1, mentions: 3, kinds: { ...zeroKinds, a: 2, q: 1 }, from_other_sources: 0, collisions: 0, after_other_act: 0, outside_blocks: 1, act_named: 2, act_not_shown: 0,
    word_forms: 0, bare_subsections: 0, median_mentions: 1, largest_mentions: 2, usd: 0.012, usd_per_turn: 0.004 });
  // A refused turn's mentions are counted by kind, but it is no completed answer; a failed check adds no numbers.
  assert.deepEqual(totals.specialist, { turns: 3, completed: 2, refused: 1, check_failed: 1, answers_naming: 1, mentions: 8, kinds: { ...zeroKinds, a: 5, b: 1, c: 1, d: 1 }, from_other_sources: 1, collisions: 1, after_other_act: 2, outside_blocks: 0, act_named: 5,
    act_not_shown: 1, word_forms: 0, bare_subsections: 1, median_mentions: 3, largest_mentions: 6, usd: 0.015, usd_per_turn: 0.005 });
  assert.deepEqual([totals.all.turns, totals.all.completed, totals.all.refused, totals.all.answers_naming, totals.all.mentions, totals.all.kinds.d, totals.all.median_mentions, totals.all.largest_mentions, totals.all.usd],
    [7, 5, 1, 2, 11, 1, 1, 6, 0.027]);
  assert.deepEqual([totals.no_role.turns, totals.no_role.median_mentions, totals.no_role.usd_per_turn], [1, null, 0]);
  assert.deepEqual(provisionTotals([]), {});
  // The kinds are the check's own, in its order.
  assert.deepEqual(Object.keys(totals.all.kinds), [...PROVISION_KINDS]);
});
