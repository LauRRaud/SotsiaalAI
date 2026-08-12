import assert from "node:assert/strict";
import test from "node:test";

import { listWellbeingRecordsForUser } from "../../lib/wellbeing/records.js";
import {
  deleteWellbeingOutputDraftForUser,
  getWellbeingOutputDraftForUser,
  listWellbeingOutputDraftsForUser
} from "../../lib/wellbeing/supportDrafts.js";

/**
 * Kursorit AUSTAV fake: ilma selleta „läbiks" iga lehekülgitus, sest massiiv
 * tagastatakse iga kord otsast peale. Just see tegi vaikse 100/50 piiri
 * nähtamatuks ka testides.
 */
function pagedTable(rows, key = "wellbeingRecord") {
  const sorted = [...rows].sort((a, b) => {
    const byTime = b.createdAt - a.createdAt;
    return byTime !== 0 ? byTime : b.id.localeCompare(a.id);
  });
  const table = new Map(sorted.map((row) => [row.id, { ...row }]));

  const model = {
    findMany: async ({ take, cursor, skip }) => {
      const live = [...table.values()].sort((a, b) => {
        const byTime = b.createdAt - a.createdAt;
        return byTime !== 0 ? byTime : b.id.localeCompare(a.id);
      });
      let start = 0;
      if (cursor?.id) {
        const index = live.findIndex((row) => row.id === cursor.id);
        assert.notEqual(index, -1, "kursor peab osutama olemasolevale reale");
        start = index + (Number(skip) || 0);
      }
      return live.slice(start, start + take);
    },
    findFirst: async ({ where }) => {
      const row = table.get(where.id);
      if (!row || (where.userId && row.userId !== where.userId)) return null;
      return { ...row };
    },
    deleteMany: async ({ where }) => {
      const row = table.get(where.id);
      if (!row || (where.userId && row.userId !== where.userId)) return { count: 0 };
      table.delete(where.id);
      return { count: 1 };
    }
  };

  return { prisma: { [key]: model }, table };
}

function record(index) {
  return {
    id: `rec_${String(index).padStart(4, "0")}`,
    ownerUserId: "user_1",
    workflowType: "quick-check",
    createdAt: new Date(Date.UTC(2026, 0, 1) + index * 60_000)
  };
}

function draft(index, overrides = {}) {
  return {
    id: `draft_${String(index).padStart(4, "0")}`,
    userId: "user_1",
    outputType: "manager_memo",
    recipientType: "manager",
    generatedText: "genereeritud",
    editedText: null,
    covisionCaseId: null,
    handedOffAt: null,
    createdAt: new Date(Date.UTC(2026, 0, 1) + index * 60_000),
    ...overrides
  };
}

/* SOL-WB-15 kriteerium: „Negatiivtest peab looma üle 100 kirje ja üle 50
   mustandi, läbima kõik lehed täpselt ühe korra ning kontrollima
   lisamist/kustutamist lehtede vahel." */
test("every one of 137 records is read exactly once across pages", async () => {
  const { prisma } = pagedTable(Array.from({ length: 137 }, (_, index) => record(index)));

  const seen = [];
  let cursor = null;
  let pages = 0;
  for (;;) {
    const page = await listWellbeingRecordsForUser("user_1", { take: 50, cursor }, { prisma });
    pages += 1;
    seen.push(...page.records.map((row) => row.id));
    if (!page.hasMore) break;
    cursor = page.nextCursor;
    assert.ok(cursor, "hasMore ilma kursorita oleks ummik");
    assert.ok(pages < 10, "lehekülgitus ei tohi lõputult korduda");
  }

  assert.equal(seen.length, 137);
  assert.equal(new Set(seen).size, 137, "ükski rida ei tohi korduda");
  assert.equal(pages, 3);
});

