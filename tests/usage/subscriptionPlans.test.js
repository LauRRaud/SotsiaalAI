import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  getPlanDefinitionId,
  PLAN_DEFINITION_IDS,
  resolveRoleBoundSubscriptionPlan
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

const roleBindings = [
  ["CLIENT", "client_monthly", PLAN_DEFINITION_IDS.client_monthly],
  ["SOCIAL_WORKER", "social_worker_monthly", PLAN_DEFINITION_IDS.social_worker_monthly],
  ["SERVICE_PROVIDER", "service_provider_monthly", PLAN_DEFINITION_IDS.service_provider_monthly]
];

test("role-bound subscription plans return one canonical plan and definition pair", () => {
  for (const [role, plan, planDefinitionId] of roleBindings) {
    assert.deepEqual(resolveRoleBoundSubscriptionPlan(role), {
      planRole: role,
      plan,
      planDefinitionId
    });
    assert.deepEqual(resolveRoleBoundSubscriptionPlan(role, plan), {
      planRole: role,
      plan,
      planDefinitionId
    });
    assert.deepEqual(resolveRoleBoundSubscriptionPlan(role, `  ${plan.toUpperCase()}  `), {
      planRole: role,
      plan,
      planDefinitionId
    });
  }
});

test("missing and blank plan values preserve the normal role-bound flow", () => {
  for (const value of [undefined, null, "", "   "]) {
    assert.deepEqual(resolveRoleBoundSubscriptionPlan("CLIENT", value), {
      planRole: "CLIENT",
      plan: "client_monthly",
      planDefinitionId: PLAN_DEFINITION_IDS.client_monthly
    });
  }
});

test("cross-role, admin, unknown, and non-text plan values fail closed", () => {
  const rejected = [
    ["CLIENT", "service_provider_monthly"],
    ["CLIENT", "admin_internal"],
    ["SOCIAL_WORKER", "client_monthly"],
    ["SOCIAL_WORKER", "service_provider_monthly"],
    ["SERVICE_PROVIDER", "client_monthly"],
    ["SERVICE_PROVIDER", "social_worker_monthly"],
    ["CLIENT", "unknown_plan"],
    ["CLIENT", 123],
    ["CLIENT", { plan: "client_monthly" }]
  ];

  for (const [role, requestedPlan] of rejected) {
    assert.equal(resolveRoleBoundSubscriptionPlan(role, requestedPlan), null);
  }
});

test("registration assigns the public free plan explicitly", () => {
  const source = fs.readFileSync(path.join(repoRoot, "app/api/register/route.js"), "utf8");
  assert.match(source, /plan:\s*["']free["']/);
  assert.match(source, /planDefinitionId:\s*PLAN_DEFINITION_IDS\.free/);
});

test("every subscription activation path writes planDefinitionId", () => {
  // T09 refactor: the webhook activation path moved into the shared module
  // lib/payments/subscriptionActivation.js (used by webhook + reconcile). The
  // guarantee is unchanged; the location moved.
  const files = [
    "app/api/subscription/route.js",
    "app/api/subscription/init/route.js",
    "lib/payments/subscriptionActivation.js",
    "app/api/invites/[id]/accept/route.js"
  ];

  for (const relativePath of files) {
    const source = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
    assert.match(source, /planDefinitionId/, `${relativePath} must write a normalized plan id`);
  }

  // The webhook must still drive activation through the shared module.
  const webhookSource = fs.readFileSync(
    path.join(repoRoot, "app/api/subscription/webhook/route.js"),
    "utf8"
  );
  assert.match(
    webhookSource,
    /activateSubscriptionFromPayment/,
    "webhook must delegate activation to the shared module"
  );
});

test("subscription POST routes reject invalid requests and persist the role-bound pair", () => {
  const files = [
    "app/api/subscription/route.js",
    "app/api/subscription/init/route.js"
  ];

  for (const relativePath of files) {
    const source = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
    assert.match(source, /resolveRoleBoundSubscriptionPlan\(user\.role, body\?\.plan\)/);
    assert.match(source, /api\.subscription\.plan_not_allowed["'], 400/);
    assert.match(source, /const \{[^}]*plan[^}]*planDefinitionId[^}]*\} = roleBoundPlan/);
    assert.match(source, /data:\s*\{[\s\S]*?plan,[\s\S]*?planDefinitionId,/);
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
