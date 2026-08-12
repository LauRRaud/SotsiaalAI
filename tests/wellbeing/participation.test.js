import assert from "node:assert/strict";
import test from "node:test";

import { buildWellbeingAggregateDataset } from "../../lib/wellbeing/aggregate.js";
import {
  inheritWellbeingParticipation,
  participationCreateInput,
  resolveWellbeingParticipation,
  wellbeingParticipationWhere
} from "../../lib/wellbeing/participation.js";

function membershipPrisma(rows) {
  return {
    organizationMembership: {
      findMany: async (query) => {
        assert.equal(query.where.status, "ACTIVE");
        assert.equal(query.take, 2);
        return rows;
      }
    }
  };
}

test("participation comes from exactly one active membership, not from the payload", async () => {
  const prisma = membershipPrisma([
    { organizationId: "org_a", seatRole: "SOCIAL_WORKER", organization: { municipalityId: "kov_a" } }
  ]);

  assert.deepEqual(await resolveWellbeingParticipation("user_1", { prisma }), {
    organizationId: "org_a",
    municipalityId: "kov_a",
    roleGroup: "SOCIAL_WORKER"
  });
});

test("two active memberships prove nothing, so participation is absent", async () => {
  const prisma = membershipPrisma([
    { organizationId: "org_a", seatRole: "SOCIAL_WORKER", organization: { municipalityId: "kov_a" } },
    { organizationId: "org_b", seatRole: "SOCIAL_WORKER", organization: { municipalityId: "kov_b" } }
  ]);

  assert.equal(await resolveWellbeingParticipation("user_1", { prisma }), null);
  assert.equal(await resolveWellbeingParticipation("user_1", { prisma: membershipPrisma([]) }), null);
  assert.equal(await resolveWellbeingParticipation("", { prisma }), null);
});

/* Pooleldi tõendatud osalust ei ole: rida on kas täielik või teda ei ole. */
test("a membership without an organisation or seat role yields no participation", async () => {
  assert.equal(
    await resolveWellbeingParticipation("user_1", {
      prisma: membershipPrisma([{ organizationId: "org_a", seatRole: "", organization: { municipalityId: "kov_a" } }])
    }),
    null
  );
  assert.equal(
    await resolveWellbeingParticipation("user_1", {
      prisma: membershipPrisma([{ organizationId: "", seatRole: "SOCIAL_WORKER", organization: null }])
    }),
    null
  );
});

/* KOV puudumine ei tühista osalust — organisatsioon võib olla KOV-ita. */
test("a municipality-less organisation still produces participation", async () => {
  const prisma = membershipPrisma([
    { organizationId: "org_a", seatRole: "SERVICE_PROVIDER", organization: { municipalityId: null } }
  ]);

  assert.deepEqual(await resolveWellbeingParticipation("user_1", { prisma }), {
    organizationId: "org_a",
    municipalityId: null,
    roleGroup: "SERVICE_PROVIDER"
  });
});

test("participation is inherited by a correction, never re-derived", () => {
  assert.deepEqual(
    inheritWellbeingParticipation({ organizationId: "org_a", municipalityId: "kov_a", roleGroup: "SOCIAL_WORKER" }),
    { organizationId: "org_a", municipalityId: "kov_a", roleGroup: "SOCIAL_WORKER" }
  );
  assert.equal(inheritWellbeingParticipation(null), null);
  assert.equal(inheritWellbeingParticipation({ organizationId: "org_a" }), null);
  assert.equal(participationCreateInput(null), undefined);
});

test("an unbounded aggregate adds no participation join, a bounded one always does", () => {
  assert.deepEqual(wellbeingParticipationWhere({}), {});
  assert.deepEqual(wellbeingParticipationWhere({ roleGroup: "SOCIAL_WORKER" }), {
    participation: { is: { roleGroup: "SOCIAL_WORKER" } }
  });
  assert.deepEqual(
    wellbeingParticipationWhere({ organizationId: "org_a", municipalityId: "kov_a", roleGroup: "SOCIAL_WORKER" }),
    { participation: { is: { organizationId: "org_a", municipalityId: "kov_a", roleGroup: "SOCIAL_WORKER" } } }
  );
});

/* SOL-WB-02 tuum: koond ei tohi kirje ENDA `roleGroup` veergu enam küsida —
   see veerg tuleb payload'ist ja tema küsimine ongi leid. */
test("the aggregate filters on proven participation and never on the record's own roleGroup", async () => {
  let seenWhere = null;
  const prisma = {
    wellbeingRecord: {
      findMany: async (query) => {
        seenWhere = query.where;
        return [];
      }
    }
  };

  const dataset = await buildWellbeingAggregateDataset(
    { organizationId: "org_a", roleGroup: "SOCIAL_WORKER", workflowType: "quick-check" },
    { prisma }
  );

  assert.equal("roleGroup" in seenWhere, false);
  assert.deepEqual(seenWhere.participation, {
    is: { organizationId: "org_a", roleGroup: "SOCIAL_WORKER" }
  });
  assert.equal(seenWhere.aggregationEligible, true);
  assert.equal(seenWhere.visibility, "private");
  /* Vastus kannab piiri, mille all ta arvutati — laiem valim ei tohi näida
     kohaliku asutuse tulemusena (SOL-WB-01 mõju). */
  assert.equal(dataset.filters.organizationId, "org_a");
  assert.equal(dataset.filters.municipalityId, null);
});
