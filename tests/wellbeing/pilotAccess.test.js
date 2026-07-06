import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveWellbeingPilotAccess,
  resolveWellbeingPilotAggregateFilters
} from "../../lib/wellbeing/pilotAccess.js";

test("wellbeing pilot access allows admins without role-group limits", async () => {
  const access = await resolveWellbeingPilotAccess({
    user: { id: "admin_1", email: "admin@example.test", role: "ADMIN", isAdmin: true }
  });

  assert.equal(access.ok, true);
  assert.equal(access.isAdmin, true);
  assert.deepEqual(access.allowedRoleGroups, []);
});

test("wellbeing pilot access allows only explicitly allowlisted non-admin users", async () => {
  const prisma = {
    user: {
      findUnique: async () => ({ email: "kov-pilot@example.test" })
    }
  };
  const env = {
    WELLBEING_PILOT_VIEWER_EMAILS: "kov-pilot@example.test",
    WELLBEING_PILOT_ROLE_GROUPS: "child_protection, family_support"
  };

  const access = await resolveWellbeingPilotAccess(
    { user: { id: "user_1", role: "SOCIAL_WORKER", isAdmin: false } },
    { prisma, env }
  );

  assert.equal(access.ok, true);
  assert.equal(access.isAdmin, false);
  assert.deepEqual(access.allowedRoleGroups, ["child_protection", "family_support"]);
});

test("wellbeing pilot aggregate filters reject disallowed role groups for pilot users", () => {
  const access = {
    ok: true,
    isAdmin: false,
    allowedRoleGroups: ["child_protection"]
  };

  assert.throws(
    () => resolveWellbeingPilotAggregateFilters({ roleGroup: "family_support" }, access),
    /wellbeing\.pilot\.role_group_forbidden/
  );

  assert.deepEqual(
    resolveWellbeingPilotAggregateFilters({ workflowType: "quick-check" }, access),
    {
      roleGroup: "child_protection",
      workflowType: "quick-check",
      periodStart: null,
      periodEnd: null,
      aggregationLevel: "role_group"
    }
  );
});
