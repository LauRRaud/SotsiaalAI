const baseUrl = String(process.env.APP_URL || process.env.NEXTAUTH_URL || "").replace(/\/$/u, "");
const key = String(process.env.NOTIFICATION_JOB_KEY || "").trim();
const dryRun = process.argv.includes("--dry-run");
if (!baseUrl || !key) throw new Error("APP_URL and NOTIFICATION_JOB_KEY are required");

const url = new URL(`${baseUrl}/api/jobs/notifications`);
if (dryRun) url.searchParams.set("dryRun", "1");
const response = await fetch(url, {
  method: "POST",
  headers: { "x-notification-job-key": key },
  signal: AbortSignal.timeout(120_000)
});
const payload = await response.json().catch(() => ({}));
if (!response.ok || payload?.ok !== true) {
  throw new Error(`Notification job failed (${response.status})`);
}
console.info(JSON.stringify({
  ok: true,
  dryRun,
  reconcilePages: Number(payload.reconcilePages || 0),
  deliveryPages: Number(payload.deliveryPages || 0),
  truncated: Boolean(payload.truncated),
  created: Number(payload.reconciled?.created || 0),
  sent: Number(payload.delivery?.sent || 0),
  failed: Number(payload.delivery?.failed || 0),
  retried: Number(payload.delivery?.retried || 0)
}));
