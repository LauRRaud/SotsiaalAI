import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  PaymentFailureStage,
  classifyPaymentFailure,
  isNeverSentProviderError,
  isProviderConfirmedRejection,
  isTerminalPaymentStatus,
  isUnresolvedPaymentStatus
} from "../../lib/payments/providerOutcome.js";

/* SOL-PAY-02 — EBAMÄÄRANE TULEMUS EI OLE EITUS.

   Kolm makseraja `catch`-i märkisid iga erandi peale makse `FAILED`-iks ja
   webhook loeb `FAILED` lõplikuks. Provider võis makse vastu võtta; hilisem PAID
   kinnitati 200-ga ja visati ära. Selle testi kandev väide ei ole „klassifikaator
   tagastab stringe", vaid see, et TERMINAALSEKS läheb ainult siis, kui raha
   kindlasti ei liikunud või provider ütles ise ära. */

function providerError(status) {
  const error = new Error("provider said no");
  error.status = status;
  return error;
}

test("timeout/abort ilma HTTP-vastuseta jääb lahtiseks", () => {
  const abort = Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
  const outcome = classifyPaymentFailure({
    stage: PaymentFailureStage.PROVIDER_CALL,
    error: abort
  });
  assert.equal(outcome.status, "RECONCILE_PENDING");
  assert.equal(outcome.terminal, false);
  assert.equal(outcome.providerConfirmed, false);
  assert.equal(outcome.reason, "provider_ambiguous");
});

test("võrguviga (fetch failed) jääb lahtiseks", () => {
  const outcome = classifyPaymentFailure({
    stage: PaymentFailureStage.PROVIDER_CALL,
    error: new TypeError("fetch failed")
  });
  assert.equal(outcome.status, "RECONCILE_PENDING");
});

test("provideri 5xx jääb lahtiseks — tema enda tõrge ei ütle tulemust", () => {
  for (const status of [500, 502, 503, 504]) {
    const outcome = classifyPaymentFailure({
      stage: PaymentFailureStage.PROVIDER_CALL,
      error: providerError(status)
    });
    assert.equal(outcome.status, "RECONCILE_PENDING", `HTTP ${status}`);
  }
});

test("408/409/429 on 4xx, aga nad EI ütle „ei“", () => {
  for (const status of [408, 409, 423, 425, 429]) {
    assert.equal(isProviderConfirmedRejection(providerError(status)), false, `HTTP ${status}`);
    assert.equal(
      classifyPaymentFailure({ stage: PaymentFailureStage.PROVIDER_CALL, error: providerError(status) })
        .status,
      "RECONCILE_PENDING",
      `HTTP ${status}`
    );
  }
});

test("selge 4xx on providerilt kinnitatud eitus → terminaalne FAILED", () => {
  for (const status of [400, 401, 402, 403, 404, 422]) {
    const outcome = classifyPaymentFailure({
      stage: PaymentFailureStage.PROVIDER_CALL,
      error: providerError(status)
    });
    assert.equal(outcome.status, "FAILED", `HTTP ${status}`);
    assert.equal(outcome.terminal, true);
    assert.equal(outcome.providerConfirmed, true);
    assert.equal(outcome.reason, "provider_rejected");
  }
});

test("puuduv konfiguratsioon: kutset ei toimunud, seega FAILED on aus", () => {
  for (const message of [
    "api.subscription.provider_unavailable",
    "api.subscription.recurring_provider_unavailable",
    "api.subscription.recurring_token_missing"
  ]) {
    const error = new Error(message);
    assert.equal(isNeverSentProviderError(error), true, message);
    const outcome = classifyPaymentFailure({ stage: PaymentFailureStage.PROVIDER_CALL, error });
    assert.equal(outcome.status, "FAILED", message);
    assert.equal(outcome.providerConfirmed, false, "see EI ole providerilt kinnitatud eitus");
    assert.equal(outcome.reason, "not_sent");
  }
});

test("meie oma viga PÄRAST providerikutset ei ole kunagi eitus", () => {
  // Prisma P2002 on selge „meie pool", aga tehing on provideri pool juba olemas.
  const dbError = Object.assign(new Error("Unique constraint failed"), { code: "P2002", status: 409 });
  const outcome = classifyPaymentFailure({
    stage: PaymentFailureStage.AFTER_PROVIDER,
    error: dbError
  });
  assert.equal(outcome.status, "RECONCILE_PENDING");
  assert.equal(outcome.reason, "local_after_provider");
});

test("AFTER_PROVIDER ei muutu terminaalseks ka providerilt näiva 4xx erindi peale", () => {
  const outcome = classifyPaymentFailure({
    stage: PaymentFailureStage.AFTER_PROVIDER,
    error: providerError(400)
  });
  assert.equal(outcome.status, "RECONCILE_PENDING", "etapp otsustab, mitte erindi kuju");
});

test("tundmatu viga on vaikimisi lahtine, mitte lõplik", () => {
  const outcome = classifyPaymentFailure({ stage: PaymentFailureStage.PROVIDER_CALL, error: {} });
  assert.equal(outcome.status, "RECONCILE_PENDING");
});

test("lõplikkuse ja lahtisuse definitsioonid ei kattu", () => {
  assert.equal(isTerminalPaymentStatus("PAID"), true);
  assert.equal(isTerminalPaymentStatus("FAILED"), true);
  assert.equal(isTerminalPaymentStatus("CANCELED"), true);
  assert.equal(isTerminalPaymentStatus("REFUNDED"), true);
  assert.equal(isTerminalPaymentStatus("PART_REFUNDED"), true);
  assert.equal(isTerminalPaymentStatus("RECONCILE_PENDING"), false, "kogu leiu mõte");
  assert.equal(isTerminalPaymentStatus("INITIATED"), false);
  assert.equal(isUnresolvedPaymentStatus("RECONCILE_PENDING"), true);
  assert.equal(isUnresolvedPaymentStatus("INITIATED"), true);
  assert.equal(isUnresolvedPaymentStatus("PAID"), false);
});

/* NEGATIIVKONTROLL LEPINGU TASEMEL. Vana kuju oli täpselt üks rida —
   `status: PaymentStatus.FAILED` tingimusteta `catch`-is. Kõik kolm rada peavad
   nüüd klassifikaatorit kasutama; kui keegi selle tagasi keerab, kukub see test,
   mitte alles päris makse. */
const ROUTES_WITH_PROVIDER_CALLS = [
  "app/api/subscription/init/route.js",
  "app/api/jobs/subscription-renewals/route.js",
  "app/api/invites/sponsored/init/route.js"
];

test("kõik kolm providerikutsega marsruuti klassifitseerivad tõrke", () => {
  for (const file of ROUTES_WITH_PROVIDER_CALLS) {
    const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
    assert.match(source, /classifyPaymentFailure\(/, file);
    assert.match(source, /PaymentFailureStage\.AFTER_PROVIDER/, file);
    assert.ok(
      !/status:\s*PaymentStatus\.FAILED,?\s*\n\s*(failedAt|raw)/.test(source) ||
        /outcome\.terminal/.test(source),
      `${file}: tingimusteta FAILED on tagasi`
    );
  }
});

test("webhook ei pea RECONCILE_PENDING seisu lõplikuks", () => {
  const source = readFileSync(
    new URL("../../app/api/subscription/webhook/route.js", import.meta.url),
    "utf8"
  );
  assert.match(source, /isTerminalPaymentStatus/);
  assert.ok(
    !/FINAL_STATUSES\s*=\s*new Set/.test(source),
    "lõplikkuse loend ei tohi olla webhooki lokaalne koopia"
  );
});
