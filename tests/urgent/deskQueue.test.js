import assert from "node:assert/strict";
import test from "node:test";

import { DeskQueueKind, loadDeskQueue, loadRequestTrail } from "../../lib/urgent/deskQueue.js";
import { listMyUrgentDesks } from "../../lib/urgent/myDesks.js";
import { UrgentRequestError } from "../../lib/urgent/request.js";
import { createModel, NOW, now, READY_DESK } from "./fakePrisma.js";

function createPrisma({ requests = [], inquiries = [], events = [], desks = [{ ...READY_DESK, id: "desk_kov" }], members } = {}) {
  return {
    urgentDesk: createModel(desks, "desk"),
    urgentDeskMember: createModel(
      members || [{ id: "m1", deskId: "desk_kov", userId: "staff_1", isActive: true }],
      "member"
    ),
    urgentRequest: createModel(requests, "req"),
    urgentRequestEvent: createModel(events, "evt"),
    preInquiry: createModel(inquiries, "pre"),
    municipality: createModel([{ id: "muni_1", displayName: "Harku vald" }], "muni")
  };
}

const urgent = (overrides = {}) => ({
  id: "req_1",
  deskId: "desk_kov",
  status: "SENT",
  sentAt: new Date("2026-08-05T22:00:00Z"),
  expiresAt: new Date("2026-08-06T10:00:00Z"),
  readingTimePromise: "Loeme läbi 2 tunni jooksul.",
  contactName: "Kadri Tamm",
  contactPhone: "+372 5123 4567",
  situationVerbatim: "Ma ei tea, mis ma teen.",
  ...overrides
});

const inquiry = (overrides = {}) => ({
  id: "pre_1",
  recipientOwnerId: "staff_1",
  topic: "Eluase",
  status: "SENT",
  sentAt: new Date("2026-08-05T18:00:00Z"),
  openedAt: null,
  recalledAt: null,
  ...overrides
});

test("koondvaade toob mõlemad allikad ÜHTE ajajärjestusse", async () => {
  const prisma = createPrisma({ requests: [urgent()], inquiries: [inquiry()] });
  const queue = await loadDeskQueue({ prisma, userId: "staff_1", deskId: "desk_kov", now });

  assert.equal(queue.items.length, 2);
  // Kaua oodanud on ees. Eelpöördumine tuli varem, seega ta on esimene.
  assert.equal(queue.items[0].kind, DeskQueueKind.PRE_INQUIRY);
  assert.equal(queue.items[1].kind, DeskQueueKind.URGENT_REQUEST);
});

test("järjekord on ajaline ja AINULT ajaline — skoori ega prioriteeti ei ole", async () => {
  const prisma = createPrisma({
    requests: [
      urgent({ id: "req_late", sentAt: new Date("2026-08-05T23:00:00Z") }),
      urgent({ id: "req_early", sentAt: new Date("2026-08-05T20:00:00Z") })
    ]
  });
  const queue = await loadDeskQueue({ prisma, userId: "staff_1", deskId: "desk_kov", now });
  assert.deepEqual(queue.items.map((item) => item.id), ["req_early", "req_late"]);
  for (const item of queue.items) {
    assert.equal("priority" in item, false);
    assert.equal("score" in item, false);
    assert.equal("urgencyLevel" in item, false);
  }
});

test("kaks allikat kannavad KAHTE eri lubadust ja neid ei valata kokku", async () => {
  const prisma = createPrisma({ requests: [urgent()], inquiries: [inquiry()] });
  const queue = await loadDeskQueue({ prisma, userId: "staff_1", deskId: "desk_kov", now });
  const urgentRow = queue.items.find((item) => item.kind === DeskQueueKind.URGENT_REQUEST);
  const inquiryRow = queue.items.find((item) => item.kind === DeskQueueKind.PRE_INQUIRY);

  assert.equal(urgentRow.readingTimePromise, "Loeme läbi 2 tunni jooksul.");
  // `null` on siin SISULINE vastus: eelpöördumine ei kanna lugemisaja lubadust.
  assert.equal(inquiryRow.readingTimePromise, null);
});

test("nimekirjas ei ole sisu — verbatim-tekst avaneb ainult üksikvaates", async () => {
  const prisma = createPrisma({ requests: [urgent()] });
  const queue = await loadDeskQueue({ prisma, userId: "staff_1", deskId: "desk_kov", now });
  const row = queue.items[0];
  assert.equal("situationVerbatim" in row, false);
  assert.equal("assistantStructured" in row, false);
  assert.equal("contactPhone" in row, false);
});

