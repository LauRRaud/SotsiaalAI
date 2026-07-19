import assert from "node:assert/strict";
import test from "node:test";

import {
  applySummaryApprovalPolicy,
  respondToSummaryApproval,
  listRoomSummaryApprovalState,
  canRespondToSummaryApprovalRole
} from "../../lib/rooms/summaryApproval.js";
import { buildDocumentAuditRecord } from "../../lib/documents/auditShared.js";

/* T20 COLLAB-P1/P2 — kinnitusring + jagamise auditiausus.
   Fake-prisma katab täpselt need päringud, mida summaryApproval.js ja
   notifications.js saaja-verifitseerimine tegelikult teevad. */

const ROOM_ID = "room1";
const SHARER = "user_sharer";
const WORKER = "user_worker";
const CLIENT = "user_client";
const OUTSIDER = "user_outsider";

function createDb({
  summaries = [],
  approvals = [],
  members = [],
  users = [],
  messages = []
} = {}) {
  const notifications = [];
  const state = { summaries: [...summaries], approvals: [...approvals] };
  return {
    notifications,
    state,
    roomSharedSummary: {
      async findFirst({ where } = {}) {
        return state.summaries.find(row =>
          (where.id == null || row.id === where.id) &&
          (where.roomId == null || row.roomId === where.roomId) &&
          (where.artifactId == null || row.artifactId === where.artifactId) &&
          (where.sharedByUserId == null || row.sharedByUserId === where.sharedByUserId) &&
          (where.approvalRequestedAt?.not === null
            ? row.approvalRequestedAt != null
            : true)
        ) || null;
      },
      async findMany({ where } = {}) {
        return state.summaries
          .filter(row => row.roomId === where.roomId &&
            (where.approvalRequestedAt?.not === null ? row.approvalRequestedAt != null : true))
          .map(row => ({
            ...row,
            approvals: state.approvals.filter(a => a.roomSharedSummaryId === row.id)
          }));
      },
      async update({ where, data } = {}) {
        const row = state.summaries.find(r => r.id === where.id);
        if (!row) throw new Error("not found");
        Object.assign(row, data);
        return row;
      }
    },
    roomSummaryApproval: {
      async findFirst({ where } = {}) {
        return state.approvals.find(row =>
          row.roomSharedSummaryId === where.roomSharedSummaryId &&
          (where.userId == null || row.userId === where.userId)
        ) || null;
      },
      async deleteMany({ where } = {}) {
        const before = state.approvals.length;
        state.approvals = state.approvals.filter(
          row => row.roomSharedSummaryId !== where.roomSharedSummaryId
        );
        return { count: before - state.approvals.length };
      },
      async upsert({ where, create, update } = {}) {
        const key = where.roomSharedSummaryId_userId;
        let row = state.approvals.find(r =>
          r.roomSharedSummaryId === key.roomSharedSummaryId && r.userId === key.userId
        );
        if (row) {
          Object.assign(row, update, { updatedAt: new Date() });
        } else {
          row = {
            id: `a${state.approvals.length + 1}`,
            ...create,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          state.approvals.push(row);
        }
        return row;
      }
    },
    roomMember: {
      async findFirst({ where } = {}) {
        return members.find(row => row.roomId === where.roomId &&
          row.userId === where.userId &&
          (where.leftAt === null ? row.leftAt == null : true)) || null;
      },
      async findMany({ where } = {}) {
        return members
          .filter(row => row.roomId === where.roomId &&
            (where.leftAt === null ? row.leftAt == null : true) &&
            (!where.userId?.not || row.userId !== where.userId.not))
          .map(row => ({
            userId: row.userId,
            displayName: row.displayName || "",
            user: { role: (users.find(u => u.id === row.userId) || {}).role || "CLIENT" }
          }));
      }
    },
    roomMessage: {
      async findFirst({ where } = {}) {
        return messages.find(row => row.id === where.id) || null;
      }
    },
    user: {
      async findUnique({ where } = {}) {
        return users.find(row => row.id === where.id) || null;
      }
    },
    notificationEvent: {
      async create({ data } = {}) {
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

function baseFixture(overrides = {}) {
  return createDb({
    summaries: [{
      id: "sum1",
      roomId: ROOM_ID,
      artifactId: "art1",
      messageId: "msg1",
      sharedByUserId: SHARER,
      title: "Kohtumise kokkuvõte",
      content: "Sisu v1",
      approvalRequestedAt: new Date("2026-07-19T10:00:00.000Z")
    }],
    members: [
      { roomId: ROOM_ID, userId: SHARER, leftAt: null, displayName: "Jagaja" },
      { roomId: ROOM_ID, userId: WORKER, leftAt: null, displayName: "Kolleeg" },
      { roomId: ROOM_ID, userId: CLIENT, leftAt: null, displayName: "Pöörduja" }
    ],
    users: [
      { id: SHARER, role: "SOCIAL_WORKER" },
      { id: WORKER, role: "SOCIAL_WORKER" },
      { id: CLIENT, role: "CLIENT" }
    ],
    messages: [{ id: "msg1", deletedAt: null }],
    ...overrides
  });
}

test("roll: professionaal vastab, klient mitte (O-CO-5 c)", () => {
  assert.equal(canRespondToSummaryApprovalRole("SOCIAL_WORKER"), true);
  assert.equal(canRespondToSummaryApprovalRole("SERVICE_PROVIDER"), true);
  assert.equal(canRespondToSummaryApprovalRole("ADMIN"), true);
  assert.equal(canRespondToSummaryApprovalRole("CLIENT"), false);
});

test("respond: professionaal saab kinnitada", async () => {
  const db = baseFixture();
  const approval = await respondToSummaryApproval({
    db, roomId: ROOM_ID, summaryId: "sum1", userId: WORKER,
    userRole: "SOCIAL_WORKER", status: "APPROVED"
  });
  assert.equal(approval.status, "APPROVED");
  /* Jagaja sai vastuse-teavituse. */
  assert.equal(db.notifications.length, 1);
  assert.equal(db.notifications[0].userId, SHARER);
  assert.equal(db.notifications[0].type, "ROOM_SUMMARY_APPROVAL_RESPONSE");
});

test("respond: parandus kannab sisu; vastuse muutmine on upsert", async () => {
  const db = baseFixture();
  await respondToSummaryApproval({
    db, roomId: ROOM_ID, summaryId: "sum1", userId: WORKER,
    userRole: "SOCIAL_WORKER", status: "CORRECTION", note: "Kuupäev on vale"
  });
  assert.equal(db.state.approvals.length, 1);
  assert.equal(db.state.approvals[0].note, "Kuupäev on vale");
  await respondToSummaryApproval({
    db, roomId: ROOM_ID, summaryId: "sum1", userId: WORKER,
    userRole: "SOCIAL_WORKER", status: "APPROVED"
  });
  assert.equal(db.state.approvals.length, 1);
  assert.equal(db.state.approvals[0].status, "APPROVED");
  /* Kinnituse juures parandusteksti ei hoita. */
  assert.equal(db.state.approvals[0].note, null);
});

test("respond: klient on adressaat, mitte ringi osaleja (403)", async () => {
  const db = baseFixture();
  await assert.rejects(
    respondToSummaryApproval({
      db, roomId: ROOM_ID, summaryId: "sum1", userId: CLIENT,
      userRole: "CLIENT", status: "APPROVED"
    }),
    (error) => error.status === 403
  );
});

test("respond: jagaja ei kinnita iseenda kokkuvõtet (403)", async () => {
  const db = baseFixture();
  await assert.rejects(
    respondToSummaryApproval({
      db, roomId: ROOM_ID, summaryId: "sum1", userId: SHARER,
      userRole: "SOCIAL_WORKER", status: "APPROVED"
    }),
    (error) => error.status === 403
  );
});

test("respond: mitteliige saab 403, võõras ruum 404", async () => {
  const db = baseFixture();
  await assert.rejects(
    respondToSummaryApproval({
      db, roomId: ROOM_ID, summaryId: "sum1", userId: OUTSIDER,
      userRole: "SOCIAL_WORKER", status: "APPROVED"
    }),
    (error) => error.status === 403
  );
  await assert.rejects(
    respondToSummaryApproval({
      db, roomId: "room_other", summaryId: "sum1", userId: WORKER,
      userRole: "SOCIAL_WORKER", status: "APPROVED"
    }),
    (error) => error.status === 404
  );
});

test("respond: ilma avatud ringita 409", async () => {
  const db = baseFixture();
  db.state.summaries[0].approvalRequestedAt = null;
  await assert.rejects(
    respondToSummaryApproval({
      db, roomId: ROOM_ID, summaryId: "sum1", userId: WORKER,
      userRole: "SOCIAL_WORKER", status: "APPROVED"
    }),
    (error) => error.status === 409 && error.message === "api.rooms.summary_ring_not_open"
  );
});

test("respond: kustutatud sõnum = tagasi võetud jagamine (409, fail-closed)", async () => {
  const db = baseFixture({ messages: [{ id: "msg1", deletedAt: new Date() }] });
  await assert.rejects(
    respondToSummaryApproval({
      db, roomId: ROOM_ID, summaryId: "sum1", userId: WORKER,
      userRole: "SOCIAL_WORKER", status: "APPROVED"
    }),
    (error) => error.status === 409 && error.message === "api.rooms.summary_share_withdrawn"
  );
});

test("respond: tundmatu staatus 400", async () => {
  const db = baseFixture();
  await assert.rejects(
    respondToSummaryApproval({
      db, roomId: ROOM_ID, summaryId: "sum1", userId: WORKER,
      userRole: "SOCIAL_WORKER", status: "MAYBE"
    }),
    (error) => error.status === 400
  );
});

test("policy: requestApproval avab ringi ja teavitab ainult professionaale", async () => {
  const db = baseFixture();
  db.state.summaries[0].approvalRequestedAt = null;
  const result = await applySummaryApprovalPolicy({
    db, roomId: ROOM_ID, artifactId: "art1",
    prior: { content: "Sisu v1" }, requestApproval: true
  });
  assert.equal(result.ringOpened, true);
  assert.ok(db.state.summaries[0].approvalRequestedAt);
  /* WORKER (professionaal) sai teate; CLIENT ja jagaja MITTE. */
  const recipients = db.notifications.map(n => n.userId);
  assert.deepEqual(recipients, [WORKER]);
  assert.equal(db.notifications[0].type, "ROOM_SUMMARY_APPROVAL_REQUESTED");
});

test("policy: sisu muutus nullib vanad vastused ja taasavab aktiivse ringi", async () => {
  const db = baseFixture({
    approvals: [{
      id: "a1", roomSharedSummaryId: "sum1", userId: WORKER,
      status: "APPROVED", note: null,
      createdAt: new Date(), updatedAt: new Date()
    }]
  });
  const before = db.state.summaries[0].approvalRequestedAt;
  const result = await applySummaryApprovalPolicy({
    db, roomId: ROOM_ID, artifactId: "art1",
    prior: { content: "VANA sisu" }, requestApproval: false
  });
  assert.equal(result.approvalsCleared, true, "vana kinnitus ei tohi jääda uue teksti külge");
  assert.equal(db.state.approvals.length, 0);
  assert.equal(result.ringOpened, true, "aktiivne ring taasavaneb uue sisuga");
  assert.notEqual(db.state.summaries[0].approvalRequestedAt, before);
});

test("policy: ilma soovita ja muutuseta ei tee midagi", async () => {
  const db = baseFixture();
  db.state.summaries[0].approvalRequestedAt = null;
  const result = await applySummaryApprovalPolicy({
    db, roomId: ROOM_ID, artifactId: "art1",
    prior: { content: "Sisu v1" }, requestApproval: false
  });
  assert.equal(result.ringOpened, false);
  assert.equal(db.notifications.length, 0);
});

test("state: jagaja näeb vastuseid, osaleja ainult loendust ja enda oma", async () => {
  const db = baseFixture({
    approvals: [{
      id: "a1", roomSharedSummaryId: "sum1", userId: WORKER,
      status: "CORRECTION", note: "Paranda kuupäev",
      createdAt: new Date(), updatedAt: new Date()
    }]
  });
  const sharerView = await listRoomSummaryApprovalState({
    db, roomId: ROOM_ID, viewerId: SHARER, viewerRole: "SOCIAL_WORKER"
  });
  assert.equal(sharerView.length, 1);
  assert.equal(sharerView[0].isSharer, true);
  assert.equal(sharerView[0].canRespond, false);
  assert.equal(sharerView[0].responses.length, 1);
  assert.equal(sharerView[0].responses[0].note, "Paranda kuupäev");
  assert.equal(sharerView[0].counts.correction, 1);
  /* eligible = professionaalid peale jagaja (WORKER); CLIENT ei loe. */
  assert.equal(sharerView[0].counts.eligible, 1);

  const workerView = await listRoomSummaryApprovalState({
    db, roomId: ROOM_ID, viewerId: WORKER, viewerRole: "SOCIAL_WORKER"
  });
  assert.equal(workerView[0].isSharer, false);
  assert.equal(workerView[0].canRespond, true);
  assert.equal(workerView[0].myStatus, "CORRECTION");
  assert.deepEqual(workerView[0].responses, [], "üksikvastused on ainult jagajale");

  const clientView = await listRoomSummaryApprovalState({
    db, roomId: ROOM_ID, viewerId: CLIENT, viewerRole: "CLIENT"
  });
  assert.equal(clientView[0].canRespond, false, "klient on adressaat (O-CO-5 c)");
});

test("P1: artifact.shared kaardistub ARTIFACT_SHARE auditikirjeks", () => {
  const record = buildDocumentAuditRecord("artifact.shared", {
    userId: SHARER,
    artifactId: "art1",
    roomId: ROOM_ID,
    messageId: "msg1"
  });
  assert.equal(record.action, "ARTIFACT_SHARE");
  assert.equal(record.ownerId, SHARER);
  assert.equal(record.artifactId, "art1");
  assert.equal(record.meta.roomId, ROOM_ID);
  assert.equal(record.meta.messageId, "msg1");
});
