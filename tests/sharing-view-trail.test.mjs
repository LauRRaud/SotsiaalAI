// „Kes on vaadanud": jagatu vaatamiste jälg (funktsioonikaart F13).
//
// Reeglid, mida siin hoitakse: päev on Eesti päev; jagaja enda vaatamist ei logita; kirjutus
// ei viska kunagi ega tee sama päeva kohta teist rida; jagaja näeb ainult kokkuvõtet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { sharingRow, sharingSheet, viewTrailNote } from '../components/sharings/desk/sharingRows.js';
import { markShareOpened } from '../lib/network/share.js';
import { WorkspaceContextKind } from '../lib/org/accessContext.js';
import { getInboxItem } from '../lib/org/inbox.js';
import { recordPreInquiryView } from '../lib/preInquiries.js';
import {
  SharingViewKind,
  attachSharingViews,
  loadSharingViewSummary,
  recordSharingView,
  shouldRecordSharingView,
  summarizeSharingViews,
  viewDay
} from '../lib/sharings/viewTrail.js';

const catalogue = (locale) => JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
const et = catalogue('et');
const lookup = (messages, key) => key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), messages);
const tEt = (key, vars) => {
  const value = lookup(et, key);
  if (typeof value !== 'string') return key;
  return vars ? value.replace(/\{(\w+)\}/g, (mark, name) => (name in vars ? String(vars[name]) : mark)) : value;
};
const context = { t: tEt, formatDate: (value) => `aeg:${String(value).slice(0, 10)}`, formatDay: (value) => `kp:${String(value).slice(0, 10)}`, formatMonth: (value) => value };

/* Kerge ühendus, mis peab meeles, mida jäljesse kirjutati; kordumatu võti nagu andmebaasis. */
function trailDb({ fail = false } = {}) {
  const rows = [];
  return {
    rows,
    sharingView: {
      createMany: async ({ data, skipDuplicates }) => {
        if (fail) throw new Error('relation "SharingView" does not exist');
        assert.equal(skipDuplicates, true);
        let count = 0;
        for (const row of data) {
          const key = (item) => [item.kind, item.preInquiryId || '', item.networkShareId || '', item.viewerUserId, item.day].join('|');
          if (rows.some((item) => key(item) === key(row))) continue;
          rows.push(row);
          count += 1;
        }
        return { count };
      },
      groupBy: async ({ by, where }) => {
        if (fail) throw new Error('relation "SharingView" does not exist');
        const field = by[0];
        const seen = new Map();
        for (const row of rows) {
          if (row.kind !== where.kind || !where[field].in.includes(row[field])) continue;
          seen.set(`${row[field]}|${row.day}`, { [field]: row[field], day: row.day });
        }
        return [...seen.values()];
      }
    }
  };
}

test('vaatamise päev on Eesti päev, mitte serveri oma', () => {
  /* Suveajal (UTC+3) algab Eesti päev kell 21.00 UTC, talveajal (UTC+2) kell 22.00 UTC. */
  assert.equal(viewDay(new Date('2026-07-01T20:59:00Z')), '2026-07-01');
  assert.equal(viewDay(new Date('2026-07-01T21:00:00Z')), '2026-07-02');
  assert.equal(viewDay(new Date('2026-12-31T21:59:00Z')), '2026-12-31');
  assert.equal(viewDay(new Date('2026-12-31T22:00:00Z')), '2027-01-01');
});

test('jäljesse läheb ainult saaja lugemine: jagaja enda ja jagajata rea oma mitte', () => {
  const base = { kind: SharingViewKind.NETWORK_SHARE, itemId: 's1', viewerUserId: 'saaja', sharerUserIds: ['tootaja', 'klient'] };
  assert.equal(shouldRecordSharingView(base), true);
  /* Jagaja ise (töötaja, kes adresseeris jagamise endale, või klient). */
  assert.equal(shouldRecordSharingView({ ...base, viewerUserId: 'tootaja' }), false);
  assert.equal(shouldRecordSharingView({ ...base, viewerUserId: 'klient' }), false);
  /* Jagaja konto on kustutatud: jälge ei oleks kellelgi näha. */
  assert.equal(shouldRecordSharingView({ ...base, sharerUserIds: [null, undefined] }), false);
  assert.equal(shouldRecordSharingView({ ...base, sharerUserIds: [] }), false);
  /* Väline klient (kontota) ja töötaja: töötaja on jagaja. */
  assert.equal(shouldRecordSharingView({ ...base, sharerUserIds: ['tootaja', null] }), true);
  for (const broken of [{ kind: 'ROOM' }, { itemId: '' }, { viewerUserId: null }]) assert.equal(shouldRecordSharingView({ ...base, ...broken }), false);
});

