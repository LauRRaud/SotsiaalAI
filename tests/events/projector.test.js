import test from "node:test";
import assert from "node:assert/strict";
import { projectDomainEvents } from "../../lib/events/projector.js";
import { resolveRecipients } from "../../lib/events/recipients.js";

function fakeDb({ recipient = "author-1" } = {}) {
  const event = {
    id: "domain-1",
    type: "pre_inquiry.opened",
    occurredAt: new Date("2026-07-17T10:00:00.000Z"),
    sourceType: "PRE_INQUIRY",
    sourceId: "inquiry-1",
    workspaceKind: "pre_inquiry",
    workspaceId: "inquiry-1",
    audienceRule: "author",
    meta: { statusKey: "READY" },
    projectedAt: null
  };
  const notifications = new Map();
  const client = {
    domainEvent: {
      async findMany() { return event.projectedAt ? [] : [structuredClone(event)]; },
      async updateMany({ data }) { event.projectedAt = data.projectedAt; return { count: 1 }; }
    },
    preInquiry: {
      async findFirst() { return recipient ? { authorId: recipient } : null; }
    },
    user: {
      async findUnique() { return { notificationEmailEnabled: false }; }
    },
    notificationEvent: {
      async create({ data }) {
        if (notifications.has(data.dedupeKey)) throw Object.assign(new Error("unique"), { code: "P2002" });
        const row = { id: "notification-1", ...structuredClone(data) };
        notifications.set(data.dedupeKey, row);
        return structuredClone(row);
      },
      async findUnique({ where }) { return structuredClone(notifications.get(where.dedupeKey)); },
      async updateMany({ where, data }) {
        const row = [...notifications.values()].find((value) => value.id === where.id);
        if (!row) return { count: 0 };
        Object.assign(row, structuredClone(data));
        return { count: 1 };
      }
    }
  };
  return { client, event, notifications };
}

test("recipient resolution rechecks source ownership", async () => {
  const { client, event } = fakeDb();
  assert.deepEqual(await resolveRecipients(event, { db: client }), ["author-1"]);
  event.audienceRule = "recipient_owner";
  assert.deepEqual(await resolveRecipients(event, { db: client }), []);
});

test("projector shares reconciler dedupe namespace and is rerunnable", async () => {
  const previous = process.env.U1_PROJECTOR_ENABLED;
  process.env.U1_PROJECTOR_ENABLED = "true";
  try {
    const db = fakeDb();
    const dedupe = "PRE_INQUIRY_STATUS_CHANGED:inquiry-1:author-1:READY:2026-07-17T10:00:00.000Z";
    db.notifications.set(dedupe, { id: "reconciler-row", dedupeKey: dedupe });
    const first = await projectDomainEvents({ db: db.client, now: new Date("2026-07-17T10:05:00.000Z") });
    assert.equal(first.existing, 1);
    assert.equal(first.created, 0);
    assert.equal(first.failed, 0);
    assert.equal(db.notifications.size, 1);
    assert.equal(db.notifications.get(dedupe).eventId, "domain-1");
    const second = await projectDomainEvents({ db: db.client });
    assert.equal(second.considered, 0);
  } finally {
    if (previous === undefined) delete process.env.U1_PROJECTOR_ENABLED;
    else process.env.U1_PROJECTOR_ENABLED = previous;
  }
});

test("projector dry-run performs no writes", async () => {
  const previous = process.env.U1_PROJECTOR_ENABLED;
  process.env.U1_PROJECTOR_ENABLED = "true";
  try {
    const db = fakeDb();
    const result = await projectDomainEvents({ db: db.client, dryRun: true });
    assert.equal(result.considered, 1);
    assert.equal(db.notifications.size, 0);
    assert.equal(db.event.projectedAt, null);
  } finally {
    if (previous === undefined) delete process.env.U1_PROJECTOR_ENABLED;
    else process.env.U1_PROJECTOR_ENABLED = previous;
  }
});

test("zero-recipient events are still marked projected", async () => {
  const previous = process.env.U1_PROJECTOR_ENABLED;
  process.env.U1_PROJECTOR_ENABLED = "true";
  try {
    const db = fakeDb({ recipient: null });
    const result = await projectDomainEvents({ db: db.client, now: new Date("2026-07-17T10:05:00.000Z") });
    assert.equal(result.zeroRecipients, 1);
    assert.ok(db.event.projectedAt);
  } finally {
    if (previous === undefined) delete process.env.U1_PROJECTOR_ENABLED;
    else process.env.U1_PROJECTOR_ENABLED = previous;
  }
});

test("network-share projector retries after a partial delivery failure without losing the outbox event", async () => {
  const previous = process.env.U1_PROJECTOR_ENABLED;
  process.env.U1_PROJECTOR_ENABLED = "true";
  try {
    const db = fakeDb();
    Object.assign(db.event, {
      type: "network_share.changed",
      sourceType: "NETWORK_SHARE",
      sourceId: "share-1",
      workspaceKind: "network_share",
      workspaceId: null,
      audienceRule: "network_share_participant",
      meta: { statusCode: "RESPONDED", actionCode: "RESPOND", recipientKind: "WORKER" }
    });
    db.client.networkShare = {
      async findFirst() { return { workerId: "worker-1", clientUserId: "client-1", recipientUserId: "recipient-1" }; }
    };
    const create = db.client.notificationEvent.create.bind(db.client.notificationEvent);
    let failOnce = true;
    db.client.notificationEvent.create = async (input) => {
      if (failOnce) {
        failOnce = false;
        throw new Error("INJECTED_DELIVERY_FAILURE");
      }
      return create(input);
    };

    const failed = await projectDomainEvents({ db: db.client, now: new Date("2026-08-13T10:05:00.000Z") });
    assert.equal(failed.failed, 1);
    assert.equal(db.event.projectedAt, null);
    const retried = await projectDomainEvents({ db: db.client, now: new Date("2026-08-13T10:06:00.000Z") });
    assert.equal(retried.created, 1);
    assert.ok(db.event.projectedAt);
  } finally {
    if (previous === undefined) delete process.env.U1_PROJECTOR_ENABLED;
    else process.env.U1_PROJECTOR_ENABLED = previous;
  }
});
