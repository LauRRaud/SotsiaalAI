// Toimetulekutoetuse eelhinnang: arvutus, lehe reeglid ja lehe lubadused.
//
// Leht arvutab brauseris ega saada sisestatut kuhugi (omaniku otsus 04.08: konto
// avab lehe, aga sissetulek ei lähe serverisse). See lubadus on siin lukus.
//
// 10.10 vajutati leht esimest korda andmetega läbi ja kolm kontrollijat lugesid
// muudatuse üle (seadus, lehe käitumine, testid). Sellest ajast hoiab test lehe
// OTSUSEID käitumisena (`pageEstimate`, `estimateInput`, `resultNote` …), mitte
// lähteteksti järgi: varasem viga (tühi sissetulek läks arvutusse nullina ja
// puutumata leht näitas 220 €) oli ühendustes ja lähteteksti test seda ei näinud.
//
// Samal päeval murdis sõltumatu ülevaataja 94 reeglit ükshaaval ja 44 murret jäi
// testidele nägemata. Siit tulid juurde: makstud elatis, pinna reeglid iga kulu
// kaupa, iga värav mõlemas suunas, lõtvade väärtuste ring üle kõigi väravate,
// määrade tabel rida-realt, päev Tallinnas, lehe olek ja väljade tabel. Lehe faili
// enda ühendused (mis väli mis kohta kirjutab, mida vaade joonistab) on kõrvalfailis
// `subsistence-calculator-render.test.mjs`, mis joonistab lehe ja vajutab selle läbi.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ANSWER_CHOICES,
  COST_GROUPS,
  EMPTY_FORM,
  EMPTY_STATE,
  LOAN_CONDITION_KEYS,
  STEP_KEYS,
  VIEW_FIELDS,
  answerAction,
  answerFromChoice,
  armLeaveGuard,
  choiceFromAnswer,
  costFieldId,
  dateIssueCode,
  declaredCostKeys,
  estimateInput,
  euro,
  fieldAction,
  fieldValue,
  formTouched,
  gateQuestions,
  gateRows,
  housingReason,
  issueFieldLabelKey,
  issueRows,
  issueTextKey,
  leaveGuarded,
  markReducer,
  pageEstimate,
  pageReducer,
  pageScreen,
  pageView,
  plainNumber,
  quoted,
  readNumberInput,
  resultFacts,
  resultNote,
  resultView,
  showSingleOccupant,
  stepStates,
  stepSummaries,
  viewText,
  wholeCount
} from '../components/benefits/subsistenceSteps.js';
import {
  MAX_AMOUNT,
  MAX_DWELLING_AREA_M2,
  calculateCountedIncome,
  calculateFamilySubsistenceLimit,
  declaredHousingCostKeys,
  enteredRoomCount,
  estimateSubsistenceBenefit,
  resolveNormAreaM2
} from '../lib/benefits/subsistence.js';
import {
  HOUSING_COST_KEYS,
  HOUSING_COST_KINDS,
  RATES_CHECKED_ON,
  SUBSISTENCE_RATE_TABLE,
  currentRateFrom,
  dayInTallinn,
  resolveSubsistenceRates
} from '../lib/benefits/subsistenceRates.js';
import { panelLeaveAllowed, setPanelLeaveGuard, twoPressLeaveGuard } from '../lib/panelLeaveGuard.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const LANGS = ['et', 'en', 'ru'];
const catalogs = Object.fromEntries(LANGS.map((lang) => [lang, JSON.parse(read(`messages/${lang}.json`))]));
const word = (lang, key) => key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), catalogs[lang]);
/* Lehe tõlkija reegel: puuduva võtme korral tuleb tagasi võti ise, `{nimi}` asendatakse. */
const tFor = (lang) => (key, vars) => {
  const template = word(lang, key);
  const text = typeof template === 'string' ? template : key;
  return vars ? text.replace(/\{(\w+)\}/g, (whole, name) => (Object.hasOwn(vars, name) && vars[name] != null ? String(vars[name]) : whole)) : text;
};
const codes = (result) => result.issues.map((issue) => issue.code);
const DAY = '2026-10-10';

/* Üks inimene, üürikorter 40 m² ja kaks tuba: normpind 33 m², üür ja küte lähevad arvesse suhtega 33/40. */
const SINGLE_FORM = { ...EMPTY_FORM, workIncome: '120.50', otherIncome: '210.45', dwellingAreaM2: '40', rooms: '2', costsAreCurrentMonth: true, landlordIsTenantsRelative: false, landlordIsRelatedCompany: false };
const SINGLE_COSTS = { rent: '280', water: '14.20', heating: '60', electricity: '31.75', wasteRemoval: '5.90' };
/* Kaks täisealist ja kaks last, oma korter 68,5 m² ja kolm tuba, eluasemelaen. */
const FAMILY_FORM = {
  ...EMPTY_FORM,
  adults: '2',
  minors: '2',
  workIncome: '1180.40',
  otherIncome: '160',
  enforcementWithheld: '90.25',
  dwellingAreaM2: '68.5',
  rooms: '3',
  costsAreCurrentMonth: true,
  isApartmentBuilding: true,
  housingLoanConditionsMet: true,
  housingLoanMonthLimitReached: false
};
const FAMILY_COSTS = { buildingManagement: '84.60', buildingRenovationLoan: '41.30', housingLoan: '310', buildingInsurance: '8.75', water: '38.40', hotWater: '24.10', heating: '96.80', electricity: '66.35', gas: '5.20', wasteRemoval: '9.15' };
/* Kõik täpsustavad küsimused vastatud nii, et ükski kulu välja ei jää. */
const OPEN_GATES = Object.freeze({
  costsAreCurrentMonth: true,
  landlordIsTenantsRelative: false,
  landlordIsRelatedCompany: false,
  isApartmentBuilding: true,
  housingLoanConditionsMet: true,
  housingLoanMonthLimitReached: false,
  landTaxExempt: false
});
const GATE_FIELD_NAMES = Object.keys(OPEN_GATES);
/* Üks inimene ilma sissetulekuta, 30 m² (alla normpinna): piir 220 €, kulud lähevad arvesse täies mahus. */
const PLAIN_FORM = { ...EMPTY_FORM, workIncome: '0', dwellingAreaM2: '30', rooms: '2' };
const page = (form, costs = {}, bad = []) => pageEstimate(form, costs, bad, DAY);

/* --- Vaadete reeglid ---------------------------------------------------------------- */

test('iga eluasemekulu on täpselt ühes vaates', () => {
  const grouped = [...COST_GROUPS.costs, ...COST_GROUPS.utilities];
  assert.deepEqual([...grouped].sort(), [...HOUSING_COST_KEYS].sort());
  assert.equal(new Set(grouped).size, grouped.length);
});

test('täpsustavad küsimused tulevad sisestatud kuludest ja katavad arvutuse väravad', () => {
  assert.deepEqual(gateQuestions([]), []);
  assert.deepEqual(gateQuestions(['water']).map((question) => question.field), ['costsAreCurrentMonth']);
  assert.deepEqual(
    gateQuestions(['rent', 'buildingRenovationLoan', 'housingLoan', 'landTax']).map((question) => question.field),
    ['costsAreCurrentMonth', 'landlordIsTenantsRelative', 'landlordIsRelatedCompany', 'isApartmentBuilding', 'housingLoanConditionsMet', 'housingLoanMonthLimitReached', 'landTaxExempt']
  );
  /* Iga kulu, millel on arvutuses värav, toob oma küsimuse; üür ja eluasemelaen kaks. */
  const gated = HOUSING_COST_KINDS.filter((item) => item.gate).map((item) => item.key);
  assert.deepEqual(gated.sort(), ['buildingManagement', 'buildingRenovationLoan', 'housingLoan', 'landTax', 'rent']);
  for (const key of gated) assert.equal(gateQuestions([key]).length, key === 'housingLoan' || key === 'rent' ? 3 : 2, key);
  /* Eluasemelaenu neli tingimust seisavad loendina küsimuse juures, seaduse järjekorras. */
  assert.deepEqual(gateQuestions(['housingLoan'])[1].conditions, LOAN_CONDITION_KEYS);
  assert.equal(LOAN_CONDITION_KEYS.length, 4);
  /* Iga väli, mille kohta arvutus ütleb „vastamata", on küsimusena olemas ja läheb lehelt arvutusse. */
  const core = read('lib/benefits/subsistence.js');
  const gateFields = [...new Set([...core.matchAll(/field: "gates\.([A-Za-z]+)"/g)].map((match) => match[1]))];
  const asked = gateQuestions(HOUSING_COST_KEYS).map((question) => question.field);
  assert.equal(gateFields.length, 7);
  assert.deepEqual([...gateFields].sort(), [...GATE_FIELD_NAMES].sort());
  for (const field of gateFields) {
    assert.ok(asked.includes(field), field);
    assert.ok(field in estimateInput(EMPTY_FORM, {}).gates, `leht annab arvutusele: ${field}`);
    assert.ok(field in EMPTY_FORM, `vormis on koht: ${field}`);
  }
});

test('sisestamata või nulliga kulu ei ole sisestatud kulu, ja see tähendab lehele sama mis arvutusele', () => {
  assert.deepEqual(declaredCostKeys({ rent: '250', water: '', gas: '0', heating: '-3', electricity: 'abc' }), ['rent']);
  /* Üks reegel: leht küsib küsimusi sama loendi järgi, mille järgi arvutus vastuseid nõuab. */
  const samples = [{}, { rent: '0' }, { rent: '0.00', water: '-0' }, { rent: '0.01' }, { housingLoan: '300', landTax: '', gas: '0' }, { water: Number.NaN }];
  for (const costs of samples) assert.deepEqual(declaredCostKeys(costs), declaredHousingCostKeys(costs));
  /* Kulu väljale kirjutatud „0": leht ei näita ühtegi küsimust ja arvutus ei nõua ühtegi vastust. */
  for (const key of HOUSING_COST_KEYS) {
    const zero = { [key]: '0' };
    assert.deepEqual(gateRows(EMPTY_FORM, zero), [], key);
    const result = page({ ...EMPTY_FORM, workIncome: '0' }, zero);
    assert.equal(result.usable, true, key);
    assert.equal(result.estimate, 220, key);
    assert.equal(stepStates({ ...EMPTY_FORM, workIncome: '0' }, zero).gates, 'empty', key);
  }
  /* Üks sent on juba kulu: küsimus tuleb ja vastus on nõutud. */
  assert.deepEqual(gateRows(EMPTY_FORM, { rent: '0.01' }).map((row) => row.field), ['costsAreCurrentMonth', 'landlordIsTenantsRelative', 'landlordIsRelatedCompany']);
  assert.ok(codes(page({ ...PLAIN_FORM }, { rent: '0.01' })).includes('GATE_UNANSWERED'));
});

test('vaadete loend on alati sama ja seis käib sama reegli järgi mis arvutus', () => {
  assert.deepEqual(STEP_KEYS, ['family', 'income', 'housing', 'costs', 'utilities', 'gates', 'result']);
  assert.deepEqual(stepStates({ adults: '0', minors: '0' }, {}), { family: 'empty', income: 'empty', housing: 'empty', costs: 'empty', utilities: 'empty', gates: 'empty', result: 'empty' });
  const partial = stepStates({ adults: '1', minors: '0', workIncome: '0', dwellingAreaM2: '40', costsAreCurrentMonth: true }, { rent: '300', water: '20' });
  assert.equal(partial.family, 'done');
  assert.equal(partial.income, 'done', 'null on ka sisestatud sissetulek');
  assert.equal(partial.housing, 'partial');
  assert.equal(partial.costs, 'done');
  assert.equal(partial.utilities, 'done');
  assert.equal(partial.gates, 'partial', 'üürileandja küsimus on vastamata');
  assert.equal(stepStates({ costsAreCurrentMonth: false, landlordIsTenantsRelative: false, landlordIsRelatedCompany: false }, { rent: '300' }).gates, 'done');
  assert.equal(stepStates({ costsAreCurrentMonth: true, landlordIsTenantsRelative: false }, { rent: '300' }).gates, 'partial');
  /* Ainult mahaarvamine ei ole sissetulek: samm ei ole valmis, sest arvutus keeldub. */
  assert.equal(stepStates({ adults: '1', paidMaintenance: '50' }, {}).income, 'partial');
  assert.equal(stepStates({ adults: '1', enforcementWithheld: '0' }, {}).income, 'partial');
  assert.equal(stepStates({ adults: '1', otherIncome: '0' }, {}).income, 'done');
  /* Pere samm ei ole valmis ilma täisealiseta. */
  assert.equal(stepStates({ adults: '', minors: '2' }, {}).family, 'partial');
  assert.equal(stepStates({ adults: '0', minors: '2' }, {}).family, 'partial');
  /* Eluaseme samm: null tuba ei ole vastus (arvutus küsib siis tubade arvu). */
  assert.equal(stepStates({ dwellingAreaM2: '40', rooms: '2' }, {}).housing, 'done');
  assert.equal(stepStates({ dwellingAreaM2: '40', rooms: '0' }, {}).housing, 'partial');
  assert.equal(stepStates({ dwellingAreaM2: '', rooms: '0' }, {}).housing, 'partial');
  /* Eelhinnangu samm on valmis ainult siis, kui arvutus andis summa. */
  assert.equal(stepStates({ adults: '1', workIncome: '0' }, {}, true).result, 'done');
  assert.equal(stepStates({ adults: '1', workIncome: '0' }, {}, false).result, 'empty');
  /* Iga seis käib sama tulemusega kokku: valmis sissetulek tähendab, et arvutus sissetuleku pärast ei keeldu. */
  for (const form of [{ ...EMPTY_FORM, paidMaintenance: '10' }, { ...EMPTY_FORM, workIncome: '0' }, { ...EMPTY_FORM, otherIncome: '5' }, EMPTY_FORM]) {
    const blocked = codes(page(form)).includes('INCOME_REQUIRED');
    assert.equal(stepStates(form, {}).income === 'done', !blocked);
  }
});

test('summad ja arvud on lehe keele kümnendmärgiga', () => {
  assert.equal(euro(12.5), '12,50 €');
  assert.equal(euro(12.5, 'ru'), '12,50 €');
  assert.equal(euro(12.5, 'en'), '12.50 €');
  assert.equal(euro(undefined), '0,00 €');
  assert.equal(plainNumber(68.5), '68,5');
  assert.equal(plainNumber(40.25), '40,25');
  assert.equal(plainNumber(33, 'en'), '33');
  assert.equal(plainNumber(82.5, 'en'), '82.5');
});

/* --- Arvutus ise ---------------------------------------------------------------------- */

test('arvutus: kaks leibkonda annavad 2026. aasta määradega oodatud summa', () => {
  const single = page(SINGLE_FORM, SINGLE_COSTS);
  assert.equal(single.usable, true);
  assert.equal(single.subsistenceLimit.total, 220);
  assert.equal(single.income.total, 330.95);
  assert.equal(single.housing.declaredTotal, 391.85);
  assert.equal(single.housing.total, 332.35);
  assert.equal(single.estimate, 221.4);
  /* Üksi elav pensionär: normpind kuni 51 m², kärbet ei ole. Sama siis, kui tube on sama palju kui elanikke. */
  assert.equal(page({ ...SINGLE_FORM, singleOccupantExtendedNorm: true }, SINGLE_COSTS).estimate, 280.9);
  assert.equal(page({ ...SINGLE_FORM, rooms: '1' }, SINGLE_COSTS).estimate, 280.9);
  /* Kaks täisealist ja kaks last: 220 + 176 + 2 x 264 = 924; normpind 87 m² on eluruumist suurem. */
  const family = page(FAMILY_FORM, FAMILY_COSTS);
  assert.equal(family.usable, true);
  assert.equal(family.subsistenceLimit.total, 924);
  assert.equal(family.housing.total, 684.65);
  assert.equal(family.housing.declaredTotal, 684.65);
  assert.equal(family.income.total, 1250.15);
  assert.equal(family.estimate, 358.5);
  assert.equal(family.isDecision, false);
});

