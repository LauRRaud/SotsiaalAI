// Asutuse vastuvõtulaud: postkastikirje seis pärast töö üleandmist.
//
// Viga, mille pärast see fail on: töö määrati, töötaja võttis vastu ja andis edasi. Uus
// määramine ootas vastust, aga kirje jäi serveris seisu „vastu võetud", sest seisutabelis
// ei ole siiret ACCEPTED → ASSIGNED. Leht varjas seda oma kuvareegliga (`shownItemStatus`),
// loend, filtrid ja eksport aga lugesid valet seisu.
//
// Andmebaasi asemel on mälus hoitav kaksik, mis vastab ainult neile päringutele, mida need
// rajad teevad. Päris andmebaasiga käib sama lugu failis
// tests/org-inbox-handover-status.integration.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { shownItemStatus } from '../components/org/inbox/inboxRules.js';
import { WorkspaceContextKind } from '../lib/org/accessContext.js';
import { OrganizationInboxStatus, canTransitionInboxStatus, inboxStatusAfterHandOver, isTerminalInboxStatus } from '../lib/org/constants.js';
import { assignWork, getInboxItem, handOverWork, listInboxItemPage, respondToAssignment, transitionInboxItem } from '../lib/org/inbox.js';

process.env.ORG_WORKSPACE_ENABLED = '1';
process.env.ORG_INBOX_ENABLED = '1';

const ORG = 'org-1';
const SENT = new Date('2026-10-10T08:00:00Z');
const ASSIGNED_AT = new Date('2026-10-10T09:00:00Z');
const ACCEPTED_AT = new Date('2026-10-10T10:00:00Z');
const HANDED_AT = new Date('2026-10-11T08:00:00Z');
const LATER = new Date('2026-10-11T09:00:00Z');
const LIVE = ['PENDING', 'ACCEPTED'];

const matches = (value, rule) => {
  if (rule && typeof rule === 'object' && !(rule instanceof Date)) {
    if ('in' in rule) return rule.in.includes(value);
    if ('notIn' in rule) return !rule.notIn.includes(value);
    if ('not' in rule) return value !== rule.not;
  }
  return value === rule;
};

/** Lähteseis: pöörduja saatis pöördumise asutuse lauale ja koordinaator on selle avanud. */
function makeDb() {
  let seq = 0;
  const id = (prefix) => `${prefix}-${++seq}`;
  const state = {
    inquiry: { id: 'p1', authorId: 'pöörduja', status: 'SENT', sentAt: SENT, openedAt: SENT, recalledAt: null, topic: 'Koduteenus', situation: 'Ema ei saa enam ise poes käia.' },
    item: { id: 'i1', organizationId: ORG, unitId: null, sourceType: 'PRE_INQUIRY', sourceId: 'p1', status: 'RECEIVED', receivedAt: SENT, lastTransitionAt: SENT, dueAt: null, urgencyDeclaredBySender: null },
    memberships: ['koordinaator', 'mari', 'jüri', 'tiit'].map((userId) => ({ id: `m-${userId}`, organizationId: ORG, userId, status: 'ACTIVE', jobTitle: null })),
    assignments: [],
    audits: []
  };

  const membership = (membershipId) => state.memberships.find((row) => row.id === membershipId) || null;
  const withAssignee = (row) => ({ ...row, assignee: { ...membership(row.assigneeMembershipId), user: { profile: null } } });
  const liveAssignments = () => state.assignments.filter((row) => LIVE.includes(row.status)).map(withAssignee);
  const itemMatches = (where) => {
    for (const key of ['id', 'organizationId']) {
      if (key in where && state.item[key] !== where[key]) return false;
    }
    return !('status' in where) || matches(state.item.status, where.status);
  };

  const client = {
    $queryRaw: async () => [],
    preInquiry: {
      /* Teavitused ei ole selle testi teema: autori teavitaja küsib pöördumist ilma `id`
         väljata ja lõpetab tühja vastuse peale enne kirjutamist. */
      findUnique: async ({ where, select }) => (select?.id && where.id === state.inquiry.id ? { ...state.inquiry } : null),
      updateMany: async () => ({ count: 0 })
    },
    organizationInboxItem: {
      findFirst: async ({ where }) => (itemMatches(where) ? { ...state.item, assignments: liveAssignments() } : null),
      findUnique: async ({ where }) => (where.id === state.item.id ? { ...state.item } : null),
      findMany: async ({ where }) => (itemMatches(where) ? [{ ...state.item, unit: null, assignments: liveAssignments() }] : []),
      update: async ({ data }) => Object.assign(state.item, data)
    },
    organizationWorkAssignment: {
      findFirst: async ({ where }) => {
        const row = state.assignments.find(
          (entry) => entry.id === where.id && (!('assigneeMembershipId' in where) || entry.assigneeMembershipId === where.assigneeMembershipId)
        );
        return row && where.inboxItem.organizationId === ORG ? { ...withAssignee(row), inboxItem: { ...state.item } } : null;
      },
      findUnique: async ({ where }) => ({ ...state.assignments.find((row) => row.id === where.id) }),
      updateMany: async ({ where, data }) => {
        const rows = state.assignments.filter(
          (row) => (!where.id || row.id === where.id) && (!where.inboxItemId || row.inboxItemId === where.inboxItemId) && matches(row.status, where.status)
        );
        rows.forEach((row) => Object.assign(row, data));
        return { count: rows.length };
      },
      create: async ({ data }) => {
        const row = { id: id('a'), ...data };
        state.assignments.push(row);
        return { ...row };
      }
    },
    organizationMembership: {
      findFirst: async ({ where }) => state.memberships.find((row) => row.id === where.id && row.organizationId === where.organizationId && row.status === where.status) || null,
      /* Sama põhjus mis ülal: vastutaja teavitaja lõpetab tühja vastuse peale. */
      findUnique: async () => null
    },
    /* Vestlusruumi sellel pöördumisel ei ole; ruumi reeglid on failis org-inbox-room.test.mjs. */
    room: { findFirst: async () => null },
    dataAuditLog: { create: async ({ data }) => state.audits.push(data) },
    sharingView: { createMany: async () => ({ count: 1 }) }
  };
  client.$transaction = async (run) => run(client);
  return { db: client, state };
}

