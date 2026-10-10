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
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  COST_GROUPS,
  EMPTY_FORM,
  STEP_KEYS,
  costFieldId,
  declaredCostKeys,
  estimateInput,
  euro,
  formTouched,
  gateQuestions,
  housingReason,
  issueFieldLabelKey,
  issueRows,
  pageEstimate,
  plainNumber,
  rateMissing,
  resultFacts,
  resultNote,
  stepStates,
  stepSummaries,
  wholeCount
} from '../components/benefits/subsistenceSteps.js';
import { estimateSubsistenceBenefit } from '../lib/benefits/subsistence.js';
import { HOUSING_COST_KEYS, HOUSING_COST_KINDS, resolveSubsistenceRates } from '../lib/benefits/subsistenceRates.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const LANGS = ['et', 'en', 'ru'];
const catalogs = Object.fromEntries(LANGS.map((lang) => [lang, JSON.parse(read(`messages/${lang}.json`))]));
const word = (lang, key) => key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), catalogs[lang]);
const codes = (result) => result.issues.map((issue) => issue.code);
const DAY = '2026-10-10';

/* Üks inimene, üürikorter 40 m² ja kaks tuba: normpind 33 m², üür ja küte lähevad arvesse suhtega 33/40. */
const SINGLE_FORM = { ...EMPTY_FORM, workIncome: '120.50', otherIncome: '210.45', dwellingAreaM2: '40', rooms: '2', costsAreCurrentMonth: true, landlordIsFamilyOrTheirCompany: false };
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
    ['costsAreCurrentMonth', 'landlordIsFamilyOrTheirCompany', 'isApartmentBuilding', 'housingLoanConditionsMet', 'housingLoanMonthLimitReached', 'landTaxExempt']
  );
  /* Iga kulu, millel on arvutuses värav, toob oma küsimuse; eluasemelaen kaks (tingimused ja kuue kuu piir). */
  const gated = HOUSING_COST_KINDS.filter((item) => item.gate).map((item) => item.key);
  assert.deepEqual(gated.sort(), ['buildingManagement', 'buildingRenovationLoan', 'housingLoan', 'landTax', 'rent']);
  for (const key of gated) assert.equal(gateQuestions([key]).length, key === 'housingLoan' ? 3 : 2, key);
  /* Iga väli, mille kohta arvutus ütleb „vastamata", on küsimusena olemas ja läheb lehelt arvutusse. */
  const core = read('lib/benefits/subsistence.js');
  const gateFields = [...new Set([...core.matchAll(/field: "gates\.([A-Za-z]+)"/g)].map((match) => match[1]))];
  const asked = gateQuestions(HOUSING_COST_KEYS).map((question) => question.field);
  assert.equal(gateFields.length, 6);
  for (const field of gateFields) {
    assert.ok(asked.includes(field), field);
    assert.ok(field in estimateInput(EMPTY_FORM, {}).gates, `leht annab arvutusele: ${field}`);
    assert.ok(field in EMPTY_FORM, `vormis on koht: ${field}`);
  }
});

