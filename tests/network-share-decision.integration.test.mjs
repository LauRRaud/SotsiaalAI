// Audit T02 päris andmebaasis: klient loeb teksti, töötaja muudab ja esitab uuesti,
// klient vajutab „Kinnitan" vana teksti all. Kinnitus ei tohi uue teksti külge jääda.
//
// Käivita isoleeritud proovibaasis:
//   JOURNEY_TEST_DATABASE_URL=postgres://…/…_probe node --import ./scripts/register-node-source-loader.mjs --test tests/network-share-decision.integration.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  clientRespondToShare,
  computeShareContentHash,
  submitToClient,
  updateNetworkShareDraft
} from '../lib/network/share.js';
import { loadMySharings } from '../lib/mySharings.js';

const url = new URL(process.env.JOURNEY_TEST_DATABASE_URL || process.env.HOME_CARE_TEST_DATABASE_URL || 'postgres://invalid/invalid');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.endsWith('_probe')) {
  throw Error('isolated JOURNEY_TEST_DATABASE_URL (localhost, …_probe) required');
}
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }), log: [] });
test.after(() => db.$disconnect());

test('T02: kliendi kinnitus käib selle teksti kohta, mida ta luges', async (t) => {
  const tag = randomUUID().slice(0, 8);
  const user = (name, role) => db.user.create({ data: { email: `ns-${tag}-${name}@example.invalid`, role, profile: { create: { firstName: name, lastName: 'Proov' } } } });
  const client = await user('klient', 'CLIENT');
  const worker = await user('tootaja', 'SOCIAL_WORKER');
  const recipient = await user('saaja', 'SERVICE_PROVIDER');
  const stranger = await user('teine', 'CLIENT');
  const source = await db.preInquiry.create({
    data: { authorId: client.id, recipientOwnerId: worker.id, recipientType: 'KOV_CONTACT', situation: 'Proov.', status: 'SENT', sentAt: new Date() }
  });
  const endsOn = new Date(Date.now() + 30 * 86_400_000);
  const fields = { summaryText: 'Versioon A: klient vajab koduteenust.', purpose: 'Koduteenuse korraldamine.', sharingBoundary: 'Ainult kokkuvõte.', participationEndsOn: endsOn };
  const make = () => db.networkShare.create({
    data: {
      sourcePreInquiryId: source.id,
      workerId: worker.id,
      clientUserId: client.id,
      recipientUserId: recipient.id,
      ...fields,
      contentHash: computeShareContentHash(fields),
      status: 'AWAITING_CLIENT'
    }
  });
  const share = await make();
  const second = await make();
  t.after(async () => {
    await db.networkShare.deleteMany({ where: { id: { in: [share.id, second.id] } } });
    await db.preInquiry.deleteMany({ where: { id: source.id } });
    await db.user.deleteMany({ where: { id: { in: [client.id, worker.id, recipient.id, stranger.id] } } });
  });
  const refused = (promise, code) => assert.rejects(promise, (error) => error.code === code, code);
  const row = () => db.networkShare.findUnique({ where: { id: share.id } });
  const listed = async (userId, section) => (await loadMySharings(userId, { db, sections: [section] }))[section].items.find((item) => item.id === share.id);

  /* Klient saab koos tekstiga selle räsi; töötaja väljaminevate real ja võõral seda ei ole. */
  const seen = await listed(client.id, 'networkShares');
  assert.equal(seen.summaryText, fields.summaryText);
  assert.equal(seen.contentHash, share.contentHash);
  assert.equal(Object.hasOwn(await listed(worker.id, 'outgoingNetworkShares'), 'contentHash'), false);
  assert.equal(await listed(stranger.id, 'networkShares'), undefined);

  /* Ilma räsita kinnitus ei kinnita midagi. */
  await refused(clientRespondToShare({ prisma: db, shareId: share.id, clientUserId: client.id, decision: 'CONFIRMED' }), 'network_share.content_hash_required');
  assert.equal((await row()).status, 'AWAITING_CLIENT');

  /* Töötaja muudab teksti ja esitab selle uuesti; kliendi leht näitab endiselt versiooni A. */
  await updateNetworkShareDraft({ prisma: db, shareId: share.id, workerId: worker.id, summaryText: 'Versioon B: klient vajab koduteenust ja tema võlgadest räägitakse ka.' });
  await submitToClient({ prisma: db, shareId: share.id, workerId: worker.id });
  const changed = await row();
  assert.equal(changed.status, 'AWAITING_CLIENT');
  assert.notEqual(changed.contentHash, seen.contentHash);

  /* SÜDA: vana lehe „Kinnitan" lükatakse tagasi ja nõusolek ei jää uue teksti külge. */
  await refused(
    clientRespondToShare({ prisma: db, shareId: share.id, clientUserId: client.id, decision: 'CONFIRMED', expectedContentHash: seen.contentHash }),
    'network_share.content_changed'
  );
  const after = await row();
  assert.deepEqual([after.status, after.confirmedContentHash, after.clientConfirmedAt], ['AWAITING_CLIENT', null, null]);

  /* Värske vaade annab uue teksti ja uue räsi; selle kinnitus kirjutab tõendi selle teksti kohta. */
  const fresh = await listed(client.id, 'networkShares');
  assert.ok(fresh.summaryText.startsWith('Versioon B'));
  assert.equal(fresh.contentHash, changed.contentHash);
  const confirmed = await clientRespondToShare({ prisma: db, shareId: share.id, clientUserId: client.id, decision: 'CONFIRMED', expectedContentHash: fresh.contentHash });
  assert.deepEqual([confirmed.status, confirmed.confirmedContentHash, confirmed.clientConfirmationMethod], ['CONFIRMED', changed.contentHash, 'IN_APP']);
  /* Otsustatud real räsi enam välja ei lähe. */
  assert.equal(Object.hasOwn(await listed(client.id, 'networkShares'), 'contentHash'), false);

  /* Keelduda saab ka räsita; võõras ei saa kumbagi. */
  await refused(clientRespondToShare({ prisma: db, shareId: second.id, clientUserId: stranger.id, decision: 'DECLINED' }), 'network_share.forbidden');
  const declined = await clientRespondToShare({ prisma: db, shareId: second.id, clientUserId: client.id, decision: 'DECLINED' });
  assert.deepEqual([declined.status, declined.confirmedContentHash], ['DECLINED', null]);
});
