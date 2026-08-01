import test from "node:test";
import assert from "node:assert/strict";

import {
  PayerSource,
  WorkspaceContextKind,
  assertCapability,
  assertWritable,
  hasActiveModule,
  hasCapability,
  resolveOrgAccessContext,
  toClientContext
} from "../../lib/org/accessContext.js";

const ENV_ON = { ORG_WORKSPACE_ENABLED: "1" };
const NOW = new Date("2026-08-01T12:00:00.000Z");

const UNITS = [
  { id: "osakond", organizationId: "org_1", parentUnitId: null, depth: 1, status: "ACTIVE" },
  { id: "tiim_a", organizationId: "org_1", parentUnitId: "osakond", depth: 2, status: "ACTIVE" },
  { id: "tiim_b", organizationId: "org_1", parentUnitId: "osakond", depth: 2, status: "ACTIVE" }
];

/**
 * Minimaalne fake-Prisma. Ta jäljendab TÄPSELT seda, mida resolver küsib —
 * eriti `organizationMembership.findFirst` filtrit, sest just seal otsustatakse,
 * kas võõra organisatsiooni rida üldse mällu jõuab.
 */
function makeDb({ memberships = [], modules = [], units = UNITS, subscription = null } = {}) {
  return {
    subscription: {
      findFirst: async () => subscription
    },
    organizationMembership: {
      findFirst: async ({ where }) => {
        const row = memberships.find(
          (membership) =>
            membership.organizationId === where.organizationId &&
            membership.userId === where.userId &&
            membership.status === where.status
        );
        return row || null;
      }
    },
    organizationModule: {
      findMany: async ({ where }) =>
        modules
          .filter((module) => module.organizationId === where.organizationId)
          .filter((module) => module.status === where.status)
          .map((module) => ({ moduleKey: module.moduleKey }))
    },
    organizationUnit: {
      findMany: async ({ where }) => units.filter((unit) => unit.organizationId === where.organizationId)
    }
  };
}

function membership(overrides = {}) {
  return {
    id: "mem_1",
    status: "ACTIVE",
    seatRole: "SOCIAL_WORKER",
    jobTitle: "Sotsiaaltöötaja",
    startedAt: new Date("2026-07-01T00:00:00.000Z"),
    organizationId: "org_1",
    userId: "user_a",
    organization: {
      id: "org_1",
      displayName: "X vald",
      legalName: "X Vallavalitsus",
      legalKind: "MUNICIPALITY",
      status: "ACTIVE",
      municipalityId: "mun_1",
      defaultLocale: "et",
      timezone: "Europe/Tallinn"
    },
    units: [],
    capabilityGrants: [],
    ...overrides
  };
}

function grant(overrides = {}) {
  return {
    id: "grant_1",
    capability: "MEMBER_ADMIN",
    scopeType: "ORGANIZATION",
    scopeUnitId: null,
    validFrom: new Date("2026-07-01T00:00:00.000Z"),
    validUntil: null,
    revokedAt: null,
    ...overrides
  };
}

async function resolve(input, dbOptions, env = ENV_ON) {
  return resolveOrgAccessContext(input, { db: makeDb(dbOptions), env, now: NOW });
}

/* -------------------------------------------------------------------------
   Isiklik kontekst.
   ------------------------------------------------------------------------- */

test("no requested organisation yields the personal context, not an error", async () => {
  const context = await resolve({ userId: "user_a", productRole: "SOCIAL_WORKER" }, {});
  assert.equal(context.kind, WorkspaceContextKind.PERSONAL);
  assert.equal(context.organization, null);
  assert.deepEqual(context.capabilities, []);
  assert.equal(context.writable, true);
});

test("the personal context works even when the org workspace gate is off", async () => {
  const context = await resolve({ userId: "user_a" }, {}, {});
  assert.equal(context.kind, WorkspaceContextKind.PERSONAL);
  assert.equal(context.orgWorkspaceEnabled, false);
});

