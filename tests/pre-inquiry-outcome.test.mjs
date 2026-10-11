// Pöörduja näeb oma eelpöördumise juures, mida asutus sellega tegi: lükkas tagasi või lõpetas
// töö, millal, ja asutuse selgitust.
//
// Viga, mille pärast see fail on (omanik 11.10.2026: „ei saa vist nii"): asutuse vastuvõtulaud
// lõpetab töö kahel viisil, aga pöörduja sai mõlemal juhul sama teate ja nägi oma pöördumise
// juures endiselt „vastu võetud" või „vastatud". Tagasilükkamist ega põhjust ta ei näinud.
//
// Asutuse pool (selgitus on tagasilükkamisel kohustuslik) on failis
// tests/org-inbox-manual-status.test.mjs; päris andmebaasiga käib sama lugu failis
// tests/org-inbox-manual-status.integration.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { keepReplyFacts, sentInquiryView } from '../components/workspace/preInquiry/senderModel.js';
import { NOTIFICATION_EVENT_TYPES, assertNotificationRecipient } from '../lib/notifications.js';
import { INBOX_CLOSING_NOTE_LIMIT } from '../lib/org/constants.js';
import { OrganizationOutcomeKind, readOrganizationOutcomes, withOrganizationOutcome } from '../lib/preInquiryOutcome.js';
import { PRE_INQUIRY_SENDER_STATE_KEYS, organizationOutcomeOf, preInquirySenderState, preInquirySenderTone } from '../lib/preInquirySenderState.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const catalog = (lang) => JSON.parse(read(`../messages/${lang}.json`));
const LANGS = ['et', 'en', 'ru'];

const CLOSED_AT = new Date('2026-10-11T16:39:00.000Z');
const NOTE = 'See ei kuulu meie valla pädevusse. Palun pöördu oma elukoha valla sotsiaalosakonda.';

/* Andmebaasi kaksik: vastuvõtulaua kirjed ja pöördumiste ruumid. */
function fakeDb({ items = [], rooms = [], inquiries = [] } = {}) {
  const calls = [];
  const within = (value, rule) => (rule && typeof rule === 'object' && 'in' in rule ? rule.in.includes(value) : value === rule);
  return {
    calls,
    organizationInboxItem: {
      findMany: async ({ where }) => {
        calls.push('item.findMany');
        return items.filter((row) => row.sourceType === where.sourceType && within(row.sourceId, where.sourceId) && within(row.status, where.status));
      },
      findFirst: async ({ where }) => items.find((row) => row.sourceType === where.sourceType && row.sourceId === where.sourceId && within(row.status, where.status)) || null
    },
    room: {
      findMany: async ({ where }) => {
        calls.push('room.findMany');
        return rooms.filter((room) => within(room.originType, where.originType) && within(room.originId, where.originId)).map(({ originId }) => ({ originId }));
      }
    },
    preInquiry: {
      findFirst: async ({ where }) =>
        inquiries.find((row) => row.id === where.id && row.authorId === where.authorId && (where.recalledAt !== null || row.recalledAt === null)) || null
    }
  };
}
const item = (sourceId, status, over = {}) => ({ sourceType: 'PRE_INQUIRY', sourceId, status, closedAt: CLOSED_AT, closedReason: null, ...over });
const sent = (id, over = {}) => ({
  id,
  authorId: 'u1',
  status: 'SENT',
  deliveryChannel: 'INTERNAL',
  recipientOrganizationId: 'o1',
  sentAt: '2026-10-10T08:00:00.000Z',
  openedAt: '2026-10-10T09:00:00.000Z',
  recalledAt: null,
  supersededById: null,
  ...over
});

