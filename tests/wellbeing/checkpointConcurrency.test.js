import assert from "node:assert/strict";
import test from "node:test";

import {
  listDueWellbeingCheckpoints,
  markWellbeingRecommendationForUser,
  recordWellbeingCheckpointFollowUpForUser,
  setWellbeingCheckpointForUser
} from "../../lib/wellbeing/checkpoint.js";

const NOW = new Date("2026-05-26T12:00:00.000Z");

/**
 * Rea-täpne fake, mis austab `where`-i ja serialiseerib `$transaction`-i —
 * täpselt need kaks asja, mida leiud puudutavad. Ilma `$transaction`-ita
 * langeks advisory-lock ümbris tagavarateele ja test ei tõendaks midagi.
 */
function recordStore(rows) {
  const table = new Map(rows.map((row) => [row.id, { ...row }]));
  let chain = Promise.resolve();

  const client = {
    $transaction: (callback) => {
      const run = chain.then(() => callback(client));
      /* Ahel ei tohi katkeda vea peale — muidu lukustuks fake ennast. */
      chain = run.then(() => {}, () => {});
      return run;
    },
    $executeRaw: async () => 1,
    wellbeingRecord: {
      findFirst: async ({ where, select }) => {
        const row = table.get(where.id);
        if (!row || (where.ownerUserId && row.ownerUserId !== where.ownerUserId)) return null;
        if (!select) return { ...row };
        return Object.fromEntries(Object.keys(select).map((key) => [key, row[key]]));
      },
      findMany: async ({ where, take }) => {
        const due = [...table.values()]
          .filter((row) => row.checkpointDueOn && row.checkpointDueOn <= where.checkpointDueOn.lte)
          .filter((row) => (where.checkpointAnsweredAt === null ? row.checkpointAnsweredAt == null : true))
          .sort((a, b) => a.checkpointDueOn - b.checkpointDueOn);
        return due.slice(0, take).map((row) => ({ ...row }));
      },
      updateMany: async ({ where, data }) => {
        const row = table.get(where.id);
        if (!row || (where.ownerUserId && row.ownerUserId !== where.ownerUserId)) return { count: 0 };
        table.set(where.id, { ...row, ...data });
        return { count: 1 };
      }
    }
  };

  return { client, get: (id) => table.get(id) };
}

function record(index, overrides = {}) {
  return {
    id: `rec_${String(index).padStart(4, "0")}`,
    ownerUserId: "user_1",
    checkpointDueOn: null,
    checkpointAnsweredAt: null,
    checkpoint: null,
    recommendedActions: [],
    ...overrides
  };
}

/* SOL-WB-07 kriteerium: „Test peab paigutama batch'i jagu vastatud vanu ridu
   ühe vastamata uue ette ja tõendama uue teavituse." */
test("answered old checkpoints can no longer starve a newer due one out of the batch", async () => {
  const answeredOld = Array.from({ length: 200 }, (_, index) => record(index, {
    checkpointDueOn: new Date(NOW.getTime() - (1000 - index) * 60_000),
    checkpointAnsweredAt: new Date(NOW.getTime() - 500 * 60_000),
    checkpoint: { id: `cp_${index}`, nextStep: "vana", followUp: { state: "kept", notedAt: "2026-05-20" } }
  }));
  const freshOne = record(9999, {
    checkpointDueOn: new Date(NOW.getTime() - 60_000),
    checkpoint: { id: "cp_fresh", nextStep: "uus", followUp: null }
  });
  const store = recordStore([...answeredOld, freshOne]);

  const due = await listDueWellbeingCheckpoints({ prisma: store.client, now: NOW, take: 200 });

  assert.equal(due.length, 1);
  assert.equal(due[0].id, freshOne.id);

  /* Negatiivkontroll: vana reegel (ilma skalaarita WHERE-is) täidab batch'i
     vastatud ridadega ja uus jääb päringust välja. */
  const legacy = await store.client.wellbeingRecord.findMany({
    where: { checkpointDueOn: { lte: NOW, not: null } },
    take: 200
  });
  assert.equal(legacy.length, 200);
  assert.equal(legacy.some((row) => row.id === freshOne.id), false);
});

/* SOL-WB-09: SET ↔ FOLLOW_UP. Vastus käib kokkuleppe, mitte kirje kohta. */
test("a follow-up for a replaced agreement is refused with 409, not written onto the new plan", async () => {
  const store = recordStore([record(1)]);
  await setWellbeingCheckpointForUser("user_1", "rec_0001", {
    nextStep: "esimene plaan",
    dueOn: "2026-06-01"
  }, { prisma: store.client, now: new Date("2026-05-26T10:00:00.000Z") });

  const firstId = store.get("rec_0001").checkpoint.id;

  await setWellbeingCheckpointForUser("user_1", "rec_0001", {
    nextStep: "teine plaan",
    dueOn: "2026-06-08"
  }, { prisma: store.client, now: new Date("2026-05-26T11:00:00.000Z") });

  await assert.rejects(
    () => recordWellbeingCheckpointFollowUpForUser("user_1", "rec_0001", {
      state: "kept",
      expectedCheckpointId: firstId
    }, { prisma: store.client, now: NOW }),
    (error) => {
      assert.equal(error.message, "wellbeing.errors.checkpoint_conflict");
      assert.equal(error.status, 409);
      return true;
    }
  );

  assert.equal(store.get("rec_0001").checkpoint.followUp, null);
  assert.equal(store.get("rec_0001").checkpointAnsweredAt, null);

  /* Sama vastus KÄESOLEVA kokkuleppe id-ga läheb läbi ja täidab skalaari. */
  await recordWellbeingCheckpointFollowUpForUser("user_1", "rec_0001", {
    state: "kept",
    expectedCheckpointId: store.get("rec_0001").checkpoint.id
  }, { prisma: store.client, now: NOW });

  assert.equal(store.get("rec_0001").checkpoint.followUp.state, "kept");
  assert.deepEqual(store.get("rec_0001").checkpointAnsweredAt, NOW);
});

/* SOL-WB-09: kaks ERI soovitust korraga — vana rada jättis alles ainult ühe. */
test("two recommendations marked at the same time both survive", async () => {
  const store = recordStore([record(2, {
    recommendedActions: [{ workflowType: "recovery" }, { workflowType: "covision" }]
  })]);

  await Promise.all([
    markWellbeingRecommendationForUser("user_1", "rec_0002", { workflowType: "recovery" }, { prisma: store.client, now: NOW }),
    markWellbeingRecommendationForUser("user_1", "rec_0002", { workflowType: "covision" }, { prisma: store.client, now: NOW })
  ]);

  const actions = store.get("rec_0002").recommendedActions;
  assert.equal(actions.filter((action) => action.doneAt).length, 2);
});

/* Negatiivkontroll paralleelsusele: ilma serialiseerimiseta (mõlemad loevad
   sama lähteseisu ja kirjutavad oma versiooni) jääb alles ainult üks märge —
   see on täpselt see käitumine, mida parandus välistab. */
test("the same two marks without serialisation would lose one", async () => {
  const row = { recommendedActions: [{ workflowType: "recovery" }, { workflowType: "covision" }] };
  const snapshot = row.recommendedActions;

  const writeA = snapshot.map((action) => (action.workflowType === "recovery" ? { ...action, doneAt: "A" } : action));
  const writeB = snapshot.map((action) => (action.workflowType === "covision" ? { ...action, doneAt: "B" } : action));
  row.recommendedActions = writeA;
  row.recommendedActions = writeB;

  assert.equal(row.recommendedActions.filter((action) => action.doneAt).length, 1);
});
