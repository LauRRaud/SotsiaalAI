import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildRenewalFailureSubscriptionUpdate,
  computeNextRetryAt,
  getDueRecurringSubscriptionWhere,
  getRecurringMaxRetryCount,
  getUnresolvedRenewalSubscriptionWhere,
  planRenewalFailure,
  shouldCancelAfterRetryCount
} from "../../lib/payments/recurring.js";

/* SOL-PAY-01 — RETRY-SEIS PEAB OLEMA VALITAV.

   Vana valik nõudis `status: ACTIVE` JA maksemeetodit `ACTIVE`, aga esimese
   tõrke käsitlus muutis tellimuse `PAST_DUE`-ks ja meetodi `FAILED`-iks. Kogu
   korduskatse masinavärk — päevagraafik, katsete loendur, lõplik cancel — oli
   seetõttu surnud kood: server ei valinud seda tellimust enam KUNAGI.

   Vana test lukustas just selle vea (`assert.equal(where.status, "ACTIVE")`) ja
   on ümber kirjutatud.

   `matchesWhere` on tahtlikult kitsas ja MODELLEERIB neid operaatoreid, mida
   valik päriselt kasutab — läbilaskev matcher tõendaks siin iseennast. */

function matchesWhere(where, row) {
  for (const [key, value] of Object.entries(where)) {
    if (key === "OR") {
      if (!value.some(branch => matchesWhere(branch, row))) return false;
      continue;
    }
    if (key === "billingMethod") {
      if (!row.billingMethod) return false;
      if (!matchesWhere(value, row.billingMethod)) return false;
      continue;
    }
    if (key === "payments") {
      const rows = row.payments || [];
      if (value.none && rows.some(payment => matchesWhere(value.none, payment))) return false;
      if (value.some && !rows.some(payment => matchesWhere(value.some, payment))) return false;
      continue;
    }
    if (key === "status" && value && typeof value === "object" && Array.isArray(value.in)) {
      if (!value.in.includes(row.status)) return false;
      continue;
    }
    const actual = row[key];
    if (value && typeof value === "object" && !(value instanceof Date)) {
      const time = candidate => (candidate instanceof Date ? candidate.getTime() : candidate);
      if ("lte" in value && !(actual != null && time(actual) <= time(value.lte))) return false;
      if ("lt" in value && !(actual != null && time(actual) < time(value.lt))) return false;
      continue;
    }
    if (value === null) {
      if (actual != null) return false;
      continue;
    }
    if (actual !== value) return false;
  }
  return true;
}

const NOW = new Date("2026-07-19T00:00:00.000Z");

function subscriptionRow(overrides = {}) {
  return {
    status: "ACTIVE",
    billingMode: "RECURRING",
    billingInterval: "MONTHLY",
    cancelAtPeriodEnd: false,
    billingRetryCount: 0,
    nextBilling: new Date("2026-07-18T00:00:00.000Z"),
    billingMethod: { status: "ACTIVE", provider: "MAKSEKESKUS" },
    payments: [],
    ...overrides
  };
}

test("renewal selection excludes cancel-at-period-end subscriptions (O-M4)", () => {
  const where = getDueRecurringSubscriptionWhere(NOW);
  assert.equal(where.cancelAtPeriodEnd, false);
  assert.equal(where.billingMode, "RECURRING");
  assert.equal(where.billingMethod.status, "ACTIVE");
  assert.equal(matchesWhere(where, subscriptionRow({ cancelAtPeriodEnd: true })), false);
});

test("retry schedule advances and cancels after the max retry count", () => {
  const failedAt = new Date("2026-07-19T00:00:00.000Z");
  const firstRetry = computeNextRetryAt(failedAt, 0);
  const secondRetry = computeNextRetryAt(failedAt, 1);
  assert.ok(secondRetry > firstRetry, "later retries are scheduled further out");
  assert.equal(shouldCancelAfterRetryCount(0), false);
  assert.equal(shouldCancelAfterRetryCount(3), true);
});

