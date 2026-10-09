// Tööheaolu loendite lehekülje suurus.
//
// Marsruudid annavad teenusele `searchParams.get("take")`, mis parameetri
// puudumisel on `null`. `Number(null)` on 0 ja suurus kärbiti üheks: „Minu
// kirjed" tõi korraga ühe kirje ja ühe pooleli mustandi, ülejäänud olid nupu
// „Laadi veel" taga.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePageSize } from '../lib/org/pagination.js';
import { listWellbeingRecordsForUser } from '../lib/wellbeing/records.js';
import { listWellbeingOutputDraftsForUser } from '../lib/wellbeing/supportDrafts.js';

function stub(model) {
  const calls = [];
  return { calls, prisma: { [model]: { findMany: async (args) => { calls.push(args); return []; } } } };
}

test('kirjete loend: puuduv, tühi ja vigane suurus annavad vaikimisi lehekülje, mitte ühe rea', async () => {
  for (const take of [null, undefined, '', '  ', 'abc']) {
    const { calls, prisma } = stub('wellbeingRecord');
    await listWellbeingRecordsForUser('user-1', { take }, { prisma });
    assert.equal(calls[0].take, 51, `take=${JSON.stringify(take)}`);
  }
});

test('kirjete loend: antud suurus kehtib piirides 1 kuni 100', async () => {
  for (const [take, expected] of [['10', 11], [0, 2], ['500', 101], [25, 26]]) {
    const { calls, prisma } = stub('wellbeingRecord');
    await listWellbeingRecordsForUser('user-1', { take }, { prisma });
    assert.equal(calls[0].take, expected, `take=${JSON.stringify(take)}`);
  }
});

test('mustandite loend: puuduv suurus annab vaikimisi lehekülje', async () => {
  for (const take of [null, undefined, '']) {
    const { calls, prisma } = stub('wellbeingOutputDraft');
    await listWellbeingOutputDraftsForUser('user-1', { take }, { prisma });
    assert.equal(calls[0].take, 21, `take=${JSON.stringify(take)}`);
  }
});

test('marsruudid annavad puuduva parameetri edasi nullina (seepärast peab teenus seda taluma)', async () => {
  const fs = await import('node:fs');
  for (const route of ['../app/api/wellbeing/records/route.js', '../app/api/wellbeing/output-drafts/route.js']) {
    const source = fs.readFileSync(new URL(route, import.meta.url), 'utf8');
    assert.ok(source.includes('searchParams.get("take")'), route);
  }
});

test('organisatsiooni loendid: puuduv suurus annab vaikimisi lehekülje, mitte ühe rea', () => {
  /* Sama viga teises kohas: organisatsiooni vastuvõtulaud, kutsed, sponsorlus,
     aruanded ja tugi annavad marsruudist `searchParams.get("take")` otse edasi. */
  for (const take of [null, undefined, '', ' ']) assert.equal(normalizePageSize(take, 100, 200), 100, `take=${JSON.stringify(take)}`);
  assert.equal(normalizePageSize('abc', 100, 200), 100);
  assert.equal(normalizePageSize('25', 100, 200), 25);
  assert.equal(normalizePageSize(0, 100, 200), 1);
  assert.equal(normalizePageSize('999', 100, 200), 200);
});
