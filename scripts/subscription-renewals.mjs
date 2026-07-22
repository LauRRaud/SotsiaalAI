// Scheduler shim for the T09 renewals worker (repo-managed, OFF by default).
//
// POSTs /api/jobs/subscription-renewals with the renewal job key. All the real
// safety lives in the route: it is gated by SUBSCRIPTION_RECURRING_ENABLED and the
// job key, only charges due RECURRING+ACTIVE subscriptions with an ACTIVE billing
// method, and fail-closes per subscription when the token key is unavailable.
// This shim never touches the DB directly — it only triggers the gated endpoint.

const baseUrl = String(
  process.env.PAYMENT_JOB_BASE_URL || process.env.SUBSCRIPTION_RENEWAL_BASE_URL || "http://localhost:3000"
).trim();
const jobKey = String(process.env.SUBSCRIPTION_RENEWAL_JOB_KEY || "").trim();
const dryRun = /^(1|true|yes|on)$/i.test(String(process.env.SUBSCRIPTION_RENEWAL_DRY_RUN || "").trim());

if (!jobKey) {
  console.error("[subscription-renewals] Missing SUBSCRIPTION_RENEWAL_JOB_KEY");
  process.exit(1);
}

const url = new URL("/api/jobs/subscription-renewals", baseUrl);
if (dryRun) url.searchParams.set("dryRun", "1");

console.log(`[subscription-renewals] POST ${url.toString()}`);

const response = await fetch(url, {
  method: "POST",
  headers: {
    "x-subscription-renewal-key": jobKey
  }
}).catch((error) => {
  console.error(`[subscription-renewals] request failed: ${error?.message || error}`);
  process.exit(1);
});

const text = await response.text();
console.log(`[subscription-renewals] status=${response.status}`);
console.log(text);

// 503 = recurring billing disabled by config (SUBSCRIPTION_RECURRING_ENABLED off).
// That is a known "off" state, not a failure — don't spam systemd with failed runs.
if (response.status === 503) {
  console.log("[subscription-renewals] recurring disabled — nothing to do");
  process.exit(0);
}
if (!response.ok) {
  process.exit(1);
}
