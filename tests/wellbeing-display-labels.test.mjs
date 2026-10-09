// Tööheaolu valmis tekstid ei tohi trükkida sisemisi väärtusi.
//
// Töövormi väljund (24h järelplaan, juhiga arutelu memo, kovisiooni sisend, toe
// mustand) pannakse kokku salvestatud väärtustest ja arvutatud märgetest. Iga
// selline väärtus käib läbi sildikaardi (lib/wellbeing/displayLabels.js); kui
// silti ei ole, trükiti tekstisse väärtus ise, alakriipsud tühikuteks vahetatud:
// „reduce next day load", „hard case.should not carry alone" (kujundusaudit K11).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cleanFields, emptyFields } from '../components/wellbeing/forms/formState.js';
import { hardCaseForm } from '../components/wellbeing/forms/hardCaseForm.js';
import { interruptionsForm } from '../components/wellbeing/forms/interruptionsForm.js';
import { quickCheckForm } from '../components/wellbeing/forms/quickCheckForm.js';
import { recoveryForm } from '../components/wellbeing/forms/recoveryForm.js';
import { roleBoundariesForm } from '../components/wellbeing/forms/roleBoundariesForm.js';
import { starterSupportForm } from '../components/wellbeing/forms/starterSupportForm.js';
import { workBoundariesForm } from '../components/wellbeing/forms/workBoundariesForm.js';
import { workplaceViolenceForm } from '../components/wellbeing/forms/workplaceViolenceForm.js';
import { workProcessesForm } from '../components/wellbeing/forms/workProcessesForm.js';
import { wellbeingHasExactLabel, wellbeingHasLabel, wellbeingLabel } from '../lib/wellbeing/displayLabels.js';
import { WELLBEING_FIELD_SCHEMAS } from '../lib/wellbeing/fieldSchemas.js';
import { formatQuickCheckFactor } from '../lib/wellbeing/quickCheck.js';
import { buildWellbeingShareableDraft, WELLBEING_OUTPUT_TYPES, WELLBEING_RECIPIENT_TYPES } from '../lib/wellbeing/supportDraftText.js';
import * as serverDrafts from '../lib/wellbeing/supportDrafts.js';
import { supportOptions } from '../components/wellbeing/supportOptions.js';

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
const libDir = new URL('../lib/wellbeing/', import.meta.url);

/** Kõik märkekoodid, mida arvutused loenditesse lisavad (`x.push("ala.kood")`). */
function factorCodes() {
  const codes = new Set();
  for (const file of fs.readdirSync(libDir).filter((name) => name.endsWith('.js'))) {
    const source = fs.readFileSync(new URL(file, libDir), 'utf8');
    for (const match of source.matchAll(/\.push\("([a-z0-9_]+\.[a-z0-9_.]+)"\)/g)) codes.add(match[1]);
  }
  return [...codes];
}

/** Täidetud vormid: iga ühe valikuga küsimus käib järjest kõik variandid läbi. */
function* samples(form) {
  const fields = form.steps.flatMap((step) => step.fields);
  const rounds = Math.max(...fields.filter((field) => field.kind === 'enum').map((field) => field.options.length));
  for (let round = 0; round < rounds; round += 1) {
    const values = emptyFields(form);
    for (const field of fields) {
      if (field.kind === 'enum') values[field.key] = field.options[round % field.options.length].value;
      if (field.kind === 'enum_list') values[field.key] = field.options.map((option) => option.value);
      if (field.kind === 'boolean') values[field.key] = round % 2 === 0;
    }
    yield form.buildRecord({ period: 'current', roleGroup: 'SOCIAL_WORKER', standardizedFields: cleanFields(form, values) });
  }
}

