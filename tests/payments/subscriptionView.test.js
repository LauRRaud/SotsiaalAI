import test from "node:test";
import assert from "node:assert/strict";

import {
  serializeSubscription,
  SUBSCRIPTION_VIEW_STATES,
  isPlanRoleAnomaly,
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
