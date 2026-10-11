// Asutuse vastuvõtulaua pöördumise vestlusruum: kes saab ruumi avada ja mis juhtub
// liikmesusega töö vastuvõtmisel, üleandmisel ja sulgemisel (omaniku otsus 11.10.2026:
// töö üle võtnud töötaja näeb varasemat vestlust pöördujaga).
//
// Andmebaasi asemel on mälus hoitav kaksik, mis vastab ainult neile päringutele, mida
// need rajad teevad. Päris andmebaasiga käib sama lugu failis
// tests/org-inbox-room.integration.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkspaceContextKind } from '../lib/org/accessContext.js';
import { getInboxItem, handOverWork, respondToAssignment, transitionInboxItem } from '../lib/org/inbox.js';
import { ensureRoomForPreInquiry, findOrganizationInquiryForWorker } from '../lib/rooms/preInquiryRoom.js';

process.env.ORG_WORKSPACE_ENABLED = '1';
process.env.ORG_INBOX_ENABLED = '1';

const ORG = 'org-1';
const SENT = new Date('2026-10-10T08:00:00Z');
const NOW = new Date('2026-10-11T08:00:00Z');
const LIVE = ['PENDING', 'ACCEPTED'];

const matches = (value, rule) => {
  if (rule && typeof rule === 'object' && !(rule instanceof Date)) {
    if ('in' in rule) return rule.in.includes(value);
    if ('not' in rule) return value !== rule.not;
  }
  return value === rule;
};

/**
 * Lähteseis: pöörduja saatis pöördumise asutuse lauale, koordinaator avas selle ja määras
 * töö Mari-le, Mari võttis vastu. Jüri on sama asutuse teine töötaja, Tiit tavaline liige.
 */
function makeDb({ accepted = true } = {}) {
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
      openedAt: new Date('2026-10-10T09:00:00Z'),
      recalledAt: null
    },
    organization: { id: ORG, status: 'ACTIVE', modules: [{ moduleKey: 'KOV_INTAKE', status: 'ACTIVE' }] },
    item: { id: 'i1', organizationId: ORG, unitId: null, sourceType: 'PRE_INQUIRY', sourceId: 'p1', status: accepted ? 'ACCEPTED' : 'ASSIGNED', receivedAt: SENT, urgencyDeclaredBySender: null },
    memberships: ['koordinaator', 'mari', 'jüri', 'tiit'].map((userId) => ({ id: `m-${userId}`, organizationId: ORG, userId, status: 'ACTIVE' })),
    assignments: [{ id: 'a1', inboxItemId: 'i1', assigneeMembershipId: 'm-mari', status: accepted ? 'ACCEPTED' : 'PENDING' }],
    rooms: [],
    roomMembers: [],
    audits: [],
    rowLocks: []
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
    $queryRaw: async (strings, value) => {
      state.rowLocks.push(`${strings[0].match(/"(Organization\w+)"/)?.[1]}:${value}`);
      return [];
    },
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
      create: async ({ data }) => {
        const { members, ...rest } = data;
        const room = { id: id('r'), ...rest };
        state.rooms.push(room);
        for (const member of members.create) state.roomMembers.push({ id: id('rm'), roomId: room.id, leftAt: null, ...member });
        return { id: room.id, title: room.title };
      },
      update: async ({ where, data }) => Object.assign(state.rooms.find((row) => row.id === where.id), data)
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
const open = (db, userId) => ensureRoomForPreInquiry({ userId, inquiry: { id: 'p1' } }, { db });
const refused = (db, userId, status, message) => assert.rejects(open(db, userId), (error) => error.status === status && (!message || error.message === message));
const activeMembers = (state) => state.roomMembers.filter((row) => row.leftAt === null).map((row) => `${row.userId}:${row.role}`).sort();
const noCalls = async () => null;

