import assert from "node:assert/strict";
import test from "node:test";

import {
  acceptUrgentHandover,
  authorProjection,
  convertUrgentRequestToPreInquiry,
  createUrgentRequest,
  declineUrgentRequest,
  deskProjection,
  DESK_VISIBLE_FIELDS,
  expireOverdueUrgentRequests,
  handOverUrgentRequest,
  isEmergencyRoute,
  markUrgentRequestRead,
  recallUrgentRequest,
  resolveUrgentRequest,
  resolveUsableDesk,
  takeUrgentRequest,
  UrgentRequestError,
  UrgentRequestStatus,
  viewUrgentRequest
} from "../../lib/urgent/request.js";
import { createPrisma, now, NOW, READY_DESK } from "./fakePrisma.js";

function baseInput(prisma, overrides = {}) {
  return {
    prisma,
    authorId: "person_1",
    municipalityId: "muni_1",
    situationVerbatim: "Mul ei ole täna öösel kuhugi minna ja ma ei tea, mis ma teen.",
    contactName: "Kadri Tamm",
    contactPhone: "+372 5123 4567",
    safetyAnswer: false,
    now,
    ...overrides
  };
}

async function sentRequest(prisma, overrides = {}) {
  return createUrgentRequest(baseInput(prisma, overrides));
}

async function expectFail(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof UrgentRequestError, `oodati UrgentRequestError, saadi ${error?.name}`);
    assert.equal(error.code, code);
    return true;
  });
}

// --- Kriisilukk --------------------------------------------------------------

test("„keegi on ohus“ ei tee järjekorda — ta viib 112 juurde", async () => {
  const prisma = createPrisma();
  await expectFail(sentRequest(prisma, { safetyAnswer: true }), "urgent_request.emergency_route");
  assert.equal(prisma.urgentRequest.rows.length, 0);
});

test("eluohtlik tekst lukustab vormi ka siis, kui inimene vastas „ei“", async () => {
  const prisma = createPrisma();
  await expectFail(
    sentRequest(prisma, { situationVerbatim: "ma ei taha enam elada" }),
    "urgent_request.emergency_route"
  );
  assert.equal(prisma.urgentRequest.rows.length, 0);
});

test("kriisilukk on fail-safe: tuvastaja enda viga loetakse kriisiks", async () => {
  const prisma = createPrisma();
  const broken = () => {
    throw new Error("regex katki");
  };
  assert.equal(isEmergencyRoute({ situationVerbatim: "tavaline mure", detectCrisis: broken }), true);
  await expectFail(
    sentRequest(prisma, { detectCrisis: broken }),
    "urgent_request.emergency_route"
  );
  assert.equal(prisma.urgentRequest.rows.length, 0);
});

test("kriisilukk käib ENNE väljade valideerimist", async () => {
  // Eluohtlikus olukorras ei tohi inimene saada veateadet puuduva telefoni
  // kohta — ta peab saama hädaabinumbri.
  const prisma = createPrisma();
  await expectFail(
    sentRequest(prisma, { safetyAnswer: true, contactName: "", contactPhone: "" }),
    "urgent_request.emergency_route"
  );
});

// --- Laud on lüliti ----------------------------------------------------------

test("saajata piirkonnas ei saa pöördumist luua ühegi rajaga", async () => {
  const prisma = createPrisma({ desks: [] });
  await expectFail(sentRequest(prisma), "urgent_request.desk_not_available");
  assert.equal(prisma.urgentRequest.rows.length, 0);
});

test("väljalülitatud laud keeldub serveris, mitte liideses", async () => {
  const prisma = createPrisma({ desks: [{ ...READY_DESK, isActive: false }] });
  await expectFail(sentRequest(prisma), "urgent_request.desk_not_available");
  assert.equal(prisma.urgentRequest.rows.length, 0);
});

test("mehitamata laud keeldub", async () => {
  const prisma = createPrisma({ members: [] });
  await expectFail(sentRequest(prisma), "urgent_request.desk_not_available");
});

test("lugemisajata laud keeldub", async () => {
  const prisma = createPrisma({ desks: [{ ...READY_DESK, readingTimePromise: "" }] });
  await expectFail(sentRequest(prisma), "urgent_request.desk_not_available");
});

