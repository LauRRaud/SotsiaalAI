// Eelpöördumiste loend ütleb pöördujale, kas saaja on ühises ruumis vastanud.
//
// Teekond näitas saadetud pöördumise kohta „saaja on vastanud", eelpöördumiste leht sama
// pöördumise kohta kõige rohkem „vastu võetud": loendi vastus ei kandnud vastuste arvu.
// lib/preInquiryReplies.js annab selle arvu sama reegliga, mida kasutab Teekonna lugeja
// (lib/journey/service.js). Viimane test jooksutab mõlemad samade andmete peal.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readPreInquiryReplies, withPreInquiryReplies } from '../lib/preInquiryReplies.js';
import { listLinkedPreInquiriesForJourney } from '../lib/journey/service.js';
import { preInquirySenderState } from '../lib/preInquirySenderState.js';

const AUTHOR = 'u_author';
const WORKER = 'u_worker';
const OTHER = 'u_other';
const at = (hour) => new Date(`2026-10-10T${String(hour).padStart(2, '0')}:00:00.000Z`);

/* Tingimuse hindaja nii, nagu lugejad selle andmebaasile annavad: iga välja tingimus loetakse
   päringust endast. Kui lugeja jätab tingimuse ära, muutub tulemus. */
function matches(row, where = {}) {
  return Object.entries(where).every(([key, condition]) => {
    const value = row[key] ?? null;
    if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
      if ('in' in condition) return condition.in.includes(value);
      if ('not' in condition) return value !== condition.not;
      throw new Error(`tundmatu tingimus: ${key}`);
    }
    return value === condition;
  });
}

function fakeDb({ inquiries = [], rooms = [], messages = [] } = {}) {
  const calls = [];
  return {
    calls,
    preInquiry: {
      findMany: async ({ where }) => inquiries.filter((row) => row.sourceJourneyId === where.sourceJourneyId && row.authorId === where.authorId),
      count: async ({ where }) => inquiries.filter((row) => row.sourceJourneyId === where.sourceJourneyId && row.authorId === where.authorId).length
    },
    room: {
      findMany: async ({ where }) => {
        calls.push('room.findMany');
        return rooms.filter((room) => matches(room, where)).map(({ id, originId }) => ({ id, originId }));
      }
    },
    roomMessage: {
      groupBy: async ({ where }) => {
        calls.push('roomMessage.groupBy');
        const groups = new Map();
        for (const message of messages.filter((row) => matches(row, where))) {
          const group = groups.get(message.roomId) || { roomId: message.roomId, _count: { _all: 0 }, _max: { createdAt: null } };
          group._count._all += 1;
          if (!group._max.createdAt || message.createdAt > group._max.createdAt) group._max.createdAt = message.createdAt;
          groups.set(message.roomId, group);
        }
        return [...groups.values()];
      }
    },
    organizationInboxItem: { findMany: async () => [] }
  };
}

const message = (roomId, authorId, hour, over = {}) => ({ roomId, authorId, createdAt: at(hour), deletedAt: null, senderType: 'USER', ...over });
const data = () => ({
  rooms: [
    { id: 'r_a', originType: 'PRE_INQUIRY', originId: 'pi_a' },
    { id: 'r_b', originType: 'PRE_INQUIRY', originId: 'pi_b' },
    { id: 'r_d', originType: 'SERVICE_PROVIDER_INQUIRY', originId: 'pi_d' },
    /* Teist liiki ruum sama id-ga ei ole pöördumise ruum. */
    { id: 'r_x', originType: 'HELP_MATCH', originId: 'pi_c' }
  ],
  messages: [
    message('r_a', AUTHOR, 8),
    message('r_a', WORKER, 9),
    message('r_a', WORKER, 11),
    /* Kustutatud sõnum ja abilise sõnum ei ole vastus. */
    message('r_a', WORKER, 12, { deletedAt: at(13) }),
    message('r_a', null, 14, { senderType: 'ASSISTANT' }),
    /* Ruumis b on kirjutanud ainult pöörduja ise. */
    message('r_b', AUTHOR, 9),
    message('r_d', OTHER, 10),
    message('r_x', WORKER, 10)
  ]
});

test('vastus on teise inimese kustutamata sõnum pöördumise ruumis', async () => {
  const db = fakeDb(data());
  const replies = await readPreInquiryReplies(AUTHOR, ['pi_a', 'pi_b', 'pi_c', 'pi_d', 'pi_e'], { db });
  assert.deepEqual([...replies.keys()].sort(), ['pi_a', 'pi_d']);
  assert.deepEqual(replies.get('pi_a'), { replyCount: 2, lastReplyAt: at(11) });
  assert.deepEqual(replies.get('pi_d'), { replyCount: 1, lastReplyAt: at(10) });
  /* Saaja vaatest loetuna on „vastus" pöörduja sõnum: arv on kellegi teise sõnumite arv. */
  assert.equal((await readPreInquiryReplies(WORKER, ['pi_a'], { db })).get('pi_a').replyCount, 1);
});

