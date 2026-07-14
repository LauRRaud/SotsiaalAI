import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { reconcileNotificationEvents } from "../../lib/notificationReconciler.js";

const NOW = new Date("2026-07-14T12:00:00.000Z");

function adapterDb() {
  const events = new Map();
  let sequence = 0;
  const inquiry = {
    id: "inq-1", authorId: "author-1", recipientOwnerId: "recipient-1",
    status: "READY", sentAt: new Date("2026-07-13T10:00:00.000Z"),
    openedAt: new Date("2026-07-13T11:00:00.000Z"),
    updatedAt: new Date("2026-07-13T11:00:00.000Z"), nextContactOn: "2026-07-14"
  };
  const client = {
    preInquiry: {
      async findMany({ where }) {
        return where.nextContactOn ? [inquiry] : [inquiry];
      },
      async findFirst({ where }) {
        if (where.id !== inquiry.id) return null;
        if (where.recipientOwnerId && where.recipientOwnerId !== inquiry.recipientOwnerId) return null;
        if (where.authorId && where.authorId !== inquiry.authorId) return null;
        return { id: inquiry.id };
      }
    },
    invite: {
      async findMany() { return [{ id: "invite-1", roomId: "room-1", inviteeEmail: "invitee@example.test", expiresAt: new Date("2026-08-01") }]; },
      async findFirst({ where }) { return where.id === "invite-1" && where.inviteeEmail === "invitee@example.test" ? { id: "invite-1" } : null; }
    },
    user: {
      async findUnique({ where, select }) {
        if (where.email === "invitee@example.test") return { id: "invitee-1" };
        const users = {
          "author-1": { id: "author-1", email: "author@example.test", notificationEmailEnabled: true },
          "recipient-1": { id: "recipient-1", email: "recipient@example.test", notificationEmailEnabled: true },
          "invitee-1": { id: "invitee-1", email: "invitee@example.test", notificationEmailEnabled: true },
          "member-2": { id: "member-2", email: "member@example.test", notificationEmailEnabled: true },
          "reviewer-1": { id: "reviewer-1", email: "reviewer@example.test", notificationEmailEnabled: true },
          "owner-1": { id: "owner-1", email: "owner@example.test", notificationEmailEnabled: true }
        };
        const user = users[where.id] || null;
        if (!user) return null;
        return select?.email && !select?.notificationEmailEnabled ? { email: user.email } : user;
      }
    },
    roomMessage: {
      async findMany() { return [{ roomId: "room-1", authorId: "author-1" }]; }
    },
    roomMember: {
      async findMany() { return [{ userId: "member-2" }]; },
      async findFirst({ where }) { return where.roomId === "room-1" && where.userId === "member-2" ? { id: "member-row" } : null; }
    },
    helpMatch: {
      async findMany() { return [{ id: "match-1", roomId: "room-1", requesterId: "author-1", offererId: "member-2" }]; },
      async findFirst({ where }) { return where.id === "match-1" && ["author-1", "member-2"].some((id) => where.OR.some((part) => Object.values(part).includes(id))) ? { id: "match-1" } : null; }
    },
    effectivePracticeReviewAssignment: {
      async findMany() { return [{ id: "assignment-1", practiceId: "practice-1", reviewerId: "reviewer-1", assignedAt: new Date("2026-07-01") }]; },
      async findFirst({ where }) { return where.id === "assignment-1" && where.reviewerId === "reviewer-1" ? { id: "assignment-1" } : null; }
    },
    serviceProviderService: {
      async findMany() { return [{ id: "service-1", providerProfileId: "profile-1", availabilityCheckedAt: null, providerProfile: { ownerId: "owner-1" } }]; },
      async findFirst({ where }) { return where.id === "service-1" && where.providerProfile?.ownerId === "owner-1" ? { id: "service-1" } : null; }
    },
    notificationEvent: {
      async create({ data }) {
        if ([...events.values()].some((row) => row.dedupeKey === data.dedupeKey)) throw Object.assign(new Error("unique"), { code: "P2002" });
        const row = { ...structuredClone(data), id: `event-${++sequence}`, createdAt: NOW, readAt: null };
        events.set(row.id, row);
        return structuredClone(row);
      },
      async findUnique({ where }) { return structuredClone([...events.values()].find((row) => row.dedupeKey === where.dedupeKey) || null); }
    }
  };
  return { client, events };
}

test("reconcile covers every v1 adapter idempotently and respects recipient ownership", async () => {
  const db = adapterDb();
  const first = await reconcileNotificationEvents({ db: db.client, now: NOW });
  const second = await reconcileNotificationEvents({ db: db.client, now: NOW });
  assert.equal(first.created, 9);
  assert.equal(second.created, 0);
  assert.equal(second.existing, 9);
  assert.equal(db.events.size, 9);
  const rows = [...db.events.values()];
  assert.equal(rows.filter((row) => row.type === "ROOM_ACTIVITY" && row.userId === "author-1").length, 0);
  assert.equal(rows.find((row) => row.type === "ROOM_ACTIVITY").userId, "member-2");
  assert.equal(rows.find((row) => row.type === "SERVICE_AVAILABILITY_STALE").userId, "owner-1");
  assert.equal(rows.find((row) => row.type === "SERVICE_AVAILABILITY_STALE").emailPolicy, "NONE");
  assert.equal(rows.find((row) => row.type === "NEXT_CONTACT_DUE").dedupeKey.includes("2026-07-14"), true);
});

test("adapter dry-run is read-only", async () => {
  const db = adapterDb();
  const result = await reconcileNotificationEvents({ db: db.client, now: NOW, dryRun: true });
  assert.equal(result.considered, 9);
  assert.equal(db.events.size, 0);
});

test("room read and receiver workflow close their durable notification state", async () => {
  const roomRoute = await readFile(new URL("../../app/api/rooms/[roomId]/read/route.js", import.meta.url), "utf8");
  const preInquiries = await readFile(new URL("../../lib/preInquiries.js", import.meta.url), "utf8");
  assert.match(roomRoute, /markNotificationSourceRead[\s\S]+sourceType: "ROOM"/u);
  assert.match(preInquiries, /type: "NEXT_CONTACT_DUE"[\s\S]+emailStatus: "CANCELLED"/u);
});