test('üks rida vaataja ja päeva kohta; kirjutus ei viska kunagi', async () => {
  const db = trailDb();
  const view = (extra = {}) =>
    recordSharingView({ db, kind: SharingViewKind.PRE_INQUIRY, itemId: 'p1', viewerUserId: 'koordinaator', sharerUserIds: ['autor'], now: new Date('2026-10-09T08:00:00Z'), ...extra });
  assert.equal(await view(), true);
  assert.equal(await view({ now: new Date('2026-10-09T15:00:00Z') }), false);
  assert.equal(await view({ now: new Date('2026-10-10T08:00:00Z') }), true);
  assert.equal(await view({ viewerUserId: 'kolleeg' }), true);
  assert.equal(await view({ viewerUserId: 'autor' }), false);
  assert.deepEqual(
    db.rows.map((row) => [row.kind, row.preInquiryId, row.networkShareId, row.viewerUserId, row.day]),
    [
      ['PRE_INQUIRY', 'p1', undefined, 'koordinaator', '2026-10-09'],
      ['PRE_INQUIRY', 'p1', undefined, 'koordinaator', '2026-10-10'],
      ['PRE_INQUIRY', 'p1', undefined, 'kolleeg', '2026-10-09']
    ]
  );
  /* Puuduv tabel (kood jõudis ette migratsioonist), mudelita testiühendus ja ühenduseta kutse: ei viska, jälge ei teki. */
  const silenced = console.error;
  console.error = () => {};
  try {
    assert.equal(await recordSharingView({ db: trailDb({ fail: true }), kind: SharingViewKind.PRE_INQUIRY, itemId: 'p1', viewerUserId: 'x', sharerUserIds: ['autor'] }), false);
    assert.deepEqual([...(await loadSharingViewSummary(trailDb({ fail: true }), SharingViewKind.PRE_INQUIRY, ['p1']))], []);
  } finally {
    console.error = silenced;
  }
  assert.equal(await recordSharingView({ db: {}, kind: SharingViewKind.PRE_INQUIRY, itemId: 'p1', viewerUserId: 'x', sharerUserIds: ['autor'] }), false);
  assert.equal(await recordSharingView({ db: null, kind: SharingViewKind.PRE_INQUIRY, itemId: 'p1', viewerUserId: 'x', sharerUserIds: ['autor'] }), false);
});

test('kokkuvõte: mitme vaataja sama päev on üks päev, viimane päev on hiliseim', async () => {
  const summary = summarizeSharingViews(
    [
      { preInquiryId: 'p1', day: '2026-10-09' },
      { preInquiryId: 'p1', day: '2026-10-09' },
      { preInquiryId: 'p1', day: '2026-10-02' },
      { preInquiryId: 'p2', day: '2026-09-30' },
      { preInquiryId: null, day: '2026-10-01' },
      { preInquiryId: 'p3' }
    ],
    'preInquiryId'
  );
  assert.deepEqual([...summary], [['p1', { days: 2, lastDay: '2026-10-09' }], ['p2', { days: 1, lastDay: '2026-09-30' }]]);

  const db = trailDb();
  for (const [viewer, now] of [['a', '2026-10-01T08:00:00Z'], ['b', '2026-10-01T09:00:00Z'], ['a', '2026-10-05T08:00:00Z']]) {
    await recordSharingView({ db, kind: SharingViewKind.NETWORK_SHARE, itemId: 's1', viewerUserId: viewer, sharerUserIds: ['tootaja'], now: new Date(now) });
  }
  const items = [{ id: 's1', status: 'OPENED' }, { id: 's2', status: 'SENT' }];
  /* Rida ilma vaatamisteta jääb täpselt selleks, mis ta oli: välja `views` ei lisandu. */
  assert.deepEqual(await attachSharingViews(db, SharingViewKind.NETWORK_SHARE, items), [{ id: 's1', status: 'OPENED', views: { days: 2, lastDay: '2026-10-05' } }, { id: 's2', status: 'SENT' }]);
  assert.equal(await attachSharingViews(db, SharingViewKind.PRE_INQUIRY, items), items);
  assert.equal(await attachSharingViews(trailDb(), SharingViewKind.NETWORK_SHARE, items), items);
});

