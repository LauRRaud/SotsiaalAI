import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  canonicalCurrency,
  canonicalMoney,
  describeMismatches,
  expectedKindForFlow,
  parseMerchantData,
  verifyPaidPayload
} from "../../lib/payments/paymentVerification.js";

/* SOL-PAY-05 — ALLKIRI TÕENDAB PÄRITOLU, MITTE SUMMAT.

   `PAID` otsuseks piisas kehtivast MAC-ist, leitavast viitest ja PAID-iks
   mapitavast staatusest. Summa ja valuuta on `Payment` real olemas, aga neid ei
   loetud ega võrreldud. Kriteerium nõuab, et iga väli oleks ERALDI testitud —
   üks kõikehõlmav „vale payload" test ei ütleks, milline võrdlus päriselt töötab. */

const PAYMENT = {
  id: "pay_1",
  subscriptionId: "sub_1",
  providerPaymentId: "mk_ref_1",
  amount: "7.99",
  currency: "EUR",
  kind: "SUBSCRIPTION_INITIAL"
};

function payload(overrides = {}) {
  const base = {
    reference: "mk_ref_1",
    status: "PAID",
    amount: "7.99",
    currency: "EUR",
    merchant_data: JSON.stringify({
      flow: "subscription_init",
      paymentId: "pay_1",
      subscriptionId: "sub_1"
    })
  };
  return { ...base, ...overrides };
}

function fieldsOf(result) {
  return result.mismatches.map(entry => entry.field);
}

test("kanooniline rahakuju on kümnendvõrdlus, mitte ujukoma", () => {
  assert.equal(canonicalMoney("7.99"), "7.99");
  assert.equal(canonicalMoney("7.9"), "7.90");
  assert.equal(canonicalMoney("7"), "7.00");
  assert.equal(canonicalMoney("07.99"), "7.99");
  assert.equal(canonicalMoney("7.990"), "7.99", "lõpunullid ei ole erinevus");
  assert.equal(canonicalMoney("7,99"), "7.99", "koma kümnenderaldajana");
  assert.equal(canonicalMoney(" 7.99 "), "7.99");
  assert.equal(canonicalMoney(7.99), "7.99");
  assert.equal(canonicalMoney("0"), "0.00");
  assert.equal(canonicalMoney("-7.99"), "-7.99");
  // Prisma Decimal tuleb objektina, mille `toString()` annab täpse kuju.
  assert.equal(canonicalMoney({ toString: () => "7.99" }), "7.99");
});

test("kanooniline rahakuju keeldub sellest, mida ta ei saa tõeselt esitada", () => {
  assert.equal(canonicalMoney("7.999"), null, "ümardamine oleks vaikne summa muutmine");
  assert.equal(canonicalMoney("abc"), null);
  assert.equal(canonicalMoney(""), null);
  assert.equal(canonicalMoney(null), null);
  assert.equal(canonicalMoney("7.99 EUR"), null);
});

test("valuuta on kolm tähte või mitte midagi", () => {
  assert.equal(canonicalCurrency("eur"), "EUR");
  assert.equal(canonicalCurrency(" EUR "), "EUR");
  assert.equal(canonicalCurrency("EURO"), null);
  assert.equal(canonicalCurrency(""), null);
});

test("täpselt vastav sõnum läheb läbi", () => {
  const result = verifyPaidPayload({ payment: PAYMENT, payload: payload() });
  assert.equal(result.ok, true, JSON.stringify(result.mismatches));
});

test("KANDEV: väiksem summa EI ole vastavus", () => {
  const result = verifyPaidPayload({ payment: PAYMENT, payload: payload({ amount: "0.01" }) });
  assert.equal(result.ok, false);
  assert.deepEqual(fieldsOf(result), ["amount"]);
  assert.equal(result.mismatches[0].expected, "7.99");
  assert.equal(result.mismatches[0].actual, "0.01");
});

test("KANDEV: puuduv summa ei ole vaikimisi vastavus", () => {
  const withoutAmount = payload();
  delete withoutAmount.amount;
  const result = verifyPaidPayload({ payment: PAYMENT, payload: withoutAmount });
  assert.equal(result.ok, false);
  assert.deepEqual(fieldsOf(result), ["amount"], "muidu saaks kontrollist mööda välja ära jättes");
});

test("teine valuuta on mittevastavus", () => {
  const result = verifyPaidPayload({ payment: PAYMENT, payload: payload({ currency: "USD" }) });
  assert.equal(result.ok, false);
  assert.deepEqual(fieldsOf(result), ["currency"]);
});

test("võõras viide on mittevastavus", () => {
  const result = verifyPaidPayload({ payment: PAYMENT, payload: payload({ reference: "mk_ref_2" }) });
  assert.equal(result.ok, false);
  assert.deepEqual(fieldsOf(result), ["reference"]);
});

