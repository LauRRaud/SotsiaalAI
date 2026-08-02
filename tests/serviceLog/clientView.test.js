/**
 * TEENUSPÄEVIK E7 — kliendi kuuvaade ja digikinnitus.
 *
 * Kaks asja on siin kallid, kui nad valesti lähevad:
 *   1. klient näeb midagi, mida ta ei tohiks (osutaja faktimärge);
 *   2. kinnitus tekib või kaob vaikselt — kinnitatud arve alusdokument on
 *      millegi alus ja tema seis ei tohi olla kogemata muutunud.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { confirmClientMonth, readClientMonth } from "../../lib/serviceLog/clientView.js";

const ENV = { SERVICE_LOG_ENABLED: "1", SERVICE_LOG_CLIENT_VIEW: "1" };

function makeDb(rows = []) {
  const calls = [];
  return {
    calls,
    serviceEntry: {
      findMany: async ({ where, select }) => {
        calls.push({ kind: "findMany", where, select });
        return rows.filter(
          (row) =>
            row.clientUserId === where.clientUserId &&
            row.status === where.status &&
            row.date >= where.date.gte &&
            row.date < where.date.lt
        );
      },
      updateMany: async ({ where, data }) => {
        calls.push({ kind: "updateMany", where, data });
        let count = 0;
        for (const row of rows) {
          if (row.clientUserId !== where.clientUserId) continue;
          if (row.status !== where.status) continue;
          if (row.date < where.date.gte || row.date >= where.date.lt) continue;
          if (row.confirmedByClientAt !== null) continue;
          row.confirmedByClientAt = data.confirmedByClientAt;
          count += 1;
        }
        return { count };
      }
    }
  };
}

function row(overrides = {}) {
  return {
    id: "entry-1",
    clientUserId: "client-1",
    status: "FINAL",
    date: new Date(Date.UTC(2026, 7, 5)),
    unit: "HOUR",
    quantity: 2,
    confirmedByClientAt: null,
    providerProfile: { organizationName: "OÜ Hooldus" },
    ...overrides
  };
}

test("klient näeb oma kuu kirjeid koos osutaja nimega", async () => {
  const report = await readClientMonth("client-1", { month: "2026-08" }, { db: makeDb([row()]), env: ENV });
  assert.equal(report.entries.length, 1);
  assert.equal(report.entries[0].providerName, "OÜ Hooldus");
  assert.deepEqual(report.totals, { HOUR: 2 });
  assert.equal(report.confirmed, false);
});

/* OSUTAJA FAKTIMÄRGE EI OLE KLIENDI OMA. Kui klient teda loeks, hakkaks
   osutaja kirjutama kliendile, mitte aruandele — ja aruanne muutuks halvemaks. */
test("märkust ega päritolumärgist kliendile ei küsita ega anta", async () => {
  const db = makeDb([row({ note: "uks ei avanenud", noteProvenance: "OBSERVED" })]);
  const report = await readClientMonth("client-1", { month: "2026-08" }, { db, env: ENV });
  const select = db.calls.find((call) => call.kind === "findMany").select;
  assert.equal(select.note, undefined, "note ei tohi olla päringus");
  assert.equal(select.noteProvenance, undefined);
  const json = JSON.stringify(report);
  assert.ok(!json.includes("uks ei avanenud"));
});

/* Mustand on osutaja pooleliolev töö. Kliendile näitamine tähendaks numbrit,
   mis võib veel muutuda, ja kinnitust millelegi, mida veel ei ole. */
test("ainult kinnitatud kirjed jõuavad kliendini", async () => {
  const db = makeDb([row(), row({ id: "entry-2", status: "DRAFT" })]);
  const report = await readClientMonth("client-1", { month: "2026-08" }, { db, env: ENV });
  assert.equal(report.entries.length, 1);
  assert.equal(db.calls[0].where.status, "FINAL");
});

test("teise kliendi kirjeid ei ole olemas", async () => {
  const db = makeDb([row({ clientUserId: "client-2" })]);
  const report = await readClientMonth("client-1", { month: "2026-08" }, { db, env: ENV });
  assert.equal(report.entries.length, 0);
});

test("kinnitamine märgib kuu ja korduskinnitus ei muuda enam midagi", async () => {
  const rows = [row(), row({ id: "entry-2" })];
  const db = makeDb(rows);
  const first = await confirmClientMonth("client-1", { month: "2026-08" }, { db, env: ENV });
  assert.equal(first.confirmedNow, 2);

  const second = await confirmClientMonth("client-1", { month: "2026-08" }, { db, env: ENV });
  assert.equal(second.confirmedNow, 0, "kordussaatmine ei ole viga ega muutus");

  const report = await readClientMonth("client-1", { month: "2026-08" }, { db, env: ENV });
  assert.equal(report.confirmed, true);
  assert.equal(report.confirmedCount, 2);
});

/* Tühja kuud ei saa kinnitatuks lugeda: `every` tagastab tühjal massiivil
   `true` ja ilma selle kaitseta väidaks vaade „oled kinnitanud" mitte millegi
   kohta. */
test("tühi kuu ei ole kinnitatud kuu", async () => {
  const report = await readClientMonth("client-1", { month: "2026-08" }, { db: makeDb([]), env: ENV });
  assert.equal(report.entries.length, 0);
  assert.equal(report.confirmed, false);
});

/* Väljas lüliti annab 404, mitte 403: kliendile ei tohi paista, et tema
   andmetega on kuskil vaade, mida talle lihtsalt ei näidata. */
test("väljas kliendivaade on eristamatu olematust pinnast", async () => {
  const db = makeDb([row()]);
  for (const env of [{}, { SERVICE_LOG_ENABLED: "1" }, { SERVICE_LOG_CLIENT_VIEW: "1" }]) {
    const error = await readClientMonth("client-1", { month: "2026-08" }, { db, env }).catch((e) => e);
    assert.equal(error.status, 404);
  }
});

test("vigane kuu ei jõua andmebaasi", async () => {
  const db = makeDb([row()]);
  for (const month of ["2026-13", "august", "", "2026-8"]) {
    const error = await readClientMonth("client-1", { month }, { db, env: ENV }).catch((e) => e);
    assert.equal(error.status, 400, `"${month}" peab olema vigane`);
  }
});
