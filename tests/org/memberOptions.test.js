import assert from "node:assert/strict";
import test from "node:test";

import { listMemberOptions } from "../../lib/org/members.js";

test("member options omit the member-administration projection", async () => {
  let query;
  const db = {
    organizationMembership: {
      findMany: async (args) => {
        query = args;
        return [
          {
            id: "membership_1",
            status: "ACTIVE",
            seatRole: "SPECIALIST",
            user: { profile: { firstName: "Mari", lastName: "Mets" } }
          }
        ];
      }
    }
  };

  const members = await listMemberOptions("org_1", { db });

  assert.deepEqual(query.where, { organizationId: "org_1", status: "ACTIVE" });
  assert.deepEqual(query.select, {
    id: true,
    status: true,
    seatRole: true,
    user: { select: { profile: { select: { firstName: true, lastName: true } } } }
  });
  assert.deepEqual(members, [
    {
      membershipId: "membership_1",
      status: "ACTIVE",
      seatRole: "SPECIALIST",
      person: { firstName: "Mari", lastName: "Mets" }
    }
  ]);
  for (const forbidden of ["email", "capabilities", "units", "startedAt", "endedAt", "userId"]) {
    assert.equal(JSON.stringify(members).includes(forbidden), false);
  }
});
