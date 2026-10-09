// Tööheaolu sammuvormide kirjeldused ja serveri leping peavad kokku käima.
//
// Vormi kirjeldus (components/wellbeing/forms/*.js) hoiab küsimusi ja
// vastusevariante; server (lib/wellbeing/fieldSchemas.js ja töövoo arvutus)
// otsustab, mida ta vastu võtab ja kuidas hindab. Kui üks neist muutub ilma
// teiseta, saaks inimene valida vastuse, mida salvestada ei saa, või jääks
// mõni serveri väärtus vormis pakkumata.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanFields, emptyFields, hasValue, missingInStep } from '../components/wellbeing/forms/formState.js';
import { quickCheckForm } from '../components/wellbeing/forms/quickCheckForm.js';
import { recoveryForm } from '../components/wellbeing/forms/recoveryForm.js';
import { wellbeingActionRoute } from '../components/wellbeing/forms/routes.js';
import { cleanLines } from '../components/stage/lines.js';
import { WELLBEING_FIELD_SCHEMAS, validateWellbeingStandardizedFields } from '../lib/wellbeing/fieldSchemas.js';
import { wellbeingTools } from '../lib/wellbeingTools.js';

const FORMS = [quickCheckForm, recoveryForm];
const KINDS = ['enum', 'boolean', 'enum_list', 'text', 'text_list'];
const fieldsOf = (form) => form.steps.flatMap((step) => step.fields);
const label = (entry) => (Array.isArray(entry) ? entry[0] : entry);

/** Täidetud vorm: iga ühe valikuga küsimus saab `pick(field)` variandi. */
function filled(form, pick, extra = {}) {
  const fields = emptyFields(form);
  for (const field of fieldsOf(form)) {
    if (field.kind === 'enum') fields[field.key] = pick(field).value;
  }
  return cleanFields(form, { ...fields, ...extra });
}
const record = (form, fields) => form.buildRecord({ period: 'current', roleGroup: 'SOCIAL_WORKER', standardizedFields: fields });

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
    assert.ok(form.steps.every((step) => label(step.title) && label(step.lead)));
    assert.ok(tool(name), 'töövoog on tööriistade loendis');
    assert.equal(form.endpoint, `/api/wellbeing/${name}`);
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
}

function tool(id) {
  return wellbeingTools.find((item) => item.id === id);
}

test('loendiväli: tühjad read ja ääretühikud jäävad salvestamisel välja', () => {
  assert.deepEqual(cleanLines(['  aruanne ', '', '   ', 'kõne perele']), ['aruanne', 'kõne perele']);
  assert.deepEqual(cleanLines('üks\n\n kaks \n'), ['üks', 'kaks']);
  assert.deepEqual(cleanLines(null), []);
  const cleaned = cleanFields(recoveryForm, { ...emptyFields(recoveryForm), unavoidableTasks: [' kriitiline kontakt ', ''] });
  assert.deepEqual(cleaned.unavoidableTasks, ['kriitiline kontakt']);
});

test('soovituse tee: tööriistade loendist, kovisioon eraldi, tundmatu viib tööheaolu avalehele', () => {
  assert.equal(wellbeingActionRoute('covision'), '/kovisioon');
  assert.equal(wellbeingActionRoute('recovery'), '/tooheaolu/taastumine');
  assert.equal(wellbeingActionRoute('overview'), '/tooheaolu/ulevaade');
  assert.equal(wellbeingActionRoute('olematu'), '/tooheaolu');
});
