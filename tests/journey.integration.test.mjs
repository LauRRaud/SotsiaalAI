// TEEKOND K0 — Teekonna ja eelpöördumise põhikäik PÄRIS andmebaasis.
//
// Mida see fail tõendab: Teekond näitab seotud eelpöördumise seisu nii, nagu
// SAATJA seda näeb, ka pärast seda, kui saaja on pöördumise avanud (viga: seis
// „valmis saatmiseks"); teekonnaraja faktid loetakse kõigi seotud pöördumiste
// pealt; võõras ei näe Teekonda ega teise inimese pöördumisi.
//
// Avamine tehakse päris funktsiooniga `acceptPreInquiry`, et test katkeks, kui
// saaja töövoo seisusiire muutub.
//
// Käivitamine (eraldatud kohalik baas, kuhu on rakendatud kõik migratsioonid):
//   TZ=UTC JOURNEY_TEST_DATABASE_URL=postgresql://…@localhost:5432/…_probe \
//     node --import ./scripts/register-node-source-loader.mjs --test tests/journey.integration.test.mjs
// `npm test` seda faili ei käivita.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { journeyRoadmap } from '../lib/journey/roadmap.js';
import {
  createJourneyForUser,
  exportJourneyForUser,
  getJourneyDetailForUser,
  listLinkedPreInquiriesForJourney
} from '../lib/journey/service.js';
import { acceptPreInquiry } from '../lib/preInquiries.js';

const url = new URL(process.env.JOURNEY_TEST_DATABASE_URL || process.env.HOME_CARE_TEST_DATABASE_URL || 'postgres://invalid/invalid');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.endsWith('_probe')) {
  throw Error('isolated JOURNEY_TEST_DATABASE_URL (localhost, …_probe) required');
}
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }), log: [] });
test.after(() => db.$disconnect());

const roadmapOf = (journey) => Object.fromEntries(journeyRoadmap(journey).map((step) => [step.key, step.state]));

