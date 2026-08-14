import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveWellbeingPilotAccess,
  resolveWellbeingPilotAggregateFilters
} from "../../lib/wellbeing/pilotAccess.js";

test("wellbeing pilot access allows admins without role-group limits", async () => {
  let scopeReads = 0;
  const prisma = {
    wellbeingPilotScope: {
      async findMany() {
        scopeReads += 1;
        return [];
      }
    }
  };
  const access = await resolveWellbeingPilotAccess(
    {
      user: { id: "admin_1", email: "admin@example.test", role: "ADMIN", isAdmin: true }
    },
    { prisma }
  );

  assert.equal(access.ok, true);
  assert.equal(access.isAdmin, true);
  assert.deepEqual(access.allowedRoleGroups, []);
  assert.deepEqual(access.pilotScopes, []);
  assert.equal(scopeReads, 1, "admini piloodiloend tuleb süstitud testandmebaasist");
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

  /* SOL-WB-01: pärandrajal (`WELLBEING_PILOT_VIEWER_EMAILS`) ei ole
     organisatsioonipiiri ja vastus ütleb selle VÄLJA — piir on `null`, mitte
     puuduv võti, mille üle koond peaks ise oletama. */
  assert.deepEqual(
    resolveWellbeingPilotAggregateFilters({ workflowType: "quick-check" }, access),
    {
      roleGroup: "child_protection",
      workflowType: "quick-check",
      /* SOL-WB-06: periood on valik fikseeritud võrgust; „kõik" on selle võrgu
         liige, mitte vaba vahemik. */
      periodKind: "all",
      periodLabel: "kõik",
      periodStart: null,
      periodEnd: null,
      organizationId: null,
      municipalityId: null,
      aggregationLevel: "role_group"
    }
  );
});