test('arvutus ja leht: sisestamata sissetulek ei ole null sissetulek', () => {
  /* Puutumata leht (üks täisealine ette pandud, kõik muu tühi) näitas varem 220 € eelhinnangut. */
  const untouched = page(EMPTY_FORM);
  assert.equal(untouched.usable, false);
  assert.equal(untouched.estimate, null);
  assert.deepEqual(codes(untouched), ['INCOME_REQUIRED']);
  assert.equal(stepSummaries(EMPTY_FORM, {}, untouched).result, '', 'plaadil ja kiirmenüüs summat ei ole');
  assert.deepEqual(codes(estimateSubsistenceBenefit({ adults: 1, effectiveDate: DAY })), ['INCOME_REQUIRED']);
  /* Null on vastus: inimene ütles ise, et sissetulekut ei olnud. Piisab ühest kahest väljast. */
  assert.equal(page({ ...EMPTY_FORM, workIncome: '0' }).estimate, 220);
  assert.equal(page({ ...EMPTY_FORM, otherIncome: '0' }).estimate, 220);
  assert.equal(page({ ...EMPTY_FORM, otherIncome: '300' }).estimate, 0);
  /* Ainult mahaarvamise väli ei ole sissetulek. */
  assert.deepEqual(codes(page({ ...EMPTY_FORM, paidMaintenance: '50' })), ['INCOME_REQUIRED']);
  /* Sisestatud ja siis kustutatud sissetulek on jälle sisestamata. */
  assert.deepEqual(codes(page({ ...EMPTY_FORM, workIncome: '' })), ['INCOME_REQUIRED']);
});

test('arvutus: makstud elatis ja kohtutäituri kinni peetud summa arvatakse sissetulekust maha, mitte alla nulli', () => {
  /* Töine sissetulek 300, makstud elatis 100: arvesse läheb 200 ja toetus oleks 220 - 200 = 20. */
  const paid = page({ ...EMPTY_FORM, workIncome: '300', paidMaintenance: '100' });
  assert.equal(paid.usable, true);
  assert.equal(paid.income.total, 200);
  assert.equal(paid.income.deductions.paidMaintenance, 100);
  assert.equal(paid.estimate, 20);
  /* Ilma elatiseta on sama sissetulek üle piiri: elatis ei ole sissetuleku lisa ega jää arvestamata. */
  assert.equal(page({ ...EMPTY_FORM, workIncome: '300' }).estimate, 0);
  assert.equal(page({ ...EMPTY_FORM, workIncome: '300', paidMaintenance: '0' }).estimate, 0);
  /* Mahaarvamine üle sissetuleku ei tee sissetulekut negatiivseks: summa jääb piiri juurde (220), mitte 720. */
  const over = page({ ...EMPTY_FORM, workIncome: '0', paidMaintenance: '500' });
  assert.equal(over.income.total, 0);
  assert.equal(over.estimate, 220);
  assert.equal(page({ ...EMPTY_FORM, otherIncome: '100', paidMaintenance: '100.01' }).estimate, 220);
  /* Kinni peetud summa käib sama rada; mõlemad koos: 300 - 100 - 50 = 150, toetus 70. */
  assert.equal(page({ ...EMPTY_FORM, workIncome: '300', enforcementWithheld: '100' }).estimate, 20);
  const both = page({ ...EMPTY_FORM, workIncome: '300', paidMaintenance: '100', enforcementWithheld: '50' });
  assert.equal(both.income.total, 150);
  assert.equal(both.estimate, 70);
  assert.deepEqual(both.income.deductions, { paidMaintenance: 100, enforcementWithheld: 50 });
  /* Väli jõuab lehelt arvutusse oma nime all. */
  const input = estimateInput({ ...EMPTY_FORM, workIncome: '300', paidMaintenance: '100', enforcementWithheld: '50' });
  assert.equal(input.paidMaintenance, '100');
  assert.equal(input.enforcementWithheld, '50');
  /* Negatiivne või loetamatu elatis peatab hinnangu välja nimega. */
  assert.deepEqual(issueRows(page({ ...EMPTY_FORM, workIncome: '300', paidMaintenance: '-100' }).issues), [{ code: 'NEGATIVE_AMOUNT', fieldLabelKey: 'subsistence.fields.paid_maintenance' }]);
  assert.deepEqual(issueRows(page({ ...EMPTY_FORM, workIncome: '300' }, {}, ['paidMaintenance']).issues), [{ code: 'INVALID_AMOUNT', fieldLabelKey: 'subsistence.fields.paid_maintenance' }]);
});

test('arvutus: ilma täisealiseta pere kohta summat ei anta', () => {
  assert.deepEqual(codes(page({ ...EMPTY_FORM, adults: '', minors: '2', workIncome: '0' })), ['ADULT_REQUIRED']);
  assert.deepEqual(codes(page({ ...EMPTY_FORM, adults: '0', minors: '1', workIncome: '0' })), ['ADULT_REQUIRED']);
  assert.deepEqual(codes(page({ ...EMPTY_FORM, adults: '0', minors: '0', workIncome: '0' })), ['NO_FAMILY_MEMBERS']);
  assert.equal(page({ ...EMPTY_FORM, adults: '1', minors: '2', workIncome: '0' }).estimate, 748);
});

test('arvutus: pinnaga seotud kulu ei saa arvesse võtta ilma pinnata ja norm sõltub pere suurusest', () => {
  const renter = { ...EMPTY_FORM, workIncome: '0', rooms: '3', ...OPEN_GATES };
  /* Tühi ja null pind koos üüriga: keeldumine, mitte „ei kärbita" (see andis 520 €). */
  assert.deepEqual(codes(page({ ...renter, dwellingAreaM2: '' }, { rent: '300' })), ['DWELLING_AREA_REQUIRED']);
  assert.deepEqual(codes(page({ ...renter, dwellingAreaM2: '0' }, { rent: '300' })), ['DWELLING_AREA_REQUIRED']);
  /* Kulu, mis pinnast ei sõltu, pinda ei küsi. */
  assert.equal(page({ ...renter, dwellingAreaM2: '' }, { water: '20' }).estimate, 240);
  /* Kaks täisealist, 60 m² ja kolm tuba: normpind 2 x 18 + 15 = 51 m², üürist läheb arvesse 300 x 51/60 = 255. */
  const couple = page({ ...renter, adults: '2', dwellingAreaM2: '60' }, { rent: '300' });
  assert.equal(couple.housing.normAreaM2, 51);
  assert.equal(couple.housing.total, 255);
  assert.equal(couple.estimate, 651);
  /* Kolm inimest, 80 m² ja kaks tuba: normpind 3 x 18 + 15 = 69 m², üürist 300 x 69/80 = 258,75. */
  const three = page({ ...renter, adults: '2', minors: '1', rooms: '2', dwellingAreaM2: '80' }, { rent: '300' });
  assert.equal(three.housing.normAreaM2, 69);
  assert.equal(three.estimate, 220 + 176 + 264 + 258.75);
  /* Tube sama palju kui elanikke: arvesse läheb kogu pind ja kärbet ei ole. */
  assert.equal(page({ ...renter, adults: '2', rooms: '2', dwellingAreaM2: '60' }, { rent: '300' }).estimate, 696);
  /* Täpselt normpinna suurune eluruum: kärbet ei ole ja tubade arvu ei küsita. */
  assert.equal(page({ ...renter, rooms: '', dwellingAreaM2: '33' }, { rent: '300' }).estimate, 520);
  assert.deepEqual(codes(page({ ...renter, rooms: '', dwellingAreaM2: '33.5' }, { rent: '300' })), ['ROOM_COUNT_REQUIRED']);
});

test('arvutus: üksi elava pensionäri normpind on kuni 51 m², mitte kogu eluruum', () => {
  const alone = { ...EMPTY_FORM, workIncome: '0', rooms: '3', ...OPEN_GATES };
  /* 80 m²: märkega on normpind 51 m² (300 x 51/80 = 191,25), ilma märketa 33 m² (300 x 33/80 = 123,75). */
  const marked = page({ ...alone, dwellingAreaM2: '80', singleOccupantExtendedNorm: true }, { rent: '300' });
  assert.equal(marked.housing.normAreaM2, 51);
  assert.equal(marked.estimate, 411.25);
  assert.equal(page({ ...alone, dwellingAreaM2: '80' }, { rent: '300' }).estimate, 343.75);
  /* Kuni 51 m² märkega kärbet ei ole; 51,5 m² juures juba on. */
  assert.equal(page({ ...alone, dwellingAreaM2: '51', singleOccupantExtendedNorm: true }, { rent: '300' }).estimate, 520);
  assert.ok(page({ ...alone, dwellingAreaM2: '51.5', singleOccupantExtendedNorm: true }, { rent: '300' }).estimate < 520);
  /* Kahe inimese peres märge ei loe: norm on 51 m² pere suuruse, mitte märke pärast. */
  assert.equal(page({ ...alone, adults: '2', dwellingAreaM2: '80', singleOccupantExtendedNorm: true }, { rent: '300' }).estimate, 220 + 176 + 191.25);
});

test('arvutus: iga kulu üksi kaks korda normpinnast suuremas eluruumis läheb arvesse pooles või täies mahus', () => {
  /* Üks inimene, 66 m² ja kolm tuba: normpind 33 m², pinnaga seotud kulust läheb arvesse täpselt pool.
     Loend on siin kirjas kulu kaupa (SHS § 133 lg 5), mitte loetud arvutuse tabelist: vale märge tabelis kukutab testi. */
  const HALVED = ['rent', 'buildingManagement', 'buildingRenovationLoan', 'heating', 'buildingInsurance', 'housingLoan'];
  const IN_FULL = ['water', 'hotWater', 'electricity', 'gas', 'landTax', 'wasteRemoval'];
  assert.deepEqual([...HALVED, ...IN_FULL].sort(), [...HOUSING_COST_KEYS].sort());
  const big = { ...EMPTY_FORM, workIncome: '0', dwellingAreaM2: '66', rooms: '3', ...OPEN_GATES };
  for (const key of HOUSING_COST_KEYS) {
    const result = page(big, { [key]: '400' });
    const counted = HALVED.includes(key) ? 200 : 400;
    assert.equal(result.usable, true, key);
    assert.deepEqual(result.housing.lines.map((line) => [line.key, line.declared, line.counted]), [[key, 400, counted]], key);
    assert.equal(result.housing.total, counted, key);
    assert.equal(result.estimate, 220 + counted, key);
    /* Põhjuse lause nimetab kärbitud kulu; täies mahus arvesse läinud kulu kohta põhjust ei ole. */
    assert.deepEqual(housingReason(result, 'et')?.costKeys ?? [], HALVED.includes(key) ? [`subsistence.costs.${key}`] : [], key);
  }
});

test('arvutus: null tuba ei ole vastus ja pinnal on lagi', () => {
  const renter = { ...EMPTY_FORM, workIncome: '0', dwellingAreaM2: '60', ...OPEN_GATES };
  /* Tühi tubade väli keeldus, aga „0" andis 385 € kärbitud summa: nüüd on mõlemad sisestamata. */
  for (const rooms of ['', '0', '0.4']) assert.deepEqual(codes(page({ ...renter, rooms }, { rent: '300' })), ['ROOM_COUNT_REQUIRED'], `tube: „${rooms}”`);
  /* Täisarvuväli teeb „-1" nulliks: sama tulemus. */
  assert.equal(readNumberInput({ value: '-1' }, true).value, '0');
  assert.equal(page({ ...renter, rooms: '2' }, { rent: '300' }).estimate, 385);
  assert.equal(page({ ...renter, rooms: '1' }, { rent: '300' }).estimate, 520, 'tube sama palju kui elanikke: kogu pind');
  for (const loose of [0, -1, 'abc', Number.NaN, null, undefined, '']) assert.equal(enteredRoomCount(loose), null, String(loose));
  assert.equal(enteredRoomCount('3'), 3);
  assert.equal(enteredRoomCount(2.9), 2);
  /* Teine kutsuja: null ja negatiivne tubade arv on sisestamata, mitte kärpe luba. */
  const direct = { adults: 1, workIncome: 0, dwellingAreaM2: 60, housingCosts: { rent: 300 }, gates: OPEN_GATES, effectiveDate: DAY };
  for (const rooms of [0, -1, 'abc']) assert.deepEqual(codes(estimateSubsistenceBenefit({ ...direct, rooms })), ['ROOM_COUNT_REQUIRED'], String(rooms));

  /* Pind: negatiivne, üle lae (1000 m²) või lõpmatu pind peatab hinnangu välja nimega. Varem andis 100 000 m²
     summa 220,10 € ja lause „umbes 0%", 1e308 lause „Eluruum (Infinity m²)". */
  assert.equal(MAX_DWELLING_AREA_M2, 1000);
  const areaRow = [{ code: 'INVALID_AMOUNT', fieldLabelKey: 'subsistence.fields.area' }];
  for (const area of ['-5', '-0.1', '1000.01', '100000', '1e308', 'Infinity']) {
    const withRent = page({ ...renter, rooms: '3', dwellingAreaM2: area }, { rent: '300' });
    assert.equal(withRent.usable, false, area);
    assert.equal(withRent.estimate, null, area);
    assert.deepEqual(issueRows(withRent.issues), areaRow, `üks rida, mitte kaks: ${area}`);
    /* Ka ilma kuludeta (või ainult kommunaalkuludega): vigane pind ei kao vaikselt. */
    assert.deepEqual(issueRows(page({ ...EMPTY_FORM, workIncome: '0', dwellingAreaM2: area }).issues), areaRow, area);
    assert.deepEqual(issueRows(page({ ...EMPTY_FORM, workIncome: '0', dwellingAreaM2: area, costsAreCurrentMonth: true }, { water: '20' }).issues), areaRow, area);
    assert.equal(resultView(withRent, 'et').amount, '', area);
    assert.equal(housingReason(withRent, 'et'), null, area);
  }
  /* Lagi ise on lubatud; väikseim protsent, mis lausesse jõuab, on 33/1000 ehk 3,3. */
  const widest = page({ ...renter, rooms: '3', dwellingAreaM2: '1000' }, { rent: '300' });
  assert.equal(widest.estimate, 229.9);
  assert.deepEqual(housingReason(widest, 'et').vars, { area: '1000', norm: '33', percent: '3,3' });
  for (const lang of LANGS) {
    const sentence = viewText(resultView(widest, lang).sentences[0], tFor(lang), lang);
    assert.ok(!/Infinity|NaN|\b0\s?%/.test(sentence), sentence);
  }
  /* Välja enda piir on sama mis arvutuse lagi. */
  assert.equal(VIEW_FIELDS.housing[0].max, '1000');
});

test('arvutus: „ei" jooksva kuu küsimusele on vastus, mitte vastamata küsimus', () => {
  const no = page({ ...SINGLE_FORM, costsAreCurrentMonth: false }, SINGLE_COSTS);
  assert.equal(no.usable, false);
  assert.deepEqual(codes(no), ['COSTS_NOT_CURRENT_MONTH']);
  assert.deepEqual(codes(page({ ...SINGLE_FORM, costsAreCurrentMonth: null }, SINGLE_COSTS)), ['GATE_UNANSWERED']);
  /* Ilma kuludeta seda küsimust ei ole: vana vastus ei sega. */
  assert.equal(page({ ...EMPTY_FORM, workIncome: '0', costsAreCurrentMonth: false }).usable, true);
});

