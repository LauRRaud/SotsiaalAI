// Scheduler shim for the T09 payment/invite email outbox worker (repo-managed, OFF by default).
//
// POSTs /api/jobs/payment-emails with the outbox job key. The route + lib/payments/emailOutbox.js
// hold the real logic: idempotent claim, retry/backoff, terminal state, lease recovery. A retry
// only re-sends an email — it never re-runs a payment or re-grants access. Gated by
// PAYMENT_EMAIL_WORKER_ENABLED. This shim never touches the DB directly.

const baseUrl = String(
  process.env.PAYMENT_JOB_BASE_URL || process.env.PAYMENT_EMAIL_BASE_URL || "http://localhost:3000"
).trim();
const jobKey = String(process.env.PAYMENT_EMAIL_JOB_KEY || "").trim();
const dryRun = /^(1|true|yes|on)$/i.test(String(process.env.PAYMENT_EMAIL_DRY_RUN || "").trim());

if (!jobKey) {
  console.error("[payment-emails] Missing PAYMENT_EMAIL_JOB_KEY");
  process.exit(1);
}

const url = new URL("/api/jobs/payment-emails", baseUrl);
if (dryRun) url.searchParams.set("dryRun", "1");

console.log(`[payment-emails] POST ${url.toString()}`);

const response = await fetch(url, {
  method: "POST",
  headers: { "x-payment-email-key": jobKey }
}).catch((error) => {
  console.error(`[payment-emails] request failed: ${error?.message || error}`);
  process.exit(1);
});

const text = await response.text();
console.log(`[payment-emails] status=${response.status}`);
console.log(text);

// 503 = worker disabled by config (PAYMENT_EMAIL_WORKER_ENABLED not set). Known "off" state.
if (response.status === 503) {
  console.log("[payment-emails] worker disabled — nothing to do");
  process.exit(0);
}
if (!response.ok) process.exit(1);
