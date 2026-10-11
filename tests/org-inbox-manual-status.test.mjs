// Asutuse vastuvõtulaud: koordinaatori käsitsi seisumuutus (`PATCH /api/org/<id>/inbox/<kirje>`,
// `transitionInboxItem`) ei vii kirje seisu vastuollu elava töömääramisega.
//
// Viga, mille pärast see fail on: käsitsi siire küsis luba ainult seisutabelilt
// (`INBOX_STATUS_TRANSITIONS`), aga sama tabel on ka määramise ja töötaja vastuse alus. Nii sai
// koordinaator kirjutada kirje „vastu võetuks", kuigi töötaja ei olnud vastanud, „määratuks"
// ilma ühegi määramiseta ja „ootab määramist", kuigi töö oli endiselt töötaja käes.
//
// Omaniku otsus 11.10.2026: „määratud" ja „vastu võetud" tekivad ainult määramisest ja töötaja
// vastusest; „ootab määramist" tähendab käsitsi „võtan töö töötajalt tagasi" ja lõpetab elava
// määramise samas tehingus.
//
// Töö tagasivõtmisel ja teise inimese tehtud üleandmisel saab senine vastutaja teate, et töö ei
// ole enam tema vastutusel; tagasivõtmisel saab pöörduja sama neutraalse teate mis üleandmisel.
//
// Andmebaasi asemel on mälus hoitav kaksik, mis vastab ainult neile päringutele, mida need
// rajad teevad. Päris andmebaasiga käib sama lugu failis
// tests/org-inbox-manual-status.integration.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { workActions } from '../components/org/inbox/inboxRules.js';
import { serverT } from '../lib/i18n/serverMessages.js';
import { assertNotificationRecipient, createNotificationEvent, serializeNotificationEvent } from '../lib/notifications.js';
import { WorkspaceContextKind, hasCapability } from '../lib/org/accessContext.js';
import { INBOX_CLOSING_NOTE_LIMIT, INBOX_STATUS_TRANSITIONS, OrganizationInboxStatus, inboxStatusFollowsAssignment } from '../lib/org/constants.js';
import { assignWork, getInboxItem, hadWorkOnInboxItem, handOverWork, listInboxItemPage, respondToAssignment, transitionInboxItem } from '../lib/org/inbox.js';
import { ROOM_WRITE, resolveRoomAccess } from '../lib/rooms/accessGuard.js';
import { ensureRoomForPreInquiry } from '../lib/rooms/preInquiryRoom.js';

process.env.ORG_WORKSPACE_ENABLED = '1';
process.env.ORG_INBOX_ENABLED = '1';

