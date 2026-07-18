// Scheduler shim for the usage reservation-reaper (repo-managed, OFF by default).
//
// POSTs /api/jobs/usage-reservation-reaper with the reaper job key. All the real
// logic + safety lives in the route + lib/usage/reservationReaper.js: gated by
// USAGE_REAPER_ENABLED, releases only expired RESERVED rows through the atomic usage
// service, never touches COMMITTED rows. This shim never touches the DB directly.

const baseUrl = String(
  process.env.PAYMENT_JOB_BASE_URL || process.env.USAGE_REAPER_BASE_URL || "http://localhost:3000"
).trim();
const jobKey = String(process.env.USAGE_REAPER_JOB_KEY || "").trim();
const dryRun = /^(1|true|yes|on)$/i.test(String(process.env.USAGE_REAPER_DRY_RUN || "").trim());

if (!jobKey) {
  console.error("[usage-reservation-reaper] Missing USAGE_REAPER_JOB_KEY");
  process.exit(1);
}

const url = new URL("/api/jobs/usage-reservation-reaper", baseUrl);
if (dryRun) url.searchParams.set("dryRun", "1");

console.log(`[usage-reservation-reaper] POST ${url.toString()}`);

const response = await fetch(url, {
  method: "POST",
  headers: { "x-usage-reaper-key": jobKey }
}).catch((error) => {
  console.error(`[usage-reservation-reaper] request failed: ${error?.message || error}`);
  process.exit(1);
});

const text = await response.text();
console.log(`[usage-reservation-reaper] status=${response.status}`);
console.log(text);

// 503 = worker disabled by config (USAGE_REAPER_ENABLED not set). Known "off" state.
if (response.status === 503) {
  console.log("[usage-reservation-reaper] worker disabled — nothing to do");
  process.exit(0);
}
if (!response.ok) process.exit(1);
