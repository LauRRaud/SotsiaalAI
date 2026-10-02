import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { checkTurn, turnPassages, validateCatalogue } from '../lib/rag-v2/pilot/conversation-eval.js';

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
