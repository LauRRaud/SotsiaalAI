import assert from "node:assert/strict";
import test from "node:test";

import {
  copyRoomSummariesToParticipants,
  recordSharedRoomSummary
} from "../../lib/rooms/summaryHandover.js";

/* T12 E7 osa 1 — kokkuvõtte privaatkoopia igale osalejale (testileping 8). */

const ROOM_ID = "room1";
const SHARER = "specialist";
const SNAPSHOT = "Kokkuvõte: kokku lepiti järgmised sammud.";

function createDb({
  summaries = [],
  members = [],
  messages = [],
  copies = [],
  failSavedAnalysis = false
} = {}) {
  const analyses = [];
  const ledger = [...copies];
  let ledgerSeq = ledger.length;
  const sharedSummaries = [...summaries];

  return {
    analyses,
    ledger,
    sharedSummaries,
    roomSharedSummary: {
      async findMany({ where } = {}) {
        return sharedSummaries.filter(row => row.roomId === where.roomId);
      },
      async upsert({ where, create, update } = {}) {
        const key = where.roomId_artifactId;
        const found = sharedSummaries.find(row => row.roomId === key.roomId && row.artifactId === key.artifactId);
        if (found) {
          Object.assign(found, update);
          return found;
        }
        const row = { id: `s${sharedSummaries.length + 1}`, roomId: key.roomId, artifactId: key.artifactId, ...create };
        sharedSummaries.push(row);
        return row;
      }
    },
    roomMember: {
      async findMany({ where } = {}) {
        return members
          .filter(row => row.roomId === where.roomId && (where.leftAt !== null || row.leftAt == null))
          .map(row => ({ userId: row.userId }));
      }
    },
    roomMessage: {
      async findFirst({ where } = {}) {
        return messages.find(row => row.id === where.id) || null;
      }
    },
    roomSummaryCopy: {
      async findFirst({ where } = {}) {
        return ledger.find(row => row.roomSharedSummaryId === where.roomSharedSummaryId
          && row.userId === where.userId) || null;
      },
      async create({ data } = {}) {
        if (ledger.some(row => row.roomSharedSummaryId === data.roomSharedSummaryId && row.userId === data.userId)) {
          throw Object.assign(new Error("duplicate"), { code: "P2002" });
        }
        ledgerSeq += 1;
        const row = { id: `c${ledgerSeq}`, savedAnalysisId: null, ...data };
        ledger.push(row);
        return { id: row.id };
      },
      async update({ where, data } = {}) {
        const row = ledger.find(item => item.id === where.id);
        if (!row) throw new Error("ledger row missing");
        Object.assign(row, data);
        return row;
      }
    },
    savedAnalysis: {
      async create({ data } = {}) {
        if (failSavedAnalysis) throw new Error("storage down");
        const row = { id: `a${analyses.length + 1}`, ...data };
        analyses.push(row);
        return { id: row.id };
      }
    }
  };
}

function sharedSummaryRow(overrides = {}) {
  return {
    id: "s1",
    roomId: ROOM_ID,
    artifactId: "artifact1",
    messageId: "msg1",
    sharedByUserId: SHARER,
    title: "Kohtumine 12.07",
    content: SNAPSHOT,
    sharedAt: new Date("2026-07-19T10:00:00Z"),
    ...overrides
  };
}

function baseDb(overrides = {}) {
  return createDb({
    summaries: [sharedSummaryRow()],
    messages: [{ id: "msg1", deletedAt: null }],
    members: [
      { roomId: ROOM_ID, userId: SHARER, leftAt: null },
      { roomId: ROOM_ID, userId: "member-b", leftAt: null },
      { roomId: ROOM_ID, userId: "member-c", leftAt: null },
      { roomId: ROOM_ID, userId: "member-left", leftAt: new Date("2026-07-18") }
    ],
    ...overrides
  });
}

test("iga praegune osaleja saab privaatkoopia; jagaja ja lahkunu ei saa", async () => {
  const db = baseDb();
  const result = await copyRoomSummariesToParticipants({ db, roomId: ROOM_ID });

  assert.equal(result.created, 2);
  assert.deepEqual(db.analyses.map(row => row.ownerId).sort(), ["member-b", "member-c"]);
});

