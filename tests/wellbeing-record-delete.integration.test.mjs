// Audit F-ERR-01 päris andmebaasis: mustandite kustutuse viga pöörab kirje kustutuse tagasi.
//
// Käivita isoleeritud proovibaasis:
//   JOURNEY_TEST_DATABASE_URL=postgres://…/…_probe node --import ./scripts/register-node-source-loader.mjs --test tests/wellbeing-record-delete.integration.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { deleteWellbeingRecordForUser } from '../lib/wellbeing/records.js';

const url = new URL(process.env.JOURNEY_TEST_DATABASE_URL || process.env.HOME_CARE_TEST_DATABASE_URL || 'postgres://invalid/invalid');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.endsWith('_probe')) {
  throw Error('isolated JOURNEY_TEST_DATABASE_URL (localhost, …_probe) required');
}
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }), log: [] });
test.after(() => db.$disconnect());

test('F-ERR-01: kirje ja selle mustandid kustuvad koos või üldse mitte', async (t) => {
  const tag = randomUUID().slice(0, 8);
  const user = (name) => db.user.create({ data: { email: `wb-${tag}-${name}@example.invalid`, role: 'SOCIAL_WORKER', profile: { create: { firstName: name, lastName: 'Proov' } } } });
  const owner = await user('omanik');
  const other = await user('teine');
  t.after(async () => {
    await db.wellbeingOutputDraft.deleteMany({ where: { userId: { in: [owner.id, other.id] } } });
    await db.wellbeingRecord.deleteMany({ where: { ownerUserId: { in: [owner.id, other.id] } } });
    await db.user.deleteMany({ where: { id: { in: [owner.id, other.id] } } });
  });
  const record = (ownerUserId) => db.wellbeingRecord.create({
    data: {
      ownerUserId,
      scoringVersion: 'proov',
      workflowType: 'hard_case',
      standardizedFields: {},
      computedSignal: {},
      loadFactors: [],
      resourceFactors: [],
      riskMarkers: [],
      recommendedActions: []
    }
  });
  const draft = (userId, sourceRecordId, text) => db.wellbeingOutputDraft.create({
    data: { userId, sourceWorkflowType: 'hard_case', sourceRecordId, outputType: 'note', recipientType: 'self', generatedText: text }
  });
  const mine = await record(owner.id);
  const kept = await record(owner.id);
  await draft(owner.id, mine.id, 'Mustand 1');
  await draft(owner.id, mine.id, 'Mustand 2');
  await draft(owner.id, kept.id, 'Teise kirje mustand');
  await draft(other.id, mine.id, 'Teise inimese mustand');
  const left = async () => ({
    record: await db.wellbeingRecord.count({ where: { id: mine.id } }),
    drafts: await db.wellbeingOutputDraft.count({ where: { userId: owner.id, sourceRecordId: mine.id } })
  });

  /* Päris tehing, mille sees mustandite kustutamine ebaõnnestub. */
  const failing = {
    $transaction: (work) => db.$transaction((tx) => work({
      wellbeingRecord: tx.wellbeingRecord,
      wellbeingOutputDraft: { deleteMany: async () => { throw new Error('SYNTHETIC_DB_FAILURE'); } }
    }))
  };
  await assert.rejects(deleteWellbeingRecordForUser(owner.id, mine.id, { prisma: failing, deleteDrafts: true }), /SYNTHETIC_DB_FAILURE/);
  /* SÜDA: kirje kustutus pöörati tagasi. Enne parandust oli kirje siin juba läinud ja mustandid orvud. */
  assert.deepEqual(await left(), { record: 1, drafts: 2 });

  /* Võõras ei kustuta midagi. */
  assert.deepEqual(await deleteWellbeingRecordForUser(other.id, mine.id, { prisma: db, deleteDrafts: true }), { deleted: false, count: 0, draftsDeleted: 0 });
  assert.deepEqual(await left(), { record: 1, drafts: 2 });

  /* Kordus päris kliendiga viib ära nii kirje kui selle mustandid; teise kirje ja teise inimese omad jäävad. */
  assert.deepEqual(await deleteWellbeingRecordForUser(owner.id, mine.id, { prisma: db, deleteDrafts: true }), { deleted: true, count: 1, draftsDeleted: 2 });
  assert.deepEqual(await left(), { record: 0, drafts: 0 });
  assert.equal(await db.wellbeingOutputDraft.count({ where: { userId: owner.id, sourceRecordId: kept.id } }), 1);
  assert.equal(await db.wellbeingOutputDraft.count({ where: { userId: other.id, sourceRecordId: mine.id } }), 1);
});
