// Pöörduja näeb oma eelpöördumise seisu oma vaatest, mitte töövoo sisemist olekut.
//
// Vastuvõtja „Märgi vastuvõetuks" seab oleku READY ja ajatempli openedAt
// (acceptPreInquiry failis lib/preInquiries.js). Pöördujale tähendab see „vastu
// võetud", mitte „valmis ülevaatamiseks".
import test from 'node:test';
import assert from 'node:assert/strict';
import { preInquirySenderState, preInquirySenderTone } from '../lib/preInquirySenderState.js';

const now = new Date('2026-10-09T12:00:00Z');
const state = (inquiry) => preInquirySenderState(inquiry, { now });

test('mustand ja salvestatud, saatmata', () => {
  assert.deepEqual(state({ status: 'DRAFT' }), { key: 'draft' });
  assert.deepEqual(state({ status: 'READY', sentAt: null }), { key: 'ready' });
  assert.deepEqual(state({ status: 'DOWNLOADED' }), { key: 'downloaded' });
  assert.deepEqual(state(null), { key: 'draft' });
});

test('platvormis saadetud: ootab vastuvõtmist ja näitab ootepäevi', () => {
  const sent = state({ status: 'SENT', deliveryChannel: 'INTERNAL', sentAt: '2026-10-06T09:00:00Z' });
  assert.equal(sent.key, 'sent_waiting');
  assert.equal(sent.days, 3);
  assert.equal(state({ status: 'SENT', deliveryChannel: 'INTERNAL', sentAt: '2026-10-09T11:00:00Z' }).days, 0);
  assert.equal(preInquirySenderTone(sent.key), 'wait');
});

test('vastuvõtja vajutus: olek READY koos openedAt-iga on pöördujale „vastu võetud"', () => {
  const accepted = state({ status: 'READY', deliveryChannel: 'INTERNAL', sentAt: '2026-10-06T09:00:00Z', openedAt: '2026-10-07T08:00:00Z' });
  assert.deepEqual(accepted, { key: 'accepted', at: '2026-10-07T08:00:00Z' });
  assert.equal(preInquirySenderTone(accepted.key), 'ok');
});

test('e-kirjaga saadetud: platvorm vastuvõttu ei näe', () => {
  assert.equal(state({ status: 'SENT', deliveryChannel: 'EXTERNAL_EMAIL', externalSendConfirmedAt: '2026-10-08T10:00:00Z' }).key, 'sent_external');
  /* Kinnitamata e-kiri on endiselt pöörduja enda käes. */
  assert.equal(state({ status: 'READY', deliveryChannel: 'EXTERNAL_EMAIL' }).key, 'ready');
  assert.equal(state({ status: 'DRAFT', deliveryChannel: 'EXTERNAL_EMAIL' }).key, 'draft');
});

test('tagasi võetud ja arhiveeritud on ülimuslikud', () => {
  assert.equal(state({ status: 'SENT', sentAt: '2026-10-06T09:00:00Z', recalledAt: '2026-10-06T10:00:00Z' }).key, 'recalled');
  assert.equal(state({ status: 'ARCHIVED', sentAt: '2026-10-06T09:00:00Z', openedAt: '2026-10-07T08:00:00Z' }).key, 'archived');
  assert.equal(preInquirySenderTone('archived'), 'quiet');
});
