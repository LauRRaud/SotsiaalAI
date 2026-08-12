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
      /* SOL-WB-01: KOV-piloodi piir peab jõudma FILTRISSE, mitte jääma vastuse
         metaandmetesse — ilma selleta luges sama rollirühma koond kogu
         platvormi ja kandis ometi selle piloodi nime. */
      organizationId: null,
      municipalityId: "tartu_linn",
      aggregationLevel: "role_group",
      minimumGroupSize: 5
    }
  );

  assert.throws(
    () => resolveWellbeingPilotAggregateFilters({ pilotId: "missing_scope" }, access),
    /wellbeing\.pilot\.scope_forbidden/
  );
});

/* SOL-WB-01 fail-closed: skoop, mille tüüp nõuab ID-d, mida tal ei ole, ei tohi
   vaikselt laieneda platvormiüleseks valimiks ühe asutuse nime all. */
test("wellbeing pilot aggregate filters refuse a scope whose own boundary is missing", () => {
  const access = {
    ok: true,
    isAdmin: false,
    allowedRoleGroups: ["child_protection"],
    pilotScopes: [
      {
        id: "pilot_scope_2",
        name: "Katkine organisatsioonipiloot",
        scopeType: "organization",
        municipalityId: null,
        organizationId: null,
        roleGroups: ["child_protection"],
        minimumGroupSize: 3
      }
    ]
  };

  assert.throws(
    () => resolveWellbeingPilotAggregateFilters({ pilotId: "pilot_scope_2" }, access),
    /wellbeing\.pilot\.scope_incomplete/
  );
});

/* Valitud piloot maksab ka admin'ile: varem oli `pilotId` tema käes puhas
   dekoratsioon — jõudis vastusesse, aga ei piiranud valimit. */
test("wellbeing pilot aggregate filters bind an admin to the pilot they selected", () => {
  const access = {
    ok: true,
    isAdmin: true,
    allowedRoleGroups: [],
    pilotScopes: [
      {
        id: "pilot_scope_3",
        name: "Harku organisatsioonipiloot",
        scopeType: "organization",
        municipalityId: null,
        organizationId: "org_harku",
        roleGroups: ["SOCIAL_WORKER"],
        minimumGroupSize: 4
      }
    ]
  };

  assert.deepEqual(
    resolveWellbeingPilotAggregateFilters({ pilotId: "pilot_scope_3" }, access),
    {
      pilotId: "pilot_scope_3",
      roleGroup: "SOCIAL_WORKER",
      workflowType: null,
      periodStart: null,
      periodEnd: null,
      organizationId: "org_harku",
      municipalityId: null,
      aggregationLevel: "role_group",
      minimumGroupSize: 4
    }
  );

  /* Ilma piloodivalikuta jääb admin platvormiüleseks ega kanna ühegi piloodi
     nime — piirid on `null` ja `pilotId` kaob vastusest. */
  assert.deepEqual(
    resolveWellbeingPilotAggregateFilters({ roleGroup: "SOCIAL_WORKER" }, access),
    {
      roleGroup: "SOCIAL_WORKER",
      workflowType: null,
      periodStart: null,
      periodEnd: null,
      organizationId: null,
      municipalityId: null,
      aggregationLevel: "role_group"
    }
  );
});