test("payer source is server truth: a sponsored subscription is never reported as self-paid", async () => {
  const sponsored = await resolve(
    { userId: "user_a" },
    { subscription: { billingSource: "SPONSORED_BY_HOST", sponsorUserId: "host_1" } }
  );
  assert.equal(sponsored.payerSource, PayerSource.INDIVIDUAL_SPONSOR);

  const self = await resolve({ userId: "user_a" }, { subscription: { billingSource: "SELF" } });
  assert.equal(self.payerSource, PayerSource.SELF);
});

test("viil A never claims ORGANIZATION as payer — that arrives with real seats in viil B", async () => {
  const context = await resolve(
    { userId: "user_a", requestedOrganizationId: "org_1" },
    { memberships: [membership()] }
  );
  assert.notEqual(context.payerSource, PayerSource.ORGANIZATION);
  assert.equal(context.payerSource, PayerSource.SELF);
});

/* -------------------------------------------------------------------------
   Gate.
   ------------------------------------------------------------------------- */

test("with the gate off an organisation request is 404 — its existence is not revealed", async () => {
  await assert.rejects(
    resolve({ userId: "user_a", requestedOrganizationId: "org_1" }, { memberships: [membership()] }, {}),
    (error) => {
      assert.equal(error.status, 404);
      return true;
    }
  );
});

test("the gate is checked before any database read", async () => {
  let queried = false;
  const db = makeDb({ memberships: [membership()] });
  const spy = {
    ...db,
    organizationMembership: {
      findFirst: async (...args) => {
        queried = true;
        return db.organizationMembership.findFirst(...args);
      }
    }
  };
  await assert.rejects(
    resolveOrgAccessContext(
      { userId: "user_a", requestedOrganizationId: "org_1" },
      { db: spy, env: {}, now: NOW }
    )
  );
  assert.equal(queried, false, "a closed gate must not cause an organisation lookup");
});

/* -------------------------------------------------------------------------
   §11.1 isolatsioon.
   ------------------------------------------------------------------------- */

test("a member of org 1 gets 404 for org 2 — foreign and non-existent are identical", async () => {
  const memberships = [membership()];
  await assert.rejects(
    resolve({ userId: "user_a", requestedOrganizationId: "org_2" }, { memberships }),
    (error) => {
      assert.equal(error.status, 404);
      assert.equal(error.messageKey, "org.errors.organization_not_found");
      return true;
    }
  );
  await assert.rejects(
    resolve({ userId: "user_a", requestedOrganizationId: "org_does_not_exist" }, { memberships }),
    (error) => {
      assert.equal(error.status, 404);
      assert.equal(error.messageKey, "org.errors.organization_not_found");
      return true;
    }
  );
});

test("a suspended or ended membership grants no context at all", async () => {
  for (const status of ["SUSPENDED", "ENDED"]) {
    await assert.rejects(
      resolve(
        { userId: "user_a", requestedOrganizationId: "org_1" },
        { memberships: [membership({ status })] }
      ),
      (error) => {
        assert.equal(error.status, 404);
        return true;
      }
    );
  }
});

test("a platform admin is NOT a member — the admin flag opens no organisation", async () => {
  await assert.rejects(
    resolve(
      { userId: "admin_1", requestedOrganizationId: "org_1", isPlatformAdmin: true },
      { memberships: [membership()] }
    ),
    (error) => {
      assert.equal(error.status, 404);
      return true;
    }
  );
});

test("the same user can hold different seat roles and rights in two organisations", async () => {
  const memberships = [
    membership({ id: "mem_1", capabilityGrants: [grant({ capability: "ORG_OWNER" })] }),
    membership({
      id: "mem_2",
      organizationId: "org_2",
      seatRole: "SERVICE_PROVIDER",
      organization: { ...membership().organization, id: "org_2", displayName: "Y OÜ", legalKind: "COMPANY" },
      capabilityGrants: []
    })
  ];
  const units = [...UNITS, { id: "u2", organizationId: "org_2", parentUnitId: null, depth: 1, status: "ACTIVE" }];

  const first = await resolve({ userId: "user_a", requestedOrganizationId: "org_1" }, { memberships, units });
  const second = await resolve({ userId: "user_a", requestedOrganizationId: "org_2" }, { memberships, units });

  assert.equal(first.membership.seatRole, "SOCIAL_WORKER");
  assert.equal(hasCapability(first, "ORG_OWNER"), true);
  assert.equal(second.membership.seatRole, "SERVICE_PROVIDER");
  assert.equal(hasCapability(second, "ORG_OWNER"), false);
});

