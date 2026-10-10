// Toimetulekutoetuse eelhinnangu leht: vaadete reeglid ja lehe lubadused.
//
// Leht arvutab brauseris ega saada sisestatut kuhugi (omaniku otsus 04.08: konto
// avab lehe, aga sissetulek ei lähe serverisse). See lubadus on siin lukus.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  COST_GROUPS,
  EMPTY_FORM,
  STEP_KEYS,
  declaredCostKeys,
  euro,
  formTouched,
  gateQuestions,
  housingReason,
  issueFieldLabelKey,
  issueRows,
  plainNumber,
  stepStates,
  uniqueIssueCodes,
  wholeCount
} from '../components/benefits/subsistenceSteps.js';
import { estimateSubsistenceBenefit } from '../lib/benefits/subsistence.js';
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
    ['costsAreCurrentMonth', 'landlordIsFamilyOrTheirCompany', 'isApartmentBuilding', 'housingLoanConditionsMet', 'housingLoanMonthLimitReached']
  );
  /* Iga kulu, millel on arvutuses värav, toob oma küsimuse; eluasemelaen kaks (tingimused ja kuue kuu piir). */
  for (const kind of HOUSING_COST_KINDS.filter((item) => item.gate)) {
    assert.equal(gateQuestions([kind.key]).length, kind.key === 'housingLoan' ? 3 : 2, kind.key);
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
  /* Eelhinnangu samm on valmis ainult siis, kui arvutus andis summa. */
  assert.equal(stepStates({ adults: '1', minors: '0', workIncome: '0' }, {}, true).result, 'done');
  assert.equal(stepStates({ adults: '1', minors: '0', workIncome: '0' }, {}, false).result, 'empty');
});