test('sisestamata või nulliga kulu ei ole sisestatud kulu', () => {
  assert.deepEqual(declaredCostKeys({ rent: '250', water: '', gas: '0', heating: '-3', electricity: 'abc' }), ['rent']);
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
  assert.equal(stepStates({ costsAreCurrentMonth: false, landlordIsFamilyOrTheirCompany: false }, { rent: '300' }).gates, 'done');
  /* Ainult mahaarvamine ei ole sissetulek: samm ei ole valmis, sest arvutus keeldub. */
  assert.equal(stepStates({ adults: '1', paidMaintenance: '50' }, {}).income, 'partial');
  assert.equal(stepStates({ adults: '1', enforcementWithheld: '0' }, {}).income, 'partial');
  assert.equal(stepStates({ adults: '1', otherIncome: '0' }, {}).income, 'done');
  /* Pere samm ei ole valmis ilma täisealiseta. */
  assert.equal(stepStates({ adults: '', minors: '2' }, {}).family, 'partial');
  assert.equal(stepStates({ adults: '0', minors: '2' }, {}).family, 'partial');
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

test('arvutus: ilma täisealiseta pere kohta summat ei anta', () => {
  assert.deepEqual(codes(page({ ...EMPTY_FORM, adults: '', minors: '2', workIncome: '0' })), ['ADULT_REQUIRED']);
  assert.deepEqual(codes(page({ ...EMPTY_FORM, adults: '0', minors: '1', workIncome: '0' })), ['ADULT_REQUIRED']);
  assert.deepEqual(codes(page({ ...EMPTY_FORM, adults: '0', minors: '0', workIncome: '0' })), ['NO_FAMILY_MEMBERS']);
  assert.equal(page({ ...EMPTY_FORM, adults: '1', minors: '2', workIncome: '0' }).estimate, 748);
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
  /* Üür (SHS § 133 lg 8). */
  assert.deepEqual(codes(page({ ...SINGLE_FORM, landlordIsFamilyOrTheirCompany: true }, SINGLE_COSTS)), ['RENT_FROM_FAMILY_NOT_COUNTED']);
  assert.deepEqual(codes(page({ ...SINGLE_FORM, landlordIsFamilyOrTheirCompany: null }, SINGLE_COSTS)), ['GATE_UNANSWERED']);
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
  const big = { adults: 1, workIncome: 0, dwellingAreaM2: 40, housingCosts: { rent: 300 }, gates: { costsAreCurrentMonth: true, landlordIsFamilyOrTheirCompany: false }, effectiveDate: DAY };
  assert.deepEqual(codes(estimateSubsistenceBenefit({ ...big, rooms: '' })), ['ROOM_COUNT_REQUIRED']);
  assert.deepEqual(codes(estimateSubsistenceBenefit({ ...big, rooms: null })), ['ROOM_COUNT_REQUIRED']);
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
});

test('arvutus: määr kehtib Eesti kalendri järgi ja kinnitamata aasta kohta summat ei anta', () => {
  assert.equal(resolveSubsistenceRates('2026-12-31').exact, true);
  assert.equal(resolveSubsistenceRates('2027-01-01').exact, false);
  /* Aastavahetus Eesti aja järgi: 31.12 kell 23.30 on veel see aasta, 1.01 kell 00.30 enam mitte. */
  assert.equal(resolveSubsistenceRates(new Date('2026-12-31T21:30:00Z')).exact, true);
  assert.equal(resolveSubsistenceRates(new Date('2026-12-31T22:30:00Z')).exact, false);
  assert.equal(resolveSubsistenceRates(new Date(Number.NaN)).exact, false);
  assert.equal(resolveSubsistenceRates(new Date(Number.NaN)).reason, 'INVALID_DATE');
  const next = pageEstimate({ ...EMPTY_FORM }, {}, [], '2027-01-15');
  assert.equal(next.usable, false);
  assert.ok(rateMissing(next));
  /* Miski, mida inimene sisestab, seda ei muuda: lehel on see ainus rida. */
  assert.deepEqual(issueRows(next.issues), [{ code: 'UNSUPPORTED_DATE', fieldLabelKey: '' }]);
  assert.equal(rateMissing(page(EMPTY_FORM)), false);
});

/* --- Leht: mis läheb arvutusse ja mida tulemuse kohta öeldakse ------------------------- */

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
  /* Loetamatu väli on ka sisestus: lahkumine küsib. */
  assert.equal(formTouched(EMPTY_FORM, {}, ['rooms']), true);
  /* Lehe arvuväli ütleb loetamatu sisu lehele edasi. */
  const source = read('components/benefits/SubsistenceCalculator.jsx');
  assert.ok(source.includes('const unreadable = event.target.validity?.badInput === true;'));
  assert.ok(source.includes('pageEstimate(form, costs, bad)'), 'tulemus tuleb ühest testitud funktsioonist');
  assert.ok(!source.includes('estimateSubsistenceBenefit'), 'leht ise arvutuse sisendit kokku ei pane');
});

