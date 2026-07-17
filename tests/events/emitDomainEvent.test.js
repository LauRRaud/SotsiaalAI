import test from "node:test";
import assert from "node:assert/strict";
import { emitDomainEvent } from "../../lib/events/emitDomainEvent.js";
import { DomainEventType } from "../../lib/events/registry.js";

function input() {
  return {
    type: DomainEventType.PRE_INQUIRY_OPENED,
    actorKind: "user",
    actorUserId: "recipient-1",
    sourceId: "inquiry-1",
    workspaceId: "inquiry-1",
    actionTarget: "pre_inquiry:inquiry-1",
    idempotencyKey: "pre_inquiry.opened:inquiry-1:2026-07-17T10:00:00.000Z",
    occurredAt: new Date("2026-07-17T10:00:00.000Z"),
    meta: { statusKey: "READY" }
  };
}

function fakeTx() {
  let row = null;
  return {
    domainEvent: {
      async create({ data }) {
        if (row) throw Object.assign(new Error("unique"), { code: "P2002" });
        row = { id: "event-1", ...structuredClone(data) };
        return structuredClone(row);
      },
      async findUnique() { return structuredClone(row); }
    }
  };
}

test("emitter requires a transaction client and is idempotent", async () => {
  const previous = process.env.U1_OUTBOX_ENABLED;
  process.env.U1_OUTBOX_ENABLED = "true";
  try {
    await assert.rejects(emitDomainEvent({ $connect() {}, $transaction() {}, domainEvent: { create() {} } }, input()), { code: "DOMAIN_EVENT_TX_REQUIRED" });
    const tx = fakeTx();
    assert.equal((await emitDomainEvent(tx, input())).created, true);
    assert.equal((await emitDomainEvent(tx, input())).created, false);
  } finally {
    if (previous === undefined) delete process.env.U1_OUTBOX_ENABLED;
    else process.env.U1_OUTBOX_ENABLED = previous;
  }
});

test("disabled outbox is a no-op and cannot break the business transaction", async () => {
  const previous = process.env.U1_OUTBOX_ENABLED;
  process.env.U1_OUTBOX_ENABLED = "false";
  try {
    assert.deepEqual(await emitDomainEvent(null, { unsafe: "ignored" }), {
      emitted: false, created: false, disabled: true, event: null
    });
  } finally {
    if (previous === undefined) delete process.env.U1_OUTBOX_ENABLED;
    else process.env.U1_OUTBOX_ENABLED = previous;
  }
});