test("koopia kannab jagamise hetke snapshot'i, disclaimerit ja päritolu", async () => {
  const db = baseDb();
  await copyRoomSummariesToParticipants({ db, roomId: ROOM_ID });

  const copy = db.analyses[0];
  assert.equal(copy.content, SNAPSHOT);
  assert.equal(copy.title, "Kohtumine 12.07");
  assert.equal(copy.metadata.disclaimer, "ai_explanation_not_official_decision");
  assert.equal(copy.metadata.source, "room_meeting_summary");
  assert.equal(copy.metadata.roomId, ROOM_ID);
  // Koopia ei kanna ruumi võõrvõtit — seetõttu elab ta üle ruumi kustutuse.
  assert.equal(Object.hasOwn(copy, "roomId"), false);
});

test("üleandmine on idempotentne (arhiveeri → kustuta ei tekita teist koopiat)", async () => {
  const db = baseDb();
  await copyRoomSummariesToParticipants({ db, roomId: ROOM_ID });
  const second = await copyRoomSummariesToParticipants({ db, roomId: ROOM_ID });

  assert.equal(second.created, 0);
  assert.equal(second.existing, 2);
  assert.equal(db.analyses.length, 2);
});

test("ruumist kustutatud jagamist ei anta tagantjärele edasi", async () => {
  const db = baseDb({ messages: [{ id: "msg1", deletedAt: new Date("2026-07-19T11:00:00Z") }] });
  const result = await copyRoomSummariesToParticipants({ db, roomId: ROOM_ID });

  assert.equal(result.created, 0);
  assert.equal(result.skipped, 1);
  assert.equal(db.analyses.length, 0);
});

test("poolik pearaamatu rida lõpetatakse järgmisel katsel — koopia ei kao", async () => {
  const db = baseDb({
    copies: [{ id: "c1", roomSharedSummaryId: "s1", userId: "member-b", savedAnalysisId: null }]
  });
  const result = await copyRoomSummariesToParticipants({ db, roomId: ROOM_ID });

  assert.equal(result.created, 2);
  assert.deepEqual(db.analyses.map(row => row.ownerId).sort(), ["member-b", "member-c"]);
  assert.equal(db.ledger.find(row => row.userId === "member-b").savedAnalysisId, "a1");
});

test("koopia kirjutamise tõrge viskab, et kustutus saaks katkeda", async () => {
  const db = baseDb({ failSavedAnalysis: true });

  await assert.rejects(
    () => copyRoomSummariesToParticipants({ db, roomId: ROOM_ID }),
    /storage down/
  );
  assert.equal(db.analyses.length, 0);
});

test("ilma jagatud kokkuvõtteta ruum ei tee midagi", async () => {
  const db = createDb({ members: [{ roomId: ROOM_ID, userId: "member-b", leftAt: null }] });
  const result = await copyRoomSummariesToParticipants({ db, roomId: ROOM_ID });

  assert.equal(result.summaries, 0);
  assert.equal(result.created, 0);
  assert.equal(db.analyses.length, 0);
});

test("jagamise link salvestatakse snapshot'ina ja kordusjagamine ei paljunda ridu", async () => {
  const db = createDb();
  const summary = { id: "artifact1", title: "Kohtumine 12.07", content: SNAPSHOT };

  await recordSharedRoomSummary({ db, roomId: ROOM_ID, summary, messageId: "msg1", sharedByUserId: SHARER });
  await recordSharedRoomSummary({
    db,
    roomId: ROOM_ID,
    summary: { ...summary, content: "Parandatud kokkuvõte." },
    messageId: "msg2",
    sharedByUserId: SHARER
  });

  assert.equal(db.sharedSummaries.length, 1);
  assert.equal(db.sharedSummaries[0].content, "Parandatud kokkuvõte.");
  assert.equal(db.sharedSummaries[0].messageId, "msg2");
});

test("lingi kirjutamise tõrge ei kukuta jagamist ennast", async () => {
  const db = createDb();
  db.roomSharedSummary.upsert = async () => {
    throw new Error("link write failed");
  };

  const result = await recordSharedRoomSummary({
    db,
    roomId: ROOM_ID,
    summary: { id: "artifact1", content: SNAPSHOT },
    sharedByUserId: SHARER
  });

  assert.equal(result.recorded, false);
});
