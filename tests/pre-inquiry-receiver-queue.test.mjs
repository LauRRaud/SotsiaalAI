// Vastuvõtja tööjärg: rühm, ootepäevad ja järjekord.
//
// Pärast saatmist on `status` vastuvõtja töövoo seis: SENT = saabunud ja vastu
// võtmata, READY = vastu võetud (acceptPreInquiry seab ka openedAt), ARCHIVED =
// vastuvõtja arhiveeris (lib/preInquiries.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { PRE_INQUIRY_RECEIVER_GROUPS, preInquiryReceiverQueue, preInquiryReceiverState } from '../lib/preInquiryReceiverQueue.js';

const now = new Date('2026-10-09T12:00:00');
const state = (inquiry) => preInquiryReceiverState(inquiry, { now });

test('uus pöördumine ütleb, mitu täispäeva see on oodanud', () => {
  const fresh = state({ status: 'SENT', sentAt: '2026-10-09T09:00:00' });
  assert.equal(fresh.group, 'new');
  assert.equal(fresh.days, 0);
  assert.equal(state({ status: 'SENT', sentAt: '2026-10-05T09:00:00' }).days, 4);
});

test('vastu võetud pöördumine on minu töös ja ütleb järgmise kontakti seisu', () => {
  const base = { status: 'READY', sentAt: '2026-10-05T09:00:00', openedAt: '2026-10-06T09:00:00' };
  assert.deepEqual(state(base), { group: 'mine', at: base.openedAt, contact: 'none', contactOn: null });
  assert.equal(state({ ...base, nextContactOn: '2026-10-09' }).contact, 'due');
  assert.equal(state({ ...base, nextContactOn: '2026-10-01T00:00:00.000Z' }).contact, 'due');
  assert.equal(state({ ...base, nextContactOn: '2026-10-12' }).contact, 'later');
});

test('arhiveeritud on omaette rühm ka siis, kui see oli vastu võetud', () => {
  assert.equal(state({ status: 'ARCHIVED', sentAt: '2026-10-05T09:00:00', openedAt: '2026-10-06T09:00:00' }).group, 'archived');
});

test('saatmata rida ei ole tööjärjes (admini proovivaade näeb ka enda mustandeid)', () => {
  assert.deepEqual(state({ status: 'DRAFT', updatedAt: '2026-10-07T09:00:00' }), { group: 'none' });
  assert.deepEqual(state({ status: 'READY' }), { group: 'none' });
  assert.deepEqual(state({ status: 'ARCHIVED' }), { group: 'none' });
  assert.deepEqual(state(null), { group: 'none' });
});

test('järg: uued kõige kauem oodanu ees, minu töös lähim kontakt ees, arhiiv värskeim ees', () => {
  const rows = [
    { id: 'n1', status: 'SENT', sentAt: '2026-10-08T09:00:00' },
    { id: 'n2', status: 'SENT', sentAt: '2026-10-03T09:00:00' },
    { id: 'm1', status: 'READY', sentAt: '2026-10-05T09:00:00', openedAt: '2026-10-06T09:00:00', updatedAt: '2026-10-06T09:00:00' },
    { id: 'm2', status: 'READY', sentAt: '2026-10-05T09:00:00', openedAt: '2026-10-06T09:00:00', nextContactOn: '2026-10-12', updatedAt: '2026-10-06T09:00:00' },
    { id: 'm3', status: 'READY', sentAt: '2026-10-05T09:00:00', openedAt: '2026-10-06T09:00:00', nextContactOn: '2026-10-08', updatedAt: '2026-10-06T09:00:00' },
    { id: 'a1', status: 'ARCHIVED', sentAt: '2026-09-20T09:00:00', updatedAt: '2026-10-01T09:00:00' },
    { id: 'a2', status: 'ARCHIVED', sentAt: '2026-09-20T09:00:00', updatedAt: '2026-10-07T09:00:00' },
    { id: 'd1', status: 'DRAFT', updatedAt: '2026-10-07T09:00:00' },
    { id: 'd2', status: 'ARCHIVED', updatedAt: '2026-10-07T09:00:00' }
  ];
  const queue = preInquiryReceiverQueue(rows, { now });
  assert.deepEqual(Object.keys(queue), [...PRE_INQUIRY_RECEIVER_GROUPS]);
  const ids = (group) => queue[group].map((row) => row.inquiry.id);
  assert.deepEqual(ids('new'), ['n2', 'n1']);
  assert.deepEqual(ids('mine'), ['m3', 'm2', 'm1']);
  assert.deepEqual(ids('archived'), ['a2', 'a1']);
  assert.deepEqual(preInquiryReceiverQueue(null, { now }), { new: [], mine: [], archived: [] });
});
