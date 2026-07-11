#!/usr/bin/env node

const baseUrl = String(process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const startupDeadline = Date.now() + 45_000;

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
    ...options
  });
}

async function waitForServer() {
  let lastError = null;
  while (Date.now() < startupDeadline) {
    try {
      const response = await request("/hinnastus");
      if (response.status === 200) return;
      lastError = new Error(`startup status ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 750));
  }
  throw new Error(`Server did not become ready: ${lastError?.message || "unknown error"}`);
}

async function expectStatus(path, status) {
  const response = await request(path);
  if (response.status !== status) {
    throw new Error(`${path} returned ${response.status}; expected ${status}`);
  }
  return response;
}

await waitForServer();

const pricing = await expectStatus("/hinnastus", 200);
const pricingHtml = await pricing.text();
if (!pricingHtml.includes("0 €") || !pricingHtml.includes("Alusta tasuta")) {
  throw new Error("Pricing smoke did not expose the free package");
}

await expectStatus("/api/me/usage", 401);
await expectStatus("/api/admin/usage/plans", 401);
await expectStatus("/api/admin/usage/deletion-jobs", 401);

console.log("[ci:smoke] pricing and protected usage/admin boundaries: OK");