test("SOL-PAY-01: tavaline tähtaeg valitakse endiselt", () => {
  const where = getDueRecurringSubscriptionWhere(NOW);
  assert.equal(matchesWhere(where, subscriptionRow()), true);
  assert.equal(matchesWhere(where, subscriptionRow({ nextBilling: null })), true);
  assert.equal(
    matchesWhere(where, subscriptionRow({ nextBilling: new Date("2026-07-20T00:00:00.000Z") })),
    false,
    "tulevikus olev tähtaeg ei ole veel käes"
  );
});

test("SOL-PAY-01: PAST_DUE tellimus, mille korduskatse aeg on käes, VALITAKSE", () => {
  const where = getDueRecurringSubscriptionWhere(NOW);

  const row = subscriptionRow({
    status: "PAST_DUE",
    billingRetryCount: 1,
    nextBilling: new Date("2026-07-18T12:00:00.000Z")
  });

  assert.equal(matchesWhere(where, row), true, "vana valik ei näinud seda rida kunagi");
});

test("SOL-PAY-01: lae täis katsetega PAST_DUE tellimust enam ei valita", () => {
  const where = getDueRecurringSubscriptionWhere(NOW);
  const row = subscriptionRow({
    status: "PAST_DUE",
    billingRetryCount: getRecurringMaxRetryCount(),
    nextBilling: new Date("2026-07-18T12:00:00.000Z")
  });

  assert.equal(matchesWhere(where, row), false);
});

test("SOL-PAY-01: korduskatse aeg peab olema käes, mitte ainult olemas", () => {
  const where = getDueRecurringSubscriptionWhere(NOW);
  const row = subscriptionRow({
    status: "PAST_DUE",
    billingRetryCount: 1,
    nextBilling: new Date("2026-07-25T00:00:00.000Z")
  });

  assert.equal(matchesWhere(where, row), false);
});

test("SOL-PAY-01: üks tõrge ei märgi maksemeetodit katkiseks", () => {
  const plan = planRenewalFailure({ retryCountBefore: 0, failedAt: NOW });

  assert.equal(plan.cancel, false);
  assert.equal(plan.subscriptionStatus, "PAST_DUE");
  assert.equal(
    plan.billingMethodStatus,
    null,
    "meetod jääb kasutatavaks, muidu lukustaks ta enda korduskatse välja"
  );
  assert.ok(plan.nextRetryAt instanceof Date);
});

test("SOL-PAY-01: kogu jada failure #1 → retry #2 → retry #3 → cancel jookseb lõpuni", () => {
  const where = getDueRecurringSubscriptionWhere(new Date("2026-08-30T00:00:00.000Z"));
  const seen = [];
  let row = subscriptionRow();
  let attempts = 0;

  // Iga ring: tellimus PEAB olema valitav, siis kukub katse ja seis liigub edasi.
  while (matchesWhere(where, row) && attempts < 10) {
    attempts += 1;
    const plan = planRenewalFailure({
      retryCountBefore: row.billingRetryCount,
      failedAt: NOW
    });
    seen.push(plan.subscriptionStatus);
    row = {
      ...row,
      status: plan.subscriptionStatus,
      billingRetryCount: plan.retryCount,
      nextBilling: plan.cancel ? row.nextBilling : plan.nextRetryAt,
      billingMethod: plan.billingMethodStatus
        ? { ...row.billingMethod, status: plan.billingMethodStatus }
        : row.billingMethod
    };
  }

  assert.equal(attempts, getRecurringMaxRetryCount(), "iga lubatud katse jõuab päriselt kohale");
  assert.deepEqual(seen, ["PAST_DUE", "PAST_DUE", "CANCELED"]);
  assert.equal(row.billingMethod.status, "FAILED", "meetod märgitakse katkiseks alles loobumisel");
  assert.equal(matchesWhere(where, row), false, "tühistatud tellimust ei valita enam");
});