/* -------------------------------------------------------------------------
   Organisatsiooni olek.
   ------------------------------------------------------------------------- */

test("an archived organisation is invisible even to an active member", async () => {
  await assert.rejects(
    resolve(
      { userId: "user_a", requestedOrganizationId: "org_1" },
      { memberships: [membership({ organization: { ...membership().organization, status: "ARCHIVED" } })] }
    ),
    (error) => {
      assert.equal(error.status, 404);
      return true;
    }
  );
});

test("a suspended organisation is readable but closed for writes", async () => {
  const context = await resolve(
    { userId: "user_a", requestedOrganizationId: "org_1" },
    { memberships: [membership({ organization: { ...membership().organization, status: "SUSPENDED" } })] }
  );
  assert.equal(context.writable, false);
  assert.throws(() => assertWritable(context), (error) => {
    assert.equal(error.status, 409);
    return true;
  });
});

/* -------------------------------------------------------------------------
   Capability kehtivus.
   ------------------------------------------------------------------------- */

test("a revoked grant is dead", async () => {
  const context = await resolve(
    { userId: "user_a", requestedOrganizationId: "org_1" },
    { memberships: [membership({ capabilityGrants: [grant({ revokedAt: new Date("2026-07-20") })] })] }
  );
  assert.equal(hasCapability(context, "MEMBER_ADMIN"), false);
});

test("an expired grant is dead and a future grant is not yet alive", async () => {
  const expired = await resolve(
    { userId: "user_a", requestedOrganizationId: "org_1" },
    { memberships: [membership({ capabilityGrants: [grant({ validUntil: new Date("2026-07-30") })] })] }
  );
  assert.equal(hasCapability(expired, "MEMBER_ADMIN"), false);

  const future = await resolve(
    { userId: "user_a", requestedOrganizationId: "org_1" },
    { memberships: [membership({ capabilityGrants: [grant({ validFrom: new Date("2026-09-01") })] })] }
  );
  assert.equal(hasCapability(future, "MEMBER_ADMIN"), false);
});

test("membership without capability opens no administration", async () => {
  const context = await resolve(
    { userId: "user_a", requestedOrganizationId: "org_1" },
    { memberships: [membership()] }
  );
  assert.deepEqual(context.capabilities, []);
  assert.throws(() => assertCapability(context, "MEMBER_ADMIN"), (error) => {
    assert.equal(error.status, 403);
    return true;
  });
});

test("a capability whose module is inactive does not apply", async () => {
  const grants = [grant({ capability: "INBOX_COORDINATOR", scopeType: "UNIT", scopeUnitId: "tiim_a" })];
  const withoutModule = await resolve(
    { userId: "user_a", requestedOrganizationId: "org_1" },
    { memberships: [membership({ capabilityGrants: grants })] }
  );
  assert.equal(hasCapability(withoutModule, "INBOX_COORDINATOR", { unitId: "tiim_a" }), false);

  const withModule = await resolve(
    { userId: "user_a", requestedOrganizationId: "org_1" },
    {
      memberships: [membership({ capabilityGrants: grants })],
      modules: [{ organizationId: "org_1", moduleKey: "KOV_INTAKE", status: "ACTIVE" }]
    }
  );
  assert.equal(hasCapability(withModule, "INBOX_COORDINATOR", { unitId: "tiim_a" }), true);
  assert.equal(hasActiveModule(withModule, "KOV_INTAKE"), true);
  assert.equal(hasActiveModule(withModule, "SERVICE_DELIVERY"), false);
});

test("a corrupted grant (unit scope without a unit) is rejected, not treated as organisation-wide", async () => {
  const context = await resolve(
    { userId: "user_a", requestedOrganizationId: "org_1" },
    {
      memberships: [
        membership({ capabilityGrants: [grant({ capability: "UNIT_LEAD", scopeType: "UNIT", scopeUnitId: null })] })
      ]
    }
  );
  assert.equal(hasCapability(context, "UNIT_LEAD"), false);
  assert.equal(hasCapability(context, "UNIT_LEAD", { unitId: "tiim_a" }), false);
});

