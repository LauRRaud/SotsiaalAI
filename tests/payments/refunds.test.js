import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  extractRefundedAmount,
  isRefundStatus,
  maxRefundedAmount,
  resolveRefundOutcome
} from "../../lib/payments/refunds.js";
import { mapProviderPaymentStatus } from "../../lib/payments/maksekeskus.js";
import { isTerminalPaymentStatus } from "../../lib/payments/providerOutcome.js";

/* SOL-PAY-06 — OSALINE TAGASTUS EI OLE TÄISTAGASTUS.

   `part_refunded` mapiti samasse `REFUNDED` väärtusse ja `REFUNDED` vaiketegevus
   on `cancel`: 0,01 € korrigeerimine lõpetas tellimuse, revoke'is mandaadi ja
   sponsorkutse puhul võttis ära ka ruumiliikmesuse. Reegel on nüüd
   raamatupidamise oma: õigus lõpeb siis, kui makse on TÄIELIKULT tagastatud. */

const PAYMENT = { amount: "7.99", refundedAmount: null };

test("provideri osaline tagastus ei mapi enam täistagastuseks", () => {
  assert.equal(mapProviderPaymentStatus("part_refunded"), "PART_REFUNDED");
  assert.equal(mapProviderPaymentStatus("PART_REFUNDED"), "PART_REFUNDED");
  assert.equal(mapProviderPaymentStatus("partially_refunded"), "PART_REFUNDED");
  assert.equal(mapProviderPaymentStatus("refunded"), "REFUNDED");
  assert.equal(mapProviderPaymentStatus("refund"), "REFUNDED");
});

test("tundmatu osaline kuju läheb samuti osaliseks, mitte täielikuks", () => {
  assert.equal(mapProviderPaymentStatus("transaction_part_refund_done"), "PART_REFUNDED");
  assert.equal(mapProviderPaymentStatus("transaction_refund_done"), "REFUNDED");
});

test("KANDEV: 0,01 € tagastus ei ole täistagastus", () => {
  const outcome = resolveRefundOutcome({
    payment: PAYMENT,
    payload: { refunded_amount: "0.01" },
    incomingStatus: "PART_REFUNDED"
  });
  assert.equal(outcome.status, "PART_REFUNDED");
  assert.equal(outcome.full, false);
  assert.equal(outcome.refundedAmount, "0.01");
});

test("KANDEV: kogu makset kattev osaline tagastus ON täistagastus", () => {
  const outcome = resolveRefundOutcome({
    payment: PAYMENT,
    payload: { refunded_amount: "7.99" },
    incomingStatus: "PART_REFUNDED"
  });
  assert.equal(outcome.status, "REFUNDED");
  assert.equal(outcome.full, true);
  assert.equal(outcome.reason, "refunds_cover_payment");
});

test("teine osaline tagastus koos esimesega võib katta kogu makse", () => {
  const first = resolveRefundOutcome({
    payment: PAYMENT,
    payload: { refunded_amount: "3.00" },
    incomingStatus: "PART_REFUNDED"
  });
  assert.equal(first.full, false);

  const second = resolveRefundOutcome({
    payment: { ...PAYMENT, refundedAmount: first.refundedAmount },
    payload: { refunded_amount: "7.99" },
    incomingStatus: "PART_REFUNDED"
  });
  assert.equal(second.full, true, "kumulatiivne summa katab makse");
});

test("provideri täistagastus on täistagastus ka ilma summata", () => {
  const outcome = resolveRefundOutcome({ payment: PAYMENT, payload: {}, incomingStatus: "REFUNDED" });
  assert.equal(outcome.status, "REFUNDED");
  assert.equal(outcome.full, true);
  assert.equal(outcome.refundedAmount, "7.99", "summa vaikimisi = kogu makse");
});

test("teadmata summaga osaline tagastus jääb osaliseks", () => {
  const outcome = resolveRefundOutcome({
    payment: PAYMENT,
    payload: {},
    incomingStatus: "PART_REFUNDED"
  });
  assert.equal(outcome.full, false, "teadmatus ei tohi lõpetada ligipääsu");
  assert.equal(outcome.refundedAmount, null);
  assert.equal(outcome.reason, "partial_amount_unknown");
});

test("tagastatud summa EI vähene korduse peale", () => {
  assert.equal(maxRefundedAmount("3.00", "1.00"), "3.00");
  assert.equal(maxRefundedAmount("1.00", "3.00"), "3.00");
  assert.equal(maxRefundedAmount(null, "1.00"), "1.00");
  assert.equal(maxRefundedAmount("1.00", null), "1.00");
  assert.equal(maxRefundedAmount(null, null), null);

  const outcome = resolveRefundOutcome({
    payment: { amount: "7.99", refundedAmount: "5.00" },
    payload: { refunded_amount: "1.00" },
    incomingStatus: "PART_REFUNDED"
  });
  assert.equal(outcome.refundedAmount, "5.00", "kordus väiksema summaga ei kahanda kogusummat");
});

test("osaliselt tagastatud makse tõrjub aegunud PAID teate", () => {
  assert.equal(isTerminalPaymentStatus("PART_REFUNDED"), true);
});

test("tagastatud summa loetakse ka refunds[] loendist", () => {
  assert.equal(extractRefundedAmount({ refunds: [{ amount: "1.50" }, { amount: "2.50" }] }), "4.00");
  assert.equal(extractRefundedAmount({ transaction: { refunds: [{ amount: "1.00" }] } }), "1.00");
  assert.equal(extractRefundedAmount({ refunded_amount: "2.00" }), "2.00");
  assert.equal(extractRefundedAmount({}), null, "puuduv summa on „ei tea“, mitte null eurot");
  assert.equal(extractRefundedAmount({ refunds: [] }), null);
});

test("mõlemad tagastuseseisud on tagastused", () => {
  assert.equal(isRefundStatus("REFUNDED"), true);
  assert.equal(isRefundStatus("PART_REFUNDED"), true);
  assert.equal(isRefundStatus("PAID"), false);
  assert.equal(isRefundStatus("CANCELED"), false);
});

/* LEPING: webhook peab otsust päriselt kasutama. */
test("webhook otsustab tagastuse enne kirjutamist ja osaline ei tühista", () => {
  const source = readFileSync(
    new URL("../../app/api/subscription/webhook/route.js", import.meta.url),
    "utf8"
  );
  assert.match(source, /resolveRefundOutcome\(/);
  assert.match(source, /effectiveStatus/);
  assert.match(source, /PART_REFUNDED_ACTION/);
  assert.match(
    source,
    /select:\s*\{[\s\S]*?amount:\s*true,[\s\S]*?currency:\s*true,[\s\S]*?refundedAmount:\s*true,[\s\S]*?raw:\s*true/
  );
  // Clawback ja tellimuse tühistus tohivad käia AINULT täistagastuse haru all.
  assert.match(source, /effectiveStatus === PaymentStatus\.REFUNDED\) \{/);
  assert.ok(
    !/nextStatus === PaymentStatus\.REFUNDED\) \{/.test(source),
    "vana kuju: otsus tehti mapitud seisu, mitte tagastuse ulatuse pealt"
  );
});

test("tagastusteade ei lähe „sama seis“ otseteed", () => {
  const source = readFileSync(
    new URL("../../app/api/subscription/webhook/route.js", import.meta.url),
    "utf8"
  );
  assert.match(source, /const sameStatus = payment\.status === nextStatus && !isRefundStatus\(nextStatus\)/);
});
