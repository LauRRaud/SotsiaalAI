import assert from "node:assert/strict";
import test from "node:test";

import {
  addUrgentDeskMember,
  conditionsChanged,
  createUrgentDesk,
  listUrgentDesks,
  removeUrgentDeskMember,
  setUrgentDeskActive,
  updateUrgentDesk,
  UrgentDeskError,
  VERIFIED_CONDITION_FIELDS
} from "../../lib/urgent/deskAdmin.js";
import { deskReadiness } from "../../lib/urgent/desk.js";
import { createClient, createModel, NOW, now, READY_DESK } from "./fakePrisma.js";

function createAdminPrisma({ desks = [], members = [] } = {}) {
  /* SOL-URG-09 järel käib iga valmidust muutev adminitoiming tehingus ja võtab
     laua rea luku — sama luku, mille all pöördumise loomine valmidust hindab. */
  return createClient({
    urgentDesk: createModel(desks, "desk"),
    urgentDeskMember: createModel(members, "member"),
    municipality: createModel([{ id: "muni_1", displayName: "Harku vald" }], "muni"),
    user: createModel([{ id: "staff_1" }, { id: "staff_2" }], "user")
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

async function expectFail(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof UrgentDeskError, `oodati UrgentDeskError, saadi ${error?.name}`);
    assert.equal(error.code, code);
    return true;
  });
}

// --- Loomine -----------------------------------------------------------------

test("uus laud sünnib ALATI kinni — loomine ei ava piirkonda", async () => {
  const prisma = createAdminPrisma();
  const desk = await createUrgentDesk({
    prisma,
    municipalityId: "muni_1",
    data: VALID_CONDITIONS,
    now
  });
  assert.equal(desk.isActive, false);
  assert.equal(desk.lastVerifiedAt, null);
  assert.equal(deskReadiness(desk, { now: NOW, activeMemberCount: 1 }).ready, false);
});

test("tingimusteta lauda ei saa luua", async () => {
  const prisma = createAdminPrisma();
  const cases = [
    ["publicName", "urgent_desk.public_name_required"],
    ["openingHours", "urgent_desk.opening_hours_required"],
    ["whoMayContact", "urgent_desk.who_may_contact_required"],
    ["costToPerson", "urgent_desk.cost_required"],
    ["readingTimePromise", "urgent_desk.reading_time_required"],
    ["contactChannel", "urgent_desk.contact_channel_required"],
    ["emergencyBoundary", "urgent_desk.emergency_boundary_required"]
  ];
  for (const [field, code] of cases) {
    await expectFail(
      createUrgentDesk({
        prisma,
        municipalityId: "muni_1",
        data: { ...VALID_CONDITIONS, [field]: "   " },
        now
      }),
      code
    );
  }
  assert.equal(prisma.urgentDesk.rows.length, 0);
});

test("olematusse piirkonda lauda ei teki", async () => {
  const prisma = createAdminPrisma();
  await expectFail(
    createUrgentDesk({ prisma, municipalityId: "muni_puudub", data: VALID_CONDITIONS, now }),
    "urgent_desk.municipality_not_found"
  );
});

test("kaks lauda samale piirkonnale ja saajatüübile ei mahu", async () => {
  const prisma = createAdminPrisma();
  await createUrgentDesk({ prisma, municipalityId: "muni_1", data: VALID_CONDITIONS, now });
  await expectFail(
    createUrgentDesk({ prisma, municipalityId: "muni_1", data: VALID_CONDITIONS, now }),
    "urgent_desk.already_exists"
  );
});

test("tundmatu saajatüüp ei loo lauda", async () => {
  const prisma = createAdminPrisma();
  await expectFail(
    createUrgentDesk({ prisma, municipalityId: "muni_1", recipientType: "MIDAGI", data: VALID_CONDITIONS, now }),
    "urgent_desk.recipient_type_invalid"
  );
});

test("mõistetamatu aegumisaken ei loo lauda", async () => {
  const prisma = createAdminPrisma();
  for (const hours of [0, 200, 2.5, "kaks"]) {
    await expectFail(
      createUrgentDesk({
        prisma,
        municipalityId: "muni_1",
        data: { ...VALID_CONDITIONS, requestLifetimeHours: hours },
        now
      }),
      "urgent_desk.lifetime_invalid"
    );
  }
});

// --- Kinnituse tühistamise reegel --------------------------------------------

