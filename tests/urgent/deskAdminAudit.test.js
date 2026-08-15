import assert from "node:assert/strict";
import test from "node:test";

import {
  addUrgentDeskMember,
  conditionsHash,
  createUrgentDesk,
  removeUrgentDeskMember,
  setUrgentDeskActive,
  updateUrgentDesk,
  UrgentDeskAuditAction,
  UrgentDeskError,
  verifyUrgentDesk
} from "../../lib/urgent/deskAdmin.js";
import { createClient, createModel, now, READY_DESK } from "./fakePrisma.js";

/**
 * SOL-URG-12 — kinnitajal on nimi ja adminitoimingul on jälg.
 *
 * Kaks poolt:
 *   1. KINNITUS ütleb KES ja MILLIST teksti — mitte ainult MILLAL.
 *   2. Iga valmisolekut mõjutav toiming jätab auditirea, ja see rida sünnib
 *      PÕHIMUUDATUSEGA SAMAS tehingus. Eraldi kirjutus oleks sama viga, mis
 *      SOL-URG-05: seis muutub, jälg kaob, logi ütleb et midagi ei juhtunud.
 */

const ADMIN = "admin_1";

function createAdminPrisma({ desks = [], members = [] } = {}) {
  return createClient({
    urgentDesk: createModel(desks, "desk"),
    urgentDeskMember: createModel(members, "member"),
    municipality: createModel([{ id: "muni_1", displayName: "Harku vald" }], "muni"),
    user: createModel([
      { id: "staff_1", role: "SOCIAL_WORKER", accessSuspendedAt: null },
      { id: "staff_2", role: "SOCIAL_WORKER", accessSuspendedAt: null },
      { id: ADMIN, role: "ADMIN", accessSuspendedAt: null }
    ], "user"),
    organizationMembership: createModel([
      { id: "om_1", userId: "staff_1", organizationId: "org_1", status: "ACTIVE", organization: { status: "ACTIVE", municipalityId: "muni_1" } },
      { id: "om_2", userId: "staff_2", organizationId: "org_1", status: "ACTIVE", organization: { status: "ACTIVE", municipalityId: "muni_1" } }
    ], "org_member"),
    serviceMapEntry: createModel([], "service_entry"),
    serviceProviderProfile: createModel([], "provider_profile"),
    dataAuditLog: createModel([], "audit")
  });
}

const VALID_CONDITIONS = {
  publicName: "Harku valla kiireloomuline abipalve",
  openingHours: "E–P 17.00–09.00",
  whoMayContact: "Iga Harku valla elanik.",
  costToPerson: "Tasuta.",
  readingTimePromise: "Loeme läbi hiljemalt 2 tunni jooksul.",
  contactChannel: "Vastuvõtulaud platvormil.",
  emergencyBoundary: "Vahetu ohu korral helista 112.",
  directContactAllowed: true,
  requestLifetimeHours: 12
};

function auditRows(prisma, action = null) {
  return prisma.dataAuditLog.rows.filter((row) => !action || row.action === action);
}

async function expectFail(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof UrgentDeskError, `oodati UrgentDeskError, saadi ${error?.name}`);
    assert.equal(error.code, code);
    return true;
  });
}

// --- Kinnitaja identiteet -----------------------------------------------------

test("kinnitus ütleb KES ja MILLIST teksti, mitte ainult MILLAL", async () => {
  const prisma = createAdminPrisma({ desks: [{ ...READY_DESK, id: "desk_1" }] });
  const desk = await verifyUrgentDesk({ prisma, deskId: "desk_1", actorUserId: ADMIN, now });

  assert.ok(desk.lastVerifiedAt, "aeg puudub");
  assert.equal(desk.lastVerifiedByUserId, ADMIN, "kinnitaja puudub");
  assert.equal(desk.verifiedConditionsHash, conditionsHash(desk), "kinnitatud tekstiversioon puudub");

  const audit = auditRows(prisma, UrgentDeskAuditAction.VERIFIED);
  assert.equal(audit.length, 1);
  assert.equal(audit[0].actorUserId, ADMIN);
  assert.equal(audit[0].resourceId, "desk_1");
});

test("räsi seob kinnituse TEKSTIGA — muudetud lubadus annab teise räsi", async () => {
  const base = { ...READY_DESK, id: "desk_1" };
  const changed = { ...base, readingTimePromise: "Loeme läbi nädala jooksul." };
  assert.notEqual(conditionsHash(base), conditionsHash(changed));

  // Sisemine korraldus EI ole kinnitatav tingimus, seega räsi ei liigu.
  assert.equal(conditionsHash(base), conditionsHash({ ...base, ownerUserId: "keegi_muu" }));
});

test("tingimuse muutmine võtab ka KINNITAJA, mitte ainult aja", async () => {
  const prisma = createAdminPrisma({
    desks: [{ ...READY_DESK, id: "desk_1", lastVerifiedByUserId: ADMIN, verifiedConditionsHash: "vana" }]
  });
  const updated = await updateUrgentDesk({
    prisma, deskId: "desk_1", actorUserId: ADMIN,
    data: { readingTimePromise: "Loeme läbi nädala jooksul." },
    now
  });

  assert.equal(updated.lastVerifiedAt, null);
  assert.equal(updated.lastVerifiedByUserId, null, "vana kinnitaja jäi uue teksti taha seisma");
  assert.equal(updated.verifiedConditionsHash, null);
});

// --- Tegija on kohustuslik ----------------------------------------------------

