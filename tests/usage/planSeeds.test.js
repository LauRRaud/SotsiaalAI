import assert from "node:assert/strict";
import test from "node:test";

import { seedUsagePlans, USAGE_PLAN_SEEDS } from "../../lib/usage/planSeeds.js";

test("usage plan seeds match the approved initial package limits", () => {
  assert.deepEqual(USAGE_PLAN_SEEDS.map(plan => [plan.key, plan.price]), [
    ["free", "0.00"],
    ["client_monthly", "7.99"],
    ["social_worker_monthly", "14.99"],
    ["service_provider_monthly", "19.99"],
    ["admin_internal", "0.00"]
  ]);

  const free = USAGE_PLAN_SEEDS.find(plan => plan.key === "free");
  const client = USAGE_PLAN_SEEDS.find(plan => plan.key === "client_monthly");
  assert.deepEqual(free.entitlements, []);
  assert.deepEqual(
    client.entitlements.map(item => [item.metric, item.period, item.softLimit, item.hardLimit]),
    [
      ["CHAT_ASSISTANT_REPLY", "MONTHLY", 120n, 150n],
      ["DOCUMENT_GENERATE", "WEEKLY", null, 2n],
      ["DOCUMENT_REFINE", "WEEKLY", null, 6n],
      ["FILE_ANALYZE", "WEEKLY", null, 4n],
      ["DEEP_RESEARCH_RUN", "MONTHLY", null, 2n],
      ["RAG_SEARCH", "MONTHLY", null, 2000n],
      ["STT_SECONDS", "MONTHLY", null, 900n],
      ["TTS_CHARS", "MONTHLY", null, 50_000n],
      ["STORAGE_BYTES", "LIFETIME", null, 50n * 1024n * 1024n]
    ]
  );
});

test("usage plan seeding is expressed as idempotent upserts", async () => {
  const calls = { plans: [], entitlements: [] };
  const db = {
    planDefinition: {
      async upsert(input) {
        calls.plans.push(input);
        return { id: input.create.id };
      }
    },
    planEntitlement: {
      async upsert(input) {
        calls.entitlements.push(input);
        return input.create;
      }
    }
  };

  const result = await seedUsagePlans(db);

  assert.deepEqual(result, { planCount: 5, entitlementCount: 36 });
  assert.equal(calls.plans.length, 5);
  assert.equal(calls.entitlements.length, 36);
  assert.deepEqual(calls.plans[0].where, {
    key_version: { key: "free", version: 1 }
  });
  assert.deepEqual(calls.entitlements[0].where, {
    planDefinitionId_metric: {
      planDefinitionId: "plan_client_v1",
      metric: "CHAT_ASSISTANT_REPLY"
    }
  });
});
