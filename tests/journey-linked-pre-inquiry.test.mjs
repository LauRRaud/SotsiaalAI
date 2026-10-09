// TEEKOND K0 — seotud eelpöördumise seis saatja silmade läbi.
//
// Viga, mille pärast see fail on: kui saaja avas pöördumise, läks eelpöördumise
// `status` väärtuselt SENT väärtusele READY (saaja töövoo seis) ja Teekond näitas
// saatjale „valmis saatmiseks", nagu poleks pöördumist saadetudki.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LINKED_PRE_INQUIRY_STATES, linkedPreInquiryState } from '../lib/journey/linkedPreInquiryState.js';

const at = '2026-10-09T08:00:00.000Z';

test('seotud eelpöördumise seis tuleb faktidest, mitte saaja töövoo seisust', () => {
  /* Saatja enda käik enne saatmist. */
  assert.equal(linkedPreInquiryState({ status: 'DRAFT' }), 'DRAFT');
  assert.equal(linkedPreInquiryState({ status: 'READY' }), 'READY');
  assert.equal(linkedPreInquiryState({ status: 'DOWNLOADED' }), 'DOWNLOADED');
  assert.equal(linkedPreInquiryState({ status: 'ARCHIVED' }), 'ARCHIVED');
  assert.equal(linkedPreInquiryState({}), 'DRAFT');
  assert.equal(linkedPreInquiryState(null), 'DRAFT');

  /* Saadetud platvormil, saaja ei ole veel avanud. */
  assert.equal(linkedPreInquiryState({ status: 'SENT', sentAt: at }), 'SENT');
  /* Saadetud väljaspool platvormi: avamist platvorm ei näe. */
  assert.equal(linkedPreInquiryState({ status: 'SENT', sentAt: at, externalSendConfirmedAt: at }), 'SENT_OUTSIDE');

  /* VIGA ISE: saaja avas, `status` on tema töövoos READY. Saatjale on see „avatud". */
  assert.equal(linkedPreInquiryState({ status: 'READY', sentAt: at, openedAt: at }), 'OPENED');
  /* Saaja töövoo iga järgmine seis on saatjale endiselt „avatud". */
  for (const status of ['SENT', 'READY', 'DOWNLOADED', 'ARCHIVED']) {
    assert.equal(linkedPreInquiryState({ status, sentAt: at, openedAt: at }), 'OPENED', status);
  }
  /* Saadetud pöördumine ei ole kunagi „valmis saatmiseks" ega „mustand", mis iganes `status` on. */
  for (const status of ['DRAFT', 'READY', 'DOWNLOADED', 'ARCHIVED', 'SENT', '']) {
    assert.ok(!['READY', 'DRAFT', 'DOWNLOADED'].includes(linkedPreInquiryState({ status, sentAt: at })), status);
  }

  /* Tagasi võetud ja parandusega asendatud on tugevamad kui avamine. */
  assert.equal(linkedPreInquiryState({ status: 'SENT', sentAt: at, recalledAt: at }), 'RECALLED');
  assert.equal(linkedPreInquiryState({ status: 'READY', sentAt: at, openedAt: at, supersededById: 'p2' }), 'REPLACED');
  assert.equal(linkedPreInquiryState({ status: 'SENT', sentAt: at, recalledAt: at, supersededById: 'p2' }), 'RECALLED');

  /* Igal seisul on silt kõigis kolmes keeles ja ükski silt ei ole tühi. */
  for (const locale of ['et', 'en', 'ru']) {
    const labels = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).journey.related.pre_inquiry_state;
    assert.deepEqual(Object.keys(labels).sort(), [...LINKED_PRE_INQUIRY_STATES].sort(), locale);
    assert.ok(Object.values(labels).every((label) => typeof label === 'string' && label.trim()), locale);
  }
});