test('arvutus: üür, korterelamu kulud, eluasemelaen ja maamaks käivad seaduse väravate kaudu', () => {
  /* Üür (SHS § 133 lg 8): üürniku lähedane VÕI taotlejaga seotud äriühing; mõlemale peab olema vastatud. */
  assert.deepEqual(codes(page({ ...SINGLE_FORM, landlordIsTenantsRelative: true }, SINGLE_COSTS)), ['RENT_FROM_FAMILY_NOT_COUNTED']);
  assert.deepEqual(codes(page({ ...SINGLE_FORM, landlordIsRelatedCompany: true }, SINGLE_COSTS)), ['RENT_FROM_FAMILY_NOT_COUNTED']);
  assert.deepEqual(codes(page({ ...SINGLE_FORM, landlordIsTenantsRelative: true, landlordIsRelatedCompany: null }, SINGLE_COSTS)), ['RENT_FROM_FAMILY_NOT_COUNTED']);
  assert.deepEqual(codes(page({ ...SINGLE_FORM, landlordIsTenantsRelative: null }, SINGLE_COSTS)), ['GATE_UNANSWERED']);
  assert.deepEqual(codes(page({ ...SINGLE_FORM, landlordIsRelatedCompany: null }, SINGLE_COSTS)), ['GATE_UNANSWERED']);
  assert.deepEqual(codes(page({ ...SINGLE_FORM, landlordIsTenantsRelative: null, landlordIsRelatedCompany: null }, SINGLE_COSTS)), ['GATE_UNANSWERED', 'GATE_UNANSWERED']);
  /* Korterelamu kulud. */
  assert.deepEqual(codes(page({ ...FAMILY_FORM, isApartmentBuilding: false }, FAMILY_COSTS)), ['APARTMENT_BUILDING_COSTS_NOT_APPLICABLE']);
  /* Eluasemelaen: tingimused (§ 133 lg 9¹) ja kuue kuu piir (lg 9²). */
  assert.deepEqual(codes(page({ ...FAMILY_FORM, housingLoanConditionsMet: false }, FAMILY_COSTS)), ['HOUSING_LOAN_CONDITIONS_NOT_MET']);
  assert.deepEqual(codes(page({ ...FAMILY_FORM, housingLoanConditionsMet: null }, FAMILY_COSTS)), ['GATE_UNANSWERED']);
  assert.deepEqual(codes(page({ ...FAMILY_FORM, housingLoanMonthLimitReached: null }, FAMILY_COSTS)), ['GATE_UNANSWERED']);
  assert.deepEqual(codes(page({ ...FAMILY_FORM, housingLoanMonthLimitReached: true }, FAMILY_COSTS)), ['HOUSING_LOAN_MONTH_LIMIT_REACHED']);
  /* Kustutatud laenusumma: küsimused kaovad ja hinnang tuleb ilma laenuta. */
  const { housingLoan: _loan, ...withoutLoan } = FAMILY_COSTS;
  assert.equal(page({ ...FAMILY_FORM, housingLoanMonthLimitReached: true }, withoutLoan).estimate, 48.5);
  /* Maamaks (§ 133 lg 9): vabastuse korral arvesse ei lähe. */
  const house = { ...EMPTY_FORM, workIncome: '0', dwellingAreaM2: '30', rooms: '2', costsAreCurrentMonth: true };
  assert.deepEqual(codes(page(house, { landTax: '60' })), ['GATE_UNANSWERED']);
  assert.deepEqual(codes(page({ ...house, landTaxExempt: true }, { landTax: '60' })), ['LAND_TAX_EXEMPT_NOT_COUNTED']);
  assert.equal(page({ ...house, landTaxExempt: false }, { landTax: '60' }).estimate, 280);
  /* Maamaksu alus on kolmekordne elamualune pind, mitte eluruumi normpind: suure eluruumi korral seda ei kärbita. */
  const bigHouse = page({ ...house, dwellingAreaM2: '100', rooms: '4', landTaxExempt: false }, { landTax: '30', heating: '100' });
  assert.equal(bigHouse.housing.lines.find((line) => line.key === 'landTax').counted, 30);
  assert.ok(bigHouse.housing.lines.find((line) => line.key === 'heating').counted < 100);
  assert.deepEqual(housingReason(bigHouse, 'et').costKeys, ['subsistence.costs.heating']);
});

test('arvutus: iga väravaga kulu üksi oma värava vastu, mõlemas suunas', () => {
  /* Üks kulu (50 €) korraga, kõik teised väravad vastamata: loeb ainult selle kulu oma värav ja jooksva kuu küsimus. */
  const only = (key, gates) => page({ ...PLAIN_FORM, costsAreCurrentMonth: true, ...gates }, { [key]: '50' });
  const counted = (result) => [result.usable, result.estimate];
  /* Üür: mõlemad „ei" lubavad, kumbki „jah" keelab. */
  assert.deepEqual(counted(only('rent', { landlordIsTenantsRelative: false, landlordIsRelatedCompany: false })), [true, 270]);
  assert.deepEqual(codes(only('rent', { landlordIsTenantsRelative: true, landlordIsRelatedCompany: false })), ['RENT_FROM_FAMILY_NOT_COUNTED']);
  assert.deepEqual(codes(only('rent', { landlordIsTenantsRelative: false, landlordIsRelatedCompany: true })), ['RENT_FROM_FAMILY_NOT_COUNTED']);
  assert.deepEqual(only('rent', {}).issues.map((issue) => issue.field), ['gates.landlordIsTenantsRelative', 'gates.landlordIsRelatedCompany']);
  /* Korterelamu haldamise kulu ja renoveerimislaen KUMBKI üksi: „ei ela korterelamus" keelab, „jah" lubab. */
  for (const key of ['buildingManagement', 'buildingRenovationLoan']) {
    assert.deepEqual(counted(only(key, { isApartmentBuilding: true })), [true, 270], key);
    assert.deepEqual(codes(only(key, { isApartmentBuilding: false })), ['APARTMENT_BUILDING_COSTS_NOT_APPLICABLE'], key);
    assert.deepEqual(only(key, {}).issues.map((issue) => issue.field), ['gates.isApartmentBuilding'], key);
  }
  /* Eluasemelaen: tingimused täidetud ja piir ei ole täis lubab; kumbki vastupidi keelab oma põhjusega. */
  assert.deepEqual(counted(only('housingLoan', { housingLoanConditionsMet: true, housingLoanMonthLimitReached: false })), [true, 270]);
  assert.deepEqual(codes(only('housingLoan', { housingLoanConditionsMet: false, housingLoanMonthLimitReached: false })), ['HOUSING_LOAN_CONDITIONS_NOT_MET']);
  assert.deepEqual(codes(only('housingLoan', { housingLoanConditionsMet: true, housingLoanMonthLimitReached: true })), ['HOUSING_LOAN_MONTH_LIMIT_REACHED']);
  assert.deepEqual(only('housingLoan', {}).issues.map((issue) => issue.field), ['gates.housingLoanConditionsMet', 'gates.housingLoanMonthLimitReached']);
  /* Maamaks: vabastus keelab, vabastuse puudumine lubab. */
  assert.deepEqual(counted(only('landTax', { landTaxExempt: false })), [true, 270]);
  assert.deepEqual(codes(only('landTax', { landTaxExempt: true })), ['LAND_TAX_EXEMPT_NOT_COUNTED']);
  assert.deepEqual(only('landTax', {}).issues.map((issue) => issue.field), ['gates.landTaxExempt']);
  /* Kulu, millel oma väravat ei ole: teiste kulude keelavad vastused ei loe, loeb ainult jooksva kuu küsimus. */
  const blocking = { landlordIsTenantsRelative: true, landlordIsRelatedCompany: true, isApartmentBuilding: false, housingLoanConditionsMet: false, housingLoanMonthLimitReached: true, landTaxExempt: true };
  for (const key of HOUSING_COST_KINDS.filter((kind) => !kind.gate).map((kind) => kind.key)) {
    assert.deepEqual(counted(only(key, blocking)), [true, 270], key);
    assert.deepEqual(codes(page({ ...PLAIN_FORM, ...blocking, costsAreCurrentMonth: false }, { [key]: '50' })), ['COSTS_NOT_CURRENT_MONTH'], key);
    assert.deepEqual(page({ ...PLAIN_FORM, ...blocking, costsAreCurrentMonth: null }, { [key]: '50' }).issues.map((issue) => issue.field), ['gates.costsAreCurrentMonth'], key);
  }
});

test('arvutus: värav võtab vastu ainult tõese või väära, lõdva väärtusega mööda ei saa', () => {
  /* Kõik viis väravaga kulu korraga; rangete vastustega tuleb summa. */
  const base = { adults: 1, workIncome: 0, dwellingAreaM2: 30, rooms: 2, effectiveDate: DAY, housingCosts: { rent: 50, buildingManagement: 50, buildingRenovationLoan: 50, housingLoan: 50, landTax: 50 } };
  const run = (gates) => estimateSubsistenceBenefit({ ...base, gates });
  assert.deepEqual(codes(run(OPEN_GATES)), []);
  assert.equal(run(OPEN_GATES).estimate, 470);
  /* Lõtv väärtus üheski väravas ei ole vastus: ei „jah" ega „ei", vaid vastamata küsimus selle välja nimega. */
  for (const field of GATE_FIELD_NAMES) {
    for (const loose of ['yes', 'no', 'true', 'false', 0, 1, '', null, undefined]) {
      const result = run({ ...OPEN_GATES, [field]: loose });
      assert.equal(result.usable, false, `${field}: ${String(loose)}`);
      assert.deepEqual(result.issues.map((issue) => [issue.code, issue.field]), [['GATE_UNANSWERED', `gates.${field}`]], `${field}: ${JSON.stringify(loose)}`);
    }
  }
  assert.deepEqual(codes(run(undefined)), Array(GATE_FIELD_NAMES.length).fill('GATE_UNANSWERED'));
  assert.deepEqual(codes(run('jah')), Array(GATE_FIELD_NAMES.length).fill('GATE_UNANSWERED'));
});

test('arvutus: teine kutsuja ei saa väravast lõdva väärtusega mööda', () => {
  const base = { adults: 2, minors: 2, workIncome: 1180.4, otherIncome: 160, enforcementWithheld: 90.25, dwellingAreaM2: 68.5, rooms: 3, housingCosts: FAMILY_COSTS, effectiveDate: DAY };
  const gates = { costsAreCurrentMonth: true, isApartmentBuilding: true, housingLoanConditionsMet: true };
  const run = (extra) => codes(estimateSubsistenceBenefit({ ...base, gates: { ...gates, ...extra } }));
  assert.deepEqual(run({}), ['GATE_UNANSWERED'], 'kuue kuu piir on vastamata, mitte vaikne eeldus');
  assert.deepEqual(run({ housingLoanMonthLimitReached: 'yes' }), ['GATE_UNANSWERED']);
  assert.deepEqual(run({ housingLoanMonthLimitReached: 0 }), ['GATE_UNANSWERED']);
  assert.deepEqual(run({ housingLoanMonthLimitReached: false }), []);
  assert.deepEqual(run({ housingLoanMonthsUsedThisYear: 3 }), []);
  assert.deepEqual(run({ housingLoanMonthsUsedThisYear: 6 }), ['HOUSING_LOAN_MONTH_LIMIT_REACHED']);
  assert.deepEqual(run({ housingLoanMonthLimitReached: false, housingLoanMonthsUsedThisYear: 12 }), ['HOUSING_LOAN_MONTH_LIMIT_REACHED'], 'vastuolu korral kehtib „piir on täis"');
  assert.deepEqual(run({ housingLoanMonthsUsedThisYear: '' }), ['GATE_UNANSWERED']);
  assert.deepEqual(run({ housingLoanMonthLimitReached: false, isApartmentBuilding: 'jah' }), ['GATE_UNANSWERED']);
  /* Tubade arv tühja sõnena on sisestamata, mitte null tuba. */
  const big = { adults: 1, workIncome: 0, dwellingAreaM2: 40, housingCosts: { rent: 300 }, gates: { costsAreCurrentMonth: true, landlordIsTenantsRelative: false, landlordIsRelatedCompany: false }, effectiveDate: DAY };
  assert.deepEqual(codes(estimateSubsistenceBenefit({ ...big, rooms: '' })), ['ROOM_COUNT_REQUIRED']);
  assert.deepEqual(codes(estimateSubsistenceBenefit({ ...big, rooms: null })), ['ROOM_COUNT_REQUIRED']);
});

test('leht ja arvutus: iga vastamata värav on lehel nähtav vastamata küsimus (3000 juhuslikku seisu)', () => {
  /* Kindla seemnega juhuarvud: test annab igal jooksul samad seisud. */
  let seed = 20261010;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  const pick = (list) => list[Math.floor(random() * list.length)];
  /* Iga keeldumine, mis tuleb väravast: ilma sisestatud kuluta ei tohi ükski neist tulla. */
  const GATE_REFUSALS = ['GATE_UNANSWERED', 'COSTS_NOT_CURRENT_MONTH', 'RENT_FROM_FAMILY_NOT_COUNTED', 'APARTMENT_BUILDING_COSTS_NOT_APPLICABLE', 'HOUSING_LOAN_CONDITIONS_NOT_MET', 'HOUSING_LOAN_MONTH_LIMIT_REACHED', 'LAND_TAX_EXEMPT_NOT_COUNTED'];
  const CLEAN = ['', '', '', '', '0', '0.00', '0.01', '12.50', '300'];
  const MESSY = [...CLEAN, '-4', 'abc'];
  const t = tFor('et');
  let refused = 0;
  let usable = 0;
  for (let round = 0; round < 3000; round += 1) {
    /* Kolmandik seisudest on korralikult täidetud (et summani jõutaks), ülejäänud segamini. */
    const tidy = random() < 0.35;
    const costs = {};
    for (const key of HOUSING_COST_KEYS) {
      const value = pick(tidy ? CLEAN : MESSY);
      if (value !== '' || random() < 0.2) costs[key] = value;
    }
    const form = { ...EMPTY_FORM, workIncome: pick(tidy ? ['0', '250'] : ['', '0', '250']), dwellingAreaM2: pick(tidy ? ['30', '60'] : ['', '0', '30', '60']), rooms: pick(tidy ? ['1', '3'] : ['', '0', '1', '3']) };
    for (const field of GATE_FIELD_NAMES) form[field] = tidy && random() < 0.8 ? OPEN_GATES[field] : pick([null, null, true, false]);
    const bad = !tidy && random() < 0.15 ? [pick([...HOUSING_COST_KEYS.map(costFieldId), 'rooms', 'workIncome'])] : [];
    const result = page(form, costs, bad);
    const shown = gateRows(form, costs);
    const shownFields = shown.map((row) => row.field);
    const unanswered = result.issues.filter((issue) => issue.code === 'GATE_UNANSWERED').map((issue) => issue.field.replace(/^gates\./, ''));
    for (const field of unanswered) {
      assert.ok(shownFields.includes(field), `küsimust ei näidata: ${field} ${JSON.stringify(costs)}`);
      assert.equal(shown.find((row) => row.field === field).choice, '', `küsimus on lehel vastatud: ${field}`);
    }
    /* Kui kõik näidatud küsimused on vastatud, ei ütle arvutus „vasta kõigile küsimustele". */
    if (shown.every((row) => row.choice !== '')) assert.deepEqual(unanswered, [], JSON.stringify({ costs, form }));
    /* Ilma sisestatud kuluta ei loe ükski värava vastus. */
    if (!declaredCostKeys(costs).length) assert.deepEqual(codes(result).filter((code) => GATE_REFUSALS.includes(code)), [], JSON.stringify({ costs, form }));
    /* Keeldumise vaates ei ole ühtegi arvu ja igal real on lause; summa vaates ei ole puudujäägi ridu. */
    const view = resultView(result, 'et');
    if (result.usable) {
      usable += 1;
      assert.equal(view.amount, euro(result.estimate, 'et'));
      assert.deepEqual(view.rows, []);
    } else {
      refused += 1;
      assert.equal(view.amount, '');
      assert.deepEqual([view.facts, view.sentences], [[], []]);
      assert.ok(view.rows.length >= 1);
      for (const row of view.rows) {
        const text = viewText(row, t, 'et');
        assert.ok(text && !text.startsWith('subsistence.'), `lause puudub: ${row.key}`);
        assert.ok(!/€|Infinity|NaN/.test(text), text);
      }
      assert.equal(stepSummaries(form, costs, result, 'et').result, '');
    }
  }
  assert.ok(refused > 500 && usable > 100, `seisud on mõlemat liiki: ${refused} keeldumist, ${usable} summat`);
});