test('igal vastusevariandil, mille server vastu võtab, on eestikeelne silt', () => {
  const missing = [];
  for (const [workflow, schema] of Object.entries(WELLBEING_FIELD_SCHEMAS)) {
    for (const [field, definition] of Object.entries(schema.fields)) {
      for (const value of definition.values || []) {
        if (!wellbeingHasLabel(value)) missing.push(`${workflow}.${field}=${value}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});

test('igal arvutatud märkel (koormus, ressurss, risk) on TÄPNE silt ühises sõnastikus', () => {
  /* „Minu kirjed" ja „Ülevaade" näitavad tegureid ühise sõnastiku kaudu. Varem
     luges see test kiirkontrolli tegurid kaetuks kiirkontrolli enda siltide
     järgi; kirjete lehel tuli nende asemel võtme lõpp („kõrge") või toores võti. */
  const codes = factorCodes();
  assert.ok(codes.length > 50, 'märkekoodid leiti lähtekoodist');
  assert.deepEqual(codes.filter((code) => !wellbeingHasExactLabel(code)), []);
});

test('kiirkontrolli tegurite laused on kahes kohas samad', () => {
  const quick = factorCodes().filter((code) => formatQuickCheckFactor(code) !== code);
  assert.ok(quick.length >= 10, `kiirkontrolli tegureid leiti ${quick.length}`);
  for (const code of quick) assert.equal(wellbeingLabel(code).toLowerCase(), formatQuickCheckFactor(code).toLowerCase(), code);
});

test('sildita väärtus on näha: varukuju vahetab ainult alakriipsud', () => {
  assert.equal(wellbeingHasLabel('olematu_vaartus'), false);
  assert.equal(wellbeingLabel('olematu_vaartus'), 'olematu vaartus');
  assert.equal(wellbeingLabel('reduce_next_day_load'), 'järgmise päeva koormuse vähendamine');
  assert.equal(wellbeingLabel('hard_case.should_not_carry_alone'), 'juhtumit ei peaks üksi kandma');
});

for (const form of FORMS) {
  test(`${form.workflowType}: valmis tekstides ega toe mustandites ei ole sisemisi väärtusi`, () => {
    const raw = new Set();
    for (const definition of Object.values(WELLBEING_FIELD_SCHEMAS[form.workflowType].fields)) {
      for (const value of definition.values || []) if (value.includes('_')) raw.add(value.replaceAll('_', ' '));
    }
    for (const code of factorCodes()) raw.add(code.replaceAll('_', ' '));
    let checked = 0;
    for (const record of samples(form)) {
      const texts = [
        ...(form.outputs || []).map((output) => output.value(record)),
        ...(record.recommendedActions || []).flatMap((action) => [action.label, action.reason]),
        /* Iga valik, mida toe paneel pakub. */
        ...supportOptions.map(
          ({ outputType, recipientType }) =>
            buildWellbeingShareableDraft({ outputType, recipientType, sourceWorkflowType: form.workflowType, context: record }).generatedText
        )
      ].filter((text) => typeof text === 'string' && text);
      for (const text of texts) {
        checked += 1;
        assert.doesNotMatch(text, /[a-z]+_[a-z]/, `alakriipsuga väärtus tekstis: ${text.slice(0, 200)}`);
        for (const value of raw) assert.ok(!text.includes(value), `sisemine väärtus „${value}" tekstis: ${text.slice(0, 200)}`);
      }
    }
    assert.ok(checked > 0);
  });
}

test('toe valikud: iga valiku jaoks saab teksti koostada ja server võtab sama adressaadi vastu', () => {
  assert.ok(supportOptions.length >= 5);
  for (const option of supportOptions) {
    assert.ok(WELLBEING_OUTPUT_TYPES.includes(option.outputType), option.outputType);
    assert.ok(WELLBEING_RECIPIENT_TYPES.includes(option.recipientType), `tekstikoostaja ei tunne adressaati: ${option.recipientType}`);
    assert.ok(serverDrafts.WELLBEING_RECIPIENT_TYPES.includes(option.recipientType), `server ei tunne adressaati: ${option.recipientType}`);
    assert.ok(Boolean(option.copyOnly) !== Boolean(option.handoff), 'valik on kas ise edastatav mustand või platvormisisene üleandmine');
    const draft = buildWellbeingShareableDraft({ ...option, sourceWorkflowType: 'quick-check', context: {} });
    assert.ok(draft.generatedText.length > 0, option.recipientType);
  }
  /* Kaks loendit (tekstikoostaja ja server) peavad käima koos: mentor oli ainult ühes. */
  assert.deepEqual([...WELLBEING_RECIPIENT_TYPES].sort(), [...serverDrafts.WELLBEING_RECIPIENT_TYPES].sort());
});