test('leht: vastused lähevad arvutusse sellisena, nagu inimene need andis', () => {
  const input = estimateInput({ ...FAMILY_FORM, costsAreCurrentMonth: false, landTaxExempt: true }, FAMILY_COSTS);
  assert.equal(input.gates.costsAreCurrentMonth, false);
  assert.equal(input.gates.housingLoanMonthLimitReached, false);
  assert.equal(input.gates.landTaxExempt, true);
  assert.equal(input.gates.landlordIsFamilyOrTheirCompany, null);
  assert.equal(input.workIncome, '1180.40');
  assert.equal(input.rooms, '3');
  assert.equal(estimateInput({ ...EMPTY_FORM, rooms: '' }).rooms, null);
  assert.deepEqual(Object.keys(input.housingCosts).sort(), Object.keys(FAMILY_COSTS).sort());
  assert.ok(Number.isNaN(estimateInput(EMPTY_FORM, {}, ['otherIncome']).otherIncome));
  /* Üksi elava inimese märge: mitme pereliikmega arvutus seda ei kasuta, ka siis, kui see jäi sisse. */
  assert.equal(page({ ...FAMILY_FORM, singleOccupantExtendedNorm: true }, FAMILY_COSTS).estimate, 358.5);
});

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
    { key: 'limit', value: '220,00 €' },
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
});

test('leht: lause tulemuse all ja plaatide kokkuvõtted', () => {
  assert.equal(resultNote(page(SINGLE_FORM, SINGLE_COSTS)), 'kov_limits');
  assert.equal(resultNote(page({ ...EMPTY_FORM, workIncome: '0' })), '', 'ilma eluasemekuludeta piirmäärade hoiatust ei ole');
  assert.equal(resultNote(page({ ...SINGLE_FORM, workIncome: '5000' }, SINGLE_COSTS)), 'above_line', 'kui toetust ei tuleks, ei öelda, et summa võib olla väiksem');
  assert.equal(resultNote(page(EMPTY_FORM)), '');
  const family = page(FAMILY_FORM, FAMILY_COSTS);
  assert.deepEqual(stepSummaries(FAMILY_FORM, FAMILY_COSTS, family, 'et'), { family: { adults: 2, minors: 2 }, costs: '444,65 €', utilities: '240,00 €', result: '358,50 €' });
  assert.equal(stepSummaries({ ...EMPTY_FORM, adults: '1.9' }, {}, null).family.adults, 1);
});

test('leht: summa viga nimetab välja ja puudujääk ei kordu', () => {
  assert.equal(issueFieldLabelKey('housingCosts.rent'), 'subsistence.costs.rent');
  assert.equal(issueFieldLabelKey('workIncome'), 'subsistence.fields.work_income');
  assert.equal(issueFieldLabelKey('housingCosts.tundmatu'), '');
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
  const source = read('components/benefits/SubsistenceCalculator.jsx');
  /* Pereliikmete ja tubade väli on täisarv: murdosaga tubade arv lülitas kogu pinna arvestuse sisse. */
  assert.equal(source.split(' whole onChange=').length - 1, 3);
  /* Lehe värav: kiirmenüü tagasinool ja Esc küsivad seda; lõppenud seansi korral väravat ei ole. */
  assert.ok(source.includes('const guarded = status === "authenticated" && formTouched(form, costs, bad);'));
  assert.ok(source.includes('const release = setPanelLeaveGuard(leave);') && source.includes('if (!guarded) return undefined;'));
  assert.ok(source.includes('t("subsistence.leave_asked")') && source.includes('scrollIntoView'));
  /* Üksi elava inimese märget pakutakse ainult ühe pereliikmega. */
  assert.ok(source.includes('{members === 1 ? ('));
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
  assert.ok(issueCodes.length >= 14);
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
    ...gateQuestions(HOUSING_COST_KEYS).flatMap((question) => [question.text, question.hint].filter(Boolean))
  ];
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
  /* Seaduse ring, mitte lihtsustus: laenu võib olla võtnud ka pereliige; üüri küsimus nimetab sugulased ja äriühingu. */
  assert.ok(/pereliige/.test(word('et', 'subsistence.hints.loan')) && /maksepuhkus/.test(word('et', 'subsistence.hints.loan')) && /kindlustus/.test(word('et', 'subsistence.hints.loan')) && /rahvastikuregistri/.test(word('et', 'subsistence.hints.loan')));
  assert.ok(!/sinu nimel/.test(word('et', 'subsistence.gates.loan')));
  assert.ok(/vanavanem/.test(word('et', 'subsistence.gates.landlord_family')) && /äriühing/.test(word('et', 'subsistence.gates.landlord_family')));
  assert.ok(!/üldjuhul/.test(word('et', 'subsistence.issues.RENT_FROM_FAMILY_NOT_COUNTED')));
  /* Kasutamata võtmeid ei ole jäänud. */
  for (const lang of LANGS) assert.equal(word(lang, 'subsistence.section'), undefined, lang);
});

