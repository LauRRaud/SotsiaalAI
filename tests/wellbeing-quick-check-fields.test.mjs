// Kiirkontrolli vormi väljad ja serveri leping peavad kokku käima.
//
// Vorm (components/wellbeing/quickCheckFields.js) hoiab küsimusi ja
// vastusevariante, server (lib/wellbeing/fieldSchemas.js, quickCheck.js)
// otsustab, mida ta vastu võtab ja kuidas hindab. Kui üks neist muutub ilma
// teiseta, saaks inimene valida vastuse, mida salvestada ei saa.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  QUICK_CHECK_EMPTY,
  QUICK_CHECK_GROUPS,
  QUICK_CHECK_RISKS,
  QUICK_CHECK_WORKFLOW_SLUGS
} from '../components/wellbeing/quickCheckFields.js';
import { validateWellbeingStandardizedFields } from '../lib/wellbeing/fieldSchemas.js';
import { QUICK_CHECK_FIELD_KEYS, computeQuickCheckResult } from '../lib/wellbeing/quickCheck.js';

const questions = [...QUICK_CHECK_GROUPS.demands, ...QUICK_CHECK_GROUPS.resources];
const filled = (pick) => ({
  ...Object.fromEntries(questions.map((field) => [field.key, pick(field)])),
  ...Object.fromEntries(QUICK_CHECK_RISKS.map((risk) => [risk.key, false]))
});

test('kiirkontrolli vormis on täpselt serveri väljad', () => {
  const formKeys = [...questions.map((field) => field.key), ...QUICK_CHECK_RISKS.map((risk) => risk.key)];
  assert.deepEqual([...formKeys].sort(), [...QUICK_CHECK_FIELD_KEYS].sort());
  assert.deepEqual(Object.keys(QUICK_CHECK_EMPTY).sort(), [...QUICK_CHECK_FIELD_KEYS].sort());
  assert.equal(new Set(formKeys).size, formKeys.length, 'iga väli on vormis üks kord');
});

test('iga vastusevariant on serverile vastuvõetav', () => {
  for (const field of questions) {
    for (const option of field.options) {
      const sample = filled((other) => (other.key === field.key ? option.value : other.options[0].value));
      assert.doesNotThrow(
        () => validateWellbeingStandardizedFields('quick-check', sample),
        `${field.key}=${option.value}`
      );
    }
    assert.ok(field.label && field.options.every((option) => option.label), field.key);
  }
  const allMarked = { ...filled((field) => field.options[0].value), difficultCaseMarker: true, covisionNeed: true, supportNeed: true };
  assert.doesNotThrow(() => validateWellbeingStandardizedFields('quick-check', allMarked));
});

test('vastamata vorm: hinnangut ei teki ja salvestada ei saa', () => {
  /* Algseis on vastamata. Tegureid sellest ei tule (vahekokkuvõte ei väida
     midagi, mida inimene ei valinud) ja server sellist kirjet vastu ei võta:
     vorm lubab salvestada alles siis, kui kõik küsimused on vastatud. */
  for (const field of questions) assert.equal(QUICK_CHECK_EMPTY[field.key], null, field.key);
  for (const risk of QUICK_CHECK_RISKS) assert.equal(QUICK_CHECK_EMPTY[risk.key], false, risk.key);
  const result = computeQuickCheckResult(QUICK_CHECK_EMPTY);
  assert.deepEqual(result.loadFactors, []);
  assert.deepEqual(result.resourceFactors, []);
  assert.deepEqual(result.riskMarkers, []);
  assert.deepEqual(result.recommendedActions, []);
  assert.throws(() => validateWellbeingStandardizedFields('quick-check', QUICK_CHECK_EMPTY));
});

test('iga soovitatud järgmine samm viib olemasoleva töövormi juurde', () => {
  const worst = {
    ...filled((field) => field.options.at(-1).value),
    difficultCaseMarker: true,
    covisionNeed: true,
    supportNeed: true
  };
  const { recommendedActions, signalLevel } = computeQuickCheckResult(worst);
  assert.equal(signalLevel, 'red');
  assert.ok(recommendedActions.length >= 5);
  for (const action of recommendedActions) {
    assert.ok(action.label && action.reason, action.workflowType);
    assert.ok(
      action.workflowType === 'covision' || QUICK_CHECK_WORKFLOW_SLUGS[action.workflowType],
      `teekond puudub: ${action.workflowType}`
    );
  }
});