test('ruumi avab töö vastu võtnud töötaja; koordinaator, ootel töötaja ja muu liige ei ava', async () => {
  const { db, state } = makeDb();

  /* Enne ruumi: kes ei ole osapool, saab 403 ja ruumi ei teki. */
  for (const stranger of ['koordinaator', 'jüri', 'tiit', 'võõras', '']) await refused(db, stranger, 403);
  assert.equal(state.rooms.length, 0);

  const first = await open(db, 'mari');
  assert.equal(first.created, true);
  assert.equal(first.room.title, 'Eelpöördumine: Koduteenus');
  assert.deepEqual(activeMembers(state), ['mari:MEMBER', 'pöörduja:OWNER']);
  assert.equal(state.rooms[0].ownerId, 'pöörduja');
  assert.equal(state.rooms[0].originType, 'PRE_INQUIRY');
  /* Töömääramine loeti postkastikirje rea luku all. */
  assert.ok(state.rowLocks.includes('OrganizationInboxItem:i1'));

  /* Üks ruum pöördumise kohta: kordus ja pöörduja saavad sama ruumi. */
  assert.deepEqual(await open(db, 'mari'), { room: first.room, created: false });
  assert.deepEqual(await open(db, 'pöörduja'), { room: first.room, created: false });
  assert.equal(state.rooms.length, 1);

  /* Olemasolev ruum ei ava ust kellelegi teisele ja liikmeid ei lisandu. */
  for (const stranger of ['koordinaator', 'jüri', 'tiit', 'võõras']) await refused(db, stranger, 403);
  assert.deepEqual(activeMembers(state), ['mari:MEMBER', 'pöörduja:OWNER']);
});

test('enne töö vastuvõtmist ruumi ei ole: ootel töötaja saab 403, pöörduja 409', async () => {
  const { db, state } = makeDb({ accepted: false });
  await refused(db, 'mari', 403);
  await refused(db, 'pöörduja', 409, 'pre_inquiries.errors.room_requires_acceptance');
  assert.equal(await findOrganizationInquiryForWorker('mari', 'p1', { db }), null);

  /* Vastuvõtmine ilma ruumita ruumi ei loo; alles nupuvajutus teeb selle. */
  await respondToAssignment(context('mari'), 'a1', { accept: true }, { db, now: NOW });
  assert.equal(state.rooms.length, 0);
  assert.deepEqual(await findOrganizationInquiryForWorker('mari', 'p1', { db }), { id: 'p1', recipientOrganizationId: ORG });
  assert.equal((await open(db, 'mari')).created, true);
});

test('tagasi võetud, saatmata ja avamata pöördumine ruumi ei saa', async () => {
  const recalled = makeDb();
  recalled.state.inquiry.recalledAt = NOW;
  await refused(recalled.db, 'mari', 404);
  await refused(recalled.db, 'pöörduja', 404);

  const unopened = makeDb();
  unopened.state.inquiry.openedAt = null;
  await refused(unopened.db, 'mari', 409, 'pre_inquiries.errors.room_requires_acceptance');

  const unsent = makeDb();
  unsent.state.inquiry.sentAt = null;
  await refused(unsent.db, 'mari', 409, 'pre_inquiries.errors.not_sent');

  /* Pöörduja on ise sama asutuse töötaja ja sai oma pöördumise: kahte osapoolt ei ole. */
  const own = makeDb();
  own.state.inquiry.authorId = 'mari';
  await refused(own.db, 'mari', 409, 'pre_inquiries.errors.room_requires_platform_recipient');
});

test('suletud laud, peatatud liikmesus, välja lülitatud moodul ja lipp: töötaja ei ole osapool', async () => {
  const closed = makeDb();
  closed.state.item.status = 'CLOSED';
  await refused(closed.db, 'mari', 403);

  const suspended = makeDb();
  suspended.state.memberships.find((row) => row.userId === 'mari').status = 'SUSPENDED';
  await refused(suspended.db, 'mari', 403);
  assert.equal(await findOrganizationInquiryForWorker('mari', 'p1', { db: suspended.db }), null);

  const noModule = makeDb();
  noModule.state.organization.modules = [];
  await refused(noModule.db, 'mari', 403);

  const flagOff = makeDb();
  process.env.ORG_INBOX_ENABLED = '0';
  try {
    await refused(flagOff.db, 'mari', 403);
    assert.equal(await findOrganizationInquiryForWorker('mari', 'p1', { db: flagOff.db }), null);
  } finally {
    process.env.ORG_INBOX_ENABLED = '1';
  }
});

