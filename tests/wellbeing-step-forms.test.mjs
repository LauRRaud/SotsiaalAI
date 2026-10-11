// Tööheaolu sammuvormide kirjeldused ja serveri leping peavad kokku käima.
//
// Vormi kirjeldus (components/wellbeing/forms/*.js) hoiab küsimusi ja
// vastusevariante; server (lib/wellbeing/fieldSchemas.js ja töövoo arvutus)
// otsustab, mida ta vastu võtab ja kuidas hindab. Kui üks neist muutub ilma
// teiseta, saaks inimene valida vastuse, mida salvestada ei saa, või jääks
// mõni serveri väärtus vormis pakkumata.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cleanFields, emptyFields, hasValue, missingInStep } from '../components/wellbeing/forms/formState.js';
import { hardCaseForm } from '../components/wellbeing/forms/hardCaseForm.js';
import { isRowOfFour, isScale, isTableStep, stackColumns, stepWeight, STEP_WEIGHT_LIMIT } from '../components/wellbeing/forms/layout.js';
import { interruptionsForm } from '../components/wellbeing/forms/interruptionsForm.js';
import { quickCheckForm } from '../components/wellbeing/forms/quickCheckForm.js';
import { recoveryForm } from '../components/wellbeing/forms/recoveryForm.js';
import { roleBoundariesForm } from '../components/wellbeing/forms/roleBoundariesForm.js';
import { wellbeingActionRoute } from '../components/wellbeing/forms/routes.js';
import { starterSupportForm } from '../components/wellbeing/forms/starterSupportForm.js';
import { workBoundariesForm } from '../components/wellbeing/forms/workBoundariesForm.js';
import { workplaceViolenceForm } from '../components/wellbeing/forms/workplaceViolenceForm.js';
import { workProcessesForm } from '../components/wellbeing/forms/workProcessesForm.js';
import * as hardCaseData from '../components/wellbeing/forms/data/hardCaseData.js';
import * as interruptionsData from '../components/wellbeing/forms/data/interruptionsData.js';
import * as roleBoundariesData from '../components/wellbeing/forms/data/roleBoundariesData.js';
import * as starterSupportData from '../components/wellbeing/forms/data/starterSupportData.js';
import * as workBoundariesData from '../components/wellbeing/forms/data/workBoundariesData.js';
import * as workplaceViolenceData from '../components/wellbeing/forms/data/workplaceViolenceData.js';
import * as workProcessesData from '../components/wellbeing/forms/data/workProcessesData.js';
import { cleanLines } from '../components/stage/lines.js';
import { WELLBEING_FIELD_SCHEMAS, validateWellbeingStandardizedFields } from '../lib/wellbeing/fieldSchemas.js';
import { wellbeingTools } from '../lib/wellbeingTools.js';

const FORMS = [
  quickCheckForm,
  hardCaseForm,
  workplaceViolenceForm,
  recoveryForm,
  workBoundariesForm,
  interruptionsForm,
  workProcessesForm,
  roleBoundariesForm,
  starterSupportForm
];
const OLD_ROUTES = [hardCaseData, interruptionsData, roleBoundariesData, starterSupportData, workBoundariesData, workplaceViolenceData, workProcessesData];
const KINDS = ['enum', 'boolean', 'enum_list', 'text', 'text_list'];
const catalog = JSON.parse(fs.readFileSync(new URL('../messages/et.json', import.meta.url), 'utf8'));
const fieldsOf = (form) => form.steps.flatMap((step) => step.fields);
const label = (entry) => (Array.isArray(entry) ? entry[0] : entry);
const inCatalog = (key) => key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), catalog);
/** Sildi tekst nii, nagu inimene seda eesti keeles näeb. */
const text = (entry) => (Array.isArray(entry) ? inCatalog(entry[0]) || entry[1] : entry);

/** Kõik [tõlkevõti, varutekst] paarid kirjeldusest. */
function translationKeys(node, found = []) {
  if (Array.isArray(node)) {
    if (node.length === 2 && typeof node[0] === 'string' && typeof node[1] === 'string' && /^[a-z_]+(\.[a-z0-9_]+)+$/.test(node[0])) {
      found.push(node[0]);
    } else {
      for (const item of node) translationKeys(item, found);
    }
  } else if (node && typeof node === 'object') {
    for (const value of Object.values(node)) translationKeys(value, found);
  }
  return found;
}

/** Täidetud vorm: iga ühe valikuga küsimus saab `pick(field)` variandi. */
function filled(form, pick, extra = {}) {
  const fields = emptyFields(form);
  for (const field of fieldsOf(form)) {
    if (field.kind === 'enum') fields[field.key] = pick(field).value;
  }
  return cleanFields(form, { ...fields, ...extra });
}
const record = (form, fields) => form.buildRecord({ period: 'current', roleGroup: 'SOCIAL_WORKER', standardizedFields: fields });
const tool = (id) => wellbeingTools.find((item) => item.id === id);

