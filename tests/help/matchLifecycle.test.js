import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  closeHelpMatchForArchivedRoom,
  createHelpMatchAndRoom,
  decideHelpMatch,
  listIncomingHelpMatches,
  markHelpMatchContactedByRoom,
  toPublicHelpMatchProjection,
  withdrawHelpMatch
} from "../../lib/help/matches.js";

const NOW = new Date("2026-08-13T12:00:00.000Z");

function requestRecord(overrides = {}) {
  return {
    id: "request-1",
    userId: "requester",
    status: "OPEN",
    expiresAt: new Date("2026-08-20T12:00:00.000Z"),
    municipalityId: "municipality-1",
    primaryCategoryId: "category-1",
    primaryCategory: { id: "category-1", code: "DAILY_TASKS" },
    municipality: { id: "municipality-1", displayName: "Paide" },
    title: "Privaatne HIV tugi",
    description: "Vajan HIV tuge",
    structuredSummary: "HIV tugi",
    roleLabel: "HIV tugi",
    categoryLinks: [],
    targetGroupLinks: [],
    helpType: "VOLUNTARY",
    timeType: "FLEXIBLE",
    createdAt: new Date("2026-08-13T10:00:00.000Z"),
    ...overrides
  };
}

function offerRecord(overrides = {}) {
  return {
    ...requestRecord(),
    id: "offer-1",
    userId: "offerer",
    title: "Pakun HIV tuge",
    description: "Pakun HIV tuge",
    ...overrides
  };
}

function clone(value) {
  return structuredClone(value);
}

function matchesCursor(row, where = {}) {
  if (!where.OR) return true;
  return where.OR.some((clause) => {
    if (clause.createdAt?.lt) return row.createdAt < clause.createdAt.lt;
    return clause.createdAt instanceof Date
      && row.createdAt.getTime() === clause.createdAt.getTime()
      && row.id < clause.id.lt;
  });
}

