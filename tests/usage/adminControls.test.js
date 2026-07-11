import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  normalizeEntitlementInput,
  normalizePrice,
  normalizeReason
} from "../../lib/usage/adminValidation.js";

test("admin entitlement validation accepts exact integer limits", () => {
  assert.deepEqual(normalizeEntitlementInput({
    metric: "DOCUMENT_GENERATE",
    period: "WEEKLY",
    enabled: true,
    softLimit: "8",
    hardLimit: "10"
  }), {
    metric: "DOCUMENT_GENERATE",
    period: "WEEKLY",
    enabled: true,
    softLimit: 8n,
    hardLimit: 10n
  });
  assert.equal(normalizePrice("14.9"), "14.90");
  assert.equal(normalizeReason("Ajutine piloot"), "Ajutine piloot");
});

test("admin entitlement validation rejects unsafe limits", () => {
  assert.throws(() => normalizeEntitlementInput({
    metric: "DOCUMENT_GENERATE",
    period: "WEEKLY",
    enabled: true,
    softLimit: "11",
    hardLimit: "10"
  }), /softLimit/);
  assert.throws(() => normalizeEntitlementInput({
    metric: "UNKNOWN",
    period: "MONTHLY",
    hardLimit: "10"
  }), /Unsupported/);
  assert.throws(() => normalizeReason("x"), /3-500/);
});

test("plan and override mutations are admin protected and audit in the same transaction", async () => {
  const [plans, overrides] = await Promise.all([
    readFile(new URL("../../app/api/admin/usage/plans/route.js", import.meta.url), "utf8"),
    readFile(new URL("../../app/api/admin/usage/overrides/route.js", import.meta.url), "utf8")
  ]);
  for (const source of [plans, overrides]) {
    assert.match(source, /assertAdmin\(session\)/);
    assert.match(source, /prisma\.\$transaction/);
    assert.match(source, /tx\.dataAuditLog\.create/);
    assert.match(source, /Cache-Control[\s\S]*no-store/);
  }
  assert.match(plans, /usage_plan_version_created/);
  assert.match(plans, /version:[\s\S]*\+ 1/);
  assert.match(overrides, /usage_override_created/);
  assert.match(overrides, /usage_override_ended/);
});

test("usage administration stays outside the legacy analytics monolith", async () => {
  const [client, panel] = await Promise.all([
    readFile(new URL("../../app/admin/analytics/AdminAnalyticsClient.jsx", import.meta.url), "utf8"),
    readFile(new URL("../../components/admin/usage/UsageAdminPanel.jsx", import.meta.url), "utf8")
  ]);
  assert.match(client, /<UsageAdminPanel/);
  assert.match(panel, /\/api\/admin\/usage\/plans/);
  assert.match(panel, /\/api\/admin\/usage\/overrides/);
});
