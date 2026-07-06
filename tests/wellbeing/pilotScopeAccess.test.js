import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveWellbeingPilotAccess,
  resolveWellbeingPilotAggregateFilters
} from "../../lib/wellbeing/pilotAccess.js";

const activePilot = {
  id: "pilot_scope_1",
  name: "Tartu KOV piloot",
  scopeType: "municipality",
  municipalityId: "tartu_linn",
  organizationId: null,
  roleGroups: ["child_protection", "family_support"],
  minimumGroupSize: 5,
  active: true,
  startsAt: new Date("2026-01-01T00:00:00.000Z"),
  endsAt: new Date("2026-12-31T23:59:59.000Z"),
  viewers: [{ email: "kov-pilot@example.test", userId: "user_1" }]
};

test("wellbeing pilot access prefers active DB pilot scopes for non-admin users", async () => {
  const prisma = {
    user: {
      findUnique: async () => ({ email: "kov-pilot@example.test" })
    },
    wellbeingPilotScope: {
      findMany: async (query) => {
        assert.equal(query.where.active, true);
        assert.equal(query.where.viewers.some.OR[0].userId, "user_1");
        assert.equal(query.where.viewers.some.OR[1].email, "kov-pilot@example.test");
        return [activePilot];
      }
    }
  };

  const access = await resolveWellbeingPilotAccess(
    { user: { id: "user_1", role: "SOCIAL_WORKER", isAdmin: false } },
    {
      prisma,
      env: {
        WELLBEING_PILOT_VIEWER_EMAILS: "",
        WELLBEING_PILOT_ROLE_GROUPS: ""
      },
      now: new Date("2026-05-26T09:00:00.000Z")
    }
  );

  assert.equal(access.ok, true);
  assert.equal(access.isAdmin, false);
  assert.deepEqual(access.allowedRoleGroups, ["child_protection", "family_support"]);
  assert.deepEqual(access.pilotScopes, [
    {
      id: "pilot_scope_1",
      name: "Tartu KOV piloot",
      scopeType: "municipality",
      municipalityId: "tartu_linn",
      organizationId: null,
      roleGroups: ["child_protection", "family_support"],
      minimumGroupSize: 5
    }
  ]);
});

test("wellbeing pilot aggregate filters bind non-admin users to the selected DB pilot scope", () => {
  const access = {
    ok: true,
    isAdmin: false,
    allowedRoleGroups: ["child_protection", "family_support"],
    pilotScopes: [
      {
        id: "pilot_scope_1",
        name: "Tartu KOV piloot",
        scopeType: "municipality",
        municipalityId: "tartu_linn",
        organizationId: null,
        roleGroups: ["child_protection", "family_support"],
        minimumGroupSize: 5
      }
    ]
  };

  assert.deepEqual(
    resolveWellbeingPilotAggregateFilters(
      { pilotId: "pilot_scope_1", roleGroup: "family_support", workflowType: "quick-check" },
      access
    ),
    {
      pilotId: "pilot_scope_1",
      roleGroup: "family_support",
      workflowType: "quick-check",
      periodStart: null,
      periodEnd: null,
      aggregationLevel: "role_group",
      minimumGroupSize: 5
    }
  );

  assert.throws(
    () => resolveWellbeingPilotAggregateFilters({ pilotId: "missing_scope" }, access),
    /wellbeing\.pilot\.scope_forbidden/
  );
});
