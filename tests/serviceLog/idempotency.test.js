/**
 * TEENUSPÄEVIK-V1 — võrguta sisestuse idempotentsus.
 *
 * MIKS SEE ON ARVE KUSIMUS, MITTE MUGAVUS: kui päring jõuab serverini, aga
 * vastus kaob (levi kadus just siis), EI SAA seade teada, kumb juhtus. Ta peab
 * uuesti proovima. Ilma idempotentsusvõtmeta tekiks ÜHEST tehtud tööst KAKS
 * arve alusdokumenti — ja kinnitatud kirjet ei tohi lihtsalt ära kustutada,
 * seega parandamine nõuaks tühistust ja põhjust.
 *
 * Kaks rada, mõlemad päris:
 *   1. kordussaatmine, mis jõuab pärast esimese salvestumist → eelkontroll;
 *   2. kaks samaaegset saatmist, mis mõlemad läbivad eelkontrolli → P2002.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createEntry } from "../../lib/serviceLog/entries.js";

const ENV = { SERVICE_LOG_ENABLED: "1" };
const PROFILE = { id: "profile-1", ownershipMode: "SOLO" };

function baseInput(overrides = {}) {
  return {
    clientDisplayName: "Mari",
    date: "2026-08-02",
    unit: "HOUR",
    quantity: "2",
    clientRequestId: "req-abc",
    ...overrides
  };
}

/**
 * Minimaalne fake, mis matkib AINULT seda, mida `createEntry` puudutab.
 * `rows` on jagatud, seega teine kutse näeb esimese kirjutust — just see teebki
 * kordussaatmise testitavaks.
 */
function makeDb({ failFirstCreateWithP2002 = false } = {}) {
  const rows = [];
  let creates = 0;
  return {
    rows,
    get creates() {
      return creates;
    },
    serviceProviderProfile: {
      findFirst: async ({ where }) =>
        where.ownerId === "user-1" && where.ownershipMode === "SOLO" ? PROFILE : null
    },
    serviceReferral: { findFirst: async () => null },
    serviceProviderService: { findFirst: async () => null },
    serviceEntry: {
      findFirst: async ({ where }) =>
        rows.find(
          (row) =>
            row.providerProfileId === where.providerProfileId &&
            row.clientRequestId === where.clientRequestId
        ) || null,
      findMany: async () => [],
      create: async ({ data }) => {
        creates += 1;
        /* Matkib võistlust: rida on juba olemas (teine seade jõudis vahele),
           aga meie eelkontroll ei näinud teda. */
        if (failFirstCreateWithP2002 && creates === 1) {
          rows.push({ ...data, id: "entry-race", createdAt: new Date(), updatedAt: new Date() });
          const error = new Error("Unique constraint failed");
          error.code = "P2002";
          throw error;
        }
        const row = {
          ...data,
          id: `entry-${creates}`,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        rows.push(row);
        return row;
      }
    }
  };
}

test("sama clientRequestId ei loo teist kirjet", async () => {
  const db = makeDb();
  const first = await createEntry("user-1", baseInput(), { db, env: ENV });
  const second = await createEntry("user-1", baseInput(), { db, env: ENV });

  assert.equal(db.rows.length, 1, "kaks saatmist ei tohi anda kahte arve alusdokumenti");
  assert.equal(second.id, first.id);
  assert.equal(second.replayed, true, "kutsuja peab saama teada, et see oli kordus");
});

/* Sama võti on replay ainult sama kanoniseeritud sisuga. Eri töö ei tohi vana
   rea taha „edukalt" kaduda. */
for (const [label, change] of [
  ["klient", { clientDisplayName: "Jüri" }],
  ["kuupäev", { date: "2026-08-03" }],
  ["kogus", { quantity: "9" }],
  ["suunamine", { referralId: "referral-other" }]
]) {
  test(`sama clientRequestId ja erinev ${label} annab 409`, async () => {
    const db = makeDb();
    await createEntry("user-1", baseInput(), { db, env: ENV });
    const error = await createEntry("user-1", baseInput(change), { db, env: ENV }).catch(
      (caught) => caught
    );

    assert.equal(error.status, 409);
    assert.equal(error.messageKey, "service_log.errors.idempotency_payload_mismatch");
    assert.equal(db.rows.length, 1);
  });
}

test("samaaegne saatmine: P2002 annab sama kirje, mitte vea", async () => {
  const db = makeDb({ failFirstCreateWithP2002: true });
  const result = await createEntry("user-1", baseInput(), { db, env: ENV });

  assert.equal(db.rows.length, 1);
  assert.equal(result.id, "entry-race");
});

/* Ilma võtmeta sisestus on tavaline võrgus sisestus ja peab endiselt looma iga
   kord uue kirje — muidu muutuks „kaks samasugust külastust" vaikselt üheks. */
test("ilma clientRequestId-ta luuakse iga kord uus kirje", async () => {
  const db = makeDb();
  await createEntry("user-1", baseInput({ clientRequestId: undefined }), { db, env: ENV });
  await createEntry("user-1", baseInput({ clientRequestId: undefined }), { db, env: ENV });

  assert.equal(db.rows.length, 2);
});