test('puudujäägi lause ei kordu ja summa on kahe komakohaga', () => {
  assert.deepEqual(uniqueIssueCodes([{ code: 'GATE_UNANSWERED' }, { code: 'GATE_UNANSWERED' }, { code: 'ROOM_COUNT_REQUIRED' }, {}]), ['GATE_UNANSWERED', 'ROOM_COUNT_REQUIRED']);
  /* Kümnendmärk on lehe keele järgi: eesti ja vene keeles koma, inglise keeles punkt. */
  assert.equal(euro(12.5), '12,50 €');
  assert.equal(euro(12.5, 'ru'), '12,50 €');
  assert.equal(euro(12.5, 'en'), '12.50 €');
  assert.equal(euro(undefined), '0,00 €');
  assert.equal(plainNumber(68.5), '68,5');
  assert.equal(plainNumber(33, 'en'), '33');
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
  const strip = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const code = strip(page);
  /* Lubadus kehtib kogu lehe koodi kohta: ka reeglite ja arvutuse failid ei saada ega salvesta midagi. */
  const own = ['../components/benefits/SubsistenceCalculator.jsx', '../components/benefits/subsistenceSteps.js', '../lib/benefits/subsistence.js', '../lib/benefits/subsistenceRates.js'];
  for (const file of own) {
    const source = strip(read(file));
    for (const banned of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie']) {
      assert.ok(!source.includes(banned), `leht ei saada ega salvesta sisestatut: ${banned} (${file})`);
    }
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

/* --- Arvutus ise ------------------------------------------------------------------ */

const DAY = '2026-10-10';
const SINGLE = {
  adults: '1', minors: '0', workIncome: '120.50', otherIncome: '210.45', paidMaintenance: '', enforcementWithheld: '',
  dwellingAreaM2: '40', rooms: '2', singleOccupantExtendedNorm: false,
  housingCosts: { rent: '280', water: '14.20', heating: '60', electricity: '31.75', wasteRemoval: '5.90' },
  gates: { costsAreCurrentMonth: true, landlordIsFamilyOrTheirCompany: false },
  effectiveDate: DAY
};
const FAMILY = {
  adults: '2', minors: '2', workIncome: '1180.40', otherIncome: '160', enforcementWithheld: '90.25',
  dwellingAreaM2: '68.5', rooms: '3',
  housingCosts: { buildingManagement: '84.60', buildingRenovationLoan: '41.30', housingLoan: '310', buildingInsurance: '8.75', water: '38.40', hotWater: '24.10', heating: '96.80', electricity: '66.35', gas: '5.20', wasteRemoval: '9.15' },
  gates: { costsAreCurrentMonth: true, isApartmentBuilding: true, housingLoanConditionsMet: true, housingLoanMonthLimitReached: false },
  effectiveDate: DAY
};
const codes = (result) => result.issues.map((issue) => issue.code);

test('arvutus: kaks leibkonda annavad 2026. aasta määradega oodatud summa', () => {
  /* Üks inimene, üürikorter 40 m² ja kaks tuba: normpind 33 m², üür ja küte lähevad arvesse suhtega 33/40. */
  const single = estimateSubsistenceBenefit(SINGLE);
  assert.equal(single.usable, true);
  assert.equal(single.subsistenceLimit.total, 220);
  assert.equal(single.income.total, 330.95);
  assert.equal(single.housing.declaredTotal, 391.85);
  assert.equal(single.housing.total, 332.35);
  assert.equal(single.estimate, 221.4);
  assert.ok(single.caveats.includes('AREA_ABOVE_NORM_SCALED'));
  /* Üksi elav pensionär: normpind kuni 51 m², kärbet ei ole. */
  assert.equal(estimateSubsistenceBenefit({ ...SINGLE, singleOccupantExtendedNorm: true }).estimate, 280.9);
  /* Tube sama palju kui elanikke: arvesse läheb kogu pind. */
  assert.equal(estimateSubsistenceBenefit({ ...SINGLE, rooms: '1' }).estimate, 280.9);
  /* Kaks täisealist ja kaks last: 220 + 176 + 2 x 264 = 924; normpind 87 m² on eluruumist suurem. */
  const family = estimateSubsistenceBenefit(FAMILY);
  assert.equal(family.usable, true);
  assert.equal(family.subsistenceLimit.total, 924);
  assert.equal(family.housing.total, 684.65);
  assert.equal(family.housing.declaredTotal, 684.65);
  assert.equal(family.income.total, 1250.15);
  assert.equal(family.estimate, 358.5);
  assert.equal(family.isDecision, false);
});

test('arvutus: sisestamata sissetulek ei ole null sissetulek', () => {
  /* Puutumata leht (üks täisealine ette pandud, kõik muu tühi) näitas varem 220 € eelhinnangut. */
  const untouched = estimateSubsistenceBenefit({ adults: '1', minors: '0', workIncome: '', otherIncome: '', housingCosts: {}, gates: {}, effectiveDate: DAY });
  assert.equal(untouched.usable, false);
  assert.equal(untouched.estimate, null);
  assert.deepEqual(codes(untouched), ['INCOME_REQUIRED']);
  assert.deepEqual(codes(estimateSubsistenceBenefit({ adults: 1, effectiveDate: DAY })), ['INCOME_REQUIRED']);
  /* Null on vastus: inimene ütles ise, et sissetulekut ei olnud. Piisab ühest kahest väljast. */
  assert.equal(estimateSubsistenceBenefit({ adults: '1', workIncome: '0', effectiveDate: DAY }).estimate, 220);
  assert.equal(estimateSubsistenceBenefit({ adults: '1', otherIncome: 0, effectiveDate: DAY }).estimate, 220);
  assert.equal(estimateSubsistenceBenefit({ adults: '1', otherIncome: '300', effectiveDate: DAY }).estimate, 0);
});

test('arvutus: „ei" jooksva kuu küsimusele on vastus, mitte vastamata küsimus', () => {
  const no = estimateSubsistenceBenefit({ ...SINGLE, gates: { costsAreCurrentMonth: false, landlordIsFamilyOrTheirCompany: false } });
  assert.equal(no.usable, false);
  assert.deepEqual(codes(no), ['COSTS_NOT_CURRENT_MONTH']);
  const unanswered = estimateSubsistenceBenefit({ ...SINGLE, gates: { landlordIsFamilyOrTheirCompany: false } });
  assert.deepEqual(codes(unanswered), ['GATE_UNANSWERED']);
  /* Ilma kuludeta seda küsimust ei ole. */
  assert.equal(estimateSubsistenceBenefit({ adults: '1', workIncome: '0', gates: { costsAreCurrentMonth: false }, effectiveDate: DAY }).usable, true);
});

test('arvutus: eluasemelaenu kuue kuu piir on küsimus, kui leht seda küsib', () => {
  const asked = (answer) => estimateSubsistenceBenefit({ ...FAMILY, gates: { ...FAMILY.gates, housingLoanMonthLimitReached: answer } });
  assert.deepEqual(codes(asked(null)), ['GATE_UNANSWERED']);
  assert.deepEqual(codes(asked(true)), ['HOUSING_LOAN_MONTH_LIMIT_REACHED']);
  assert.equal(asked(false).usable, true);
  assert.ok(!asked(false).caveats.includes('HOUSING_LOAN_MONTHS_UNKNOWN'));
  /* Kutsuja, kes küsimust ei esita, saab endise käitumise: kuude arv või hoiatus. */
  const { housingLoanMonthLimitReached: _dropped, ...legacyGates } = FAMILY.gates;
  const legacy = estimateSubsistenceBenefit({ ...FAMILY, gates: legacyGates });
  assert.equal(legacy.usable, true);
  assert.ok(legacy.caveats.includes('HOUSING_LOAN_MONTHS_UNKNOWN'));
  assert.deepEqual(codes(estimateSubsistenceBenefit({ ...FAMILY, gates: { ...legacyGates, housingLoanMonthsUsedThisYear: 6 } })), ['HOUSING_LOAN_MONTH_LIMIT_REACHED']);
});

test('arvutus: kinnitamata aasta määraga summat ei anta', () => {
  const next = estimateSubsistenceBenefit({ ...SINGLE, effectiveDate: '2027-01-15' });
  assert.equal(next.usable, false);
  assert.ok(codes(next).includes('UNSUPPORTED_DATE'));
});

/* --- Mida leht tulemuse kohta ütleb ------------------------------------------------- */

test('kärbitud eluasemekulu kohta öeldakse põhjus ja sisestatud summa', () => {
  const reason = housingReason(estimateSubsistenceBenefit(SINGLE), 'et');
  assert.deepEqual(reason, { key: 'subsistence.reason.area_scaled', vars: { area: '40', norm: '33', percent: 83, declared: '391,85 €' } });
  /* Kui sisestatu läks täies mahus arvesse või summat ei ole, põhjust ei ole. */
  assert.equal(housingReason(estimateSubsistenceBenefit(FAMILY), 'et'), null);
  assert.equal(housingReason(estimateSubsistenceBenefit({ ...SINGLE, workIncome: '', otherIncome: '' }), 'et'), null);
  for (const lang of ['et', 'en', 'ru']) {
    const sentence = word(lang, 'subsistence.reason.area_scaled');
    for (const name of ['{area}', '{norm}', '{percent}', '{declared}']) assert.ok(sentence.includes(name), `${lang}: ${name}`);
  }
});

test('summa viga nimetab välja ja puudujäägi lause ütleb, mida teha', () => {
  assert.equal(issueFieldLabelKey('housingCosts.rent'), 'subsistence.costs.rent');
  assert.equal(issueFieldLabelKey('workIncome'), 'subsistence.fields.work_income');
  assert.equal(issueFieldLabelKey('housingCosts.tundmatu'), '');
  const negative = estimateSubsistenceBenefit({ ...SINGLE, workIncome: '-5', housingCosts: { ...SINGLE.housingCosts, water: 'abc' } });
  /* Kumbki viga nimetab oma välja: arvuks mitteloetav kulu ja negatiivne sissetulek. */
  assert.deepEqual(issueRows(negative.issues), [
    { code: 'INVALID_AMOUNT', fieldLabelKey: 'subsistence.costs.water' },
    { code: 'NEGATIVE_AMOUNT', fieldLabelKey: 'subsistence.fields.work_income' }
  ]);
  assert.deepEqual(issueRows([{ code: 'GATE_UNANSWERED', field: 'gates.a' }, { code: 'GATE_UNANSWERED', field: 'gates.b' }, {}]), [{ code: 'GATE_UNANSWERED', fieldLabelKey: '' }]);
  assert.deepEqual(issueRows([{ code: 'NEGATIVE_AMOUNT', field: 'housingCosts.rent' }, { code: 'NEGATIVE_AMOUNT', field: 'otherIncome' }]).length, 2, 'kaks välja, kaks rida');
  for (const lang of ['et', 'en', 'ru']) {
    for (const code of ['NEGATIVE_AMOUNT', 'INVALID_AMOUNT']) assert.ok(word(lang, `subsistence.issues_named.${code}`).includes('{field}'), `${lang}: ${code}`);
    for (const key of ['subsistence.issues.INCOME_REQUIRED', 'subsistence.issues.COSTS_NOT_CURRENT_MONTH', 'subsistence.gates.loan_limit', 'subsistence.leave_asked']) {
      assert.equal(typeof word(lang, key), 'string', `${lang}: ${key}`);
    }
  }
  /* Vastus, mis hinnangu peatab, ütleb ka, kuidas edasi saab. */
  for (const code of ['RENT_FROM_FAMILY_NOT_COUNTED', 'APARTMENT_BUILDING_COSTS_NOT_APPLICABLE', 'HOUSING_LOAN_CONDITIONS_NOT_MET', 'HOUSING_LOAN_MONTH_LIMIT_REACHED']) {
    assert.ok(/Kustuta/.test(word('et', `subsistence.issues.${code}`)), code);
  }
});

test('pereliikmete arv on täisarv ja muudetud vorm küsib enne lahkumist', () => {
  assert.equal(wholeCount('1.5'), 1);
  assert.equal(wholeCount('-2'), 0);
  assert.equal(wholeCount('250'), 99);
  assert.equal(wholeCount(''), 0);
  assert.equal(formTouched(EMPTY_FORM, {}), false);
  assert.equal(formTouched({ ...EMPTY_FORM }, { rent: '' }), false);
  assert.equal(formTouched({ ...EMPTY_FORM, workIncome: '0' }, {}), true);
  assert.equal(formTouched({ ...EMPTY_FORM, adults: '2' }, {}), true);
  assert.equal(formTouched(EMPTY_FORM, { rent: '1' }), true);
  assert.equal(formTouched({ ...EMPTY_FORM, costsAreCurrentMonth: false }, {}), true);
  const page = read('../components/benefits/SubsistenceCalculator.jsx');
  /* Lehe värav: kiirmenüü tagasinool ja Esc küsivad seda (lib/panelLeaveGuard.js). */
  assert.ok(page.includes('const release = setPanelLeaveGuard(leave);') && page.includes('if (!touched) return undefined;'));
  assert.ok(page.includes('t("subsistence.leave_asked")'));
  /* Üksi elava inimese märget pakutakse ainult ühe pereliikmega. */
  assert.ok(page.includes('{members === 1 ? ('));
  /* Kui toetust ei tuleks, ei öelda, et tegelik summa võib olla väiksem. */
  assert.match(page, /\{noBenefit \? \(\s+<p className=\{styles\.quiet\}>\{t\("subsistence\.caveat\.above_line"\)\}<\/p>\s+\) : result\.caveats\.includes\("KOV_HOUSING_LIMITS_UNKNOWN"\)/);
});
