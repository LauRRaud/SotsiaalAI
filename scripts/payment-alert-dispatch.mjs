#!/usr/bin/env node

function env(name, fallback = "") {
  const value = process.env[name];
  if (value == null) return fallback;
  return String(value).trim();
}

function asFlag(value, fallback = false) {
  const raw = String(value == null ? (fallback ? "1" : "0") : value)
    .toLowerCase()
    .trim();
  return raw === "1" || raw === "true" || raw === "yes";
}

function fail(message, code = 1) {
  console.error(`[payment-alert-dispatch] ${message}`);
  process.exit(code);
}

async function main() {
  const baseUrl = env("PAYMENT_ALERT_DISPATCH_BASE_URL", "http://localhost:3000");
  const dispatchKey = env("PAYMENT_ALERT_DISPATCH_KEY", "");
  const locale = env("PAYMENT_ALERT_DISPATCH_LOCALE", "en");
  const dryRun = asFlag(env("PAYMENT_ALERT_DISPATCH_DRY_RUN", "1"), true);
  const bypassDedupe = asFlag(env("PAYMENT_ALERT_DISPATCH_BYPASS_DEDUPE", "0"), false);

  const url = new URL("/api/admin/analytics/payment-alerts/dispatch", baseUrl);
  if (dryRun) url.searchParams.set("dryRun", "1");
  if (bypassDedupe) url.searchParams.set("bypassDedupe", "1");
  if (locale) url.searchParams.set("locale", locale);

  const headers = {};
  if (dispatchKey) headers["x-payment-alert-dispatch-key"] = dispatchKey;

  console.log(`[payment-alert-dispatch] POST ${url.toString()}`);
  console.log(
    `[payment-alert-dispatch] mode=${dryRun ? "dry-run" : "dispatch"} bypassDedupe=${bypassDedupe ? "1" : "0"}`
  );

  const response = await fetch(url, {
    method: "POST",
    headers,
    cache: "no-store"
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  console.log(`[payment-alert-dispatch] status=${response.status}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }

  if (!response.ok) {
    fail(`request failed with status ${response.status}`);
  }
  if (!data || data.ok !== true) {
    fail("response payload indicates failure");
  }
}

main().catch(error => {
  fail(error?.message || String(error));
});
