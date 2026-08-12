import assert from "node:assert/strict";
import test from "node:test";

import {
  createWellbeingPilotScope,
  listWellbeingPilotScopes,
  normalizeWellbeingPilotScopeInput,
  serializeWellbeingPilotScope
} from "../../lib/wellbeing/pilotScopes.js";

test("wellbeing pilot scope input normalizes role groups, viewers, dates and minimum group size", () => {
  assert.deepEqual(
    normalizeWellbeingPilotScopeInput({
      name: "  Tartu piloot  ",
      scopeType: "municipality",
      municipalityId: " tartu_linn ",
      organizationId: "",
      roleGroups: "child_protection, family_support, child_protection",
      viewerEmails: " KOV@example.test, kov@example.test, juht@example.test ",
      minimumGroupSize: "2",
      startsAt: "2026-05-01",
      endsAt: ""
    }),
    {
      name: "Tartu piloot",
      scopeType: "municipality",
      municipalityId: "tartu_linn",
      organizationId: null,
      roleGroups: ["child_protection", "family_support"],
      viewerEmails: ["kov@example.test", "juht@example.test"],
      minimumGroupSize: 3,
      active: true,
      startsAt: new Date("2026-05-01T00:00:00.000Z"),
      endsAt: null
    }
  );
});

test("wellbeing pilot scope service creates DB pilot with email viewers", async () => {
  const createdPayloads = [];
  const audits = [];
  const prisma = {
    dataAuditLog: { create: async (query) => { audits.push(query.data); return query.data; } },
    wellbeingPilotScope: {
      create: async (payload) => {
        createdPayloads.push(payload);
        return {
          id: "scope_1",
          ...payload.data,
          viewers: payload.data.viewers.create.map((viewer, index) => ({
            id: `viewer_${index}`,
            ...viewer
          }))
        };
      }
    }
  };

  const scope = await createWellbeingPilotScope(
    {
      name: "Tartu piloot",
      scopeType: "municipality",
      roleGroups: ["child_protection"],
      viewerEmails: ["KOV@example.test"],
      minimumGroupSize: 5
    },
    { prisma, actorUserId: "admin_1" }
  );

  assert.equal(createdPayloads[0].data.name, "Tartu piloot");
  assert.deepEqual(createdPayloads[0].data.roleGroups, ["child_protection"]);
  assert.deepEqual(createdPayloads[0].data.viewers.create, [{ email: "kov@example.test" }]);
  assert.equal(scope.minimumGroupSize, 5);
  assert.deepEqual(scope.viewerEmails, ["kov@example.test"]);

  /* SOL-WB-13: skoobi loomine jätab jälje, milles on tegija, künnis ja skoobi
     versioon — aga mitte ühtki koondi arvu. */
  assert.equal(audits.length, 1);
  assert.equal(audits[0].actorUserId, "admin_1");
  assert.equal(audits[0].resourceType, "WellbeingPilotScope");
  assert.equal(audits[0].meta.minimumGroupSize, 5);
  assert.match(audits[0].meta.scopeVersion, /^[0-9a-f]{64}$/u);
});

test("wellbeing pilot scope list serializes scopes for admin UI", async () => {
  const prisma = {
    wellbeingPilotScope: {
      findMany: async (query) => {
        assert.deepEqual(query.orderBy, [{ active: "desc" }, { updatedAt: "desc" }]);
        return [
          {
            id: "scope_1",
            name: "Tartu piloot",
            scopeType: "municipality",
            municipalityId: "tartu_linn",
            organizationId: null,
            roleGroups: ["child_protection"],
            minimumGroupSize: 5,
            active: true,
            startsAt: null,
            endsAt: null,
            viewers: [{ email: "kov@example.test" }]
          }
        ];
      }
    }
  };

  const scopes = await listWellbeingPilotScopes({ prisma });

  assert.deepEqual(scopes, [
    {
      id: "scope_1",
      name: "Tartu piloot",
      scopeType: "municipality",
      municipalityId: "tartu_linn",
      organizationId: null,
      roleGroups: ["child_protection"],
      minimumGroupSize: 5,
      active: true,
      startsAt: null,
      endsAt: null,
      viewerEmails: ["kov@example.test"]
    }
  ]);
  assert.deepEqual(serializeWellbeingPilotScope(scopes[0]).viewerEmails, ["kov@example.test"]);
});