function createDb({ notificationFailures = 0 } = {}) {
  let remainingNotificationFailures = notificationFailures;
  const state = {
    requests: [requestRecord()],
    offers: [offerRecord()],
    matches: [],
    notifications: [],
    rooms: [],
    mapEntries: [
      { id: "map-request-1", requestId: "request-1", offerId: null, mapVisible: true, status: "PUBLISHED" },
      { id: "map-offer-1", requestId: null, offerId: "offer-1", mapVisible: true, status: "PUBLISHED" }
    ]
  };

  function makeClient(target, transactional = false) {
    const client = {
      async $queryRaw() {
        return [];
      },
      helpRequest: {
        async findUnique({ where }) {
          return clone(target.requests.find((row) => row.id === where.id) || null);
        },
        async update({ where, data }) {
          const row = target.requests.find((item) => item.id === where.id);
          Object.assign(row, clone(data));
          return clone(row);
        },
        async updateMany({ where, data }) {
          const rows = target.requests.filter((row) => row.id === where.id && (!where.status || row.status === where.status));
          rows.forEach((row) => Object.assign(row, clone(data)));
          return { count: rows.length };
        }
      },
      helpOffer: {
        async findUnique({ where }) {
          return clone(target.offers.find((row) => row.id === where.id) || null);
        },
        async update({ where, data }) {
          const row = target.offers.find((item) => item.id === where.id);
          Object.assign(row, clone(data));
          return clone(row);
        },
        async updateMany({ where, data }) {
          const rows = target.offers.filter((row) => row.id === where.id && (!where.status || row.status === where.status));
          rows.forEach((row) => Object.assign(row, clone(data)));
          return { count: rows.length };
        }
      },
      helpMapEntry: {
        async updateMany({ where, data }) {
          const rows = target.mapEntries.filter((row) => where.OR.some((clause) => (
            (clause.requestId && row.requestId === clause.requestId)
            || (clause.offerId && row.offerId === clause.offerId)
          )));
          rows.forEach((row) => Object.assign(row, clone(data)));
          return { count: rows.length };
        }
      },
      helpMatch: {
        async findUnique({ where }) {
          if (where.id) return clone(target.matches.find((row) => row.id === where.id) || null);
          if (where.roomId) return clone(target.matches.find((row) => row.roomId === where.roomId) || null);
          const pair = where.requestId_offerId;
          return clone(target.matches.find((row) => row.requestId === pair.requestId && row.offerId === pair.offerId) || null);
        },
        async findFirst({ where }) {
          return clone(target.matches.find((row) => (
            row.id === where.id
            && row.status === where.status
            && row.initiatedByUserId !== where.initiatedByUserId.not
            && (row.requesterId === where.OR[0].requesterId || row.offererId === where.OR[1].offererId)
          )) || null);
        },
        async findMany({ where = {}, take = 25 }) {
          const rows = target.matches
            .filter((row) => row.status === where.status)
            .filter((row) => row.initiatedByUserId !== where.initiatedByUserId?.not)
            .filter((row) => !where.AND?.length || matchesCursor(row, where.AND.at(-1)))
            .sort((left, right) => (
              right.createdAt.getTime() - left.createdAt.getTime()
              || right.id.localeCompare(left.id)
            ));
          return clone(rows.slice(0, take).map((row) => ({
            ...row,
            request: target.requests.find((item) => item.id === row.requestId),
            offer: target.offers.find((item) => item.id === row.offerId)
          })));
        },
        async create({ data }) {
          const row = {
            id: `match-${String(target.matches.length + 1).padStart(3, "0")}`,
            roomId: null,
            createdAt: new Date(NOW),
            updatedAt: new Date(NOW),
            ...clone(data)
          };
          target.matches.push(row);
          return clone(row);
        },
        async update({ where, data }) {
          const row = target.matches.find((item) => item.id === where.id);
          if (!row) throw Object.assign(new Error("P2025"), { code: "P2025" });
          Object.assign(row, clone(data), { updatedAt: new Date(NOW.getTime() + 1) });
          return clone(row);
        },
        async updateMany({ where, data }) {
          let count = 0;
          for (const row of target.matches) {
            if (where.id && row.id !== where.id) continue;
            if (where.roomId && row.roomId !== where.roomId) continue;
            if (typeof where.status === "string" && row.status !== where.status) continue;
            if (where.status?.in && !where.status.in.includes(row.status)) continue;
            if (where.initiatedByUserId && row.initiatedByUserId !== where.initiatedByUserId) continue;
            if (where.OR?.some((clause) => clause.request || clause.offer)) {
              const sourceInvalid = where.OR.some((clause) => {
                const record = clause.request
                  ? target.requests.find((item) => item.id === row.requestId)
                  : target.offers.find((item) => item.id === row.offerId);
                const condition = clause.request?.is || clause.offer?.is || {};
                if (condition.status?.not) return record?.status !== condition.status.not;
                if (condition.expiresAt?.lte) return record?.expiresAt && record.expiresAt <= condition.expiresAt.lte;
                return false;
              });
              if (!sourceInvalid) continue;
            }
            Object.assign(row, clone(data), { updatedAt: new Date(NOW.getTime() + 1) });
            count += 1;
          }
          return { count };
        }
      },
      notificationEvent: {
        async create({ data }) {
          if (remainingNotificationFailures > 0) {
            remainingNotificationFailures -= 1;
            throw new Error("NOTIFICATION_WRITE_INJECTED");
          }
          if (target.notifications.some((row) => row.dedupeKey === data.dedupeKey)) {
            throw Object.assign(new Error("P2002"), { code: "P2002" });
          }
          const row = { id: `notification-${target.notifications.length + 1}`, createdAt: new Date(NOW), ...clone(data) };
          target.notifications.push(row);
          return clone(row);
        },
        async findUnique({ where }) {
          return clone(target.notifications.find((row) => row.dedupeKey === where.dedupeKey) || null);
        }
      },
      room: {
        async findUnique({ where }) {
          return clone(target.rooms.find((row) => row.id === where.id) || null);
        },
        async create({ data }) {
          const row = { id: `room-${target.rooms.length + 1}`, ...clone(data) };
          target.rooms.push(row);
          return clone(row);
        },
        async update({ where, data }) {
          const row = target.rooms.find((item) => item.id === where.id);
          Object.assign(row, clone(data));
          return clone(row);
        }
      }
    };

    if (!transactional) {
      client.$transaction = async (callback) => {
        const draft = clone(target);
        const result = await callback(makeClient(draft, true));
        Object.assign(target, draft);
        return result;
      };
    }
    return client;
  }

  return { client: makeClient(state), state };
}

