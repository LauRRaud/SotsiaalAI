import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  dismissNotification,
  listNotificationEvents,
  serializeNotificationEvent
} from "../../lib/notifications.js";

function fakeDb() {
  const row = {
    id: "event-1", userId: "user-1", type: "PRE_INQUIRY_RECALLED",
    sourceType: "PRE_INQUIRY", sourceId: "inquiry-1", targetKind: "PRE_INQUIRY",
    targetId: "inquiry-1", createdAt: new Date("2026-07-17T10:00:00.000Z"),
    readAt: null, dismissedAt: null, eventId: "domain-1", workspaceKind: "pre_inquiry", workspaceId: "inquiry-1"
  };
  return {
    row,
    client: {
      preInquiry: { async findFirst() { return { id: "inquiry-1" }; } },
      domainEvent: { async findMany() { return [{ id: "domain-1", type: "pre_inquiry.opened" }]; } },
      notificationEvent: {
        async findMany({ where }) {
          if (where.dismissedAt === null && row.dismissedAt) return [];
          return [structuredClone(row)];
        },
        async findFirst({ where }) { return where.id === row.id && where.userId === row.userId ? structuredClone(row) : null; },
        async updateMany({ data }) { Object.assign(row, structuredClone(data)); return { count: 1 }; }
      }
    }
  };
}

test("notification center serializer exposes action and ack but no source or recipient data", () => {
  const value = serializeNotificationEvent(fakeDb().row);
  assert.equal(value.href, "/eelpoordumised?openInquiry=inquiry-1");
  assert.equal(value.ackMode, "read");
  assert.equal(value.actionKind, "open_pre_inquiry_received");
  for (const privateKey of ["userId", "sourceId", "targetId", "emailLastErrorCode"]) {
    assert.equal(privateKey in value, false);
  }
});

test("notification list uses the DomainEvent label to distinguish opened from archived", async () => {
  const db = fakeDb();
  const [value] = await listNotificationEvents("user-1", { db: db.client });
  assert.equal(value.eventType, "pre_inquiry.opened");
  assert.equal(value.labelKey, "notifications.events.pre_inquiry_opened");
});

test("dismiss is owner scoped, reverified and excluded from the default list", async () => {
  const db = fakeDb();
  assert.equal((await listNotificationEvents("user-1", { db: db.client })).length, 1);
  await dismissNotification("user-1", "event-1", { db: db.client, now: new Date("2026-07-17T11:00:00.000Z") });
  assert.equal((await listNotificationEvents("user-1", { db: db.client })).length, 0);
  assert.equal((await listNotificationEvents("user-1", { db: db.client, dismissed: "include" })).length, 1);
});

test("API and UI contracts include GET filters, read, dismiss, badge and all states", async () => {
  const [route, ui] = await Promise.all([
    readFile(new URL("../../app/api/notifications/route.js", import.meta.url), "utf8"),
    readFile(new URL("../../components/workspace/NotificationCenter.jsx", import.meta.url), "utf8")
  ]);
  assert.match(route, /dismissedValue/u);
  assert.match(route, /operation === "dismiss"/u);
  assert.match(route, /\["dismiss", "read", "source_read"\]\.includes\(operation\)/u);
  assert.match(ui, /event\.ackMode === "read"/u);
  assert.doesNotMatch(ui, /\["read", "target_open"\]/u);
  for (const contract of ["loading", "error", "empty", "notification-center-badge", "ackMode"]) assert.match(ui, new RegExp(contract));
});
