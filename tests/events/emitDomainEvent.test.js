import test from "node:test";
import assert from "node:assert/strict";
import { emitDomainEvent } from "../../lib/events/emitDomainEvent.js";
import { DomainEventType } from "../../lib/events/registry.js";

const KEY = "pre_inquiry.opened:inquiry-1:2026-07-17T10:00:00.000Z";

function input(overrides = {}) {
  return {
    type: DomainEventType.PRE_INQUIRY_OPENED,
    actorKind: "user",
    actorUserId: "recipient-1",
    sourceId: "inquiry-1",
    workspaceId: "inquiry-1",
    actionTarget: "pre_inquiry:inquiry-1",
    idempotencyKey: KEY,
    occurredAt: new Date("2026-07-17T10:00:00.000Z"),
    meta: { statusKey: "READY" },
    ...overrides
  };
}

/**
 * Fake jõustab päris andmebaasi kaht omadust: `idempotencyKey` on UNIKAALNE ja
 * `findUnique` leiab rea selle võtme järgi. `raceOnCreate` jäljendab võõrast
 * tehingut, mis jõudis meie kontrolli JÄREL ette.
 */
function fakeTx({ raceOnCreate = false } = {}) {
  const rows = new Map();
  return {
    rows,
    domainEvent: {
      async create({ data }) {
        if (raceOnCreate && !rows.has(data.idempotencyKey)) {
          rows.set(data.idempotencyKey, { id: "event-race", ...structuredClone(data) });
          throw Object.assign(new Error("unique"), { code: "P2002" });
        }
        if (rows.has(data.idempotencyKey)) throw Object.assign(new Error("unique"), { code: "P2002" });
        const row = { id: `event-${rows.size + 1}`, ...structuredClone(data) };
        rows.set(data.idempotencyKey, row);
        return structuredClone(row);
      },
      async findUnique({ where }) {
        const row = rows.get(where.idempotencyKey);
        return row ? structuredClone(row) : null;
      }
    }
  };
}

async function withOutbox(value, run) {
  const previous = process.env.U1_OUTBOX_ENABLED;
  process.env.U1_OUTBOX_ENABLED = value;
  try {
    return await run();
  } finally {
    if (previous === undefined) delete process.env.U1_OUTBOX_ENABLED;
    else process.env.U1_OUTBOX_ENABLED = previous;
  }
}

test("emitter requires a transaction client and is idempotent", async () => {
  await withOutbox("true", async () => {
    await assert.rejects(
      emitDomainEvent({ $connect() {}, $transaction() {}, domainEvent: { create() {} } }, input()),
      { code: "DOMAIN_EVENT_TX_REQUIRED" }
    );
    const tx = fakeTx();
    assert.equal((await emitDomainEvent(tx, input())).created, true);
    assert.equal((await emitDomainEvent(tx, input())).created, false);
    assert.equal(tx.rows.size, 1);
  });
});

/* SOL-EVENT-01. Vastuvõtukriteerium nõuab, et võrreldaks vähemalt
   type / source / actor / action / meta erinevusi. Iga juhtum on eraldi rida, sest
   „üks neist katkeb" ei ole sama mis „kõik neli katkevad". */
const CONFLICTS = [
  ["type", { type: DomainEventType.PRE_INQUIRY_REPLIED }, "type"],
  ["source", { sourceId: "inquiry-2" }, "sourceId"],
  ["actor", { actorUserId: "recipient-2" }, "actorUserId"],
  ["action", { actionTarget: "pre_inquiry:inquiry-2" }, "actionTarget"],
  ["meta", { meta: { statusKey: "ARCHIVED" } }, "meta"]
];

for (const [label, overrides, field] of CONFLICTS) {
  test(`same idempotency key with a different ${label} is a conflict, not a success`, async () => {
    await withOutbox("true", async () => {
      const tx = fakeTx();
      assert.equal((await emitDomainEvent(tx, input())).created, true);

      await assert.rejects(emitDomainEvent(tx, input(overrides)), (error) => {
        assert.equal(error.code, "DOMAIN_EVENT_IDEMPOTENCY_CONFLICT");
        assert.equal(error.idempotencyKey, KEY);
        assert.ok(error.differingFields.includes(field), `differingFields=${error.differingFields}`);
        return true;
      });

      /* Konflikt ei tohi jätta maha teist rida ega muuta olemasolevat. */
      assert.equal(tx.rows.size, 1);
      assert.equal(tx.rows.get(KEY).type, DomainEventType.PRE_INQUIRY_OPENED);
      assert.equal(tx.rows.get(KEY).sourceId, "inquiry-1");
    });
  });
}

/* Vastupidine pool samast piirist: meta puudumine kahel kujul (`{}` ja puuduv) on
   sama sündmus, mitte konflikt. Muidu annaks iga kutsuja, kes meta ära jätab,
   vale häire. */
test("empty and absent meta describe the same act", async () => {
  await withOutbox("true", async () => {
    const tx = fakeTx();
    const first = input({ type: DomainEventType.PRE_INQUIRY_RECALLED, meta: {} });
    assert.equal((await emitDomainEvent(tx, first)).created, true);
    const second = await emitDomainEvent(tx, input({ type: DomainEventType.PRE_INQUIRY_RECALLED, meta: undefined }));
    assert.equal(second.created, false);
    assert.equal(tx.rows.size, 1);
  });
});

/* `occurredAt` on TEADLIKULT identiteedist väljas: ta ütleb, millal me sündmust
   märkasime. Kutsuja, kes aega ei anna, saab igal katsel uue `new Date()` — aja
   võrdlemine muudaks just selle korduse konfliktiks, mille jaoks idempotentsus on. */
test("a retry with a later observation time stays idempotent", async () => {
  await withOutbox("true", async () => {
    const tx = fakeTx();
    assert.equal((await emitDomainEvent(tx, input())).created, true);
    const again = await emitDomainEvent(tx, input({ occurredAt: new Date("2026-07-17T10:05:00.000Z") }));
    assert.equal(again.created, false);
    assert.equal(again.event.occurredAt.toISOString?.() ?? again.event.occurredAt, "2026-07-17T10:00:00.000Z");
  });
});

/* Võidujooks: rida tekkis pärast meie kontrolli. Päris Postgresis on tehing sel
   hetkel juba vigane, seega ainus aus vastus on kukkuda — mitte küsida uuesti ja
   tagastada näiline edu. */
test("a lost race propagates instead of reporting success", async () => {
  await withOutbox("true", async () => {
    const tx = fakeTx({ raceOnCreate: true });
    await assert.rejects(emitDomainEvent(tx, input()), (error) => {
      assert.equal(error.code, "P2002");
      assert.equal(error.domainEventRace, true);
      return true;
    });
  });
});

test("disabled outbox is a no-op and cannot break the business transaction", async () => {
  await withOutbox("false", async () => {
    assert.deepEqual(await emitDomainEvent(null, { unsafe: "ignored" }), {
      emitted: false, created: false, disabled: true, event: null
    });
  });
});
