// Kiire abi laua järjekord on nimekiri: selle lugemine ei jäta vastutusjälge, seega ei tohi
// see kanda pöörduja nime ega sisu. Need avanevad üksikvaates, kus avamine jätab jälje.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as deskQueue from '../lib/urgent/deskQueue.js';

const NOW = new Date('2026-10-10T08:00:00Z');
const at = (iso) => new Date(iso);

/* Andmebaasi rida kõigi veergudega: test näitab, mis sellest välja jõuab. */
const fullRow = (extra = {}) => ({
  id: 'u1',
  authorId: 'autor',
  deskId: 'laud-1',
  municipalityId: 'kov-1',
  situationVerbatim: 'Ema kukkus ja ei saa püsti.',
  assistantStructured: { summary: 'Kukkumine' },
  contactName: 'Mari Maasikas',
  contactPhone: '+372 5555 0000',
  status: 'SENT',
  readingTimePromise: 'Loeme tunni jooksul.',
  sentAt: at('2026-10-10T07:00:00Z'),
  expiresAt: at('2026-10-10T07:30:00Z'),
  readAt: null,
  takenAt: null,
  takenByUserId: null,
  handoverDeskId: null,
  handoverAcceptedAt: null,
  handedOverAt: null,
  handoverNote: null,
  ...extra
});

function makePrisma({ staff = true } = {}) {
  const calls = [];
  const rows = [
    fullRow(),
    fullRow({ id: 'u2', status: 'RESOLVED', sentAt: at('2026-10-09T07:00:00Z') }),
    fullRow({ id: 'u3', deskId: 'laud-2', handoverDeskId: 'laud-1', handedOverAt: at('2026-10-10T06:00:00Z'), handoverNote: 'Öine juhtum, palun üle võtta.', status: 'TAKEN' })
  ];
  /* Nagu Prisma: `select` määrab, mis veerud üldse loetakse. */
  const pick = (row, select) => (select ? Object.fromEntries(Object.keys(select).filter((key) => select[key]).map((key) => [key, row[key]])) : { ...row });
  return {
    calls,
    urgentDesk: { findFirst: async () => ({ id: 'laud-1', ownerUserId: staff ? 'tootaja' : 'keegi-teine' }) },
    urgentDeskMember: { findFirst: async () => null },
    urgentRequest: {
      findMany: async (args) => {
        calls.push(args);
        const statuses = args.where.status?.in || [];
        const mine = args.where.handoverDeskId
          ? rows.filter((row) => row.handoverDeskId === args.where.handoverDeskId)
          : rows.filter((row) => row.deskId === args.where.deskId && statuses.includes(row.status));
        return mine.map((row) => pick(row, args.select));
      },
      count: async () => 1
    },
    preInquiry: { findMany: async () => [], count: async () => 0 }
  };
}

test('järjekorra read ei kanna pöörduja nime, telefoni ega sisu', async () => {
  const prisma = makePrisma();
  const queue = await deskQueue.loadDeskQueue({ prisma, userId: 'tootaja', deskId: 'laud-1', now: () => NOW });

  assert.deepEqual(queue.active.map((row) => row.id), ['u1']);
  assert.deepEqual(queue.history.map((row) => row.id), ['u2']);
  assert.deepEqual(Object.keys(queue.active[0]).sort(), ['awaitingAnswer', 'expiresAt', 'handoverPending', 'id', 'kind', 'overdue', 'readAt', 'readingTimePromise', 'receivedAt', 'status', 'takenAt']);
  /* Lubadus ja tähtaeg on endiselt real: nende järgi töötaja järjekorda loeb. */
  assert.deepEqual([queue.active[0].readingTimePromise, queue.active[0].overdue, queue.active[0].awaitingAnswer], ['Loeme tunni jooksul.', true, true]);

  const sent = JSON.stringify(queue);
  for (const secret of ['Mari Maasikas', '5555', 'Ema kukkus', 'Kukkumine', 'autor', 'kov-1']) {
    assert.equal(sent.includes(secret), false, secret);
  }
  /* Ootav üleandmine kannab teise laua märkust, mitte pöörduja andmeid. */
  assert.deepEqual(queue.incomingHandovers, [{ id: 'u3', handedOverAt: '2026-10-10T06:00:00.000Z', handoverNote: 'Öine juhtum, palun üle võtta.', fromDeskId: 'laud-2' }]);
});

test('päringud ei loe sisu veerge andmebaasist üldse', async () => {
  const prisma = makePrisma();
  await deskQueue.loadDeskQueue({ prisma, userId: 'tootaja', deskId: 'laud-1', now: () => NOW });
  assert.equal(prisma.calls.length, 3);
  for (const call of prisma.calls) {
    assert.ok(call.select, 'iga kiire abi päring nimetab oma veerud');
    for (const column of ['situationVerbatim', 'assistantStructured', 'contactName', 'contactPhone', 'authorId', 'takenByUserId']) {
      assert.equal(column in call.select, false, column);
    }
  }
});

test('võõras ei saa järjekorda ja täisridu tagastavat funktsiooni enam ei ole', async () => {
  await assert.rejects(
    deskQueue.loadDeskQueue({ prisma: makePrisma({ staff: false }), userId: 'tootaja', deskId: 'laud-1', now: () => NOW }),
    (error) => error.code === 'urgent_request.forbidden' || error.message === 'urgent_request.forbidden'
  );
  /* `selectDeskRequests` andis laua täisread ilma õiguskontrolli ja jäljeta ning seda ei kutsunud keegi. */
  assert.equal('selectDeskRequests' in deskQueue, false);
  const source = readFileSync(new URL('../lib/urgent/deskQueue.js', import.meta.url), 'utf8');
  assert.equal(source.includes('contactName'), false);
  /* Leht ise näitab nime ainult avatud pöördumises. */
  const view = readFileSync(new URL('../components/urgent/UrgentDeskView.jsx', import.meta.url), 'utf8');
  assert.equal([...view.matchAll(/contactName/g)].length, 1);
  assert.match(view, /\{request\.contactName\}/);
});
