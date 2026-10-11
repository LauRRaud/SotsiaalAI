// TEEKOND K1-b — järgmise sammu reeglid ilma andmebaasita.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  JOURNEY_STEP_LIMITS,
  JOURNEY_STEP_STATES,
  isStepOverdue,
  nextOpenStep,
  normalizeStepDay,
  normalizeStepInput,
  sortSteps,
  todayInEstonia
} from '../lib/journey/stepRules.js';

const refuses = (fn, message, extra = {}) =>
  assert.throws(fn, (error) => error.status === 400 && error.message === message && Object.entries(extra).every(([key, value]) => error[key] === value));

test('järgmine samm: sisend, tähtaeg päevana, järjekord ja „tähtaeg möödas"', () => {
  /* Loomine: pealkiri on kohustuslik, muu valikuline; tühikud korrastatakse. */
  assert.deepEqual(normalizeStepInput({ title: '  Helistan   vallavalitsusse ', doer: ' mina ', dueOn: '2026-10-15', note: ' Küsin koduteenuse kohta. ' }), {
    title: 'Helistan vallavalitsusse',
    doer: 'mina',
    dueOn: '2026-10-15',
    note: 'Küsin koduteenuse kohta.'
  });
  assert.deepEqual(normalizeStepInput({ title: 'Ainult pealkiri' }), { title: 'Ainult pealkiri' });
  refuses(() => normalizeStepInput({}), 'journeys.errors.step_title_required');
  refuses(() => normalizeStepInput({ title: '   ' }), 'journeys.errors.step_title_required');
  refuses(() => normalizeStepInput({ title: 123 }), 'journeys.errors.step_title_required');
  /* Pikkuse piirid: täpselt piiril läheb läbi, üks märk rohkem on viga väljaga. */
  for (const [field, limit] of [['title', JOURNEY_STEP_LIMITS.title], ['doer', JOURNEY_STEP_LIMITS.doer], ['note', JOURNEY_STEP_LIMITS.note]]) {
    assert.equal(normalizeStepInput({ title: 'x', [field]: 'y'.repeat(limit) })[field].length, limit);
    refuses(() => normalizeStepInput({ title: 'x', [field]: 'y'.repeat(limit + 1) }), 'journeys.errors.field_too_long', { field, limit });
  }

  /* Muutmine: ainult saadetud väljad; tühi tekst tühjendab välja, pealkirja mitte. */
  assert.deepEqual(normalizeStepInput({ doer: '' }, { partial: true }), { doer: null });
  assert.deepEqual(normalizeStepInput({ dueOn: null, note: '  ' }, { partial: true }), { dueOn: null, note: null });
  assert.deepEqual(normalizeStepInput({}, { partial: true }), {});
  refuses(() => normalizeStepInput({ title: '' }, { partial: true }), 'journeys.errors.step_title_required');
  assert.deepEqual(normalizeStepInput({ state: 'done', note: 'Helistasin, lubati tagasi helistada.' }, { partial: true }), {
    note: 'Helistasin, lubati tagasi helistada.',
    state: 'DONE'
  });
  refuses(() => normalizeStepInput({ state: 'PAUSED' }, { partial: true }), 'journeys.errors.step_state_invalid');
  assert.deepEqual(JOURNEY_STEP_STATES, ['TODO', 'DONE', 'DROPPED']);

  /* Tähtaeg on kalendripäev: olematu kuupäev ja muu kuju on viga, tühi on „tähtaega ei ole". */
  assert.equal(normalizeStepDay('2028-02-29'), '2028-02-29');
  assert.equal(normalizeStepDay(''), null);
  assert.equal(normalizeStepDay(null), null);
  for (const bad of ['2026-02-30', '2026-13-01', '15.10.2026', '2026-1-5', '1999-12-31', '2101-01-01', 20261015, 'homme']) {
    refuses(() => normalizeStepDay(bad), 'journeys.errors.step_date_invalid');
  }

  /* Tänane päev on Eesti päev: 22.30 UTC on Eestis juba järgmine päev. */
  assert.equal(todayInEstonia(new Date('2026-10-09T10:00:00Z')), '2026-10-09');
  assert.equal(todayInEstonia(new Date('2026-10-09T22:30:00Z')), '2026-10-10');
  /* Möödas alles päev pärast tähtaega ja ainult tegemata sammul. */
  assert.equal(isStepOverdue({ state: 'TODO', dueOn: '2026-10-08' }, '2026-10-09'), true);
  assert.equal(isStepOverdue({ state: 'TODO', dueOn: '2026-10-09' }, '2026-10-09'), false);
  assert.equal(isStepOverdue({ state: 'DONE', dueOn: '2026-10-01' }, '2026-10-09'), false);
  assert.equal(isStepOverdue({ state: 'DROPPED', dueOn: '2026-10-01' }, '2026-10-09'), false);
  assert.equal(isStepOverdue({ state: 'TODO', dueOn: null }, '2026-10-09'), false);

  /* Järjekord: tegemata enne (varasem tähtaeg ees, tähtajata lõpus, võrdsetel varem lisatu), siis lõpetatud (viimati lõpetatu ees). */
  const steps = [
    { id: 'a', state: 'DONE', doneAt: '2026-10-05T10:00:00Z', createdAt: '2026-10-01T10:00:00Z' },
    { id: 'b', state: 'TODO', dueOn: null, createdAt: '2026-10-02T10:00:00Z' },
    { id: 'c', state: 'TODO', dueOn: '2026-10-20', createdAt: '2026-10-03T10:00:00Z' },
    { id: 'd', state: 'TODO', dueOn: '2026-10-12', createdAt: '2026-10-04T10:00:00Z' },
    { id: 'e', state: 'DROPPED', doneAt: '2026-10-07T10:00:00Z', createdAt: '2026-10-01T10:00:00Z' },
    { id: 'f', state: 'TODO', dueOn: '2026-10-12', createdAt: '2026-10-02T09:00:00Z' },
    { id: 'g', state: 'TODO', dueOn: null, createdAt: '2026-10-01T10:00:00Z' }
  ];
  assert.deepEqual(sortSteps(steps).map((step) => step.id), ['f', 'd', 'c', 'g', 'b', 'e', 'a']);
  assert.equal(nextOpenStep(steps).id, 'f');
  assert.equal(nextOpenStep(steps.filter((step) => step.state !== 'TODO')), null);
  assert.deepEqual(sortSteps(null), []);

  /* Iga seis ja iga uus veavõti on kolmes keeles olemas. */
  for (const locale of ['et', 'en', 'ru']) {
    const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
    for (const state of JOURNEY_STEP_STATES) assert.ok(messages.journey.own_steps.states[state], `${locale} ${state}`);
    for (const key of ['step_title_required', 'step_date_invalid', 'step_state_invalid', 'step_not_found', 'step_limit_reached']) {
      assert.ok(messages.journeys.errors[key], `${locale} ${key}`);
    }
  }
});
