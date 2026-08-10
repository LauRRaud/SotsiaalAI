import assert from "node:assert/strict";
import test from "node:test";

import { deleteUserAfterFinalPracticeSweep } from "../../lib/privacy/effectivePracticeAccountCleanup.js";

/**
 * SOL-URG-02 — konto kustutamine jättis kiire abi nime, telefoni ja olukorra
 * toorteksti andmebaasi.
 *
 * Vastuvõtukriteerium ütleb sõnaselgelt: „negatiivne test peab kontrollima
 * ANDMEBAASI pärast päris kustutustehingut, mitte ainult User rea puudumist".
 * Seepärast ei loe see fake kutseid, vaid RAKENDAB nad ridadele — väide käib
 * lõppseisu, mitte kavatsuse kohta.
 */

function applyWhere(rows, where = {}) {
  return rows.filter((row) =>
    Object.entries(where).every(([key, value]) => {
      if (value && typeof value === "object" && !(value instanceof Date)) {
        if ("not" in value) return row[key] !== value.not;
        return true;
      }
      return row[key] === value;
    })
  );
}

function model(initial = []) {
  const rows = initial.map((row) => ({ ...row }));
  return {
    rows,
    async updateMany({ where, data }) {
      const matched = applyWhere(rows, where);
      matched.forEach((row) => Object.assign(row, data));
      return { count: matched.length };
    },
    async findMany({ where } = {}) {
      return applyWhere(rows, where).map((row) => ({ ...row }));
    },
    async findUnique({ where }) {
      return rows.find((row) => row.id === where.id) || null;
    },
    async deleteMany({ where }) {
      const matched = applyWhere(rows, where);
      matched.forEach((row) => rows.splice(rows.indexOf(row), 1));
      return { count: matched.length };
    }
  };
}

const urgentRow = (overrides = {}) => ({
  id: "req_1",
  authorId: "user_kustutaja",
  authorErasedAt: null,
  deskId: "desk_kov",
  municipalityId: "muni_1",
  status: "RESOLVED",
  situationVerbatim: "Ma ei saa täna õhtul koju minna ja ma ei tea, kelle poole pöörduda.",
  assistantStructured: "Masina mustand: eluasemeabi, äge vajadus.",
  contactName: "Kadri Tamm",
  contactPhone: "+372 5123 4567",
  readingTimePromise: "Loeme läbi 2 tunni jooksul.",
  sentAt: new Date("2026-08-01T20:00:00Z"),
  readAt: new Date("2026-08-01T20:40:00Z"),
  resolvedAt: new Date("2026-08-02T09:00:00Z"),
  expiresAt: new Date("2026-08-02T08:00:00Z"),
  ...overrides
});

function createDb({ urgentRequests = [], preInquiries = [] } = {}) {
  const urgentRequest = model(urgentRequests);
  const preInquiry = model(preInquiries);
  const tx = {
    async $queryRaw() {
      return [{ id: "user_kustutaja" }];
    },
    effectivePractice: {
      findMany: async () => [],
      findUnique: async () => null,
      deleteMany: async () => ({ count: 0 }),
      updateMany: async () => ({ count: 0 })
    },
    effectivePracticeReview: { updateMany: async () => ({ count: 0 }) },
    preInquiry,
    urgentRequest,
    /* SOL-SPROF-01: SOLO-profiili peitmine ja tema RAG-koopia kustutustöö käivad
       samas lukustatud tehingus, enne `user.delete`-i. Kood EI VALVA nende
       mudelite olemasolu — puuduv mudel peab kukutama, mitte vaikima. */
    serviceProviderProfile: { findMany: async () => [], updateMany: async () => ({ count: 0 }) },
    serviceMapEntry: { updateMany: async () => ({ count: 0 }) },
    dataDeletionJob: { findFirst: async () => null, create: async () => ({ id: "job_1" }) },
    user: {
      delete: async ({ where }) => ({ id: where.id })
    }
  };
  return { db: { $transaction: async (callback) => callback(tx) }, urgentRequest, preInquiry };
}

const inquiryRow = (overrides = {}) => ({
  id: "pre_1",
  authorId: "user_kustutaja",
  authorErasedAt: null,
  recipientOwnerId: null,
  status: "DRAFT",
  topic: "Eluase",
  situation: "Mul ei ole kohta, kuhu lapsega minna. Ta isa on siin ja ma kardan.",
  assessmentState: { step: 3 },
  generatedDraft: "Masina mustand.",
  userEditedDraft: "Minu parandatud tekst.",
  sentAt: null,
  ...overrides
});

