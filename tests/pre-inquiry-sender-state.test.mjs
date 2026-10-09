// Pöörduja näeb oma eelpöördumise seisu oma vaatest, mitte töövoo sisemist olekut.
//
// Vastuvõtja „Märgi vastuvõetuks" seab oleku READY ja ajatempli openedAt
// (acceptPreInquiry failis lib/preInquiries.js). Pöördujale tähendab see „vastu
// võetud", mitte „valmis ülevaatamiseks". Seisu reegel ise on Teekonnaga ühine
// (lib/journey/linkedPreInquiryState.js); siin on loendi lisad: päevad ja kuupäev.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LINKED_PRE_INQUIRY_STATES, linkedPreInquiryState } from '../lib/journey/linkedPreInquiryState.js';
import { PRE_INQUIRY_SENDER_STATE_KEYS, preInquirySenderState, preInquirySenderTone } from '../lib/preInquirySenderState.js';

const now = new Date('2026-10-09T12:00:00Z');
const state = (inquiry) => preInquirySenderState(inquiry, { now });

test('mustand ja salvestatud, saatmata', () => {
  assert.deepEqual(state({ status: 'DRAFT' }), { key: 'draft' });
  assert.deepEqual(state({ status: 'READY', sentAt: null }), { key: 'ready' });
  assert.deepEqual(state({ status: 'DOWNLOADED' }), { key: 'downloaded' });
  assert.deepEqual(state({ status: 'ARCHIVED' }), { key: 'archived' });
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

test('vastuvõtja arhiveerimine ei paista pöördujale: saadetud ja vastu võetud jääb vastu võetuks', () => {
  /* Pärast saatmist on `status` vastuvõtja töövoo seis (ta saab oma järjes arhiveerida). */
  const row = { status: 'ARCHIVED', deliveryChannel: 'INTERNAL', sentAt: '2026-10-06T09:00:00Z', openedAt: '2026-10-07T08:00:00Z' };
  assert.equal(state(row).key, 'accepted');
});

test('e-kirjaga saadetud: platvorm vastuvõttu ei näe', () => {
  const confirmed = { status: 'SENT', deliveryChannel: 'EXTERNAL_EMAIL', sentAt: '2026-10-08T10:00:00Z', externalSendConfirmedAt: '2026-10-08T10:00:00Z' };
  assert.equal(state(confirmed).key, 'sent_external');
  /* Ka ilma kinnituse ajatemplita ei lubata e-kirja puhul „ootab vastuvõtmist". */
  assert.equal(state({ status: 'SENT', deliveryChannel: 'EXTERNAL_EMAIL', sentAt: '2026-10-08T10:00:00Z' }).key, 'sent_external');
  /* Kinnitamata e-kiri on endiselt pöörduja enda käes. */
  assert.equal(state({ status: 'READY', deliveryChannel: 'EXTERNAL_EMAIL' }).key, 'ready');
  assert.equal(state({ status: 'DRAFT', deliveryChannel: 'EXTERNAL_EMAIL' }).key, 'draft');
});

test('tagasi võetud ja parandusega asendatud on ülimuslikud', () => {
  assert.equal(state({ status: 'SENT', sentAt: '2026-10-06T09:00:00Z', recalledAt: '2026-10-06T10:00:00Z' }).key, 'recalled');
  assert.equal(state({ status: 'READY', sentAt: '2026-10-06T09:00:00Z', openedAt: '2026-10-07T08:00:00Z', supersededById: 'x' }).key, 'replaced');
  assert.equal(preInquirySenderTone('replaced'), 'quiet');
});

test('vastus ühises ruumis, kui rida seda kannab', () => {
  const answered = state({ status: 'READY', sentAt: '2026-10-06T09:00:00Z', openedAt: '2026-10-07T08:00:00Z', replyCount: 2 });
  assert.equal(answered.key, 'answered');
  assert.equal(preInquirySenderTone(answered.key), 'ok');
});

test('iga Teekonna seis annab loendile oma võtme (reegel on üks)', () => {
  const samples = {
    DRAFT: { status: 'DRAFT' },
    READY: { status: 'READY' },
    DOWNLOADED: { status: 'DOWNLOADED' },
    SENT: { status: 'SENT', sentAt: '2026-10-06T09:00:00Z' },
    SENT_OUTSIDE: { status: 'SENT', sentAt: '2026-10-06T09:00:00Z', externalSendConfirmedAt: '2026-10-06T09:00:00Z' },
    OPENED: { status: 'READY', sentAt: '2026-10-06T09:00:00Z', openedAt: '2026-10-07T08:00:00Z' },
    ANSWERED: { status: 'READY', sentAt: '2026-10-06T09:00:00Z', replyCount: 1 },
    RECALLED: { status: 'SENT', recalledAt: '2026-10-06T10:00:00Z' },
    REPLACED: { status: 'SENT', supersededById: 'x' },
    ARCHIVED: { status: 'ARCHIVED' }
  };
  assert.deepEqual(Object.keys(samples).sort(), [...LINKED_PRE_INQUIRY_STATES].sort());
  const keys = new Set();
  for (const [name, row] of Object.entries(samples)) {
    assert.equal(linkedPreInquiryState(row), name);
    keys.add(state(row).key);
  }
  assert.deepEqual([...keys].sort(), [...PRE_INQUIRY_SENDER_STATE_KEYS].sort());
});
