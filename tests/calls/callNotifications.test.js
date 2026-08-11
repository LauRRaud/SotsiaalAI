import assert from "node:assert/strict";
import test from "node:test";

import {
  notifyCallRecordingAvailable,
  notifyRoomCallStarted
} from "../../lib/calls/notifications.js";

/* T12 E7 — kõne/salvestuse teavitused.
   Fake-prisma katab täpselt need päringud, mida notifications.js + selle
   saaja-verifitseerimine (assertNotificationRecipient) tegelikult teevad. */

const ROOM_ID = "room1";
const CALL_ID = "call1";
const REQUEST_ID = "rec1";

function matchesLeftAt(where, row) {
  return where?.leftAt === null ? row.leftAt == null : true;
}

function createDb({ members = [], requests = [], calls = [], users = [], failFor = null } = {}) {
  const notifications = [];
  return {
    notifications,
    roomMember: {
      async findMany({ where } = {}) {
        return members
          .filter(row => row.roomId === where.roomId
            && matchesLeftAt(where, row)
            && (!where.userId?.not || row.userId !== where.userId.not))
          .map(row => ({ userId: row.userId }));
      },
      async findFirst({ where } = {}) {
        return members.find(row => row.roomId === where.roomId
          && row.userId === where.userId
          && matchesLeftAt(where, row)) || null;
      }
    },
    callSession: {
      async findFirst({ where } = {}) {
        return calls.find(row => row.id === where.id
          && (where.roomId == null || row.roomId === where.roomId)) || null;
      }
    },
    /* SOL-CALL-07: `callRecordingConsent` on siit MEELEGA ära. Saajate ring ei
       tohi enam nõusolekuridu lugeda — kui mõni rada seda ikka teeb, kukub test
       kohe `TypeError`-iga, mitte ei anna vaikselt vale rohelise. */
    callRecordingRequest: {
      async findFirst({ where } = {}) {
        const roomId = where?.callSession?.roomId ?? null;
        return requests.find(row => row.id === where.id
          && (where.callSessionId == null || row.callSessionId === where.callSessionId)
          && (where.requestedByUserId == null || row.requestedByUserId === where.requestedByUserId)
          && (roomId == null || row.roomId === roomId)) || null;
      }
    },
    user: {
      async findUnique({ where } = {}) {
        return users.find(row => row.id === where.id) || null;
      }
    },
    notificationEvent: {
      async create({ data } = {}) {
        if (failFor && data.userId === failFor) throw new Error("db down");
        if (notifications.some(row => row.dedupeKey === data.dedupeKey)) {
          throw Object.assign(new Error("duplicate"), { code: "P2002" });
        }
        const row = { id: `n${notifications.length + 1}`, ...data };
        notifications.push(row);
        return row;
      },
      async findUnique({ where } = {}) {
        return notifications.find(row => row.dedupeKey === where.dedupeKey) || null;
      }
    }
  };
}

function roomCallDb(overrides = {}) {
  return createDb({
    calls: [{ id: CALL_ID, roomId: ROOM_ID }],
    members: [
      { roomId: ROOM_ID, userId: "starter", leftAt: null },
      { roomId: ROOM_ID, userId: "member-b", leftAt: null },
      { roomId: ROOM_ID, userId: "member-c", leftAt: null },
      { roomId: ROOM_ID, userId: "member-left", leftAt: new Date("2026-07-01") }
    ],
    users: [
      { id: "starter", notificationEmailEnabled: false },
      { id: "member-b", notificationEmailEnabled: false },
      { id: "member-c", notificationEmailEnabled: false },
      { id: "member-left", notificationEmailEnabled: false }
    ],
    ...overrides
  });
}

test("kõne algus teavitab praeguseid liikmeid, mitte alustajat ega lahkunut", async () => {
  const db = roomCallDb();
  const result = await notifyRoomCallStarted({
    db, roomId: ROOM_ID, callSessionId: CALL_ID, actorUserId: "starter"
  });

  assert.equal(result.created, 2);
  assert.equal(result.failed, 0);
  assert.deepEqual(db.notifications.map(row => row.userId).sort(), ["member-b", "member-c"]);
  assert.equal(db.notifications.every(row => row.type === "CALL_STARTED"), true);
});

test("kordus-start ei tekita teist teavitust (dedupe)", async () => {
  const db = roomCallDb();
  const args = { db, roomId: ROOM_ID, callSessionId: CALL_ID, actorUserId: "starter" };

  await notifyRoomCallStarted(args);
  const again = await notifyRoomCallStarted(args);

  assert.equal(again.created, 0);
  assert.equal(again.existing, 2);
  assert.equal(db.notifications.length, 2);
});