test('Teekond ja eelpöördumine: seis saatja silmade läbi, raja faktid ja võõra piir', async (t) => {
  const tag = randomUUID().slice(0, 8);
  const user = (name, role) =>
    db.user.create({ data: { email: `jr-${tag}-${name}@example.invalid`, role, profile: { create: { firstName: name, lastName: 'Proov' } } } });
  const person = await user('inimene', 'CLIENT');
  const specialist = await user('spetsialist', 'SOCIAL_WORKER');
  const stranger = await user('teine', 'CLIENT');
  const inquiryIds = [];
  const journeyIds = [];
  t.after(async () => {
    await db.preInquiry.deleteMany({ where: { id: { in: inquiryIds } } });
    await db.journey.deleteMany({ where: { id: { in: journeyIds } } });
    await db.user.deleteMany({ where: { id: { in: [person.id, specialist.id, stranger.id] } } });
  });

  const journey = await createJourneyForUser(
    person.id,
    {
      title: 'Ema vajab kodus abi',
      summary: 'Ema kukkus ja ei saa enam üksi poes käia. Tahan teada, kuhu pöörduda.',
      primaryPath: 'PRE_INQUIRY',
      status: 'ACTIVE',
      sharingStatus: 'PRIVATE',
      clientActionId: randomUUID()
    },
    { db }
  );
  journeyIds.push(journey.id);
  const detail = () => getJourneyDetailForUser(person.id, journey.id, { db });
  const stateOf = async (id) => (await detail()).linkedPreInquiries.find((item) => item.id === id)?.state;

  /* Värske Teekond: seoseid ei ole, eelpöördumine on valitud suunana „järgmine". */
  let view = await detail();
  assert.deepEqual(view.linkedPreInquiries, []);
  assert.deepEqual(view.preInquiryFacts, { total: 0, sent: 0, opened: 0 });
  assert.deepEqual(roadmapOf(view), { situation: 'done', saved: 'done', pre_inquiry: 'next', response: 'todo' });

  const inquiry = (data) =>
    db.preInquiry.create({
      data: {
        authorId: person.id,
        recipientOwnerId: specialist.id,
        recipientType: 'KOV_CONTACT',
        sourceJourneyId: journey.id,
        topic: 'Koduteenuse küsimus',
        situation: 'Ema vajab abi poes käimisel.',
        ...data
      }
    });

  /* Mustand → valmis saatmiseks: saatja enda seisud. */
  const first = await inquiry({ status: 'DRAFT' });
  inquiryIds.push(first.id);
  assert.equal(await stateOf(first.id), 'DRAFT');
  view = await detail();
  assert.deepEqual(view.preInquiryFacts, { total: 1, sent: 0, opened: 0 });
  assert.equal(roadmapOf(view).pre_inquiry, 'current');
  await db.preInquiry.update({ where: { id: first.id }, data: { status: 'READY' } });
  assert.equal(await stateOf(first.id), 'READY');

  /* Saadetud platvormil: saaja ei ole veel avanud. */
  await db.preInquiry.update({ where: { id: first.id }, data: { status: 'SENT', sentAt: new Date('2026-10-09T08:00:00Z') } });
  assert.equal(await stateOf(first.id), 'SENT');
  view = await detail();
  assert.deepEqual(view.preInquiryFacts, { total: 1, sent: 1, opened: 0 });
  assert.deepEqual([roadmapOf(view).pre_inquiry, roadmapOf(view).response], ['done', 'todo']);

  /* VIGA ISE. Saaja võtab pöördumise vastu päris funktsiooniga: andmebaasis läheb
     `status` tema töövoo seisu READY. Saatja Teekond peab näitama „saaja on avanud",
     mitte „valmis saatmiseks". */
  const accepted = await acceptPreInquiry(specialist.id, first.id, { db });
  assert.ok(accepted.openedAt);
  const stored = await db.preInquiry.findUnique({ where: { id: first.id }, select: { status: true, openedAt: true, sentAt: true } });
  assert.equal(stored.status, 'READY');
  assert.ok(stored.openedAt && stored.sentAt);
  view = await detail();
  const opened = view.linkedPreInquiries.find((item) => item.id === first.id);
  assert.equal(opened.state, 'OPENED');
  assert.equal(opened.status, 'READY');
  assert.ok(opened.sentAt && opened.openedAt);
  assert.deepEqual(view.preInquiryFacts, { total: 1, sent: 1, opened: 1 });
  assert.deepEqual([roadmapOf(view).pre_inquiry, roadmapOf(view).response], ['done', 'done']);
  /* Võõras ei saa pöördumist vastu võtta. */
  await assert.rejects(acceptPreInquiry(stranger.id, first.id, { db }), (error) => error.status === 404);

  /* Tagasi võetud pöördumine ei ole saadetud; parandusega asendatud on „asendatud". */
  const recalled = await inquiry({ status: 'SENT', sentAt: new Date('2026-10-09T09:00:00Z'), recalledAt: new Date('2026-10-09T09:05:00Z') });
  inquiryIds.push(recalled.id);
  assert.equal(await stateOf(recalled.id), 'RECALLED');
  const correction = await inquiry({ status: 'SENT', sentAt: new Date('2026-10-09T10:00:00Z') });
  inquiryIds.push(correction.id);
  await db.preInquiry.update({ where: { id: first.id }, data: { supersededById: correction.id } });
  assert.equal(await stateOf(first.id), 'REPLACED');
  assert.equal(await stateOf(correction.id), 'SENT');
  /* Väljaspool platvormi saadetud: avamist platvorm ei näe ja seis ütleb seda. */
  const outside = await inquiry({
    status: 'SENT',
    sentAt: new Date('2026-10-09T11:00:00Z'),
    externalSendConfirmedAt: new Date('2026-10-09T11:00:00Z'),
    deliveryChannel: 'EXTERNAL_EMAIL'
  });
  inquiryIds.push(outside.id);
  assert.equal(await stateOf(outside.id), 'SENT_OUTSIDE');
  view = await detail();
  /* Faktid: tagasi võetu ei loe saadetuks; avatud on endiselt üks. */
  assert.deepEqual(view.preInquiryFacts, { total: inquiryIds.length, sent: inquiryIds.length - 1, opened: 1 });

  /* Loend on lehekülgede kaupa, faktid kõigi pöördumiste pealt. */
  const page = await listLinkedPreInquiriesForJourney(person.id, journey.id, { db, limit: 1 });
  assert.equal(page.items.length, 1);
  assert.equal(page.hasMore, true);
  assert.equal(page.totalCount, inquiryIds.length);
  assert.ok(page.items[0].state);

  /* VÕÕRA PIIR. Teise inimese pöördumine, mis viitab samale Teekonnale, ei ole
     loendis ega faktides; võõras ei saa Teekonda lugeda. */
  const foreign = await db.preInquiry.create({
    data: { authorId: stranger.id, recipientOwnerId: specialist.id, recipientType: 'KOV_CONTACT', sourceJourneyId: journey.id, situation: 'Võõras.', status: 'SENT', sentAt: new Date() }
  });
  inquiryIds.push(foreign.id);
  view = await detail();
  assert.equal(view.linkedPreInquiries.some((item) => item.id === foreign.id), false);
  assert.equal(view.preInquiryFacts.total, inquiryIds.length - 1);
  await assert.rejects(getJourneyDetailForUser(stranger.id, journey.id, { db }), (error) => error.status === 404);
  await assert.rejects(getJourneyDetailForUser(specialist.id, journey.id, { db }), (error) => error.status === 404);

  /* Inimese enda väljavõttes on sama seis. */
  const exported = await exportJourneyForUser(person.id, journey.id, { db });
  const text = JSON.stringify(exported);
  assert.ok(text.includes('"state":"REPLACED"') && text.includes('"state":"RECALLED"'));
  assert.equal(text.includes(foreign.id), false);
});
