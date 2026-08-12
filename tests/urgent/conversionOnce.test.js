import assert from "node:assert/strict";
import test from "node:test";

import {
  convertUrgentRequestToPreInquiry,
  createUrgentRequest,
  UrgentRequestError
} from "../../lib/urgent/request.js";
import { createPrisma, now } from "./fakePrisma.js";

/**
 * SOL-URG-10 — konversioon on täpselt üks kord.
 *
 * Vana rada tegi kolm eraldi kirjutust ilma tehingu ja tingimuseta. Mõõdame
 * mõlemat poolt: kordus ei tohi luua teist mustandit, ja kaotaja tehing ei tohi
 * jätta orvuks jäänud mustandit maha.
 */

async function seeded() {
  const prisma = createPrisma();
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
  return { prisma, request };
}

async function expectFail(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof UrgentRequestError, `oodati UrgentRequestError, saadi ${error?.name}`);
    assert.equal(error.code, code);
    return true;
  });
}

test("konversioon annab ühe mustandi, ühe viite ja ühe sündmuse", async () => {
  const { prisma, request } = await seeded();
  const { request: updated, preInquiry } = await convertUrgentRequestToPreInquiry({
    prisma, requestId: request.id, userId: "person_1", now
  });

  assert.equal(prisma.preInquiry.rows.length, 1);
  assert.equal(updated.convertedPreInquiryId, preInquiry.id);
  assert.equal(preInquiry.situation, request.situationVerbatim, "verbatim-tekst muutus");
  assert.equal(prisma.urgentRequestEvent.rows.filter((event) => event.kind === "CONVERTED").length, 1);
});

test("teine katse ei tee teist mustandit", async () => {
  const { prisma, request } = await seeded();
  await convertUrgentRequestToPreInquiry({ prisma, requestId: request.id, userId: "person_1", now });

  await expectFail(
    convertUrgentRequestToPreInquiry({ prisma, requestId: request.id, userId: "person_1", now }),
    "urgent_request.already_converted"
  );
  assert.equal(prisma.preInquiry.rows.length, 1, "teine katse jättis orvuks jäänud mustandi");
  assert.equal(prisma.urgentRequestEvent.rows.filter((event) => event.kind === "CONVERTED").length, 1);
});

test("vahepealne konversioon võidab ja kaotaja mustand veereb tagasi", async () => {
  const { prisma, request } = await seeded();

  /* Võõras konversioon jõuab vahele PÄRAST meie eelkontrolli. Vana koodis
     kirjutas meie `update` tema viite lihtsalt üle ja tema mustand jäi rippuma. */
  const model = prisma.urgentRequest;
  const original = model.findFirst.bind(model);
  let armed = true;
  model.findFirst = async (args) => {
    const row = await original(args);
    if (armed && row) {
      armed = false;
      Object.assign(model.rows.find((candidate) => candidate.id === row.id), {
        convertedPreInquiryId: "pre_someone_else"
      });
      prisma.preInquiry.rows.push({ id: "pre_someone_else", authorId: "person_1", status: "DRAFT" });
    }
    return row;
  };

  await expectFail(
    convertUrgentRequestToPreInquiry({ prisma, requestId: request.id, userId: "person_1", now }),
    "urgent_request.already_converted"
  );
  assert.equal(prisma.preInquiry.rows.length, 1, "kaotaja mustand jäi alles");
  assert.equal(prisma.preInquiry.rows[0].id, "pre_someone_else");
  assert.equal(prisma.urgentRequest.rows[0].convertedPreInquiryId, "pre_someone_else");
  assert.equal(prisma.urgentRequestEvent.rows.filter((event) => event.kind === "CONVERTED").length, 0);
});

test("kukkuv sündmusekirjutus ei jäta mustandit ega viidet maha", async () => {
  const { prisma, request } = await seeded();
  prisma.urgentRequestEvent.create = async () => {
    throw new Error("audit_write_failed");
  };

  await assert.rejects(
    convertUrgentRequestToPreInquiry({ prisma, requestId: request.id, userId: "person_1", now }),
    { message: "audit_write_failed" }
  );
  assert.equal(prisma.preInquiry.rows.length, 0);
  assert.equal(prisma.urgentRequest.rows[0].convertedPreInquiryId ?? null, null);
});
