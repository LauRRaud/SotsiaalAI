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
  listLinkedPreInquiriesForJourney,
  updateJourneyForUser
} from '../lib/journey/service.js';
import { buildPreInquiryPrefillFromJourney } from '../lib/journey/preInquiryHandoff.js';
import { createJourneyStep, deleteJourneyStep, listJourneySteps, updateJourneyStep } from '../lib/journey/steps.js';
import { DATA_EXPORT_REGISTRY } from '../lib/dataExport/registry.js';
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
  assert.deepEqual(roadmapOf(view), { situation: 'done', saved: 'done', pre_inquiry: 'next', response: 'todo', steps: 'todo' });

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

  /* INIMESE SOOV (K1-a). Salvestub muutmata konteksti kõrvale, muu kontekst jääb alles,
     võõras seda muuta ei saa ja eelpöördumisse läheb see ainult inimese valikul. */
  let current = await detail();
  assert.equal(current.context?.personWish, undefined);
  const withNote = await updateJourneyForUser(
    person.id,
    journey.id,
    { context: { ...(current.context || {}), contextNote: 'Arsti kiri on olemas.' }, expectedUpdatedAt: current.updatedAt },
    { db }
  );
  const wished = await updateJourneyForUser(
    person.id,
    journey.id,
    { context: { ...(withNote.context || {}), personWish: 'Tahan, et ema saaks kodus edasi elada.' }, expectedUpdatedAt: withNote.updatedAt },
    { db }
  );
  assert.equal(wished.context.personWish, 'Tahan, et ema saaks kodus edasi elada.');
  assert.equal(wished.context.contextNote, 'Arsti kiri on olemas.');
  /* Uuendamise vastus kannab seotud pöördumisi ja raja fakte endiselt kaasa. */
  assert.equal(wished.linkedPreInquiries.length > 0, true);
  assert.equal(wished.preInquiryFacts.total, inquiryIds.length - 1);
  /* Liiga pikk soov on viga ja salvestatud soov jääb alles. */
  await assert.rejects(
    updateJourneyForUser(person.id, journey.id, { context: { ...wished.context, personWish: 'x'.repeat(1001) }, expectedUpdatedAt: wished.updatedAt }, { db }),
    (error) => error.status === 400 && error.field === 'personWish'
  );
  /* Võõras ja saaja ei saa soovi muuta. */
  for (const other of [stranger, specialist]) {
    await assert.rejects(
      updateJourneyForUser(other.id, journey.id, { context: { personWish: 'Võõra tekst' }, expectedUpdatedAt: wished.updatedAt }, { db }),
      (error) => error.status === 404
    );
  }
  current = await detail();
  assert.equal(current.context.personWish, 'Tahan, et ema saaks kodus edasi elada.');
  /* Jagamine: ainult valikuga. */
  assert.equal(buildPreInquiryPrefillFromJourney(current, { shareKeys: ['summary'] }).situation.includes('kodus edasi elada'), false);
  assert.ok(buildPreInquiryPrefillFromJourney(current, { shareKeys: ['wish'] }).situation.includes('Kasutaja soov: Tahan, et ema saaks kodus edasi elada.'));
  /* Inimese väljavõttes on soov sees. */
  assert.ok(JSON.stringify(await exportJourneyForUser(person.id, journey.id, { db })).includes('Tahan, et ema saaks kodus edasi elada.'));
  /* Eemaldamine: kontekst ilma soovita. */
  const { personWish: _removed, ...rest } = current.context;
  const cleared = await updateJourneyForUser(person.id, journey.id, { context: rest, expectedUpdatedAt: current.updatedAt }, { db });
  assert.equal(Object.hasOwn(cleared.context, 'personWish'), false);
  assert.equal(cleared.context.contextNote, 'Arsti kiri on olemas.');
});