test('asutuse otsus loetakse ainult lõpetatud töölt: tagasi lükatud või suletud, aeg, selgitus ja kas ruum on', async () => {
  const db = fakeDb({
    items: [
      item('p-declined', 'REJECTED', { closedReason: `  ${NOTE} ` }),
      item('p-closed', 'CLOSED'),
      item('p-open', 'ACCEPTED', { closedAt: null }),
      item('p-recalled', 'RECALLED'),
      { ...item('p-other-source', 'REJECTED'), sourceType: 'HELP_REQUEST' }
    ],
    rooms: [{ originType: 'PRE_INQUIRY', originId: 'p-closed' }, { originType: 'PRE_INQUIRY', originId: 'p-open' }]
  });
  const outcomes = await readOrganizationOutcomes(['p-declined', 'p-closed', 'p-open', 'p-recalled', 'p-other-source', 'p-declined', ' '], { db });
  assert.deepEqual([...outcomes.keys()].sort(), ['p-closed', 'p-declined']);
  assert.deepEqual(outcomes.get('p-declined'), { kind: OrganizationOutcomeKind.DECLINED, at: CLOSED_AT, note: NOTE, hasRoom: false });
  assert.deepEqual(outcomes.get('p-closed'), { kind: OrganizationOutcomeKind.CLOSED, at: CLOSED_AT, note: '', hasRoom: true });

  /* Tühi loend ei jõua päringusse (Prisma jätaks tingimuse vahele ja loeks kõik kirjed). */
  const idle = fakeDb();
  assert.equal((await readOrganizationOutcomes([], { db: idle })).size, 0);
  assert.equal((await readOrganizationOutcomes(['', null], { db: idle })).size, 0);
  assert.deepEqual(idle.calls, []);
  /* Kui ühegi pöördumisega ei ole töö lõppenud, ruume ei küsita. */
  const none = fakeDb({ items: [item('p1', 'ACCEPTED')] });
  await readOrganizationOutcomes(['p1'], { db: none });
  assert.deepEqual(none.calls, ['item.findMany']);
});

test('otsus lisatakse ainult pöörduja ENDA asutusele saadetud ridadele', async () => {
  const db = fakeDb({ items: [item('p1', 'REJECTED', { closedReason: NOTE }), item('p2', 'REJECTED', { closedReason: NOTE }), item('p3', 'CLOSED'), item('p4', 'REJECTED'), item('p5', 'REJECTED')] });
  const rows = [
    sent('p1'),
    sent('p2', { authorId: 'u2' }), /* teise inimese pöördumine (saaja vaade) */
    sent('p3'),
    sent('p4', { recalledAt: '2026-10-10T08:30:00.000Z' }), /* tagasi võetud */
    sent('p5', { recipientOrganizationId: null }), /* nimelisele saajale */
    sent('p6', { sentAt: null, status: 'DRAFT' }) /* saatmata */
  ];
  const out = await withOrganizationOutcome('u1', rows, { db });
  assert.deepEqual(out.map((row) => [row.id, row.organizationOutcome?.kind || null]), [['p1', 'declined'], ['p2', null], ['p3', 'closed'], ['p4', null], ['p5', null], ['p6', null]]);
  /* Aeg läheb kliendile sõnena; selgitus on asutuse tekst pöördujale. */
  assert.deepEqual(out[0].organizationOutcome, { kind: 'declined', at: CLOSED_AT.toISOString(), note: NOTE, hasRoom: false });
  /* Read, millele midagi ei lisandu, jäävad samaks objektiks. */
  assert.equal(out[1], rows[1]);
  assert.equal('organizationOutcome' in out[5], false);

  /* Vaataja puudub, loend on tühi või lugemine ebaõnnestub: read tulevad muutmata tagasi. */
  assert.equal(await withOrganizationOutcome('', rows, { db }), rows);
  assert.deepEqual(await withOrganizationOutcome('u1', null, { db }), []);
  const broken = { organizationInboxItem: { findMany: async () => { throw new Error('ühendus katkes'); } } };
  assert.equal(await withOrganizationOutcome('u1', rows, { db: broken }), rows);
  /* Kui ühegi reaga ei ole töö lõppenud, tuleb sama loend tagasi. */
  assert.equal(await withOrganizationOutcome('u1', rows, { db: fakeDb() }), rows);
});

