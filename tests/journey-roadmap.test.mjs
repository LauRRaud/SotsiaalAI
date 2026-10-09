// TEEKOND K0 — teekonnarada näitab ainult seda, mida platvorm päriselt teab.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { journeyRoadmap } from '../lib/journey/roadmap.js';

const states = (journey) => Object.fromEntries(journeyRoadmap(journey).map((step) => [step.key, step.state]));

test('teekonnarada: eelpöördumise ja vastuse seis tuleb faktidest', () => {
  /* Värske Teekond: kirjeldatud ja salvestatud, muu alustamata. */
  assert.deepEqual(states({ primaryPath: 'UNKNOWN', preInquiryFacts: { total: 0, sent: 0, opened: 0 } }), {
    situation: 'done',
    saved: 'done',
    pre_inquiry: 'todo',
    response: 'todo'
  });
  /* Valitud suund teeb eelpöördumisest soovituse, mitte tehtud töö. */
  assert.equal(states({ primaryPath: 'PRE_INQUIRY' }).pre_inquiry, 'next');
  assert.equal(states({ primaryPath: 'pre_inquiry' }).pre_inquiry, 'next');
  /* Mustand on olemas: pooleli. */
  assert.equal(states({ primaryPath: 'SERVICE_MAP', preInquiryFacts: { total: 2, sent: 0, opened: 0 } }).pre_inquiry, 'current');
  /* Saadetud: tehtud, vastust veel ei ole. */
  assert.deepEqual(
    [states({ preInquiryFacts: { total: 1, sent: 1, opened: 0 } }).pre_inquiry, states({ preInquiryFacts: { total: 1, sent: 1, opened: 0 } }).response],
    ['done', 'todo']
  );
  /* Saaja avas: rida „Saaja on pöördumise avanud" on tehtud. Vastamist rada ei väida. */
  assert.deepEqual(
    [states({ preInquiryFacts: { total: 1, sent: 1, opened: 1 } }).pre_inquiry, states({ preInquiryFacts: { total: 1, sent: 1, opened: 1 } }).response],
    ['done', 'done']
  );
  /* Puuduvad või vigased arvud ei tee midagi tehtuks. */
  assert.equal(states({ preInquiryFacts: { total: 'x', sent: null } }).pre_inquiry, 'todo');
  assert.equal(states(null).pre_inquiry, 'todo');

  /* Rajal ei ole ühtegi rida, mille seis ei saa kunagi muutuda. */
  assert.deepEqual(journeyRoadmap({}).map((step) => step.key), ['situation', 'saved', 'pre_inquiry', 'response']);
  /* Igal real on pealkiri kõigis kolmes keeles. */
  for (const locale of ['et', 'en', 'ru']) {
    const roadmap = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).journey.roadmap;
    for (const step of journeyRoadmap({})) assert.ok(typeof roadmap[step.key] === 'string' && roadmap[step.key].trim(), `${locale} ${step.key}`);
  }
});
