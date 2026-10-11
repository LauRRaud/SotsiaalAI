// TEEKOND K1-a — inimese soov tema enda sõnadega.
//
// Soov on omaette väli. Platvorm seda ei muuda, pikem tekst on viga (mitte vaikne
// kärbe) ja eelpöördumisse läheb see ainult siis, kui inimene selle jagamiseks valib.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JOURNEY_TEXT_LIMITS } from '../lib/journey/constants.js';
import { buildPreInquiryPrefillFromJourney } from '../lib/journey/preInquiryHandoff.js';
import { normalizeJourneyCreateInput, normalizeJourneyUpdateInput } from '../lib/journey/validation.js';

test('inimese soov: salvestub muutmata, pikem tekst on viga, jagatakse ainult valikul', () => {
  const limit = JOURNEY_TEXT_LIMITS.personWish;
  assert.equal(limit, 1000);

  /* Loomisel ja muutmisel: tühikud korrastatakse nagu igal tekstiväljal, sisu jääb. */
  const created = normalizeJourneyCreateInput({
    title: 'Ema vajab abi',
    summary: 'Ema kukkus.',
    context: { personWish: '  Tahan,  et ema saaks\r\nkodus elada. ' }
  });
  assert.equal(created.context.personWish, 'Tahan, et ema saaks\nkodus elada.');
  const updated = normalizeJourneyUpdateInput({ context: { personWish: 'Soovin, et keegi helistaks emale tagasi.' } });
  assert.equal(updated.context.personWish, 'Soovin, et keegi helistaks emale tagasi.');

  /* Piiri täpsus: täpselt lubatud pikkus läheb läbi, üks märk rohkem on viga väljaga. */
  assert.equal(normalizeJourneyUpdateInput({ context: { personWish: 'x'.repeat(limit) } }).context.personWish.length, limit);
  assert.throws(
    () => normalizeJourneyUpdateInput({ context: { personWish: 'x'.repeat(limit + 1) } }),
    (error) => error.status === 400 && error.code === 'JOURNEY_FIELD_TOO_LONG' && error.field === 'personWish' && error.limit === limit
  );
  /* Tühi soov ei jäta välja maha; soovita kontekst on soovita. */
  assert.equal(Object.hasOwn(normalizeJourneyUpdateInput({ context: { personWish: '   ' } }).context, 'personWish'), false);
  assert.equal(Object.hasOwn(normalizeJourneyUpdateInput({ context: { contextNote: 'märkus' } }).context, 'personWish'), false);
  /* Teised konteksti tekstid ei saanud soovi piiri. */
  assert.equal(normalizeJourneyUpdateInput({ context: { contextNote: 'y'.repeat(5000) } }).context.contextNote.length, 5000);

  /* JAGAMINE: ilma valikuta soovi eelpöördumises ei ole. */
  const wish = `Tahan, et ema saaks kodus elada. ${'Lisaks. '.repeat(120)}`.slice(0, limit).trim();
  const journey = { id: 'j1', title: 'Ema vajab abi', summary: 'Ema kukkus.', context: { personWish: wish } };
  const without = buildPreInquiryPrefillFromJourney(journey, { shareKeys: ['summary', 'title'] });
  assert.equal(without.situation.includes('Tahan, et ema'), false);
  assert.equal(JSON.stringify(without).includes('Tahan, et ema'), false);
  /* Valikuga läheb soov kaasa TÄISPIKKUSES ja selgelt soovina märgitult. */
  const shared = buildPreInquiryPrefillFromJourney(journey, { shareKeys: ['summary', 'wish'] });
  assert.ok(shared.situation.includes(`Kasutaja soov: ${wish}`));
  assert.deepEqual(shared.sharedJourneyInfo.confirmedKeys, ['summary', 'wish']);
  /* Ainult soov, ilma kokkuvõtteta: kokkuvõtet kaasa ei tule. */
  const onlyWish = buildPreInquiryPrefillFromJourney(journey, { shareKeys: ['wish'] });
  assert.equal(onlyWish.situation, `Kasutaja soov: ${wish}`);
});