test('esimese avamise päev loeb vaatamispäevaks ka siis, kui see oli enne jälje sündi', async () => {
  /* Avati 2. oktoobril (jälge veel ei olnud), loeti uuesti 14. oktoobril: kaks päeva, mitte üks. */
  const rows = [{ networkShareId: 's1', day: '2026-10-14' }, { networkShareId: 's2', day: '2026-10-14' }];
  const firstOpen = new Map([['s1', '2026-10-02'], ['s2', '2026-10-14'], ['s3', '2026-10-01']]);
  assert.deepEqual([...summarizeSharingViews(rows, 'networkShareId', firstOpen)], [
    ['s1', { days: 2, lastDay: '2026-10-14' }],
    ['s2', { days: 1, lastDay: '2026-10-14' }]
  ]);
  /* Avatud, aga jäljeta jagamine kokkuvõtet ei saa: lauset ei teki ainult avamise aja põhjal. */
  assert.equal(summarizeSharingViews(rows, 'networkShareId', firstOpen).has('s3'), false);

  const db = trailDb();
  await recordSharingView({ db, kind: SharingViewKind.NETWORK_SHARE, itemId: 's1', viewerUserId: 'saaja', sharerUserIds: ['tootaja'], now: new Date('2026-10-14T08:00:00Z') });
  /* `openedAt` võib olla ISO-tekst (lehe rida) või kuupäev (väljavõtte rida); vigane väärtus jääb välja.
     Kell 21.30 UTC 1. oktoobril on Eestis juba 2. oktoober. */
  for (const openedAt of ['2026-10-01T21:30:00.000Z', new Date('2026-10-01T21:30:00Z')]) {
    assert.deepEqual((await attachSharingViews(db, SharingViewKind.NETWORK_SHARE, [{ id: 's1', openedAt }]))[0].views, { days: 2, lastDay: '2026-10-14' });
  }
  assert.deepEqual((await attachSharingViews(db, SharingViewKind.NETWORK_SHARE, [{ id: 's1', openedAt: 'eile' }]))[0].views, { days: 1, lastDay: '2026-10-14' });
  assert.deepEqual((await attachSharingViews(db, SharingViewKind.NETWORK_SHARE, [{ id: 's1' }]))[0].views, { days: 1, lastDay: '2026-10-14' });
});

