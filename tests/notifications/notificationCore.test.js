import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  createNotificationEvent,
  getNotificationPreference,
  listNotificationEvents,
  markNotificationRead,
  notificationBadges,
  serializeNotificationEvent,
  updateNotificationPreference
} from "../../lib/notifications.js";

function fakeDb({ emailEnabled = null } = {}) {
  const events = new Map();
  const user = {
    id: "user-1",
    notificationEmailEnabled: emailEnabled,
    notificationPreferenceVersion: 0
  };
  let sequence = 0;
  return {
    state: { events, user },
    client: {
      preInquiry: {
        async findFirst({ where }) {
          return where.id === "inquiry-1" && where.recipientOwnerId === "user-1" ? { id: where.id } : null;
        }
      },
      user: {
        async findUnique({ where }) {
          return where.id === user.id ? structuredClone(user) : null;
        },
        async updateMany({ where, data }) {
          if (where.id !== user.id || where.notificationPreferenceVersion !== user.notificationPreferenceVersion) {
            return { count: 0 };
          }
          user.notificationEmailEnabled = data.notificationEmailEnabled;
          user.notificationPreferenceVersion += Number(data.notificationPreferenceVersion?.increment || 0);
          return { count: 1 };
        }
      },
      notificationEvent: {
        async create({ data }) {
          if ([...events.values()].some((event) => event.dedupeKey === data.dedupeKey)) {
            throw Object.assign(new Error("unique"), { code: "P2002" });
          }
          const event = {
            ...structuredClone(data),
            id: `event-${++sequence}`,
            readAt: null,
            createdAt: new Date(`2026-07-14T10:00:0${sequence}.000Z`),
            updatedAt: new Date(`2026-07-14T10:00:0${sequence}.000Z`)
          };
          events.set(event.id, event);
          return structuredClone(event);
        },
        async findUnique({ where }) {
          return structuredClone(
            [...events.values()].find((event) => event.dedupeKey === where.dedupeKey) || null
          );
        },
        async findMany({ where, take }) {
          return [...events.values()]
            .filter((event) => event.userId === where.userId)
            .filter((event) => !where.readAt || event.readAt === where.readAt)
            .slice(0, take)
            .map((event) => structuredClone(event));
        },
        async findFirst({ where }) {
          const event = events.get(where.id);
          return event?.userId === where.userId ? { id: event.id } : null;
        },
        async updateMany({ where, data }) {
          let count = 0;
          for (const event of events.values()) {
            if (where.id && event.id !== where.id) continue;
            if (where.userId && event.userId !== where.userId) continue;
            if (where.readAt === null && event.readAt !== null) continue;
            Object.assign(event, structuredClone(data));
            count += 1;
          }
          return { count };
        }
      }
    }
  };
}

const arrival = {
  userId: "user-1",
  type: "PRE_INQUIRY_ARRIVED",
  sourceType: "PRE_INQUIRY",
  sourceId: "inquiry-1",
  targetKind: "PRE_INQUIRY",
  targetId: "inquiry-1",
  dedupeSuffix: "sent-1",
  emailPolicy: "TRANSACTIONAL"
};

test("event creation is idempotent under a unique-key race", async () => {
  const db = fakeDb();
  const first = await createNotificationEvent(arrival, { db: db.client });
  const second = await createNotificationEvent(arrival, { db: db.client });

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(first.event.id, second.event.id);
  assert.equal(db.state.events.size, 1);
  assert.equal(first.event.emailStatus, "PENDING");
  assert.match(first.event.emailMessageId, /^notification\.[a-f0-9]{40}@sotsiaal\.ai$/u);
});

test("unknown event/source/target combinations and unsafe ids fail closed", async () => {
  const db = fakeDb();
  for (const input of [
    { ...arrival, type: "CALLER_TEXT" },
    { ...arrival, sourceType: "ROOM" },
    { ...arrival, targetKind: "CALLER_URL" },
    { ...arrival, targetId: "https://evil.example/" }
  ]) {
    await assert.rejects(createNotificationEvent(input, { db: db.client }), { status: 400 });
  }
  assert.equal(db.state.events.size, 0);
});