test("SOL-HELP-06: match ja nõusolekuteavitus rollback'ivad koos ning retry taastab puuduva teavituse", async () => {
  const failing = createDb({ notificationFailures: 1 });
  await assert.rejects(
    createHelpMatchAndRoom({ requestId: "request-1", offerId: "offer-1", initiatedByUserId: "requester", now: NOW }, failing.client),
    /NOTIFICATION_WRITE_INJECTED/
  );
  assert.equal(failing.state.matches.length, 0);
  assert.equal(failing.state.notifications.length, 0);

  const db = createDb();
  const first = await createHelpMatchAndRoom({ requestId: "request-1", offerId: "offer-1", initiatedByUserId: "requester", now: NOW }, db.client);
  assert.equal(db.state.matches.length, 1);
  assert.equal(db.state.notifications.length, 1);
  db.state.notifications.length = 0;
  const retry = await createHelpMatchAndRoom({ requestId: "request-1", offerId: "offer-1", initiatedByUserId: "requester", now: NOW }, db.client);
  assert.equal(retry.id, first.id);
  assert.equal(db.state.matches.length, 1);
  assert.equal(db.state.notifications.length, 1);
});

test("SOL-HELP-05: ACCEPT lõpetab muutunud alusega sobituse ilma ruumita", async () => {
  for (const mutation of [
    (db) => { db.state.requests[0].status = "CLOSED"; },
    (db) => { db.state.offers[0].expiresAt = new Date("2026-08-13T11:59:59.000Z"); },
    (db) => { db.state.offers[0].primaryCategoryId = "category-2"; db.state.offers[0].primaryCategory = { id: "category-2", code: "TRANSPORT" }; },
    (db) => { db.state.offers[0].userId = "replacement-owner"; }
  ]) {
    const db = createDb();
    const pending = await createHelpMatchAndRoom({ requestId: "request-1", offerId: "offer-1", initiatedByUserId: "requester", now: NOW }, db.client);
    mutation(db);
    await assert.rejects(
      decideHelpMatch({ matchId: pending.id, decidedByUserId: "offerer", decision: "ACCEPT", now: NOW }, db.client),
      (error) => error?.code === "HELP_MATCH_BASIS_CHANGED"
    );
    assert.equal(db.state.matches[0].status, "CLOSED");
    assert.equal(db.state.rooms.length, 0);
  }
});

test("SOL-HELP-05: inimese kinnitatud pehme abi-/ajatüübi erand jääb ACCEPT-il kehtima", async () => {
  const db = createDb();
  db.state.offers[0].helpType = "PAID";
  const pending = await createHelpMatchAndRoom({
    requestId: "request-1",
    offerId: "offer-1",
    initiatedByUserId: "requester",
    allowSoftFailures: true,
    now: NOW
  }, db.client);
  const accepted = await decideHelpMatch({
    matchId: pending.id,
    decidedByUserId: "offerer",
    decision: "ACCEPT",
    now: NOW
  }, db.client);
  assert.equal(accepted.status, "ACCEPTED");
  assert.equal(db.state.rooms.length, 1);
});

test("SOL-HELP-13: ACCEPT, esimene sõnum ja arhiiv sulgevad kogu sobituse elutsükli", async () => {
  const db = createDb();
  const pending = await createHelpMatchAndRoom({
    requestId: "request-1",
    offerId: "offer-1",
    initiatedByUserId: "requester",
    now: NOW
  }, db.client);
  const accepted = await decideHelpMatch({
    matchId: pending.id,
    decidedByUserId: "offerer",
    decision: "ACCEPT",
    now: NOW
  }, db.client);
  assert.equal(accepted.status, "ACCEPTED");
  assert.equal(db.state.requests[0].status, "MATCHED");
  assert.equal(db.state.offers[0].status, "MATCHED");
  assert.ok(db.state.mapEntries.every((entry) => entry.mapVisible === false && entry.status === "HIDDEN"));

  await markHelpMatchContactedByRoom({ roomId: accepted.roomId }, db.client);
  assert.equal(db.state.matches[0].status, "CONTACTED");

  const closed = await closeHelpMatchForArchivedRoom({ roomId: accepted.roomId }, db.client);
  assert.equal(closed.closed, true);
  assert.equal(db.state.matches[0].status, "CLOSED");
  assert.equal(db.state.requests[0].status, "CLOSED");
  assert.equal(db.state.offers[0].status, "CLOSED");
  assert.ok(db.state.mapEntries.every((entry) => entry.mapVisible === false && entry.status === "CLOSED"));
});

