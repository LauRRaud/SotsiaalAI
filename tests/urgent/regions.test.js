import assert from "node:assert/strict";
import test from "node:test";

import { listOpenUrgentRegions } from "../../lib/urgent/regions.js";
import { createModel, now, READY_DESK } from "./fakePrisma.js";

function createPrisma({ desks = [], members = [] } = {}) {
  return {
    urgentDesk: createModel(desks, "desk"),
    urgentDeskMember: createModel(members, "member"),
    municipality: createModel(
      [
        { id: "muni_1", displayName: "Harku vald" },
        { id: "muni_2", displayName: "Saue vald" }
      ],
      "muni"
    )
  };
}

test("ilma lauata ei ole ühtegi piirkonda — see ON funktsiooni vaikeseis", async () => {
  const prisma = createPrisma();
  assert.deepEqual(await listOpenUrgentRegions({ prisma, now }), []);
});

test("valmis laud avab oma piirkonna ja kannab avaliku kirjelduse kaasa", async () => {
  const prisma = createPrisma({
    desks: [{ ...READY_DESK, id: "desk_1" }],
    members: [{ id: "m1", deskId: "desk_1", userId: "staff_1", isActive: true }]
  });
  const regions = await listOpenUrgentRegions({ prisma, now });
  assert.equal(regions.length, 1);
  assert.equal(regions[0].municipalityName, "Harku vald");
  assert.equal(regions[0].desk.readingTimePromise, READY_DESK.readingTimePromise);
  assert.equal(regions[0].desk.emergencyBoundary, READY_DESK.emergencyBoundary);
});

test("aktiivne aga mehitamata laud EI ava piirkonda", async () => {
  // Eelfilter võtab `isActive: true`, aga õige vastuse annab valmiduskontroll.
  const prisma = createPrisma({ desks: [{ ...READY_DESK, id: "desk_1" }] });
  assert.deepEqual(await listOpenUrgentRegions({ prisma, now }), []);
});

test("aktiivne aga kinnitamata laud EI ava piirkonda", async () => {
  const prisma = createPrisma({
    desks: [{ ...READY_DESK, id: "desk_1", lastVerifiedAt: null }],
    members: [{ id: "m1", deskId: "desk_1", userId: "staff_1", isActive: true }]
  });
  assert.deepEqual(await listOpenUrgentRegions({ prisma, now }), []);
});

test("suletud piirkond ei tule avatud piirkonna kõrvale", async () => {
  const prisma = createPrisma({
    desks: [
      { ...READY_DESK, id: "desk_open", municipalityId: "muni_1" },
      { ...READY_DESK, id: "desk_shut", municipalityId: "muni_2", directContactAllowed: false }
    ],
    members: [
      { id: "m1", deskId: "desk_open", userId: "staff_1", isActive: true },
      { id: "m2", deskId: "desk_shut", userId: "staff_2", isActive: true }
    ]
  });
  const regions = await listOpenUrgentRegions({ prisma, now });
  assert.equal(regions.length, 1);
  assert.equal(regions[0].municipalityId, "muni_1");
});

test("loend ei väljasta laua sisemisi välju", async () => {
  const prisma = createPrisma({
    desks: [{ ...READY_DESK, id: "desk_1" }],
    members: [{ id: "m1", deskId: "desk_1", userId: "staff_1", isActive: true }]
  });
  const [region] = await listOpenUrgentRegions({ prisma, now });
  assert.equal("ownerUserId" in region.desk, false);
  assert.equal("lastVerifiedAt" in region.desk, false);
  assert.equal("isActive" in region.desk, false);
});
