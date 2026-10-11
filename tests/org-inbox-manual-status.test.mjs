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
// Andmebaasi asemel on mälus hoitav kaksik, mis vastab ainult neile päringutele, mida need
// rajad teevad. Päris andmebaasiga käib sama lugu failis
// tests/org-inbox-manual-status.integration.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { workActions } from '../components/org/inbox/inboxRules.js';
import { serverT } from '../lib/i18n/serverMessages.js';
import { WorkspaceContextKind, hasCapability } from '../lib/org/accessContext.js';
import { INBOX_STATUS_TRANSITIONS, OrganizationInboxStatus, inboxStatusFollowsAssignment } from '../lib/org/constants.js';
import { assignWork, getInboxItem, handOverWork, respondToAssignment, transitionInboxItem } from '../lib/org/inbox.js';
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
      authorId: 'pöörduja',
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
    memberships: ['koordinaator', 'mari', 'jüri'].map((userId) => ({ id: `m-${userId}`, organizationId: ORG, userId, status: 'ACTIVE' })),
    assignments: [],
    rooms: [],
    roomMembers: [],
    audits: []
  };

  const membership = (membershipId) => state.memberships.find((row) => row.id === membershipId) || null;
  const withAssignee = (row) => ({ ...row, assignee: membership(row.assigneeMembershipId) });
  const assignmentsOf = (rule) => state.assignments.filter((row) => matches(row.status, rule)).map(withAssignee);
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
      updateMany: async () => ({ count: 0 })
    },
    organizationInboxItem: {
      findFirst: async ({ where, select }) => {
        if (!itemMatches(where)) return null;
        return { ...state.item, assignments: assignmentsOf(select?.assignments?.where?.status ?? { in: LIVE }) };
      },
      findUnique: async ({ where }) => (where.id === state.item.id ? { ...state.item } : null),
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
      /* Teavitused ei ole selle testi teema: tühi vastus lõpetab teavitaja enne kirjutamist. */
      findUnique: async () => null
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
const manual = (db, toStatus, { hooks = callHooks().hooks, now = NOW, reason } = {}) =>
  transitionInboxItem(coordinator(), 'i1', { toStatus, reason }, { db, now, ...hooks });
const refused = (promise, status, message) => assert.rejects(promise, (error) => error.status === status && error.message === message);
const transitions = (state) => state.audits.filter((row) => row.action === 'org.inbox_item_transitioned');

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
  const snapshot = (state) => JSON.stringify([state.item, state.assignments, state.audits, state.roomMembers]);
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
  assert.deepEqual(activeMembers(state), ['mari:MEMBER', 'pöörduja:OWNER']);
  const auditsBefore = state.audits.length;

  const { calls, hooks } = callHooks();
  const updated = await manual(db, 'ASSIGNMENT_PENDING', { hooks });

  /* Kirje ootab uut määramist; lõpetatud töö välju ei täideta, sest töö ei lõppenud. */
  assert.deepEqual([updated.status, state.item.lastTransitionAt, state.item.closedAt, state.item.closedReason], ['ASSIGNMENT_PENDING', NOW, null, null]);
  /* Määramine lõppes samas tehingus: ajalukku jääb rida, elavat määramist ei ole. */
  assert.deepEqual([state.assignments[0].id, state.assignments[0].status, state.assignments[0].endedAt], [first.id, 'ENDED', NOW]);
  assert.deepEqual(live(state), []);

  /* Töötaja lahkus ruumist ja vabastati ruumi kõnest; kõnet ennast ei lõpetata. */
  assert.deepEqual(activeMembers(state), ['pöörduja:OWNER']);
  assert.equal(state.roomMembers.find((row) => row.userId === 'mari').leftAt, NOW);
  assert.deepEqual(calls, { ended: [], released: [{ roomId: room.id, userId: 'mari' }] });
  /* Töö ei lõppenud: ruum ei ole arhiivis ja pöörduja saab edasi kirjutada. */
  assert.equal(state.rooms[0].archivedAt, null);
  assert.equal(await canWrite(db, room.id, 'pöörduja'), true);
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
  const second = await assignWork(coordinator(), 'i1', { assigneeMembershipId: 'm-jüri' }, { db, now: LATER });
  assert.deepEqual([state.item.status, live(state)], ['ASSIGNED', [['m-jüri', 'PENDING']]]);
  await respondToAssignment(context('jüri'), second.id, { accept: true }, { db, now: LATER });
  assert.deepEqual([state.item.status, live(state)], ['ACCEPTED', [['m-jüri', 'ACCEPTED']]]);
  assert.deepEqual(activeMembers(state), ['jüri:MEMBER', 'pöörduja:OWNER']);
  assert.deepEqual(await openRoom(db, 'jüri'), { room, created: false });
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
  assign: ({ db, viewer }) => assignWork(viewer, 'i1', { assigneeMembershipId: 'm-jüri' }, { db, now: NOW }),
  accept: ({ db, viewer, seen }) => (seen.assignment ? respondToAssignment(viewer, seen.assignment.id, { accept: true }, { db, now: NOW }) : null),
  reject: ({ db, viewer, seen }) => (seen.assignment ? respondToAssignment(viewer, seen.assignment.id, { accept: false }, { db, now: NOW }) : null),
  handOver: ({ db, viewer, seen }) =>
    seen.assignment ? handOverWork(viewer, seen.assignment.id, { toMembershipId: 'm-jüri' }, { db, now: NOW, releaseFromCalls: async () => {} }) : null,
  close: ({ db, viewer }) => transitionInboxItem(viewer, 'i1', { toStatus: 'CLOSED' }, { db, now: NOW, ...callHooks().hooks })
};
const OFFER_OF = { assign: 'assign', accept: 'respond', reject: 'respond', handOver: 'handOver', close: 'close' };

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
  await handOverWork(assigner, first.id, { toMembershipId: 'm-jüri' }, { db, now: NOW, releaseFromCalls: async () => {} });
  await assert.rejects(getInboxItem(assigner, 'i1', { db, now: LATER }), (error) => error.status === 404);
  /* Leht otsustab jäämise serveri öeldud `isCoordinator` järgi, mitte määramisõiguse järgi. */
  const page = readFileSync(new URL('../components/org/OrgInboxItemClient.jsx', import.meta.url), 'utf8');
  assert.ok(page.includes('if (item.isCoordinator) router.refresh();'));
});

test('leht saadab käsitsi ainult sulgemise ja keeldumise lause on kolmes keeles', () => {
  /* Kui lehele tuleb teine käsitsi seis, peab see olema üks lubatutest (vt tabel ülal). */
  const page = readFileSync(new URL('../components/org/OrgInboxItemClient.jsx', import.meta.url), 'utf8');
  assert.deepEqual([...page.matchAll(/toStatus: "(\w+)"/g)].map((match) => match[1]), ['CLOSED']);

  for (const locale of ['et', 'en', 'ru']) {
    const text = serverT(locale, FOLLOWS);
    assert.notEqual(text, FOLLOWS, locale);
    assert.ok(text.length > 40 && /\s/.test(text), locale);
    assert.equal(/[—–]/.test(text), false, locale);
    /* Lause nimetab seise samade sõnadega, mida laud näitab. */
    for (const status of ['ASSIGNED', 'ACCEPTED']) assert.ok(text.includes(serverT(locale, `org.inboxStatus.${status}`)), `${locale}: ${status}`);
  }
});
