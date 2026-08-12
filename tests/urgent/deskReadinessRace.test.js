import assert from "node:assert/strict";
import test from "node:test";

import {
  createUrgentRequest,
  handOverUrgentRequest,
  takeUrgentRequest,
  UrgentRequestError
} from "../../lib/urgent/request.js";
import { createPrisma, now, NOW, READY_DESK } from "./fakePrisma.js";

/**
 * SOL-URG-08 ja SOL-URG-09 — laua valmidus kontrolli ja kirjutuse vahel.
 *
 * Mõlemad leiud on sama auk kahes kohas: valmidust loeti eraldi päringutega ja
 * KIRJUTATI hiljem. Siin mõõdetakse, et kontroll käib kirjutusega samas tehingus
 * ja loeb seisu UUESTI luku all. Luku päris mõju (kaks samaaegset tehingut
 * ootavad üksteist) ei ole ühes lõimes mõõdetav — seda tõendab
 * `npm run urgent:race:probe`.
 */

const OTHER_DESK = { ...READY_DESK, id: "desk_other", municipalityId: "muni_2" };
const MEMBERS = [
  { id: "m1", deskId: "desk_kov", userId: "staff_1", isActive: true },
  { id: "m2", deskId: "desk_other", userId: "staff_other", isActive: true }
];

function prismaWithDesks() {
  return createPrisma({ desks: [READY_DESK, OTHER_DESK], members: MEMBERS });
}

const INPUT = (prisma) => ({
  prisma,
  authorId: "person_1",
  municipalityId: "muni_1",
  situationVerbatim: "Mul ei ole täna öösel kuhugi minna ja ma ei tea, mis ma teen.",
  contactName: "Kadri Tamm",
  contactPhone: "+372 5123 4567",
  safetyAnswer: false,
  now
});

/** Admin jõuab vahele PÄRAST esimest lugemist ja ENNE luku all lugemist. */
function adminActsAfterFirstDeskRead(prisma, act) {
  const model = prisma.urgentDesk;
  const original = model.findFirst.bind(model);
  let armed = true;
  model.findFirst = async (args) => {
    const row = await original(args);
    if (armed && row) {
      armed = false;
      act(row.id);
    }
    return row;
  };
}

async function expectFail(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof UrgentRequestError, `oodati UrgentRequestError, saadi ${error?.name}`);
    assert.equal(error.code, code);
    return true;
  });
}

// --- SOL-URG-09: loomine ------------------------------------------------------

test("loomine võtab laua rea luku ja loeb valmiduse uuesti", async () => {
  const prisma = prismaWithDesks();
  await createUrgentRequest(INPUT(prisma));

  const lock = prisma.rawCalls.find((call) => /FOR UPDATE/i.test(call.sql));
  assert.ok(lock, "laua rida jäi lukustamata");
  assert.deepEqual(lock.values, ["desk_kov"]);
});

test("vahepealne sulgemine ei jäta pöördumist suletud lauale", async () => {
  const prisma = prismaWithDesks();
  adminActsAfterFirstDeskRead(prisma, (deskId) => {
    Object.assign(prisma.urgentDesk.rows.find((desk) => desk.id === deskId), { isActive: false });
  });

  await expectFail(createUrgentRequest(INPUT(prisma)), "urgent_request.desk_not_available");
  assert.equal(prisma.urgentRequest.rows.length, 0);
  assert.equal(prisma.urgentRequestEvent.rows.length, 0);
});

test("vahepealne viimase mehitaja eemaldamine ei jäta pöördumist mehitamata lauale", async () => {
  const prisma = prismaWithDesks();
  adminActsAfterFirstDeskRead(prisma, (deskId) => {
    for (const member of prisma.urgentDeskMember.rows) {
      if (member.deskId === deskId) member.isActive = false;
    }
  });

  await expectFail(createUrgentRequest(INPUT(prisma)), "urgent_request.desk_not_available");
  assert.equal(prisma.urgentRequest.rows.length, 0);
});

