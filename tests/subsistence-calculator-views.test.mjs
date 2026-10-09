// Toimetulekutoetuse eelhinnangu leht: vaadete reeglid ja lehe lubadused.
//
// Leht arvutab brauseris ega saada sisestatut kuhugi (omaniku otsus 04.08: konto
// avab lehe, aga sissetulek ei lähe serverisse). See lubadus on siin lukus.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { COST_GROUPS, STEP_KEYS, declaredCostKeys, euro, gateQuestions, stepStates, uniqueIssueCodes } from '../components/benefits/subsistenceSteps.js';
import { HOUSING_COST_KEYS, HOUSING_COST_KINDS } from '../lib/benefits/subsistenceRates.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const catalogs = Object.fromEntries(['et', 'en', 'ru'].map((lang) => [lang, JSON.parse(read(`../messages/${lang}.json`))]));
const word = (lang, key) => key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), catalogs[lang]);

test('iga eluasemekulu on täpselt ühes vaates', () => {
  const grouped = [...COST_GROUPS.costs, ...COST_GROUPS.utilities];
  assert.deepEqual([...grouped].sort(), [...HOUSING_COST_KEYS].sort());
  assert.equal(new Set(grouped).size, grouped.length);
});

test('täpsustavad küsimused tulevad sisestatud kuludest ja katavad arvutuse väravad', () => {
  assert.deepEqual(gateQuestions([]), []);
  assert.deepEqual(gateQuestions(['water']).map((question) => question.field), ['costsAreCurrentMonth']);
  assert.deepEqual(
    gateQuestions(['rent', 'buildingRenovationLoan', 'housingLoan']).map((question) => question.field),
    ['costsAreCurrentMonth', 'landlordIsFamilyOrTheirCompany', 'isApartmentBuilding', 'housingLoanConditionsMet']
  );
  /* Iga kulu, millel on arvutuses värav, toob oma küsimuse. */
  for (const kind of HOUSING_COST_KINDS.filter((item) => item.gate)) {
    assert.equal(gateQuestions([kind.key]).length, 2, kind.key);
  }
  /* Iga väli, mille kohta arvutus ütleb „vastamata", on küsimusena olemas. */
  const core = read('../lib/benefits/subsistence.js');
  const gateFields = [...core.matchAll(/field: "gates\.([A-Za-z]+)"/g)].map((match) => match[1]);
  const asked = gateQuestions(HOUSING_COST_KEYS).map((question) => question.field);
  assert.ok(gateFields.length >= 4);
  for (const field of gateFields) assert.ok(asked.includes(field), field);
});

test('sisestamata või nulliga kulu ei ole sisestatud kulu', () => {
  assert.deepEqual(declaredCostKeys({ rent: '250', water: '', gas: '0', heating: '-3', electricity: 'abc' }), ['rent']);
});

test('vaadete loend on alati sama ja seis tuleb sisestatust', () => {
  assert.deepEqual(STEP_KEYS, ['family', 'income', 'housing', 'costs', 'utilities', 'gates', 'result']);
  const empty = stepStates({ adults: '0', minors: '0' }, {});
  assert.deepEqual(empty, { family: 'empty', income: 'empty', housing: 'empty', costs: 'empty', utilities: 'empty', gates: 'empty', result: 'empty' });
  const partial = stepStates({ adults: '1', minors: '0', workIncome: '0', dwellingAreaM2: '40', costsAreCurrentMonth: true }, { rent: '300', water: '20' });
  assert.equal(partial.family, 'done');
  assert.equal(partial.income, 'done', 'null on ka sisestatud sissetulek');
  assert.equal(partial.housing, 'partial');
  assert.equal(partial.costs, 'done');
  assert.equal(partial.utilities, 'done');
  assert.equal(partial.gates, 'partial', 'üürileandja küsimus on vastamata');
  assert.equal(stepStates({ costsAreCurrentMonth: false, landlordIsFamilyOrTheirCompany: false }, { rent: '300' }).gates, 'done');
});

test('puudujäägi lause ei kordu ja summa on kahe komakohaga', () => {
  assert.deepEqual(uniqueIssueCodes([{ code: 'GATE_UNANSWERED' }, { code: 'GATE_UNANSWERED' }, { code: 'ROOM_COUNT_REQUIRED' }, {}]), ['GATE_UNANSWERED', 'ROOM_COUNT_REQUIRED']);
  assert.equal(euro(12.5), '12.50 €');
  assert.equal(euro(undefined), '0.00 €');
});

test('vaadete, kulude ja puudujääkide sõnad on kataloogis kolmes keeles', () => {
  const core = read('../lib/benefits/subsistence.js');
  const issueCodes = [...new Set([...core.matchAll(/code: "([A-Z_]+)"/g)].map((match) => match[1]))];
  assert.ok(issueCodes.length >= 8);
  const keys = [
    ...STEP_KEYS.flatMap((key) => [`subsistence.views.${key}.title`, `subsistence.views.${key}.short`]),
    'subsistence.views.family.summary',
    'subsistence.views.gates.none',
    ...HOUSING_COST_KEYS.map((key) => `subsistence.costs.${key}`),
    ...issueCodes.map((code) => `subsistence.issues.${code}`),
    ...gateQuestions(HOUSING_COST_KEYS).flatMap((question) => [question.text, question.hint].filter(Boolean))
  ];
  for (const lang of ['et', 'en', 'ru']) {
    for (const key of keys) assert.equal(typeof word(lang, key), 'string', `${lang}: ${key}`);
    for (const key of STEP_KEYS) assert.ok(word(lang, `subsistence.views.${key}.short`).length <= 18, `${lang}: lühinimi mahub kiirmenüüsse (${key})`);
    assert.ok(word(lang, 'subsistence.views.family.summary').includes('{adults}') && word(lang, 'subsistence.views.family.summary').includes('{minors}'));
  }
});

test('lehe lubadused: arvutus jääb seadmesse, kaks lubadust on enne sissetulekut', () => {
  const page = read('../components/benefits/SubsistenceCalculator.jsx');
  const code = page.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const banned of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie']) {
    assert.ok(!code.includes(banned), `leht ei saada ega salvesta sisestatut: ${banned}`);
  }
  assert.ok(code.includes('estimateSubsistenceBenefit('), 'arvutus tuleb puhtast funktsioonist');
  const family = code.indexOf('case "family"');
  const income = code.indexOf('case "income"');
  const firstView = code.slice(family, income);
  assert.ok(family > 0 && income > family);
  assert.ok(firstView.includes('subsistence.not_a_decision') && firstView.includes('subsistence.stays_on_device'), 'mõlemad lubadused on esimesel vaatel');
  /* Summat ei näidata, kui arvutus seda ohutult anda ei saa. */
  assert.ok(code.includes('result.usable ? ('));
  assert.ok(!page.includes('<h2') && page.includes('className="sr-only"'), 'lehe nimi on kiirmenüüs, mitte paneelil');
});
