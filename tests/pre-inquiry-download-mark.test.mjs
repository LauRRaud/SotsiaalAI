// „Alla laaditud" on saatmata eelpöördumise seis; saadetud pöördumise olekut alla laadimine ei muuda.
//
// VIGA, mille see test kinni hoiab: pärast saatmist on pöördumise `status` SAAJA töövoo seis.
// Kui saaja pöördumise vastu võtab, on olek jälle READY („vastu võetud"). Alla laadimise märge
// luges seda pöörduja seisuks „salvestatud, saatmata" ja kirjutas üle väärtusega DOWNLOADED.
// Ühist vestlusruumi ei saanud siis enam luua (`ensureRoomForPreInquiry` nõuab olekut READY).
import test from 'node:test';
import assert from 'node:assert/strict';
import { markPreInquiryDownloaded } from '../lib/preInquiries.js';
import { senderCanEdit } from '../components/workspace/preInquiry/senderModel.js';

const AUTHOR = 'u_author';
const UPDATED = new Date('2026-10-10T10:00:00.000Z');
const SENT = new Date('2026-10-09T09:00:00.000Z');
const OPENED = new Date('2026-10-09T15:00:00.000Z');

function fakeDb(row) {
  const state = { row: { id: 'pi_1', authorId: AUTHOR, updatedAt: UPDATED, ...row }, updates: [] };
  const preInquiry = {
    findFirst: async () => ({ ...state.row }),
    findUnique: async () => ({ ...state.row }),
    update: async ({ data }) => {
      state.updates.push(data);
      Object.assign(state.row, data);
      return { ...state.row };
    }
  };
  const tx = { preInquiry, $executeRaw: async () => 0 };
  return { preInquiry, $transaction: async (run) => run(tx), state };
}

const mark = (db, expectedUpdatedAt = UPDATED) => markPreInquiryDownloaded(AUTHOR, 'pi_1', { expectedUpdatedAt, db });

test('saatmata pöördumine läheb alla laadides seisu „alla laaditud"', async () => {
  for (const status of ['DRAFT', 'READY']) {
    const db = fakeDb({ status });
    const result = await mark(db);
    assert.equal(result.status, 'DOWNLOADED', status);
    assert.deepEqual(db.state.updates, [{ status: 'DOWNLOADED' }], status);
  }
  /* Vananenud koopia ei märgi midagi. */
  const stale = fakeDb({ status: 'READY' });
  await assert.rejects(() => mark(stale, new Date('2026-10-10T09:00:00.000Z')), (error) => error.status === 409 && error.message === 'pre_inquiries.errors.download_conflict');
  assert.deepEqual(stale.state.updates, []);
});

test('saadetud pöördumise olekut alla laadimine ei muuda', async () => {
  const sentRows = {
    /* Saaja võttis vastu: olek READY on tema töövoo seis, mitte pöörduja „salvestatud". */
    accepted: { status: 'READY', deliveryChannel: 'INTERNAL', recipientOwnerId: 'u_worker', sentAt: SENT, openedAt: OPENED },
    waiting: { status: 'SENT', deliveryChannel: 'INTERNAL', recipientOwnerId: 'u_worker', sentAt: SENT },
    /* Asutuse vastuvõtulaud: olek jääb SENT-iks, avamist märgib `openedAt`. */
    organization: { status: 'SENT', deliveryChannel: 'INTERNAL', recipientOrganizationId: 'org_1', sentAt: SENT, openedAt: OPENED },
    receiverArchived: { status: 'ARCHIVED', deliveryChannel: 'INTERNAL', recipientOwnerId: 'u_worker', sentAt: SENT, openedAt: OPENED }
  };
  for (const [name, row] of Object.entries(sentRows)) {
    const db = fakeDb(row);
    const result = await mark(db);
    assert.equal(result.status, row.status, name);
    assert.deepEqual(db.state.updates, [], `${name}: andmebaasi ei kirjutata`);
    /* Ka vananenud koopiaga ei ole see viga: faili alla laadimine õnnestus ja olek jääb. */
    assert.equal((await mark(fakeDb(row), new Date('2026-10-01T00:00:00.000Z'))).status, row.status, name);
    /* Leht ei küsi sellise rea kohta märget üldse. */
    assert.equal(senderCanEdit({ ...row, sentAt: row.sentAt.toISOString(), openedAt: row.openedAt?.toISOString() }), false, name);
  }
});

test('võõras või puuduv pöördumine', async () => {
  const foreign = fakeDb({ status: 'READY', authorId: 'u_other', recipientOwnerId: AUTHOR, sentAt: SENT });
  await assert.rejects(() => mark(foreign), (error) => error.status === 403);
  const missing = fakeDb({ status: 'READY' });
  missing.preInquiry.findFirst = async () => null;
  await assert.rejects(() => mark(missing), (error) => error.status === 404);
});