test("merchant_data võõras makse-ID on mittevastavus", () => {
  const result = verifyPaidPayload({
    payment: PAYMENT,
    payload: payload({
      merchant_data: JSON.stringify({ flow: "subscription_init", paymentId: "pay_2", subscriptionId: "sub_1" })
    })
  });
  assert.equal(result.ok, false);
  assert.deepEqual(fieldsOf(result), ["merchantData.paymentId"]);
});

test("merchant_data võõras tellimuse-ID on mittevastavus", () => {
  const result = verifyPaidPayload({
    payment: PAYMENT,
    payload: payload({
      merchant_data: JSON.stringify({ flow: "subscription_init", paymentId: "pay_1", subscriptionId: "sub_2" })
    })
  });
  assert.equal(result.ok, false);
  assert.deepEqual(fieldsOf(result), ["merchantData.subscriptionId"]);
});

test("vale makseliik on mittevastavus", () => {
  const result = verifyPaidPayload({
    payment: PAYMENT,
    payload: payload({
      merchant_data: JSON.stringify({ flow: "invite_sponsored_init", paymentId: "pay_1" })
    })
  });
  assert.equal(result.ok, false);
  assert.deepEqual(fieldsOf(result), ["kind"]);
});

test("puuduv merchant_data ei ole tõend millegi vastu", () => {
  const withoutMerchantData = payload();
  delete withoutMerchantData.merchant_data;
  const result = verifyPaidPayload({ payment: PAYMENT, payload: withoutMerchantData });
  assert.equal(result.ok, true, "kõik sõnumitüübid teda ei kanna");
});

test("mitu viga korraga on kõik loetletud, mitte esimene", () => {
  const result = verifyPaidPayload({
    payment: PAYMENT,
    payload: payload({ amount: "1.00", currency: "USD", reference: "mk_ref_9" })
  });
  assert.equal(result.ok, false);
  assert.deepEqual(fieldsOf(result), ["amount", "currency", "reference"]);
  assert.equal(describeMismatches(result.mismatches), "amount,currency,reference");
});

test("pesastatud transaction-kuju loetakse samamoodi", () => {
  const nested = {
    transaction: { reference: "mk_ref_1", amount: "7.99", currency: "EUR" }
  };
  assert.equal(verifyPaidPayload({ payment: PAYMENT, payload: nested }).ok, true);
});

test("merchant_data võib tulla nii sõne kui objektina", () => {
  assert.deepEqual(parseMerchantData({ merchant_data: '{"flow":"x"}' }), { flow: "x" });
  assert.deepEqual(parseMerchantData({ merchant_data: { flow: "x" } }), { flow: "x" });
  assert.equal(parseMerchantData({ merchant_data: "not json" }), null);
  assert.equal(parseMerchantData({}), null);
});

test("flow → oodatud makseliik", () => {
  assert.equal(expectedKindForFlow("subscription_init"), "SUBSCRIPTION_INITIAL");
  assert.equal(expectedKindForFlow("subscription_renewal_job"), "SUBSCRIPTION_RENEWAL");
  assert.equal(expectedKindForFlow("invite_sponsored_init"), "INVITE_SPONSORED");
  assert.equal(expectedKindForFlow("tundmatu"), null);
});

/* LEPING: kontroll peab olema webhookis ENNE õiguse andmist. */
test("webhook kontrollib sõnumit enne PAID üleminekut", () => {
  const source = readFileSync(
    new URL("../../app/api/subscription/webhook/route.js", import.meta.url),
    "utf8"
  );
  assert.match(source, /verifyPaidPayload\(/);
  assert.match(source, /PaymentStatus\.REVIEW_REQUIRED/);
  assert.match(source, /amount: true/, "summa peab olema lukustatud select'is");
  assert.match(source, /currency: true/);

  const verifyIndex = source.indexOf("verifyPaidPayload(");
  const activateIndex = source.indexOf("activateSubscriptionFromPayment(");
  assert.ok(verifyIndex > 0 && activateIndex > verifyIndex, "kontroll peab tulema enne aktiveerimist");
});

test("ülevaatust ootav makse ei ole automaatika lahendada", () => {
  const outcome = readFileSync(new URL("../../lib/payments/providerOutcome.js", import.meta.url), "utf8");
  assert.match(outcome, /RENEWAL_BLOCKING_STATUSES/);
  assert.match(outcome, /REVIEW_REQUIRED/);

  const reconcile = readFileSync(new URL("../../lib/payments/reconcile.js", import.meta.url), "utf8");
  assert.ok(
    !/REVIEW_REQUIRED/.test(reconcile),
    "reconciliation küsiks providerilt sama PAID-i, mis kontrolli kukutas"
  );
});
