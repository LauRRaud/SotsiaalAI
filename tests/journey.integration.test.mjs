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
import { renderPaperSheetHtml } from '../lib/journey/paperSheet.js';
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
import { createJourneyAssessment, deleteJourneyAssessment, listJourneyAssessments } from '../lib/journey/assessments.js';
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
  const roomIds = [];
  t.after(async () => {
    await db.room.deleteMany({ where: { id: { in: roomIds } } });
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
  assert.deepEqual(view.preInquiryFacts, { total: 0, sent: 0, opened: 0, answered: 0 });
  assert.deepEqual(roadmapOf(view), { situation: 'done', saved: 'done', pre_inquiry: 'next', response: 'todo', answered: 'todo', steps: 'todo' });

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
  assert.deepEqual(view.preInquiryFacts, { total: 1, sent: 0, opened: 0, answered: 0 });
  assert.equal(roadmapOf(view).pre_inquiry, 'current');
  await db.preInquiry.update({ where: { id: first.id }, data: { status: 'READY' } });
  assert.equal(await stateOf(first.id), 'READY');

  /* Saadetud platvormil: saaja ei ole veel avanud. */
  await db.preInquiry.update({ where: { id: first.id }, data: { status: 'SENT', sentAt: new Date('2026-10-09T08:00:00Z') } });
  assert.equal(await stateOf(first.id), 'SENT');
  view = await detail();
  assert.deepEqual(view.preInquiryFacts, { total: 1, sent: 1, opened: 0, answered: 0 });
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
  assert.deepEqual(view.preInquiryFacts, { total: 1, sent: 1, opened: 1, answered: 0 });
  assert.deepEqual([roadmapOf(view).pre_inquiry, roadmapOf(view).response], ['done', 'done']);
  /* Võõras ei saa pöördumist vastu võtta. */
  await assert.rejects(acceptPreInquiry(stranger.id, first.id, { db }), (error) => error.status === 404);

  /* SAAJA VASTUS JÕUAB TEEKONDA (K1-c). Ühises ruumis kirjutab kõigepealt saatja ise:
     see ei ole vastus. Siis kirjutab saaja: Teekond näitab „saaja on vastanud" ja
     viimase vastuse aega. Kustutatud sõnumit ja abilise sõnumit ei loeta. */
  const room = await db.room.create({
    data: { ownerId: person.id, title: 'Eelpöördumine', originType: 'PRE_INQUIRY', originId: first.id }
  });
  roomIds.push(room.id);
  const say = (authorId, content, extra = {}) => db.roomMessage.create({ data: { roomId: room.id, authorId, content, ...extra } });
  await say(person.id, 'Tere, kas saite mu pöördumise kätte?', { createdAt: new Date('2026-10-09T08:30:00Z') });
  view = await detail();
  assert.equal(view.linkedPreInquiries.find((item) => item.id === first.id).state, 'OPENED');
  assert.equal(view.preInquiryFacts.answered, 0);
  await say(specialist.id, 'Kustutatud vastus.', { createdAt: new Date('2026-10-09T08:40:00Z'), deletedAt: new Date('2026-10-09T08:41:00Z') });
  await say(specialist.id, 'Abilise tekst.', { createdAt: new Date('2026-10-09T08:45:00Z'), senderType: 'ASSISTANT' });
  assert.equal((await detail()).preInquiryFacts.answered, 0);
  await say(specialist.id, 'Tere! Sain kätte, helistan teile homme.', { createdAt: new Date('2026-10-09T09:00:00Z') });
  await say(specialist.id, 'Sobib ka kell 14.', { createdAt: new Date('2026-10-09T09:10:00Z') });
  view = await detail();
  const answered = view.linkedPreInquiries.find((item) => item.id === first.id);
  assert.deepEqual([answered.state, answered.replyCount, answered.lastReplyAt], ['ANSWERED', 2, '2026-10-09T09:10:00.000Z']);
  assert.deepEqual(view.preInquiryFacts, { total: 1, sent: 1, opened: 1, answered: 1 });
  assert.deepEqual([roadmapOf(view).response, roadmapOf(view).answered], ['done', 'done']);
  /* Vastuse SISU Teekonda ei tule: ainult arv ja aeg. */
  assert.equal(JSON.stringify(view).includes('helistan teile homme'), false);

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
  assert.deepEqual(view.preInquiryFacts, { total: inquiryIds.length, sent: inquiryIds.length - 1, opened: 1, answered: 1 });
  /* PABERLEHT (K1-e) päris andmetest: lehel on ainult teel olevad pöördumised (parandus ja
     väljaspool saadetu); tagasi võetut ja parandusega asendatut seal ei ole. */
  const sheet = renderPaperSheetHtml({ journey: view, parts: ['pre_inquiries'], locale: 'et' });
  assert.equal((sheet.match(/<li>/g) || []).length, 2);

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
  const foreignRoom = await db.room.create({ data: { ownerId: stranger.id, title: 'Võõras', originType: 'PRE_INQUIRY', originId: foreign.id } });
  roomIds.push(foreignRoom.id);
  await db.roomMessage.create({ data: { roomId: foreignRoom.id, authorId: specialist.id, content: 'Vastus võõrale.' } });
  view = await detail();
  assert.equal(view.preInquiryFacts.answered, 1);
  assert.equal(view.linkedPreInquiries.some((item) => item.id === foreign.id), false);
  assert.equal(view.preInquiryFacts.total, inquiryIds.length - 1);
  await assert.rejects(getJourneyDetailForUser(stranger.id, journey.id, { db }), (error) => error.status === 404);
  await assert.rejects(getJourneyDetailForUser(specialist.id, journey.id, { db }), (error) => error.status === 404);

  /* Inimese enda väljavõttes on sama seis. */
  const exported = await exportJourneyForUser(person.id, journey.id, { db });
  const text = JSON.stringify(exported);
  assert.ok(text.includes('"state":"REPLACED"') && text.includes('"state":"RECALLED"'));
  assert.equal(text.includes(foreign.id), false);
  assert.ok(text.includes('"replyCount":2'));
  assert.equal(text.includes('helistan teile homme'), false);

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

test('enda hinnang muutusele: algseis, muutus, omaniku piir, arhiveeritud Teekond ja väljavõtted', async (t) => {
  const tag = randomUUID().slice(0, 8);
  const user = (name) => db.user.create({ data: { email: `ja-${tag}-${name}@example.invalid`, role: 'CLIENT', profile: { create: { firstName: name, lastName: 'Proov' } } } });
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
  const at = (iso) => ({ db, now: new Date(iso) });
  const refused = (promise, status, message) =>
    assert.rejects(promise, (error) => error.status === status && (!message || error.message === message));

  /* Tühi algus. */
  assert.deepEqual((await listJourneyAssessments(person.id, journey.id, { db })).assessments, { baseline: null, latest: null, change: null, items: [] });

  /* ALGSEIS: esimene märge; muutust veel ei ole. */
  const key = randomUUID();
  let picture = (await createJourneyAssessment(person.id, journey.id, { level: 2, note: ' Ei saa üksi poes käia. ', clientActionId: key }, at('2026-10-01T08:00:00Z'))).assessments;
  assert.deepEqual([picture.baseline.level, picture.baseline.note, picture.baseline.change, picture.latest, picture.change], [2, 'Ei saa üksi poes käia.', 'BASELINE', null, null]);
  /* Kordussaatmine sama võtmega ei tee teist märget; sama võti teisel Teekonnal on viga. */
  picture = (await createJourneyAssessment(person.id, journey.id, { level: 2, clientActionId: key }, at('2026-10-01T08:00:05Z'))).assessments;
  assert.equal(picture.items.length, 1);
  await refused(createJourneyAssessment(person.id, other.id, { level: 3, clientActionId: key }, { db }), 409, 'journeys.errors.idempotency_conflict');

  /* HILISEMAD MÄRKED: muutus on võrreldes algseisuga, loend uuemast vanemani. */
  await createJourneyAssessment(person.id, journey.id, { level: 1, note: 'Kukkusin uuesti.' }, at('2026-10-10T08:00:00Z'));
  picture = (await createJourneyAssessment(person.id, journey.id, { level: 4, note: 'Koduteenus käib kaks korda nädalas.' }, at('2026-10-20T08:00:00Z'))).assessments;
  assert.deepEqual(picture.items.map((item) => [item.level, item.change]), [[4, 'BETTER'], [1, 'HARDER'], [2, 'BASELINE']]);
  assert.deepEqual([picture.baseline.level, picture.latest.level, picture.change], [2, 4, 'BETTER']);

  /* Sisendi kontroll ja andmebaasi enda piir. */
  await refused(createJourneyAssessment(person.id, journey.id, {}, { db }), 400, 'journeys.errors.assessment_level_required');
  await refused(createJourneyAssessment(person.id, journey.id, { level: 6 }, { db }), 400, 'journeys.errors.assessment_level_required');
  await assert.rejects(db.journeyAssessment.create({ data: { journeyId: journey.id, ownerUserId: person.id, level: 0 } }), /JourneyAssessment_level_check/);

  /* VÕÕRA PIIR: teine inimene ei näe, ei lisa ega kustuta; teise Teekonna kaudu märget kätte ei saa. */
  const firstId = picture.baseline.id;
  await refused(listJourneyAssessments(stranger.id, journey.id, { db }), 404, 'journeys.errors.not_found');
  await refused(createJourneyAssessment(stranger.id, journey.id, { level: 5 }, { db }), 404, 'journeys.errors.not_found');
  await refused(deleteJourneyAssessment(stranger.id, journey.id, firstId, { db }), 404, 'journeys.errors.not_found');
  await refused(deleteJourneyAssessment(stranger.id, foreign.id, firstId, { db }), 404, 'journeys.errors.assessment_not_found');
  await refused(deleteJourneyAssessment(person.id, other.id, firstId, { db }), 404, 'journeys.errors.assessment_not_found');
  assert.equal(await db.journeyAssessment.count({ where: { journeyId: journey.id } }), 3);

  /* Teekonna leht ja uuendamise vastus kannavad hinnanguid kaasa. */
  const detail = await getJourneyDetailForUser(person.id, journey.id, { db });
  assert.equal(detail.assessments.change, 'BETTER');
  /* Paberleht (K1-e) loeb sama pilti: algseis, viimane märge ja muutus sõnadega. */
  const paper = renderPaperSheetHtml({ journey: detail, parts: ['assessment'], locale: 'et' });
  assert.ok(paper.includes('Võrreldes algusega on läinud paremaks.') && paper.includes('Koduteenus käib kaks korda nädalas.'));
  const updated = await updateJourneyForUser(person.id, journey.id, { title: 'Ema vajab kodus abi', expectedUpdatedAt: detail.updatedAt }, { db });
  assert.equal(updated.assessments.items.length, 3);

  /* VÄLJAVÕTTED: inimese Teekonna fail ja andmekoopia kannavad tema märkeid; võõra omi mitte. */
  const exported = await exportJourneyForUser(person.id, journey.id, { db });
  assert.deepEqual(exported.assessments.map((item) => [item.level, item.change]), [[4, 'BETTER'], [1, 'HARDER'], [2, 'BASELINE']]);
  assert.ok(JSON.stringify(exported).includes('Koduteenus käib kaks korda nädalas.'));
  await createJourneyAssessment(stranger.id, foreign.id, { level: 3, note: 'Võõra märge.' }, { db });
  const entry = DATA_EXPORT_REGISTRY.find((item) => item.name === 'journeys');
  const file = (await entry.collect({ db, userId: person.id })).find((item) => item.name === 'journey_assessments.ndjson');
  assert.equal(file.count, 3);
  assert.ok(file.content.toString('utf8').includes('Kukkusin uuesti.'));
  assert.equal(file.content.toString('utf8').includes('Võõra märge.'), false);
  assert.equal(file.content.toString('utf8').includes('clientActionId'), false);

  /* KUSTUTAMINE: valesti pandud algseisu kustutamisel saab algseisuks järgmine märge. */
  picture = (await deleteJourneyAssessment(person.id, journey.id, firstId, { db })).assessments;
  assert.deepEqual(picture.items.map((item) => [item.level, item.change]), [[4, 'BETTER'], [1, 'BASELINE']]);
  await refused(deleteJourneyAssessment(person.id, journey.id, firstId, { db }), 404, 'journeys.errors.assessment_not_found');

  /* Piir: Teekonnal on kuni 60 märget. */
  await db.journeyAssessment.createMany({ data: Array.from({ length: 60 }, () => ({ journeyId: other.id, ownerUserId: person.id, level: 3 })) });
  await refused(createJourneyAssessment(person.id, other.id, { level: 3 }, { db }), 409, 'journeys.errors.assessment_limit_reached');

  /* ARHIVEERITUD Teekond: märkeid saab lugeda, mitte lisada ega kustutada. */
  const current = await getJourneyDetailForUser(person.id, journey.id, { db });
  await updateJourneyForUser(person.id, journey.id, { status: 'ARCHIVED', expectedUpdatedAt: current.updatedAt }, { db });
  assert.equal((await listJourneyAssessments(person.id, journey.id, { db })).assessments.items.length, 2);
  await refused(createJourneyAssessment(person.id, journey.id, { level: 5 }, { db }), 409, 'journeys.errors.archived');
  await refused(deleteJourneyAssessment(person.id, journey.id, picture.items[0].id, { db }), 409, 'journeys.errors.archived');

  /* Kaskaad: Teekonna kustutus viib märked kaasa. */
  await db.journey.delete({ where: { id: other.id } });
  assert.equal(await db.journeyAssessment.count({ where: { journeyId: other.id } }), 0);
});
