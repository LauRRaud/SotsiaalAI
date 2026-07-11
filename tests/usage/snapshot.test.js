import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createUsageSnapshotService } from "../../lib/usage/snapshot.js";
import { getUsagePeriodRange } from "../../lib/usage/periods.js";

const now = new Date("2026-07-08T12:00:00.000Z");

function fakeDb({ free = false } = {}) {
  const range = getUsagePeriodRange("MONTHLY", now, "Europe/Tallinn");
  const plan = free ? {
    id: "plan_free_v1",
    key: "free",
    name: "Tasuta",
    price: "0.00",
    currency: "EUR",
    version: 1,
    entitlements: []
  } : {
    id: "plan_client_v1",
    key: "client_monthly",
    name: "Pöörduja",
    price: "7.99",
    currency: "EUR",
    version: 1,
    entitlements: [
      { metric: "CHAT_ASSISTANT_REPLY", enabled: true, period: "MONTHLY", hardLimit: 100n, softLimit: 70n },
      { metric: "DOCUMENT_GENERATE", enabled: true, period: "MONTHLY", hardLimit: 2n, softLimit: null },
      { metric: "STORAGE_BYTES", enabled: true, period: "LIFETIME", hardLimit: 100n, softLimit: null }
    ]
  };
  const subscription = {
    id: "sub_1",
    userId: "user_1",
    status: free ? "NONE" : "ACTIVE",
    plan: plan.key,
    validUntil: free ? null : new Date("2026-08-01T00:00:00.000Z"),
    nextBilling: free ? null : new Date("2026-08-01T00:00:00.000Z"),
    planDefinition: plan
  };

  return {
    user: {
      async findUnique() {
        return { id: "user_1", role: "CLIENT", isAdmin: false };
      }
    },
    subscription: {
      async findFirst({ where }) {
        if (where.status === "ACTIVE") return free ? null : subscription;
        return subscription;
      }
    },
    userEntitlementOverride: {
      async findMany() {
        return [];
      }
    },
    usageBucket: {
      async findMany() {
        return free ? [] : [
          { metric: "CHAT_ASSISTANT_REPLY", periodStart: range.start, periodEnd: range.end, used: 85n, reserved: 5n },
          { metric: "DOCUMENT_GENERATE", periodStart: range.start, periodEnd: range.end, used: 2n, reserved: 0n }
        ];
      }
    },
    planDefinition: {
      async findFirst() {
        return plan;
      }
    }
  };
}

test("usage snapshot merges plan limits, current buckets, and actual storage", async () => {
  const service = createUsageSnapshotService({
    prismaClient: fakeDb(),
    storageUsageResolver: async () => ({ totalBytes: 75 })
  });

  const result = await service.getUserSnapshot("user_1", { now });

  assert.equal(result.plan.key, "client_monthly");
  assert.equal(result.subscription.nextBilling, "2026-08-01T00:00:00.000Z");
  const byMetric = Object.fromEntries(result.metrics.map((item) => [item.metric, item]));
  assert.deepEqual(
    {
      consumed: byMetric.CHAT_ASSISTANT_REPLY.consumed,
      percentage: byMetric.CHAT_ASSISTANT_REPLY.percentage,
      state: byMetric.CHAT_ASSISTANT_REPLY.state
    },
    { consumed: "90", percentage: 90, state: "warning" }
  );
  assert.equal(byMetric.DOCUMENT_GENERATE.state, "blocked");
  assert.equal(byMetric.STORAGE_BYTES.used, "75");
  assert.equal(byMetric.STORAGE_BYTES.state, "notice");
  assert.equal(byMetric.STORAGE_BYTES.resetAt, null);
});

test("free plan snapshot has no AI usage metrics", async () => {
  const service = createUsageSnapshotService({
    prismaClient: fakeDb({ free: true }),
    storageUsageResolver: async () => ({ totalBytes: 0 })
  });

  const result = await service.getUserSnapshot("user_1", { now });
  assert.equal(result.plan.key, "free");
  assert.equal(result.subscription.status, "NONE");
  assert.deepEqual(result.metrics, []);
});

test("me usage route is authenticated and no-store", async () => {
  const source = await readFile(new URL("../../app/api/me/usage/route.js", import.meta.url), "utf8");
  assert.match(source, /getServerSession\(authConfig\)/);
  assert.match(source, /session\?\.user\?\.id/);
  assert.match(source, /usageSnapshotService\.getUserSnapshot/);
  assert.match(source, /Cache-Control[\s\S]*no-store/);
});

test("current profile carousel exposes the usage panel route", async () => {
  const [stageSource, profileSource, frameSource] = await Promise.all([
    readFile(new URL("../../components/room/RoomStage.jsx", import.meta.url), "utf8"),
    readFile(new URL("../../components/alalehed/ProfiilBody.jsx", import.meta.url), "utf8"),
    readFile(new URL("../../components/room/PanelFrame.jsx", import.meta.url), "utf8")
  ]);
  assert.match(stageSource, /profile\.usage\.title[\s\S]*\/profiil\?sektsioon=kasutus/);
  assert.match(profileSource, /usageSection[\s\S]*<UsageOverview/);
  assert.match(frameSource, /isProfileSectionPage[\s\S]*router\.push\(localizePath\("\/profiil"/);
});

test("public pricing does not promise unlimited AI usage", async () => {
  const [pricingSource, etMessages] = await Promise.all([
    readFile(new URL("../../components/alalehed/HinnastusBody.jsx", import.meta.url), "utf8"),
    readFile(new URL("../../messages/et.json", import.meta.url), "utf8")
  ]);
  assert.doesNotMatch(pricingSource, /"unlimited"/);
  assert.doesNotMatch(etMessages, /"unlimited"\s*:/);
  assert.match(etMessages, /ükski AI-maht ei ole piiramatu/);
});