test('seis nii, nagu pöörduja seda näeb: asutuse otsus läheb ette vastuvõtmisest ja vastusest', () => {
  for (const key of ['declined', 'work_closed']) assert.ok(PRE_INQUIRY_SENDER_STATE_KEYS.includes(key), key);
  const declined = sent('p1', { replyCount: 2, organizationOutcome: { kind: 'declined', at: CLOSED_AT.toISOString(), note: NOTE, hasRoom: false } });
  assert.deepEqual(preInquirySenderState(declined), { key: 'declined', at: CLOSED_AT.toISOString() });
  const closed = sent('p2', { replyCount: 1, organizationOutcome: { kind: 'closed', at: CLOSED_AT.toISOString(), note: '', hasRoom: true } });
  assert.deepEqual(preInquirySenderState(closed), { key: 'work_closed', at: CLOSED_AT.toISOString() });
  /* Ilma otsuseta on kõik nagu enne. */
  assert.equal(preInquirySenderState(sent('p3', { replyCount: 1 })).key, 'answered');
  assert.equal(preInquirySenderState(sent('p4')).key, 'accepted');
  /* Tagasi võetud või parandusega asendatud pöördumisel asutuse otsust ei näidata. */
  assert.equal(preInquirySenderState({ ...declined, recalledAt: '2026-10-10T08:30:00.000Z' }).key, 'recalled');
  assert.equal(preInquirySenderState({ ...declined, supersededById: 'p9' }).key, 'replaced');
  assert.equal(organizationOutcomeOf({ ...declined, recalledAt: '2026-10-10T08:30:00.000Z' }), null);
  /* Tundmatu liik ei tee seisu: parem vana seis kui väljamõeldud. */
  assert.equal(preInquirySenderState(sent('p5', { organizationOutcome: { kind: 'midagi', at: null } })).key, 'accepted');
  for (const key of ['declined', 'work_closed']) assert.equal(preInquirySenderTone(key), 'quiet', key);
});

test('saadetud pöördumise vaade: mis edasi saab, asutuse selgitus ja mida enam teha ei saa', () => {
  const declined = sentInquiryView(sent('p1', { organizationOutcome: { kind: 'declined', at: CLOSED_AT.toISOString(), note: ` ${NOTE} `, hasRoom: false } }));
  assert.equal(declined.state.key, 'declined');
  assert.equal(declined.next, 'declined');
  assert.deepEqual(declined.outcome, { kind: 'declined', at: CLOSED_AT.toISOString(), note: NOTE });
  /* Ruumi ei ole ja seda enam ei teki: nupp annaks eksitava keeldumise („ootab vastuvõtmist”). */
  assert.equal(declined.actions.room, false);
  /* Asutus selle pöördumisega ei tegele: paranduse vihjet ei näidata. */
  assert.equal(declined.actions.correct, false);
  assert.equal(declined.actions.recall, false);

  /* Suletud töö, mille ruum on olemas: ruumi saab lugeda. */
  const closed = sentInquiryView(sent('p2', { organizationOutcome: { kind: 'closed', at: CLOSED_AT.toISOString(), note: '', hasRoom: true } }));
  assert.deepEqual([closed.state.key, closed.next, closed.outcome.note, closed.actions.room, closed.actions.correct], ['work_closed', 'work_closed', '', true, false]);

  /* Töös olev pöördumine: otsust ei ole ja tegevused on nagu enne. */
  const open = sentInquiryView(sent('p3'));
  assert.deepEqual([open.outcome, open.actions.room, open.actions.correct], [null, true, true]);

  /* Muutmise vastus ei kanna otsust: loendi rea asendamisel jääb see alles, nagu vastuste arv. */
  const listRow = sent('p1', { replyCount: 2, lastReplyAt: 'x', organizationOutcome: { kind: 'declined', at: null, note: NOTE, hasRoom: false } });
  const fromMutation = sent('p1');
  const kept = keepReplyFacts(listRow, fromMutation);
  assert.deepEqual([kept.replyCount, kept.organizationOutcome.kind], [2, 'declined']);
  assert.equal(keepReplyFacts(sent('p1', { replyCount: 0 }), fromMutation).organizationOutcome, undefined);
  const fresh = { ...fromMutation, replyCount: 0, organizationOutcome: null };
  assert.equal(keepReplyFacts(listRow, fresh), fresh, 'vastus, mis kannab mõlemat fakti, jääb samaks objektiks');
});