test('arvutus: täpse võrdsuse korral on hinnang null koos märkega ja liiga suur summa ei ole summa', () => {
  /* 220 + 16.17 - 236.17 andis ujukomaga imeväikese plussi: hinnang 0 ilma märketa „toetust ei tuleks". */
  const even = page({ ...EMPTY_FORM, workIncome: '236.17', costsAreCurrentMonth: true }, { water: '16.17' });
  assert.equal(even.estimate, 0);
  assert.ok(even.caveats.includes('ABOVE_SUBSISTENCE_LINE'));
  assert.equal(resultNote(even), 'above_line');
  for (const big of ['1e308', '1000001', 'Infinity']) {
    assert.deepEqual(codes(page({ ...EMPTY_FORM, workIncome: big })), ['INVALID_AMOUNT'], big);
    assert.equal(page({ ...EMPTY_FORM, workIncome: '0', costsAreCurrentMonth: true }, { water: big }).usable, false, big);
  }
  assert.equal(page({ ...EMPTY_FORM, workIncome: '1000000' }).usable, true);
  assert.equal(MAX_AMOUNT, 1000000);
});

test('arvutus: tulemuse osad on masinloetavad ja ütlevad, mille järgi arvutati', () => {
  /* Leht kasutab neist osa; ülejäänu on kirjas, et teine kutsuja (või lehe järgmine vaade) saaks sama tõe. */
  const single = page(SINGLE_FORM, SINGLE_COSTS);
  assert.deepEqual(single.housing.lines.map((line) => [line.key, line.declared, line.counted, line.areaScaled]), [
    ['rent', 280, 231, true],
    ['water', 14.2, 14.2, false],
    ['heating', 60, 49.5, true],
    ['electricity', 31.75, 31.75, false],
    ['wasteRemoval', 5.9, 5.9, false]
  ]);
  for (const line of single.housing.lines) assert.equal(line.label, HOUSING_COST_KINDS.find((kind) => kind.key === line.key).label, line.key);
  assert.deepEqual([single.housing.normAreaM2, single.housing.normBasis, single.housing.dwellingAreaM2, single.housing.areaRatio, single.housing.method], [33, 'SOCIALLY_JUSTIFIED_NORM', 40, 0.83, 'ASSUMED_PROPORTIONAL']);
  /* Märked: omavalitsuse piirmäärasid ei tea (lähend), ja mis pinna järgi arvestati. */
  assert.deepEqual(single.caveats, ['HOUSING_METHOD_ASSUMED_PROPORTIONAL', 'KOV_HOUSING_LIMITS_UNKNOWN', 'AREA_ABOVE_NORM_SCALED']);
  const full = page({ ...SINGLE_FORM, rooms: '1' }, SINGLE_COSTS);
  assert.deepEqual([full.housing.normBasis, full.housing.normAreaM2, full.caveats.at(-1)], ['ROOMS_EQUAL_RESIDENTS', 40, 'NORM_AREA_IS_FULL_DWELLING']);
  const pensioner = page({ ...SINGLE_FORM, singleOccupantExtendedNorm: true }, SINGLE_COSTS);
  assert.deepEqual([pensioner.housing.normBasis, pensioner.housing.normAreaM2, pensioner.caveats], ['SINGLE_OCCUPANT_51M2', 51, ['HOUSING_METHOD_ASSUMED_PROPORTIONAL', 'KOV_HOUSING_LIMITS_UNKNOWN']]);
  assert.deepEqual(resolveNormAreaM2({ members: 1, dwellingAreaM2: 40, rooms: 2 }), { normAreaM2: 33, basis: 'SOCIALLY_JUSTIFIED_NORM' });
  assert.deepEqual(resolveNormAreaM2({ members: 3, dwellingAreaM2: 80, rooms: 3 }), { normAreaM2: 80, basis: 'ROOMS_EQUAL_RESIDENTS' });
  /* Sissetulek liigiti. */
  assert.deepEqual(single.income, { total: 330.95, otherIncome: 210.45, workIncome: 120.5, workIncomeExempt: 0, statutorilyExcludedIncome: 0, deductions: { paidMaintenance: 0, enforcementWithheld: 0 } });
  /* See ei ole otsus: kes otsustab ja mille alusel, on tulemuses kirjas. */
  const family = page(FAMILY_FORM, FAMILY_COSTS);
  assert.deepEqual([family.members, family.isDecision, family.decidedBy, family.legalBasis], [4, false, 'KOV', ['SHS § 131', 'SHS § 132', 'SHS § 133', 'SHS § 134']]);
  assert.deepEqual(family.subsistenceLimit.breakdown, [
    { role: 'FIRST_MEMBER', count: 1, unit: 220 },
    { role: 'ADDITIONAL_ADULT', count: 1, unit: 176 },
    { role: 'MINOR', count: 2, unit: 264 }
  ]);
  /* Kui palju sissetulek üle piiri on: summa korral null, keeldumise korral puudub. */
  assert.equal(family.surplus, 0);
  assert.deepEqual([page({ ...SINGLE_FORM, workIncome: '5000' }, SINGLE_COSTS).estimate, page({ ...SINGLE_FORM, workIncome: '5000' }, SINGLE_COSTS).surplus], [0, 4658.1]);
  assert.equal(page(EMPTY_FORM).surplus, null);
  /* Toimetulekupiir otse: ilma liikmeteta null; ilma täisealiseta on esimene liige laps (eelhinnang sellist peret ei arvuta). */
  assert.deepEqual([calculateFamilySubsistenceLimit({ adults: 0, minors: 0 }, DAY).total, calculateFamilySubsistenceLimit({ adults: 0, minors: 0 }, DAY).breakdown], [0, []]);
  assert.equal(calculateFamilySubsistenceLimit({ adults: 0, minors: 2 }, DAY).total, 484);
  assert.equal(calculateFamilySubsistenceLimit({ adults: 3, minors: 0 }, DAY).total, 572);
});

test('arvutus: reeglid, mida leht ei küsi, aga arvutus teisele kutsujale peab: tundmatu kulu, piirmäärad, töise tulu erand', () => {
  const base = { adults: 1, workIncome: 0, dwellingAreaM2: 66, rooms: 3, gates: OPEN_GATES, effectiveDate: DAY };
  /* Tundmatu kululiik ei kao vaikselt nulliks (04.08 audit, leid F); null või tühi tundmatu kulu ei loe. */
  const unknown = estimateSubsistenceBenefit({ ...base, housingCosts: { parking: 40 } });
  assert.deepEqual(unknown.issues.map((issue) => [issue.code, issue.field]), [['UNKNOWN_HOUSING_COST_KIND', 'housingCosts.parking']]);
  assert.equal(unknown.estimate, null);
  assert.equal(estimateSubsistenceBenefit({ ...base, housingCosts: { parking: 0, garage: '' } }).estimate, 220);
  /* Leht tundmatut kulu arvutusse ei saada. */
  assert.deepEqual(estimateInput(EMPTY_FORM, { parking: '40', rent: '10' }).housingCosts, { rent: '10' });

  /* Omavalitsuse piirmäärad (SHS § 133 lg 6), kui kutsuja need annab: pinnaga seotud kulul piirmäär ruutmeetri
     kohta korda normpind (5 x 33 = 165), muul kulul piirmäär ise; piirmäärata kulu läheb arvesse nagu ilma nendeta. */
  const capped = estimateSubsistenceBenefit({ ...base, housingCosts: { rent: 400, water: 50, heating: 100, gas: 12 }, capsPerM2: { rent: 5, water: 30 } });
  assert.deepEqual(capped.housing.lines.map((line) => [line.key, line.counted]), [['rent', 165], ['water', 30], ['heating', 50], ['gas', 12]]);
  assert.deepEqual([capped.housing.method, capped.housing.total, capped.estimate], ['KOV_CAPS_PER_M2', 257, 477]);
  /* Piirmäärad on teada: hoiatust „omavalitsuse piirmäärasid see arvutus ei tea" siis ei ole. */
  assert.deepEqual(capped.caveats, ['AREA_ABOVE_NORM_SCALED']);
  assert.equal(resultNote(capped), '');
  assert.equal(estimateSubsistenceBenefit({ ...base, housingCosts: { rent: 100 }, capsPerM2: { rent: 5 } }).housing.total, 100, 'piirmäär on lagi, mitte summa');

  /* Töise tulu erand (SHS § 133 lg 2¹): kaks kuud 100% ja neli kuud 50% töisest tulust ei arvata sissetulekuks. */
  const worker = { adults: 1, workIncome: 300, otherIncome: 100, effectiveDate: DAY };
  for (const [month, counted, estimate] of [[1, 100, 120], [2, 100, 120], [3, 250, 0], [6, 250, 0], [0, 400, 0], [null, 400, 0]]) {
    const result = estimateSubsistenceBenefit({ ...worker, workIncomeExemptionMonth: month });
    assert.deepEqual([result.usable, result.income.total, result.estimate], [true, counted, estimate], `kuu ${month}`);
    assert.equal(result.caveats.includes('WORK_INCOME_EXEMPTION_APPLIED'), month >= 1, `kuu ${month}`);
    assert.equal(result.income.workIncomeExempt, 400 - counted, `kuu ${month}`);
  }
  for (const month of [7, -1, 12]) assert.deepEqual(codes(estimateSubsistenceBenefit({ ...worker, workIncomeExemptionMonth: month })), ['INVALID_WORK_EXEMPTION_MONTH'], `kuu ${month}`);
  /* Sama reegel otse, ilma märgete ja puudujääkide loendita. */
  assert.equal(calculateCountedIncome({ workIncome: 300, workIncomeExemptionMonth: 4 }).total, 150);
  assert.equal(calculateCountedIncome({ workIncome: 300, statutorilyExcludedIncome: 80 }).statutorilyExcludedIncome, 80);
  assert.equal(calculateCountedIncome().total, 0);
  /* Leht erandit ei küsi: lehelt tulev sisend erandi kuud ei kanna. */
  assert.equal('workIncomeExemptionMonth' in estimateInput(EMPTY_FORM), false);
});

/* --- Määrad ja kuupäev ------------------------------------------------------------------ */

test('määrade tabel: iga rida on lukus ja suhted on seaduse omad', () => {
  /* Kes rea lisab või muudab, muudab ka selle testi: number ei muutu kogemata (2025. aasta 200 sai enne olla 999). */
  assert.deepEqual(SUBSISTENCE_RATE_TABLE, [
    { validFrom: '2026-01-01', confirmedUntil: '2026-12-31', firstMember: 220, additionalAdult: 176, minor: 264, source: 'https://sm.ee/toimetulekutoetus' },
    { validFrom: '2025-01-01', confirmedUntil: '2025-12-31', firstMember: 200, additionalAdult: 160, minor: 240, source: 'https://sm.ee/toimetulekutoetus' }
  ]);
  assert.equal(RATES_CHECKED_ON, '2026-08-04');
  SUBSISTENCE_RATE_TABLE.forEach((row, index) => {
    /* SHS § 131 lg 4 ja 5: teine täisealine 80% ja alaealine 120% esimese liikme piirist. */
    assert.equal(row.additionalAdult, (row.firstMember * 8) / 10, row.validFrom);
    assert.equal(row.minor, (row.firstMember * 12) / 10, row.validFrom);
    /* Rida on üks kalendriaasta; uuem rida on eespool. */
    const year = row.validFrom.slice(0, 4);
    assert.equal(row.validFrom, `${year}-01-01`);
    assert.equal(row.confirmedUntil, `${year}-12-31`);
    if (index > 0) assert.ok(SUBSISTENCE_RATE_TABLE[index - 1].validFrom > row.validFrom, 'uuem rida eespool');
  });
  /* Iga rea määr tuleb selle aasta päeva kohta välja ka otsinguga. */
  assert.deepEqual(
    ['2026-01-01', '2026-12-31', '2025-01-01', '2025-12-31'].map((day) => {
      const rates = resolveSubsistenceRates(day);
      return [rates.year, rates.firstMember, rates.additionalAdult, rates.minor];
    }),
    [[2026, 220, 176, 264], [2026, 220, 176, 264], [2025, 200, 160, 240], [2025, 200, 160, 240]]
  );
});

test('arvutus: määr kehtib Eesti kalendri järgi ja kinnitamata aasta kohta summat ei anta', () => {
  assert.equal(resolveSubsistenceRates('2026-12-31').exact, true);
  assert.equal(resolveSubsistenceRates('2027-01-01').exact, false);
  assert.equal(resolveSubsistenceRates('2027-01-01').reason, 'NO_CONFIRMED_RATE_FOR_YEAR');
  /* Aastavahetus Eesti aja järgi: 31.12 kell 23.30 on veel see aasta, 1.01 kell 00.30 enam mitte. */
  assert.equal(resolveSubsistenceRates(new Date('2026-12-31T21:30:00Z')).exact, true);
  assert.equal(resolveSubsistenceRates(new Date('2026-12-31T22:30:00Z')).exact, false);
  assert.equal(resolveSubsistenceRates(new Date(Number.NaN)).exact, false);
  assert.equal(resolveSubsistenceRates(new Date(Number.NaN)).reason, 'INVALID_DATE');
  const next = pageEstimate({ ...EMPTY_FORM }, {}, [], '2027-01-15');
  assert.equal(next.usable, false);
  assert.equal(dateIssueCode(next), 'UNSUPPORTED_DATE');
  /* Miski, mida inimene sisestab, seda ei muuda: lehel on see ainus rida. */
  assert.deepEqual(issueRows(next.issues), [{ code: 'UNSUPPORTED_DATE', fieldLabelKey: '' }]);
  assert.equal(dateIssueCode(page(EMPTY_FORM)), '');
  assert.equal(dateIssueCode(null), '');
});

