import assert from "node:assert/strict";
import test from "node:test";

import {
  acceptUrgentHandover,
  authorProjection,
  createUrgentRequest,
  declineUrgentRequest,
  deskProjection,
  expireOverdueUrgentRequests,
  handOverUrgentRequest,
  markUrgentRequestRead,
  recallUrgentRequest,
  resolveUrgentRequest,
  takeUrgentRequest,
  UrgentRequestError,
  UrgentRequestStatus
} from "../../lib/urgent/request.js";
import { createPrisma, now, NOW, READY_DESK } from "./fakePrisma.js";

/**
 * SOL-URG-05, -06 ja -07 — siirete aatomsus, tingimuslikkus ja vastutaja.
 *
 * Kolm leidu, üks muudatus. Seis ja jälg sünnivad koos; oodatav seis elab
 * WHERE-tingimuses; „Võtan" paneb vastutaja PÕHIREALE.
 */

const OTHER_DESK = { ...READY_DESK, id: "desk_other", municipalityId: "muni_2" };
const MEMBERS = [
  { id: "m1", deskId: "desk_kov", userId: "staff_1", isActive: true },
  { id: "m2", deskId: "desk_kov", userId: "staff_2", isActive: true },
  { id: "m3", deskId: "desk_other", userId: "staff_other", isActive: true }
];

async function seeded(overrides = {}) {
  const prisma = createPrisma({ desks: [READY_DESK, OTHER_DESK], members: MEMBERS });
  const request = await createUrgentRequest({
    prisma,
    authorId: "person_1",
    municipalityId: "muni_1",
    situationVerbatim: "Mul ei ole täna öösel kuhugi minna ja ma ei tea, mis ma teen.",
    contactName: "Kadri Tamm",
    contactPhone: "+372 5123 4567",
    safetyAnswer: false,
    now
  });
  if (Object.keys(overrides).length) Object.assign(prisma.urgentRequest.rows[0], overrides);
  return { prisma, request, row: () => prisma.urgentRequest.rows[0] };
}

/** Vastutusjälje kirjutus kukub. Veasüst tabab TEIST sammu, mitte esimest. */
function breakEvents(prisma) {
  prisma.urgentRequestEvent.create = async () => {
    throw new Error("audit_write_failed");
  };
}

/**
 * Võõras siire jõuab vahele PÄRAST seda, kui meie kontroll rea luges.
 * Just see aken oli vana koodis kaitseta: kontroll JavaScriptis, kirjutus
 * tingimusteta.
 */