test("SOL-URG-02: konto kustutus eemaldab kiire abi toorteksti ja kontaktid ANDMEBAASIST", async () => {
  const { db, urgentRequest } = createDb({ urgentRequests: [urgentRow()] });

  const result = await deleteUserAfterFinalPracticeSweep("user_kustutaja", db);

  const row = urgentRequest.rows[0];
  assert.equal(row.situationVerbatim, "", "inimese enda sõnad ei tohi üle elada tema kontot");
  assert.equal(row.assistantStructured, null, "masina mustand on sama teksti tuletis");
  assert.equal(row.contactName, "", "otseselt tuvastav nimi");
  assert.equal(row.contactPhone, "", "otseselt tuvastav telefon");
  assert.equal(row.authorId, null);
  assert.ok(row.authorErasedAt instanceof Date, "anonümiseerimise aeg peab olema kirjas");
  assert.equal(result.privacyCounts.anonymizedUrgentRequests, 1, "kustutuse raport peab tehtud tööd loendama");
});

test("SOL-URG-02: vastutusjälje skelett JÄÄB — laud, seisud ja kellaajad", async () => {
  const { db, urgentRequest } = createDb({ urgentRequests: [urgentRow()] });

  await deleteUserAfterFinalPracticeSweep("user_kustutaja", db);

  const row = urgentRequest.rows[0];
  /* Laud kannab lugemisaja lubadust ja selle täitmine on KOV-i vastutus.
     „Kas see pöördumine loeti lubatud aja jooksul läbi" peab jääma vastatavaks
     ka pärast konto kustutamist — see on põhjus, miks rida ei kustutata. */
  assert.equal(urgentRequest.rows.length, 1, "rida ei kustutata, sisu kustutatakse");
  assert.equal(row.deskId, "desk_kov");
  assert.equal(row.status, "RESOLVED");
  assert.equal(row.readingTimePromise, "Loeme läbi 2 tunni jooksul.");
  assert.deepEqual(row.readAt, new Date("2026-08-01T20:40:00Z"));
  assert.deepEqual(row.sentAt, new Date("2026-08-01T20:00:00Z"));
});

test("SOL-URG-02: teise inimese pöördumine jääb puutumata", async () => {
  const { db, urgentRequest } = createDb({
    urgentRequests: [urgentRow(), urgentRow({ id: "req_voeras", authorId: "user_teine" })]
  });

  await deleteUserAfterFinalPracticeSweep("user_kustutaja", db);

  const other = urgentRequest.rows.find((row) => row.id === "req_voeras");
  assert.equal(other.authorId, "user_teine");
  assert.match(other.situationVerbatim, /koju minna/);
  assert.equal(other.contactPhone, "+372 5123 4567");
  assert.equal(other.authorErasedAt, null);
});

test("SOL-URG-02: pöördumisteta kasutaja kustutus ei kuku ega valeta", async () => {
  const { db } = createDb({ urgentRequests: [] });
  const result = await deleteUserAfterFinalPracticeSweep("user_kustutaja", db);
  assert.equal(result.privacyCounts.anonymizedUrgentRequests, 0);
});

/* SOL-PRE-01 — saatmata mustandid. Sama tehing, sama väide, teine tabel:
   `authorId` on `SetNull`, seega konto kustutamine EI viinud neid kaasa, ja
   `updateMany` puudutas ainult `sentAt != null` ridu. Inimese olukorrakirjeldus
   ja võimalik kolmanda isiku info jäid autorita orvuks. */

test("SOL-PRE-01: saatmata eelpöördumised KUSTUTATAKSE, mitte ei jää autorita alles", async () => {
  const { db, preInquiry } = createDb({
    preInquiries: [
      inquiryRow({ id: "pre_draft", status: "DRAFT" }),
      inquiryRow({ id: "pre_ready", status: "READY" })
    ]
  });

  const result = await deleteUserAfterFinalPracticeSweep("user_kustutaja", db);

  assert.equal(preInquiry.rows.length, 0, "saatmata ridu peab pärast kustutust olema 0");
  assert.equal(result.privacyCounts.deletedUnsentPreInquiries, 2);
});