/* --- Lehe lubadused ------------------------------------------------------------------------ */

test('lehe lubadused: arvutus jääb seadmesse, kaks lubadust on enne sissetulekut', () => {
  const strip = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  /* Lehe enda neli faili: mida nad tohivad sisse tuua, on kirjas. Uus import kukutab testi, kuni keegi selle üle vaatab. */
  const ALLOWED = {
    'components/benefits/SubsistenceCalculator.jsx': [
      'react', 'next-auth/react', '@/components/i18n/I18nProvider', '@/components/stage/CheckCard', '@/components/stage/ChoiceRow', '@/components/stage/StepFlight',
      '@/components/stage/StepPanel', '@/components/ui/Button', '@/components/ui/Input', '@/lib/panelLeaveGuard', '@/lib/safeNextPath', './subsistence.module.css', './subsistenceSteps'
    ],
    'components/benefits/subsistenceSteps.js': ['../../lib/benefits/subsistence.js'],
    'lib/benefits/subsistence.js': ['./subsistenceRates.js'],
    'lib/benefits/subsistenceRates.js': []
  };
  for (const [file, allowed] of Object.entries(ALLOWED)) {
    const imports = [...read(file).matchAll(/^import\s[^;]*?from\s+["']([^"']+)["'];?$/gm)].map((match) => match[1]);
    assert.deepEqual(imports.sort(), [...allowed].sort(), `${file}: impordid`);
  }
  /* Need failid ja kaks abifaili, mida leht sisestatuga kasutab, ei saada ega salvesta midagi. */
  const BANNED = ['fetch(', 'fetch"', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource', 'BroadcastChannel', 'postMessage', 'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'history.pushState', 'history.replaceState', 'router.push(', 'router.replace('];
  for (const file of [...Object.keys(ALLOWED), 'lib/panelLeaveGuard.js', 'lib/safeNextPath.js']) {
    const source = strip(read(file));
    for (const banned of BANNED) assert.ok(!source.includes(banned), `leht ei saada ega salvesta sisestatut: ${banned} (${file})`);
  }
  const code = strip(read('components/benefits/SubsistenceCalculator.jsx'));
  const family = code.indexOf('case "family"');
  const income = code.indexOf('case "income"');
  const firstView = code.slice(family, income);
  assert.ok(family > 0 && income > family);
  assert.ok(firstView.includes('subsistence.not_a_decision') && firstView.includes('subsistence.stays_on_device'), 'mõlemad lubadused on esimesel vaatel');
  /* Summat ei näidata, kui arvutus seda ohutult anda ei saa. */
  assert.ok(code.includes('result.usable ? ('));
  const source = read('components/benefits/SubsistenceCalculator.jsx');
  assert.ok(!source.includes('<h2') && source.includes('className="sr-only"'), 'lehe nimi on kiirmenüüs, mitte paneelil');
  /* Eelhinnangu vaade ei kirjuta sammu nime paneelile: summa avab vaate. */
  assert.ok(!source.includes('subsistence.result.title'));
});
