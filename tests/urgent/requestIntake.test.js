import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "../../app/api/urgent-requests/route.js";
import { createUrgentRequest, UrgentRequestError } from "../../lib/urgent/request.js";
import { createPrisma, now, READY_DESK } from "./fakePrisma.js";

/**
 * SOL-URG-03 ja SOL-URG-04 — vastuvõtuvärav.
 *
 * Mõlemad leiud on sama kuju: avalik loomise rada usaldas kliendi sõna. Üks
 * vaikselt (vastamata ohuküsimus muutus eituseks), teine valjult (kliendi tekst
 * sai laual „AI koostatud mustandi" sildi). Kriteerium nõuab mõlemat kihti, seega
 * iga juhtum mõõdetakse NII domeenis KUI päris HTTP-kutses.
 */

const VALID = Object.freeze({
  municipalityId: "muni_1",
  situationVerbatim: "Mul ei ole täna öösel kuhugi minna ja ma ei tea, mis ma teen.",
  contactName: "Kadri Tamm",
  contactPhone: "+372 5123 4567"
});

/* Vastamata küsimuse kuus kuju. `false` ja `true` on ainsad, mis EI ole teadmatus. */
const NOT_AN_ANSWER = [
  ["puuduv", undefined],
  ["null", null],
  ["string", "false"],
  ["number 0", 0]
];

// --- Domeen ------------------------------------------------------------------

for (const [label, value] of NOT_AN_ANSWER) {
  test(`domeen: ohuküsimuse vastus kujul ${label} ei ole eitus`, async () => {
    const prisma = createPrisma();
    const input = { prisma, authorId: "person_1", ...VALID, now };
    if (value !== undefined) input.safetyAnswer = value;

    await assert.rejects(createUrgentRequest(input), (error) => {
      assert.ok(error instanceof UrgentRequestError);
      assert.equal(error.code, "urgent_request.safety_answer_required");
      return true;
    });
    assert.equal(prisma.urgentRequest.rows.length, 0, "teadmatuse peale ei tohi rida tekkida");
  });
}

test("domeen: otsene „ei\" laseb edasi ja otsene „jah\" viib hädaabirajale", async () => {
  const passing = createPrisma();
  const created = await createUrgentRequest({
    prisma: passing, authorId: "person_1", ...VALID, safetyAnswer: false, now
  });
  assert.equal(created.safetyAnswer, false);
  assert.equal(passing.urgentRequest.rows.length, 1);

  const blocking = createPrisma();
  await assert.rejects(
    createUrgentRequest({ prisma: blocking, authorId: "person_1", ...VALID, safetyAnswer: true, now }),
    { code: "urgent_request.emergency_route" }
  );
  assert.equal(blocking.urgentRequest.rows.length, 0);
});

test("domeen: kliendi AI-mustand ei jõua kirjesse", async () => {
  const prisma = createPrisma();
  const created = await createUrgentRequest({
    prisma,
    authorId: "person_1",
    ...VALID,
    safetyAnswer: false,
    // Väli, mida vana kood kirjutas läbi. Funktsioon ei tunne teda enam.
    assistantStructured: "Masina mustand: isik vajab kohe eluaset.",
    now
  });
  assert.equal(created.assistantStructured, null);
  assert.equal(prisma.urgentRequest.rows[0].assistantStructured, null);
});

// --- HTTP ---------------------------------------------------------------------

function makeRequest(body) {
  return { async json() { return body; } };
}

function routeContext(prisma) {
  return { db: prisma, requireUser: async () => ({ ok: true, userId: "person_1", isAdmin: false }) };
}

/* Marsruut ei anna `now`-d domeenile edasi, seega laua kinnitus peab olema värske
   PÄRIS kella järgi — muidu mõõdaks test aegunud kinnitust, mitte ohuküsimust. */
function freshPrisma() {
  return createPrisma({ desks: [{ ...READY_DESK, lastVerifiedAt: new Date() }] });
}

for (const [label, value] of NOT_AN_ANSWER) {
  test(`HTTP: ohuküsimuse vastus kujul ${label} annab 400, mitte vaikse eituse`, async () => {
    const prisma = freshPrisma();
    const body = { ...VALID };
    if (value !== undefined) body.safetyAnswer = value;

    const response = await POST(makeRequest(body), routeContext(prisma));
    const payload = await response.json();
    assert.equal(response.status, 400, `${label}: ${JSON.stringify(payload)}`);
    assert.equal(payload.message, "urgent_request.safety_answer_required");
    assert.equal(prisma.urgentRequest.rows.length, 0);
  });
}

test("HTTP: otsene „ei\" loob pöördumise, otsene „jah\" annab hädaabivastuse", async () => {
  const passing = freshPrisma();
  const created = await POST(makeRequest({ ...VALID, safetyAnswer: false }), routeContext(passing));
  assert.equal(created.status, 201);
  assert.equal(passing.urgentRequest.rows.length, 1);

  const blocking = freshPrisma();
  const emergency = await POST(makeRequest({ ...VALID, safetyAnswer: true }), routeContext(blocking));
  const payload = await emergency.json();
  assert.equal(emergency.status, 409);
  assert.equal(payload.emergency, true);
  assert.equal(blocking.urgentRequest.rows.length, 0);
});

test("HTTP: kehas saadetud AI-mustand ignoreeritakse", async () => {
  const prisma = freshPrisma();
  const response = await POST(
    makeRequest({
      ...VALID,
      safetyAnswer: false,
      assistantStructured: "Masina mustand: ründaja tekst vastuvõtja ekraanile."
    }),
    routeContext(prisma)
  );
  assert.equal(response.status, 201);
  assert.equal(prisma.urgentRequest.rows[0].assistantStructured, null);
});