test("nähtavuspäring ja loomine kasutavad SAMA reeglit", async () => {
  const open = createPrisma();
  const closed = createPrisma({ desks: [{ ...READY_DESK, directContactAllowed: false }] });

  const openResolved = await resolveUsableDesk({ prisma: open, municipalityId: "muni_1", now });
  const closedResolved = await resolveUsableDesk({ prisma: closed, municipalityId: "muni_1", now });

  assert.equal(openResolved.ready, true);
  assert.equal(closedResolved.ready, false);
  await expectFail(sentRequest(closed), "urgent_request.desk_not_available");
});

test("piirkonnata päring ei ava midagi", async () => {
  const prisma = createPrisma();
  const resolved = await resolveUsableDesk({ prisma, municipalityId: "", now });
  assert.equal(resolved.ready, false);
  await expectFail(sentRequest(prisma, { municipalityId: "" }), "urgent_request.desk_not_available");
});

// --- Neli välja --------------------------------------------------------------

test("neli välja on kohustuslikud ja igaüks annab oma vea", async () => {
  const prisma = createPrisma();
  await expectFail(sentRequest(prisma, { situationVerbatim: "  " }), "urgent_request.situation_required");
  await expectFail(sentRequest(prisma, { contactName: "" }), "urgent_request.contact_name_required");
  await expectFail(sentRequest(prisma, { contactPhone: "" }), "urgent_request.contact_phone_required");
  await expectFail(sentRequest(prisma, { contactPhone: "helista" }), "urgent_request.contact_phone_required");
  await expectFail(sentRequest(prisma, { authorId: "" }), "urgent_request.author_required");
  assert.equal(prisma.urgentRequest.rows.length, 0);
});

// --- Loomine ja külmutatud lubadus -------------------------------------------

test("saadetud pöördumine kannab laua lubadust ja aegumist", async () => {
  const prisma = createPrisma();
  const request = await sentRequest(prisma);

  assert.equal(request.status, UrgentRequestStatus.SENT);
  assert.equal(request.deskId, "desk_kov");
  assert.equal(request.readingTimePromise, READY_DESK.readingTimePromise);
  assert.equal(request.safetyAnswer, false);
  // 12 tundi laua seadistusest, mitte globaalsest konstandist.
  assert.equal(request.expiresAt.getTime() - NOW.getTime(), 12 * 60 * 60 * 1000);

  const events = prisma.urgentRequestEvent.rows;
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, "CREATED");
  assert.equal(events[0].actorId, "person_1");
});

test("inimese enda sõnad lähevad läbi MUUTMATA", async () => {
  const prisma = createPrisma();
  const words = "ma ei tea, mis ma teen";
  const request = await sentRequest(prisma, { situationVerbatim: words });
  assert.equal(request.situationVerbatim, words);
});

test("hilisem laua muudatus EI muuda seda, mida inimesele lubati", async () => {
  const prisma = createPrisma();
  const request = await sentRequest(prisma);
  await prisma.urgentDesk.update({
    where: { id: "desk_kov" },
    data: { readingTimePromise: "Loeme läbi nädala jooksul." }
  });
  const stored = await prisma.urgentRequest.findFirst({ where: { id: request.id } });
  assert.equal(stored.readingTimePromise, READY_DESK.readingTimePromise);
});

test("AI mustand seisab verbatim-teksti KÕRVAL, mitte selle asemel", async () => {
  const prisma = createPrisma();
  const request = await sentRequest(prisma);
  /* SOL-URG-04 järel EI SAA mustandit loomise kaudu sisse panna — avalik rada ei
     usalda seda välja enam. Kuvalepe (kaks eri välja, mitte üks) kehtib aga
     endiselt pärandridade ja tulevase serveripoolse mustandi kohta, seega väärtus
     pannakse siin otse reale, mitte päringu kehast. */
  const projection = deskProjection({
    ...request,
    assistantStructured: "Isik väljendas ebakindlust ööbimiskoha osas."
  });
  assert.equal(projection.situationVerbatim, "Mul ei ole täna öösel kuhugi minna ja ma ei tea, mis ma teen.");
  assert.equal(projection.assistantStructured, "Isik väljendas ebakindlust ööbimiskoha osas.");
  assert.notEqual(projection.situationVerbatim, projection.assistantStructured);
  assert.deepEqual(Object.keys(projection).sort(), [...DESK_VISIBLE_FIELDS].sort());
});

