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

// 503 has two causes that must not look alike (Soli katse 20.10): the route's own "off" state
// (PAYMENT_EMAIL_WORKER_ENABLED not set) and the closed opening gate in proxy.js
// (`platform_not_open`), which stops the job before the route runs.
let body = null;
try { body = JSON.parse(text); } catch { body = null; }
// exitCode instead of exit(): the process ends on its own after the response is read.
if (response.status === 503 && body?.error === "platform_not_open") {
  console.error("[payment-emails] blocked by the closed platform gate (platform_not_open) — the job did not run");
  process.exitCode = 1;
} else if (response.status === 503 && body?.message === "payment email worker disabled") {
  console.log("[payment-emails] worker disabled — nothing to do");
} else if (!response.ok) {
  process.exitCode = 1;
}