/* -------------------------------------------------------------------------
   Skoop.
   ------------------------------------------------------------------------- */

test("a unit-scoped capability covers its subtree but never a sibling unit", async () => {
  const context = await resolve(
    { userId: "user_a", requestedOrganizationId: "org_1" },
    {
      memberships: [
        membership({
          capabilityGrants: [grant({ capability: "UNIT_LEAD", scopeType: "UNIT", scopeUnitId: "osakond" })]
        })
      ]
    }
  );
  assert.equal(hasCapability(context, "UNIT_LEAD", { unitId: "osakond" }), true);
  assert.equal(hasCapability(context, "UNIT_LEAD", { unitId: "tiim_a" }), true);

  const narrow = await resolve(
    { userId: "user_a", requestedOrganizationId: "org_1" },
    {
      memberships: [
        membership({
          capabilityGrants: [grant({ capability: "UNIT_LEAD", scopeType: "UNIT", scopeUnitId: "tiim_a" })]
        })
      ]
    }
  );
  assert.equal(narrow.capabilities.length, 1);
  assert.equal(hasCapability(narrow, "UNIT_LEAD", { unitId: "tiim_a" }), true);
  assert.equal(hasCapability(narrow, "UNIT_LEAD", { unitId: "tiim_b" }), false, "sibling leak");
  assert.equal(hasCapability(narrow, "UNIT_LEAD", { unitId: "osakond" }), false, "parent leak");
  // Ilma üksuseta küsimine ei tohi üksuse-skoobiga granti kunagi rahuldada.
  assert.equal(hasCapability(narrow, "UNIT_LEAD"), false);
});

test("an organisation-scoped capability covers every unit", async () => {
  const context = await resolve(
    { userId: "user_a", requestedOrganizationId: "org_1" },
    { memberships: [membership({ capabilityGrants: [grant({ capability: "MEMBER_ADMIN" })] })] }
  );
  for (const unitId of ["osakond", "tiim_a", "tiim_b", null]) {
    assert.equal(hasCapability(context, "MEMBER_ADMIN", { unitId }), true);
  }
});

/* -------------------------------------------------------------------------
   Kliendiprojektsioon.
   ------------------------------------------------------------------------- */

test("the client projection never ships the internal unit tree", async () => {
  const context = await resolve(
    { userId: "user_a", requestedOrganizationId: "org_1" },
    { memberships: [membership({ capabilityGrants: [grant()] })] }
  );
  const client = toClientContext(context);
  assert.equal(client._unitTree, undefined);
  assert.equal(JSON.stringify(client).includes("_unitTree"), false);
});

test("the client projection carries no usage metric, activity stamp or private field", async () => {
  const context = await resolve(
    { userId: "user_a", requestedOrganizationId: "org_1" },
    { memberships: [membership({ capabilityGrants: [grant()] })] }
  );
  const serialized = JSON.stringify(toClientContext(context));
  for (const forbidden of [
    "lastSeen",
    "lastActive",
    "usage",
    "conversation",
    "wellbeing",
    "riskScore",
    "messageCount"
  ]) {
    assert.equal(
      serialized.toLowerCase().includes(forbidden.toLowerCase()),
      false,
      `client context must not expose ${forbidden}`
    );
  }
});

test("the personal client projection exposes no organisation at all", () => {
  const client = toClientContext({
    kind: WorkspaceContextKind.PERSONAL,
    effectiveProductRole: "SOCIAL_WORKER",
    payerSource: PayerSource.SELF
  });
  assert.equal(client.organization, null);
  assert.deepEqual(client.capabilities, []);
});

test("hasCapability is false for a personal context — there is nothing to be an admin of", () => {
  assert.equal(hasCapability({ kind: WorkspaceContextKind.PERSONAL, capabilities: [] }, "ORG_OWNER"), false);
  assert.equal(hasCapability(null, "ORG_OWNER"), false);
});