// --- Ligipääs ----------------------------------------------------------------

test("võõras ei saa laua toiminguid teha", async () => {
  const prisma = createPrisma();
  const request = await sentRequest(prisma);
  for (const call of [
    () => viewUrgentRequest({ prisma, requestId: request.id, userId: "voeras", now }),
    () => markUrgentRequestRead({ prisma, requestId: request.id, userId: "voeras", now }),
    () => takeUrgentRequest({ prisma, requestId: request.id, userId: "voeras", now }),
    () => declineUrgentRequest({ prisma, requestId: request.id, userId: "voeras", reason: "x", now })
  ]) {
    await expectFail(call(), "urgent_request.forbidden");
  }
});

test("laua omanik loeb mehitajaks", async () => {
  const prisma = createPrisma({ members: [] });
  // Omanikuga laud on ilma mehitajata endiselt kinni, aga kui mehitaja on
  // olemas, pääseb omanik ligi.
  const withMember = createPrisma();
  const request = await sentRequest(withMember);
  const read = await markUrgentRequestRead({
    prisma: withMember,
    requestId: request.id,
    userId: "desk_owner",
    now
  });
  assert.equal(read.status, UrgentRequestStatus.READ);
  assert.equal(prisma.urgentRequest.rows.length, 0);
});

test("iga vaatamine jätab jälje, ka siis kui midagi ei tehtud", async () => {
  const prisma = createPrisma();
  const request = await sentRequest(prisma);
  await viewUrgentRequest({ prisma, requestId: request.id, userId: "staff_1", now });
  const viewed = prisma.urgentRequestEvent.rows.filter((row) => row.kind === "VIEWED");
  assert.equal(viewed.length, 1);
  assert.equal(viewed[0].actorId, "staff_1");
});

// --- Laua toimingud ----------------------------------------------------------

test("lugemine, võtmine ja lõpetamine käivad järjekorras", async () => {
  const prisma = createPrisma();
  const request = await sentRequest(prisma);

  const read = await markUrgentRequestRead({ prisma, requestId: request.id, userId: "staff_1", now });
  assert.equal(read.status, UrgentRequestStatus.READ);
  assert.ok(read.readAt);

  await expectFail(
    markUrgentRequestRead({ prisma, requestId: request.id, userId: "staff_1", now }),
    "urgent_request.not_sent"
  );

  const taken = await takeUrgentRequest({ prisma, requestId: request.id, userId: "staff_1", now });
  assert.equal(taken.status, UrgentRequestStatus.TAKEN);

  const resolved = await resolveUrgentRequest({ prisma, requestId: request.id, userId: "staff_1", now });
  assert.equal(resolved.status, UrgentRequestStatus.RESOLVED);
});

test("lõpetada saab ainult võetud pöördumist", async () => {
  const prisma = createPrisma();
  const request = await sentRequest(prisma);
  await expectFail(
    resolveUrgentRequest({ prisma, requestId: request.id, userId: "staff_1", now }),
    "urgent_request.not_taken"
  );
});

test("keeldumine ilma põhjuseta ei ole võimalik — vaikus on halvim tulemus", async () => {
  const prisma = createPrisma();
  const request = await sentRequest(prisma);
  await expectFail(
    declineUrgentRequest({ prisma, requestId: request.id, userId: "staff_1", reason: "   ", now }),
    "urgent_request.decline_reason_required"
  );

  const declined = await declineUrgentRequest({
    prisma,
    requestId: request.id,
    userId: "staff_1",
    reason: "Öine valve on täna mehitamata, palun helista hommikul 9-st.",
    now
  });
  assert.equal(declined.status, UrgentRequestStatus.DECLINED);
  assert.match(declined.declineReason, /mehitamata/);
  assert.equal(authorProjection(declined).declineReason, declined.declineReason);
});

test("lõppseisus pöördumist ei saa uuesti liigutada", async () => {
  const prisma = createPrisma();
  const request = await sentRequest(prisma);
  await declineUrgentRequest({ prisma, requestId: request.id, userId: "staff_1", reason: "ei jõua", now });
  await expectFail(
    takeUrgentRequest({ prisma, requestId: request.id, userId: "staff_1", now }),
    "urgent_request.not_actionable"
  );
});

// --- Tagasivõtt --------------------------------------------------------------

