import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  serializeSubscription,
  SUBSCRIPTION_VIEW_STATES,
  isPlanRoleAnomaly,
  isSponsoredBillingSource,
  expectedPlanDefinitionIdForRole,
  countPlanRoleAnomalies
} from "../../lib/subscriptionView.js";
import { PLAN_DEFINITION_IDS } from "../../lib/subscriptionPlans.js";

const NOW = new Date("2026-07-19T00:00:00.000Z").getTime();
const future = new Date(NOW + 10 * 24 * 60 * 60 * 1000);
const past = new Date(NOW - 24 * 60 * 60 * 1000);

test("active self subscription", () => {
  const view = serializeSubscription({ id: "s1", status: "ACTIVE", billingSource: "SELF", validUntil: future }, { now: NOW });
  assert.equal(view.state, SUBSCRIPTION_VIEW_STATES.ACTIVE);
  assert.equal(view.isActive, true);
  assert.equal(view.daysLeft, 10);
});

test("cancel-at-period-end stays active until validUntil", () => {
  const view = serializeSubscription(
    { id: "s1", status: "ACTIVE", billingSource: "SELF", validUntil: future, cancelAtPeriodEnd: true },
    { now: NOW }
  );
  assert.equal(view.state, SUBSCRIPTION_VIEW_STATES.CANCEL_AT_PERIOD_END);
  assert.equal(view.isActive, true, "paid access continues until validUntil");
  assert.equal(view.cancelAtPeriodEnd, true);
});

test("past due exposes retry window and is not presented as active", () => {
  const view = serializeSubscription(
    {
      id: "s1",
      status: "PAST_DUE",
      billingSource: "SELF",
      validUntil: past,
      pastDueSince: past,
      billingRetryCount: 1,
      nextBilling: future
    },
    { now: NOW }
  );
  assert.equal(view.state, SUBSCRIPTION_VIEW_STATES.PAST_DUE);
  assert.equal(view.isActive, false);
  assert.equal(view.isPastDue, true);
  assert.equal(view.willRetry, true);
  assert.ok(view.nextRetryAt, "shows next automatic attempt");
});

test("past due after max retries no longer promises a retry", () => {
  const view = serializeSubscription(
    { id: "s1", status: "PAST_DUE", billingSource: "SELF", validUntil: past, billingRetryCount: 3, nextBilling: future },
    { now: NOW }
  );
  assert.equal(view.willRetry, false);
  assert.equal(view.nextRetryAt, null);
});

test("passive expiry: active but validUntil elapsed reads as EXPIRED", () => {
  const view = serializeSubscription({ id: "s1", status: "ACTIVE", billingSource: "SELF", validUntil: past }, { now: NOW });
  assert.equal(view.state, SUBSCRIPTION_VIEW_STATES.EXPIRED);
  assert.equal(view.isActive, false);
});

test("canceled subscription reads as CANCELED", () => {
  const view = serializeSubscription({ id: "s1", status: "CANCELED", billingSource: "SELF", validUntil: past }, { now: NOW });
  assert.equal(view.state, SUBSCRIPTION_VIEW_STATES.CANCELED);
  assert.equal(view.isActive, false);
});

test("sponsored active and expired states", () => {
  const active = serializeSubscription(
    { id: "s1", status: "ACTIVE", billingSource: "SPONSORED_BY_HOST", validUntil: future },
    { now: NOW }
  );
  assert.equal(active.state, SUBSCRIPTION_VIEW_STATES.SPONSORED_ACTIVE);
  assert.equal(active.isSponsored, true);

  const soon = serializeSubscription(
    { id: "s1", status: "ACTIVE", billingSource: "SPONSORED_BY_HOST", validUntil: new Date(NOW + 3 * 24 * 60 * 60 * 1000) },
    { now: NOW }
  );
  assert.equal(soon.sponsorEndsSoon, true);

  const expired = serializeSubscription(
    { id: "s1", status: "ACTIVE", billingSource: "SPONSORED_BY_HOST", validUntil: past },
    { now: NOW }
  );
  assert.equal(expired.state, SUBSCRIPTION_VIEW_STATES.SPONSORED_EXPIRED);
  assert.equal(expired.sponsorExpired, true);
});

/**
 * SOL-ORG-07 — KAKS SPONSORLUSALLIKAT, ÜKS MÕISTE.
 *
 * `SPONSORED_BY_ORGANIZATION` lisandus T25 E5-ga, aga keskne serialiseerija
 * tundis ainult `SPONSORED_BY_HOST`-i. Organisatsiooni makstud pöörduja seis jäi
 * tavaliseks `ACTIVE`-ks: vale maksja, puuduv lõpuhoiatus ja tühistamisnupp, mis
 * päris tellimust ei muuda — server puudutab ainult `SELF` ridu. **Vale nupp on
 * halvem kui puuduv nupp.**
 */