test('iga serveri töövoog on sammuvormina olemas', () => {
  assert.deepEqual(FORMS.map((form) => form.workflowType).sort(), Object.keys(WELLBEING_FIELD_SCHEMAS).sort());
});

for (const form of FORMS) {
  const name = form.workflowType;
  const schema = WELLBEING_FIELD_SCHEMAS[name];

  test(`${name}: vormis on täpselt serveri väljad ja õiged liigid`, () => {
    assert.ok(schema, 'serveri skeem on olemas');
    const fields = fieldsOf(form);
    assert.deepEqual(fields.map((field) => field.key).sort(), Object.keys(schema.fields).sort());
    assert.equal(new Set(fields.map((field) => field.key)).size, fields.length, 'iga väli on vormis üks kord');
    for (const field of fields) {
      assert.ok(KINDS.includes(field.kind), `${field.key}: ${field.kind}`);
      assert.equal(field.kind, schema.fields[field.key].kind, field.key);
      assert.ok(label(field.label), `${field.key}: silt`);
    }
    const stepKeys = form.steps.map((step) => step.key);
    assert.equal(new Set(stepKeys).size, stepKeys.length);
    assert.ok(stepKeys.every((key) => !key.startsWith('__')), 'sammu võti ei kattu tulemuse ega toe sammuga');
    /* Juhis on valikuline: korduv „vali üks" on ainult esimesel sammul. */
    assert.ok(form.steps.every((step) => label(step.title)));
    assert.ok(tool(name), 'töövoog on tööriistade loendis');
    assert.equal(form.endpoint, `/api/wellbeing/${name}`);
  });

  test(`${name}: kirjelduse tõlkevõtmed on kataloogis`, () => {
    const keys = translationKeys(form);
    assert.ok(keys.length > 0);
    for (const key of keys) assert.equal(typeof inCatalog(key), 'string', `võti puudub: ${key}`);
  });

  test(`${name}: vorm pakub täpselt serveri väärtusi`, () => {
    for (const field of fieldsOf(form)) {
      if (field.kind !== 'enum' && field.kind !== 'enum_list') continue;
      const offered = field.options.map((option) => option.value);
      assert.deepEqual([...offered].sort(), [...schema.fields[field.key].values].sort(), field.key);
      assert.ok(field.options.every((option) => label(option.label)), `${field.key}: variantide sildid`);
    }
    /* Iga variant eraldi läbi serveri kontrolli. */
    for (const field of fieldsOf(form).filter((item) => item.kind === 'enum')) {
      for (const option of field.options) {
        const sample = filled(form, (other) => (other.key === field.key ? option : other.options[0]));
        assert.doesNotThrow(() => validateWellbeingStandardizedFields(name, sample), `${field.key}=${option.value}`);
      }
    }
  });

  test(`${name}: vastamata vorm ei anna tulemust ega salvestu`, () => {
    const empty = emptyFields(form);
    const enums = fieldsOf(form).filter((field) => field.kind === 'enum');
    assert.ok(enums.length > 0);
    for (const field of fieldsOf(form)) assert.equal(hasValue(field, empty[field.key]), false, field.key);
    assert.equal(form.steps.reduce((sum, step) => sum + missingInStep(step, empty), 0), enums.length);
    /* Server ei võta vastamata vormi vastu: vorm lubab salvestada alles siis,
       kui kõik ühe valikuga küsimused on vastatud. */
    assert.throws(() => validateWellbeingStandardizedFields(name, cleanFields(form, empty)));
  });

  test(`${name}: täidetud vorm annab signaali, millel on tekst, ja soovitused, millel on leht`, () => {
    const lists = Object.fromEntries(
      fieldsOf(form)
        .filter((field) => field.kind === 'enum_list')
        .map((field) => [field.key, field.options.map((option) => option.value)])
    );
    const booleans = Object.fromEntries(fieldsOf(form).filter((field) => field.kind === 'boolean').map((field) => [field.key, true]));
    const samples = [
      filled(form, (field) => field.options[0]),
      filled(form, (field) => field.options.at(-1), { ...lists, ...booleans }),
      filled(form, (field) => field.options[Math.floor(field.options.length / 2)])
    ];
    for (const sample of samples) {
      assert.doesNotThrow(() => validateWellbeingStandardizedFields(name, sample));
      const result = record(form, sample);
      const signal = form.signals[result.computedSignal.signalLevel];
      assert.ok(signal, `signaali tekst puudub: ${result.computedSignal.signalLevel}`);
      assert.ok(['ok', 'warn', 'risk'].includes(signal.tone) && signal.title && signal.text);
      for (const action of result.recommendedActions || []) {
        assert.ok(action.label && action.reason, action.workflowType);
        assert.notEqual((form.actionRoute || wellbeingActionRoute)(action.workflowType), '/tooheaolu', `leht puudub: ${action.workflowType}`);
      }
      for (const output of form.outputs || []) {
        assert.equal(typeof output.value(result), 'string', label(output.title));
      }
      for (const list of form.factors ? form.factors(result, label) : []) {
        assert.ok(list.title && Array.isArray(list.items) && list.empty);
      }
    }
  });

  test(`${name}: iga vaade on nii väike, et mahub paneeli ära`, () => {
    for (const step of form.steps) {
      const weight = stepWeight(step, text);
      assert.ok(weight <= STEP_WEIGHT_LIMIT, `${step.key}: kaal ${weight}, piir ${STEP_WEIGHT_LIMIT}. Jaga samm kaheks.`);
      assert.ok(step.fields.length > 0, step.key);
    }
  });

  if (form.safetyNotice) {
    test(`${name}: ohutusteate küsimus on omaette vaates, et teade mahuks selle alla`, () => {
      const step = form.steps.find((item) => item.fields.some((field) => field.key === form.safetyNotice.fieldKey));
      assert.equal(step.fields.length, 1, step.key);
    });

    test(`${name}: ohutusteade ilmub täpselt siis, kui arvutus seda nõuab`, () => {
      const trigger = fieldsOf(form).find((field) => field.key === form.safetyNotice.fieldKey);
      assert.ok(trigger && trigger.kind === 'enum', 'ohutusteate küsimus on vormis');
      let shown = 0;
      for (const option of trigger.options) {
        const sample = filled(form, (field) => (field.key === trigger.key ? option : field.options[0]));
        const required = record(form, sample).computedSignal.safetyNoticeRequired === true;
        assert.equal(form.safetyNotice.when(sample), required, `${trigger.key}=${option.value}`);
        /* Teade peab ilmuma kohe, kui see üks vastus on antud, ka siis, kui
           ülejäänud vorm on veel vastamata. */
        assert.equal(form.safetyNotice.when({ ...emptyFields(form), [trigger.key]: option.value }), required);
        if (required) shown += 1;
      }
      assert.ok(shown > 0 && shown < trigger.options.length);
      assert.equal(form.safetyNotice.when(emptyFields(form)), false);
    });
  }
}