test("kõneteavitus kannab ainult ID-d, olekut ja sihtlinki", async () => {
  const db = roomCallDb();
  await notifyRoomCallStarted({
    db, roomId: ROOM_ID, callSessionId: CALL_ID, actorUserId: "starter"
  });

  const row = db.notifications[0];
  assert.equal(row.sourceId, CALL_ID);
  assert.equal(row.targetId, ROOM_ID);
  assert.equal(row.sourceType, "CALL");
  assert.equal(row.targetKind, "ROOM");
  // Vaba tekst (sõnumi sisu, salvestis, kokkuvõte) ei tohi payloadi jõuda.
  const textLike = Object.keys(row).filter(key => /content|body|text|summary|transcript/i.test(key));
  assert.deepEqual(textLike, []);
});

test("ühe saaja tõrge ei peata teisi ega viska kõnerajale viga", async () => {
  const db = roomCallDb({ failFor: "member-b" });
  const result = await notifyRoomCallStarted({
    db, roomId: ROOM_ID, callSessionId: CALL_ID, actorUserId: "starter"
  });

  assert.equal(result.failed, 1);
  assert.equal(result.created, 1);
  assert.deepEqual(db.notifications.map(row => row.userId), ["member-c"]);
});

/* SOL-CALL-07 — SAAJA ON KANDJA, MITTE NÕUSTUNU.
   Vana ootus („teavitatakse kõiki nõustunuks jäänuid") oli sõna-sõnalt leiu
   kirjeldus testina: nõustunu sai teate faili kohta, mida ta ei leia ühestki
   vaatest, sest `UserDocument` kuulub taotlejale ja dokumendipind on
   `ownerId`-skoobiga. Need testid lukustavad omaniku otsuse 11.08.2026. */

function recordingDb(overrides = {}) {
  return createDb({
    requests: [{ id: REQUEST_ID, callSessionId: CALL_ID, roomId: ROOM_ID, requestedByUserId: "requester" }],
    users: [
      { id: "requester", notificationEmailEnabled: false },
      { id: "consenter", notificationEmailEnabled: false }
    ],
    ...overrides
  });
}

test("salvestisest teavitatakse ainult selle kandjat — taotlejat", async () => {
  const db = recordingDb();

  const result = await notifyCallRecordingAvailable({
    db, roomId: ROOM_ID, callSessionId: CALL_ID, recordingRequestId: REQUEST_ID
  });

  assert.equal(result.created, 1);
  assert.deepEqual(db.notifications.map(row => row.userId), ["requester"]);
  assert.equal(db.notifications[0].type, "CALL_RECORDING_READY");
  assert.equal(db.notifications[0].sourceId, REQUEST_ID);
  assert.equal(db.notifications[0].targetId, ROOM_ID);
});

test("nõustunu ei saa teadet ka siis, kui ta saajate loendisse satub", async () => {
  /* Kandev kontroll: teine värav (assertNotificationRecipient) peab pidama ka
     siis, kui esimene eksib. Nõusolek ei ole ligipääs. */
  const db = recordingDb();
  db.callRecordingRequest.findFirst = async ({ where } = {}) => (
    where?.requestedByUserId ? null : { requestedByUserId: "consenter" }
  );

  const result = await notifyCallRecordingAvailable({
    db, roomId: ROOM_ID, callSessionId: CALL_ID, recordingRequestId: REQUEST_ID
  });

  assert.equal(result.created, 0);
  assert.equal(result.failed, 1);
  assert.equal(db.notifications.length, 0);
});

test("teise ruumi salvestis ei jõua saajani (siht peab kuuluma allikale)", async () => {
  const db = recordingDb({
    requests: [{ id: REQUEST_ID, callSessionId: CALL_ID, roomId: "other-room", requestedByUserId: "requester" }]
  });

  const result = await notifyCallRecordingAvailable({
    db, roomId: ROOM_ID, callSessionId: CALL_ID, recordingRequestId: REQUEST_ID
  });

  assert.equal(result.created, 0);
  assert.equal(result.failed, 1);
  assert.equal(db.notifications.length, 0);
});

test("teadet ei teki, kui taotlust ei ole", async () => {
  const db = recordingDb({ requests: [] });

  const result = await notifyCallRecordingAvailable({
    db, roomId: ROOM_ID, callSessionId: CALL_ID, recordingRequestId: REQUEST_ID
  });

  assert.equal(result.created, 0);
  assert.equal(result.failed, 0);
  assert.equal(db.notifications.length, 0);
});

test("ruumi mitte-liige ei saa kõneteavitust ka siis, kui ta loendisse satub", async () => {
  const db = roomCallDb();
  db.roomMember.findMany = async () => [{ userId: "outsider" }];

  const result = await notifyRoomCallStarted({
    db, roomId: ROOM_ID, callSessionId: CALL_ID, actorUserId: "starter"
  });

  assert.equal(result.created, 0);
  assert.equal(result.failed, 1);
  assert.equal(db.notifications.length, 0);
});

test("puuduv teavituskiht ei kukuta kõnet", async () => {
  const result = await notifyRoomCallStarted({
    db: {}, roomId: ROOM_ID, callSessionId: CALL_ID, actorUserId: "starter"
  });

  assert.equal(result.skipped, 1);
  assert.equal(result.created, 0);
});