test('asutuse postkast: jälg kirjutatakse pärast lugemise tehingut ja selle viga ei lõhu lugemist', async () => {
  const inquiry = { id: 'p1', topic: 'Koduteenus', situation: 'Ema ei saa enam ise poes käia.', status: 'SENT', sentAt: new Date('2026-10-08T08:00:00Z'), openedAt: new Date('2026-10-08T09:00:00Z'), recalledAt: null, authorId: 'autor' };
  const item = { id: 'i1', organizationId: 'org-1', unitId: null, status: 'RECEIVED', sourceType: 'PRE_INQUIRY', sourceId: 'p1', receivedAt: new Date('2026-10-08T08:00:00Z'), urgencyDeclaredBySender: null, assignments: [] };
  const context = (userId) => ({
    kind: WorkspaceContextKind.ORGANIZATION,
    userId,
    organization: { id: 'org-1' },
    membership: { id: `m-${userId}` },
    capabilities: [{ capability: 'INBOX_COORDINATOR', scopeType: 'ORGANIZATION' }]
  });
  const makeDb = ({ rejectWrite = false } = {}) => {
    const state = { inTransaction: false, writes: [] };
    /* Tehingu ühendusel EI OLE jälje mudelit: kui kirjutus läheks tehingu sisse, ei tekiks rida. */
    const tx = {
      organizationInboxItem: { findFirst: async () => ({ ...item }) },
      preInquiry: { findUnique: async () => ({ ...inquiry }), updateMany: async () => ({ count: 0 }) }
    };
    return {
      state,
      $transaction: async (run) => {
        state.inTransaction = true;
        try {
          return await run(tx);
        } finally {
          state.inTransaction = false;
        }
      },
      sharingView: {
        createMany: async ({ data }) => {
          state.writes.push({ ...data[0], inTransaction: state.inTransaction });
          if (rejectWrite) throw new Error('insert or update on table "SharingView" violates foreign key constraint');
          return { count: 1 };
        }
      }
    };
  };
  const now = new Date('2026-10-09T08:00:00Z');

  const db = makeDb();
  const read = await getInboxItem(context('koordinaator'), 'i1', { db, now });
  assert.equal(read.source.situation, 'Ema ei saa enam ise poes käia.');
  assert.deepEqual(db.state.writes, [{ kind: 'PRE_INQUIRY', preInquiryId: 'p1', viewerUserId: 'koordinaator', day: '2026-10-09', inTransaction: false }]);

  /* Kirjutuse viga (näiteks vaataja konto kustub samal ajal) ei jõua lugejani. */
  const failing = makeDb({ rejectWrite: true });
  const silenced = console.error;
  console.error = () => {};
  try {
    assert.equal((await getInboxItem(context('koordinaator'), 'i1', { db: failing, now })).source.situation, 'Ema ei saa enam ise poes käia.');
  } finally {
    console.error = silenced;
  }
  assert.equal(failing.state.writes.length, 1);

  /* Autor, kes on sama asutuse koordinaator, ja autorita rida: kirjutust ei tehta üldse. */
  const own = makeDb();
  await getInboxItem(context('autor'), 'i1', { db: own, now });
  assert.deepEqual(own.state.writes, []);
  inquiry.authorId = null;
  const orphan = makeDb();
  await getInboxItem(context('koordinaator'), 'i1', { db: orphan, now });
  assert.deepEqual(orphan.state.writes, []);
  /* Tagasi võetud pöördumine: sisu ei näidata ja jälge ei teki. */
  inquiry.authorId = 'autor';
  inquiry.recalledAt = new Date('2026-10-08T10:00:00Z');
  const recalled = makeDb();
  assert.equal((await getInboxItem(context('koordinaator'), 'i1', { db: recalled, now })).source, null);
  assert.deepEqual(recalled.state.writes, []);
});