test('päev Tallinnas pannakse kokku osadest ja lugematu päev annab oma lause, mitte „määr ei ole kinnitatud"', () => {
  /* Kesköö Tallinnas (talvel UTC+2, suvel UTC+3). */
  assert.equal(dayInTallinn(new Date('2026-12-31T21:59:59Z')), '2026-12-31');
  assert.equal(dayInTallinn(new Date('2026-12-31T22:00:00Z')), '2027-01-01');
  assert.equal(dayInTallinn(new Date('2026-06-30T20:59:59Z')), '2026-06-30');
  assert.equal(dayInTallinn(new Date('2026-06-30T21:00:00Z')), '2026-07-01');
  /* Osade järjekord ja vahemärgid on keeleandmed: päev ei sõltu neist. */
  const parts = (...list) => () => ({ formatToParts: () => list.map(([type, value]) => ({ type, value })) });
  const now = new Date('2026-10-10T09:00:00Z');
  assert.equal(dayInTallinn(now, parts(['day', '10'], ['literal', '.'], ['month', '10'], ['literal', '.'], ['year', '2026'])), '2026-10-10');
  assert.equal(dayInTallinn(now, parts(['month', '3'], ['literal', '/'], ['day', '7'], ['literal', '/'], ['year', '2026'])), '2026-03-07');
  /* Kõik, mis ei ole Gregoriuse kalendri ladina numbrid, annab tühja sõne: teised numbrimärgid, teise kalendri
     aasta koos ajastuga, puuduv osa. */
  assert.equal(dayInTallinn(now, parts(['day', '١٠'], ['month', '١٠'], ['year', '٢٠٢٦'])), '');
  assert.equal(dayInTallinn(now, parts(['day', '10'], ['month', '10'], ['year', '8'], ['era', 'Reiwa'])), '');
  assert.equal(dayInTallinn(now, parts(['day', '10'], ['month', '10'])), '');
  assert.equal(dayInTallinn(now, parts(['day', '10'], ['month', 'okt'], ['year', '2026'])), '');
  /* Vormindaja loomise või kasutamise viga (seade ei tunne ajavööndit) ei kukuta lehte: tühi sõne. */
  assert.equal(dayInTallinn(now, () => { throw new RangeError('Invalid time zone specified: Europe/Tallinn'); }), '');
  assert.equal(dayInTallinn(now, () => ({ formatToParts: () => { throw new TypeError('katki'); } })), '');
  assert.equal(dayInTallinn(now, () => null), '');
  assert.equal(dayInTallinn(new Date(Number.NaN)), '');
  assert.equal(dayInTallinn('2026-10-10'), '');
  /* Vigase kuupäeva kohta päeva ei tule ka siis, kui vormindaja midagi vastaks. */
  assert.equal(dayInTallinn(new Date(Number.NaN), parts(['day', '10'], ['month', '10'], ['year', '2026'])), '');
  assert.equal(dayInTallinn('2026-10-10', parts(['day', '10'], ['month', '10'], ['year', '2026'])), '');
  /* Lähtetekst: vormindaja luuakse esimesel küsimisel (mitte faili laadimisel) ja kuju ei loeta Rootsi keeleandmetest. */
  const rates = read('lib/benefits/subsistenceRates.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!rates.includes('sv-SE') && !/\.format\(/.test(rates));
  assert.ok(/calendar: "gregory"/.test(rates) && /numberingSystem: "latn"/.test(rates) && /timeZone: "Europe\/Tallinn"/.test(rates));
  assert.equal(rates.split('new Intl.DateTimeFormat(').length - 1, 1);
  assert.ok(/function defaultTallinnFormatter\(\) \{[^}]*new Intl\.DateTimeFormat\(/.test(rates), 'vormindaja luuakse funktsiooni sees');

  /* Lugematu päev: arvutus keeldub oma koodiga, lehel on üks rida ja lause räägib kuupäevast. */
  const unreadable = pageEstimate({ ...EMPTY_FORM, workIncome: '0' }, {}, [], new Date(Number.NaN));
  assert.equal(unreadable.usable, false);
  assert.deepEqual(unreadable.issues.map((issue) => [issue.code, issue.reason]), [['DATE_UNREADABLE', 'INVALID_DATE']]);
  assert.equal(dateIssueCode(unreadable), 'DATE_UNREADABLE');
  assert.deepEqual(issueRows(unreadable.issues), [{ code: 'DATE_UNREADABLE', fieldLabelKey: '' }]);
  assert.equal(pageView({ ...EMPTY_STATE }, 'et', new Date(Number.NaN)).banner, 'subsistence.issues.DATE_UNREADABLE');
  for (const lang of LANGS) {
    const sentences = ['DATE_UNREADABLE', 'DATE_BEFORE_CURRENT_RATE', 'UNSUPPORTED_DATE'].map((code) => word(lang, `subsistence.issues.${code}`));
    assert.equal(new Set(sentences).size, 3, `${lang}: kolm eri lauset`);
  }
  assert.ok(/kuupäeva lugeda/.test(word('et', 'subsistence.issues.DATE_UNREADABLE')) && !/määr/.test(word('et', 'subsistence.issues.DATE_UNREADABLE')));
});

test('seadme kell varasemas aastas: summat vana määraga ei anta ja tulemus ütleb, mis aasta määraga arvutati', () => {
  /* Praegune määr on uusim rida, mis tabeli kontrollimise päeval juba kehtis. */
  assert.equal(currentRateFrom(), '2026-01-01');
  /* Järgmise aasta rida lisatakse enne aasta algust: detsember ei tohi sellepärast lukku minna. */
  const withNext = [{ validFrom: '2027-01-01' }, ...SUBSISTENCE_RATE_TABLE];
  assert.equal(currentRateFrom(withNext, '2026-12-20'), '2026-01-01');
  assert.equal(currentRateFrom(withNext, '2027-01-02'), '2027-01-01');
  assert.equal(currentRateFrom([{ validFrom: '2027-01-01' }], '2026-12-20'), '');

  /* Seadme kell aastas 2025: varem tuli ühele inimesele 200 € (2025. aasta määr) ilma ühegi sõnata. */
  for (const day of ['2025-06-15', '2025-12-31', new Date('2025-12-31T21:59:59Z')]) {
    const rates = resolveSubsistenceRates(day);
    assert.deepEqual([rates.exact, rates.reason, rates.year], [false, 'DATE_BEFORE_CURRENT_RATE', 2025]);
    const result = pageEstimate({ ...EMPTY_FORM, workIncome: '0' }, {}, [], day);
    assert.equal(result.usable, false);
    assert.equal(result.estimate, null);
    assert.deepEqual(codes(result), ['DATE_BEFORE_CURRENT_RATE']);
    assert.deepEqual(issueRows(result.issues), [{ code: 'DATE_BEFORE_CURRENT_RATE', fieldLabelKey: '' }]);
    assert.equal(resultView(result, 'et').amount, '');
  }
  /* Tabelist varasem päev on sama asi: seadme kell on vale. */
  assert.equal(resolveSubsistenceRates('2024-06-15').reason, 'BEFORE_FIRST_KNOWN_RATE');
  assert.deepEqual(codes(pageEstimate({ ...EMPTY_FORM, workIncome: '0' }, {}, [], '2024-06-15')), ['DATE_BEFORE_CURRENT_RATE']);
  assert.equal(pageView(EMPTY_STATE, 'et', '2025-06-15').banner, 'subsistence.issues.DATE_BEFORE_CURRENT_RATE');
  /* Aasta esimene päev Eesti aja järgi on juba selle aasta määr. */
  assert.equal(pageEstimate({ ...EMPTY_FORM, workIncome: '0' }, {}, [], new Date('2025-12-31T22:00:00Z')).estimate, 220);
  assert.ok(/varasemat aastat/.test(word('et', 'subsistence.issues.DATE_BEFORE_CURRENT_RATE')) && /kuupäeva/.test(word('et', 'subsistence.issues.DATE_BEFORE_CURRENT_RATE')));

  /* Tulemuse vaade ütleb määra aasta toimetulekupiiri real, kolmes keeles. */
  const single = page(SINGLE_FORM, SINGLE_COSTS);
  assert.equal(single.subsistenceLimit.rates.year, 2026);
  const limit = resultView(single, 'et').facts[0];
  assert.deepEqual(limit, { id: 'limit', labelKey: 'subsistence.result.limit', vars: { year: '2026' }, value: '220,00 €' });
  assert.equal(viewText(limit, tFor('et'), 'et'), 'Pere toimetulekupiir (2026. aasta määr)');
  assert.equal(viewText(limit, tFor('en'), 'en'), 'Family subsistence limit (2026 rate)');
  assert.equal(viewText(limit, tFor('ru'), 'ru'), 'Прожиточный минимум семьи (на 2026 год)');
  for (const lang of LANGS) {
    assert.ok(word(lang, 'subsistence.result.limit').includes('{year}'), lang);
    /* Rida peab mahtuma faktide veergu (28 rem) koos summaga: nimi ei ole pikem kui teiste ridade pikim nimi + aasta. */
    assert.ok(viewText(limit, tFor(lang), lang).length <= 42, `${lang}: ${viewText(limit, tFor(lang), lang).length}`);
  }
});

/* --- Leht: väljad, olek ja loetamatu sisu ----------------------------------------------- */

test('leht: väljade tabel ütleb, mis nimega väli mis kohta kirjutab', () => {
  /* Ootus on siin kirjas välja kaupa, mitte loetud tabelist: vahetusse läinud rida kukutab testi. */
  const EXPECTED = {
    family: [
      ['subsistence.fields.adults', 'form', 'adults', true],
      ['subsistence.fields.minors', 'form', 'minors', true]
    ],
    income: [
      ['subsistence.fields.work_income', 'form', 'workIncome', false],
      ['subsistence.fields.other_income', 'form', 'otherIncome', false],
      ['subsistence.fields.paid_maintenance', 'form', 'paidMaintenance', false],
      ['subsistence.fields.enforcement', 'form', 'enforcementWithheld', false]
    ],
    housing: [
      ['subsistence.fields.area', 'form', 'dwellingAreaM2', false],
      ['subsistence.fields.rooms', 'form', 'rooms', true]
    ],
    costs: ['rent', 'buildingManagement', 'buildingRenovationLoan', 'housingLoan', 'landTax', 'buildingInsurance'].map((key) => [`subsistence.costs.${key}`, 'costs', key, false]),
    utilities: ['water', 'hotWater', 'heating', 'electricity', 'gas', 'wasteRemoval'].map((key) => [`subsistence.costs.${key}`, 'costs', key, false])
  };
  assert.deepEqual(Object.keys(VIEW_FIELDS), Object.keys(EXPECTED));
  for (const [viewKey, rows] of Object.entries(EXPECTED)) {
    assert.deepEqual(VIEW_FIELDS[viewKey].map((field) => [field.labelKey, field.costKey ? 'costs' : 'form', field.costKey || field.formKey, field.whole]), rows, viewKey);
  }
  const all = Object.values(VIEW_FIELDS).flat();
  assert.equal(all.length, 20);
  assert.equal(new Set(all.map((field) => field.id)).size, 20, 'iga välja tunnus on oma');
  assert.equal(new Set(all.map((field) => field.labelKey)).size, 20, 'kaks välja ei kanna sama nime');
  /* Välja kuju: täisarv sammuga 1 ja laega 99, summa sammuga 0,01 ja arvutuse laega, pind sammuga 0,1 ja oma laega. */
  for (const field of all) {
    if (field.whole) assert.deepEqual([field.step, field.max, field.size], ['1', '99', 'count'], field.id);
    else if (field.id === 'dwellingAreaM2') assert.deepEqual([field.step, field.max, field.size], ['0.1', String(MAX_DWELLING_AREA_M2), 'count'], field.id);
    else assert.deepEqual([field.step, field.max, field.size], ['0.01', String(MAX_AMOUNT), 'sum'], field.id);
  }
  /* Selgitus, mis välja kirjeldab: pere, sissetuleku kaks esimest välja ja tubade arv. */
  assert.deepEqual(all.filter((field) => field.hint).map((field) => [field.id, field.hint]), [['adults', 'family'], ['minors', 'family'], ['workIncome', 'income'], ['otherIncome', 'income'], ['rooms', 'rooms']]);

  for (const field of all) {
    /* Kirjutamine: väärtus läheb täpselt selle välja kohale ja mitte kuhugi mujale. */
    const next = pageReducer(EMPTY_STATE, { type: 'field', id: field.id, value: '7', unreadable: false });
    const group = field.costKey ? 'costs' : 'form';
    const key = field.costKey || field.formKey;
    assert.deepEqual(next, { ...EMPTY_STATE, [group]: { ...EMPTY_STATE[group], [key]: '7' } }, field.id);
    assert.equal(fieldValue(next, field), '7', field.id);
    /* Arvutus saab selle sama nime all, mille all leht selle hoiab. */
    const input = estimateInput(next.form, next.costs, next.bad);
    assert.equal(field.costKey ? input.housingCosts[key] : input[key], '7', field.id);
    /* Loetamatu sisu: märk välja tunnusega ja puudujäägi rida nimetab välja SAMA nimega, mis välja kohal seisab. */
    const marked = pageReducer(EMPTY_STATE, { type: 'field', id: field.id, value: '', unreadable: true });
    assert.deepEqual(marked.bad, [field.id], field.id);
    const refused = pageEstimate(marked.form, marked.costs, marked.bad, DAY);
    assert.equal(refused.usable, false, field.id);
    assert.ok(issueRows(refused.issues).some((row) => row.code === 'INVALID_AMOUNT' && row.fieldLabelKey === field.labelKey), field.id);
    assert.equal(issueFieldLabelKey(field.costKey ? `housingCosts.${field.costKey}` : field.formKey), field.labelKey, field.id);
    for (const lang of LANGS) assert.equal(typeof word(lang, field.labelKey), 'string', `${lang}: ${field.labelKey}`);
  }
  /* Pereliikmete ja tubade väli on täisarv: murdosaga tubade arv lülitas kogu pinna arvestuse sisse. */
  assert.deepEqual(all.filter((field) => field.whole).map((field) => field.id), ['adults', 'minors', 'rooms']);
});

test('leht: arvuväli ütleb oma väärtuse ja selle, kas sisu on loetav', () => {
  /* Brauser annab loetamatu teksti („280,-") väärtusena tühja sõne; vahet teeb ainult `validity.badInput`. */
  assert.deepEqual(readNumberInput({ value: '', validity: { badInput: true } }), { value: '', unreadable: true });
  assert.deepEqual(readNumberInput({ value: '', validity: { badInput: false } }), { value: '', unreadable: false });
  assert.deepEqual(readNumberInput({ value: '280.5', validity: { badInput: false } }), { value: '280.5', unreadable: false });
  assert.deepEqual(readNumberInput({ value: '12' }), { value: '12', unreadable: false }, 'brauser ilma märketa');
  assert.deepEqual(readNumberInput(null), { value: '', unreadable: false });
  assert.deepEqual(readNumberInput({ value: '', validity: { badInput: 'true' } }), { value: '', unreadable: false }, 'ainult tõene märge loeb');
  /* Täisarvuväli: murdosa ja miinus ei jää väljale; tühi jääb tühjaks (mitte nulliks). */
  assert.deepEqual(readNumberInput({ value: '2.7' }, true), { value: '2', unreadable: false });
  assert.deepEqual(readNumberInput({ value: '250' }, true), { value: '99', unreadable: false });
  assert.deepEqual(readNumberInput({ value: '', validity: { badInput: true } }, true), { value: '', unreadable: true });
  assert.deepEqual(readNumberInput({ value: '2.7' }, false), { value: '2.7', unreadable: false });
  /* Välja teade lehele kannab välja tunnust. */
  const rent = VIEW_FIELDS.costs[0];
  const rooms = VIEW_FIELDS.housing[1];
  assert.deepEqual(fieldAction(rent, { value: '', validity: { badInput: true } }), { type: 'field', id: 'cost:rent', value: '', unreadable: true });
  assert.deepEqual(fieldAction(rooms, { value: '2.7', validity: { badInput: false } }), { type: 'field', id: 'rooms', value: '2', unreadable: false });
});

test('leht: loetamatute väljade märgid pannakse peale, võetakse maha ja ei kordu', () => {
  const none = [];
  assert.equal(markReducer(none, { id: 'rooms', unreadable: false }), none, 'midagi ei muutu: sama loend');
  const one = markReducer(none, { id: 'cost:rent', unreadable: true });
  assert.deepEqual(one, ['cost:rent']);
  assert.equal(markReducer(one, { id: 'cost:rent', unreadable: true }), one, 'sama märk teist korda: sama loend');
  const two = markReducer(one, { id: 'rooms', unreadable: true });
  assert.deepEqual(two, ['cost:rent', 'rooms']);
  /* Maha läheb ainult selle välja märk. */
  assert.deepEqual(markReducer(two, { id: 'cost:rent', unreadable: false }), ['rooms']);
  assert.equal(markReducer(two, { id: 'workIncome', unreadable: false }), two);
  /* Ainult tõene märge paneb märgi; tunnuseta teade ei tee midagi. */
  assert.equal(markReducer(none, { id: 'rooms', unreadable: 'yes' }), none);
  assert.equal(markReducer(two, { unreadable: true }), two);
  assert.equal(markReducer(two, {}), two);
  /* Väljad läksid ekraanilt: kõik märgid maha. */
  assert.deepEqual(markReducer(two, { clear: true }), []);
  assert.equal(markReducer(none, { clear: true }), none);
  assert.deepEqual(two, ['cost:rent', 'rooms'], 'algset loendit ei muudeta');
});

test('leht: tühjale väljale kleebitud loetamatu tekst peatab hinnangu ja kustutamine võtab märgi maha', () => {
  /* Ülevaataja juht: üks inimene, kõik sisestatud peale üüri. Tühjale üüri väljale kleebitakse „280,-":
     väärtus on enne ja pärast tühi sõne, muutub ainult brauseri märge. Varem ei jõudnud see leheni ja
     leht näitas „0,00 €, toetust ei tuleks", kuigi üüriga oleks hinnang 221,40 €. */
  const { rent: _rent, ...withoutRent } = SINGLE_COSTS;
  const rent = VIEW_FIELDS.costs[0];
  const before = { form: SINGLE_FORM, costs: withoutRent, bad: [] };
  assert.equal(pageView(before, 'et', DAY).result.amount, '0,00 €');
  const pasted = pageReducer(before, fieldAction(rent, { value: '', validity: { badInput: true } }));
  assert.deepEqual(pasted.bad, ['cost:rent']);
  assert.equal(pasted.costs, before.costs, 'kulude väärtused ei muutunud');
  const refused = pageView(pasted, 'et', DAY);
  assert.equal(refused.result.usable, false);
  assert.equal(refused.result.amount, '');
  assert.deepEqual(refused.result.rows.map((row) => viewText(row, tFor('et'), 'et')), ['„Üür”: kontrolli sisestatut.']);
  assert.equal(refused.steps.find((step) => step.key === 'result').summary, '', 'plaadil ja kiirmenüüs summat ei ole');
  assert.equal(refused.steps.find((step) => step.key === 'result').state, 'empty');
  /* Sama teade teist korda (onInput ja onChange tulevad sama sisestuse kohta mõlemad): olek on SAMA objekt. */
  assert.equal(pageReducer(pasted, fieldAction(rent, { value: '', validity: { badInput: true } })), pasted);
  /* Vali kõik ja kustuta: väärtus on endiselt tühi sõne, märge kadus. Märk läheb maha ja endine tulemus on tagasi. */
  const cleared = pageReducer(pasted, fieldAction(rent, { value: '', validity: { badInput: false } }));
  assert.deepEqual(cleared.bad, []);
  assert.equal(pageView(cleared, 'et', DAY).result.amount, '0,00 €');
  /* Loetav summa samale väljale: märk maha ja summa arvesse. */
  const typed = pageReducer(pasted, fieldAction(rent, { value: '280', validity: { badInput: false } }));
  assert.deepEqual([typed.bad, typed.costs.rent], [[], '280']);
  assert.equal(pageView(typed, 'et', DAY).result.amount, '221,40 €');
  /* Sisestatud summa kustutamine: väli on tühi ja summa ei jää olekusse alles (muidu arvutataks kuluga, mida väljal ei ole). */
  const erased = pageReducer(typed, fieldAction(rent, { value: '', validity: { badInput: false } }));
  assert.equal(erased.costs.rent, '');
  assert.equal(pageView(erased, 'et', DAY).result.amount, '0,00 €');
  assert.deepEqual(pageView(erased, 'et', DAY).gates.map((row) => row.field), ['costsAreCurrentMonth'], 'üüri küsimused kadusid koos üüriga');
  const income = VIEW_FIELDS.income[0];
  const noIncome = pageReducer({ ...EMPTY_STATE, form: { ...EMPTY_FORM, workIncome: '300' } }, fieldAction(income, { value: '', validity: { badInput: false } }));
  assert.equal(noIncome.form.workIncome, '');
  assert.deepEqual(pageView(noIncome, 'et', DAY).result.rows.map((row) => row.key), ['subsistence.issues.INCOME_REQUIRED']);

  /* Puutumata lehel: „2e" tubade väljal ja siis tühjaks. Märk ei jää rippuma ja lahkumine ei küsi enam. */
  const rooms = VIEW_FIELDS.housing[1];
  const odd = pageReducer(EMPTY_STATE, fieldAction(rooms, { value: '', validity: { badInput: true } }));
  assert.deepEqual(odd.bad, ['rooms']);
  assert.equal(leaveGuarded('authenticated', odd), true);
  const again = pageReducer(odd, fieldAction(rooms, { value: '', validity: { badInput: false } }));
  assert.deepEqual(again, { ...EMPTY_STATE, bad: [] });
  assert.equal(leaveGuarded('authenticated', again), false);
  assert.deepEqual(pageView(again, 'et', DAY).result.rows.map((row) => row.key), ['subsistence.issues.INCOME_REQUIRED']);
  /* Fookuse lahkumisel loetakse sama teade veel kord: muutuseta väli annab SAMA oleku. */
  assert.equal(pageReducer(EMPTY_STATE, fieldAction(rooms, { value: '', validity: { badInput: false } })), EMPTY_STATE);
  assert.equal(pageReducer(EMPTY_STATE, fieldAction(VIEW_FIELDS.family[0], { value: '1', validity: { badInput: false } })), EMPTY_STATE);
});

test('leht: loetamatu sisu väljal ei kao vaikselt, vaid peatab hinnangu välja nimega', () => {
  /* Arvuväli annab loetamatu teksti („500,-") lehele tühjana, tekst jääb väljale: leht märgib välja loetamatuks. */
  const income = page({ ...EMPTY_FORM, workIncome: '', otherIncome: '0' }, {}, ['workIncome']);
  assert.equal(income.usable, false);
  assert.deepEqual(issueRows(income.issues), [{ code: 'INVALID_AMOUNT', fieldLabelKey: 'subsistence.fields.work_income' }]);
  const rent = page({ ...SINGLE_FORM }, { ...SINGLE_COSTS, rent: '' }, [costFieldId('rent')]);
  assert.equal(rent.usable, false);
  assert.ok(issueRows(rent.issues).some((row) => row.code === 'INVALID_AMOUNT' && row.fieldLabelKey === 'subsistence.costs.rent'));
  for (const field of ['adults', 'minors', 'dwellingAreaM2', 'rooms']) {
    const result = page({ ...EMPTY_FORM, workIncome: '0' }, {}, [field]);
    assert.equal(result.usable, false, field);
    assert.equal(result.estimate, null, field);
    assert.ok(issueRows(result.issues).some((row) => row.code === 'INVALID_AMOUNT' && row.fieldLabelKey === issueFieldLabelKey(field)), field);
    assert.ok(issueFieldLabelKey(field), field);
  }
  /* Loetamatu pind koos üüriga: üks rida välja nimega, mitte lisaks „märgi eluruumi üldpind", nagu oleks väli tühi. */
  const area = page({ ...SINGLE_FORM, dwellingAreaM2: '' }, SINGLE_COSTS, ['dwellingAreaM2']);
  assert.deepEqual(issueRows(area.issues), [{ code: 'INVALID_AMOUNT', fieldLabelKey: 'subsistence.fields.area' }]);
  assert.ok(Number.isNaN(estimateInput(SINGLE_FORM, SINGLE_COSTS, ['dwellingAreaM2']).dwellingAreaM2));
  assert.equal(estimateInput(SINGLE_FORM, SINGLE_COSTS).dwellingAreaM2, '40');
  /* Loetamatu väli on ka sisestus: lahkumine küsib. */
  assert.equal(formTouched(EMPTY_FORM, {}, ['rooms']), true);
  /* Leht ise arvutuse sisendit kokku ei pane ega arvutust ei kutsu: tulemus tuleb ühest testitud funktsioonist. */
  const source = read('components/benefits/SubsistenceCalculator.jsx');
  assert.ok(!source.includes('estimateSubsistenceBenefit') && !source.includes('pageEstimate') && !source.includes('estimateInput'));
  assert.ok(source.includes('const view = pageView(state, locale, day);'));
});

test('leht: oleku muutused käivad ühe testitud funktsiooni kaudu', () => {
  /* Vastus täpsustavale küsimusele: „Jah" on tõene ja „Ei" väär, mitte vastupidi; tundmatu valik on vastamata. */
  assert.deepEqual([answerFromChoice('yes'), answerFromChoice('no'), answerFromChoice(''), answerFromChoice('jah'), answerFromChoice(true)], [true, false, null, null, null]);
  assert.deepEqual([choiceFromAnswer(true), choiceFromAnswer(false), choiceFromAnswer(null), choiceFromAnswer(undefined), choiceFromAnswer('yes'), choiceFromAnswer(0)], ['yes', 'no', '', '', '', '']);
  for (const choice of ['yes', 'no']) assert.equal(choiceFromAnswer(answerFromChoice(choice)), choice);
  assert.deepEqual(ANSWER_CHOICES.map((choice) => [choice.value, word('et', choice.labelKey)]), [['yes', 'Jah'], ['no', 'Ei']]);
  for (const field of GATE_FIELD_NAMES) {
    const yes = pageReducer(EMPTY_STATE, answerAction({ field }, 'yes'));
    assert.deepEqual(yes, { ...EMPTY_STATE, form: { ...EMPTY_FORM, [field]: true } }, field);
    assert.equal(estimateInput(yes.form, yes.costs).gates[field], true, field);
    const no = pageReducer(yes, answerAction({ field }, 'no'));
    assert.equal(no.form[field], false, field);
    assert.equal(estimateInput(no.form, no.costs).gates[field], false, field);
    assert.equal(pageReducer(no, answerAction({ field }, 'no')), no, 'sama vastus: sama olek');
    assert.equal(pageReducer(no, answerAction({ field }, 'võib-olla')).form[field], null, 'tundmatu valik ei ole „ei"');
  }
  /* Vastus läheb ainult täpsustava küsimuse väljale: summa välja nii üle kirjutada ei saa. */
  assert.equal(pageReducer(EMPTY_STATE, { type: 'answer', field: 'workIncome', choice: 'yes' }), EMPTY_STATE);
  assert.equal(pageReducer(EMPTY_STATE, { type: 'answer', field: 'singleOccupantExtendedNorm', choice: 'yes' }), EMPTY_STATE);
  /* Küsimuste read kannavad valikut sellisena, nagu inimene vastas. */
  const rows = gateRows({ ...EMPTY_FORM, costsAreCurrentMonth: false, landlordIsTenantsRelative: true }, { rent: '300' });
  assert.deepEqual(rows.map((row) => [row.field, row.choice]), [['costsAreCurrentMonth', 'no'], ['landlordIsTenantsRelative', 'yes'], ['landlordIsRelatedCompany', '']]);

  /* Märge „elan üksi": ainult tõene väärtus paneb selle sisse. */
  const marked = pageReducer(EMPTY_STATE, { type: 'singleOccupant', checked: true });
  assert.equal(marked.form.singleOccupantExtendedNorm, true);
  assert.equal(estimateInput(marked.form).singleOccupantExtendedNorm, true);
  assert.equal(pageReducer(marked, { type: 'singleOccupant', checked: false }).form.singleOccupantExtendedNorm, false);
  assert.equal(pageReducer(EMPTY_STATE, { type: 'singleOccupant', checked: 'jah' }), EMPTY_STATE);
  /* Märget pakutakse ainult ühe pereliikmega. */
  assert.deepEqual(
    [['1', '0'], ['0', '1'], ['2', '0'], ['1', '1'], ['', ''], ['0', '0']].map(([adults, minors]) => showSingleOccupant({ ...EMPTY_FORM, adults, minors })),
    [true, true, false, false, false, false]
  );
  assert.deepEqual(pageView({ ...EMPTY_STATE, form: { ...EMPTY_FORM, adults: '2', singleOccupantExtendedNorm: true } }, 'et', DAY).singleOccupant, { shown: false, checked: true });

  /* Tundmatu väli ja tundmatu muutus ei tee midagi. */
  assert.equal(pageReducer(EMPTY_STATE, { type: 'field', id: 'tundmatu', value: '5' }), EMPTY_STATE);
  assert.equal(pageReducer(EMPTY_STATE, { type: 'field', id: 'singleOccupantExtendedNorm', value: '5' }), EMPTY_STATE);
  assert.equal(pageReducer(EMPTY_STATE, { type: 'midagi' }), EMPTY_STATE);
  assert.equal(pageReducer(EMPTY_STATE, undefined), EMPTY_STATE);
  /* Väljad läksid ekraanilt (seanss lõppes): märgid maha, sisestatud arvud jäävad. */
  const typed = { form: { ...EMPTY_FORM, workIncome: '300' }, costs: { rent: '280' }, bad: ['rooms', 'cost:water'] };
  const gone = pageReducer(typed, { type: 'fieldsGone' });
  assert.deepEqual(gone, { ...typed, bad: [] });
  assert.equal(gone.form, typed.form);
  assert.equal(pageReducer(gone, { type: 'fieldsGone' }), gone);
  /* Algseis: üks täisealine, kulusid ja märke ei ole. Iga väli ja iga küsimus on vormis olemas: puuduv koht
     tähendaks, et sinna sisestatu ei loe muudatuseks (lahkumine ei küsiks). */
  assert.deepEqual(EMPTY_STATE, { form: EMPTY_FORM, costs: {}, bad: [] });
  assert.deepEqual(EMPTY_FORM, {
    adults: '1',
    minors: '0',
    otherIncome: '',
    workIncome: '',
    paidMaintenance: '',
    enforcementWithheld: '',
    dwellingAreaM2: '',
    rooms: '',
    singleOccupantExtendedNorm: false,
    costsAreCurrentMonth: null,
    landlordIsTenantsRelative: null,
    landlordIsRelatedCompany: null,
    isApartmentBuilding: null,
    housingLoanConditionsMet: null,
    housingLoanMonthLimitReached: null,
    landTaxExempt: null
  });
  /* Iga arvuväli on muudatus: sisestus mis tahes väljale paneb lahkumise värava peale. */
  for (const field of Object.values(VIEW_FIELDS).flat()) {
    const touched = pageReducer(EMPTY_STATE, { type: 'field', id: field.id, value: '3', unreadable: false });
    assert.equal(formTouched(touched.form, touched.costs, touched.bad), true, field.id);
  }
});

test('leht: vastused lähevad arvutusse sellisena, nagu inimene need andis', () => {
  const input = estimateInput({ ...FAMILY_FORM, costsAreCurrentMonth: false, landTaxExempt: true }, FAMILY_COSTS);
  assert.equal(input.gates.costsAreCurrentMonth, false);
  assert.equal(input.gates.housingLoanMonthLimitReached, false);
  assert.equal(input.gates.landTaxExempt, true);
  assert.equal(input.gates.landlordIsTenantsRelative, null);
  assert.equal(input.gates.landlordIsRelatedCompany, null);
  assert.equal(input.workIncome, '1180.40');
  assert.equal(input.rooms, '3');
  assert.equal(estimateInput({ ...EMPTY_FORM, rooms: '' }).rooms, null);
  assert.deepEqual(Object.keys(input.housingCosts).sort(), Object.keys(FAMILY_COSTS).sort());
  assert.ok(Number.isNaN(estimateInput(EMPTY_FORM, {}, ['otherIncome']).otherIncome));
  /* Üksi elava inimese märge: mitme pereliikmega arvutus seda ei kasuta, ka siis, kui see jäi sisse. */
  assert.equal(page({ ...FAMILY_FORM, singleOccupantExtendedNorm: true }, FAMILY_COSTS).estimate, 358.5);
});

/* --- Leht: mida tulemuse kohta öeldakse -------------------------------------------------- */

test('leht: kärbitud eluasemekulu kohta öeldakse, mis kulud ja kui suur osa', () => {
  const single = page(SINGLE_FORM, SINGLE_COSTS);
  assert.deepEqual(housingReason(single, 'et'), {
    key: 'subsistence.reason.area_scaled',
    costKeys: ['subsistence.costs.rent', 'subsistence.costs.heating'],
    vars: { area: '40', norm: '33', percent: '82,5' }
  });
  assert.equal(housingReason(single, 'en').vars.percent, '82.5');
  /* Napilt üle normi: kärbe on olemas, seega ei öelda kunagi 100%. */
  const barely = page({ ...SINGLE_FORM, dwellingAreaM2: '33.04' }, SINGLE_COSTS);
  assert.ok(barely.housing.total < barely.housing.declaredTotal);
  assert.equal(housingReason(barely, 'et').vars.percent, '99,8');
  assert.equal(housingReason(page({ ...SINGLE_FORM, dwellingAreaM2: '33.001' }, { rent: '300' }), 'et')?.vars.percent ?? '99,9', '99,9');
  /* Kui sisestatu läks täies mahus arvesse või summat ei ole, põhjust ei ole. */
  assert.equal(housingReason(page(FAMILY_FORM, FAMILY_COSTS), 'et'), null);
  assert.equal(housingReason(page({ ...SINGLE_FORM, workIncome: '', otherIncome: '' }, SINGLE_COSTS), 'et'), null);
  /* Faktide read: sisestatud summa on real ainult siis, kui arvesse läks vähem. */
  assert.deepEqual(resultFacts(single, 'et'), [
    { key: 'limit', value: '220,00 €', vars: { year: '2026' } },
    { key: 'housing_declared', value: '391,85 €' },
    { key: 'housing', value: '332,35 €' },
    { key: 'income', value: '330,95 €' }
  ]);
  assert.deepEqual(resultFacts(page(FAMILY_FORM, FAMILY_COSTS), 'et').map((fact) => fact.key), ['limit', 'housing', 'income']);
  assert.deepEqual(resultFacts(page(EMPTY_FORM), 'et'), []);
  for (const lang of LANGS) {
    const sentence = word(lang, 'subsistence.reason.area_scaled');
    for (const name of ['{area}', '{norm}', '{percent}', '{costs}']) assert.ok(sentence.includes(name), `${lang}: ${name}`);
  }
  /* Protsent on allapoole ümardatud, seega „umbes"; kulude nimed on jutumärkides nagu puudujäägi lausetes. */
  assert.ok(/umbes \{percent\}%/.test(word('et', 'subsistence.reason.area_scaled')));
  assert.equal(quoted('Üür', 'et'), '„Üür”');
  assert.equal(quoted('Rent', 'en'), '“Rent”');
  assert.equal(quoted('Аренда', 'ru'), '«Аренда»');
});

test('leht: eelhinnangu vaade on kas summa koos põhjustega või puudujäägi read, mitte kunagi mõlemat', () => {
  const et = tFor('et');
  /* Summa: suur arv on HINNANG (mitte kulude plaadi summa), faktid ja laused selle all. */
  const single = resultView(page(SINGLE_FORM, SINGLE_COSTS), 'et');
  assert.deepEqual(Object.keys(single), ['usable', 'amount', 'facts', 'sentences', 'rows']);
  assert.equal(single.usable, true);
  assert.equal(single.amount, '221,40 €');
  assert.notEqual(single.amount, stepSummaries(SINGLE_FORM, SINGLE_COSTS, null, 'et').costs);
  assert.deepEqual(single.facts.map((fact) => [viewText(fact, et, 'et'), fact.value]), [
    ['Pere toimetulekupiir (2026. aasta määr)', '220,00 €'],
    ['Sisestatud eluasemekulu', '391,85 €'],
    ['Arvesse minev eluasemekulu', '332,35 €'],
    ['Arvesse minev sissetulek', '330,95 €']
  ]);
  assert.deepEqual(single.sentences.map((sentence) => [sentence.id, sentence.tone]), [['reason', 'quiet'], ['kov_limits', 'caveat']]);
  assert.deepEqual(single.sentences.map((sentence) => viewText(sentence, et, 'et')), [
    'Eluruum (40 m²) on normpinnast (33 m²) suurem. Selles eelhinnangus läks arvesse umbes 82,5% nendest kuludest: „Üür”, „Küte”.',
    word('et', 'subsistence.caveat.kov_limits')
  ]);
  assert.deepEqual(single.rows, []);
  assert.ok(viewText(resultView(page(SINGLE_FORM, SINGLE_COSTS), 'en').sentences[0], tFor('en'), 'en').endsWith('“Rent”, “Heating”.'));
  assert.ok(viewText(resultView(page(SINGLE_FORM, SINGLE_COSTS), 'ru').sentences[0], tFor('ru'), 'ru').includes('«Аренда», «Отопление»'));
  /* Toetust ei tuleks: üks vaikne lause, piirmäärade hoiatust ei ole. */
  const above = resultView(page({ ...SINGLE_FORM, workIncome: '5000' }, SINGLE_COSTS), 'et');
  assert.equal(above.amount, '0,00 €');
  assert.deepEqual(above.sentences.map((sentence) => [sentence.id, sentence.tone]), [['reason', 'quiet'], ['above_line', 'quiet']]);
  assert.equal(viewText(above.sentences[1], et, 'et'), word('et', 'subsistence.caveat.above_line'));
  /* Ilma eluasemekuludeta: ainult summa ja kolm fakti. */
  const plain = resultView(page({ ...EMPTY_FORM, workIncome: '0' }), 'et');
  assert.deepEqual([plain.amount, plain.facts.map((fact) => fact.id), plain.sentences], ['220,00 €', ['limit', 'housing', 'income'], []]);

  /* Keeldumine: ühtegi arvu ei ole, on read; välja nimega rida võtab lause, kuhu nimi sisse käib. */
  const refused = resultView(page({ ...SINGLE_FORM, workIncome: '-5' }, { ...SINGLE_COSTS, water: 'abc' }), 'et');
  assert.deepEqual([refused.usable, refused.amount, refused.facts, refused.sentences], [false, '', [], []]);
  assert.deepEqual(refused.rows, [
    { id: 'INVALID_AMOUNT:subsistence.costs.water', key: 'subsistence.issues_named.INVALID_AMOUNT', fieldLabelKey: 'subsistence.costs.water' },
    { id: 'NEGATIVE_AMOUNT:subsistence.fields.work_income', key: 'subsistence.issues_named.NEGATIVE_AMOUNT', fieldLabelKey: 'subsistence.fields.work_income' }
  ]);
  assert.deepEqual(refused.rows.map((row) => viewText(row, et, 'et')), ['„Vesi ja kanalisatsioon”: kontrolli sisestatut.', '„Töine sissetulek (netos)”: summa ei saa olla negatiivne.']);
  const untouched = resultView(page(EMPTY_FORM), 'et');
  assert.deepEqual(untouched.rows, [{ id: 'INCOME_REQUIRED:', key: 'subsistence.issues.INCOME_REQUIRED', fieldLabelKey: '' }]);
  assert.equal(viewText(untouched.rows[0], et, 'et'), word('et', 'subsistence.issues.INCOME_REQUIRED'));
  assert.equal(issueTextKey({ code: 'GATE_UNANSWERED', fieldLabelKey: '' }), 'subsistence.issues.GATE_UNANSWERED');
  for (const empty of [null, undefined, {}]) assert.deepEqual(resultView(empty, 'et'), { usable: false, amount: '', facts: [], sentences: [], rows: [] });
});

test('leht: lause tulemuse all ja plaatide kokkuvõtted', () => {
  assert.equal(resultNote(page(SINGLE_FORM, SINGLE_COSTS)), 'kov_limits');
  assert.equal(resultNote(page({ ...EMPTY_FORM, workIncome: '0' })), '', 'ilma eluasemekuludeta piirmäärade hoiatust ei ole');
  assert.equal(resultNote(page({ ...SINGLE_FORM, workIncome: '5000' }, SINGLE_COSTS)), 'above_line', 'kui toetust ei tuleks, ei öelda, et summa võib olla väiksem');
  assert.equal(resultNote(page(EMPTY_FORM)), '');
  assert.equal(resultNote(page({ ...SINGLE_FORM, workIncome: '', otherIncome: '' }, SINGLE_COSTS)), '', 'keeldumise korral märkust ei ole, ka siis, kui kulud on sisestatud');
  const family = page(FAMILY_FORM, FAMILY_COSTS);
  assert.deepEqual(stepSummaries(FAMILY_FORM, FAMILY_COSTS, family, 'et'), { family: { adults: 2, minors: 2 }, costs: '444,65 €', utilities: '240,00 €', result: '358,50 €' });
  assert.equal(stepSummaries({ ...EMPTY_FORM, adults: '1.9' }, {}, null).family.adults, 1);
  /* Plaadi summas on ainult sisestatud kulud: negatiivne ja loetamatu summa seda ei vähenda ega riku. */
  const odd = stepSummaries(EMPTY_FORM, { rent: '100', buildingInsurance: '-30', landTax: 'abc', water: '-5' }, null, 'et');
  assert.deepEqual([odd.costs, odd.utilities, odd.result], ['100,00 €', '', '']);
});

test('leht: kõik, mida vaated joonistavad, tuleb ühest kohast', () => {
  const view = pageView({ form: FAMILY_FORM, costs: FAMILY_COSTS, bad: [] }, 'et', DAY);
  assert.deepEqual(Object.keys(view), ['banner', 'steps', 'gates', 'singleOccupant', 'result']);
  assert.equal(view.banner, '');
  assert.deepEqual(view.steps.map((step) => step.key), STEP_KEYS);
  assert.deepEqual(view.steps.map((step) => step.state), ['done', 'done', 'done', 'done', 'done', 'done', 'done']);
  assert.deepEqual(view.steps.map((step) => step.summary), ['', '', '', '444,65 €', '240,00 €', '', '358,50 €']);
  assert.deepEqual([view.steps[0].summaryKey, view.steps[0].summaryVars], ['subsistence.views.family.summary', { adults: 2, minors: 2 }]);
  assert.equal(tFor('et')(view.steps[0].summaryKey, view.steps[0].summaryVars), 'Täisealisi 2, alaealisi 2');
  for (const step of view.steps) assert.deepEqual([step.titleKey, step.shortKey], [`subsistence.views.${step.key}.title`, `subsistence.views.${step.key}.short`]);
  assert.deepEqual(view.gates.map((row) => [row.field, row.choice]), [['costsAreCurrentMonth', 'yes'], ['isApartmentBuilding', 'yes'], ['housingLoanConditionsMet', 'yes'], ['housingLoanMonthLimitReached', 'no']]);
  assert.equal(view.result.amount, '358,50 €');
  /* Üle nelja küsimuse ei mahu ühte vaatesse: ainult siis on täpsustuste vaade vabalt keriv. */
  assert.deepEqual(view.steps.map((step) => step.free), [false, false, false, false, false, false, false]);
  const many = pageView({ form: FAMILY_FORM, costs: { ...FAMILY_COSTS, rent: '100' }, bad: [] }, 'et', DAY);
  assert.equal(many.gates.length, 6);
  assert.deepEqual(many.steps.filter((step) => step.free).map((step) => step.key), ['gates']);
  /* Puutumata leht: summat ei ole ei vaates ega plaadil. */
  const untouched = pageView(EMPTY_STATE, 'et', DAY);
  assert.deepEqual(untouched.steps.map((step) => step.state), ['done', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty']);
  assert.deepEqual([untouched.result.usable, untouched.result.amount, untouched.gates, untouched.steps.at(-1).summary], [false, '', [], '']);
  /* Kuupäeva puudujääk on lava kohal oma lausega. */
  assert.equal(pageView(EMPTY_STATE, 'et', '2027-01-15').banner, 'subsistence.issues.UNSUPPORTED_DATE');
  /* Lehe keel jõuab summadesse. */
  assert.equal(pageView({ form: FAMILY_FORM, costs: FAMILY_COSTS, bad: [] }, 'en', DAY).result.amount, '358.50 €');
});

test('leht: summa viga nimetab välja ja puudujääk ei kordu', () => {
  assert.equal(issueFieldLabelKey('housingCosts.rent'), 'subsistence.costs.rent');
  assert.equal(issueFieldLabelKey('workIncome'), 'subsistence.fields.work_income');
  assert.equal(issueFieldLabelKey('housingCosts.tundmatu'), '');
  assert.equal(issueFieldLabelKey('tundmatu'), '');
  assert.equal(issueFieldLabelKey('cost:rent'), 'subsistence.costs.rent');
  const negative = page({ ...SINGLE_FORM, workIncome: '-5' }, { ...SINGLE_COSTS, water: 'abc' });
  assert.deepEqual(issueRows(negative.issues), [
    { code: 'INVALID_AMOUNT', fieldLabelKey: 'subsistence.costs.water' },
    { code: 'NEGATIVE_AMOUNT', fieldLabelKey: 'subsistence.fields.work_income' }
  ]);
  assert.deepEqual(issueRows([{ code: 'GATE_UNANSWERED', field: 'gates.a' }, { code: 'GATE_UNANSWERED', field: 'gates.b' }, {}]), [{ code: 'GATE_UNANSWERED', fieldLabelKey: '' }]);
  assert.equal(issueRows([{ code: 'NEGATIVE_AMOUNT', field: 'housingCosts.rent' }, { code: 'NEGATIVE_AMOUNT', field: 'otherIncome' }]).length, 2, 'kaks välja, kaks rida');
});

test('leht: arvud on täisarvud seal, kus arvutus neid täisarvuna loeb, ja muudetud vorm küsib enne lahkumist', () => {
  assert.equal(wholeCount('1.5'), 1);
  assert.equal(wholeCount('-2'), 0);
  assert.equal(wholeCount('250'), 99);
  assert.equal(wholeCount(''), 0);
  assert.equal(formTouched(EMPTY_FORM, {}), false);
  assert.equal(formTouched({ ...EMPTY_FORM }, { rent: '' }), false);
  assert.equal(formTouched({ ...EMPTY_FORM, workIncome: '0' }, {}), true);
  assert.equal(formTouched({ ...EMPTY_FORM, adults: '2' }, {}), true);
  assert.equal(formTouched(EMPTY_FORM, { rent: '1' }), true);
  assert.equal(formTouched({ ...EMPTY_FORM, landTaxExempt: false }, {}), true);
  /* Mis lehel ees on: konto on nõutav, kõik muu peale sisse logitud seansi on sisselogimise kutse. */
  assert.deepEqual(['loading', 'authenticated', 'unauthenticated', undefined, ''].map(pageScreen), ['loading', 'form', 'login', 'login', 'login']);
  /* Lehe värav: ainult siis, kui vorm on ees JA midagi on sisestatud; lõppenud seansi korral väravat ei ole. */
  const typed = { ...EMPTY_STATE, form: { ...EMPTY_FORM, workIncome: '0' } };
  assert.equal(leaveGuarded('authenticated', typed), true);
  assert.equal(leaveGuarded('authenticated', EMPTY_STATE), false);
  assert.equal(leaveGuarded('unauthenticated', typed), false);
  assert.equal(leaveGuarded('loading', typed), false);
  assert.equal(leaveGuarded('authenticated', { ...EMPTY_STATE, costs: { rent: '1' } }), true);
  assert.equal(leaveGuarded('authenticated', { ...EMPTY_STATE, bad: ['rooms'] }), true);
});

test('leht: lahkumise värav peab kinni kiirmenüü tagasinoole ja akna sulgemise ning tuleb maha jälgi jätmata', () => {
  const listeners = new Map();
  const target = {
    addEventListener: (type, handler) => listeners.set(type, handler),
    removeEventListener: (type, handler) => {
      if (listeners.get(type) === handler) listeners.delete(type);
    }
  };
  let clock = 1000;
  const asked = [];
  /* Päris kahe vajutusega värav ja päris paneeli värav; kell on testi käes. */
  const leave = twoPressLeaveGuard({ onAsk: () => asked.push('ask'), onClear: () => asked.push('clear'), now: () => clock });
  const disarm = armLeaveGuard({ leave, register: setPanelLeaveGuard, target });
  try {
    /* Akna sulgemine ja uuesti laadimine: brauseri enda küsimus. */
    assert.deepEqual([...listeners.keys()], ['beforeunload']);
    const event = { prevented: false, preventDefault() { this.prevented = true; }, returnValue: undefined };
    listeners.get('beforeunload')(event);
    assert.deepEqual([event.prevented, event.returnValue], [true, '']);
    /* Kiirmenüü tagasinool ja Esc: esimene vajutus peetakse kinni ja leht näitab põhjust, teine lahkub. */
    assert.equal(panelLeaveAllowed('back'), false);
    assert.deepEqual(asked, ['ask']);
    clock += 1000;
    assert.equal(panelLeaveAllowed('back'), true);
    assert.deepEqual(asked, ['ask', 'clear']);
    clock += 1000;
    assert.equal(panelLeaveAllowed('back'), false, 'värav on endiselt peal');
  } finally {
    disarm();
  }
  /* Maha võetud: paneelist saab lahkuda, akna kuulaja on läinud ja pooleli küsimus on lehelt ära võetud. */
  assert.equal(panelLeaveAllowed('back'), true);
  assert.equal(listeners.size, 0);
  assert.equal(asked.at(-1), 'clear');
  /* Leht paneb värava peale ainult siis, kui seda on vaja, ja võtab maha, kui enam ei ole. */
  const source = read('components/benefits/SubsistenceCalculator.jsx');
  assert.ok(source.includes('const guarded = leaveGuarded(status, state);'));
  assert.ok(/useEffect\(\(\) => \{\s*if \(!guarded\) return undefined;[\s\S]*?return armLeaveGuard\(\{ leave, register: setPanelLeaveGuard, target: window \}\);\s*\}, \[guarded\]\);/.test(source));
  assert.ok(source.includes('t("subsistence.leave_asked")') && source.includes('scrollIntoView'));
  assert.ok(source.includes('setLeaveAsked(true);') && source.includes('onClear: () => setLeaveAsked(false)'));
  /* Kui väljad lähevad ekraanilt, võetakse loetamatu teksti märgid maha. */
  assert.ok(source.includes('useEffect(() => () => dispatch({ type: "fieldsGone" }), [dispatch]);'));
  /* Lehe olek ja selle muutmine on ühes kohas ja vaated saavad just selle. Neid ridu (ja kahte efekti ülal) hoiab
     lähtetekst, mitte käitumine: serveripoolne joonistus efekte ei käivita ega saa lehe enda olekut muuta. Kõik
     muu selles failis on läbi vajutatud testis `subsistence-calculator-render.test.mjs`. */
  assert.ok(source.includes('const [state, dispatch] = useReducer(pageReducer, EMPTY_STATE);'));
  assert.ok(source.includes('return <SubsistenceViews state={state} dispatch={dispatch} leaveAsked={leaveAsked} leaveRef={leaveRef} />;'));
});

/* --- Tekstid ----------------------------------------------------------------------------- */

test('iga lehe tekst on kataloogis kolmes keeles', () => {
  const sources = ['components/benefits/SubsistenceCalculator.jsx', 'components/benefits/subsistenceSteps.js'].map(read).join('\n');
  /* Sõna-sõnalt kirjutatud võtmed. */
  const literal = [...new Set([...sources.matchAll(/["'`](subsistence\.[A-Za-z0-9_.]+)["'`]/g)].map((match) => match[1]))].filter((key) => !key.endsWith('.'));
  assert.ok(literal.length >= 30, `leitud võtmeid: ${literal.length}`);
  /* Väärtusest kokku pandud võtmed: iga võimalik väärtus käiakse läbi. */
  const core = read('lib/benefits/subsistence.js');
  const issueCodes = [...new Set([...core.matchAll(/code: "([A-Z_]+)"/g)].map((match) => match[1]))];
  assert.ok(issueCodes.length >= 16);
  for (const code of ['UNSUPPORTED_DATE', 'DATE_UNREADABLE', 'DATE_BEFORE_CURRENT_RATE']) assert.ok(issueCodes.includes(code), code);
  const states = [{ form: FAMILY_FORM, costs: { ...FAMILY_COSTS, rent: '100', landTax: '20' }, bad: [] }, { form: SINGLE_FORM, costs: SINGLE_COSTS, bad: [] }, { form: { ...SINGLE_FORM, workIncome: '5000' }, costs: SINGLE_COSTS, bad: [] }, EMPTY_STATE];
  const drawn = states.flatMap((state) => {
    const view = pageView(state, 'et', DAY);
    return [
      ...view.steps.flatMap((step) => [step.titleKey, step.shortKey, step.summaryKey]),
      ...view.gates.flatMap((row) => [row.text, row.hint, ...(row.conditions || [])]),
      ...view.result.facts.map((fact) => fact.labelKey),
      ...view.result.sentences.flatMap((sentence) => [sentence.key, ...(sentence.costKeys || [])]),
      ...view.result.rows.flatMap((row) => [row.key, row.fieldLabelKey])
    ];
  });
  const built = [
    ...STEP_KEYS.flatMap((key) => [`subsistence.views.${key}.title`, `subsistence.views.${key}.short`]),
    ...HOUSING_COST_KEYS.map((key) => `subsistence.costs.${key}`),
    ...issueCodes.map((code) => `subsistence.issues.${code}`),
    'subsistence.issues_named.NEGATIVE_AMOUNT',
    'subsistence.issues_named.INVALID_AMOUNT',
    'subsistence.result.limit',
    'subsistence.result.housing',
    'subsistence.result.housing_declared',
    'subsistence.result.income',
    ...Object.values(VIEW_FIELDS).flat().map((field) => field.labelKey),
    ...ANSWER_CHOICES.map((choice) => choice.labelKey),
    ...gateQuestions(HOUSING_COST_KEYS).flatMap((question) => [question.text, question.hint, ...(question.conditions || [])]),
    ...drawn
  ].filter(Boolean);
  for (const lang of LANGS) {
    for (const key of [...literal, ...built]) assert.equal(typeof word(lang, key), 'string', `${lang}: ${key}`);
    for (const key of STEP_KEYS) assert.ok(word(lang, `subsistence.views.${key}.short`).length <= 18, `${lang}: lühinimi mahub kiirmenüüsse (${key})`);
    assert.ok(word(lang, 'subsistence.views.family.summary').includes('{adults}') && word(lang, 'subsistence.views.family.summary').includes('{minors}'));
    for (const code of ['NEGATIVE_AMOUNT', 'INVALID_AMOUNT']) assert.ok(word(lang, `subsistence.issues_named.${code}`).includes('{field}'), `${lang}: ${code}`);
  }
  /* Vastus, mis hinnangu peatab, ütleb ka, kuidas edasi saab, ja nimetab välja. */
  for (const [code, field] of [['RENT_FROM_FAMILY_NOT_COUNTED', 'rent'], ['HOUSING_LOAN_CONDITIONS_NOT_MET', 'housingLoan'], ['HOUSING_LOAN_MONTH_LIMIT_REACHED', 'housingLoan'], ['LAND_TAX_EXEMPT_NOT_COUNTED', 'landTax']]) {
    for (const lang of LANGS) assert.ok(word(lang, `subsistence.issues.${code}`).includes(word(lang, `subsistence.costs.${field}`)), `${lang}: ${code} nimetab välja`);
  }
  /* Seaduse ring, mitte lihtsustus (SHS § 133 lg 8 ja 9¹). Laenu võib olla võtnud ka pereliige; maksepuhkusest
     keeldumine on kirjalik; kindlustus on makseraskuste kindlustus. */
  const [borrower, holiday, insurance, residence] = LOAN_CONDITION_KEYS.map((key) => word('et', key));
  assert.ok(/pereliige/.test(borrower) && /maksepuhkus/.test(holiday) && /kirjalik/.test(holiday) && /makseraskuste kindlustus/.test(insurance) && /rahvastikuregistri/.test(residence));
  assert.ok(!/sinu nimel/.test(word('et', 'subsistence.gates.loan')));
  /* Üür: küsitakse ÜÜRNIKU lähedase kohta (leping võib olla teise pereliikme nimel) ja eraldi äriühingu kohta. */
  assert.ok(/üürniku/.test(word('et', 'subsistence.gates.landlord_relative')) && /vanavanem/.test(word('et', 'subsistence.gates.landlord_relative')));
  assert.ok(/äriühing/.test(word('et', 'subsistence.gates.landlord_company')) && /nõukogu/.test(word('et', 'subsistence.gates.landlord_company')));
  assert.ok(!/üldjuhul/.test(word('et', 'subsistence.issues.RENT_FROM_FAMILY_NOT_COUNTED')));
  /* Arvuvälja (tubade arv, pind) loetamatu sisu kohta ei öelda „summa". */
  for (const lang of LANGS) assert.ok(!/summa|amount|сумм/i.test(word(lang, 'subsistence.issues_named.INVALID_AMOUNT')), lang);
  /* Eesti tekstides ei ole mõttekriipsu ja jutumärgid on „ ”. */
  const flatten = (node) => (typeof node === 'string' ? [node] : Object.values(node || {}).flatMap(flatten));
  for (const sentence of flatten(catalogs.et.subsistence)) {
    assert.ok(!/[—–]/.test(sentence), sentence);
    assert.ok(!/"/.test(sentence), sentence);
  }
  /* Vene tekstid on kirillitsas (iga lause sisaldab kirillitsa tähti). */
  for (const sentence of flatten(catalogs.ru.subsistence)) assert.ok(/[а-яё]/i.test(sentence), sentence);
  /* Kasutamata võtmeid ei ole jäänud. */
  for (const lang of LANGS) assert.equal(word(lang, 'subsistence.section'), undefined, lang);
});

/* --- Lehe lubadused ------------------------------------------------------------------------ */

test('lehe lubadus: sisestatu ei lahku seadmest (lehe enda kuus faili)', () => {
  /* MIDA SEE LUBADUS KATAB. Ainult lehe ENDA faile: lehe fail, lehe reeglid, arvutus, määrade tabel ja kaks abifaili,
     mida leht sisestatu kõrval kasutab (lahkumise värav ja sisselogimise aadress), pluss lehe kujundusfail. Need
     failid ei tee päringut, ei salvesta ega too sisse midagi peale siin loetletu. See test EI kata ühiseid klotse,
     millele leht sisestatu joonistamiseks annab (components/stage: StepFlight, StepPanel, ChoiceRow, CheckCard;
     components/ui: Input, Button), tõlkijat (I18nProvider) ega seansi teeki (next-auth): kui keegi lisab päringu
     sinna, siis see test seda ei näe. Neid vaadatakse brauseris (päringute salvesti lehe läbivajutamisel). */
  const strip = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const PAGE = 'components/benefits/SubsistenceCalculator.jsx';
  const OWN_FILES = {
    [PAGE]: [
      'react', 'next-auth/react', '@/components/i18n/I18nProvider', '@/components/stage/CheckCard', '@/components/stage/ChoiceRow', '@/components/stage/StepFlight',
      '@/components/stage/StepPanel', '@/components/ui/Button', '@/components/ui/Input', '@/lib/panelLeaveGuard', '@/lib/safeNextPath', './subsistence.module.css', './subsistenceSteps'
    ],
    'components/benefits/subsistenceSteps.js': ['../../lib/benefits/subsistence.js'],
    'lib/benefits/subsistence.js': ['./subsistenceRates.js'],
    'lib/benefits/subsistenceRates.js': [],
    'lib/panelLeaveGuard.js': [],
    'lib/safeNextPath.js': []
  };
  /* Import igal kujul: `import x from "a"`, `import { x } from "a"`, `export … from "a"` ja kõrvalmõjuga `import "a"`. */
  const importsOf = (code) => [...code.matchAll(/\b(?:import|export)\b(?:[\s\w{},*$]*?\bfrom\b)?\s*["']([^"']+)["']/g)].map((match) => match[1]);
  /* Keelatud sõnad PALJA SÕNANA, mitte kutse kujuna: `fetch(` asemel leiab ka `const f = fetch`, `fetch?.(` ja `fetch (`. */
  const BANNED = [
    ['dünaamiline import', /\bimport\s*\(/],
    ['require', /\brequire\s*\(/],
    ['fetch', /\bfetch\b/],
    ['sendBeacon', /sendBeacon/],
    ['XMLHttpRequest', /XMLHttpRequest/],
    ['WebSocket', /WebSocket/],
    ['EventSource', /EventSource/],
    ['BroadcastChannel', /BroadcastChannel/],
    ['postMessage', /postMessage/],
    ['Image (pildi aadress kannab andmeid)', /\bImage\b/],
    ['location (assign, replace, href =)', /\blocation\b/],
    ['history', /\bhistory\b/],
    ['router', /\b(?:useRouter|router)\b/],
    ['navigator', /\bnavigator\b/],
    ['window.name', /\bwindow\s*\.\s*name\b/],
    ['caches', /\bcaches\b/],
    ['indexedDB', /indexedDB/],
    ['localStorage', /localStorage/],
    ['sessionStorage', /sessionStorage/],
    ['küpsis', /cookie/i],
    ['document', /\bdocument\b/],
    ['globalThis / self', /\b(?:globalThis|self)\b/],
    ['nurksulgudega ligipääs aknale', /\bwindow\s*\[/],
    ['open(', /\bopen\s*\(/],
    ['eval / Function', /\beval\b|\bFunction\s*\(/],
    ['seansi update (POST /api/auth/session)', /\bupdate\b/],
    ['vorm', /<form\b|\bformAction\b|\baction=["'{]/],
    ['pilt, raam või skript märgendina', /<(?:img|iframe|script|object|embed|link|video|audio|source)\b/],
    ['src=', /\bsrc\s*=/]
  ];
  /* Test testib iseennast: iga kuju, millega ülevaataja sisestatu välja viis, jääb mõne reegli taha. */
  const LEAKS = [
    'fetch("/api/x", { body })', 'const send = fetch; send(url)', 'fetch?.(url)', 'fetch (url)', "window['fetch'](url)", 'window["fetch"](url)',
    'navigator.sendBeacon(url, body)', 'new XMLHttpRequest()', 'new WebSocket(url)', 'new EventSource(url)', 'new Image().src = url', 'location.assign(url)',
    'location.href = url', 'window.location.replace(url)', 'window.name = income', 'caches.open("x")', 'indexedDB.open("x")', 'localStorage.setItem("a", income)',
    'sessionStorage.a = income', 'document.cookie = income', 'import("@/lib/telemetry")', 'require("x")', 'update({ form, costs })', '<form action="/api/x">',
    '<form action={save}>', '<img src={url} />', 'history.pushState({}, "", url)', 'router.push(url)', 'window.open(url)', 'globalThis.fetch(url)'
  ];
  for (const leak of LEAKS) assert.ok(BANNED.some(([, pattern]) => pattern.test(leak)), `test ei näe: ${leak}`);
  assert.deepEqual(importsOf('import "@/lib/telemetry";\nimport a, { b as c } from "x";\nexport * from "y";\nimport {\n  d,\n  e\n} from "z";\nexport const f = "ei ole import";'), ['@/lib/telemetry', 'x', 'y', 'z']);

  for (const [file, allowed] of Object.entries(OWN_FILES)) {
    const code = strip(read(file));
    assert.deepEqual(importsOf(code).sort(), [...allowed].sort(), `${file}: impordid`);
    for (const [name, pattern] of BANNED) assert.ok(!pattern.test(code), `leht ei saada ega salvesta sisestatut: ${name} (${file})`);
    /* Aken: lehe fail kasutab seda kahes kohas (kaadri ootamine ja lahkumise värava siht), teised failid üldse mitte. */
    const windowUses = [...code.matchAll(/\bwindow\b(?:\s*\.\s*(\w+))?/g)].map((match) => match[1] || '(ise)');
    assert.deepEqual(windowUses.sort(), file === PAGE ? ['(ise)', 'requestAnimationFrame'] : [], `${file}: akna kasutus`);
  }
  /* Lehe fail: seansist võetakse ainult olek, sisselogimise aadress on üks kindel tee ja muud linki ei ole. */
  const code = strip(read(PAGE));
  assert.ok(code.includes('const { status } = useSession();'));
  assert.equal(code.split('useSession').length - 1, 2, 'import ja üks kutse');
  assert.equal(code.split('loginHref').length - 1, 2, 'import ja üks kutse');
  assert.ok(code.includes('href={loginHref("/toimetulekutoetus")}'));
  assert.equal(code.split(/\bhref\b/).length - 1, 1, 'lehel on üks link');
  /* Lehe fail saab reeglite failist ainult selle, mis siin kirjas: arvutust, summa vormindajat ega lehe tulemust
     otse kätte ei saa, seega joonistab ta ainult seda, mida `pageView` tagastab. */
  const fromSteps = code.match(/import \{([^}]*)\} from "\.\/subsistenceSteps";/);
  assert.ok(fromSteps);
  assert.deepEqual(fromSteps[1].split(',').map((name) => name.trim()).filter(Boolean), ['ANSWER_CHOICES', 'EMPTY_STATE', 'VIEW_FIELDS', 'answerAction', 'armLeaveGuard', 'fieldAction', 'fieldValue', 'leaveGuarded', 'pageReducer', 'pageScreen', 'pageView', 'viewText']);
  /* Kujundusfail ei lae midagi võrgust. */
  const css = read('components/benefits/subsistence.module.css');
  assert.ok(!/url\(|@import/.test(css));
});

test('lehe lubadused: kaks lubadust on enne sissetulekut ja lehe nimi ei ole paneelil', () => {
  const strip = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const code = strip(read('components/benefits/SubsistenceCalculator.jsx'));
  const family = code.indexOf('case "family"');
  const income = code.indexOf('case "income"');
  const firstView = code.slice(family, income);
  assert.ok(family > 0 && income > family);
  assert.ok(firstView.includes('subsistence.not_a_decision') && firstView.includes('subsistence.stays_on_device'), 'mõlemad lubadused on esimesel vaatel');
  const source = read('components/benefits/SubsistenceCalculator.jsx');
  assert.ok(source.startsWith('"use client";'), 'leht hoiab olekut ja töötab brauseris');
  assert.ok(!source.includes('<h2') && source.includes('className="sr-only"'), 'lehe nimi on kiirmenüüs, mitte paneelil');
  /* Eelhinnangu vaade ei kirjuta sammu nime paneelile: summa avab vaate. */
  assert.ok(!source.includes('subsistence.result.title'));
  /* Teatekasti rolli ei kasutata: ühine lehekiht joonistab iga status-rolliga elemendi kastina. */
  assert.ok(!source.includes('role="status"'));
});