test("üle tähtaja läinud pöördumine on nimekirjas märgitud", async () => {
  const prisma = createPrisma({
    requests: [urgent({ expiresAt: new Date("2026-08-05T21:00:00Z") })]
  });
  const queue = await loadDeskQueue({ prisma, userId: "staff_1", deskId: "desk_kov", now });
  assert.equal(queue.items[0].overdue, true);
  assert.equal(queue.overdueCount, 1);
});

test("võetud pöördumine ei ole üle tähtaja, isegi kui aeg on möödas", async () => {
  const prisma = createPrisma({
    requests: [urgent({ status: "TAKEN", expiresAt: new Date("2026-08-05T21:00:00Z") })]
  });
  const queue = await loadDeskQueue({ prisma, userId: "staff_1", deskId: "desk_kov", now });
  assert.equal(queue.items[0].overdue, false);
  assert.equal(queue.items[0].awaitingAnswer, false);
});

test("vaade on isikuline: laua liikmelisus ei ava võõraid eelpöördumisi", async () => {
  const prisma = createPrisma({
    requests: [urgent()],
    inquiries: [inquiry({ id: "pre_other", recipientOwnerId: "staff_2" })],
    members: [
      { id: "m1", deskId: "desk_kov", userId: "staff_1", isActive: true },
      { id: "m2", deskId: "desk_kov", userId: "staff_2", isActive: true }
    ]
  });
  const queue = await loadDeskQueue({ prisma, userId: "staff_1", deskId: "desk_kov", now });
  assert.equal(queue.items.filter((item) => item.kind === DeskQueueKind.PRE_INQUIRY).length, 0);
});

test("tagasi võetud eelpöördumine ei seisa laual", async () => {
  const prisma = createPrisma({
    inquiries: [inquiry({ recalledAt: new Date("2026-08-05T19:00:00Z") })]
  });
  const queue = await loadDeskQueue({ prisma, userId: "staff_1", deskId: "desk_kov", now });
  assert.equal(queue.items.length, 0);
});

test("võõras ei näe lauda", async () => {
  const prisma = createPrisma({ requests: [urgent()] });
  await assert.rejects(
    loadDeskQueue({ prisma, userId: "voeras", deskId: "desk_kov", now }),
    (error) => {
      assert.ok(error instanceof UrgentRequestError);
      assert.equal(error.code, "urgent_request.forbidden");
      return true;
    }
  );
});

test("saabuv üleandmine on nähtav, aga ei ole veel selle laua oma", async () => {
  const prisma = createPrisma({
    desks: [
      { ...READY_DESK, id: "desk_kov" },
      { ...READY_DESK, id: "desk_day", recipientType: "SERVICE_PROVIDER" }
    ],
    requests: [
      urgent({
        id: "req_handed",
        deskId: "desk_day",
        handoverDeskId: "desk_kov",
        handedOverAt: new Date("2026-08-05T23:30:00Z"),
        handoverAcceptedAt: null,
        handoverNote: "Hommikul vaja kodukülastust."
      })
    ]
  });
  const queue = await loadDeskQueue({ prisma, userId: "staff_1", deskId: "desk_kov", now });

  // Ta EI ole veel järjekorras — kuni kinnituseni vastutab endine laud.
  assert.equal(queue.items.length, 0);
  assert.equal(queue.incomingHandovers.length, 1);
  assert.equal(queue.incomingHandovers[0].id, "req_handed");
  assert.equal(queue.incomingHandovers[0].fromDeskId, "desk_day");
  assert.match(queue.incomingHandovers[0].handoverNote, /kodukülastust/);
});

test("kinnitatud üleandmine kaob saabuvate hulgast", async () => {
  const prisma = createPrisma({
    requests: [
      urgent({
        id: "req_handed",
        deskId: "desk_kov",
        handoverDeskId: "desk_kov",
        handedOverAt: NOW,
        handoverAcceptedAt: NOW
      })
    ]
  });
  const queue = await loadDeskQueue({ prisma, userId: "staff_1", deskId: "desk_kov", now });
  assert.equal(queue.incomingHandovers.length, 0);
  assert.equal(queue.items.length, 1);
});