test('võrgustikujagamise otselugemine: jälg ainult saaja harus ja alles siis, kui sisu anti', () => {
  const route = readFileSync(new URL('../app/api/network-shares/[shareId]/route.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.equal([...route.matchAll(/recordSharingView\(/g)].length, 1);
  const recipientBranch = route.indexOf('if (share.recipientUserId === auth.userId) {');
  const withheld = route.indexOf('if (!view) return shareError("network_share.not_found", 404);', recipientBranch);
  const record = route.indexOf('recordSharingView(');
  const clientBranch = route.indexOf('if (share.clientUserId && share.clientUserId === auth.userId) {');
  assert.ok(recipientBranch > 0 && withheld > recipientBranch && record > withheld && clientBranch > record, 'jälg on saaja harus pärast sisu väravat ja enne kliendi haru');
  assert.match(route.slice(record, clientBranch), /viewerUserId: auth\.userId,\s+sharerUserIds: \[share\.workerId, share\.clientUserId\]/);
});

test('võrgustikujagamise avamine jätab jälje esimesel ja igal hilisemal lugemisel', async () => {
  const share = { id: 'share-1', workerId: 'tootaja', clientUserId: 'klient', recipientUserId: 'saaja', status: 'SENT', participationEndsOn: new Date('2027-01-01T00:00:00Z') };
  const trail = trailDb();
  const db = {
    ...trail,
    networkShare: {
      findFirst: async () => ({ ...share }),
      updateMany: async ({ where, data }) => {
        if (share.status !== where.status) return { count: 0 };
        Object.assign(share, data);
        return { count: 1 };
      }
    }
  };
  const open = (now) => markShareOpened({ prisma: db, shareId: 'share-1', recipientUserId: 'saaja', now: () => new Date(now) });
  assert.equal((await open('2026-10-09T08:00:00Z')).status, 'OPENED');
  /* Sama päeva teine lugemine rida ei lisa; järgmise päeva oma lisab. Avamise aeg ei nihku. */
  await open('2026-10-09T12:00:00Z');
  await open('2026-10-10T08:00:00Z');
  assert.deepEqual(trail.rows.map((row) => [row.kind, row.networkShareId, row.viewerUserId, row.day]), [
    ['NETWORK_SHARE', 'share-1', 'saaja', '2026-10-09'],
    ['NETWORK_SHARE', 'share-1', 'saaja', '2026-10-10']
  ]);
  assert.equal(share.openedAt.toISOString(), '2026-10-09T08:00:00.000Z');
  /* Võõras ei saa avada ja jälge temast ei jää. */
  await assert.rejects(markShareOpened({ prisma: db, shareId: 'share-1', recipientUserId: 'voooras', now: () => new Date('2026-10-11T08:00:00Z') }), (error) => error.code === 'network_share.forbidden');
  assert.equal(trail.rows.length, 2);
  /* Töötaja, kes adresseeris jagamise iseendale, on jagaja: tema lugemist ei logita. */
  share.recipientUserId = 'tootaja';
  await markShareOpened({ prisma: db, shareId: 'share-1', recipientUserId: 'tootaja', now: () => new Date('2026-10-12T08:00:00Z') });
  assert.equal(trail.rows.length, 2);
});

test('jagaja näeb kokkuvõtet avatud kirjes; ilma vaatamisteta lauset ei ole', () => {
  assert.deepEqual(viewTrailNote({ views: { days: 1, lastDay: '2026-10-09' } }, context), ['Adressaat on seda vaadanud ühel päeval: kp:2026-10-09']);
  assert.deepEqual(viewTrailNote({ views: { days: 3, lastDay: '2026-10-09' } }, context), ['Adressaat on seda vaadanud 3 päeval, viimati kp:2026-10-09']);
  for (const item of [{}, null, { views: null }, { views: { days: 0, lastDay: '2026-10-09' } }, { views: { days: 2 } }, { views: { days: 'kaks', lastDay: '2026-10-09' } }]) {
    assert.deepEqual(viewTrailNote(item, context), []);
  }

  /* Saadetud eelpöördumine: lause on enne mälumärkust. */
  const sent = { id: 'p3', topic: 'Toetus', recipientLabel: 'Elva vald', deliveryChannel: 'INTERNAL', status: 'SENT', sentAt: '2026-09-01T10:00:00.000Z', openedAt: '2026-09-02T10:00:00.000Z' };
  assert.deepEqual(sharingSheet('preInquiries', { ...sent, views: { days: 2, lastDay: '2026-09-05' } }, context).notes, [
    'Adressaat on seda vaadanud 2 päeval, viimati kp:2026-09-05.',
    tEt('my_sharings.notice.memory')
  ]);
  assert.deepEqual(sharingSheet('preInquiries', sent, context).notes, [tEt('my_sharings.notice.memory')]);

  /* Jagamine minu kohta (klient): lause avatud kirje märkustes. */
  const incoming = { id: 'n0', status: 'OPENED', summaryText: 'Kokkuvõte', purpose: 'Koduteenus', sharingBoundary: 'Ainult teenuse vajadus' };
  assert.deepEqual(sharingSheet('networkShares', { ...incoming, views: { days: 1, lastDay: '2026-10-09' } }, context).notes, ['Adressaat on seda vaadanud ühel päeval: kp:2026-10-09.']);
  assert.deepEqual(sharingSheet('networkShares', incoming, context).notes, []);

  /* Minu saadetud jagamine (töötaja): rida ei avane, lause on nähtavuse fakti lõpus. */
  const outgoing = { id: 'o1', status: 'OPENED', recipientLabel: 'Mari Maasikas', participationEndsOn: '2026-12-01T00:00:00.000Z' };
  assert.equal(
    sharingRow('outgoingNetworkShares', { ...outgoing, views: { days: 4, lastDay: '2026-10-09' } }, context).facts.visibility,
    'Jagatud: Mari Maasikas. Adressaat on seda vaadanud 4 päeval, viimati kp:2026-10-09'
  );
  assert.equal(sharingRow('outgoingNetworkShares', outgoing, context).facts.visibility, 'Jagatud: Mari Maasikas');
});

test('vaatamiste laused on kolmes keeles samade kohatäitjatega ega nimeta vaatajat', () => {
  const marks = (value) => [...String(value).matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  for (const key of ['viewed_one_day', 'viewed_days']) {
    const base = et.my_sharings.ownership[key];
    assert.ok(base, key);
    for (const locale of ['en', 'ru']) {
      const value = catalogue(locale).my_sharings.ownership[key];
      assert.ok(value, `${locale} ${key}`);
      assert.deepEqual(marks(value), marks(base), `${locale} ${key}`);
    }
    /* Asutuse postkasti puhul oleks vaataja nimi või vaatajate arv asutuse sisemine asi. */
    assert.equal(marks(base).some((mark) => ['name', 'viewer', 'viewers', 'count'].includes(mark)), false);
    /* Eesti tekstis ei ole mõttekriipsu, lühikest kriipsu ega sirgeid jutumärke; lehe sõna on „adressaat". */
    assert.equal(/[\u2014\u2013"]/.test(base), false, key);
    assert.match(base, /^Adressaat /, key);
  }
});

test('isikule saadetud eelpöördumine: avamise teade jätab jälje alles pärast vastuvõtmist ja ainult saajale', async () => {
  const makeDb = (row) => {
    const state = { queries: [], writes: [] };
    return {
      state,
      preInquiry: {
        findFirst: async (args) => {
          state.queries.push(args);
          return row ? { ...row } : null;
        }
      },
      sharingView: {
        createMany: async ({ data }) => {
          state.writes.push({ ...data[0] });
          return { count: 1 };
        }
      }
    };
  };
  const now = new Date('2026-10-09T08:00:00Z');
  const notFound = (error) => error.status === 404 && error.message === 'api.common.not_found';

  const accepted = makeDb({ id: 'p1', authorId: 'autor', openedAt: new Date('2026-10-08T09:00:00Z') });
  assert.equal(await recordPreInquiryView('saaja', 'p1', { db: accepted, now }), true);
  assert.deepEqual(accepted.state.writes, [{ kind: 'PRE_INQUIRY', preInquiryId: 'p1', viewerUserId: 'saaja', day: '2026-10-09' }]);
  /* Päring küsib ainult rida, mis on saajale nähtav: tema oma, saadetud ja tagasi võtmata. */
  assert.deepEqual(accepted.state.queries[0].where, { id: 'p1', recipientOwnerId: 'saaja', recalledAt: null, OR: [{ sentAt: { not: null } }, { status: 'SENT' }] });
  assert.deepEqual(accepted.state.queries[0].select, { id: true, authorId: true, openedAt: true });

  /* Vastu võtmata pöördumine: pöörduja lehel ei tohi „vaadatud" olla varasem kui „avatud". */
  const unopened = makeDb({ id: 'p1', authorId: 'autor', openedAt: null });
  assert.equal(await recordPreInquiryView('saaja', 'p1', { db: unopened, now }), false);
  assert.deepEqual(unopened.state.writes, []);

  /* Võõras, tagasi võetud või olematu rida: 404 ja jälge ei teki. */
  const hidden = makeDb(null);
  await assert.rejects(recordPreInquiryView('vooras', 'p1', { db: hidden, now }), notFound);
  assert.deepEqual(hidden.state.writes, []);

  /* Tühi kasutaja või tühi pöördumise ID ei jõua päringusse (Prisma jätaks tingimuse vahele). */
  const empty = makeDb({ id: 'p1', authorId: 'autor', openedAt: now });
  await assert.rejects(recordPreInquiryView('', 'p1', { db: empty, now }), notFound);
  await assert.rejects(recordPreInquiryView('saaja', undefined, { db: empty, now }), notFound);
  assert.deepEqual([empty.state.queries.length, empty.state.writes.length], [0, 0]);

  /* Iseendale saadetud pöördumine ja autorita rida: kirjutust ei tehta. */
  const own = makeDb({ id: 'p1', authorId: 'saaja', openedAt: now });
  assert.equal(await recordPreInquiryView('saaja', 'p1', { db: own, now }), false);
  const orphan = makeDb({ id: 'p1', authorId: null, openedAt: now });
  assert.equal(await recordPreInquiryView('saaja', 'p1', { db: orphan, now }), false);
  assert.deepEqual([own.state.writes.length, orphan.state.writes.length], [0, 0]);
});

test('isikule saadetud eelpöördumine: jälg kirjutatakse pärast lukku, teatel on oma piirang ja leht teatab ainult vastuvõetud pöördumisest', () => {
  const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const lib = source('../lib/preInquiries.js');

  /* Vastuvõtmine: kirjutus on pärast luku (tehingu) lõppu ja tavalise ühendusega. */
  const acceptStart = lib.indexOf('export async function acceptPreInquiry(');
  const accept = lib.slice(acceptStart, lib.indexOf('\nexport async function ', acceptStart + 10));
  assert.match(accept, /const accepted = await withPreInquiryRoomLock\([\s\S]+\n  \}, \{ db \}\);\n  await recordRecipientView\(db, accepted, userId, now\);\n  return accepted;\n\}/);
  assert.equal([...accept.matchAll(/recordRecipientView\(/g)].length, 1);

  /* Töömärkmed: välitöö üleandmine (lukk juba käes, võõras tehing) jälge ei kirjuta. */
  const workflowStart = lib.indexOf('export async function updatePreInquiryReceiverWorkflow(');
  const workflow = lib.slice(workflowStart, lib.indexOf('\nexport async function ', workflowStart + 10));
  const held = workflow.indexOf('if (roomLockAlreadyHeld) return mutate(db);');
  const locked = workflow.indexOf('const updated = await withPreInquiryRoomLock(existing.id, mutate, { db });');
  const record = workflow.indexOf('await recordRecipientView(db, updated, userId);');
  assert.ok(held > 0 && locked > held && record > locked, 'jälg on pärast lukku ja pärast üleandmise varajast väljumist');
  assert.equal([...workflow.matchAll(/recordRecipientView\(/g)].length, 1);

  /* Marsruut: oma piirang, vastus ei ütle, kas rida tekkis. */
  const route = source('../app/api/pre-inquiries/[id]/viewed/route.js');
  assert.match(route, /enforcePreInquiryRateLimit\(request, \{ action: "view", userId: auth\.userId \}\)/);
  assert.match(route, /await recordPreInquiryView\(auth\.userId, await readId\(context\)\);\n    return json\(\{ ok: true \}\);/);
  assert.equal(/export async function (GET|PATCH|PUT|DELETE)/.test(route), false);
  const boundary = source('../lib/preInquiryApiBoundary.js');
  assert.match(boundary, /mutate: Object\.freeze\(\{ limit: 60, windowMs: 10 \* 60_000 \}\),[\s\S]+?\n  view: Object\.freeze\(\{ limit: 120, windowMs: 10 \* 60_000 \}\)\n\}\);/);

  /* Leht: teade läheb ainult saaja enda vastuvõetud pöördumise kohta, kui see on avatud vaates. */
  const page = source('../components/workspace/WorkspaceFeaturePage.jsx');
  const signalStart = page.indexOf('const viewSignalsRef = useRef(new Set());');
  const signal = page.slice(signalStart, page.indexOf('const activeReceivedJourneySharedInfo = useMemo('));
  assert.ok(signalStart > 0 && signal.length > 0);
  assert.match(signal, /isRecipientRole &&\n\s+receiverStep !== "queue" &&\n\s+activeReceivedInquiry\?\.openedAt &&\n\s+activeReceivedInquiry\.recipientOwnerId === currentUserId/);
  assert.match(signal, /fetch\(`\/api\/pre-inquiries\/\$\{encodeURIComponent\(viewedInquiryId\)\}\/viewed`, \{ method: "POST" \}\)\.catch\(\(\) => \{\}\);/);
  assert.equal([...page.matchAll(/\/viewed`/g)].length, 1);
});

test('teenusaruande jagamine: jälg kirjutatakse pärast kinnituse tehingut ja jagaja rida näitab kokkuvõtet', async () => {
  /* Liik viitab oma veeruga. */
  const writes = [];
  const db = { sharingView: { createMany: async ({ data }) => (writes.push({ ...data[0] }), { count: 1 }) } };
  const now = new Date('2026-10-09T08:00:00Z');
  assert.equal(await recordSharingView({ db, kind: SharingViewKind.SERVICE_REPORT_SHARE, itemId: 'r1', viewerUserId: 'juht', sharerUserIds: ['tootaja'], now }), true);
  assert.equal(await recordSharingView({ db, kind: SharingViewKind.SERVICE_REPORT_SHARE, itemId: 'r1', viewerUserId: 'tootaja', sharerUserIds: ['tootaja'], now }), false);
  assert.equal(await recordSharingView({ db, kind: SharingViewKind.SERVICE_REPORT_SHARE, itemId: 'r1', viewerUserId: 'juht', sharerUserIds: [null], now }), false);
  assert.deepEqual(writes, [{ kind: 'SERVICE_REPORT_SHARE', serviceReportShareId: 'r1', viewerUserId: 'juht', day: '2026-10-09' }]);

  /* Kinnitus: jagaja ID jääb funktsiooni sisse, kirjutus on pärast tehingut ja katab ka korduva lugemise. */
  const source = readFileSync(new URL('../lib/serviceLog/reportShare.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const start = source.indexOf('export async function confirmShareDelivery(');
  const confirm = source.slice(start, source.indexOf('\nexport ', start + 10));
  const transaction = confirm.indexOf('const result = await db.$transaction(async (tx) => {');
  const sharer = confirm.indexOf('sharerUserId = share.ownerUserId;');
  const repeat = confirm.indexOf('if (share.status === ShareStatus.OPENED) return { id: share.id, alreadyOpened: true };');
  const first = confirm.indexOf('return { id: share.id, alreadyOpened: false };\n  });');
  const record = confirm.indexOf('await recordSharingView({');
  assert.ok(transaction > 0 && sharer > transaction && repeat > sharer && first > repeat && record > first, 'jagaja loetakse enne korduva lugemise väljumist ja jälg kirjutatakse pärast tehingut');
  assert.equal([...confirm.matchAll(/recordSharingView\(/g)].length, 1);
  assert.match(confirm.slice(record), /db,\n    kind: SharingViewKind\.SERVICE_REPORT_SHARE,\n    itemId: result\.id,\n    viewerUserId: actorUserId,\n    sharerUserIds: \[sharerUserId\],\n    now\n  \}\);\n  return result;\n\}/);
  /* Vastus läheb saaja brauserisse: jagaja ID seal ei ole. */
  assert.equal(/return \{[^}]*owner/i.test(confirm), false);

  /* Jagaja rida ei avane: kokkuvõte on rea faktis; ilma vaatamisteta jääb rida endiseks. */
  const share = { id: 's1', status: 'OPENED', month: '2026-09', recipientLabel: 'Osakonna juht' };
  assert.equal(sharingRow('serviceReportShares', share, context).facts.visibility, 'Jagatud: Osakonna juht');
  assert.equal(
    sharingRow('serviceReportShares', { ...share, views: { days: 2, lastDay: '2026-10-09' } }, context).facts.visibility,
    'Jagatud: Osakonna juht. Adressaat on seda vaadanud 2 päeval, viimati kp:2026-10-09'
  );
  assert.equal(
    sharingRow('serviceReportShares', { ...share, views: { days: 1, lastDay: '2026-10-09' } }, context).facts.visibility,
    'Jagatud: Osakonna juht. Adressaat on seda vaadanud ühel päeval: kp:2026-10-09'
  );

  /* Migratsioon: iga liik nõuab oma veergu ja keelab teised; jälg kustub koos jagamisega. */
  const migration = readFileSync(new URL('../prisma/migrations/20261013170000_sharing_view_service_report/migration.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.match(migration, /^SET lock_timeout = '5s';\nSET statement_timeout = '30s';/m);
  assert.match(migration, /REFERENCES "ServiceReportShare"\("id"\) ON DELETE CASCADE ON UPDATE CASCADE;/);
  assert.match(migration, /\("kind" = 'SERVICE_REPORT_SHARE' AND "serviceReportShareId" IS NOT NULL AND "preInquiryId" IS NULL AND "networkShareId" IS NULL\)/);
  assert.match(migration, /\("kind" = 'PRE_INQUIRY' AND "preInquiryId" IS NOT NULL AND "networkShareId" IS NULL AND "serviceReportShareId" IS NULL\)/);
  assert.match(migration, /\("kind" = 'NETWORK_SHARE' AND "networkShareId" IS NOT NULL AND "preInquiryId" IS NULL AND "serviceReportShareId" IS NULL\)/);
});