const context = (userId, capabilities = []) => ({
  kind: WorkspaceContextKind.ORGANIZATION,
  userId,
  organization: { id: ORG },
  membership: { id: `m-${userId}` },
  capabilities: capabilities.map((capability) => ({ capability, scopeType: 'ORGANIZATION' }))
});
const coordinator = () => context('koordinaator', ['INBOX_COORDINATOR', 'WORK_ASSIGNER']);
const noCalls = async () => null;
const live = (state) => state.assignments.filter((row) => LIVE.includes(row.status)).map((row) => [row.assigneeMembershipId, row.status]);
const conflict = (promise, message) => assert.rejects(promise, (error) => error.status === 409 && error.message === message);

/** Koordinaator määrab töö Mari-le ja Mari võtab vastu. Tagastab Mari määramise. */
async function assignedAndAccepted(db) {
  const first = await assignWork(coordinator(), 'i1', { assigneeMembershipId: 'm-mari' }, { db, now: ASSIGNED_AT });
  await respondToAssignment(context('mari'), first.id, { accept: true }, { db, now: ACCEPTED_AT });
  return first;
}
const handOver = (db, who, assignmentId, toMembershipId, reason) =>
  handOverWork(who, assignmentId, { toMembershipId, reason }, { db, now: HANDED_AT, releaseFromCalls: noCalls });

test('üleandmine: vastu võetud kirje läheb seisu „määratud”, sest uus vastutaja ei ole veel vastanud', async () => {
  const { db, state } = makeDb();
  const first = await assignWork(coordinator(), 'i1', { assigneeMembershipId: 'm-mari' }, { db, now: ASSIGNED_AT });
  assert.equal(state.item.status, 'ASSIGNED');
  await respondToAssignment(context('mari'), first.id, { accept: true }, { db, now: ACCEPTED_AT });
  assert.equal(state.item.status, 'ACCEPTED');
  assert.equal(state.item.lastTransitionAt, ACCEPTED_AT);

  /* Mari annab töö Jürile: elav määramine on Jüri oma ja ootab vastust. */
  const second = await handOver(db, context('mari'), first.id, 'm-jüri', 'puhkus');
  assert.deepEqual(live(state), [['m-jüri', 'PENDING']]);
  assert.equal(second.supersedesAssignmentId, first.id);

  /* Kirje seis käib elava määramisega kaasa ja siire on samas tehingus üleandmisega. */
  assert.equal(state.item.status, 'ASSIGNED');
  assert.equal(state.item.lastTransitionAt, HANDED_AT);

  /* Üleandmise auditirida ütleb, kust kuhu kirje läks; teist rida sama teo kohta ei teki. */
  const handed = state.audits.filter((row) => row.action === 'org.work_handed_over');
  assert.equal(handed.length, 1);
  assert.equal(handed[0].resourceId, second.id);
  assert.equal(handed[0].actorUserId, 'mari');
  assert.equal(handed[0].targetUserId, 'jüri');
  assert.deepEqual(handed[0].meta, {
    organizationId: ORG,
    inboxItemId: 'i1',
    assignmentId: first.id,
    membershipId: 'm-jüri',
    reason: 'puhkus',
    fromInboxStatus: 'ACCEPTED',
    toInboxStatus: 'ASSIGNED'
  });
  assert.deepEqual(state.audits.map((row) => row.action), ['org.work_assigned', 'org.work_accepted', 'org.work_handed_over']);
});