test('üleandmine: senine vastutaja lahkub kohe, uus liitub vastuvõtmisel ja saab sama ruumi', async () => {
  const { db, state } = makeDb();
  const { room } = await open(db, 'mari');
  const released = [];
  const releaseFromCalls = async (left) => released.push(left);

  const next = await handOverWork(coordinator(), 'a1', { toMembershipId: 'm-jüri' }, { db, now: NOW, releaseFromCalls });
  assert.equal(next.status, 'PENDING');
  assert.equal('_left' in next, false);
  /* Mari liikmesus lõppes samas tehingus ja ta vabastati ruumi kõnest. */
  assert.deepEqual(activeMembers(state), ['pöörduja:OWNER']);
  assert.equal(state.roomMembers.find((row) => row.userId === 'mari').leftAt, NOW);
  assert.deepEqual(released, [{ roomId: room.id, userId: 'mari' }]);

  /* Endise vastutaja lahkunud liikmesust ei taastata; määratud, aga vastu võtmata töötaja
     ei saa samuti sisse. Pöörduja ruum on alles. */
  await refused(db, 'mari', 403);
  await refused(db, 'jüri', 403);
  assert.equal(await findOrganizationInquiryForWorker('mari', 'p1', { db }), null);
  assert.deepEqual(await open(db, 'pöörduja'), { room, created: false });
  assert.deepEqual(activeMembers(state), ['pöörduja:OWNER']);

  /* Jüri võtab töö vastu: ta on kohe sama ruumi liige (omaniku otsus), uut ruumi ei teki. */
  await respondToAssignment(context('jüri'), next.id, { accept: true }, { db, now: NOW });
  assert.deepEqual(activeMembers(state), ['jüri:MEMBER', 'pöörduja:OWNER']);
  assert.deepEqual(await open(db, 'jüri'), { room, created: false });
  assert.equal(state.rooms.length, 1);
  await refused(db, 'mari', 403);
  await refused(db, 'koordinaator', 403);

  /* Töö läheb Mari-le tagasi: tema vana liikmesuse rida võetakse uuesti kasutusele. */
  const back = await handOverWork(context('jüri'), next.id, { toMembershipId: 'm-mari' }, { db, now: NOW, releaseFromCalls });
  await respondToAssignment(context('mari'), back.id, { accept: true }, { db, now: NOW });
  assert.deepEqual(activeMembers(state), ['mari:MEMBER', 'pöörduja:OWNER']);
  assert.equal(state.roomMembers.filter((row) => row.userId === 'mari').length, 1);
});

test('üleandmine enne ruumi ja tagasilükkamine: liikmesust ei teki', async () => {
  const { db, state } = makeDb();
  let released = 0;
  const next = await handOverWork(coordinator(), 'a1', { toMembershipId: 'm-jüri' }, { db, now: NOW, releaseFromCalls: async () => { released += 1; } });
  assert.equal(released, 0);
  await respondToAssignment(context('jüri'), next.id, { accept: false, reason: 'puhkusel' }, { db, now: NOW });
  assert.equal(state.rooms.length, 0);
  assert.equal(state.roomMembers.length, 0);
  await refused(db, 'jüri', 403);
});

test('töö sulgemine lõpetab vastutaja ligipääsu, ruum jääb pöördujale', async () => {
  const { db, state } = makeDb();
  const { room } = await open(db, 'mari');
  const released = [];
  await transitionInboxItem(coordinator(), 'i1', { toStatus: 'CLOSED' }, { db, now: NOW, releaseFromCalls: async (left) => released.push(left) });
  assert.equal(state.assignments[0].status, 'ENDED');
  assert.deepEqual(activeMembers(state), ['pöörduja:OWNER']);
  assert.deepEqual(released, [{ roomId: room.id, userId: 'mari' }]);
  await refused(db, 'mari', 403);
  assert.deepEqual(await open(db, 'pöörduja'), { room, created: false });
});

