const baseUrl = String(process.env.SUBSCRIPTION_RENEWAL_BASE_URL || "").trim();
const jobKey = String(process.env.SUBSCRIPTION_RENEWAL_JOB_KEY || "").trim();
const dryRun =
  String(process.env.SUBSCRIPTION_RENEWAL_DRY_RUN || "")
    .trim()
    .toLowerCase() === "1";

if (!baseUrl) {
  console.error("[subscription-renewals] Missing SUBSCRIPTION_RENEWAL_BASE_URL");
  process.exit(1);
}

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
});

const text = await response.text();
console.log(`[subscription-renewals] status=${response.status}`);
console.log(text);

if (!response.ok) {
  process.exit(1);
}