test('pärast üleandmist: uue vastutaja vastuvõtt viib kirje seisu „vastu võetud”, tagasilükkamine seisu „ootab määramist”', async () => {
  const accepting = makeDb();
  const first = await assignedAndAccepted(accepting.db);
  const second = await handOver(accepting.db, coordinator(), first.id, 'm-jüri');
  await respondToAssignment(context('jüri'), second.id, { accept: true }, { db: accepting.db, now: LATER });
  assert.equal(accepting.state.item.status, 'ACCEPTED');
  assert.equal(accepting.state.item.lastTransitionAt, LATER);
  assert.deepEqual(live(accepting.state), [['m-jüri', 'ACCEPTED']]);

  /* Tagasilükkamine käitub nagu enne: elavat vastutajat ei ole ja töö ootab uut määramist. */
  const rejecting = makeDb();
  const mine = await assignedAndAccepted(rejecting.db);
  const next = await handOver(rejecting.db, coordinator(), mine.id, 'm-jüri');
  await respondToAssignment(context('jüri'), next.id, { accept: false, reason: 'koormus' }, { db: rejecting.db, now: LATER });
  assert.equal(rejecting.state.item.status, 'ASSIGNMENT_PENDING');
  assert.deepEqual(live(rejecting.state), []);
  /* Sealt saab koordinaator töö uuesti määrata. */
  await assignWork(coordinator(), 'i1', { assigneeMembershipId: 'm-tiit' }, { db: rejecting.db, now: LATER });
  assert.equal(rejecting.state.item.status, 'ASSIGNED');
  assert.deepEqual(live(rejecting.state), [['m-tiit', 'PENDING']]);
});

test('vastamata määramise üleandmine: kirje oli juba „määratud”, seis ega siirde aeg ei muutu', async () => {
  const { db, state } = makeDb();
  const first = await assignWork(coordinator(), 'i1', { assigneeMembershipId: 'm-mari' }, { db, now: ASSIGNED_AT });
  await handOver(db, coordinator(), first.id, 'm-jüri');
  assert.equal(state.item.status, 'ASSIGNED');
  assert.equal(state.item.lastTransitionAt, ASSIGNED_AT);
  assert.deepEqual(live(state), [['m-jüri', 'PENDING']]);
  /* Seis ei liikunud, seega auditirida siiret ei väida. */
  const meta = state.audits.find((row) => row.action === 'org.work_handed_over').meta;
  assert.equal('fromInboxStatus' in meta, false);
  assert.equal('toInboxStatus' in meta, false);
});

test('seisu lugejad pärast üleandmist: loend, seisufilter ja avatud kirje ütlevad „määratud”', async () => {
  const { db } = makeDb();
  const first = await assignedAndAccepted(db);
  const page = (status) => listInboxItemPage(coordinator(), { db, status, now: LATER });
  const rows = async (status) => (await page(status)).items.map((row) => [row.id, row.status, row.assignment?.membershipId, row.assignment?.status]);

  /* Enne üleandmist on töö vastu võetud ja filter leiab ta sealt. */
  assert.deepEqual(await rows('ACCEPTED'), [['i1', 'ACCEPTED', 'm-mari', 'ACCEPTED']]);
  assert.deepEqual(await rows('ASSIGNED'), []);

  const second = await handOver(db, context('mari'), first.id, 'm-jüri');
  assert.deepEqual(await rows('ASSIGNED'), [['i1', 'ASSIGNED', 'm-jüri', 'PENDING']]);
  assert.deepEqual(await rows('ACCEPTED'), [], 'vastu võetud tööde filter ei näita tööd, mida uus vastutaja ei ole vastu võtnud');
  assert.deepEqual(await rows(), [['i1', 'ASSIGNED', 'm-jüri', 'PENDING']]);

  /* Avatud kirje: sama seis koordinaatorile ja uuele vastutajale; ruumi nuppu enne vastuvõtmist ei ole. */
  for (const viewer of [coordinator(), context('jüri')]) {
    const seen = await getInboxItem(viewer, 'i1', { db, now: LATER });
    assert.equal(seen.status, 'ASSIGNED');
    assert.deepEqual(seen.assignment, { id: second.id, status: 'PENDING', membershipId: 'm-jüri' });
    assert.deepEqual(seen.room, { canOpen: false, id: null });
    /* Lehe kuvareegel ei pea enam midagi parandama: server ütleb sama. */
    assert.equal(shownItemStatus(seen), seen.status);
  }
  /* Endine vastutaja kirjet enam ei ava. */
  await assert.rejects(getInboxItem(context('mari'), 'i1', { db, now: LATER }), (error) => error.status === 404);

  await respondToAssignment(context('jüri'), second.id, { accept: true }, { db, now: LATER });
  assert.deepEqual(await rows('ACCEPTED'), [['i1', 'ACCEPTED', 'm-jüri', 'ACCEPTED']]);
  const accepted = await getInboxItem(context('jüri'), 'i1', { db, now: LATER });
  assert.equal(accepted.status, 'ACCEPTED');
  assert.equal(accepted.room.canOpen, true);
});