test("vahepealne tingimusemuutus ei jäta pöördumist lubaduseta lauale", async () => {
  const prisma = prismaWithDesks();
  adminActsAfterFirstDeskRead(prisma, (deskId) => {
    // Tingimuse muutmine nullib kinnituse — täpselt see, mida deskAdmin teeb.
    Object.assign(prisma.urgentDesk.rows.find((desk) => desk.id === deskId), {
      readingTimePromise: "",
      lastVerifiedAt: null,
      isActive: false
    });
  });

  await expectFail(createUrgentRequest(INPUT(prisma)), "urgent_request.desk_not_available");
  assert.equal(prisma.urgentRequest.rows.length, 0);
});

// --- SOL-URG-08: üleandmise siht ---------------------------------------------

async function sentRequest(prisma) {
  return createUrgentRequest(INPUT(prisma));
}

test("üleandmine valmis lauale õnnestub", async () => {
  const prisma = prismaWithDesks();
  const request = await sentRequest(prisma);
  const handed = await handOverUrgentRequest({
    prisma, requestId: request.id, userId: "staff_1", targetDeskId: "desk_other", now
  });
  assert.equal(handed.handoverDeskId, "desk_other");
});

const NOT_READY_TARGETS = [
  ["mehitamata", (prisma) => {
    for (const member of prisma.urgentDeskMember.rows) {
      if (member.deskId === "desk_other") member.isActive = false;
    }
  }],
  ["aegunud kinnitusega", (prisma) => {
    Object.assign(prisma.urgentDesk.rows.find((desk) => desk.id === "desk_other"), {
      lastVerifiedAt: new Date("2025-01-01T00:00:00Z")
    });
  }],
  ["kinnitamata", (prisma) => {
    Object.assign(prisma.urgentDesk.rows.find((desk) => desk.id === "desk_other"), {
      lastVerifiedAt: null
    });
  }],
  ["ilma otsekontaktita", (prisma) => {
    Object.assign(prisma.urgentDesk.rows.find((desk) => desk.id === "desk_other"), {
      directContactAllowed: false
    });
  }]
];

for (const [label, breakTarget] of NOT_READY_TARGETS) {
  test(`üleandmine ${label} sihtlauale keeldub`, async () => {
    const prisma = prismaWithDesks();
    const request = await sentRequest(prisma);
    breakTarget(prisma);

    await expectFail(
      handOverUrgentRequest({ prisma, requestId: request.id, userId: "staff_1", targetDeskId: "desk_other", now }),
      "urgent_request.handover_target_not_ready"
    );
    const row = prisma.urgentRequest.rows[0];
    assert.equal(row.handoverDeskId ?? null, null, "üleandmine kirjutati kohale, kus vastuvõtjat ei ole");
    assert.equal(prisma.urgentRequestEvent.rows.filter((event) => event.kind === "HANDED_OVER").length, 0);
  });
}

test("sihtlaua valmiduse kadumine toimingu ajal jõuab veel kohale", async () => {
  const prisma = prismaWithDesks();
  const request = await sentRequest(prisma);

  /* Väline kontroll („kas laud on olemas ja aktiivne") on juba tehtud; siht
     sulgub alles pärast seda. Ainult tehingusisene kontroll saab selle kinni. */
  const model = prisma.urgentDesk;
  const original = model.findFirst.bind(model);
  let armed = true;
  model.findFirst = async (args) => {
    const row = await original(args);
    if (armed && row?.id === "desk_other") {
      armed = false;
      for (const member of prisma.urgentDeskMember.rows) {
        if (member.deskId === "desk_other") member.isActive = false;
      }
    }
    return row;
  };

  await expectFail(
    handOverUrgentRequest({ prisma, requestId: request.id, userId: "staff_1", targetDeskId: "desk_other", now }),
    "urgent_request.handover_target_not_ready"
  );
  assert.equal(prisma.urgentRequest.rows[0].handoverDeskId ?? null, null);
});

test("valmiduse kontroll ei sega tavalist tööd samal laual", async () => {
  const prisma = prismaWithDesks();
  const request = await sentRequest(prisma);
  const taken = await takeUrgentRequest({ prisma, requestId: request.id, userId: "staff_1", now });
  assert.equal(taken.takenByUserId, "staff_1");
  assert.equal(taken.takenAt?.getTime?.(), NOW.getTime());
});