test('ruumi omanikuks tehtud töötaja lahkumisel läheb omaniku roll pöördujale tagasi', async () => {
  const { db, state } = makeDb();
  await open(db, 'mari');
  /* Pöörduja andis ruumi üle töötajale (ruumide leht lubab seda) ja lahkus ise. */
  state.rooms[0].ownerId = 'mari';
  Object.assign(state.roomMembers.find((row) => row.userId === 'mari'), { role: 'OWNER' });
  Object.assign(state.roomMembers.find((row) => row.userId === 'pöörduja'), { role: 'MODERATOR', leftAt: SENT });

  await handOverWork(coordinator(), 'a1', { toMembershipId: 'm-jüri' }, { db, now: NOW, releaseFromCalls: noCalls });
  assert.equal(state.rooms[0].ownerId, 'pöörduja');
  assert.deepEqual(activeMembers(state), ['pöörduja:OWNER']);
  assert.equal(state.roomMembers.find((row) => row.userId === 'mari').role, 'MEMBER');
});

test('pöörduja, kes on sama asutuse töötaja, ei lahku oma pöördumise ruumist', async () => {
  const { db, state } = makeDb();
  await open(db, 'mari');
  /* Töö antakse pöördujale endale ja temalt edasi: tema liikmesus ruumis ei tohi lõppeda. */
  state.memberships.push({ id: 'm-pöörduja', organizationId: ORG, userId: 'pöörduja', status: 'ACTIVE' });
  const own = await handOverWork(coordinator(), 'a1', { toMembershipId: 'm-pöörduja' }, { db, now: NOW, releaseFromCalls: noCalls });
  await respondToAssignment(context('pöörduja'), own.id, { accept: true }, { db, now: NOW });
  assert.deepEqual(activeMembers(state), ['pöörduja:OWNER']);
  await handOverWork(coordinator(), own.id, { toMembershipId: 'm-jüri' }, { db, now: NOW, releaseFromCalls: noCalls });
  assert.deepEqual(activeMembers(state), ['pöörduja:OWNER']);
});

test('kirje vaade: ruumi nupp ainult vastu võtnud vastutajale, ruumi ID ainult liikmele', async () => {
  const { db } = makeDb();
  const asWorker = () => getInboxItem(context('mari'), 'i1', { db, now: NOW });
  const asCoordinator = () => getInboxItem(coordinator(), 'i1', { db, now: NOW });

  assert.deepEqual((await asWorker()).room, { canOpen: true, id: null });
  assert.deepEqual((await asCoordinator()).room, { canOpen: false, id: null });

  const { room } = await open(db, 'mari');
  assert.deepEqual((await asWorker()).room, { canOpen: true, id: room.id });
  /* Koordinaator ei saa ruumi ega ka teada, et see on olemas. Pakett on mõlemal sama. */
  const seen = await asCoordinator();
  assert.deepEqual(seen.room, { canOpen: false, id: null });
  assert.deepEqual(seen.source, (await asWorker()).source);
  assert.equal('authorId' in seen.source, false);

  /* Ootel määramine nuppu ei anna. */
  const pending = makeDb({ accepted: false });
  assert.deepEqual((await getInboxItem(context('mari'), 'i1', { db: pending.db, now: NOW })).room, { canOpen: false, id: null });

  /* Suletud töö: vastutajat enam ei ole, kirje avab ainult koordinaator ja nuppu ei ole. */
  await transitionInboxItem(coordinator(), 'i1', { toStatus: 'CLOSED' }, { db, now: NOW, releaseFromCalls: noCalls });
  await assert.rejects(asWorker(), (error) => error.status === 404);
  assert.deepEqual((await asCoordinator()).room, { canOpen: false, id: null });
});
