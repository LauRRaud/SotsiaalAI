import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  getPlanDefinitionId,
  PLAN_DEFINITION_IDS
} from "../../lib/subscriptionPlans.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("known and legacy plan values resolve to stable normalized plan ids", () => {
  assert.equal(getPlanDefinitionId("free", "SOCIAL_WORKER"), PLAN_DEFINITION_IDS.free);
  assert.equal(getPlanDefinitionId("client_monthly", "SOCIAL_WORKER"), PLAN_DEFINITION_IDS.client_monthly);
  assert.equal(getPlanDefinitionId("social_worker_monthly", "CLIENT"), PLAN_DEFINITION_IDS.social_worker_monthly);
  assert.equal(getPlanDefinitionId("e2e", "CLIENT"), PLAN_DEFINITION_IDS.client_monthly);
  assert.equal(getPlanDefinitionId("kuutellimus", "SOCIAL_WORKER"), PLAN_DEFINITION_IDS.social_worker_monthly);
  assert.equal(getPlanDefinitionId("unknown", "SERVICE_PROVIDER"), PLAN_DEFINITION_IDS.service_provider_monthly);
});

test("registration assigns the public free plan explicitly", () => {
  const source = fs.readFileSync(path.join(repoRoot, "app/api/register/route.js"), "utf8");
  assert.match(source, /plan:\s*["']free["']/);
  assert.match(source, /planDefinitionId:\s*PLAN_DEFINITION_IDS\.free/);
});

test("every subscription activation path writes planDefinitionId", () => {
  const files = [
    "app/api/subscription/route.js",
    "app/api/subscription/init/route.js",
    "app/api/subscription/webhook/route.js",
    "app/api/invites/[id]/accept/route.js"
  ];

  for (const relativePath of files) {
    const source = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
    assert.match(source, /planDefinitionId/, `${relativePath} must write a normalized plan id`);
  }
});

test("migration canonicalizes legacy plan text and enforces normalized active subscriptions", () => {
  const source = fs.readFileSync(
    path.join(repoRoot, "prisma/migrations/20260711120000_usage_ledger_p0/migration.sql"),
    "utf8"
  );

  assert.match(source, /SET "plan" = plan_definition\."key"/);
  assert.match(source, /Subscription_normalized_plan_check/);
  assert.match(source, /"status" = 'NONE' OR "planDefinitionId" IS NOT NULL/);
});