test("tingimuse muutmine tühistab kinnituse JA sulgeb laua", async () => {
  // See on E2 keskne reegel: vana kinnitus ei kata uut teksti. Ilma selleta
  // oleks „viimati kinnitatud" kuupäev dekoratsioon.
  const prisma = createAdminPrisma({ desks: [{ ...READY_DESK, id: "desk_1" }] });
  const updated = await updateUrgentDesk({
    prisma,
    deskId: "desk_1",
    data: { readingTimePromise: "Loeme läbi hiljemalt nädala jooksul." },
    now
  });
  assert.equal(updated.lastVerifiedAt, null);
  assert.equal(updated.isActive, false);
  assert.equal(updated.readingTimePromise, "Loeme läbi hiljemalt nädala jooksul.");
});

test("iga kinnitust kandev väli tühistab kinnituse", async () => {
  const changes = {
    publicName: "Muu nimi",
    openingHours: "E–R 9–17",
    whoMayContact: "Ainult eelnevalt hinnatud inimesed.",
    preAssessmentRequired: true,
    costToPerson: "15 eurot väljakutse.",
    readingTimePromise: "Loeme kord nädalas.",
    contactChannel: "Telefon.",
    emergencyBoundary: "Muu piir.",
    directContactAllowed: false,
    requestLifetimeHours: 6
  };
  assert.deepEqual(Object.keys(changes).sort(), [...VERIFIED_CONDITION_FIELDS].sort());

  for (const [field, value] of Object.entries(changes)) {
    const prisma = createAdminPrisma({ desks: [{ ...READY_DESK, id: "desk_1" }] });
    const updated = await updateUrgentDesk({ prisma, deskId: "desk_1", data: { [field]: value }, now });
    assert.equal(updated.lastVerifiedAt, null, `${field} ei tühistanud kinnitust`);
    assert.equal(updated.isActive, false, `${field} ei sulgenud lauda`);
  }
});

test("sisemise korralduse muutmine EI tühista kinnitust", async () => {
  // Laua omanik ja teenusekaardi seos ei muuda seda, mida inimesele öeldakse.
  const prisma = createAdminPrisma({ desks: [{ ...READY_DESK, id: "desk_1" }] });
  const updated = await updateUrgentDesk({ prisma, deskId: "desk_1", data: { ownerUserId: "staff_2" }, now });
  assert.ok(updated.lastVerifiedAt);
  assert.equal(updated.isActive, true);
  assert.equal(updated.ownerUserId, "staff_2");
});

test("muutmata tingimustega salvestus ei tühista kinnitust", async () => {
  const prisma = createAdminPrisma({ desks: [{ ...READY_DESK, id: "desk_1" }] });
  const updated = await updateUrgentDesk({ prisma, deskId: "desk_1", data: {}, now });
  assert.ok(updated.lastVerifiedAt);
  assert.equal(updated.isActive, true);
});

test("conditionsChanged tunneb tüübivahetust ära", () => {
  assert.equal(conditionsChanged({ directContactAllowed: true }, { directContactAllowed: false }), true);
  assert.equal(conditionsChanged({ requestLifetimeHours: 12 }, { requestLifetimeHours: 24 }), true);
  assert.equal(conditionsChanged({ publicName: "a" }, { publicName: "a" }), false);
});

// --- Sisselülitamine ---------------------------------------------------------

test("mittevalmis lauda ei saa sisse lülitada — ja põhjused tulevad kaasa", async () => {
  const prisma = createAdminPrisma({ desks: [{ ...READY_DESK, id: "desk_1", lastVerifiedAt: null }] });
  await assert.rejects(
    setUrgentDeskActive({ prisma, deskId: "desk_1", isActive: true, now }),
    (error) => {
      assert.equal(error.code, "urgent_desk.not_ready");
      assert.ok(Array.isArray(error.reasons));
      assert.ok(error.reasons.includes("urgent_desk.never_verified"));
      assert.ok(error.reasons.includes("urgent_desk.unstaffed"));
      return true;
    }
  );
});

test("valmis laua saab sisse lülitada", async () => {
  const prisma = createAdminPrisma({
    desks: [{ ...READY_DESK, id: "desk_1", isActive: false }],
    members: [{ id: "m1", deskId: "desk_1", userId: "staff_1", isActive: true }]
  });
  const desk = await setUrgentDeskActive({ prisma, deskId: "desk_1", isActive: true, now });
  assert.equal(desk.isActive, true);
});

test("sulgemine ei kontrolli midagi ega saa ebaõnnestuda", async () => {
  const prisma = createAdminPrisma({ desks: [{ ...READY_DESK, id: "desk_1", readingTimePromise: "" }] });
  const desk = await setUrgentDeskActive({ prisma, deskId: "desk_1", isActive: false, now });
  assert.equal(desk.isActive, false);
});

// --- Mehitajad ---------------------------------------------------------------