const ORG = 'org-1';
const SENT = new Date('2026-10-10T08:00:00Z');
const ASSIGNED_AT = new Date('2026-10-10T09:00:00Z');
const ACCEPTED_AT = new Date('2026-10-10T10:00:00Z');
const NOW = new Date('2026-10-11T08:00:00Z');
const LATER = new Date('2026-10-11T09:00:00Z');
const LIVE = ['PENDING', 'ACCEPTED'];
const FOLLOWS = 'org.errors.inbox_status_follows_assignment';
const INVALID = 'org.errors.invalid_inbox_transition';
const TERMINAL = 'org.errors.inbox_item_terminal';
const SENDER_ONLY = 'org.errors.inbox_recall_is_sender_right';

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
    inquiry: {
      id: 'p1',
      authorId: 'poorduja',
      recipientOwnerId: null,
      recipientOrganizationId: ORG,
      recipientType: 'ORGANIZATION_INBOX',
      deliveryChannel: 'INTERNAL',
      status: 'SENT',
      sentAt: SENT,
      topic: 'Koduteenus',
      situation: 'Ema ei saa enam ise poes käia.',
      selectedRecipientName: 'Proovi vald',
      openedAt: SENT,
      recalledAt: null
    },
    organization: { id: ORG, status: 'ACTIVE', modules: [{ moduleKey: 'KOV_INTAKE', status: 'ACTIVE' }] },
    item: { id: 'i1', organizationId: ORG, unitId: null, sourceType: 'PRE_INQUIRY', sourceId: 'p1', status: 'RECEIVED', receivedAt: SENT, lastTransitionAt: SENT, closedAt: null, closedReason: null, urgencyDeclaredBySender: null },
    memberships: ['koordinaator', 'mari', 'jyri'].map((userId) => ({ id: `m-${userId}`, organizationId: ORG, userId, status: 'ACTIVE' })),
    assignments: [],
    rooms: [],
    roomMembers: [],
    audits: [],
    notifications: [],
    notifyFails: false
  };

  const membership = (membershipId) => state.memberships.find((row) => row.id === membershipId) || null;
  const withAssignee = (row) => ({ ...row, assignee: membership(row.assigneeMembershipId) });
  const assignmentsOf = (rule) => state.assignments.filter((row) => matches(row.status, rule)).map(withAssignee);
  /* Määramise päringud: töö rajad küsivad tunnuse ja asutuse järgi, teavituste
     adressaadikontroll kirje, seisu ja vastutaja järgi (ka „sellel kirjel ei ole tal elavat
     määramist"). */
  const assignmentMatches = (row, where) => {
    const assignee = membership(row.assigneeMembershipId);
    for (const key of ['id', 'inboxItemId', 'assigneeMembershipId']) {
      if (key in where && row[key] !== where[key]) return false;
    }
    if ('status' in where && !matches(row.status, where.status)) return false;
    if (where.assignee && !Object.entries(where.assignee).every(([key, rule]) => matches(assignee?.[key], rule))) return false;
    if (where.inboxItem?.organizationId && where.inboxItem.organizationId !== state.item.organizationId) return false;
    const none = where.inboxItem?.assignments?.none;
    return !none || !state.assignments.some((other) => assignmentMatches(other, none));
  };
  const organizationOk = (rule) =>
    !rule ||
    (state.organization.status === rule.status &&
      state.organization.modules.some((row) => row.moduleKey === rule.modules.some.moduleKey && row.status === rule.modules.some.status));
  const itemMatches = (where) => {
    for (const key of ['id', 'organizationId', 'sourceType', 'sourceId']) {
      if (key in where && state.item[key] !== where[key]) return false;
    }
    if ('status' in where && !matches(state.item.status, where.status)) return false;
    if (!organizationOk(where.organization)) return false;
    if (where.assignments?.some) {
      const rule = where.assignments.some;
      return state.assignments.map(withAssignee).some(
        (row) => matches(row.status, rule.status) && row.assignee?.userId === rule.assignee.userId && row.assignee?.status === rule.assignee.status
      );
    }
    return true;
  };
  const roomMatches = (room, where) =>
    matches(room.originType, where.originType) &&
    room.originId === where.originId &&
    (!where.members?.some ||
      state.roomMembers.some((row) => row.roomId === room.id && row.userId === where.members.some.userId && row.leftAt === null));
  const memberMatches = (row, where) =>
    Object.entries(where).every(([key, rule]) => (rule === null ? row[key] === null : matches(row[key], rule)));

  const client = {
    $executeRaw: async () => 1,
    $queryRaw: async () => [],
    preInquiry: {
      findUnique: async ({ where }) => (where.id === state.inquiry.id ? { ...state.inquiry } : null),
      /* Teavituse adressaadikontroll: pöördumine tunnuse, autori ja tagasivõtmise järgi. */
      findFirst: async ({ where }) => {
        const row = state.inquiry;
        if (where.id !== row.id) return null;
        if ('authorId' in where && where.authorId !== row.authorId) return null;
        if ('recalledAt' in where && where.recalledAt === null && row.recalledAt) return null;
        return { id: row.id };
      },
      updateMany: async () => ({ count: 0 })
    },
    /* Teavituste kiht: e-kirja eelistus ja teavituse rida. Sama võtmega teist rida ei teki. */
    user: { findUnique: async () => ({ notificationEmailEnabled: false }) },
    notificationEvent: {
      create: async ({ data }) => {
        if (state.notifyFails) throw new Error('notification store unavailable');
        if (state.notifications.some((row) => row.dedupeKey === data.dedupeKey)) {
          throw Object.assign(new Error('unique'), { code: 'P2002' });
        }
        const row = { id: id('n'), ...data };
        state.notifications.push(row);
        return { ...row };
      },
      findUnique: async ({ where }) => state.notifications.find((row) => row.dedupeKey === where.dedupeKey) || null
    },
    organizationInboxItem: {
      findFirst: async ({ where, select }) => {
        if (!itemMatches(where)) return null;
        return { ...state.item, assignments: assignmentsOf(select?.assignments?.where?.status ?? { in: LIVE }) };
      },
      findUnique: async ({ where }) => (where.id === state.item.id ? { ...state.item } : null),
      findMany: async ({ where }) => (itemMatches(where) ? [{ ...state.item, unit: null, assignments: assignmentsOf({ in: LIVE }) }] : []),
      update: async ({ data }) => Object.assign(state.item, data)
    },
    organizationWorkAssignment: {
      findFirst: async ({ where }) => {
        const row = state.assignments.find((entry) => assignmentMatches(entry, where));
        return row ? { ...withAssignee(row), inboxItem: { ...state.item } } : null;
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
      findUnique: async ({ where }) => membership(where.id)
    },
    room: {
      findFirst: async ({ where, select }) => {
        const room = state.rooms.find((row) => roomMatches(row, where));
        return room ? Object.fromEntries(Object.keys(select).map((key) => [key, room[key]])) : null;
      },
      findUnique: async ({ where }) => {
        const room = state.rooms.find((row) => row.id === where.id);
        return room ? { ...room, helpMatch: null } : null;
      },
      create: async ({ data }) => {
        const { members, ...rest } = data;
        const room = { id: id('r'), archivedAt: null, ...rest };
        state.rooms.push(room);
        for (const member of members.create) state.roomMembers.push({ id: id('rm'), roomId: room.id, leftAt: null, ...member });
        return { id: room.id, title: room.title };
      },
      update: async ({ where, data }) => Object.assign(state.rooms.find((row) => row.id === where.id), data),
      updateMany: async ({ where, data }) => {
        const rows = state.rooms.filter((row) => row.id === where.id && matches(row.archivedAt, where.archivedAt));
        rows.forEach((row) => Object.assign(row, data));
        return { count: rows.length };
      }
    },
    roomMember: {
      findFirst: async ({ where }) => {
        const row = state.roomMembers.find((entry) => memberMatches(entry, where));
        return row ? { ...row } : null;
      },
      create: async ({ data }) => {
        const row = { id: id('rm'), leftAt: null, ...data };
        state.roomMembers.push(row);
        return { ...row };
      },
      update: async ({ where, data }) => Object.assign(state.roomMembers.find((row) => row.id === where.id), data),
      updateMany: async ({ where, data }) => {
        const rows = state.roomMembers.filter((row) => memberMatches(row, where));
        rows.forEach((row) => Object.assign(row, data));
        return { count: rows.length };
      }
    },
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
const live = (state) => state.assignments.filter((row) => LIVE.includes(row.status)).map((row) => [row.assigneeMembershipId, row.status]);
const activeMembers = (state) => state.roomMembers.filter((row) => row.leftAt === null).map((row) => `${row.userId}:${row.role}`).sort();
const openRoom = (db, userId) => ensureRoomForPreInquiry({ userId, inquiry: { id: 'p1' } }, { db });
const canWrite = async (db, roomId, userId) =>
  (await resolveRoomAccess({ userId, userRole: 'CLIENT', roomId, intent: ROOM_WRITE, db, hasActiveSubscription: async () => true })).ok;
/* Kõne lõpetamine ja töötaja vabastamine on välise teenuse kutsed: test paneb nende asemele
   üleskirjutaja. */
const callHooks = () => {
  const calls = { ended: [], released: [] };
  return { calls, hooks: { endRoomCall: async (input) => calls.ended.push(input), releaseFromCalls: async (left) => calls.released.push(left) } };
};
/* Tagasilükkamine nõuab selgitust pöördujale; kus test ise selgitust ei anna, läheb see siit. */
const DECLINE_NOTE = 'See ei kuulu meie valla pädevusse. Pöördu oma elukoha valla poole.';
const manual = (db, toStatus, { hooks = callHooks().hooks, now = NOW, reason = toStatus === 'REJECTED' ? DECLINE_NOTE : undefined } = {}) =>
  transitionInboxItem(coordinator(), 'i1', { toStatus, reason }, { db, now, ...hooks });
const refused = (promise, status, message) => assert.rejects(promise, (error) => error.status === status && error.message === message);
const transitions = (state) => state.audits.filter((row) => row.action === 'org.inbox_item_transitioned');
const WITHDRAWN = 'ORG_WORK_WITHDRAWN';
const STATUS_CHANGED = 'PRE_INQUIRY_STATUS_CHANGED';
const notices = (state, type) => state.notifications.filter((row) => row.type === type);
const noticeList = (state) => state.notifications.map((row) => `${row.type}:${row.userId}`).sort();

/**
 * Kirje seis ja elav töömääramine ütlevad sama asja: vastust ootav määramine on „määratud"
 * kirjel, vastu võetud määramine „vastu võetud" kirjel ja ilma elava määramiseta kirje ei ole
 * kumbki neist.
 */
function agrees(state) {
  const alive = live(state);
  if (alive.length > 1) return false;
  if (alive[0]?.[1] === 'PENDING') return state.item.status === 'ASSIGNED';
  if (alive[0]?.[1] === 'ACCEPTED') return state.item.status === 'ACCEPTED';
  return !['ASSIGNED', 'ACCEPTED'].includes(state.item.status);
}

/**
 * Lauale jõudnud kirje viiakse päris radu pidi soovitud seisu. „Suletud” kirje on enne määratud
 * ja vastu võetud, „tagasi lükatud” kirjel ei ole vastutajat olnud; saatja tagasivõtmine ei käi
 * nende radade kaudu ja pannakse kaksikule otse.
 */
async function world(stage, { assignee = 'mari' } = {}) {
  const made = makeDb();
  const { db, state } = made;
  if (stage === 'RECEIVED') return made;
  if (stage === 'REVIEWING' || stage === 'ASSIGNMENT_PENDING') {
    await manual(db, stage, { now: ASSIGNED_AT });
    return made;
  }
  if (stage === 'REJECTED') {
    await manual(db, stage, { now: LATER });
    return made;
  }
  if (stage === 'RECALLED') {
    Object.assign(state.inquiry, { status: 'RECALLED', openedAt: null, recalledAt: LATER });
    Object.assign(state.item, { status: 'RECALLED', lastTransitionAt: LATER, closedAt: LATER });
    return made;
  }
  const first = await assignWork(coordinator(), 'i1', { assigneeMembershipId: `m-${assignee}` }, { db, now: ASSIGNED_AT });
  if (stage === 'ASSIGNED') return { ...made, first };
  await respondToAssignment(context(assignee), first.id, { accept: true }, { db, now: ACCEPTED_AT });
  if (stage === 'ACCEPTED') return { ...made, first };
  await manual(db, stage, { now: LATER });
  return { ...made, first };
}

/* Neli juhtu, mille pärast see fail on. Iga juhtum algab kooskõlalisest seisust; pärast käsitsi
   katset ütlevad kirje seis ja elav määramine ikka sama. Enne parandust läksid kõik neli lahku. */
test('neli leitud juhtu: käsitsi seis ja elav määramine jäävad kooskõlla', async () => {
  /* Töötaja ei ole vastanud: koordinaator ei saa tööd tema eest vastu võtta. */
  const unanswered = await world('ASSIGNED');
  await refused(manual(unanswered.db, 'ACCEPTED'), 409, FOLLOWS);
  assert.deepEqual([unanswered.state.item.status, live(unanswered.state)], ['ASSIGNED', [['m-mari', 'PENDING']]]);

  /* Tööd ei ole kellelegi määratud: kirjet ei saa „määratuks” kirjutada. */
  const unassigned = await world('RECEIVED');
  await refused(manual(unassigned.db, 'ASSIGNED'), 409, FOLLOWS);
  assert.deepEqual([unassigned.state.item.status, live(unassigned.state)], ['RECEIVED', []]);

  /* „Ootab määramist” vastu võetud ja vastust ootaval tööl: määramine lõpeb koos seisuga. */
  for (const stage of ['ACCEPTED', 'ASSIGNED']) {
    const taken = await world(stage);
    assert.equal((await manual(taken.db, 'ASSIGNMENT_PENDING')).status, 'ASSIGNMENT_PENDING');
    assert.deepEqual([taken.state.item.status, live(taken.state)], ['ASSIGNMENT_PENDING', []], stage);
    assert.equal(taken.state.assignments[0].status, 'ENDED', stage);
  }

  for (const made of [unanswered, unassigned]) assert.equal(agrees(made.state), true);
});

/* Iga käsitsi siire igast seisust. `true` = lubatud; muidu keeldumise olek ja võti. Lahtiste
   seisude read on koos elava määramisega, mis sellesse seisu kuulub. */
const OPEN_STAGES = ['RECEIVED', 'REVIEWING', 'ASSIGNMENT_PENDING', 'ASSIGNED', 'ACCEPTED'];
const no = (message, status = 409) => ({ status, message });
const EXPECTED = {
  RECEIVED: { RECEIVED: no(INVALID), REVIEWING: true, ASSIGNMENT_PENDING: true, ASSIGNED: no(FOLLOWS), ACCEPTED: no(FOLLOWS), CLOSED: no(INVALID), REJECTED: true },
  REVIEWING: { RECEIVED: no(INVALID), REVIEWING: no(INVALID), ASSIGNMENT_PENDING: true, ASSIGNED: no(FOLLOWS), ACCEPTED: no(FOLLOWS), CLOSED: no(INVALID), REJECTED: true },
  ASSIGNMENT_PENDING: { RECEIVED: no(INVALID), REVIEWING: true, ASSIGNMENT_PENDING: no(INVALID), ASSIGNED: no(FOLLOWS), ACCEPTED: no(FOLLOWS), CLOSED: no(INVALID), REJECTED: true },
  ASSIGNED: { RECEIVED: no(INVALID), REVIEWING: no(INVALID), ASSIGNMENT_PENDING: true, ASSIGNED: no(FOLLOWS), ACCEPTED: no(FOLLOWS), CLOSED: true, REJECTED: no(INVALID) },
  ACCEPTED: { RECEIVED: no(INVALID), REVIEWING: no(INVALID), ASSIGNMENT_PENDING: true, ASSIGNED: no(FOLLOWS), ACCEPTED: no(FOLLOWS), CLOSED: true, REJECTED: no(INVALID) }
};

test('iga käsitsi siire igast lahtisest seisust: lubatud siire õnnestub, keelatud ei muuda midagi ja seis jääb määramisega kooskõlla', async () => {
  const snapshot = (state) => JSON.stringify([state.item, state.assignments, state.audits, state.roomMembers, state.notifications]);
  for (const stage of OPEN_STAGES) {
    for (const toStatus of Object.values(OrganizationInboxStatus)) {
      const { db, state } = await world(stage);
      const label = `${stage} → ${toStatus}`;
      assert.equal(state.item.status, stage, label);
      assert.equal(agrees(state), true, `${label}: lähteseis`);
      const before = snapshot(state);
      const expected = toStatus === 'RECALLED' ? no(SENDER_ONLY, 400) : EXPECTED[stage][toStatus];

      if (expected === true) {
        const updated = await manual(db, toStatus);
        assert.equal(updated.status, toStatus, label);
        assert.equal(state.item.lastTransitionAt, NOW, label);
        /* Käsitsi siire ei jäta ühestki seisust elavat määramist alles. */
        assert.deepEqual(live(state), [], label);
        const closing = ['CLOSED', 'REJECTED'].includes(toStatus);
        assert.equal(state.item.closedAt, closing ? NOW : null, label);
        assert.equal(transitions(state).at(-1).meta.toInboxStatus, toStatus, label);
      } else {
        await refused(manual(db, toStatus), expected.status, expected.message);
        assert.equal(snapshot(state), before, `${label}: keeldumine ei kirjuta midagi`);
      }
      assert.equal(agrees(state), true, `${label}: kirje ${state.item.status}, elav määramine ${JSON.stringify(live(state))}`);
    }
  }
});

test('lõpetatud kirje ei liigu käsitsi kuhugi', async () => {
  for (const stage of ['CLOSED', 'REJECTED']) {
    for (const toStatus of Object.values(OrganizationInboxStatus)) {
      const { db, state } = stage === 'CLOSED' ? await world('CLOSED') : await world('RECEIVED');
      if (stage === 'REJECTED') await manual(db, 'REJECTED', { now: LATER });
      assert.equal(state.item.status, stage);
      const expected = toStatus === 'RECALLED' ? no(SENDER_ONLY, 400) : no(TERMINAL);
      await refused(manual(db, toStatus), expected.status, expected.message);
      assert.deepEqual([state.item.status, state.item.lastTransitionAt, live(state)], [stage, LATER, []], `${stage} → ${toStatus}`);
    }
  }
  /* Saatja tagasi võetud kirje on samuti lõpp. */
  const recalled = makeDb();
  recalled.state.item.status = 'RECALLED';
  await refused(manual(recalled.db, 'REVIEWING'), 409, TERMINAL);
});

test('töö tagasivõtmine: vastu võtnud töötaja määramine lõpeb, ta lahkub vestlusruumist ja ruum jääb pöördujale kirjutatavaks', async () => {
  const { db, state, first } = await world('ACCEPTED');
  const { room } = await openRoom(db, 'mari');
  assert.deepEqual(activeMembers(state), ['mari:MEMBER', 'poorduja:OWNER']);
  const auditsBefore = state.audits.length;

  const { calls, hooks } = callHooks();
  const updated = await manual(db, 'ASSIGNMENT_PENDING', { hooks });

  /* Kirje ootab uut määramist; lõpetatud töö välju ei täideta, sest töö ei lõppenud. */
  assert.deepEqual([updated.status, state.item.lastTransitionAt, state.item.closedAt, state.item.closedReason], ['ASSIGNMENT_PENDING', NOW, null, null]);
  /* Määramine lõppes samas tehingus: ajalukku jääb rida, elavat määramist ei ole. */
  assert.deepEqual([state.assignments[0].id, state.assignments[0].status, state.assignments[0].endedAt], [first.id, 'ENDED', NOW]);
  assert.deepEqual(live(state), []);

  /* Töötaja lahkus ruumist ja vabastati ruumi kõnest; kõnet ennast ei lõpetata. */
  assert.deepEqual(activeMembers(state), ['poorduja:OWNER']);
  assert.equal(state.roomMembers.find((row) => row.userId === 'mari').leftAt, NOW);
  assert.deepEqual(calls, { ended: [], released: [{ roomId: room.id, userId: 'mari' }] });
  /* Töö ei lõppenud: ruum ei ole arhiivis ja pöörduja saab edasi kirjutada. */
  assert.equal(state.rooms[0].archivedAt, null);
  assert.equal(await canWrite(db, room.id, 'poorduja'), true);
  assert.equal(state.audits.some((row) => row.action === 'ROOM_ARCHIVED'), false);

  /* Üks auditirida: kes võttis, kellelt ja mis määramine lõppes. */
  assert.deepEqual(state.audits.slice(auditsBefore), [{
    actorUserId: 'koordinaator',
    targetUserId: 'mari',
    action: 'org.inbox_item_transitioned',
    resourceType: 'ORGANIZATION_INBOX_ITEM',
    resourceId: 'i1',
    meta: { organizationId: ORG, inboxItemId: 'i1', fromInboxStatus: 'ACCEPTED', toInboxStatus: 'ASSIGNMENT_PENDING', assignmentId: first.id, membershipId: 'm-mari' }
  }]);

  /* Endine vastutaja ei ava enam kirjet ega ruumi; koordinaator näeb vastutajata kirjet. */
  await assert.rejects(getInboxItem(context('mari'), 'i1', { db, now: LATER }), (error) => error.status === 404);
  await assert.rejects(openRoom(db, 'mari'), (error) => error.status === 403);
  const seen = await getInboxItem(coordinator(), 'i1', { db, now: LATER });
  assert.deepEqual([seen.status, seen.assignment], ['ASSIGNMENT_PENDING', null]);

  /* Koordinaator määrab töö Jürile; Jüri võtab vastu ja liitub sama ruumiga. */
  const second = await assignWork(coordinator(), 'i1', { assigneeMembershipId: 'm-jyri' }, { db, now: LATER });
  assert.deepEqual([state.item.status, live(state)], ['ASSIGNED', [['m-jyri', 'PENDING']]]);
  await respondToAssignment(context('jyri'), second.id, { accept: true }, { db, now: LATER });
  assert.deepEqual([state.item.status, live(state)], ['ACCEPTED', [['m-jyri', 'ACCEPTED']]]);
  assert.deepEqual(activeMembers(state), ['jyri:MEMBER', 'poorduja:OWNER']);
  assert.deepEqual(await openRoom(db, 'jyri'), { room, created: false });
  assert.equal(state.rooms.length, 1);
});

test('töö tagasivõtmine enne töötaja vastust: hilinenud vastus ei ärata määramist ellu', async () => {
  const { db, state, first } = await world('ASSIGNED');
  const { calls, hooks } = callHooks();
  await manual(db, 'ASSIGNMENT_PENDING', { hooks });
  assert.deepEqual([state.item.status, state.assignments[0].status, live(state)], ['ASSIGNMENT_PENDING', 'ENDED', []]);
  /* Ruumi ei ole, seega ei ole ka kedagi kõnest vabastada. */
  assert.deepEqual(calls, { ended: [], released: [] });
  assert.equal(transitions(state).at(-1).meta.assignmentId, first.id);

  /* Mari leht oli veel lahti: tema „võtan vastu” ja „lükkan tagasi” saavad keeldumise. */
  for (const accept of [true, false]) {
    await refused(respondToAssignment(context('mari'), first.id, { accept }, { db, now: LATER }), 409, 'org.errors.work_assignment_not_pending');
  }
  assert.deepEqual([state.item.status, state.assignments[0].status, live(state)], ['ASSIGNMENT_PENDING', 'ENDED', []]);
  assert.equal(agrees(state), true);
});

test('„ootab määramist” vastutajata kirjel muudab ainult seisu', async () => {
  for (const stage of ['RECEIVED', 'REVIEWING']) {
    const { db, state } = await world(stage);
    const { calls, hooks } = callHooks();
    await manual(db, 'ASSIGNMENT_PENDING', { hooks });
    assert.deepEqual([state.item.status, state.assignments, calls], ['ASSIGNMENT_PENDING', [], { ended: [], released: [] }], stage);
    /* Kellegi määramine ei lõppenud, seega auditirida kedagi ei nimeta. */
    const row = transitions(state).at(-1);
    assert.equal(row.targetUserId ?? null, null, stage);
    assert.deepEqual(row.meta, { organizationId: ORG, inboxItemId: 'i1', fromInboxStatus: stage, toInboxStatus: 'ASSIGNMENT_PENDING' }, stage);
  }
});

test('enne seda reeglit lahku läinud read: käsitsi siire ei jäta elavat määramist lahtise seisu kõrvale', async () => {
  /* Vana käsitsi siire jättis „ootab määramist” kirjele elava määramise. */
  const stale = (status, assignmentStatus) => {
    const made = makeDb();
    made.state.item.status = status;
    made.state.assignments.push({ id: 'a-old', inboxItemId: 'i1', assigneeMembershipId: 'm-mari', status: assignmentStatus, assignedAt: ASSIGNED_AT });
    return made;
  };

  /* „Vaatlemisele” ei saa, kuni töö on töötaja käes: muidu jääks vastuolu alles. */
  const reviewing = stale('ASSIGNMENT_PENDING', 'PENDING');
  await refused(manual(reviewing.db, 'REVIEWING'), 409, INVALID);
  assert.deepEqual([reviewing.state.item.status, live(reviewing.state)], ['ASSIGNMENT_PENDING', [['m-mari', 'PENDING']]]);
  /* Tagasilükkamine lõpetab ka sellise rea määramise. */
  await manual(reviewing.db, 'REJECTED');
  assert.deepEqual([reviewing.state.item.status, live(reviewing.state)], ['REJECTED', []]);

  /* Valesti „saabunud” või „vaatlemisel” seisus rida: tagasivõtmine teeb rea korda. */
  for (const status of ['RECEIVED', 'REVIEWING']) {
    const healed = stale(status, 'ACCEPTED');
    await manual(healed.db, 'ASSIGNMENT_PENDING');
    assert.deepEqual([healed.state.item.status, healed.state.assignments[0].status], ['ASSIGNMENT_PENDING', 'ENDED'], status);
    assert.equal(agrees(healed.state), true, status);
  }

  /* Enne üleandmise parandust üle antud rida („vastu võetud” kirje, vastust ootav määramine). */
  const handed = stale('ACCEPTED', 'PENDING');
  await manual(handed.db, 'ASSIGNMENT_PENDING');
  assert.deepEqual([handed.state.item.status, handed.state.assignments[0].status, live(handed.state)], ['ASSIGNMENT_PENDING', 'ENDED', []]);
});

test('töö tagasivõtmine: töötaja saab teate, et töö ei ole enam tema vastutusel, ja pöörduja neutraalse teate', async () => {
  const { db, state, first } = await world('ACCEPTED');
  const recipient = (userId, assignmentId = first.id) =>
    assertNotificationRecipient(db, { type: WITHDRAWN, userId, sourceId: assignmentId, targetId: 'i1' });
  /* Enne tagasivõtmist seda teadet ei ole ja adressaadireegel seda ka ei lubaks. */
  assert.deepEqual(noticeList(state), ['ORG_WORK_ASSIGNED:mari']);
  await assert.rejects(recipient('mari'), (error) => error.status === 404);

  await manual(db, 'ASSIGNMENT_PENDING', { reason: 'Mari jäi haiguslehele.' });

  const rows = notices(state, WITHDRAWN);
  assert.equal(rows.length, 1);
  const { id: _id, emailNextAttemptAt: _next, emailMessageId: _message, ...notice } = rows[0];
  assert.deepEqual(notice, {
    userId: 'mari',
    type: WITHDRAWN,
    sourceType: 'ORG_WORK_ASSIGNMENT',
    sourceId: first.id,
    dedupeKey: `ORG_WORK_WITHDRAWN:${first.id}:mari:v1`,
    targetKind: 'ORG_INBOX_ITEM',
    targetId: 'i1',
    eventId: null,
    workspaceKind: 'org_space',
    workspaceId: ORG,
    expiresAt: null,
    emailPolicy: 'OPTIONAL',
    emailStatus: 'NOT_REQUESTED'
  });
  /* Teade kannab ainult tunnuseid: ei tegijat, põhjust, pöördujat ega pöördumise sisu. */
  for (const secret of ['koordinaator', 'haiguslehele', 'poorduja', 'Koduteenus', 'poes']) {
    assert.equal(JSON.stringify(rows[0]).includes(secret), false, secret);
  }

  /* Loendis: oma lause ja kirje aadress. Avada ei ole midagi, seega saab teade loetuks loendis. */
  const shown = serializeNotificationEvent({ ...rows[0], createdAt: NOW });
  assert.deepEqual(
    [shown.href, shown.labelKey, shown.ackMode, shown.badgeKey],
    ['/org/vastuvott/i1', 'notifications.events.org_work_withdrawn', 'read', 'pre_inquiries']
  );
  for (const locale of ['et', 'en', 'ru']) {
    const text = serverT(locale, 'notifications.events.org_work_withdrawn');
    assert.notEqual(text, 'notifications.events.org_work_withdrawn', locale);
    assert.ok(text.length > 30 && /\s/.test(text), locale);
    assert.equal(/[—–]/.test(text), false, locale);
  }

  /* Adressaat on ainult endine vastutaja. */
  await recipient('mari');
  for (const other of ['koordinaator', 'jyri', 'poorduja', 'vooras']) await assert.rejects(recipient(other), (error) => error.status === 404, other);

  /* Pöörduja: sama neutraalne teade mis üleandmisel, selle tagasivõtmise võtmega. */
  assert.deepEqual(
    notices(state, STATUS_CHANGED).map((row) => [row.userId, row.sourceId, row.dedupeKey]),
    [['poorduja', 'p1', `PRE_INQUIRY_STATUS_CHANGED:p1:poorduja:takeback:${first.id}`]]
  );
  assert.deepEqual(noticeList(state), ['ORG_WORK_ASSIGNED:mari', 'ORG_WORK_WITHDRAWN:mari', 'PRE_INQUIRY_STATUS_CHANGED:poorduja']);

  /* Töö määratakse Marile uuesti: vana teade ütleks valet ja adressaadireegel peidab selle. */
  const again = await assignWork(coordinator(), 'i1', { assigneeMembershipId: 'm-mari' }, { db, now: LATER });
  await assert.rejects(recipient('mari'), (error) => error.status === 404);

  /* Teine tagasivõtmine on uus lõppenud määramine ja uus teade. Töötaja ei olnud veel vastanud,
     seega pöördujale midagi ei muutunud ja talle uut teadet ei tule. */
  await manual(db, 'ASSIGNMENT_PENDING', { now: LATER });
  assert.deepEqual(notices(state, WITHDRAWN).map((row) => row.sourceId), [first.id, again.id]);
  await recipient('mari');
  await recipient('mari', again.id);
  assert.equal(notices(state, STATUS_CHANGED).length, 1);

  /* Sama määramise kohta teist teadet ei teki. */
  const repeated = await createNotificationEvent({ type: WITHDRAWN, userId: 'mari', sourceId: again.id, targetId: 'i1' }, { db });
  assert.equal(repeated.created, false);
  assert.equal(notices(state, WITHDRAWN).length, 2);
});

test('teadet ei saa see, kes töö ise ära võttis; peatatud liikmesus teadet ei saa ja teate tõrge ei keera tagasivõtmist tagasi', async () => {
  /* Koordinaator oli ise vastutaja ja võtab töö endalt tagasi: talle teadet ei tule, pöördujale tuleb. */
  const own = makeDb();
  const mine = await assignWork(coordinator(), 'i1', { assigneeMembershipId: 'm-koordinaator' }, { db: own.db, now: ASSIGNED_AT });
  await respondToAssignment(coordinator(), mine.id, { accept: true }, { db: own.db, now: ACCEPTED_AT });
  await manual(own.db, 'ASSIGNMENT_PENDING');
  assert.deepEqual([own.state.item.status, notices(own.state, WITHDRAWN).length, notices(own.state, STATUS_CHANGED).length], ['ASSIGNMENT_PENDING', 0, 1]);

  /* Pöörduja on sama asutuse koordinaator ja võtab töö ise tagasi: tema teadet ei saa, töötaja saab. */
  const author = await world('ACCEPTED');
  author.state.inquiry.authorId = 'koordinaator';
  await manual(author.db, 'ASSIGNMENT_PENDING');
  assert.deepEqual([notices(author.state, WITHDRAWN).map((row) => row.userId), notices(author.state, STATUS_CHANGED).length], [['mari'], 0]);

  /* Peatatud liikmesusega töötaja teadet ei saa: ta ei pääse asutuse lauale. */
  const suspended = await world('ACCEPTED');
  suspended.state.memberships.find((row) => row.userId === 'mari').status = 'SUSPENDED';
  await manual(suspended.db, 'ASSIGNMENT_PENDING');
  assert.deepEqual([suspended.state.item.status, notices(suspended.state, WITHDRAWN).length], ['ASSIGNMENT_PENDING', 0]);

  /* Teavituste tõrge: töö on tagasi võetud ja määramine lõpetatud, viga läheb logisse. */
  const broken = await world('ACCEPTED');
  broken.state.notifyFails = true;
  const logged = [];
  const original = console.error;
  console.error = (...args) => logged.push(args.join(' '));
  try {
    assert.equal((await manual(broken.db, 'ASSIGNMENT_PENDING')).status, 'ASSIGNMENT_PENDING');
  } finally {
    console.error = original;
  }
  assert.deepEqual([broken.state.item.status, live(broken.state), broken.state.assignments[0].status], ['ASSIGNMENT_PENDING', [], 'ENDED']);
  assert.deepEqual(logged.map((line) => line.replace(/ notification store unavailable$/, '')), [
    '[org-inbox] former assignee notification failed',
    '[org-inbox] author notification failed'
  ]);
});

test('üleandmine: kui töö annab edasi keegi teine, saab senine vastutaja sama teate; ise ära andes ei saa', async () => {
  const release = callHooks().hooks.releaseFromCalls;
  const moved = await world('ACCEPTED');
  await handOverWork(coordinator(), moved.first.id, { toMembershipId: 'm-jyri' }, { db: moved.db, now: NOW, releaseFromCalls: release });
  assert.deepEqual(notices(moved.state, WITHDRAWN).map((row) => [row.userId, row.sourceId, row.targetId]), [['mari', moved.first.id, 'i1']]);
  /* Uus vastutaja saab oma teate ja pöörduja neutraalse teate nagu enne. */
  assert.deepEqual(noticeList(moved.state), ['ORG_WORK_ASSIGNED:jyri', 'ORG_WORK_ASSIGNED:mari', 'ORG_WORK_WITHDRAWN:mari', 'PRE_INQUIRY_STATUS_CHANGED:poorduja']);
  const recipient = (userId) => assertNotificationRecipient(moved.db, { type: WITHDRAWN, userId, sourceId: moved.first.id, targetId: 'i1' });
  await recipient('mari');
  await assert.rejects(recipient('jyri'), (error) => error.status === 404);

  /* Mari annab töö ise edasi: ta teab seda niigi. */
  const own = await world('ACCEPTED');
  await handOverWork(context('mari'), own.first.id, { toMembershipId: 'm-jyri' }, { db: own.db, now: NOW, releaseFromCalls: release });
  assert.deepEqual(noticeList(own.state), ['ORG_WORK_ASSIGNED:jyri', 'ORG_WORK_ASSIGNED:mari', 'PRE_INQUIRY_STATUS_CHANGED:poorduja']);

});

test('töö sulgemine: vastutaja saab sama teate, sest kirje kaob ka tema laualt; ise sulgedes ei saa', async () => {
  for (const stage of ['ASSIGNED', 'ACCEPTED']) {
    const { db, state, first } = await world(stage);
    await manual(db, 'CLOSED', { reason: 'Nõustamine tehtud.' });
    assert.deepEqual(notices(state, WITHDRAWN).map((row) => [row.userId, row.sourceId, row.targetId]), [['mari', first.id, 'i1']], stage);
    /* Teade ei ütle, et töö suleti, ega kanna sulgemise põhjust. */
    assert.equal(JSON.stringify(notices(state, WITHDRAWN)[0]).includes('Nõustamine'), false, stage);
    await assertNotificationRecipient(db, { type: WITHDRAWN, userId: 'mari', sourceId: first.id, targetId: 'i1' });
    /* Pöörduja saab oma teate töö lõpetamise kohta nagu enne; üleandmise teadet ei tule. */
    assert.deepEqual(noticeList(state), ['ORG_WORK_ASSIGNED:mari', 'ORG_WORK_WITHDRAWN:mari', 'PRE_INQUIRY_WORK_CLOSED:poorduja'], stage);
    /* Teate link: endine vastutaja jõuab asutuse vastuvõtulauale ka suletud kirje korral. */
    assert.equal(await hadWorkOnInboxItem(context('mari'), 'i1', { db }), true, stage);
  }

  /* Koordinaator oli ise vastutaja ja sulgeb oma töö: talle teadet ei tule. */
  const own = await world('ACCEPTED', { assignee: 'koordinaator' });
  await manual(own.db, 'CLOSED');
  assert.deepEqual([own.state.item.status, notices(own.state, WITHDRAWN).length], ['CLOSED', 0]);

  /* Vastutajata pöördumise tagasilükkamisel ei ole kedagi, kellele teatada. */
  const unassigned = await world('RECEIVED');
  await manual(unassigned.db, 'REJECTED');
  assert.deepEqual(noticeList(unassigned.state), ['PRE_INQUIRY_DECLINED:poorduja']);
});

test('teate aadress: endine vastutaja jõuab asutuse vastuvõtulauale, võõras saab endiselt „lehte ei leitud”', async () => {
  const { db } = await world('ACCEPTED');
  await manual(db, 'ASSIGNMENT_PENDING');
  /* Kirjet endine vastutaja enam ei ava; suunaja küsib, kas tal on selle kirjega töö olnud. */
  await assert.rejects(getInboxItem(context('mari'), 'i1', { db, now: LATER }), (error) => error.status === 404);
  assert.equal(await hadWorkOnInboxItem(context('mari'), 'i1', { db }), true);
  assert.equal(await hadWorkOnInboxItem(context('jyri'), 'i1', { db }), false);
  assert.equal(await hadWorkOnInboxItem(context('mari'), 'teine-kirje', { db }), false);
  assert.equal(await hadWorkOnInboxItem({ ...context('mari'), organization: { id: 'org-2' } }, 'i1', { db }), false);
  assert.equal(await hadWorkOnInboxItem({ ...context('mari'), membership: null }, 'i1', { db }), false);

  const page = readFileSync(new URL('../app/org/vastuvott/[itemId]/page.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.match(page, /if \(visible\) redirect\(`\/org\/\$\{item\.organizationId\}\/vastuvott\/\$\{item\.id\}`\);/);
  assert.match(page, /if \(await hadWorkOnInboxItem\(context, item\.id\)\) redirect\(`\/org\/\$\{item\.organizationId\}\/vastuvott`\);\n\s+notFound\(\);\n\}/);
});

test('seisutabel on sama: määramine ja töötaja vastus küsivad luba sealt nagu enne', async () => {
  assert.deepEqual(INBOX_STATUS_TRANSITIONS, {
    RECEIVED: ['REVIEWING', 'ASSIGNMENT_PENDING', 'ASSIGNED', 'REJECTED', 'RECALLED'],
    REVIEWING: ['ASSIGNMENT_PENDING', 'ASSIGNED', 'REJECTED', 'RECALLED'],
    ASSIGNMENT_PENDING: ['ASSIGNED', 'REVIEWING', 'REJECTED', 'RECALLED'],
    ASSIGNED: ['ACCEPTED', 'ASSIGNMENT_PENDING', 'CLOSED', 'RECALLED'],
    ACCEPTED: ['ASSIGNMENT_PENDING', 'CLOSED'],
    CLOSED: [],
    REJECTED: [],
    RECALLED: []
  });
  for (const status of Object.values(OrganizationInboxStatus)) {
    assert.equal(inboxStatusFollowsAssignment(status), ['ASSIGNED', 'ACCEPTED'].includes(status), status);
  }
  assert.equal(inboxStatusFollowsAssignment(undefined), false);

  /* Määrata saab igast vastutajata seisust; kirje läheb „määratuks” määramise käigus. */
  for (const stage of ['RECEIVED', 'REVIEWING', 'ASSIGNMENT_PENDING']) {
    const { db, state } = await world(stage);
    const assignment = await assignWork(coordinator(), 'i1', { assigneeMembershipId: 'm-mari' }, { db, now: LATER });
    assert.deepEqual([state.item.status, live(state)], ['ASSIGNED', [['m-mari', 'PENDING']]], stage);

    /* Töötaja vastus viib kirje „vastu võetuks” või tagasi määramist ootama. */
    await respondToAssignment(context('mari'), assignment.id, { accept: stage !== 'REVIEWING', reason: 'koormus' }, { db, now: LATER });
    assert.deepEqual(
      [state.item.status, live(state)],
      stage === 'REVIEWING' ? ['ASSIGNMENT_PENDING', []] : ['ACCEPTED', [['m-mari', 'ACCEPTED']]],
      stage
    );
    assert.equal(agrees(state), true, stage);
  }
});

/* LEHT PAKUB AINULT SEDA, MIDA SERVER LUBAB. Kirje lehe reegel (`workActions`) ei vaadanud
   kirje seisu ja küsis sulgemiseks töö määramise õigust. Kolm juhtu, mille pärast see test on:
     1. vastutajata kirjel („saabunud”, „vaatlemisel”, „ootab määramist”, ka pärast töötaja
        tagasilükkamist) pakuti sulgemist, server lubab sealt ainult tagasilükkamise;
     2. lõpetatud kirjel pakuti määramist ja sulgemist;
     3. sulgemist pakuti töö määrajale, server nõuab koordinaatori õigust.
   Iga seisu ja vaataja kohta loeb test kirje nii, nagu leht selle saab (`getInboxItem`), küsib
   lehe reeglilt tegevused ja teeb seejärel iga tegevuse päriselt: pakutu õnnestub, pakkumata
   jäetust server keeldub. */
const VIEWERS = [
  { name: 'koordinaator ja määraja', userId: 'koordinaator', capabilities: ['INBOX_COORDINATOR', 'WORK_ASSIGNER'], assignee: 'mari' },
  { name: 'ainult koordinaator', userId: 'koordinaator', capabilities: ['INBOX_COORDINATOR'], assignee: 'mari' },
  { name: 'koordinaator ja määraja, ise vastutaja', userId: 'koordinaator', capabilities: ['INBOX_COORDINATOR', 'WORK_ASSIGNER'], assignee: 'koordinaator' },
  { name: 'määraja, ise vastutaja', userId: 'mari', capabilities: ['WORK_ASSIGNER'], assignee: 'mari' },
  { name: 'vastutaja', userId: 'mari', capabilities: [], assignee: 'mari' }
];
/* Tegevus nii, nagu leht selle saadab. `null` = lehel ei ole, mida saata (määramist ei ole). */
const PAGE_REQUESTS = {
  assign: ({ db, viewer }) => assignWork(viewer, 'i1', { assigneeMembershipId: 'm-jyri' }, { db, now: NOW }),
  accept: ({ db, viewer, seen }) => (seen.assignment ? respondToAssignment(viewer, seen.assignment.id, { accept: true }, { db, now: NOW }) : null),
  reject: ({ db, viewer, seen }) => (seen.assignment ? respondToAssignment(viewer, seen.assignment.id, { accept: false }, { db, now: NOW }) : null),
  handOver: ({ db, viewer, seen }) =>
    seen.assignment ? handOverWork(viewer, seen.assignment.id, { toMembershipId: 'm-jyri' }, { db, now: NOW, releaseFromCalls: async () => {} }) : null,
  /* Töö tagasivõtmine on käsitsi „ootab määramist” kirjel, millel on vastutaja. Vastutajata
     kirjel muudaks sama päring ainult seisu sõna; seda leht ei saada. */
  takeBack: ({ db, viewer, seen }) =>
    seen.assignment ? transitionInboxItem(viewer, 'i1', { toStatus: 'ASSIGNMENT_PENDING' }, { db, now: NOW, ...callHooks().hooks }) : null,
  close: ({ db, viewer }) => transitionInboxItem(viewer, 'i1', { toStatus: 'CLOSED' }, { db, now: NOW, ...callHooks().hooks }),
  /* Pöördumise tagasilükkamine: nii lõpetab koordinaator pöördumise, millel ei ole vastutajat. */
  rejectItem: ({ db, viewer }) => transitionInboxItem(viewer, 'i1', { toStatus: 'REJECTED', reason: DECLINE_NOTE }, { db, now: NOW, ...callHooks().hooks })
};
const OFFER_OF = { assign: 'assign', accept: 'respond', reject: 'respond', handOver: 'handOver', takeBack: 'takeBack', close: 'close', rejectItem: 'rejectItem' };

test('kirje leht pakub igas seisus ja igale vaatajale täpselt neid töö tegevusi, mida server lubab', async () => {
  const mismatches = [];
  let checked = 0;
  for (const stage of Object.values(OrganizationInboxStatus)) {
    for (const who of VIEWERS) {
      const viewer = context(who.userId, who.capabilities);
      for (const [request, send] of Object.entries(PAGE_REQUESTS)) {
        const { db, state } = await world(stage, { assignee: who.assignee });
        assert.equal(state.item.status, stage);
        /* Kes kirjet ei näe, sellel lehte ei ole. */
        const seen = await getInboxItem(viewer, 'i1', { db, now: NOW }).catch((error) => (error.status === 404 ? null : Promise.reject(error)));
        if (!seen) continue;
        const actions = workActions(seen, {
          context: { writable: true, membership: viewer.membership },
          canAssign: hasCapability(viewer, 'WORK_ASSIGNER', { unitId: seen.unitId })
        });
        const offered = Boolean(actions[OFFER_OF[request]]);
        const attempt = send({ db, viewer, seen });
        const outcome = attempt === null ? 'nothing to send' : await attempt.then(() => 'ok', (error) => `${error.status} ${error.message}`);
        checked += 1;
        if (offered !== (outcome === 'ok')) mismatches.push(`${stage}, ${who.name}: ${request} ${offered ? 'pakutakse' : 'ei pakuta'}, server: ${outcome}`);
      }
    }
  }
  assert.deepEqual(mismatches, []);
  /* 8 seisu ja 5 vaatajat: vastutajata ja lõpetatud kirjet näevad ainult kolm koordinaatorit. */
  assert.equal(checked, (6 * 3 + 2 * 5) * Object.keys(PAGE_REQUESTS).length);
});

test('ainult määramisõigusega vastutaja ei näe kirjet pärast töö äraandmist: leht viib ta loendisse', async () => {
  /* Kirjet näeb koordinaator või elava töö vastutaja; töö määramise õigus üksi kirjet ei ava. */
  const { db, first } = await world('ACCEPTED');
  const assigner = context('mari', ['WORK_ASSIGNER']);
  assert.equal((await getInboxItem(assigner, 'i1', { db, now: NOW })).isCoordinator, false);
  await handOverWork(assigner, first.id, { toMembershipId: 'm-jyri' }, { db, now: NOW, releaseFromCalls: async () => {} });
  await assert.rejects(getInboxItem(assigner, 'i1', { db, now: LATER }), (error) => error.status === 404);
  /* Leht otsustab jäämise serveri öeldud `isCoordinator` järgi, mitte määramisõiguse järgi. */
  const page = readFileSync(new URL('../components/org/OrgInboxItemClient.jsx', import.meta.url), 'utf8');
  assert.ok(page.includes('if (item.isCoordinator) router.refresh();'));
});

test('töö tagasivõtmine lehelt: koordinaator jääb kirje juurde ja leht pakub talle uut määramist', async () => {
  for (const stage of ['ASSIGNED', 'ACCEPTED']) {
    const { db, state } = await world(stage);
    const pageActions = async (viewer) => {
      const seen = await getInboxItem(viewer, 'i1', { db, now: NOW });
      return workActions(seen, { context: { writable: true, membership: viewer.membership }, canAssign: hasCapability(viewer, 'WORK_ASSIGNER', { unitId: seen.unitId }) });
    };
    assert.deepEqual(await pageActions(coordinator()), { assign: false, respond: false, handOver: true, takeBack: true, close: true, rejectItem: false }, stage);

    /* Sama päring, mille leht saadab. */
    await manual(db, 'ASSIGNMENT_PENDING');
    assert.deepEqual([state.item.status, live(state)], ['ASSIGNMENT_PENDING', []], stage);

    /* Koordinaator näeb kirjet edasi: määramine on tagasi, tagasi võtta ega sulgeda ei ole midagi;
       vastutajata pöördumise saab ta tagasi lükata. */
    assert.deepEqual(await pageActions(coordinator()), { assign: true, respond: false, handOver: false, takeBack: false, close: false, rejectItem: true }, stage);
    /* Koordinaatorile, kes ei ole töö määraja, jääb pärast tagasivõtmist pöördumise tagasilükkamine. */
    assert.deepEqual(await pageActions(context('koordinaator', ['INBOX_COORDINATOR'])), { assign: false, respond: false, handOver: false, takeBack: false, close: false, rejectItem: true }, stage);
    /* Endine vastutaja kirjet enam ei näe. */
    await assert.rejects(getInboxItem(context('mari'), 'i1', { db, now: LATER }), (error) => error.status === 404, stage);
  }
});

test('pöördumise tagasilükkamine lehelt: vastutajata pöördumine lõpeb ja lehel ei ole enam ühtegi tegevust', async () => {
  const pageActions = async (db, viewer) => {
    const seen = await getInboxItem(viewer, 'i1', { db, now: NOW });
    return workActions(seen, { context: { writable: true, membership: viewer.membership }, canAssign: hasCapability(viewer, 'WORK_ASSIGNER', { unitId: seen.unitId }) });
  };
  const none = { assign: false, respond: false, handOver: false, takeBack: false, close: false, rejectItem: false };
  for (const stage of ['RECEIVED', 'REVIEWING', 'ASSIGNMENT_PENDING']) {
    const { db, state } = await world(stage);
    assert.deepEqual(await pageActions(db, coordinator()), { ...none, assign: true, rejectItem: true }, stage);
    /* Sama päring, mille leht saadab. */
    const updated = await manual(db, 'REJECTED');
    assert.deepEqual([updated.status, state.item.closedAt, live(state)], ['REJECTED', NOW, []], stage);
    /* Koordinaator näeb lõpetatud kirjet edasi, aga teha sellega enam midagi ei saa. */
    assert.deepEqual(await pageActions(db, coordinator()), none, stage);
  }

  /* Töötaja lükkas töö tagasi: kirje ootab määramist ja koordinaator saab pöördumise lõpetada. */
  const declined = await world('ASSIGNED');
  await respondToAssignment(context('mari'), declined.first.id, { accept: false, reason: 'koormus' }, { db: declined.db, now: LATER });
  assert.equal(declined.state.item.status, 'ASSIGNMENT_PENDING');
  assert.deepEqual(await pageActions(declined.db, coordinator()), { ...none, assign: true, rejectItem: true });
  await manual(declined.db, 'REJECTED');
  assert.deepEqual([declined.state.item.status, live(declined.state)], ['REJECTED', []]);

  /* Vastutajaga töö lõpetab sulgemine, mitte tagasilükkamine: seda leht ei paku ja server keeldub. */
  for (const stage of ['ASSIGNED', 'ACCEPTED']) {
    const { db } = await world(stage);
    assert.equal((await pageActions(db, coordinator())).rejectItem, false, stage);
    await refused(manual(db, 'REJECTED'), 409, INVALID);
  }
});

test('laua loendis on ainult lõpetamata töö: ka tagasi lükatud pöördumine kaob sealt', async () => {
  /* Loend peitis varem ainult „suletud” ja „saatja võttis tagasi” kirjed: tagasi lükatud
     pöördumine jäi lauale igaveseks, määramata reana, millega midagi teha ei saa. */
  const listed = async (db, options = {}) => (await listInboxItemPage(coordinator(), { db, now: LATER, ...options })).items.map((row) => [row.id, row.status]);
  for (const stage of Object.values(OrganizationInboxStatus)) {
    const { db } = await world(stage);
    const finished = ['CLOSED', 'REJECTED', 'RECALLED'].includes(stage);
    assert.deepEqual(await listed(db), finished ? [] : [['i1', stage]], stage);
    /* Ajalugu on alles: lõpetatud kirjed toob `includeClosed` ja seisufilter. */
    assert.deepEqual(await listed(db, { includeClosed: true }), [['i1', stage]], stage);
    assert.deepEqual(await listed(db, { status: stage }), [['i1', stage]], stage);
    /* Laua vaade „Lõpetatud”: ainult lõpetatud kirjed. */
    assert.deepEqual(await listed(db, { closedOnly: true }), finished ? [['i1', stage]] : [], stage);
  }
  /* Lõpetatud rida kannab lõpetamise aega (loend näitab seda vastutaja asemel). */
  const closed = await world('CLOSED');
  const [row] = (await listInboxItemPage(coordinator(), { db: closed.db, closedOnly: true, now: LATER })).items;
  assert.deepEqual([row.status, row.closedAt, row.assignment], ['CLOSED', LATER, null]);
});

test('tagasilükkamine ei ole kunagi paljas „ei”: selgitus pöördujale on kohustuslik, sulgemisel soovi korral', async () => {
  const REQUIRED = 'org.errors.inbox_reject_reason_required';
  const snapshot = (state) => JSON.stringify([state.item, state.assignments, state.audits, state.roomMembers, state.notifications]);

  /* Ilma selgituseta, tühja ja ainult tühikutest selgitusega server keeldub ega kirjuta midagi. */
  for (const stage of ['RECEIVED', 'REVIEWING', 'ASSIGNMENT_PENDING']) {
    for (const reason of [null, '', '   \n ']) {
      const { db, state } = await world(stage);
      const before = snapshot(state);
      await refused(manual(db, 'REJECTED', { reason }), 400, REQUIRED);
      assert.equal(snapshot(state), before, `${stage}: ${JSON.stringify(reason)}`);
    }
    /* Päring, kus selgituse välja ei olegi (abiline `manual` paneks selle ise juurde). */
    const { db, state } = await world(stage);
    const before = snapshot(state);
    await refused(transitionInboxItem(coordinator(), 'i1', { toStatus: 'REJECTED' }, { db, now: NOW, ...callHooks().hooks }), 400, REQUIRED);
    assert.equal(snapshot(state), before, stage);
  }
  /* Lubamatu siire saab ikka oma vastuse, mitte „kirjuta selgitus”. */
  for (const stage of ['ASSIGNED', 'ACCEPTED']) {
    const { db } = await world(stage);
    await refused(manual(db, 'REJECTED', { reason: '' }), 409, INVALID);
  }
  const finished = await world('CLOSED');
  await refused(manual(finished.db, 'REJECTED', { reason: '' }), 409, TERMINAL);

  /* Selgitus salvestatakse kärbitult ja piiratud pikkusega; koordinaator näeb seda lõpetatud kirjel. */
  const declined = await world('RECEIVED');
  await manual(declined.db, 'REJECTED', { reason: '  See ei kuulu meie valla pädevusse.  ' });
  assert.equal(declined.state.item.closedReason, 'See ei kuulu meie valla pädevusse.');
  const seen = await getInboxItem(coordinator(), 'i1', { db: declined.db, now: LATER });
  assert.deepEqual([seen.status, seen.closedAt, seen.closedReason], ['REJECTED', NOW, 'See ei kuulu meie valla pädevusse.']);
  const long = await world('RECEIVED');
  await manual(long.db, 'REJECTED', { reason: 'a'.repeat(INBOX_CLOSING_NOTE_LIMIT + 60) });
  assert.equal(long.state.item.closedReason.length, INBOX_CLOSING_NOTE_LIMIT);

  /* Sulgemisel on selgitus soovi korral: ilma selleta sulgub töö nagu enne. */
  const plain = await world('ACCEPTED');
  await manual(plain.db, 'CLOSED');
  assert.deepEqual([plain.state.item.status, plain.state.item.closedReason], ['CLOSED', null]);
  const noted = await world('ACCEPTED');
  await manual(noted.db, 'CLOSED', { reason: ' Lahendatud: koduteenus on määratud. ' });
  assert.equal(noted.state.item.closedReason, 'Lahendatud: koduteenus on määratud.');
  assert.equal((await getInboxItem(coordinator(), 'i1', { db: noted.db, now: LATER })).closedReason, 'Lahendatud: koduteenus on määratud.');

  /* Töö, mis ei lõpe, selgitust ei saa: tagasivõtmisel antud tekst ei jää kirje külge. */
  const taken = await world('ACCEPTED');
  await manual(taken.db, 'ASSIGNMENT_PENDING', { reason: 'see ei ole lõpetamine' });
  assert.deepEqual([taken.state.item.closedAt, taken.state.item.closedReason], [null, null]);
  const open = await getInboxItem(coordinator(), 'i1', { db: taken.db, now: LATER });
  assert.deepEqual([open.closedAt, open.closedReason], [null, null]);

  /* Keeldumise lause on kolmes keeles. */
  for (const locale of ['et', 'en', 'ru']) {
    const sentence = serverT(locale, REQUIRED);
    assert.ok(sentence !== REQUIRED && sentence.length > 20 && !/[—–]/.test(sentence), locale);
  }
});

test('leht saadab käsitsi ainult sulgemise, pöördumise tagasilükkamise ja töö tagasivõtmise; keeldumise lause on kolmes keeles', () => {
  for (const locale of ['et', 'en', 'ru']) {
    const text = serverT(locale, FOLLOWS);
    assert.notEqual(text, FOLLOWS, locale);
    assert.ok(text.length > 40 && /\s/.test(text), locale);
    assert.equal(/[—–]/.test(text), false, locale);
    /* Lause nimetab seise samade sõnadega, mida laud näitab. */
    for (const status of ['ASSIGNED', 'ACCEPTED']) assert.ok(text.includes(serverT(locale, `org.inboxStatus.${status}`)), `${locale}: ${status}`);
  }
});