test('tühi küsija või tühi loend ei tee päringut', async () => {
  const db = fakeDb(data());
  assert.equal((await readPreInquiryReplies('', ['pi_a'], { db })).size, 0);
  assert.equal((await readPreInquiryReplies(AUTHOR, [], { db })).size, 0);
  assert.equal((await readPreInquiryReplies(AUTHOR, ['', null], { db })).size, 0);
  assert.deepEqual(db.calls, []);
  /* Ruumita pöördumiste kohta sõnumeid ei küsita. */
  assert.equal((await readPreInquiryReplies(AUTHOR, ['pi_e'], { db })).size, 0);
  assert.deepEqual(db.calls, ['room.findMany']);
});

test('arv lisatakse ainult pöörduja enda saadetud ridadele', async () => {
  const db = fakeDb(data());
  const items = [
    { id: 'pi_a', authorId: AUTHOR, status: 'READY', sentAt: at(7).toISOString(), openedAt: at(8).toISOString() },
    { id: 'pi_b', authorId: AUTHOR, status: 'SENT', sentAt: at(7).toISOString() },
    { id: 'pi_draft', authorId: AUTHOR, status: 'DRAFT', sentAt: null },
    { id: 'pi_recalled', authorId: AUTHOR, status: 'SENT', sentAt: at(7).toISOString(), recalledAt: at(8).toISOString() },
    /* Rida, mille saaja on küsija ise: autor on keegi teine. */
    { id: 'pi_d', authorId: OTHER, recipientOwnerId: AUTHOR, status: 'SENT', sentAt: at(7).toISOString() }
  ];
  const result = await withPreInquiryReplies(AUTHOR, items, { db });
  assert.deepEqual(result.map((row) => row.id), items.map((row) => row.id), 'järjekord ja read jäävad samaks');
  assert.deepEqual([result[0].replyCount, result[0].lastReplyAt], [2, at(11).toISOString()]);
  assert.deepEqual([result[1].replyCount, result[1].lastReplyAt], [0, null]);
  for (const index of [2, 3, 4]) {
    assert.equal(result[index], items[index], `${items[index].id}: rida jääb puutumata`);
    assert.ok(!('replyCount' in result[index]));
  }
  /* Seisu reegel loeb arvu: sama pöördumine on nüüd „vastatud", mitte „vastu võetud". */
  assert.equal(preInquirySenderState(items[0]).key, 'accepted');
  assert.equal(preInquirySenderState(result[0]).key, 'answered');
  assert.equal(preInquirySenderState(result[1]).key, 'sent_waiting');
});

test('lugemise viga ei tee loendit katki', async () => {
  const broken = { room: { findMany: async () => { throw new Error('andmebaas ei vasta'); } } };
  const items = [{ id: 'pi_a', authorId: AUTHOR, status: 'SENT', sentAt: at(7).toISOString() }];
  assert.equal(await withPreInquiryReplies(AUTHOR, items, { db: broken }), items);
  /* Ilma küsijata, tühja või puuduva loendiga ei juhtu midagi. */
  assert.equal(await withPreInquiryReplies('', items, { db: broken }), items);
  assert.deepEqual(await withPreInquiryReplies(AUTHOR, null, { db: broken }), []);
});

test('sama reegel mis Teekonna lugejal', async () => {
  const seed = data();
  const inquiries = ['pi_a', 'pi_b', 'pi_c', 'pi_d'].map((id, index) => ({
    id,
    authorId: AUTHOR,
    sourceJourneyId: 'jrn_1',
    topic: id,
    status: 'READY',
    sentAt: at(7),
    openedAt: at(8),
    recalledAt: null,
    supersededById: null,
    externalSendConfirmedAt: null,
    createdAt: at(6),
    updatedAt: new Date(at(15).getTime() - index * 1000)
  }));
  const db = fakeDb({ ...seed, inquiries });
  const journey = await listLinkedPreInquiriesForJourney(AUTHOR, 'jrn_1', { db });
  const serialized = inquiries.map((row) => ({ id: row.id, authorId: row.authorId, status: row.status, sentAt: row.sentAt.toISOString(), openedAt: row.openedAt.toISOString() }));
  const list = await withPreInquiryReplies(AUTHOR, serialized, { db });
  const facts = (rows) => Object.fromEntries(rows.map((row) => [row.id, [row.replyCount, row.lastReplyAt]]));
  assert.deepEqual(facts(list), facts(journey.items));
  assert.deepEqual(facts(list).pi_a, [2, at(11).toISOString()]);
});

test('loend ja üksik pöördumine annavad arvu kaasa', () => {
  const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  /* Vastuste arvu peale lisatakse samas kohas asutuse otsus (tests/pre-inquiry-outcome.test.mjs). */
  assert.ok(read('../app/api/pre-inquiries/route.js').includes('await withPreInquiryReplies(auth.userId, page.items)'));
  assert.ok(read('../app/api/pre-inquiries/[id]/route.js').includes('await withPreInquiryReplies(auth.userId, [serializePreInquiry(inquiry, { viewerId: auth.userId })])'));
});
