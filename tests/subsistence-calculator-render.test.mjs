// Toimetulekutoetuse eelhinnang: lehe faili ÜHENDUSED käitumisena.
//
// MIKS SEE FAIL ON. Lehe varasemad vead olid ühendustes, mitte arvutuses, ja test,
// mis loeb lehe lähteteksti, neid ei näe: 10.10 murdis ülevaataja lehe failis 21
// rida ja 19 murret jättis kõik testid roheliseks (vastus „Jah" läks arvutusse
// „Ei"-na, „muu sissetuleku" väli kirjutas töise sissetuleku kohale, iga kulu väli
// kirjutas üüri kohale, keeldumise vaatesse sai joonistada summa, loetamatu sisu
// märk ei jõudnud leheni).
//
// MIDA SEE TEEB. Lehe fail (`SubsistenceCalculator.jsx`) laetakse siin päriselt ja
// joonistatakse Reactiga märgendiks. Ühised klotsid (lava, paneel, valikurida,
// märkekaart, nupp, väli), seanss ja tõlkija on asendajad
// (`helpers/subsistence-standins.mjs`), mis jätavad meelde, mida leht neile andis.
// Test „vajutab" siis välja `onInput` või valikurea `onChange`, laseb muutuse läbi
// päris `pageReducer` ja joonistab lehe uue olekuga uuesti: nii käib läbi kogu tee
// väljast olekuni, olekust arvutuseni ja arvutusest selleni, mida vaade näitab.
//
// MIDA SEE EI NÄE. Efekte (`useEffect`) serveripoolne joonistus ei käivita: lahkumise
// värava pealepanek ja märkide mahavõtmine väljade kadumisel on hoitud teises failis
// (`armLeaveGuard` käitumisena, efekti rida lähteteksti järgi) ja brauseris. Päris
// klotse, kujundust ja brauseri sündmusi see ei näe: need vajutatakse läbi brauseris.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { EMPTY_FORM, EMPTY_STATE, leaveGuarded, pageReducer } from '../components/benefits/subsistenceSteps.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fileUrl = (file) => pathToFileURL(path.join(ROOT, file)).href;
const standInsUrl = fileUrl('tests/helpers/subsistence-standins.mjs');

/* Lehe impordid: kolm päris faili, ülejäänud asendajad. Loend on sama, mis lubaduste testis kirjas. */
register(fileUrl('tests/helpers/jsx-standin-loader.mjs'), import.meta.url, {
  data: {
    standInsUrl,
    real: {
      '@/lib/panelLeaveGuard': fileUrl('lib/panelLeaveGuard.js'),
      '@/lib/safeNextPath': fileUrl('lib/safeNextPath.js'),
      './subsistenceSteps': fileUrl('components/benefits/subsistenceSteps.js')
    },
    standIns: {
      'next-auth/react': { names: ['useSession'] },
      '@/components/i18n/I18nProvider': { names: ['useI18n'] },
      '@/components/stage/CheckCard': { default: 'CheckCard' },
      '@/components/stage/ChoiceRow': { default: 'ChoiceRow' },
      '@/components/stage/StepFlight': { default: 'StepFlight' },
      '@/components/stage/StepPanel': { default: 'StepPanel' },
      '@/components/ui/Button': { default: 'Button' },
      '@/components/ui/Input': { default: 'Input' }
    }
  }
});

const { seen, reset } = await import(standInsUrl);
const { default: SubsistenceCalculator, SubsistenceViews } = await import(fileUrl('components/benefits/SubsistenceCalculator.jsx'));

const catalogs = Object.fromEntries(['et', 'en', 'ru'].map((lang) => [lang, JSON.parse(fs.readFileSync(path.join(ROOT, `messages/${lang}.json`), 'utf8'))]));
const word = (key, lang = 'et') => key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), catalogs[lang]);
const DAY = '2026-10-10';
/* React kirjutab märgendisse viis märki koodina: lause võrreldakse samal kujul. */
const html = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

/**
 * Joonistab vormi vaated antud olekuga. Tagastab märgendi, selle, mida asendajad
 * nägid, ja muutused, mille leht vajutuste peale saatis; `after()` annab oleku
 * pärast neid muutusi (päris `pageReducer`).
 */