const ACTOR_REQUIRED = [
  ["kinnitamine", (prisma) => verifyUrgentDesk({ prisma, deskId: "desk_1", now })],
  ["tingimuse muutmine", (prisma) => updateUrgentDesk({ prisma, deskId: "desk_1", data: {}, now })],
  ["avamine", (prisma) => setUrgentDeskActive({ prisma, deskId: "desk_1", isActive: true, now })],
  ["sulgemine", (prisma) => setUrgentDeskActive({ prisma, deskId: "desk_1", isActive: false, now })],
  ["mehitaja lisamine", (prisma) => addUrgentDeskMember({ prisma, deskId: "desk_1", userId: "staff_1" })],
  ["mehitaja eemaldamine", (prisma) => removeUrgentDeskMember({ prisma, deskId: "desk_1", userId: "staff_1" })],
  ["laua loomine", (prisma) => createUrgentDesk({ prisma, municipalityId: "muni_1", data: VALID_CONDITIONS, now })]
];

for (const [label, run] of ACTOR_REQUIRED) {
  test(`${label} ilma tegijata ei kirjuta midagi`, async () => {
    const prisma = createAdminPrisma({
      desks: [{ ...READY_DESK, id: "desk_1" }],
      members: [{ id: "m1", deskId: "desk_1", userId: "staff_1", isActive: true }]
    });
    const before = JSON.stringify(prisma.urgentDesk.rows);

    await expectFail(run(prisma), "urgent_desk.actor_required");

    assert.equal(JSON.stringify(prisma.urgentDesk.rows), before, `${label}: seis muutus ilma tegijata`);
    assert.equal(auditRows(prisma).length, 0);
  });
}

// --- Iga toiming jätab jälje --------------------------------------------------

test("avamine, sulgemine ja mehitaja liikumine jätavad nimelise jälje", async () => {
  const prisma = createAdminPrisma({ desks: [{ ...READY_DESK, id: "desk_1", isActive: false }] });

  await addUrgentDeskMember({ prisma, deskId: "desk_1", userId: "staff_1", actorUserId: ADMIN });
  await setUrgentDeskActive({ prisma, deskId: "desk_1", isActive: true, actorUserId: ADMIN, now });
  await setUrgentDeskActive({ prisma, deskId: "desk_1", isActive: false, actorUserId: ADMIN, now });
  await removeUrgentDeskMember({ prisma, deskId: "desk_1", userId: "staff_1", actorUserId: ADMIN });

  const actions = auditRows(prisma).map((row) => row.action);
  assert.deepEqual(actions, [
    UrgentDeskAuditAction.MEMBER_ADDED,
    UrgentDeskAuditAction.ACTIVATED,
    UrgentDeskAuditAction.DEACTIVATED,
    UrgentDeskAuditAction.MEMBER_REMOVED
  ]);
  assert.ok(auditRows(prisma).every((row) => row.actorUserId === ADMIN));

  // Viimase mehitaja kadumine on see rida, mille pärast jälg olemas on.
  const removal = auditRows(prisma, UrgentDeskAuditAction.MEMBER_REMOVED)[0];
  assert.equal(removal.meta.remainingActiveMembers, 0);
});

test("tingimusemuutuse jälg ütleb MIS muutus, mitte mida seal seisis", async () => {
  const prisma = createAdminPrisma({ desks: [{ ...READY_DESK, id: "desk_1" }] });
  await updateUrgentDesk({
    prisma, deskId: "desk_1", actorUserId: ADMIN,
    data: { readingTimePromise: "Loeme läbi nädala jooksul." },
    now
  });

  const audit = auditRows(prisma, UrgentDeskAuditAction.CONDITIONS_UPDATED)[0];
  assert.deepEqual(audit.meta.changedFields, ["readingTimePromise"]);
  assert.equal(audit.meta.verificationRevoked, true);
  const serialized = JSON.stringify(audit.meta);
  assert.doesNotMatch(serialized, /nädala jooksul/, "jälge kirjutati lubaduse TEKST");
});

// --- Veasüst: jälg ja põhimuudatus on üks tehing ------------------------------

const ATOMIC = [
  ["kinnitamine", (prisma) => verifyUrgentDesk({ prisma, deskId: "desk_1", actorUserId: ADMIN, now })],
  ["tingimuse muutmine", (prisma) => updateUrgentDesk({
    prisma, deskId: "desk_1", actorUserId: ADMIN, data: { readingTimePromise: "Muu." }, now
  })],
  ["sulgemine", (prisma) => setUrgentDeskActive({ prisma, deskId: "desk_1", isActive: false, actorUserId: ADMIN, now })],
  ["mehitaja eemaldamine", (prisma) => removeUrgentDeskMember({
    prisma, deskId: "desk_1", userId: "staff_1", actorUserId: ADMIN
  })]
];

for (const [label, run] of ATOMIC) {
  test(`${label}: kukkuv auditirida veeretab põhimuudatuse tagasi`, async () => {
    const prisma = createAdminPrisma({
      desks: [{ ...READY_DESK, id: "desk_1" }],
      members: [{ id: "m1", deskId: "desk_1", userId: "staff_1", isActive: true }]
    });
    const deskBefore = JSON.stringify(prisma.urgentDesk.rows);
    const membersBefore = JSON.stringify(prisma.urgentDeskMember.rows);
    prisma.dataAuditLog.create = async () => {
      throw new Error("audit_write_failed");
    };

    await assert.rejects(run(prisma), { message: "audit_write_failed" });

    assert.equal(JSON.stringify(prisma.urgentDesk.rows), deskBefore, `${label}: laud muutus ilma jäljeta`);
    assert.equal(JSON.stringify(prisma.urgentDeskMember.rows), membersBefore, `${label}: mehitajad muutusid ilma jäljeta`);
  });
}
