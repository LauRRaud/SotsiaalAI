import assert from "node:assert/strict";
import test from "node:test";

import { emitDueWellbeingCheckpointNotifications } from "../../lib/wellbeing/checkpoint.js";

function createStore(records = []) {
  const rows = records.map((row) => ({ ...row }));
  const events = [];

  const db = {
    wellbeingRecord: {
      findMany: async ({ where = {} } = {}) => rows.filter((row) => {
        if (!row.checkpointDueOn) return false;
        if (where.checkpointDueOn?.lte && new Date(row.checkpointDueOn) > where.checkpointDueOn.lte) return false;
        return true;
      }).map((row) => ({ ...row })),
      findFirst: async ({ where = {} } = {}) => rows.find((row) => {
        if (where.id !== undefined && row.id !== where.id) return false;
        if (where.ownerUserId !== undefined && row.ownerUserId !== where.ownerUserId) return false;
        if (where.checkpointDueOn?.not === null && !row.checkpointDueOn) return false;
        return true;
      }) || null
    },
    notificationEvent: {
      create: async ({ data }) => {
        if (events.some((event) => event.dedupeKey === data.dedupeKey)) {
          const error = new Error("Unique constraint failed");
          error.code = "P2002";
          throw error;
        }
        const event = { id: `evt_${events.length + 1}`, ...data };
        events.push(event);
        return event;
      },
      findUnique: async ({ where }) => events.find((event) => event.dedupeKey === where.dedupeKey) || null
    },
    user: {
      findUnique: async () => ({ notificationEmailEnabled: true })
    }
  };

  return { rows, events, db };
}

function dueRecord(id, ownerUserId, overrides = {}) {
  return {
    id,
    ownerUserId,
    checkpointDueOn: new Date("2026-07-20T09:00:00.000Z"),
    checkpoint: { nextStep: "Räägin juhiga", followUp: null },
    ...overrides
  };
}

const NOW = new Date("2026-07-25T09:00:00.000Z");

/* TO-2 KÕVA PIIR. See ei ole „e-kirja ei saadeta praegu", vaid „e-kirja rada on
   suletud". Kasutaja on `notificationEmailEnabled: true` — kui poliitika oleks
   OPTIONAL, läheks kiri välja. Test tõendab, et ei lähe. */
test("a due checkpoint never requests an email, even for a user who opted into notification email", async () => {
  const { events, db } = createStore([dueRecord("rec_a", "user_1")]);

  const result = await emitDueWellbeingCheckpointNotifications({ prisma: db, now: NOW });

  assert.equal(result.created, 1);
  assert.equal(events.length, 1);
  const [event] = events;
  assert.equal(event.emailPolicy, "NONE", "TO-2: e-kiri on väljas, ka mitte opt-in'i taga");
  assert.equal(event.emailStatus, "NOT_REQUESTED");
  assert.equal(event.emailNextAttemptAt, null);
  assert.equal(event.emailMessageId, null, "e-kirja sõnumi-ID-d ei koostata üldse");
});

test("the checkpoint notification goes to the owner and carries a reference, not content", async () => {
  const { events, db } = createStore([dueRecord("rec_a", "user_1")]);

  await emitDueWellbeingCheckpointNotifications({ prisma: db, now: NOW });

  const [event] = events;
  assert.equal(event.userId, "user_1");
  assert.equal(event.type, "WELLBEING_CHECKPOINT_DUE");
  assert.equal(event.sourceId, "rec_a");
  assert.equal(event.targetId, "rec_a");

  const serialized = JSON.stringify(event);
  assert.equal(serialized.includes("Räägin juhiga"), false,
    "teavitus ei tohi kanda kokkuleppe teksti — fakt ja viide, mitte sisu");
});

test("re-running the timer does not create a second notification for the same checkpoint", async () => {
  const { events, db } = createStore([dueRecord("rec_a", "user_1")]);

  const first = await emitDueWellbeingCheckpointNotifications({ prisma: db, now: NOW });
  const second = await emitDueWellbeingCheckpointNotifications({ prisma: db, now: NOW });

  assert.equal(first.created, 1);
  assert.equal(second.created, 0, "taimeri kordusjooks ei spammi");
  assert.equal(second.skipped, 1);
  assert.equal(events.length, 1);
});

test("answered and future checkpoints produce no notification at all", async () => {
  const { events, db } = createStore([
    dueRecord("rec_answered", "user_1", {
      checkpoint: { nextStep: "Plaan", followUp: { state: "not_kept" } }
    }),
    dueRecord("rec_future", "user_2", {
      checkpointDueOn: new Date("2026-08-20T09:00:00.000Z")
    })
  ]);

  const result = await emitDueWellbeingCheckpointNotifications({ prisma: db, now: NOW });

  assert.equal(result.scanned, 0);
  assert.equal(events.length, 0,
    "vastatud kokkulepe ja tulevane kokkulepe ei tekita kumbki märki");
});

/* Vahelejätmine on võrdväärne tulemus: „ei pidanud" sulgeb kontrollpunkti
   sama lõplikult kui „pidasin". Ei kordusteavitust, ei meeldetuletuse-ahelat. */
test("answering 'not kept' closes the checkpoint as fully as 'kept'", async () => {
  const { rows, events, db } = createStore([dueRecord("rec_a", "user_1")]);

  await emitDueWellbeingCheckpointNotifications({ prisma: db, now: NOW });
  assert.equal(events.length, 1);

  rows[0].checkpoint = { nextStep: "Räägin juhiga", followUp: { state: "not_kept" } };

  const later = await emitDueWellbeingCheckpointNotifications({
    prisma: db,
    now: new Date("2026-08-25T09:00:00.000Z")
  });
  assert.equal(later.scanned, 0);
  assert.equal(events.length, 1, "vastatud kontrollpunkt ei tule tagasi");
});
