// Scheduler shim for the T09 reconciliation worker (repo-managed, OFF by default).
//
// POSTs /api/jobs/subscription-reconcile with the reconcile job key. All the real
// safety lives in the route + lib/payments/reconcile.js: it is gated by
// SUBSCRIPTION_RECONCILE_ENABLED, only touches expired INITIATED payments, and never
// marks a payment PAID without a verified provider result (SUBSCRIPTION_RECONCILE_QUERY_PROVIDER).
// This shim never touches the DB directly — it only triggers the gated endpoint.

const baseUrl = String(
  process.env.PAYMENT_JOB_BASE_URL || process.env.SUBSCRIPTION_RECONCILE_BASE_URL || "http://localhost:3000"
).trim();
const jobKey = String(process.env.SUBSCRIPTION_RECONCILE_JOB_KEY || "").trim();
const dryRun = /^(1|true|yes|on)$/i.test(String(process.env.SUBSCRIPTION_RECONCILE_DRY_RUN || "").trim());

if (!jobKey) {
  console.error("[subscription-reconcile] Missing SUBSCRIPTION_RECONCILE_JOB_KEY");
  process.exit(1);
}

const url = new URL("/api/jobs/subscription-reconcile", baseUrl);
if (dryRun) url.searchParams.set("dryRun", "1");

console.log(`[subscription-reconcile] POST ${url.toString()}`);

const response = await fetch(url, {
  method: "POST",
  headers: { "x-subscription-reconcile-key": jobKey }
}).catch((error) => {
  console.error(`[subscription-reconcile] request failed: ${error?.message || error}`);
  process.exit(1);
});

const text = await response.text();
console.log(`[subscription-reconcile] status=${response.status}`);
console.log(text);

// 503 = worker disabled by config (SUBSCRIPTION_RECONCILE_ENABLED not set). That is a
// known "off" state, not a failure — don't spam systemd with failed timer runs.
if (response.status === 503) {
  console.log("[subscription-reconcile] worker disabled — nothing to do");
  process.exit(0);
}
if (!response.ok) process.exit(1);