test("mehitaja lisamine ja eemaldamine avab ning sulgeb laua", async () => {
  const prisma = createAdminPrisma({ desks: [{ ...READY_DESK, id: "desk_1", isActive: false }] });

  await expectFail(
    setUrgentDeskActive({ prisma, deskId: "desk_1", isActive: true, now }),
    "urgent_desk.not_ready"
  );

  await addUrgentDeskMember({ prisma, deskId: "desk_1", userId: "staff_1" });
  const opened = await setUrgentDeskActive({ prisma, deskId: "desk_1", isActive: true, now });
  assert.equal(opened.isActive, true);

  await removeUrgentDeskMember({ prisma, deskId: "desk_1", userId: "staff_1" });
  const count = await prisma.urgentDeskMember.count({ where: { deskId: "desk_1", isActive: true } });
  assert.equal(count, 0);
  // Laud jääb formaalselt aktiivseks, aga valmidus on kadunud — ja valmidus on
  // see, mida pöördumise loomine kontrollib.
  const desk = await prisma.urgentDesk.findFirst({ where: { id: "desk_1" } });
  assert.equal(deskReadiness(desk, { now: NOW, activeMemberCount: 0 }).ready, false);
});

test("eemaldatud mehitaja kirje jääb alles, et vastutusjälg oleks loetav", async () => {
  const prisma = createAdminPrisma({ desks: [{ ...READY_DESK, id: "desk_1" }] });
  await addUrgentDeskMember({ prisma, deskId: "desk_1", userId: "staff_1" });
  await removeUrgentDeskMember({ prisma, deskId: "desk_1", userId: "staff_1" });
  assert.equal(prisma.urgentDeskMember.rows.length, 1);
  assert.equal(prisma.urgentDeskMember.rows[0].isActive, false);
});

test("mehitajaks ei saa panna kedagi, keda ei ole", async () => {
  const prisma = createAdminPrisma({ desks: [{ ...READY_DESK, id: "desk_1" }] });
  await expectFail(
    addUrgentDeskMember({ prisma, deskId: "desk_1", userId: "puudub" }),
    "urgent_desk.member_not_a_user"
  );
});

test("sama mehitaja teistkordne lisamine taastab ta, mitte ei dubleeri", async () => {
  const prisma = createAdminPrisma({ desks: [{ ...READY_DESK, id: "desk_1" }] });
  await addUrgentDeskMember({ prisma, deskId: "desk_1", userId: "staff_1" });
  await removeUrgentDeskMember({ prisma, deskId: "desk_1", userId: "staff_1" });
  await addUrgentDeskMember({ prisma, deskId: "desk_1", userId: "staff_1" });
  assert.equal(prisma.urgentDeskMember.rows.length, 1);
  assert.equal(prisma.urgentDeskMember.rows[0].isActive, true);
});

// --- Nimekiri ----------------------------------------------------------------

test("admini nimekiri näitab iga laua puhul, MIS on puudu", async () => {
  const prisma = createAdminPrisma({
    desks: [
      { ...READY_DESK, id: "desk_open" },
      { ...READY_DESK, id: "desk_shut", lastVerifiedAt: null, isActive: false }
    ],
    members: [{ id: "m1", deskId: "desk_open", userId: "staff_1", isActive: true }]
  });
  const rows = await listUrgentDesks({ prisma, now });
  const open = rows.find((row) => row.id === "desk_open");
  const shut = rows.find((row) => row.id === "desk_shut");

  assert.equal(open.ready, true);
  assert.equal(open.municipalityName, "Harku vald");
  assert.equal(shut.ready, false);
  assert.ok(shut.blockReasons.includes("urgent_desk.never_verified"));
  assert.ok(shut.blockReasons.includes("urgent_desk.unstaffed"));
});

test("saaja lisamine ühte piirkonda ei muuda teiste seisu", async () => {
  const prisma = createAdminPrisma({
    desks: [
      { ...READY_DESK, id: "desk_a", municipalityId: "muni_1" },
      { ...READY_DESK, id: "desk_b", municipalityId: "muni_2", isActive: false, lastVerifiedAt: null }
    ],
    members: [{ id: "m1", deskId: "desk_a", userId: "staff_1", isActive: true }]
  });
  const before = await listUrgentDesks({ prisma, now });
  await addUrgentDeskMember({ prisma, deskId: "desk_b", userId: "staff_2" });
  const after = await listUrgentDesks({ prisma, now });

  const beforeA = before.find((row) => row.id === "desk_a");
  const afterA = after.find((row) => row.id === "desk_a");
  assert.deepEqual(afterA, beforeA);
});