// --- SOL-URG-01: ajalugu ei tohi tööd peita ----------------------------------

/* Vastuvõtukriteeriumi täht: vähemalt 201 lõpetatud vana rida ja üks uus SENT
   rida. Vana kood võttis `take: 200` vanimast alates, seega uus rida ei mahtunud
   valikusse KUNAGI — mitte „harva", vaid deterministlikult. */
function historyBacklog(count, { deskId = "desk_kov", from = new Date("2026-01-01T00:00:00Z") } = {}) {
  return Array.from({ length: count }, (_, index) =>
    urgent({
      id: `req_old_${String(index).padStart(4, "0")}`,
      deskId,
      status: index % 2 === 0 ? "RESOLVED" : "DECLINED",
      sentAt: new Date(from.getTime() + index * 60_000),
      expiresAt: new Date(from.getTime() + index * 60_000 + 3600_000)
    })
  );
}

test("SOL-URG-01: 201 lõpetatud vana rida ei peida uut abipalvet", async () => {
  const prisma = createPrisma({
    requests: [...historyBacklog(201), urgent({ id: "req_uus", status: "SENT", sentAt: NOW })]
  });

  const queue = await loadDeskQueue({ prisma, userId: "staff_1", deskId: "desk_kov", now });

  assert.equal(queue.items[0].id, "req_uus", "uus abipalve on ESIMENE rida, mitte 202.");
  assert.equal(queue.active.length, 1);
  assert.equal(queue.active[0].id, "req_uus");
  assert.equal(queue.awaitingCount, 1, "loendur tuleb andmebaasist, mitte lõigatud lehelt");
  assert.equal(queue.historyTotal, 201);
  assert.equal(queue.history.length, 50, "ajalugu on lehekülgitav, mitte kõik korraga");
  assert.equal(queue.hasMoreHistory, true);
  assert.equal(queue.activeTruncated, false);
});

test("SOL-URG-01: ajaloo leheküljed on stabiilsed ja katavad kogu ajaloo", async () => {
  const prisma = createPrisma({ requests: historyBacklog(120) });

  const seen = [];
  for (let offset = 0; offset < 120; offset += 50) {
    const page = await loadDeskQueue({
      prisma,
      userId: "staff_1",
      deskId: "desk_kov",
      now,
      historyOffset: offset
    });
    assert.equal(page.historyOffset, offset);
    seen.push(...page.history.map((row) => row.id));
    assert.equal(page.hasMoreHistory, offset + page.history.length < 120);
  }

  assert.equal(seen.length, 120, "iga rida esineb täpselt ühel lehel");
  assert.equal(new Set(seen).size, 120, "ükski rida ei kordu kahel lehel");
  // ASC-järjestus: vanim ees, ja leheküljed ei tohi järjekorda vahetada.
  assert.deepEqual(seen, [...seen].sort(), "leheküljed peavad kandma ühte täielikku järjestust");
});

test("SOL-URG-01: pooleliolev TAKEN on töö, mitte ajalugu", async () => {
  const prisma = createPrisma({
    requests: [
      ...historyBacklog(60),
      urgent({ id: "req_taken", status: "TAKEN", sentAt: new Date("2026-02-01T00:00:00Z") })
    ]
  });
  const queue = await loadDeskQueue({ prisma, userId: "staff_1", deskId: "desk_kov", now });

  assert.equal(queue.active.length, 1);
  assert.equal(queue.active[0].id, "req_taken");
  /* TAKEN ei oota enam vastust, seega loenduris teda ei ole — aga järjekorras
     ta ON, sest töö on pooleli. Kaks eri küsimust, kaks eri vastust. */
  assert.equal(queue.awaitingCount, 0);
  assert.equal(queue.items[0].id, "req_taken");
});

test("SOL-URG-01: üle lubatud aja loendur ei sõltu leheküljest", async () => {
  const prisma = createPrisma({
    requests: [
      ...historyBacklog(300),
      urgent({
        id: "req_hilinenud",
        status: "SENT",
        sentAt: new Date("2026-08-05T10:00:00Z"),
        expiresAt: new Date("2026-08-05T12:00:00Z")
      })
    ]
  });
  const queue = await loadDeskQueue({ prisma, userId: "staff_1", deskId: "desk_kov", now });

  assert.equal(queue.overdueCount, 1);
  assert.equal(queue.historyTotal, 300);
  assert.equal(queue.active[0].overdue, true);
});