function draw(state, { day = DAY, leaveAsked = false, lang = 'et' } = {}) {
  reset();
  seen.status = 'authenticated';
  seen.locale = lang;
  seen.messages = catalogs[lang];
  const actions = [];
  const markup = renderToStaticMarkup(createElement(SubsistenceViews, { state, dispatch: (action) => actions.push(action), day, leaveAsked }));
  const { inputs, choices, checks, flights } = seen;
  const labelIds = new Map([...markup.matchAll(/<label[^>]*for="([^"]+)"[^>]*>([^<]*)<\/label>/g)].map((match) => [match[2], match[1]]));
  return {
    markup,
    actions,
    inputs,
    choices,
    checks,
    steps: flights[0]?.steps || [],
    input: (label) => inputs.find((props) => props.id === labelIds.get(html(label))),
    choice: (label) => choices.find((props) => props.label === label),
    section: (key) => (markup.match(new RegExp(`<section data-step="${key}">([\\s\\S]*?)</section>`)) || [])[1] || '',
    above: () => markup.slice(0, markup.indexOf('<div data-flight')),
    has: (part, sentence) => part.includes(html(sentence)),
    after: () => actions.reduce(pageReducer, state)
  };
}

/** Brauseri sündmus arvuväljalt: väärtus ja märge, kas väljal seisab loetamatu tekst. */
const typed = (value, badInput = false) => ({ target: { value, validity: { badInput } } });
/** Üks vajutus: joonista, tee, tagasta uus olek. */
const press = (state, act) => {
  const view = draw(state);
  act(view);
  return view.after();
};

/* Üks inimene, üürikorter 40 m² ja kaks tuba (sama leibkond mis arvutuse testis): hinnang 221,40 €. */
const SINGLE = {
  form: { ...EMPTY_FORM, workIncome: '120.50', otherIncome: '210.45', dwellingAreaM2: '40', rooms: '2', costsAreCurrentMonth: true, landlordIsTenantsRelative: false, landlordIsRelatedCompany: false },
  costs: { rent: '280', water: '14.20', heating: '60', electricity: '31.75', wasteRemoval: '5.90' },
  bad: []
};

/* Väljad nii, nagu inimene neid lehel näeb: vaade, välja nimi, koht olekus, kas täisarv, loetamatu märgi tunnus.
   See on kirjas siin, mitte loetud lehe väljade tabelist: tabelis vahetusse läinud rida kukutab testi. */
const FIELDS = [
  ['family', 'subsistence.fields.adults', 'form', 'adults', true, 'adults'],
  ['family', 'subsistence.fields.minors', 'form', 'minors', true, 'minors'],
  ['income', 'subsistence.fields.work_income', 'form', 'workIncome', false, 'workIncome'],
  ['income', 'subsistence.fields.other_income', 'form', 'otherIncome', false, 'otherIncome'],
  ['income', 'subsistence.fields.paid_maintenance', 'form', 'paidMaintenance', false, 'paidMaintenance'],
  ['income', 'subsistence.fields.enforcement', 'form', 'enforcementWithheld', false, 'enforcementWithheld'],
  ['housing', 'subsistence.fields.area', 'form', 'dwellingAreaM2', false, 'dwellingAreaM2'],
  ['housing', 'subsistence.fields.rooms', 'form', 'rooms', true, 'rooms'],
  ['costs', 'subsistence.costs.rent', 'costs', 'rent', false, 'cost:rent'],
  ['costs', 'subsistence.costs.buildingManagement', 'costs', 'buildingManagement', false, 'cost:buildingManagement'],
  ['costs', 'subsistence.costs.buildingRenovationLoan', 'costs', 'buildingRenovationLoan', false, 'cost:buildingRenovationLoan'],
  ['costs', 'subsistence.costs.housingLoan', 'costs', 'housingLoan', false, 'cost:housingLoan'],
  ['costs', 'subsistence.costs.landTax', 'costs', 'landTax', false, 'cost:landTax'],
  ['costs', 'subsistence.costs.buildingInsurance', 'costs', 'buildingInsurance', false, 'cost:buildingInsurance'],
  ['utilities', 'subsistence.costs.water', 'costs', 'water', false, 'cost:water'],
  ['utilities', 'subsistence.costs.hotWater', 'costs', 'hotWater', false, 'cost:hotWater'],
  ['utilities', 'subsistence.costs.heating', 'costs', 'heating', false, 'cost:heating'],
  ['utilities', 'subsistence.costs.electricity', 'costs', 'electricity', false, 'cost:electricity'],
  ['utilities', 'subsistence.costs.gas', 'costs', 'gas', false, 'cost:gas'],
  ['utilities', 'subsistence.costs.wasteRemoval', 'costs', 'wasteRemoval', false, 'cost:wasteRemoval']
];

/* Täpsustavad küsimused nii, nagu inimene neid näeb: küsimuse lause ja koht olekus. */
const QUESTIONS = [
  ['subsistence.gates.current_month', 'costsAreCurrentMonth'],
  ['subsistence.gates.landlord_relative', 'landlordIsTenantsRelative'],
  ['subsistence.gates.landlord_company', 'landlordIsRelatedCompany'],
  ['subsistence.gates.apartment', 'isApartmentBuilding'],
  ['subsistence.gates.loan', 'housingLoanConditionsMet'],
  ['subsistence.gates.loan_limit', 'housingLoanMonthLimitReached'],
  ['subsistence.gates.land_tax', 'landTaxExempt']
];
const ALL_GATED_COSTS = { rent: '100', buildingManagement: '20', housingLoan: '50', landTax: '10' };

test('leht: laadimine, sisselogimise kutse ja vorm; sisselogimata ei ole ühtegi välja', () => {
  const render = (status) => {
    reset();
    seen.status = status;
    seen.locale = 'et';
    seen.messages = catalogs.et;
    return renderToStaticMarkup(createElement(SubsistenceCalculator));
  };
  const loading = render('loading');
  assert.ok(loading.includes(html(word('subsistence.loading'))));
  assert.equal(seen.inputs.length, 0);
  assert.ok(!loading.includes('<a '));
  /* Konto on nõutav: kõik, mis ei ole sisse logitud seanss, on sisselogimise kutse kindla tagasiteega. */
  for (const status of ['unauthenticated', undefined]) {
    const login = render(status);
    assert.ok(login.includes(`<p data-part="question">${html(word('subsistence.auth_required'))}</p>`), String(status));
    assert.ok(login.includes(`<a href="/vestlus?login=1&amp;next=%2Ftoimetulekutoetus">${html(word('subsistence.actions.login'))}</a>`), String(status));
    /* Lehe nimi on ka sellel vaatel ekraanilugejale olemas (leht ja paneel). */
    assert.ok(login.startsWith(`<section class="page"><h1 class="sr-only">${html(word('subsistence.title'))}</h1><div data-panel="${html(word('subsistence.title'))}">`), String(status));
    assert.equal(seen.inputs.length, 0, 'sisselogimata ei ole ühtegi välja');
    assert.equal(seen.flights.length, 0);
  }
  /* Sisse logitud: lava seitsme vaatega ja kakskümmend arvuvälja; puutumata lehel summat ei ole. */
  const form = render('authenticated');
  assert.equal(seen.flights.length, 1);
  assert.equal(seen.flights[0].label, word('subsistence.title'));
  assert.deepEqual(seen.flights[0].steps.map((step) => step.key), ['family', 'income', 'housing', 'costs', 'utilities', 'gates', 'result']);
  assert.equal(seen.inputs.length, 20);
  /* See joonistus võtab päeva testi jooksmise päevast (leht ise päeva ette ei saa), seega ei kontrolli siin
     puudujäägi lauset: kinnitamata määraga aastal on selle asemel kuupäeva lause. Summat ei ole kummalgi juhul. */
  assert.ok(!form.includes('€'));
  assert.ok(form.includes(html(word('subsistence.result.incomplete'))));
  /* Lehe nimi on ekraanilugejale, mitte paneelil. */
  assert.ok(form.includes(`<h1 class="sr-only">${html(word('subsistence.title'))}</h1>`));
});

test('leht: iga arvuväli kirjutab oma kohale, ükskõik milline kolmest kuulajast teate toob', () => {
  const first = draw(EMPTY_STATE);
  assert.equal(first.inputs.length, FIELDS.length);
  for (const [viewKey, labelKey, group, key, whole, markId] of FIELDS) {
    const label = word(labelKey);
    const input = first.input(label);
    assert.ok(input, `väli on lehel: ${label}`);
    assert.ok(first.has(first.section(viewKey), label), `väli on oma vaates: ${label}`);
    assert.equal(input.type, 'number', label);
    assert.equal(input.min, '0', label);
    assert.equal(input.inputMode, whole ? 'numeric' : 'decimal', label);
    /* Välja laius: arvu väli (pereliikmed, pind, toad) on kitsam kui summa väli. */
    const size = whole || key === 'dwellingAreaM2' ? 'count' : 'sum';
    assert.ok(first.markup.includes(`<div class="field" data-size="${size}"><label class="fieldLabel" for="${input.id}">${html(label)}</label>`), `${label}: ${size}`);
    assert.equal(input.value, EMPTY_STATE[group][key] ?? '', label);
    /* Loetav arv: `onChange` (React, kui väärtus muutus), `onInput` (brauser, igal sisestusel) ja `onBlur`
       (fookuse lahkumisel) toovad sama teate ja see läheb täpselt selle välja kohale. */
    const expected = whole ? '7' : '7.5';
    for (const handler of ['onChange', 'onInput', 'onBlur']) {
      assert.equal(typeof input[handler], 'function', `${label}: ${handler}`);
      const next = press(EMPTY_STATE, (view) => view.input(label)[handler](typed('7.5')));
      assert.deepEqual(next, { ...EMPTY_STATE, [group]: { ...EMPTY_STATE[group], [key]: expected } }, `${label}: ${handler}`);
      /* Uuesti joonistades näitab SEE väli seda arvu ja ükski teine väli ei muutunud. */
      const redrawn = draw(next);
      assert.equal(redrawn.input(label).value, expected, label);
      assert.equal(redrawn.inputs.filter((props, index) => props.value !== first.inputs[index].value).length, 1, label);
      /* Kustutamine: väli on jälle tühi ja arv ei jää olekusse alles. */
      const erased = press(next, (view) => view.input(label)[handler](typed('')));
      assert.equal(erased[group][key], '', `${label}: ${handler} kustutab`);
      assert.equal(draw(erased).input(label).value, '', label);
    }
    /* Loetamatu tekst: väärtus on tühi sõne ja muutub ainult brauseri märge; teate toob `onInput` või `onBlur`.
       Leht märgib välja, keeldub ja nimetab välja SAMA nimega, mis välja kohal seisab. */
    for (const handler of ['onInput', 'onBlur']) {
      const marked = press(EMPTY_STATE, (view) => view.input(label)[handler](typed('', true)));
      assert.deepEqual(marked.bad, [markId], `${label}: ${handler}`);
      const refused = draw(marked);
      const result = refused.section('result');
      assert.ok(refused.has(result, `„${label}”: kontrolli sisestatut.`), `${label}: puudujäägi rida nimetab välja`);
      assert.ok(!result.includes('€'), label);
      assert.equal(refused.steps.at(-1).summary, undefined, label);
      /* Kustutamine: väärtus on endiselt tühi sõne, märge kadus. Märk läheb maha. */
      const cleared = press(marked, (view) => view.input(label).onInput(typed('', false)));
      assert.deepEqual(cleared.bad, [], label);
      assert.ok(!draw(cleared).has(draw(cleared).section('result'), `„${label}”: kontrolli sisestatut.`), label);
    }
  }
  /* Välja kuju tuleb väljade tabelist: täisarv sammuga 1, pind sammuga 0,1 ja laega 1000, summa laega 1 000 000. */
  assert.deepEqual(['step', 'max'].map((name) => first.input(word('subsistence.fields.rooms'))[name]), ['1', '99']);
  assert.deepEqual(['step', 'max'].map((name) => first.input(word('subsistence.fields.area'))[name]), ['0.1', '1000']);
  assert.deepEqual(['step', 'max'].map((name) => first.input(word('subsistence.costs.rent'))[name]), ['0.01', '1000000']);
  /* Selgitus on välja küljes: pere väljadel pere selgitus, sissetuleku kahel esimesel nulli reegel, tubadel tubade reegel. */
  const described = (label) => {
    const id = first.input(word(label))['aria-describedby'];
    return id ? (first.markup.match(new RegExp(`<p class="hint" id="${id}">([^<]*)</p>`)) || [])[1] : undefined;
  };
  assert.equal(described('subsistence.fields.adults'), html(word('subsistence.hints.family')));
  assert.equal(described('subsistence.fields.minors'), html(word('subsistence.hints.family')));
  assert.ok(described('subsistence.fields.work_income').startsWith(html(word('subsistence.hints.zero_income'))));
  assert.ok(described('subsistence.fields.other_income').endsWith(html(word('subsistence.hints.excluded_income'))));
  assert.equal(described('subsistence.fields.rooms'), html(word('subsistence.hints.rooms')));
  assert.equal(described('subsistence.fields.paid_maintenance'), undefined);
  assert.equal(described('subsistence.costs.rent'), undefined);
});

test('leht: tühjale kulu väljale kleebitud „280,-" ei anna enam summat ilma selle kuluta', () => {
  /* Ülevaataja juht läbi lehe: üks inimene, kõik sisestatud peale üüri; leht näitab 0,00 €. */
  const { rent: _rent, ...withoutRent } = SINGLE.costs;
  const before = { ...SINGLE, costs: withoutRent };
  const rentLabel = word('subsistence.costs.rent');
  assert.ok(draw(before).section('result').includes('<p class="amount">0,00 €</p>'));
  /* Kleepimine: välja väärtus on enne ja pärast tühi sõne, seega Reacti `onChange` EI tule. Tuleb ainult `onInput`. */
  const pasted = press(before, (view) => view.input(rentLabel).onInput(typed('', true)));
  const refused = draw(pasted);
  assert.ok(refused.has(refused.section('result'), '„Üür”: kontrolli sisestatut.'));
  assert.ok(!refused.section('result').includes('€') && !refused.section('result').includes('class="amount"'));
  assert.equal(refused.steps.at(-1).summary, undefined, 'kiirmenüüs ja plaadil summat ei ole');
  assert.equal(refused.steps.at(-1).state, 'empty');
  /* Väli ise on endiselt tühja väärtusega (tekst seisab brauseris väljal): leht ei kirjuta seda üle. */
  assert.equal(refused.input(rentLabel).value, '');
  /* Vali kõik ja kustuta: jälle ainult `onInput`. Märk läheb maha ja endine tulemus on tagasi. */
  const cleared = press(pasted, (view) => view.input(rentLabel).onInput(typed('', false)));
  assert.deepEqual(cleared, before);
  assert.ok(draw(cleared).section('result').includes('<p class="amount">0,00 €</p>'));
  /* Loetav summa: hinnang koos üüriga. */
  const withRent = press(pasted, (view) => view.input(rentLabel).onInput(typed('280')));
  assert.ok(draw(withRent).section('result').includes('<p class="amount">221,40 €</p>'));
  /* Puutumata lehel „2e" tubade väljal ja siis tühjaks: märk ei jää rippuma ja lahkumine ei küsi. */
  const roomsLabel = word('subsistence.fields.rooms');
  const odd = press(EMPTY_STATE, (view) => view.input(roomsLabel).onInput(typed('', true)));
  assert.equal(leaveGuarded('authenticated', odd), true);
  const again = press(odd, (view) => view.input(roomsLabel).onInput(typed('', false)));
  assert.deepEqual(again, EMPTY_STATE);
  assert.equal(leaveGuarded('authenticated', again), false);
});

test('leht: täpsustav küsimus näitab antud vastust ja „Jah" läheb olekusse tõesena', () => {
  const asking = { form: { ...EMPTY_FORM, workIncome: '0', dwellingAreaM2: '30', rooms: '2' }, costs: ALL_GATED_COSTS, bad: [] };
  const first = draw(asking);
  assert.deepEqual(first.choices.map((props) => props.label), QUESTIONS.map(([textKey]) => word(textKey)), 'küsimused seaduse järjekorras');
  for (const [textKey, field] of QUESTIONS) {
    const label = word(textKey);
    const row = first.choice(label);
    assert.equal(row.value, '', `vastamata: ${field}`);
    assert.deepEqual(row.options, [{ value: 'yes', label: 'Jah' }, { value: 'no', label: 'Ei' }], field);
    assert.equal(row.layout, 'scale');
    /* „Jah": olekus tõene, ainult see väli; uuesti joonistades on märgitud „Jah", mitte „Ei". */
    const yes = press(asking, (view) => view.choice(label).onChange('yes'));
    assert.deepEqual(yes, { ...asking, form: { ...asking.form, [field]: true } }, field);
    const drawnYes = draw(yes);
    assert.equal(drawnYes.choice(label).value, 'yes', field);
    assert.ok(drawnYes.section('gates').includes(`<div role="radiogroup" aria-label="${html(label)}" data-layout="scale"><button type="button" role="radio" aria-checked="true">Jah</button><button type="button" role="radio" aria-checked="false">Ei</button></div>`), field);
    assert.equal(drawnYes.choices.filter((props) => props.value !== '').length, 1, 'teised küsimused jäid vastamata');
    /* „Ei": olekus väär. */
    const no = press(yes, (view) => view.choice(label).onChange('no'));
    assert.equal(no.form[field], false, field);
    assert.equal(draw(no).choice(label).value, 'no', field);
  }
  /* Eluasemelaenu neli tingimust seisavad loendina küsimuse EES, seaduse järjekorras. */
  const gates = first.section('gates');
  const conditions = ['borrower', 'holiday', 'insurance', 'residence'].map((name) => `<li>${html(word(`subsistence.loan_conditions.${name}`))}</li>`).join('');
  assert.ok(gates.includes(`<ol class="conditions"`) && gates.includes(conditions));
  assert.ok(gates.indexOf(conditions) < gates.indexOf(`aria-label="${html(word('subsistence.gates.loan'))}"`));
  /* Loend on küsimuse rühma kirjeldus (ekraanilugeja loeb tingimused küsimuse juurde); teistel rühmadel kirjeldust ei ole. */
  const listId = (gates.match(/<ol class="conditions" id="([^"]+)">/) || [])[1];
  assert.ok(listId && gates.includes(`<div class="gate" role="group" aria-describedby="${listId}"><ol class="conditions" id="${listId}">`));
  assert.equal(gates.split('<div class="gate" role="group">').length - 1, QUESTIONS.length - 1);
  /* Selgitused küsimuse all. */
  assert.ok(first.has(gates, word('subsistence.hints.current_month')) && first.has(gates, word('subsistence.hints.land_tax')));
  /* Üle nelja küsimuse: täpsustuste vaade on vabalt keriv; kuni nelja juures mitte. */
  assert.deepEqual(first.steps.filter((step) => step.free).map((step) => step.key), ['gates']);
  assert.deepEqual(draw(SINGLE).steps.filter((step) => step.free), []);

  /* Vastus jõuab arvutuseni: üürileandja küsimusele „Jah" peatab hinnangu, „Ei" toob summa tagasi. */
  const relative = word('subsistence.gates.landlord_relative');
  const blocked = press(SINGLE, (view) => view.choice(relative).onChange('yes'));
  const refused = draw(blocked);
  assert.ok(refused.has(refused.section('result'), word('subsistence.issues.RENT_FROM_FAMILY_NOT_COUNTED')));
  assert.ok(!refused.section('result').includes('€'));
  const allowed = press(blocked, (view) => view.choice(relative).onChange('no'));
  assert.ok(draw(allowed).section('result').includes('<p class="amount">221,40 €</p>'));
  /* Jooksva kuu küsimusele „Ei" on vastus oma lausega. */
  const notNow = press(SINGLE, (view) => view.choice(word('subsistence.gates.current_month')).onChange('no'));
  assert.ok(draw(notNow).has(draw(notNow).section('result'), word('subsistence.issues.COSTS_NOT_CURRENT_MONTH')));

  /* Ilma kuludeta (ja nulliga kulu väljal) küsimusi ei ole ja vaade ütleb seda. */
  for (const costs of [{}, { rent: '0' }, { rent: '' }]) {
    const none = draw({ ...asking, costs });
    assert.equal(none.choices.length, 0);
    assert.ok(none.has(none.section('gates'), word('subsistence.views.gates.none')));
  }
  assert.ok(!first.has(gates, word('subsistence.views.gates.none')));
  /* Üks kulu toob ainult oma küsimused. */
  assert.deepEqual(draw({ ...asking, costs: { water: '20' } }).choices.map((props) => props.label), [word('subsistence.gates.current_month')]);
});

test('leht: märge „elan üksi" on ainult ühe pereliikmega ja näitab oleku seisu', () => {
  const one = draw(EMPTY_STATE);
  assert.equal(one.checks.length, 1);
  assert.equal(one.checks[0].title, word('subsistence.fields.single_occupant'));
  assert.equal(one.checks[0].checked, false);
  assert.ok(one.section('housing').includes('role="checkbox" aria-checked="false"'));
  const marked = press(EMPTY_STATE, (view) => view.checks[0].onChange(true));
  assert.deepEqual(marked, { ...EMPTY_STATE, form: { ...EMPTY_FORM, singleOccupantExtendedNorm: true } });
  assert.equal(draw(marked).checks[0].checked, true);
  assert.ok(draw(marked).section('housing').includes('role="checkbox" aria-checked="true"'));
  assert.equal(press(marked, (view) => view.checks[0].onChange(false)).form.singleOccupantExtendedNorm, false);
  /* Märge jõuab arvutuseni: 40 m² üürikorteris kaob kärbe (221,40 € asemel 280,90 €). */
  const lifted = press(SINGLE, (view) => view.checks[0].onChange(true));
  assert.ok(draw(lifted).section('result').includes('<p class="amount">280,90 €</p>'));
  /* Kahe pereliikmega (ja ilma pereliikmeta) märget ei pakuta. */
  for (const [adults, minors] of [['2', '0'], ['1', '1'], ['0', '0'], ['', '']]) {
    assert.equal(draw({ ...EMPTY_STATE, form: { ...EMPTY_FORM, adults, minors } }).checks.length, 0, `${adults}+${minors}`);
  }
});

test('leht: eelhinnangu vaade joonistab summa, faktid ja laused; keeldumise vaates ei ole ühtegi summat', () => {
  const single = draw(SINGLE);
  const result = single.section('result');
  /* Suur arv on hinnang, mitte kulude plaadi summa (280,00 €) ega mõni fakt. Muutuv tulemus on teatatav ala. */
  assert.ok(result.includes('<div class="stack" aria-live="polite"><p class="amount">221,40 €</p>'));
  assert.equal(result.split('class="amount"').length - 1, 1);
  /* Faktid: toimetulekupiir koos määra aastaga, sisestatud ja arvesse minev eluasemekulu, sissetulek. */
  const facts = [...result.matchAll(/<dt class="factLabel">([^<]*)<\/dt><dd class="factValue">([^<]*)<\/dd>/g)].map((match) => [match[1], match[2]]);
  assert.deepEqual(facts, [
    ['Pere toimetulekupiir (2026. aasta määr)', '220,00 €'],
    ['Sisestatud eluasemekulu', '391,85 €'],
    ['Arvesse minev eluasemekulu', '332,35 €'],
    ['Arvesse minev sissetulek', '330,95 €']
  ]);
  /* Miks arvesse läks vähem (vaikne lause) ja omavalitsuse piirmäärade hoiatus (rõhutatud lause). */
  assert.ok(result.includes(`<p class="quiet">${html('Eluruum (40 m²) on normpinnast (33 m²) suurem. Selles eelhinnangus läks arvesse umbes 82,5% nendest kuludest: „Üür”, „Küte”.')}</p>`));
  assert.ok(result.includes(`<p class="caveat">${html(word('subsistence.caveat.kov_limits'))}</p>`));
  assert.ok(!single.has(result, word('subsistence.caveat.above_line')));
  /* Vaate all seisab, et see ei ole otsus; sammu nime paneelil ei korrata; puudujäägi pealkirja ei ole. */
  assert.ok(result.includes(`<p data-part="note">${html(word('subsistence.not_a_decision'))}</p>`));
  assert.ok(!single.has(result, word('subsistence.result.incomplete')) && !result.includes('class="issue"'));
  assert.equal(single.steps.at(-1).summary, '221,40 €');
  assert.equal(single.steps.at(-1).state, 'done');
  /* Toetust ei tuleks: null koos vaikse lausega, piirmäärade hoiatust ei ole. */
  const above = draw({ ...SINGLE, form: { ...SINGLE.form, workIncome: '5000' } });
  assert.ok(above.section('result').includes('<p class="amount">0,00 €</p>'));
  assert.ok(above.section('result').includes(`<p class="quiet">${html(word('subsistence.caveat.above_line'))}</p>`));
  assert.ok(!above.has(above.section('result'), word('subsistence.caveat.kov_limits')));
  /* Lehe keel: inglise keeles punkt kümnendmärgina ja inglise laused. */
  const english = draw(SINGLE, { lang: 'en' });
  assert.ok(english.section('result').includes('<p class="amount">221.40 €</p>'));
  assert.ok(english.has(english.section('result'), 'Family subsistence limit (2026 rate)'));
  assert.ok(english.has(english.section('result'), '“Rent”, “Heating”'));

  /* Keeldumine: pealkiri ja read. Vaates ei ole ühtegi eurot, summa kohta, fakti ega põhjuse lauset, kuigi kulud
     on sisestatud ja plaatidel on nende summad. */
  for (const [state, sentences] of [
    [{ ...SINGLE, form: { ...SINGLE.form, workIncome: '', otherIncome: '' } }, [word('subsistence.issues.INCOME_REQUIRED')]],
    [{ ...SINGLE, form: { ...SINGLE.form, rooms: '0' } }, [word('subsistence.issues.ROOM_COUNT_REQUIRED')]],
    [{ ...SINGLE, form: { ...SINGLE.form, dwellingAreaM2: '100000' } }, ['„Eluruumi üldpind (m²)”: kontrolli sisestatut.']],
    [{ ...SINGLE, form: { ...SINGLE.form, workIncome: '-5' }, costs: { ...SINGLE.costs, water: '1000001' } }, ['„Vesi ja kanalisatsioon”: kontrolli sisestatut.', '„Töine sissetulek (netos)”: summa ei saa olla negatiivne.']],
    [{ ...SINGLE, form: { ...SINGLE.form, landlordIsRelatedCompany: null } }, [word('subsistence.issues.GATE_UNANSWERED')]]
  ]) {
    const refused = draw(state);
    const view = refused.section('result');
    assert.ok(view.includes(`<p data-part="question">${html(word('subsistence.result.incomplete'))}</p>`));
    assert.ok(view.includes('<ul class="issues" aria-live="polite">'));
    const rows = [...view.matchAll(/<li class="issue">([^<]*)<\/li>/g)].map((match) => match[1]);
    assert.deepEqual(rows, sentences.map(html));
    assert.ok(!view.includes('€') && !view.includes('class="amount"') && !view.includes('<dl') && !view.includes('class="caveat"') && !view.includes('class="quiet"'), sentences[0]);
    assert.ok(!refused.has(view, word('subsistence.not_a_decision')), 'keeldumise vaatel ei ole summa juurde käivat märkust');
    assert.equal(refused.steps.at(-1).summary, undefined);
    assert.equal(refused.steps.find((step) => step.key === 'costs').summary, '280,00 €', 'kulude plaadil on oma summa endiselt');
  }
});

test('leht: sammud, lubadused ja teated lava kohal', () => {
  const view = draw(SINGLE);
  /* Sammud lavale: nimi ja lühinimi kataloogist, seis ja kokkuvõte lehe reeglitest. */
  assert.deepEqual(view.steps.map((step) => [step.key, step.label, step.short, step.state, step.summary]), [
    ['family', 'Pere', 'Pere', 'done', 'Täisealisi 1, alaealisi 0'],
    ['income', 'Eelmise kuu sissetulek', 'Sissetulek', 'done', undefined],
    ['housing', 'Eluase', 'Eluase', 'done', undefined],
    ['costs', 'Eluaseme kulud', 'Kulud', 'done', '280,00 €'],
    ['utilities', 'Kommunaalkulud', 'Kommunaal', 'done', '111,85 €'],
    ['gates', 'Täpsustused', 'Täpsustused', 'done', undefined],
    ['result', 'Eelhinnang', 'Eelhinnang', 'done', '221,40 €']
  ]);
  /* Kaks lubadust on esimesel vaatel enne ühtegi välja; sissetuleku vaate all on teine neist veel kord. */
  const family = view.section('family');
  assert.ok(family.includes(`<p data-part="question">${html(word('subsistence.not_a_decision'))}</p><p data-part="lead">${html(word('subsistence.stays_on_device'))}</p>`));
  assert.ok(family.indexOf('data-part="lead"') < family.indexOf('<input'));
  assert.ok(view.section('income').includes(`<p data-part="note">${html(word('subsistence.stays_on_device'))}</p>`));
  /* Vaadete küsimused ja kulude vaadete märkus. */
  for (const key of ['income', 'housing', 'costs', 'utilities']) assert.ok(view.section(key).includes(`<p data-part="question">${html(word(`subsistence.views.${key}.question`))}</p>`), key);
  for (const key of ['costs', 'utilities']) assert.ok(view.section(key).includes(`<p data-part="note">${html(word('subsistence.views.costs.note'))}</p>`), key);
  /* Tavalisel päeval lava kohal teadet ei ole. */
  assert.ok(!view.above().includes('class="leave"'));
  /* Lahkumise küsimus: lava kohal, teatena. */
  const asked = draw(SINGLE, { leaveAsked: true });
  assert.ok(asked.above().includes(`<p class="leave" role="alert">${html(word('subsistence.leave_asked'))}</p>`));
  /* Kuupäeva puudujääk: lava kohal kohe, oma lausega, ja eelhinnangu vaates ainsa reana. */
  for (const [day, code] of [['2027-01-15', 'UNSUPPORTED_DATE'], ['2025-06-15', 'DATE_BEFORE_CURRENT_RATE'], [new Date(Number.NaN), 'DATE_UNREADABLE']]) {
    const dated = draw(SINGLE, { day });
    const sentence = html(word(`subsistence.issues.${code}`));
    assert.ok(dated.above().includes(`<p class="leave">${sentence}</p>`), code);
    assert.deepEqual([...dated.section('result').matchAll(/<li class="issue">([^<]*)<\/li>/g)].map((match) => match[1]), [sentence], code);
    assert.ok(!dated.section('result').includes('€'), code);
    assert.equal(dated.steps.at(-1).summary, undefined, code);
  }
});