test('Teekonna sammud: omaniku piir, seisud, kordussaatmine, arhiveeritud Teekond, kaskaad ja väljavõtted', async (t) => {
  const tag = randomUUID().slice(0, 8);
  const user = (name) => db.user.create({ data: { email: `js-${tag}-${name}@example.invalid`, role: 'CLIENT', profile: { create: { firstName: name, lastName: 'Proov' } } } });
  const person = await user('inimene');
  const stranger = await user('teine');
  const journeyIds = [];
  t.after(async () => {
    await db.journey.deleteMany({ where: { id: { in: journeyIds } } });
    await db.user.deleteMany({ where: { id: { in: [person.id, stranger.id] } } });
  });
  const make = async (owner, title) => {
    const journey = await createJourneyForUser(owner.id, { title, summary: 'Kokkuvõte.', status: 'ACTIVE', sharingStatus: 'PRIVATE', clientActionId: randomUUID() }, { db });
    journeyIds.push(journey.id);
    return journey;
  };
  const journey = await make(person, 'Ema vajab abi');
  const other = await make(person, 'Teine Teekond');
  const foreign = await make(stranger, 'Võõra Teekond');
  const NOW = new Date('2026-10-09T08:00:00Z');
  const deps = (now = NOW) => ({ db, now });
  const refused = (promise, status, message) =>
    assert.rejects(promise, (error) => error.status === status && (!message || error.message === message));
  const rowOf = async (id) => (await getJourneyDetailForUser(person.id, id, { db }));
  const stepsRow = (detail) => journeyRoadmap(detail).find((row) => row.key === 'steps').state;

  /* Tühi algus: samme ei ole ja rada ütleb „mitte alustatud". */
  assert.deepEqual((await listJourneySteps(person.id, journey.id, deps())).steps, []);
  assert.equal(stepsRow(await rowOf(journey.id)), 'todo');

  /* Lisamine: väljad salvestuvad korrastatult; kordussaatmine sama võtmega ei tee teist rida. */
  const key = randomUUID();
  const first = await createJourneyStep(person.id, journey.id, { title: '  Helistan   vallavalitsusse ', doer: 'mina', dueOn: '2026-10-08', clientActionId: key }, deps());
  assert.equal(first.steps.length, 1);
  assert.deepEqual(
    [first.steps[0].title, first.steps[0].doer, first.steps[0].dueOn, first.steps[0].state, first.steps[0].doneAt, first.steps[0].overdue],
    ['Helistan vallavalitsusse', 'mina', '2026-10-08', 'TODO', null, true]
  );
  const replay = await createJourneyStep(person.id, journey.id, { title: 'Helistan vallavalitsusse', doer: 'mina', dueOn: '2026-10-08', clientActionId: key }, deps());
  assert.equal(replay.stepId, first.stepId);
  assert.equal(replay.steps.length, 1);
  /* Sama võti teisel Teekonnal on viga, mitte vaikne teine samm. */
  await refused(createJourneyStep(person.id, other.id, { title: 'Sama võti', clientActionId: key }, deps()), 409, 'journeys.errors.idempotency_conflict');
  /* Kaks samaaegset sama võtmega päringut: üks rida. */
  const racing = randomUUID();
  const both = await Promise.all([
    createJourneyStep(person.id, journey.id, { title: 'Küsin arstilt tõendit', clientActionId: racing }, deps()),
    createJourneyStep(person.id, journey.id, { title: 'Küsin arstilt tõendit', clientActionId: racing }, deps())
  ]);
  assert.equal(both[0].stepId, both[1].stepId);
  assert.equal(await db.journeyStep.count({ where: { journeyId: journey.id } }), 2);
  await createJourneyStep(person.id, journey.id, { title: 'Tütar toob ravimid', doer: 'tütar Mari', dueOn: '2026-10-20' }, deps());

  /* Järjekord: tähtajaga enne (varasem ees), tähtajata lõpus. Tähtpäeval endal ei ole samm veel hiljaks jäänud. */
  let list = (await listJourneySteps(person.id, journey.id, deps())).steps;
  assert.deepEqual(list.map((step) => step.title), ['Helistan vallavalitsusse', 'Tütar toob ravimid', 'Küsin arstilt tõendit']);
  assert.deepEqual(list.map((step) => step.overdue), [true, false, false]);
  assert.equal((await listJourneySteps(person.id, journey.id, deps(new Date('2026-10-08T08:00:00Z')))).steps[0].overdue, false);

  /* Sisendi kontroll jõuab teenusest läbi. */
  await refused(createJourneyStep(person.id, journey.id, { title: '  ' }, deps()), 400, 'journeys.errors.step_title_required');
  await refused(createJourneyStep(person.id, journey.id, { title: 'x', dueOn: '2026-02-30' }, deps()), 400, 'journeys.errors.step_date_invalid');

  /* VÕÕRA PIIR: teine inimene ei näe, ei lisa, ei muuda ega kustuta. */
  const stepId = first.stepId;
  await refused(listJourneySteps(stranger.id, journey.id, deps()), 404, 'journeys.errors.not_found');
  await refused(createJourneyStep(stranger.id, journey.id, { title: 'Võõra samm' }, deps()), 404, 'journeys.errors.not_found');
  await refused(updateJourneyStep(stranger.id, journey.id, stepId, { state: 'DONE' }, deps()), 404, 'journeys.errors.not_found');
  await refused(deleteJourneyStep(stranger.id, journey.id, stepId, deps()), 404, 'journeys.errors.not_found');
  /* Oma Teekonna kaudu võõra või teise Teekonna sammu kätte ei saa. */
  await refused(updateJourneyStep(stranger.id, foreign.id, stepId, { state: 'DONE' }, deps()), 404, 'journeys.errors.step_not_found');
  await refused(updateJourneyStep(person.id, other.id, stepId, { title: 'Vale Teekond' }, deps()), 404, 'journeys.errors.step_not_found');
  await refused(deleteJourneyStep(person.id, other.id, stepId, deps()), 404, 'journeys.errors.step_not_found');
  assert.equal((await db.journeyStep.findUnique({ where: { id: stepId } })).title, 'Helistan vallavalitsusse');

  /* TEHTUD koos märkega: aeg läheb kirja, samm liigub lõpetatute hulka. */
  const doneAt = new Date('2026-10-09T09:30:00Z');
  list = (await updateJourneyStep(person.id, journey.id, stepId, { state: 'DONE', note: 'Helistasin, lubati tagasi helistada.' }, deps(doneAt))).steps;
  const done = list.find((step) => step.id === stepId);
  assert.deepEqual([done.state, done.note, done.doneAt, done.overdue], ['DONE', 'Helistasin, lubati tagasi helistada.', doneAt.toISOString(), false]);
  assert.equal(list.at(-1).id, stepId);
  /* Uuesti avamine võtab aja ära; ära jätmine paneb selle uuesti. */
  list = (await updateJourneyStep(person.id, journey.id, stepId, { state: 'TODO' }, deps())).steps;
  assert.deepEqual([list.find((step) => step.id === stepId).state, list.find((step) => step.id === stepId).doneAt], ['TODO', null]);
  list = (await updateJourneyStep(person.id, journey.id, stepId, { state: 'DROPPED' }, deps(doneAt))).steps;
  assert.deepEqual([list.find((step) => step.id === stepId).state, list.find((step) => step.id === stepId).doneAt], ['DROPPED', doneAt.toISOString()]);
  /* Andmebaas ise ei luba tegemata sammu lõpetamise ajaga, tundmatut seisu ega vale kujuga tähtaega. */
  await assert.rejects(db.journeyStep.update({ where: { id: stepId }, data: { state: 'TODO' } }), /JourneyStep_doneAt_check/);
  await assert.rejects(db.journeyStep.update({ where: { id: stepId }, data: { state: 'PAUSED' } }), /JourneyStep_state_check/);
  await assert.rejects(db.journeyStep.update({ where: { id: stepId }, data: { dueOn: '15.10.2026' } }), /JourneyStep_dueOn_check/);
  /* Väljade muutmine ei puuduta seisu; tühi tekst tühjendab välja. */
  const edited = (await updateJourneyStep(person.id, journey.id, both[0].stepId, { title: 'Küsin perearstilt tõendit', doer: '', dueOn: '2026-10-12' }, deps())).steps.find((step) => step.id === both[0].stepId);
  assert.deepEqual([edited.title, edited.doer, edited.dueOn, edited.state], ['Küsin perearstilt tõendit', null, '2026-10-12', 'TODO']);

  /* Sammu muutmine ei muuda Teekonna enda muutmise aega (avatud muutmisvorm ei tohi saada konflikti). */
  const before = await db.journey.findUnique({ where: { id: journey.id }, select: { updatedAt: true } });
  await updateJourneyStep(person.id, journey.id, both[0].stepId, { note: 'Aeg on kinni pandud.' }, deps());
  assert.equal((await db.journey.findUnique({ where: { id: journey.id }, select: { updatedAt: true } })).updatedAt.getTime(), before.updatedAt.getTime());

  /* Teekonna leht ja rada: sammud on kaasas; tegemata samm teeb rea pooleliolevaks. */
  let detail = await rowOf(journey.id);
  assert.equal(detail.steps.length, 3);
  assert.equal(stepsRow(detail), 'current');
  /* Uuendamise vastus kannab samme kaasa. */
  const updated = await updateJourneyForUser(person.id, journey.id, { title: 'Ema vajab kodus abi', expectedUpdatedAt: detail.updatedAt }, { db });
  assert.equal(updated.steps.length, 3);

  /* VÄLJAVÕTTED: inimese Teekonna fail ja andmekoopia kannavad samme; võõra omi mitte. */
  const exported = JSON.stringify(await exportJourneyForUser(person.id, journey.id, { db }));
  assert.ok(exported.includes('Küsin perearstilt tõendit') && exported.includes('Helistasin, lubati tagasi helistada.'));
  await createJourneyStep(stranger.id, foreign.id, { title: 'Võõra enda samm' }, deps());
  const entry = DATA_EXPORT_REGISTRY.find((item) => item.name === 'journeys');
  const files = await entry.collect({ db, userId: person.id });
  const stepsFile = files.find((file) => file.name === 'journey_steps.ndjson');
  assert.equal(stepsFile.count, 3);
  const stepsText = stepsFile.content.toString('utf8');
  assert.ok(stepsText.includes('Tütar toob ravimid'));
  assert.equal(stepsText.includes('Võõra enda samm'), false);
  assert.equal(stepsText.includes('clientActionId'), false);

  /* Piir: Teekonnal on kuni 40 sammu. */
  await db.journeyStep.createMany({ data: Array.from({ length: 40 }, (_, index) => ({ journeyId: other.id, ownerUserId: person.id, title: `Samm ${index + 1}` })) });
  await refused(createJourneyStep(person.id, other.id, { title: 'Neljakümne esimene' }, deps()), 409, 'journeys.errors.step_limit_reached');
  /* Kõik lõpetatud: rada ütleb „tehtud". */
  await db.journeyStep.updateMany({ where: { journeyId: other.id }, data: { state: 'DONE', doneAt: NOW } });
  assert.equal(stepsRow(await rowOf(other.id)), 'done');

  /* ARHIVEERITUD Teekond: samme saab lugeda, mitte muuta. */
  detail = await rowOf(journey.id);
  await updateJourneyForUser(person.id, journey.id, { status: 'ARCHIVED', expectedUpdatedAt: detail.updatedAt }, { db });
  assert.equal((await listJourneySteps(person.id, journey.id, deps())).steps.length, 3);
  await refused(createJourneyStep(person.id, journey.id, { title: 'Pärast arhiveerimist' }, deps()), 409, 'journeys.errors.archived');
  await refused(updateJourneyStep(person.id, journey.id, stepId, { state: 'TODO' }, deps()), 409, 'journeys.errors.archived');
  await refused(deleteJourneyStep(person.id, journey.id, stepId, deps()), 409, 'journeys.errors.archived');

  /* Kustutamine ja kaskaad: valesti lisatud samm kaob; Teekonna kustutus viib sammud kaasa. */
  const victim = await db.journeyStep.findFirst({ where: { journeyId: other.id }, select: { id: true } });
  assert.equal((await deleteJourneyStep(person.id, other.id, victim.id, deps())).steps.length, 39);
  await refused(deleteJourneyStep(person.id, other.id, victim.id, deps()), 404, 'journeys.errors.step_not_found');
  await db.journey.delete({ where: { id: other.id } });
  assert.equal(await db.journeyStep.count({ where: { journeyId: other.id } }), 0);
});