test("tagasi saab võtta kuni lugemiseni, pärast mitte", async () => {
  const prisma = createPrisma();
  const first = await sentRequest(prisma);
  const recalled = await recallUrgentRequest({ prisma, requestId: first.id, userId: "person_1", now });
  assert.equal(recalled.status, UrgentRequestStatus.RECALLED);

  const second = await sentRequest(prisma);
  await markUrgentRequestRead({ prisma, requestId: second.id, userId: "staff_1", now });
  await expectFail(
    recallUrgentRequest({ prisma, requestId: second.id, userId: "person_1", now }),
    "urgent_request.not_recallable"
  );
});

test("võõras ei saa kellegi teise pöördumist tagasi võtta", async () => {
  const prisma = createPrisma();
  const request = await sentRequest(prisma);
  await expectFail(
    recallUrgentRequest({ prisma, requestId: request.id, userId: "keegi_muu", now }),
    "urgent_request.forbidden"
  );
});

// --- Aegumine ----------------------------------------------------------------

test("aegumine puutub ainult neid, kelle kohta laud veel vastust võlgneb", async () => {
  const prisma = createPrisma();
  const waiting = await sentRequest(prisma);
  const read = await sentRequest(prisma);
  const taken = await sentRequest(prisma);

  await markUrgentRequestRead({ prisma, requestId: read.id, userId: "staff_1", now });
  await takeUrgentRequest({ prisma, requestId: taken.id, userId: "staff_1", now });

  const later = () => new Date(NOW.getTime() + 13 * 60 * 60 * 1000);
  const result = await expireOverdueUrgentRequests({ prisma, now: later });

  assert.equal(result.count, 2);
  assert.ok(result.expired.includes(waiting.id));
  assert.ok(result.expired.includes(read.id));
  assert.equal(result.expired.includes(taken.id), false);

  const stillTaken = await prisma.urgentRequest.findFirst({ where: { id: taken.id } });
  assert.equal(stillTaken.status, UrgentRequestStatus.TAKEN);
});

test("aegumine ei ole vaikne — ta jätab sündmuse", async () => {
  const prisma = createPrisma();
  const request = await sentRequest(prisma);
  const later = () => new Date(NOW.getTime() + 13 * 60 * 60 * 1000);
  await expireOverdueUrgentRequests({ prisma, now: later });
  const expired = prisma.urgentRequestEvent.rows.filter((row) => row.kind === "EXPIRED");
  assert.equal(expired.length, 1);
  assert.equal(expired[0].requestId, request.id);
});

test("enne tähtaega ei aegu miski", async () => {
  const prisma = createPrisma();
  await sentRequest(prisma);
  const result = await expireOverdueUrgentRequests({
    prisma,
    now: () => new Date(NOW.getTime() + 60 * 60 * 1000)
  });
  assert.equal(result.count, 0);
});

// --- Üleandmine --------------------------------------------------------------

const DAY_DESK = {
  ...READY_DESK,
  id: "desk_day",
  municipalityId: "muni_1",
  recipientType: "SERVICE_PROVIDER",
  publicName: "Harku valla päevane sotsiaaltöö"
};

function prismaWithTwoDesks() {
  return createPrisma({
    desks: [READY_DESK, DAY_DESK],
    members: [
      { id: "m1", deskId: "desk_kov", userId: "staff_1", isActive: true },
      { id: "m2", deskId: "desk_day", userId: "day_staff", isActive: true }
    ]
  });
}

test("üleandmine üksi ei liiguta vastutust — vaja on vastuvõtukinnitust", async () => {
  const prisma = prismaWithTwoDesks();
  const request = await sentRequest(prisma);

  const handed = await handOverUrgentRequest({
    prisma,
    requestId: request.id,
    userId: "staff_1",
    targetDeskId: "desk_day",
    note: "Öine juhtum, hommikul vaja kodukülastust.",
    now
  });
  assert.equal(handed.handoverDeskId, "desk_day");
  assert.ok(handed.handedOverAt);
  assert.equal(handed.handoverAcceptedAt, null);
  // Kuni kinnituseni vastutab endine laud.
  assert.equal(handed.deskId, "desk_kov");

  const accepted = await acceptUrgentHandover({
    prisma,
    requestId: request.id,
    userId: "day_staff",
    now
  });
  assert.equal(accepted.deskId, "desk_day");
  assert.ok(accepted.handoverAcceptedAt);
});

