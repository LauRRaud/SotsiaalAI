import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { writePaymentAudit } from "../../lib/payments/observability.js";

/* SOL-PAY-08 — AUDIT PEAB COMMIT'IMA KOOS OTSUSEGA.

   `logPaymentAudit()` kirjutas `ChatLog` rea GLOBAALSE kliendiga ja neelas vea;
   webhook kutsus teda lukustatud tehingu sees ilma `await`-ita. Audit võis joosta
   enne commit'i, kirjeldada rollback'itud tegu või kaduda ise. Nende testide
   kandev väide: auditit ei saa enam kirjutada tehingust mööda. */

function fakeTx() {
  const rows = [];
  return {
    rows,
    dataAuditLog: {
      async create({ data }) {
        rows.push(data);
        return { id: `audit_${rows.length}`, ...data };
      }
    }
  };
}

test("KANDEV: audit nõuab tehingut — globaalse kliendiga ei saa teda kirjutada", async () => {
  await assert.rejects(
    () => writePaymentAudit(null, { action: "x" }),
    /vajab tehingut/
  );
  await assert.rejects(
    () => writePaymentAudit({}, { action: "x" }),
    /vajab tehingut/
  );
});

test("audit kirjutab püsiva rea koos teo, tulemuse ja seostega", async () => {
  const tx = fakeTx();
  await writePaymentAudit(tx, {
    action: "subscription_activate",
    result: "active",
    paymentId: "pay_1",
    subscriptionId: "sub_1",
    inviteId: "invite_1",
    userId: "user_1",
    actorUserId: "user_1",
    reason: "webhook"
  });

  assert.equal(tx.rows.length, 1);
  const row = tx.rows[0];
  assert.equal(row.action, "payment.subscription_activate");
  assert.equal(row.resourceType, "Payment");
  assert.equal(row.resourceId, "pay_1");
  assert.equal(row.targetUserId, "user_1");
  assert.equal(row.actorUserId, "user_1");
  assert.equal(row.meta.result, "active");
  assert.equal(row.meta.subscriptionId, "sub_1");
  assert.equal(row.meta.inviteId, "invite_1");
  assert.equal(row.meta.reason, "webhook");
});

test("makseta otsus seotakse tellimusega", async () => {
  const tx = fakeTx();
  await writePaymentAudit(tx, {
    action: "subscription_cancel_requested",
    result: "cancel_at_period_end",
    subscriptionId: "sub_9",
    userId: "user_9"
  });
  assert.equal(tx.rows[0].resourceType, "Subscription");
  assert.equal(tx.rows[0].resourceId, "sub_9");
});

test("auditi viga EI ole neelatav — ta peab tehingu tagasi pöörama", async () => {
  const tx = {
    dataAuditLog: {
      async create() {
        throw new Error("audit write blocked");
      }
    }
  };
  await assert.rejects(() => writePaymentAudit(tx, { action: "x" }), /audit write blocked/);
});

/* LEPING: ükski tehingusisene otsus ei tohi enam telemeetriat auditina kasutada. */
const TRANSACTIONAL_SOURCES = [
  "app/api/subscription/webhook/route.js",
  "app/api/subscription/route.js",
  "lib/payments/reconcile.js",
  "lib/payments/sponsoredInviteDelivery.js"
];

test("tehingusisesed otsused kirjutavad püsiva auditi, mitte telemeetria", () => {
  for (const file of TRANSACTIONAL_SOURCES) {
    const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
    assert.match(source, /writePaymentAudit\(tx, \{/, file);
    assert.ok(
      !/^\s+logPaymentAudit\(\{/m.test(source.replace(/logPaymentAudit\(\{[\s\S]*?\}\);/g, (match) =>
        // Telemeetria-kutse on lubatud AINULT seal, kus midagi ei muudetud
        /sponsored_not_cancelable/.test(match) ? "" : match
      )),
      `${file}: tehingusisene otsus kasutab endiselt telemeetriat auditina`
    );
  }
});

test("webhooki auditid on await'itud", () => {
  const source = readFileSync(
    new URL("../../app/api/subscription/webhook/route.js", import.meta.url),
    "utf8"
  );
  const calls = source.match(/writePaymentAudit\(/g) || [];
  const awaited = source.match(/await writePaymentAudit\(/g) || [];
  assert.equal(calls.length, awaited.length, "await'imata audit ei ole tehingu osa");
  assert.ok(calls.length >= 8, `oodatud vähemalt 8 auditikutset, on ${calls.length}`);
});