test('tekstid on kolmes keeles ja vaade näitab selgitust', () => {
  for (const lang of LANGS) {
    const page = catalog(lang).workspace_feature_pages.pre_inquiries;
    for (const key of ['declined', 'work_closed']) {
      assert.ok(page.sender_state[key].includes('{date}'), `${lang}: sender_state.${key}`);
      assert.ok(page.views.sent.next[key].length > 30, `${lang}: next.${key}`);
    }
    assert.equal(typeof page.views.sent.outcome_note, 'string', lang);
    const notice = catalog(lang).notifications.events.pre_inquiry_declined;
    assert.ok(notice.length > 15 && !/[—–]/.test(notice), lang);
    assert.notEqual(notice, catalog(lang).notifications.events.pre_inquiry_work_closed, `${lang}: tagasilükkamise teade ei ole sama mis töö lõpetamise oma`);
  }
  for (const key of ['declined', 'work_closed']) assert.ok(!/[—–]| - |"/.test(catalog('et').workspace_feature_pages.pre_inquiries.views.sent.next[key]), key);
  /* Loend ja üksik pöördumine annavad otsuse kaasa; vaade näitab selgitust. */
  assert.ok(read('../app/api/pre-inquiries/route.js').includes('inquiries: await withOrganizationOutcome(auth.userId, await withPreInquiryReplies(auth.userId, page.items))'));
  assert.ok(read('../app/api/pre-inquiries/[id]/route.js').includes('await withOrganizationOutcome('));
  assert.ok(read('../components/workspace/WorkspaceFeaturePage.jsx').includes('note={sentView.outcome?.note ? { label: tr("views.sent.outcome_note", "Asutuse selgitus"), text: sentView.outcome.note } : null}'));
  assert.ok(read('../components/workspace/preInquiry/FlowViews.jsx').includes('data-outcome-note="1"'));
  /* Selgitus tuleb üldise lause „mis edasi saab” asemele: mõlemad korraga vaatesse ei mahu
     (mõõdetud 1536 × 640 aknas pikima lubatud selgitusega, eesti ja vene keeles). */
  assert.ok(read('../components/workspace/WorkspaceFeaturePage.jsx').includes('next={sentView.next && !sentView.outcome?.note ? tr(`views.sent.next.${sentView.next}`, "") : ""}'));
  /* Laused „mis edasi saab” mahuvad ühele reale (kuni 95 märki), et vaade ei kasvaks. */
  for (const lang of LANGS) {
    const next = catalog(lang).workspace_feature_pages.pre_inquiries.views.sent.next;
    for (const key of ['declined', 'work_closed']) assert.ok(next[key].length <= 95, `${lang}: ${key} on ${next[key].length} märki`);
  }
  /* Selgituse pikkuspiir on see, millega vaade mõõdeti. */
  assert.equal(INBOX_CLOSING_NOTE_LIMIT, 400);
});

test('tagasilükkamise teade: ainult pöördumise autorile ja ainult seni, kuni pöördumine on tagasi lükatud', async () => {
  assert.equal(NOTIFICATION_EVENT_TYPES.PRE_INQUIRY_DECLINED, 'PRE_INQUIRY_DECLINED');
  const world = (status, inquiry = {}) =>
    fakeDb({ items: [item('p1', status)], inquiries: [{ id: 'p1', authorId: 'u1', recalledAt: null, ...inquiry }] });
  const recipient = (db, userId) => assertNotificationRecipient(db, { type: 'PRE_INQUIRY_DECLINED', userId, sourceId: 'p1', targetId: 'p1' });

  await recipient(world('REJECTED'), 'u1');
  /* Keegi teine seda teadet ei saa. */
  await assert.rejects(recipient(world('REJECTED'), 'u2'), (error) => error.status === 404);
  /* Suletud töö teade on teine liik; töös oleva või saatja tagasi võetud pöördumise kohta teadet ei ole. */
  for (const status of ['CLOSED', 'ACCEPTED', 'RECALLED']) {
    await assert.rejects(recipient(world(status), 'u1'), (error) => error.status === 404, status);
  }
  await assert.rejects(recipient(world('REJECTED', { recalledAt: new Date() }), 'u1'), (error) => error.status === 404);

  /* Server saadab tagasilükkamisel selle liigi ja sulgemisel vana. */
  const inbox = read('../lib/org/inbox.js');
  assert.ok(inbox.includes('type: declined ? NOTIFICATION_EVENT_TYPES.PRE_INQUIRY_DECLINED : NOTIFICATION_EVENT_TYPES.PRE_INQUIRY_WORK_CLOSED'));
  assert.ok(inbox.includes('declined: toStatus === OrganizationInboxStatus.REJECTED'));
});
