import test from "node:test";
import assert from "node:assert/strict";

import { projectProviderPaymentRaw, buildPaymentRawRecord } from "../../lib/payments/rawProjection.js";

const LEAKY_PAYLOAD = {
  id: "tx_1",
  reference: "mk_ref_1",
  status: "PAID",
  amount: "7.99",
  currency: "EUR",
  message_type: "payment_return",
  customer: { email: "victim@example.com", name: "Real Name", ip: "1.2.3.4", country: "EE" },
  token: { id: "SECRET_RECURRING_TOKEN", multiuse: true },
  card: { last4: "4242", brand: "visa" },
  merchant_data: "{\"internal\":\"x\"}"
};

test("projection keeps only allowlisted technical fields", () => {
  const projection = projectProviderPaymentRaw(LEAKY_PAYLOAD);
  assert.deepEqual(Object.keys(projection).sort(), [
    "amount",
    "currency",
    "messageType",
    "reference",
    "status",
    "transactionId"
  ]);
  assert.equal(projection.transactionId, "tx_1");
  assert.equal(projection.reference, "mk_ref_1");
});

test("projection never leaks email, name, ip, card, or recurring token", () => {
  const serialized = JSON.stringify(projectProviderPaymentRaw(LEAKY_PAYLOAD));
  for (const secret of ["victim@example.com", "Real Name", "1.2.3.4", "SECRET_RECURRING_TOKEN", "4242", "visa", "internal"]) {
    assert.ok(!serialized.includes(secret), `projection must not contain ${secret}`);
  }
});

test("buildPaymentRawRecord merges curated base and puts projection under provider", () => {
  const record = buildPaymentRawRecord({ flow: "subscription_init", plan: "client_monthly" }, LEAKY_PAYLOAD);
  assert.equal(record.flow, "subscription_init");
  assert.equal(record.plan, "client_monthly");
  assert.equal(record.provider.transactionId, "tx_1");
  const serialized = JSON.stringify(record);
  assert.ok(!serialized.includes("victim@example.com"));
  assert.ok(!serialized.includes("SECRET_RECURRING_TOKEN"));
});

test("projection tolerates nested transaction/payment shapes and empty input", () => {
  assert.deepEqual(projectProviderPaymentRaw({}), {});
  assert.deepEqual(projectProviderPaymentRaw(null), {});
  const nested = projectProviderPaymentRaw({ transaction: { id: "tx_9", status: "COMPLETED" }, payment: { amount: "4.00" } });
  assert.equal(nested.transactionId, "tx_9");
  assert.equal(nested.status, "COMPLETED");
  assert.equal(nested.amount, "4.00");
});
