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
          .filter(row => {
            if (row.roomId !== where.roomId) return false;
            // Praegu aktiivsed.
            if (where.leftAt === null) return row.leftAt == null;
            // Jagamise hetkel aktiivsed (SOL-ROOM-07): liitus enne jagamist ja ei olnud
            // selleks hetkeks lahkunud.
            if (where.joinedAt?.lte) {
              const joinedAt = row.joinedAt || new Date(0);
              if (joinedAt > where.joinedAt.lte) return false;
              const leftAfter = where.OR?.find(clause => clause.leftAt?.gt)?.leftAt?.gt;
              return row.leftAt == null || (leftAfter && row.leftAt > leftAfter);
            }
            return row.leftAt == null;
          })
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
        const row = { id: `c${ledgerSeq}`, savedAnalysisId: null, completedAt: null, ...data };
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
      { roomId: ROOM_ID, userId: SHARER, joinedAt: new Date("2026-07-01"), leftAt: null },
      { roomId: ROOM_ID, userId: "member-b", joinedAt: new Date("2026-07-01"), leftAt: null },
      { roomId: ROOM_ID, userId: "member-c", joinedAt: new Date("2026-07-01"), leftAt: null },
      // Lahkus ENNE jagamist — tema kokkuvõtet ei näinud ja koopiat ei saa.
      { roomId: ROOM_ID, userId: "member-left", joinedAt: new Date("2026-07-01"), leftAt: new Date("2026-07-18") },
      // Lahkus PÄRAST jagamist — SOL-ROOM-07: tema koopia ei tohi sõltuda ruumi
      // sulgemise juhuslikust ajast.
      { roomId: ROOM_ID, userId: "member-left-after", joinedAt: new Date("2026-07-01"), leftAt: new Date("2026-07-20") }
    ],
    ...overrides
  });
}

test("koopia saab see, kes oli ruumis JAGAMISE ajal või on praegu; jagaja ei saa", async () => {
  const db = baseDb();
  const result = await copyRoomSummariesToParticipants({ db, roomId: ROOM_ID });

  // SOL-ROOM-07: `member-left-after` lahkus pärast jagamist ja saab siiski koopia.
  // `member-left` lahkus ENNE jagamist ega saa. Jagajal on originaal oma dokumentides.
  assert.equal(result.created, 3);
  assert.deepEqual(
    db.analyses.map(row => row.ownerId).sort(),
    ["member-b", "member-c", "member-left-after"]
  );
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
  assert.equal(second.existing, 3);
  assert.equal(db.analyses.length, 3);
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
    copies: [{
      id: "c1",
      roomSharedSummaryId: "s1",
      userId: "member-b",
      savedAnalysisId: null,
      completedAt: null
    }]
  });
  const result = await copyRoomSummariesToParticipants({ db, roomId: ROOM_ID });

  assert.equal(result.created, 3);
  assert.deepEqual(
    db.analyses.map(row => row.ownerId).sort(),
    ["member-b", "member-c", "member-left-after"]
  );
  assert.equal(db.ledger.find(row => row.userId === "member-b").savedAnalysisId, "a1");
  assert.ok(db.ledger.find(row => row.userId === "member-b").completedAt);
});

test("kasutaja kustutatud valmis privaatkoopiat hilisem üleandmine ei taasta", async () => {
  const db = baseDb({
    members: [
      { roomId: ROOM_ID, userId: SHARER, joinedAt: new Date("2026-07-01"), leftAt: null },
      { roomId: ROOM_ID, userId: "member-b", joinedAt: new Date("2026-07-01"), leftAt: null }
    ],
    copies: [{
      id: "c1",
      roomSharedSummaryId: "s1",
      userId: "member-b",
      savedAnalysisId: null,
      completedAt: new Date("2026-07-19T12:00:00Z")
    }]
  });

  const result = await copyRoomSummariesToParticipants({ db, roomId: ROOM_ID });

  assert.equal(result.created, 0);
  assert.equal(result.existing, 1);
  assert.equal(db.analyses.length, 0);
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

test("lingi kirjutamise tõrge VISKAB — jagamine ei tohi jääda kandjata (SOL-ROOM-06)", async () => {
  const db = createDb();
  db.roomSharedSummary.upsert = async () => {
    throw new Error("link write failed");
  };

  // Vana leping oli vastupidine: viga neelati ja `{recorded:false}` läks marsruudile,
  // kes seda ei vaadanud. Kõik nägid ruumis kokkuvõtet, aga ruumi lõppedes ei saanud
  // sellest keegi privaatkoopiat. Nüüd kutsutakse teda sõnumiga samas tehingus, seega
  // viskamine ONGI parandus: kas mõlemad või mitte kumbki.
  await assert.rejects(
    () => recordSharedRoomSummary({
      db,
      roomId: ROOM_ID,
      summary: { id: "artifact1", content: SNAPSHOT },
      sharedByUserId: SHARER
    }),
    /link write failed/
  );
});

test("marsruut loob sõnumi ja kandja ÜHES tehingus (SOL-ROOM-06)", async () => {
  const source = await import("node:fs").then(fs =>
    fs.readFileSync(new URL("../../app/api/rooms/[roomId]/messages/route.js", import.meta.url), "utf8")
  );
  // Sõnum sünnib tehingus ja kandja kirjutatakse SAMA `tx`-iga.
  assert.match(source, /prisma\.\$transaction\(async \(tx\) => \{[\s\S]*?tx\.roomMessage\.create/);
  assert.match(source, /recordSharedRoomSummary\(\{\s*\n\s*db: tx,/);
  // Kinnitusringi tõrge ei tohi enam vaikida: jagaja saab vastuses ausa osalise seisu.
  assert.match(source, /approvalFailed: approvalOutcome\?\.failed === true/);
});