test("a row deleted between pages does not shift the ones behind it", async () => {
  const { prisma, table } = pagedTable(Array.from({ length: 60 }, (_, index) => record(index)));

  const first = await listWellbeingRecordsForUser("user_1", { take: 20 }, { prisma });
  assert.equal(first.hasMore, true);

  /* Kustutame rea, mis on JUBA loetud. Offset-põhine lehekülgitus libistaks
     ülejäänud read ühe võrra ja üks rida jääks vahele; kursor ei libise. */
  table.delete(first.records[0].id);

  const second = await listWellbeingRecordsForUser("user_1", { take: 20, cursor: first.nextCursor }, { prisma });
  const overlap = second.records.filter((row) => first.records.some((seen) => seen.id === row.id));
  assert.deepEqual(overlap, [], "teine leht ei tohi korrata esimest");
  assert.equal(second.records.length, 20);
});

test("a row added between pages does not make a later page repeat an earlier one", async () => {
  const { prisma, table } = pagedTable(Array.from({ length: 40 }, (_, index) => record(index)));

  const first = await listWellbeingRecordsForUser("user_1", { take: 20 }, { prisma });
  /* Uus rida on KÕIGE värskem, seega ta kuuluks esimesele lehele. Kursor
     tähendab „edasi sellest reast", nii et ta ei tõuka teist lehte tagasi. */
  const fresh = record(9999);
  table.set(fresh.id, fresh);

  const second = await listWellbeingRecordsForUser("user_1", { take: 20, cursor: first.nextCursor }, { prisma });
  assert.equal(second.records.some((row) => row.id === fresh.id), false);
  assert.equal(new Set([...first.records, ...second.records].map((row) => row.id)).size, 40);
});

test("every one of 63 drafts is read exactly once across pages", async () => {
  const { prisma } = pagedTable(
    Array.from({ length: 63 }, (_, index) => draft(index)),
    "wellbeingOutputDraft"
  );

  const seen = [];
  let cursor = null;
  for (;;) {
    const page = await listWellbeingOutputDraftsForUser("user_1", { take: 25, cursor }, { prisma });
    seen.push(...page.drafts.map((row) => row.id));
    if (!page.hasMore) break;
    cursor = page.nextCursor;
  }

  assert.equal(seen.length, 63);
  assert.equal(new Set(seen).size, 63);
});

/* SOL-WB-16: avamine ja kustutamine, omanikupiiriga. */
test("a draft can be opened and deleted by its owner and by nobody else", async () => {
  const { prisma, table } = pagedTable([draft(1)], "wellbeingOutputDraft");

  const mine = await getWellbeingOutputDraftForUser("user_1", "draft_0001", { prisma });
  assert.equal(mine?.id, "draft_0001");

  const foreign = await getWellbeingOutputDraftForUser("user_2", "draft_0001", { prisma });
  assert.equal(foreign, null, "võõra mustandi olemasolu ei tohi lekkida");

  const removed = await deleteWellbeingOutputDraftForUser("user_1", "draft_0001", { prisma });
  assert.deepEqual(removed, { deleted: true, handedOff: false });
  assert.equal(table.size, 0);

  /* Idempotentsus: teine kustutus ei viska, ta lihtsalt ei kustuta midagi. */
  const repeat = await deleteWellbeingOutputDraftForUser("user_1", "draft_0001", { prisma });
  assert.deepEqual(repeat, { deleted: false, handedOff: false });
});

/* Üleantud mustandi poliitika, kirja pandult: kustutada TOHIB, aga vastus ütleb
   välja, et jagatud koopia ei kao — seda ei varjata kasutaja eest. */
test("deleting a handed-off draft says out loud that the shared copy stays", async () => {
  const { prisma } = pagedTable(
    [draft(2, { covisionCaseId: "case_1", handedOffAt: new Date("2026-05-26T10:00:00.000Z") })],
    "wellbeingOutputDraft"
  );

  const removed = await deleteWellbeingOutputDraftForUser("user_1", "draft_0002", { prisma });
  assert.deepEqual(removed, { deleted: true, handedOff: true });
});