test("organisatsiooni sponsorlus on sponsorlus — aktiivne, lõppev ja aegunud", () => {
  const active = serializeSubscription(
    { id: "s1", status: "ACTIVE", billingSource: "SPONSORED_BY_ORGANIZATION", validUntil: future },
    { now: NOW }
  );
  assert.equal(active.state, SUBSCRIPTION_VIEW_STATES.SPONSORED_ACTIVE);
  assert.equal(active.isSponsored, true);
  assert.equal(active.sponsorKind, "ORGANIZATION", "UI peab saama küsida, KES maksab");

  const soon = serializeSubscription(
    {
      id: "s1",
      status: "ACTIVE",
      billingSource: "SPONSORED_BY_ORGANIZATION",
      validUntil: new Date(NOW + 3 * 24 * 60 * 60 * 1000)
    },
    { now: NOW }
  );
  assert.equal(soon.sponsorEndsSoon, true, "lõpuhoiatus peab tulema ka organisatsiooni rahastusel");

  const expired = serializeSubscription(
    { id: "s1", status: "ACTIVE", billingSource: "SPONSORED_BY_ORGANIZATION", validUntil: past },
    { now: NOW }
  );
  assert.equal(expired.state, SUBSCRIPTION_VIEW_STATES.SPONSORED_EXPIRED);
  assert.equal(expired.sponsorExpired, true);
});

/* Sponsori LIIK jääb alles, aga „kas sponsoreeritud" on üks otsus. */
test("sponsorKind eristab allikad, isSponsored ühendab nad", () => {
  const kinds = ["SPONSORED_BY_HOST", "SPONSORED_BY_ORGANIZATION", "SELF", "", null];
  const seen = kinds.map((billingSource) =>
    serializeSubscription({ id: "s1", status: "ACTIVE", billingSource, validUntil: future }, { now: NOW })
  );
  assert.deepEqual(seen.map((view) => view.sponsorKind), ["HOST", "ORGANIZATION", null, null, null]);
  assert.deepEqual(seen.map((view) => view.isSponsored), [true, true, false, false, false]);
  assert.deepEqual(
    seen.map((view) => view.state),
    [
      SUBSCRIPTION_VIEW_STATES.SPONSORED_ACTIVE,
      SUBSCRIPTION_VIEW_STATES.SPONSORED_ACTIVE,
      SUBSCRIPTION_VIEW_STATES.ACTIVE,
      SUBSCRIPTION_VIEW_STATES.ACTIVE,
      SUBSCRIPTION_VIEW_STATES.ACTIVE
    ]
  );
});

/**
 * SOL-ORG-07 lõppnõue: „kasutaja ei näe mittetoimivat omamakse tühistamist."
 *
 * Liides peidab tühistamisnupu `isSponsored` järgi; server puudutab tühistusel
 * AINULT `billingSource: "SELF"` ridu (`app/api/subscription/route.js` DELETE).
 * Kui need kaks lahku lähevad, tekib nupp, mis midagi ei tee.
 *
 * See test loeb `BillingSource` enum'i SKEEMIST, mitte käsitsi kirjutatud
 * loendist: uus maksjaallikas, mida keegi ei registreeri sponsorluseks, kukutab
 * selle testi — mitte kasutaja nuppu.
 */
test("iga maksjaallikas peale SELF-i on serialiseerijale sponsorlus", () => {
  const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");
  const block = schema.match(/enum BillingSource \{[\s\S]*?\n\}/)?.[0] || "";
  const values = block
    .split("\n")
    .slice(1, -1)
    .map((line) => line.replace(/\/\/.*$/, "").trim())
    .filter((line) => /^[A-Z_]+$/.test(line));

  assert.ok(values.includes("SELF"), "enum peab olema loetud");
  assert.ok(values.length >= 3, `loetud väärtusi: ${values.join(", ")}`);
  for (const value of values) {
    assert.equal(
      isSponsoredBillingSource(value),
      value !== "SELF",
      `${value}: tühistusnupu peitmine ja serveri kirjutusfilter peavad kokku langema`
    );
  }
});

test("plan/role anomaly indicator flags mismatched active self plan only", () => {
  assert.equal(expectedPlanDefinitionIdForRole("CLIENT"), PLAN_DEFINITION_IDS.client_monthly);
  assert.equal(
    isPlanRoleAnomaly({ status: "ACTIVE", billingSource: "SELF", planDefinitionId: PLAN_DEFINITION_IDS.admin_internal, user: { role: "CLIENT" } }),
    true
  );
  assert.equal(
    isPlanRoleAnomaly({ status: "ACTIVE", billingSource: "SELF", planDefinitionId: PLAN_DEFINITION_IDS.client_monthly, user: { role: "CLIENT" } }),
    false
  );
  // sponsored and non-active are ignored
  assert.equal(
    isPlanRoleAnomaly({ status: "ACTIVE", billingSource: "SPONSORED_BY_HOST", planDefinitionId: PLAN_DEFINITION_IDS.admin_internal, user: { role: "CLIENT" } }),
    false
  );
  /* SOL-ORG-07: sponsoreeritud paketi määrab leping, mitte inimese roll —
     kumbki allikas ei ole anomaalia. */
  assert.equal(
    isPlanRoleAnomaly({ status: "ACTIVE", billingSource: "SPONSORED_BY_ORGANIZATION", planDefinitionId: PLAN_DEFINITION_IDS.admin_internal, user: { role: "CLIENT" } }),
    false
  );
});

test("countPlanRoleAnomalies aggregates without exposing user info", async () => {
  const db = {
    subscription: {
      async findMany() {
        return [
          { planDefinitionId: PLAN_DEFINITION_IDS.client_monthly, user: { role: "CLIENT" } },
          { planDefinitionId: PLAN_DEFINITION_IDS.service_provider_monthly, user: { role: "CLIENT" } },
          { planDefinitionId: PLAN_DEFINITION_IDS.social_worker_monthly, user: { role: "SOCIAL_WORKER" } }
        ];
      }
    }
  };
  const result = await countPlanRoleAnomalies(db, { now: new Date(NOW) });
  assert.deepEqual(result, { checked: 3, anomalies: 1 });
});