test("üleandmist ei saa kinnitada see, kes vastuvõtvas lauas ei istu", async () => {
  const prisma = prismaWithTwoDesks();
  const request = await sentRequest(prisma);
  await handOverUrgentRequest({
    prisma,
    requestId: request.id,
    userId: "staff_1",
    targetDeskId: "desk_day",
    now
  });
  await expectFail(
    acceptUrgentHandover({ prisma, requestId: request.id, userId: "staff_1", now }),
    "urgent_request.forbidden"
  );
});

test("tagasivõetud üleandmist ei saa kinnitada", async () => {
  const prisma = prismaWithTwoDesks();
  const request = await sentRequest(prisma);
  await handOverUrgentRequest({
    prisma,
    requestId: request.id,
    userId: "staff_1",
    targetDeskId: "desk_day",
    now
  });
  await recallUrgentRequest({ prisma, requestId: request.id, userId: "person_1", now });

  await expectFail(
    acceptUrgentHandover({ prisma, requestId: request.id, userId: "day_staff", now }),
    "urgent_request.not_actionable"
  );
  assert.equal(prisma.urgentRequest.rows[0].deskId, "desk_kov");
  assert.equal(prisma.urgentRequest.rows[0].handoverAcceptedAt, null);
});

test("üleandmine iseendale ja tundmatule lauale on keelatud", async () => {
  const prisma = prismaWithTwoDesks();
  const request = await sentRequest(prisma);
  await expectFail(
    handOverUrgentRequest({ prisma, requestId: request.id, userId: "staff_1", targetDeskId: "desk_kov", now }),
    "urgent_request.handover_target_same"
  );
  await expectFail(
    handOverUrgentRequest({ prisma, requestId: request.id, userId: "staff_1", targetDeskId: "puudub", now }),
    "urgent_request.handover_target_not_found"
  );
  await expectFail(
    handOverUrgentRequest({ prisma, requestId: request.id, userId: "staff_1", targetDeskId: "", now }),
    "urgent_request.handover_target_required"
  );
});

// --- Konversioon -------------------------------------------------------------

test("esiuks -> tuba: konversioon ei kaota verbatim-teksti", async () => {
  const prisma = createPrisma();
  const words = "Mul ei ole täna öösel kuhugi minna ja ma ei tea, mis ma teen.";
  const request = await sentRequest(prisma);

  const { request: updated, preInquiry } = await convertUrgentRequestToPreInquiry({
    prisma,
    requestId: request.id,
    userId: "person_1",
    now
  });

  assert.equal(preInquiry.situation, words);
  // MUSTAND, mitte saadetud pöördumine: konversioon ei saada kellegi eest midagi.
  assert.equal(preInquiry.status, "DRAFT");
  assert.equal(updated.convertedPreInquiryId, preInquiry.id);

  await expectFail(
    convertUrgentRequestToPreInquiry({ prisma, requestId: request.id, userId: "person_1", now }),
    "urgent_request.already_converted"
  );
});

test("konversiooni saab teha ainult pöörduja ise", async () => {
  const prisma = createPrisma();
  const request = await sentRequest(prisma);
  await expectFail(
    convertUrgentRequestToPreInquiry({ prisma, requestId: request.id, userId: "staff_1", now }),
    "urgent_request.forbidden"
  );
});

// --- Inimese vaade -----------------------------------------------------------

test("inimene näeb, kas keegi veel vastab", async () => {
  const prisma = createPrisma();
  const request = await sentRequest(prisma);
  assert.equal(authorProjection(request).awaitingAnswer, true);
  assert.equal(authorProjection(request).canRecall, true);

  const read = await markUrgentRequestRead({ prisma, requestId: request.id, userId: "staff_1", now });
  assert.equal(authorProjection(read).awaitingAnswer, true);
  assert.equal(authorProjection(read).canRecall, false);

  const taken = await takeUrgentRequest({ prisma, requestId: request.id, userId: "staff_1", now });
  assert.equal(authorProjection(taken).awaitingAnswer, false);
});

test("inimese vaates ei ole laua sisemisi välju", async () => {
  const prisma = createPrisma();
  const request = await sentRequest(prisma);
  const projection = authorProjection(request);
  assert.equal("contactPhone" in projection, false);
  assert.equal("deskId" in projection, false);
  assert.equal("assistantStructured" in projection, false);
});