/* SOL-PAY-02 — TEADMATA TULEMUSEGA KATSET EI KORRATA.

   Ebamäärane providerikutse (timeout, 5xx, katkenud võrk) võis raha juba võtta.
   Kui valik seda ei arvesta, laeb järgmine jooks sama kuu eest teist korda. */

test("SOL-PAY-02: lahendamata katsega tellimust ei valita uuesti", () => {
  const where = getDueRecurringSubscriptionWhere(NOW);
  const row = subscriptionRow({ payments: [{ status: "RECONCILE_PENDING" }] });

  assert.equal(matchesWhere(where, row), false);
});

test("SOL-PAY-02: lahendatud katsed ei blokeeri midagi", () => {
  const where = getDueRecurringSubscriptionWhere(NOW);
  const row = subscriptionRow({
    payments: [{ status: "PAID" }, { status: "FAILED" }, { status: "INITIATED" }]
  });

  assert.equal(matchesWhere(where, row), true);
});

test("SOL-PAY-02: kinni jäänud tellimused on eraldi loetavad, mitte vaikne vahelejätt", () => {
  const blockedWhere = getUnresolvedRenewalSubscriptionWhere(NOW);
  const blocked = subscriptionRow({ payments: [{ status: "RECONCILE_PENDING" }] });
  const normal = subscriptionRow();

  assert.equal(matchesWhere(blockedWhere, blocked), true);
  assert.equal(matchesWhere(blockedWhere, normal), false);
});

/* SOL-PAY-01/-02: tõrke tagajärg ei tohi sõltuda sellest, KUMB rada ta avastas. */
test("tõrke tagajärg on sama kuju mõlemal rajal", () => {
  const failedAt = new Date("2026-07-19T00:00:00.000Z");
  const currentNextBilling = new Date("2026-07-18T00:00:00.000Z");

  const retry = buildRenewalFailureSubscriptionUpdate(
    planRenewalFailure({ retryCountBefore: 0, failedAt }),
    { failedAt, currentNextBilling }
  );
  assert.equal(retry.status, "PAST_DUE");
  assert.equal(retry.billingRetryCount, 1);
  assert.ok(retry.nextBilling > failedAt, "järgmine katse on TULEVIKUS, mitte kohe");
  assert.equal(retry.canceledAt, undefined);

  const giveUp = buildRenewalFailureSubscriptionUpdate(
    planRenewalFailure({ retryCountBefore: getRecurringMaxRetryCount() - 1, failedAt }),
    { failedAt, currentNextBilling }
  );
  assert.equal(giveUp.status, "CANCELED");
  assert.equal(giveUp.nextBilling, currentNextBilling, "loobumisel ei ajastata uut katset");
  assert.equal(giveUp.canceledAt, failedAt);
});

test("webhooki tõrkeharu kasutab sama otsust, mitte oma loendurikasvatust", () => {
  const source = readFileSync(
    new URL("../../app/api/subscription/webhook/route.js", import.meta.url),
    "utf8"
  );
  assert.match(source, /planRenewalFailure\(/);
  assert.match(source, /buildRenewalFailureSubscriptionUpdate\(/);
  assert.ok(
    !/billingRetryCount:\s*\{\s*\n?\s*increment:/.test(source),
    "vana kuju: ainult loenduri kasv, nextBilling jäi minevikku → kohene uus laadimine"
  );
});

test("SOL-PAY-01: õnnestunud katse järel on tellimus jälle tavaline", () => {
  const where = getDueRecurringSubscriptionWhere(new Date("2026-09-20T00:00:00.000Z"));
  // `activateSubscriptionFromPayment` teeb täpselt selle: ACTIVE, loendur 0,
  // pastDueSince null, nextBilling = uus periood.
  const recovered = subscriptionRow({
    status: "ACTIVE",
    billingRetryCount: 0,
    nextBilling: new Date("2026-09-19T00:00:00.000Z")
  });

  assert.equal(matchesWhere(where, recovered), true);
});