test("event recipient is verified against the source object", async () => {
  const db = fakeDb();
  await assert.rejects(
    createNotificationEvent({ ...arrival, userId: "user-2" }, { db: db.client }),
    { status: 404, message: "api.common.not_found" }
  );
  assert.equal(db.state.events.size, 0);
});

test("optional email is pending only after an explicit user opt-in", async () => {
  for (const [emailEnabled, expectedStatus] of [[null, "NOT_REQUESTED"], [false, "NOT_REQUESTED"], [true, "PENDING"]]) {
    const db = fakeDb({ emailEnabled });
    const result = await createNotificationEvent({ ...arrival, emailPolicy: "OPTIONAL" }, { db: db.client });
    assert.equal(result.event.emailStatus, expectedStatus);
  }
});

test("public serializer exposes only allowlisted presentation fields", () => {
  const result = serializeNotificationEvent({
    id: "event-1",
    userId: "private-user",
    type: "PRE_INQUIRY_ARRIVED",
    sourceType: "PRE_INQUIRY",
    sourceId: "private-source",
    targetKind: "PRE_INQUIRY",
    targetId: "inquiry-1",
    createdAt: new Date("2026-07-14T10:00:00.000Z"),
    readAt: null,
    emailLastErrorCode: "PRIVATE"
  });
  assert.equal(result.href, "/eelpoordumised?openInquiry=inquiry-1");
  assert.equal("userId" in result, false);
  assert.equal("sourceId" in result, false);
  assert.equal("emailLastErrorCode" in result, false);
});

test("owner-scoped reads do not reveal a foreign event", async () => {
  const db = fakeDb();
  const created = await createNotificationEvent(arrival, { db: db.client });

  await assert.rejects(
    markNotificationRead("user-2", created.event.id, { db: db.client }),
    { status: 404, message: "api.common.not_found" }
  );
  await markNotificationRead("user-1", created.event.id, { db: db.client });
  assert.ok(db.state.events.get(created.event.id).readAt);
});

test("preference update uses an owner-only version CAS", async () => {
  const db = fakeDb();
  assert.deepEqual(await getNotificationPreference("user-1", { db: db.client }), {
    emailEnabled: null,
    version: 0
  });
  assert.deepEqual(await updateNotificationPreference("user-1", {
    emailEnabled: true,
    expectedVersion: 0
  }, { db: db.client }), {
    emailEnabled: true,
    version: 1
  });
  await assert.rejects(updateNotificationPreference("user-1", {
    emailEnabled: false,
    expectedVersion: 0
  }, { db: db.client }), { status: 409 });
});

test("listing and badges remain user-scoped and content-free", async () => {
  const db = fakeDb();
  await createNotificationEvent(arrival, { db: db.client });
  const events = await listNotificationEvents("user-1", { db: db.client, unreadOnly: true });
  assert.equal(events.length, 1);
  assert.deepEqual(notificationBadges(events), {
    pre_inquiries: { type: "number", value: 1, label: "1" }
  });
});

test("schema and migration are additive, indexed, and cascade on account deletion", async () => {
  const schema = await readFile(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");
  const migration = await readFile(
    new URL("../../prisma/migrations/20260715120000_u1_u2_notification_continuity/migration.sql", import.meta.url),
    "utf8"
  );

  assert.match(schema, /model NotificationEvent \{/u);
  assert.match(schema, /user User @relation\(fields: \[userId\], references: \[id\], onDelete: Cascade\)/u);
  assert.match(schema, /@@index\(\[userId, sourceType, sourceId, readAt\]\)/u);
  assert.match(schema, /nextContactOn\s+String\?/u);
  assert.match(schema, /emailPolicy\s+String\s+@default\("NONE"\)/u);
  assert.match(migration, /CREATE TABLE "NotificationEvent"/u);
  assert.match(migration, /ON DELETE CASCADE/u);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN/u);
});