function winsRaceAfterLoad(prisma, mutate) {
  const model = prisma.urgentRequest;
  const original = model.findFirst.bind(model);
  let armed = true;
  model.findFirst = async (args) => {
    const row = await original(args);
    if (armed && row) {
      armed = false;
      Object.assign(model.rows.find((candidate) => candidate.id === row.id), mutate);
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

// --- SOL-URG-05: seis ja jälg koos või mitte kumbki ---------------------------

test("loomine: kukkuv vastutusjälg ei jäta pöördumist lauale", async () => {
  const prisma = createPrisma();
  breakEvents(prisma);
  await assert.rejects(
    createUrgentRequest({
      prisma,
      authorId: "person_1",
      municipalityId: "muni_1",
      situationVerbatim: "Mul ei ole täna öösel kuhugi minna.",
      contactName: "Kadri Tamm",
      contactPhone: "+372 5123 4567",
      safetyAnswer: false,
      now
    }),
    { message: "audit_write_failed" }
  );
  assert.equal(prisma.urgentRequest.rows.length, 0, "rida jäi ilma jäljeta alles");
});

const ATOMIC = [
  ["lugemine", (prisma, id) => markUrgentRequestRead({ prisma, requestId: id, userId: "staff_1", now })],
  ["võtmine", (prisma, id) => takeUrgentRequest({ prisma, requestId: id, userId: "staff_1", now })],
  ["keeldumine", (prisma, id) => declineUrgentRequest({ prisma, requestId: id, userId: "staff_1", reason: "Ei jõua täna.", now })],
  ["tagasivõtt", (prisma, id) => recallUrgentRequest({ prisma, requestId: id, userId: "person_1", now })],
  ["üleandmine", (prisma, id) => handOverUrgentRequest({ prisma, requestId: id, userId: "staff_1", targetDeskId: "desk_other", now })]
];

for (const [label, run] of ATOMIC) {
  test(`${label}: kukkuv vastutusjälg veeretab ka seisumuutuse tagasi`, async () => {
    const { prisma, request, row } = await seeded();
    breakEvents(prisma);
    await assert.rejects(run(prisma, request.id), { message: "audit_write_failed" });
    assert.equal(row().status, UrgentRequestStatus.SENT, `${label}: seis muutus ilma jäljeta`);
    assert.equal(row().handoverDeskId ?? null, null);
  });
}

test("aegumine: kukkuv jälg ei jäta pöördumist vaikselt aegunuks", async () => {
  const { prisma, row } = await seeded({ expiresAt: new Date(NOW.getTime() - 1000) });
  breakEvents(prisma);
  await assert.rejects(expireOverdueUrgentRequests({ prisma, now }), { message: "audit_write_failed" });
  assert.equal(row().status, UrgentRequestStatus.SENT);
});

// --- SOL-URG-06: neli võistlusrada -------------------------------------------

test("READ ↔ RECALL: vahepealne lugemine võidab tagasivõtu", async () => {
  const { prisma, request, row } = await seeded();
  winsRaceAfterLoad(prisma, { status: UrgentRequestStatus.READ, readAt: NOW });

  await expectFail(
    recallUrgentRequest({ prisma, requestId: request.id, userId: "person_1", now }),
    "urgent_request.not_recallable"
  );
  assert.equal(row().status, UrgentRequestStatus.READ, "loetud tekst muutus lugemata");
  assert.equal(prisma.urgentRequestEvent.rows.filter((event) => event.kind === "RECALLED").length, 0);
});

test("TAKE ↔ EXPIRE: vahepealne aegumine võidab võtmise", async () => {
  const { prisma, request, row } = await seeded();
  winsRaceAfterLoad(prisma, { status: UrgentRequestStatus.EXPIRED });

  await expectFail(
    takeUrgentRequest({ prisma, requestId: request.id, userId: "staff_1", now }),
    "urgent_request.not_actionable"
  );
  assert.equal(row().status, UrgentRequestStatus.EXPIRED);
  assert.equal(row().takenByUserId ?? null, null);
});

test("EXPIRE ↔ TAKE: vahepealne võtmine jätab korje sellest reast mööda", async () => {
  const { prisma, row } = await seeded({ expiresAt: new Date(NOW.getTime() - 1000) });
  // Korje valis rea; enne kirjutust võtab töötaja ta ära.
  const model = prisma.urgentRequest;
  const originalFindMany = model.findMany.bind(model);
  model.findMany = async (args) => {
    const found = await originalFindMany(args);
    Object.assign(model.rows[0], {
      status: UrgentRequestStatus.TAKEN,
      takenByUserId: "staff_1",
      takenAt: NOW
    });
    return found;
  };

  const result = await expireOverdueUrgentRequests({ prisma, now });
  assert.equal(result.count, 0, "korje aegutas rea, mille keegi oli juba võtnud");
  assert.equal(row().status, UrgentRequestStatus.TAKEN);
  assert.equal(prisma.urgentRequestEvent.rows.filter((event) => event.kind === "EXPIRED").length, 0);
});

test("TAKE ↔ TAKE: kaks töötajat ei saa mõlemad vastutust võtta", async () => {
  const { prisma, request, row } = await seeded();
  winsRaceAfterLoad(prisma, {
    status: UrgentRequestStatus.TAKEN,
    takenByUserId: "staff_2",
    takenAt: NOW
  });

  await expectFail(
    takeUrgentRequest({ prisma, requestId: request.id, userId: "staff_1", now }),
    "urgent_request.not_actionable"
  );
  assert.equal(row().takenByUserId, "staff_2", "teine võtja kirjutas esimese üle");
  assert.equal(prisma.urgentRequestEvent.rows.filter((event) => event.kind === "TAKEN").length, 0);
});

test("HANDOVER ↔ ACCEPT: vana kinnitus ei vii juhtumit uue üleandmise vale laua kätte", async () => {
  const { prisma, request, row } = await seeded();
  await handOverUrgentRequest({
    prisma, requestId: request.id, userId: "staff_1", targetDeskId: "desk_other", now
  });

  // Kinnitaja loeb rea; vahepeal antakse juhtum EDASI kolmandale lauale.
  const third = { ...READY_DESK, id: "desk_third", municipalityId: "muni_3" };
  prisma.urgentDesk.rows.push({ ...third });
  prisma.urgentDeskMember.rows.push({ id: "m4", deskId: "desk_third", userId: "staff_third", isActive: true });
  winsRaceAfterLoad(prisma, {
    handoverDeskId: "desk_third",
    handedOverAt: new Date(NOW.getTime() + 1000),
    handoverAcceptedAt: null
  });

  await expectFail(
    acceptUrgentHandover({ prisma, requestId: request.id, userId: "staff_other", now }),
    "urgent_request.handover_already_accepted"
  );
  assert.equal(row().deskId, "desk_kov", "juhtum liikus vale laua kätte");
  assert.equal(row().handoverAcceptedAt ?? null, null);
});

test("RECALL ↔ ACCEPT: samaaegne tagasivõtt ei anna juhtumit vastuvõtvale lauale", async () => {
  const { prisma, request, row } = await seeded();
  await handOverUrgentRequest({
    prisma, requestId: request.id, userId: "staff_1", targetDeskId: "desk_other", now
  });

  // Kinnitaja loeb aktiivse rea; enne tingimuslikku kirjutust võidab tagasivõtt.
  winsRaceAfterLoad(prisma, {
    status: UrgentRequestStatus.RECALLED,
    recalledAt: NOW
  });

  await assert.rejects(
    acceptUrgentHandover({ prisma, requestId: request.id, userId: "staff_other", now }),
    UrgentRequestError
  );
  assert.equal(row().status, UrgentRequestStatus.RECALLED);
  assert.equal(row().deskId, "desk_kov", "tagasivõetud juhtum liikus vastuvõtvale lauale");
  assert.equal(row().handoverAcceptedAt ?? null, null);
  assert.equal(prisma.urgentRequestEvent.rows.filter((event) => event.kind === "HANDOVER_ACCEPTED").length, 0);
});

// --- SOL-URG-07: vastutaja on põhirea peal -----------------------------------

test("„Võtan\" kirjutab vastutaja põhireale, mitte ainult sündmusesse", async () => {
  const { prisma, request, row } = await seeded();
  const taken = await takeUrgentRequest({ prisma, requestId: request.id, userId: "staff_1", now });

  assert.equal(taken.takenByUserId, "staff_1");
  assert.equal(row().takenByUserId, "staff_1");
  assert.equal(row().status, UrgentRequestStatus.TAKEN);
});

test("vastutaja on laua tööinfo, mitte pöörduja oma", async () => {
  const { prisma, request } = await seeded();
  const taken = await takeUrgentRequest({ prisma, requestId: request.id, userId: "staff_1", now });

  assert.equal(deskProjection(taken).takenByUserId, "staff_1");
  assert.equal("takenByUserId" in authorProjection(taken), false, "töötaja identiteet lekkis pöördujale");
});

test("võetud pöördumist ei saa teine töötaja vaikselt üle võtta", async () => {
  const { prisma, request, row } = await seeded();
  await takeUrgentRequest({ prisma, requestId: request.id, userId: "staff_1", now });

  await expectFail(
    takeUrgentRequest({ prisma, requestId: request.id, userId: "staff_2", now }),
    "urgent_request.not_actionable"
  );
  assert.equal(row().takenByUserId, "staff_1");
});

test("lõpetamine nõuab endiselt võetud seisu ja jätab vastutaja alles", async () => {
  const { prisma, request, row } = await seeded();
  await expectFail(
    resolveUrgentRequest({ prisma, requestId: request.id, userId: "staff_1", now }),
    "urgent_request.not_taken"
  );
  await takeUrgentRequest({ prisma, requestId: request.id, userId: "staff_1", now });
  const resolved = await resolveUrgentRequest({ prisma, requestId: request.id, userId: "staff_1", now });
  assert.equal(resolved.status, UrgentRequestStatus.RESOLVED);
  assert.equal(row().takenByUserId, "staff_1", "lõpetamine kustutas vastutaja");
});
