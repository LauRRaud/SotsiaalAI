import test from "node:test";
import assert from "node:assert/strict";

import { reconcileStuckPayments, getStuckInitiatedWhere } from "../../lib/payments/reconcile.js";

const NOW = new Date("2026-07-19T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;

function applyData(target, data) {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object" && "increment" in value) {
      target[key] = Number(target[key] || 0) + Number(value.increment);
    } else {
      target[key] = value;
    }
  }
}

function fakeDb(payments, subscriptions = new Map(), invites = new Map()) {
  const db = {
    async $transaction(fn) {
      return fn(db);
    },
    async $queryRaw() {
      return [];
    },
    payment: {
      async findMany({ where, take }) {
        const rows = [...payments.values()]
          .filter((p) => p.status === where.status)
          .filter((p) => p.provider === where.provider)
          .filter((p) => new Date(p.createdAt).getTime() < new Date(where.createdAt.lt).getTime())
          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        return rows.slice(0, take).map((p) => ({ ...p }));
      },
      async findUnique({ where }) {
        const p = payments.get(where.id);
        return p ? { ...p } : null;
      },
      async update({ where, data }) {
        const p = payments.get(where.id);
        applyData(p, data);
        return { ...p };
      }
    },
    subscription: {
      async findUnique({ where }) {
        const s = subscriptions.get(where.id);
        return s ? { ...s, user: s.user } : null;
      },
      async update({ where, data }) {
        const s = subscriptions.get(where.id);
        applyData(s, data);
        return { ...s };
      }
    },
    billingMethod: {
      async findUnique() {
        return null;
      },
      async findFirst() {
        return null;
      },
      async create({ data }) {
        return { id: "bm_new", ...data };
      },
      async update({ data }) {
        return { id: "bm_upd", ...data };
      }
    },
    invite: {
      async updateMany({ where, data }) {
        let count = 0;
        for (const inv of invites.values()) {
          if (inv.id !== where.id) continue;
          if (where.status?.in && !where.status.in.includes(inv.status)) continue;
          applyData(inv, data);
          count += 1;
        }
        return { count };
      }
    }
  };
  return db;
}

test("getStuckInitiatedWhere targets only expired INITIATED MAKSEKESKUS payments", () => {
  const where = getStuckInitiatedWhere(NOW, 30 * 60 * 1000);
  assert.equal(where.status, "INITIATED");
  assert.equal(where.provider, "MAKSEKESKUS");
  assert.ok(where.createdAt.lt instanceof Date);
});

test("report-only (no provider query) never activates", async () => {
  const payments = new Map([
    ["p1", { id: "p1", status: "INITIATED", provider: "MAKSEKESKUS", kind: "SUBSCRIPTION_INITIAL", subscriptionId: "s1", createdAt: new Date(NOW.getTime() - 2 * HOUR) }]
  ]);
  const db = fakeDb(payments);
  const result = await reconcileStuckPayments({ db, now: NOW, stuckAfterMs: HOUR });
  assert.equal(result.scanned, 1);
  assert.equal(result.pending, 1);
  assert.equal(result.activated, 0);
  assert.equal(payments.get("p1").status, "INITIATED", "must not activate without a verified provider result");
});

test("only expired INITIATED are selected", async () => {
  const payments = new Map([
    ["old", { id: "old", status: "INITIATED", provider: "MAKSEKESKUS", kind: "SUBSCRIPTION_INITIAL", subscriptionId: "s1", createdAt: new Date(NOW.getTime() - 2 * HOUR) }],
    ["fresh", { id: "fresh", status: "INITIATED", provider: "MAKSEKESKUS", kind: "SUBSCRIPTION_INITIAL", subscriptionId: "s2", createdAt: new Date(NOW.getTime() - 5 * 60 * 1000) }],
    ["paid", { id: "paid", status: "PAID", provider: "MAKSEKESKUS", kind: "SUBSCRIPTION_INITIAL", subscriptionId: "s3", createdAt: new Date(NOW.getTime() - 3 * HOUR) }]
  ]);
  const db = fakeDb(payments);
  const result = await reconcileStuckPayments({ db, now: NOW, stuckAfterMs: HOUR });
  assert.equal(result.scanned, 1, "only the old INITIATED payment is stuck");
});

test("verified PAID activates a stuck initial subscription payment; re-run is idempotent", async () => {
  const payments = new Map([
    ["p1", { id: "p1", status: "INITIATED", provider: "MAKSEKESKUS", kind: "SUBSCRIPTION_INITIAL", subscriptionId: "s1", createdAt: new Date(NOW.getTime() - 2 * HOUR), raw: {} }]
  ]);
  const subscriptions = new Map([
    ["s1", { id: "s1", status: "NONE", validUntil: null, billingMode: "RECURRING", planDefinitionId: "plan_client_v1", plan: "client_monthly", user: { role: "CLIENT" } }]
  ]);
  const db = fakeDb(payments, subscriptions);
  const queryProviderStatus = async () => ({ status: "PAID", payload: { status: "PAID" } });

  const first = await reconcileStuckPayments({ db, now: NOW, stuckAfterMs: HOUR, queryProviderStatus });
  assert.equal(first.activated, 1);
  assert.equal(payments.get("p1").status, "PAID");
  assert.equal(subscriptions.get("s1").status, "ACTIVE");

  const second = await reconcileStuckPayments({ db, now: NOW, stuckAfterMs: HOUR, queryProviderStatus });
  assert.equal(second.scanned, 0, "already resolved, nothing left to reconcile");
});

test("verified PAID for a non-initial payment is not auto-activated (needs webhook)", async () => {
  const payments = new Map([
    ["p1", { id: "p1", status: "INITIATED", provider: "MAKSEKESKUS", kind: "INVITE_SPONSORED", inviteId: "i1", subscriptionId: null, createdAt: new Date(NOW.getTime() - 2 * HOUR), raw: {} }]
  ]);
  const db = fakeDb(payments);
  const result = await reconcileStuckPayments({ db, now: NOW, stuckAfterMs: HOUR, queryProviderStatus: async () => ({ status: "PAID" }) });
  assert.equal(result.activated, 0);
  assert.equal(result.needs_webhook, 1);
  assert.equal(payments.get("p1").status, "INITIATED");
});

test("verified FAILED marks the payment terminal and revokes a pending invite", async () => {
  const payments = new Map([
    ["p1", { id: "p1", status: "INITIATED", provider: "MAKSEKESKUS", kind: "INVITE_SPONSORED", inviteId: "i1", subscriptionId: null, createdAt: new Date(NOW.getTime() - 2 * HOUR), raw: {} }]
  ]);
  const invites = new Map([["i1", { id: "i1", status: "PENDING_PAYMENT" }]]);
  const db = fakeDb(payments, new Map(), invites);
  const result = await reconcileStuckPayments({ db, now: NOW, stuckAfterMs: HOUR, queryProviderStatus: async () => ({ status: "FAILED" }) });
  assert.equal(result.failed, 1);
  assert.equal(payments.get("p1").status, "FAILED");
  assert.equal(invites.get("i1").status, "REVOKED");
});