// --- Vastutusjälg ------------------------------------------------------------

test("vastutusjälg ütleb kes-mida-millal, aga mitte mida ta luges", async () => {
  const prisma = createPrisma({
    requests: [urgent()],
    events: [
      { id: "e1", requestId: "req_1", kind: "CREATED", actorId: "person_1", createdAt: NOW, note: null },
      { id: "e2", requestId: "req_1", kind: "VIEWED", actorId: "staff_1", createdAt: NOW, note: null }
    ]
  });
  const trail = await loadRequestTrail({ prisma, userId: "staff_1", requestId: "req_1" });
  assert.equal(trail.length, 2);
  assert.deepEqual(Object.keys(trail[0]).sort(), ["actorId", "at", "id", "kind", "note"]);
  for (const row of trail) assert.ok(row.actorId);
});

test("vastuvõttev laud näeb tegevuslugu ENNE kinnitamist", async () => {
  // Soome nõue 3: üleandmine peab kandma tegevuslugu, muidu ei tea vastuvõtja,
  // mida juba tehti.
  const prisma = createPrisma({
    desks: [
      { ...READY_DESK, id: "desk_kov" },
      { ...READY_DESK, id: "desk_day", recipientType: "SERVICE_PROVIDER" }
    ],
    members: [
      { id: "m1", deskId: "desk_kov", userId: "staff_1", isActive: true },
      { id: "m2", deskId: "desk_day", userId: "day_staff", isActive: true }
    ],
    requests: [urgent({ deskId: "desk_kov", handoverDeskId: "desk_day", handedOverAt: NOW })],
    events: [{ id: "e1", requestId: "req_1", kind: "READ_MARKED", actorId: "staff_1", createdAt: NOW }]
  });
  const trail = await loadRequestTrail({ prisma, userId: "day_staff", requestId: "req_1" });
  assert.equal(trail.length, 1);
  assert.equal(trail[0].kind, "READ_MARKED");
});

test("kolmas osapool ei näe vastutusjälge", async () => {
  const prisma = createPrisma({
    requests: [urgent()],
    events: [{ id: "e1", requestId: "req_1", kind: "VIEWED", actorId: "staff_1", createdAt: NOW }]
  });
  await assert.rejects(
    loadRequestTrail({ prisma, userId: "voeras", requestId: "req_1" }),
    (error) => error.code === "urgent_request.forbidden"
  );
});

// --- Minu lauad --------------------------------------------------------------

test("laudade nimekiri tuleb liikmelisusest, mitte päringust", async () => {
  const prisma = createPrisma({
    desks: [
      { ...READY_DESK, id: "desk_kov", ownerUserId: null },
      { ...READY_DESK, id: "desk_other", recipientType: "SERVICE_PROVIDER", ownerUserId: null }
    ]
  });
  const desks = await listMyUrgentDesks({ prisma, userId: "staff_1" });
  assert.equal(desks.length, 1);
  assert.equal(desks[0].id, "desk_kov");
  assert.equal(desks[0].municipalityName, "Harku vald");
});

test("laua omanik näeb oma lauda ka ilma liikmekirjeta", async () => {
  const prisma = createPrisma({
    desks: [{ ...READY_DESK, id: "desk_kov", ownerUserId: "boss" }],
    members: []
  });
  const desks = await listMyUrgentDesks({ prisma, userId: "boss" });
  assert.equal(desks.length, 1);
});

test("suletud laud jääb oma töötajale nähtavaks", async () => {
  // Ta peab nägema, et piirkond on kinni, ja nägema seal seisvaid vanu
  // pöördumisi. Valmidus otsustab ainult uute tekkimise.
  const prisma = createPrisma({ desks: [{ ...READY_DESK, id: "desk_kov", isActive: false }] });
  const desks = await listMyUrgentDesks({ prisma, userId: "staff_1" });
  assert.equal(desks.length, 1);
  assert.equal(desks[0].isActive, false);
});

test("kellegi teise laud ei tule nimekirja", async () => {
  const prisma = createPrisma();
  assert.deepEqual(await listMyUrgentDesks({ prisma, userId: "voeras" }), []);
  assert.deepEqual(await listMyUrgentDesks({ prisma, userId: "" }), []);
});
