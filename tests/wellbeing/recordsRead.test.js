import assert from "node:assert/strict";
import test from "node:test";

import {
  deleteWellbeingRecordForUser,
  getWellbeingRecordForUser
} from "../../lib/wellbeing/records.js";
import { listWellbeingOutputDraftsForRecord } from "../../lib/wellbeing/supportDrafts.js";
import {
  WELLBEING_MINIMUM_GROUP_SIZE_FLOOR,
  buildWellbeingAggregateDataset
} from "../../lib/wellbeing/aggregate.js";

/* Elus jagatud pood: sama massiiv teenindab loendit, agregaati ja kustutust,
   nii et kustutuse koondimõju on tõestatav ilma materialiseeritud kihita. */
function createLiveStore(seed = []) {
  const rows = seed.map((row) => ({ ...row }));
  const wellbeingRecord = {
    findFirst: async ({ where }) => {
      return rows.find((row) =>
        (where.id === undefined || row.id === where.id)
        && (where.ownerUserId === undefined || row.ownerUserId === where.ownerUserId)) || null;
    },
    findMany: async ({ where = {} }) => {
      return rows.filter((row) => {
        if (where.ownerUserId && row.ownerUserId !== where.ownerUserId) return false;
        if (where.visibility && row.visibility !== where.visibility) return false;
        if (where.aggregationEligible !== undefined && row.aggregationEligible !== where.aggregationEligible) return false;
        if (where.workflowType && row.workflowType !== where.workflowType) return false;
        return true;
      });
    },
    deleteMany: async ({ where }) => {
      let count = 0;
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        const row = rows[index];
        if ((where.id === undefined || row.id === where.id)
          && (where.ownerUserId === undefined || row.ownerUserId === where.ownerUserId)) {
          rows.splice(index, 1);
          count += 1;
        }
      }
      return { count };
    }
  };
  return { rows, prisma: { wellbeingRecord } };
}

function aggregatableRecord(id, ownerUserId, overrides = {}) {
  return {
    id,
    ownerUserId,
    workflowType: "quick-check",
    visibility: "private",
    aggregationEligible: true,
    computedSignal: { signalLevel: "yellow" },
    loadFactors: ["documentation"],
    resourceFactors: [],
    riskMarkers: [],
    createdAt: new Date("2026-07-10T09:00:00.000Z"),
    ...overrides
  };
}

test("getWellbeingRecordForUser is owner-scoped and never leaks a foreign record", async () => {
  const { prisma } = createLiveStore([
    aggregatableRecord("rec_mine", "user_1"),
    aggregatableRecord("rec_theirs", "user_2")
  ]);

  const mine = await getWellbeingRecordForUser("user_1", "rec_mine", { prisma });
  assert.equal(mine?.id, "rec_mine");

  const foreign = await getWellbeingRecordForUser("user_1", "rec_theirs", { prisma });
  assert.equal(foreign, null);

  const missing = await getWellbeingRecordForUser("user_1", "rec_absent", { prisma });
  assert.equal(missing, null);
});

test("getWellbeingRecordForUser rejects a missing user or empty id", async () => {
  const { prisma } = createLiveStore([aggregatableRecord("rec_1", "user_1")]);
  await assert.rejects(
    () => getWellbeingRecordForUser("", "rec_1", { prisma }),
    /wellbeing.errors.unauthorized/
  );
  await assert.rejects(
    () => getWellbeingRecordForUser("user_1", "", { prisma }),
    /wellbeing.errors.record_missing/
  );
});

test("deleteWellbeingRecordForUser deletes only the owner's record and reports 404 otherwise", async () => {
  const { rows, prisma } = createLiveStore([
    aggregatableRecord("rec_mine", "user_1"),
    aggregatableRecord("rec_theirs", "user_2")
  ]);

  const foreign = await deleteWellbeingRecordForUser("user_1", "rec_theirs", { prisma });
  assert.deepEqual(foreign, { deleted: false, count: 0, draftsDeleted: 0 });
  assert.equal(rows.length, 2, "a foreign delete must not remove anything");

  const own = await deleteWellbeingRecordForUser("user_1", "rec_mine", { prisma });
  assert.deepEqual(own, { deleted: true, count: 1, draftsDeleted: 0 });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "rec_theirs");

  const repeat = await deleteWellbeingRecordForUser("user_1", "rec_mine", { prisma });
  assert.deepEqual(repeat, { deleted: false, count: 0, draftsDeleted: 0 });
});

test("deleting a record changes the live aggregate without a materialized layer", async () => {
  /* Valim on TÄPSELT lävendi jagu, sest testi mõte on see, et üks kustutus viib
     ta alla piiri. Suurus tuleb konstandist, mitte kirjutatud numbrist: lävend
     on tootevalik ja ta on juba korra muutunud (3 → 5, SOL-WB-06). */
  const size = WELLBEING_MINIMUM_GROUP_SIZE_FLOOR;
  const owners = Array.from({ length: size }, (_, index) => `user_${index + 1}`);
  const { prisma } = createLiveStore(
    owners.map((owner, index) => aggregatableRecord(`rec_${index + 1}`, owner))
  );

  const before = await buildWellbeingAggregateDataset({}, { prisma });
  assert.equal(before.suppressed, false);
  assert.equal(before.recordCount, size);
  assert.equal(before.sampleSize, size);

  await deleteWellbeingRecordForUser(owners[size - 1], `rec_${size}`, { prisma });

  const after = await buildWellbeingAggregateDataset({}, { prisma });
  assert.equal(after.recordCount, size - 1);
  assert.equal(after.sampleSize, size - 1);
  assert.equal(after.suppressed, true, "dropping below the min group size suppresses the aggregate live");
});

test("listWellbeingOutputDraftsForRecord is owner-scoped and filters by source record", async () => {
  const calls = [];
  const prisma = {
    wellbeingOutputDraft: {
      findMany: async (args) => {
        calls.push(args);
        return [{ id: "draft_1", sourceRecordId: "rec_1", covisionCaseId: "cov_1", handedOffAt: new Date() }];
      }
    }
  };

  const drafts = await listWellbeingOutputDraftsForRecord("user_1", "rec_1", { prisma });
  assert.equal(drafts.length, 1);
  assert.deepEqual(calls[0].where, { userId: "user_1", sourceRecordId: "rec_1" });

  const empty = await listWellbeingOutputDraftsForRecord("user_1", "", { prisma });
  assert.deepEqual(empty, []);
  assert.equal(calls.length, 1, "an empty record id must not hit the database");
});
