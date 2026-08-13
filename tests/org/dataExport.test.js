import assert from "node:assert/strict";
import test from "node:test";

import { collectOrganizationMembershipDataExport } from "../../lib/org/dataExport.js";
import { DATA_EXPORT_REGISTRY } from "../../lib/dataExport/registry.js";

test("SOL-ORG-19: koopia sisaldab ainult küsija liikmesuse, õiguste, üksuse ja koha elutsükli", async () => {
  const now = new Date("2026-08-13T01:00:00.000Z");
  let receivedWhere = null;
  const db = {
    organizationMembership: {
      findMany: async (query) => {
        receivedWhere = query.where;
        return [{
          id: "membership-owner",
          status: "ENDED",
          seatRole: "SOCIAL_WORKER",
          jobTitle: "Nõunik",
          startedAt: now,
          endedAt: now,
          endedReason: "roll_change",
          createdAt: now,
          updatedAt: now,
          organization: { id: "org-1", displayName: "Oma organisatsioon", legalKind: "MUNICIPALITY" },
          units: [{ id: "unit-link-1", isPrimary: true, startedAt: now, endedAt: now, unit: { id: "unit-1", name: "Oma üksus", type: "TEAM" } }],
          capabilityGrants: [{ id: "grant-1", capability: "ORG_OWNER", scopeType: "ORGANIZATION", scopeUnitId: null, validFrom: now, validUntil: null, revokedAt: now, reason: "roll_change" }],
          seatAssignments: [{ id: "seat-1", status: "ENDED", startedAt: now, endedAt: now, endedReason: "membership_ended", seatPlan: { seatRole: "SOCIAL_WORKER" } }]
        }];
      }
    }
  };

  const [file] = await collectOrganizationMembershipDataExport({ db, userId: "user-owner" });
  const text = file.content.toString("utf8");
  assert.deepEqual(receivedWhere, { userId: "user-owner" });
  assert.equal(file.count, 1);
  assert.match(text, /membership-owner|Oma organisatsioon|Oma üksus|ORG_OWNER|seat-1/);
  assert.doesNotMatch(text, /email|userId|assignedByUserId|grantedByUserId|revokedByUserId|other-member/);
});

test("SOL-ORG-19: omaniku projektsioon on kinnises andmekoopia registris", () => {
  const surface = DATA_EXPORT_REGISTRY.find((item) => item.name === "organization_memberships");
  assert.ok(surface);
  assert.equal(surface.version, "1.0");
  assert.equal(surface.thirdPartyExcluded, true);
  assert.equal(typeof surface.collect, "function");
});
