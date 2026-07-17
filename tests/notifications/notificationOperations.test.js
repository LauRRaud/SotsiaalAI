import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  listNotificationOperations,
  requeueNotificationOperation,
  serializeNotificationOperation
} from "../../lib/notificationOperations.js";

test("admin serializer contains no recipient, source, target or message content", () => {
  const value = serializeNotificationOperation({
    id: "event-1", userId: "secret-user", sourceId: "secret-source", targetId: "secret-target",
    type: "PRE_INQUIRY_STATUS_CHANGED", emailStatus: "FAILED", emailAttempts: 2,
    emailLastErrorCode: "SMTP_TIMEOUT", createdAt: new Date("2026-07-17T10:00:00.000Z")
  });
  assert.deepEqual(Object.keys(value).sort(), [
    "createdAt", "emailAttempts", "emailLastErrorCode", "emailNextAttemptAt", "emailStatus", "id", "type"
  ]);
});

test("admin operations list only failed states and requeue with a state CAS", async () => {
  const calls = [];
  const db = {
    notificationEvent: {
      async findMany({ where }) { calls.push(where); return []; },
      async updateMany(args) { calls.push(args); return { count: 1 }; }
    }
  };
  assert.deepEqual(await listNotificationOperations({ db }), []);
  assert.deepEqual(await requeueNotificationOperation("event-1", { db }), { requeued: 1 });
  assert.deepEqual(calls[0].emailStatus.in, ["UNKNOWN", "FAILED"]);
  assert.deepEqual(calls[1].where.emailStatus.in, ["UNKNOWN", "FAILED"]);
  assert.equal(calls[1].data.emailAttempts, 0);
});

test("admin API is guarded before operational data access", async () => {
  const route = await readFile(new URL("../../app/api/admin/notifications/route.js", import.meta.url), "utf8");
  assert.match(route, /assertAdmin\(session\)/u);
  assert.match(route, /if \(!authz\.ok\)/u);
  assert.doesNotMatch(route, /userId:|sourceId:|targetId:/u);
});