test("SOL-HELP-07: avalik match-projektsioon ei väljasta IDsid ega privaatseid kattuvussõnu", () => {
  const projected = toPublicHelpMatchProjection({
    id: "match-1",
    requestId: "request-private",
    offerId: "offer-private",
    requesterId: "requester-private",
    offererId: "offerer-private",
    initiatedByUserId: "initiator-private",
    status: "PENDING",
    roomId: null,
    scoreSnapshot: 99,
    reasonsJson: { descriptionOverlap: ["hiv", "isikukood"] },
    createdAt: NOW,
    updatedAt: NOW,
    wasCreated: true
  });
  assert.deepEqual(Object.keys(projected).sort(), ["createdAt", "id", "roomId", "status", "updatedAt", "wasCreated"]);
  assert.doesNotMatch(JSON.stringify(projected), /hiv|isikukood|requester-private|offerer-private|request-private|offer-private/);
});

test("SOL-HELP-08: algataja saab PENDING-sobituse tagasi võtta ja hiline otsus ei loo ruumi", async () => {
  const db = createDb();
  const pending = await createHelpMatchAndRoom({ requestId: "request-1", offerId: "offer-1", initiatedByUserId: "requester", now: NOW }, db.client);
  const withdrawn = await withdrawHelpMatch({ matchId: pending.id, initiatedByUserId: "requester" }, db.client);
  assert.equal(withdrawn.status, "CLOSED");
  await assert.rejects(
    decideHelpMatch({ matchId: pending.id, decidedByUserId: "offerer", decision: "ACCEPT", now: NOW }, db.client),
    (error) => error?.code === "HELP_MATCH_NOT_PENDING"
  );
  assert.equal(db.state.rooms.length, 0);
});

test("SOL-HELP-08: 27 saabuvat rida on cursoriga kadudeta läbitavad", async () => {
  const db = createDb();
  db.state.matches = Array.from({ length: 27 }, (_, index) => ({
    id: `match-${String(index + 1).padStart(3, "0")}`,
    requestId: "request-1",
    offerId: "offer-1",
    requesterId: "requester",
    offererId: "offerer",
    initiatedByUserId: "requester",
    roomId: null,
    status: "PENDING",
    createdAt: new Date(NOW.getTime() - index * 1000),
    updatedAt: new Date(NOW.getTime() - index * 1000)
  }));
  const first = await listIncomingHelpMatches("offerer", { limit: 25, now: NOW }, db.client);
  assert.equal(first.items.length, 25);
  assert.equal(first.page.hasMore, true);
  const second = await listIncomingHelpMatches("offerer", { limit: 25, cursor: first.page.nextCursor, now: NOW }, db.client);
  assert.equal(second.items.length, 2);
  assert.equal(second.page.hasMore, false);
  assert.equal(new Set([...first.items, ...second.items].map((item) => item.id)).size, 27);
});

test("SOL-HELP-06/07/08: mõlemad route'id kasutavad teenuse teavitust, allowlisti, cursorit ja WITHDRAW toimingut", () => {
  const createRoute = readFileSync("app/api/help/matches/route.js", "utf8");
  const decisionRoute = readFileSync("app/api/help/matches/[matchId]/decision/route.js", "utf8");
  assert.doesNotMatch(createRoute, /createNotificationEvent/u, "route ei tohi teavitust pärast match'i commit'i luua");
  assert.match(createRoute, /toPublicHelpMatchProjection\(match\)/u);
  assert.match(decisionRoute, /toPublicHelpMatchProjection\(match\)/u);
  assert.match(createRoute, /searchParams\.get\("cursor"\)/u);
  assert.match(createRoute, /page:\s*result\.page/u);
  assert.match(decisionRoute, /decision === "WITHDRAW"/u);
  assert.match(decisionRoute, /withdrawHelpMatch/u);
});

test("SOL-HELP-06: vestluse connect-rada kasutab sama atomaarset createHelpMatch teenust", () => {
  const workflow = readFileSync("lib/help/workflowActions.js", "utf8");
  assert.match(workflow, /const match = await createHelpMatch\(/u);
  assert.doesNotMatch(workflow, /helpMatch\.create\(/u);
});