test("SOL-PRE-01: saadetud eelpöördumine puhastatakse, aga rida jääb", async () => {
  const { db, preInquiry } = createDb({
    preInquiries: [
      inquiryRow({ id: "pre_draft" }),
      inquiryRow({
        id: "pre_sent",
        status: "SENT",
        sentAt: new Date("2026-07-20T09:00:00Z"),
        recipientOwnerId: "tootaja_1"
      })
    ]
  });

  await deleteUserAfterFinalPracticeSweep("user_kustutaja", db);

  /* Vahe on sisuline: saadetud eelpöördumine on jõudnud teise inimeseni ja tema
     töö kohta jääb vastutusjälg. Saatmata mustand ei ole kellegi teise juures
     olnud — tema kohta ei ole midagi, mille eest vastutada. */
  assert.equal(preInquiry.rows.length, 1);
  const sent = preInquiry.rows[0];
  assert.equal(sent.id, "pre_sent");
  assert.equal(sent.situation, "", "sisumarkereid ei tohi järele jääda");
  assert.equal(sent.topic, null);
  assert.equal(sent.generatedDraft, null);
  assert.equal(sent.userEditedDraft, null);
  assert.equal(sent.authorId, null);
  assert.ok(sent.authorErasedAt instanceof Date);
});

test("SOL-PRE-01: võõra autori mustand jääb puutumata", async () => {
  const { db, preInquiry } = createDb({
    preInquiries: [inquiryRow(), inquiryRow({ id: "pre_voeras", authorId: "user_teine" })]
  });

  await deleteUserAfterFinalPracticeSweep("user_kustutaja", db);

  assert.equal(preInquiry.rows.length, 1);
  assert.equal(preInquiry.rows[0].id, "pre_voeras");
  assert.match(preInquiry.rows[0].situation, /lapsega minna/);
});

test("SOL-PRE-01 + SOL-URG-02: mõlemad tabelid puhastuvad ÜHES tehingus", async () => {
  const { db, preInquiry, urgentRequest } = createDb({
    preInquiries: [inquiryRow()],
    urgentRequests: [urgentRow()]
  });

  const result = await deleteUserAfterFinalPracticeSweep("user_kustutaja", db);

  assert.equal(preInquiry.rows.length, 0);
  assert.equal(urgentRequest.rows[0].situationVerbatim, "");
  assert.equal(result.privacyCounts.deletedUnsentPreInquiries, 1);
  assert.equal(result.privacyCounts.anonymizedUrgentRequests, 1);
});

/* Puuduv mudel EI TOHI muutuda vaikseks nulliks. Just „edu kinnitamine ilma
   tehtud tööta" oli leid; kui anonümiseerimist ei saa teha, peab kogu tehing
   kukkuma ja kustutustöö minema `failed` seisu, kus teda korratakse. */
test("SOL-URG-02: kui anonümiseerimist ei saa teha, kukub kogu kustutus", async () => {
  const { db } = createDb({ urgentRequests: [] });
  const broken = {
    $transaction: async (callback) =>
      callback({
        async $queryRaw() {
          return [{ id: "user_kustutaja" }];
        },
        effectivePractice: {
          findMany: async () => [],
          findUnique: async () => null,
          deleteMany: async () => ({ count: 0 }),
          updateMany: async () => ({ count: 0 })
        },
        effectivePracticeReview: { updateMany: async () => ({ count: 0 }) },
        preInquiry: { updateMany: async () => ({ count: 0 }), deleteMany: async () => ({ count: 0 }) },
        urgentRequest: {
          updateMany: async () => {
            throw new Error("connection_lost");
          }
        },
        /* SOL-SPROF-01: SOLO-profiili peitmine käib samas tehingus. */
        serviceProviderProfile: { findMany: async () => [], updateMany: async () => ({ count: 0 }) },
        serviceMapEntry: { updateMany: async () => ({ count: 0 }) },
        dataDeletionJob: { findFirst: async () => null, create: async () => ({ id: "job_1" }) },
        user: {
          delete: async () => {
            throw new Error("user delete must not be reached");
          }
        }
      })
  };
  await assert.rejects(() => deleteUserAfterFinalPracticeSweep("user_kustutaja", broken), /connection_lost/);
  assert.ok(db, "teine andmebaas jääb puutumata");
});
