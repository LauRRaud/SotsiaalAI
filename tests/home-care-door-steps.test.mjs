// KODUTEENUS K4-f — sammud „kui uks ei avane": loendi reeglid, erijuhtumi tekst, andmebaasi piirid ja tekstid.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HOME_CARE_LIMITS } from '../lib/homeCare/constants.js';
import { normalizeDoorSteps } from '../lib/homeCare/doorSteps.js';
import { composeNoAnswerText } from '../lib/homeCare/noAnswerText.js';

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const sql = source('../prisma/migrations/20261011070000_home_care_door_steps/migration.sql');
const et = JSON.parse(source('../messages/et.json'));
const lookup = (key) => key.split('.').reduce((node, part) => node?.[part], et);
const t = (key, vars = {}) => String(lookup(key)).replace(/\{(\w+)\}/g, (_, name) => vars[name]);

test('sammude loend: tühjad read jäävad välja, järjekord jääb, piirid kehtivad', () => {
  assert.deepEqual(normalizeDoorSteps(['  Koputa   aknale ', '', '   ', 'Helista pojale']), ['Koputa aknale', 'Helista pojale']);
  assert.deepEqual(normalizeDoorSteps([]), []);
  assert.equal(normalizeDoorSteps(Array.from({ length: 8 }, (_, index) => `Samm ${index + 1}`)).length, 8);
  const status = (fn) => {
    try {
      fn();
      return null;
    } catch (error) {
      return [error.status, error.messageKey];
    }
  };
  assert.deepEqual(status(() => normalizeDoorSteps('Koputa')), [400, 'home_care.errors.door_steps_invalid']);
  assert.deepEqual(status(() => normalizeDoorSteps(Array.from({ length: 9 }, (_, index) => `Samm ${index + 1}`))), [400, 'home_care.errors.door_steps_too_many']);
  assert.deepEqual(status(() => normalizeDoorSteps(['x'.repeat(201)])), [400, 'home_care.errors.text_too_long']);
  assert.deepEqual([HOME_CARE_LIMITS.DOOR_STEPS_MAX, HOME_CARE_LIMITS.DOOR_STEP_TEXT_MAX], [8, 200]);
});

test('erijuhtumi tekst: tehtud sammud kellaaja järjekorras, tegemata sammud ühel real, märkus lõpus', () => {
  const steps = [
    { id: 'a', position: 1, text: 'Koputa magamistoa aknale' },
    { id: 'b', position: 2, text: 'Helista naabrile Maiele' },
    { id: 'c', position: 3, text: 'Helista pojale' }
  ];
  /* Teine samm tehti enne esimest: tekstis on need kellaaja järjekorras. */
  assert.equal(
    composeNoAnswerText(t, steps, { a: '10:07', b: '10:02' }, '  Naaber tuli võtmega.  '),
    'Ei saanud sisse.\nkell 10:02: Helista naabrile Maiele\nkell 10:07: Koputa magamistoa aknale\nTegemata sammud: Helista pojale\nNaaber tuli võtmega.'
  );
  /* Kõik sammud tehtud: tegemata sammude rida ei ole. */
  assert.equal(composeNoAnswerText(t, steps.slice(0, 1), { a: '10:02' }, ''), 'Ei saanud sisse.\nkell 10:02: Koputa magamistoa aknale');
  /* Ühtegi sammu ei puudutatud. */
  assert.equal(composeNoAnswerText(t, steps, {}, ''), 'Ei saanud sisse.\nÜhtegi kokkulepitud sammu ei ole märgitud.');
  /* Kliendil ei ole samme kokku lepitud. */
  assert.equal(composeNoAnswerText(t, [], {}, 'Helistasin hooldusjuhile.'), 'Ei saanud sisse.\nKokkulepitud samme ei ole.\nHelistasin hooldusjuhile.');
});

test('sammude tabel: piirid on samad mis koodis; ridu ei muudeta ega kustutata', () => {
  assert.match(sql, new RegExp(`"position" BETWEEN 1 AND ${HOME_CARE_LIMITS.DOOR_STEPS_MAX}`));
  assert.match(sql, new RegExp(`char_length\\(btrim\\("text"\\)\\) BETWEEN 1 AND ${HOME_CARE_LIMITS.DOOR_STEP_TEXT_MAX}`));
  assert.match(sql, /CREATE UNIQUE INDEX "CareDoorStep_active_key" ON "CareDoorStep"\("clientId", "position"\) WHERE "endedAt" IS NULL;/);
  assert.match(sql, /^SET lock_timeout = '5s';\r?\nSET statement_timeout = '30s';/m);
  const service = source('../lib/homeCare/doorSteps.js');
  assert.doesNotMatch(service, /careDoorStep\.(delete|deleteMany|update)\(/);
  /* Kirje sünnib tavalise kirje teed pidi: see teenus ise päevikusse ei kirjuta. */
  assert.doesNotMatch(service, /careClientEntry/);
});

test('nupp „Ei saa sisse" saadab erijuhtumi tavalise kirje aadressile ja oskab seadme järjekorda', () => {
  const component = source('../components/homeCare/HomeCareNoAnswer.jsx');
  assert.match(component, /kind: CareEntryKind\.INCIDENT,\s+incidentType: CareIncidentType\.DOOR_NOT_OPENED/);
  assert.match(component, /\/kirjed`, \{\s+method: "POST"/);
  assert.match(component, /device\.enqueue\(\{ organizationId, clientId, clientName, body \}\)/);
  assert.match(component, /href="tel:112"/);
});

test('sammude ja nupu tekstid on kolmes keeles', () => {
  for (const locale of ['et', 'en', 'ru']) {
    const hc = JSON.parse(source(`../messages/${locale}.json`)).home_care;
    assert.match(hc.no_answer.text_step, /\{time\}[\s\S]*\{step\}/, locale);
    assert.match(hc.no_answer.text_skipped, /\{steps\}/, locale);
    assert.match(hc.no_answer.done_at, /\{time\}/, locale);
    assert.match(hc.no_answer.steps_hint, /\{limit\}/, locale);
    assert.match(hc.no_answer.emergency, /112/, locale);
    for (const key of ['title', 'none', 'add', 'edit', 'steps_label', 'save', 'cancel', 'start', 'call_112', 'run_hint', 'note_label', 'record', 'recorded', 'text_head', 'text_none_done', 'text_no_steps']) {
      assert.ok(hc.no_answer[key], `${locale} ${key}`);
    }
    assert.ok(hc.errors.door_steps_invalid, locale);
    assert.match(hc.errors.door_steps_too_many, /\{limit\}/, locale);
  }
});