test('enne parandust üle antud rida: leht näitab „määratud” ja iga järgmine samm viib serveri seisu õigeks', async () => {
  /* Vana rida: kirje ACCEPTED, elav määramine PENDING. */
  const stale = () => {
    const made = makeDb();
    Object.assign(made.state.item, { status: 'ACCEPTED', lastTransitionAt: ACCEPTED_AT });
    made.state.assignments.push({ id: 'a-old', inboxItemId: 'i1', assigneeMembershipId: 'm-jüri', status: 'PENDING', assignedAt: HANDED_AT });
    return made;
  };

  const shown = stale();
  const row = (await listInboxItemPage(coordinator(), { db: shown.db, now: LATER })).items[0];
  assert.deepEqual([row.status, row.assignment.status], ['ACCEPTED', 'PENDING']);
  assert.equal(shownItemStatus(row), 'ASSIGNED');

  const accepted = stale();
  await respondToAssignment(context('jüri'), 'a-old', { accept: true }, { db: accepted.db, now: LATER });
  assert.deepEqual([accepted.state.item.status, live(accepted.state)], ['ACCEPTED', [['m-jüri', 'ACCEPTED']]]);

  const rejected = stale();
  await respondToAssignment(context('jüri'), 'a-old', { accept: false }, { db: rejected.db, now: LATER });
  assert.deepEqual([rejected.state.item.status, live(rejected.state)], ['ASSIGNMENT_PENDING', []]);

  const handedOn = stale();
  await handOver(handedOn.db, coordinator(), 'a-old', 'm-tiit');
  assert.deepEqual([handedOn.state.item.status, live(handedOn.state)], ['ASSIGNED', [['m-tiit', 'PENDING']]]);

  const closed = stale();
  await transitionInboxItem(coordinator(), 'i1', { toStatus: 'CLOSED' }, { db: closed.db, now: LATER, releaseFromCalls: noCalls });
  assert.deepEqual([closed.state.item.status, live(closed.state)], ['CLOSED', []]);
});

test('üleandmise siire on omaette reegel: seisutabel ja selle kaks väravat jäävad samaks', async () => {
  /* Igast avatud seisust „määratud”; lõppseis jääb lõppseisuks. */
  for (const status of Object.values(OrganizationInboxStatus)) {
    assert.equal(inboxStatusAfterHandOver(status), isTerminalInboxStatus(status) ? status : 'ASSIGNED', status);
  }
  assert.equal(inboxStatusAfterHandOver('TUNDMATU'), 'TUNDMATU');
  assert.equal(inboxStatusAfterHandOver(undefined), undefined);
  /* Tabelisse siiret ei lisatud: muidu avaneks see ka kahele väravale allpool. */
  assert.equal(canTransitionInboxStatus('ACCEPTED', 'ASSIGNED'), false);

  /* Koordinaator ei saa vastu võetud tööd käsitsi „määratuks” kirjutada. „Määratud” ei ole
     käsitsi valitav ühestki seisust (tests/org-inbox-manual-status.test.mjs). */
  const manual = makeDb();
  await assignedAndAccepted(manual.db);
  await conflict(transitionInboxItem(coordinator(), 'i1', { toStatus: 'ASSIGNED' }, { db: manual.db, now: LATER, releaseFromCalls: noCalls }), 'org.errors.inbox_status_follows_assignment');
  assert.equal(manual.state.item.status, 'ACCEPTED');

  /* Vastutajata „vastu võetud” kirjet ei saa otse uuesti määrata (SOL-ORG-08). */
  const orphan = makeDb();
  orphan.state.item.status = 'ACCEPTED';
  await conflict(assignWork(coordinator(), 'i1', { assigneeMembershipId: 'm-mari' }, { db: orphan.db, now: LATER }), 'org.errors.invalid_inbox_transition');
  assert.deepEqual(live(orphan.state), []);

  /* Suletud töö ei liigu üleandmisega kuhugi. */
  const closed = makeDb();
  const first = await assignedAndAccepted(closed.db);
  await transitionInboxItem(coordinator(), 'i1', { toStatus: 'CLOSED' }, { db: closed.db, now: LATER, releaseFromCalls: noCalls });
  await conflict(handOver(closed.db, coordinator(), first.id, 'm-jüri'), 'org.errors.inbox_item_terminal');
  assert.equal(closed.state.item.status, 'CLOSED');
});