test('soovituste teed: vanade vormide teed ja tööriistade loend annavad sama', () => {
  for (const data of OLD_ROUTES) {
    for (const [workflowType, route] of Object.entries(data.actionRoutes)) {
      assert.equal(wellbeingActionRoute(workflowType), route, workflowType);
    }
  }
  assert.equal(wellbeingActionRoute('covision'), '/kovisioon');
  assert.equal(wellbeingActionRoute('olematu'), '/tooheaolu');
});

test('loendiväli: tühjad read ja ääretühikud jäävad salvestamisel välja', () => {
  assert.deepEqual(cleanLines(['  aruanne ', '', '   ', 'kõne perele']), ['aruanne', 'kõne perele']);
  assert.deepEqual(cleanLines('üks\n\n kaks \n'), ['üks', 'kaks']);
  assert.deepEqual(cleanLines(null), []);
  const cleaned = cleanFields(recoveryForm, { ...emptyFields(recoveryForm), unavoidableTasks: [' kriitiline kontakt ', ''] });
  assert.deepEqual(cleaned.unavoidableTasks, ['kriitiline kontakt']);
});

test('paigutus: lühikeste skaalade samm on tabel, pikkade variantidega samm on virn', () => {
  const scale = (key, labels) => ({ key, kind: 'enum', label: key, options: labels.map((item) => ({ value: item, label: item })) });
  const short = scale('a', ['Madal', 'Mõõdukas', 'Kõrge', 'Väga kõrge']);
  const long = scale('b', ['Emotsionaalselt raske', 'Eetiline dilemma', 'Töökorralduslikult keeruline']);
  const four = scale('c', ['Ühe nädala pärast', 'Kahe nädala pärast', 'Kuu aja pärast', 'Järgmisel korral']);
  const same = (entry) => entry;
  assert.equal(isScale(short, same), true);
  assert.equal(isScale(long, same), false);
  assert.equal(isTableStep({ fields: [short, scale('d', ['Selge', 'Ebaselge'])] }, same), true);
  assert.equal(isTableStep({ fields: [short, long] }, same), false, 'üks pikk küsimus teeb terve sammu virnaks');
  assert.equal(isTableStep({ fields: [short] }, same), false, 'üks küsimus ei ole tabel');
  assert.equal(isRowOfFour(four, same), true);
  assert.equal(stackColumns(four, same), 4);
  assert.equal(stackColumns(long, same), undefined);
  /* Kolm kõrvuti loendit kaaluvad nagu üks, üksteise all nagu kolm. */
  const lists = ['x', 'y', 'z'].map((key) => ({ key, kind: 'text_list', label: key }));
  assert.ok(stepWeight({ fields: lists, columns: 3 }, same) < stepWeight({ fields: lists }, same) / 2);
});
