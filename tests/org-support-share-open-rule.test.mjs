// Toeavalduse sisu jõuab saajani ainult avamise kaudu, mis jätab märke ja auditirea
// (lib/org/supportShare.js). Kaks rada läksid sellest mööda.
import test from 'node:test';
import assert from 'node:assert/strict';

import { closeSupportShare, openSupportShare } from '../lib/org/supportShare.js';

const SENT_AT = new Date('2026-09-01T08:00:00Z');
const NOW = new Date('2026-10-10T08:00:00Z');

function makeDb(row) {
  const state = { row: { id: 's1', organizationId: 'org-1', recipientMembershipId: 'm-juht', ownerUserId: 'tootaja', status: 'SENT', sentAt: SENT_AT, openedAt: null, closedAt: null, correctedAt: null, contentDeletedAt: null, supersedesShareId: null, snapshotSchemaVersion: '1.0', sharedSnapshotJson: { summary: 'Koormus on kasvanud.' }, updatedAt: SENT_AT, ...row }, audits: [] };
  const tx = {
    $queryRaw: async () => [],
    wellbeingSupportShare: {
      findFirst: async ({ where }) => (where.id === state.row.id && where.recipientMembershipId === state.row.recipientMembershipId ? { ...state.row } : null),
      updateMany: async ({ where, data }) => {
        const statuses = where.status?.in || [where.status];
        if (where.id !== state.row.id || !statuses.includes(state.row.status)) return { count: 0 };
        Object.assign(state.row, data);
        return { count: 1 };
      },
      findUnique: async () => ({ ...state.row, owner: { email: 'tootaja@example.invalid', profile: { firstName: 'Mari', lastName: 'Maasikas' } } })
    },
    dataAuditLog: { create: async ({ data }) => (state.audits.push(data.action), data) }
  };
  return { state, $transaction: async (run) => run(tx) };
}
const recipient = { recipientMembershipId: 'm-juht' };

test('avamata avalduse lõpetamine ei anna sisu kaasa', async () => {
  const db = makeDb();
  const closed = await closeSupportShare('s1', { ...recipient, actorUserId: 'juht' }, { db, now: NOW });
  assert.deepEqual([closed.status, closed.openedAt, 'snapshot' in closed], ['CLOSED', null, false]);
  assert.equal(closed.sender.firstName, 'Mari');
  assert.deepEqual([db.state.row.status, db.state.row.openedAt], ['CLOSED', null]);
  assert.equal(db.state.audits.length, 1);
});

test('avatud avalduse lõpetamine annab sisu endiselt kaasa', async () => {
  const db = makeDb({ status: 'OPENED', openedAt: new Date('2026-09-02T08:00:00Z') });
  const closed = await closeSupportShare('s1', { ...recipient, actorUserId: 'juht' }, { db, now: NOW });
  assert.deepEqual([closed.status, closed.snapshot?.summary], ['CLOSED', 'Koormus on kasvanud.']);
});

test('avamine annab sisu ja jätab märke; kustutatud sisuga avamata avaldust avatuks ei märgita', async () => {
  const fresh = makeDb();
  const opened = await openSupportShare('s1', recipient, { db: fresh, now: NOW });
  assert.deepEqual([opened.status, opened.snapshot?.summary, fresh.state.row.openedAt?.toISOString(), fresh.state.audits.length], ['OPENED', 'Koormus on kasvanud.', NOW.toISOString(), 1]);

  /* Sisu kustutati tähtaja möödumisel enne avamist: lugeda ei ole midagi ja saatja ei tohi näha „avatud". */
  const purged = makeDb({ sharedSnapshotJson: null, contentDeletedAt: new Date('2026-10-01T08:00:00Z') });
  await assert.rejects(openSupportShare('s1', recipient, { db: purged, now: NOW }), (error) => error.status === 404 && error.message === 'org.errors.support_share_not_found');
  assert.deepEqual([purged.state.row.status, purged.state.row.openedAt, purged.state.audits.length], ['SENT', null, 0]);

  /* Juba avatud avalduse korduv avamine pärast sisu kustutamist jääb lubatuks ega muuda midagi. */
  const later = makeDb({ status: 'OPENED', openedAt: new Date('2026-09-02T08:00:00Z'), sharedSnapshotJson: null, contentDeletedAt: new Date('2026-10-01T08:00:00Z') });
  const again = await openSupportShare('s1', recipient, { db: later, now: NOW });
  assert.deepEqual([again.status, later.state.row.openedAt.toISOString(), later.state.audits.length], ['OPENED', '2026-09-02T08:00:00.000Z', 0]);

  /* Võõras liikmesus ei leia rida. */
  await assert.rejects(openSupportShare('s1', { recipientMembershipId: 'm-teine' }, { db: makeDb(), now: NOW }), (error) => error.status === 404);
});
