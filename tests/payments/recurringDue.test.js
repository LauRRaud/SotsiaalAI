import test from "node:test";
import assert from "node:assert/strict";

import {
  getDueRecurringSubscriptionWhere,
  computeNextRetryAt,
  shouldCancelAfterRetryCount
} from "../../lib/payments/recurring.js";

test("renewal selection excludes cancel-at-period-end subscriptions (O-M4)", () => {
  const where = getDueRecurringSubscriptionWhere(new Date("2026-07-19T00:00:00.000Z"));
  assert.equal(where.cancelAtPeriodEnd, false);
  assert.equal(where.status, "ACTIVE");
  assert.equal(where.billingMode, "RECURRING");
  assert.equal(where.billingMethod.status, "ACTIVE");
});

test("retry schedule advances and cancels after the max retry count", () => {
  const failedAt = new Date("2026-07-19T00:00:00.000Z");
  const firstRetry = computeNextRetryAt(failedAt, 0);
  const secondRetry = computeNextRetryAt(failedAt, 1);
  assert.ok(secondRetry > firstRetry, "later retries are scheduled further out");
  assert.equal(shouldCancelAfterRetryCount(0), false);
  assert.equal(shouldCancelAfterRetryCount(3), true);
});
