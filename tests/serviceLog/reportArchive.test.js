/**
 * TEENUSPÄEVIK — esitatud kuuaruanne jääb alles.
 *
 * MIKS SEE ON ARVE KÜSIMUS: kirjeid tohib RPS §10 korras hiljem parandada.
 * Seega uus eksport EI TÕENDA seda, mis tookord KOV-ile teele läks — tõendab
 * ainult see fail, mis siis tekkis. Ilma arhiivita ei ole vaidluses „see maht ei
 * ole see, mille meie saime" millegi peale osutada.
 *
 * Kolm reeglit, mida testid hoiavad:
 *   1. sama esitis EI paljune (kaks vajutust ≠ kaks aruannet),
 *   2. säilitus tuleb raamatupidamise seadusest, mitte dokumendiperest,
 *   3. arhiveerimise tõrge EI KATKESTA allalaadimist.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  ARCHIVE_SKIP_REASON,
  SERVICE_LOG_REPORT_KIND,
  archiveMonthlyReport,
  buildReportTitle,
  computeReportRetentionEnd
} from "../../lib/serviceLog/reportArchive.js";

/* Salvestuskiht on siin võlts: test kontrollib loogikat, mitte ketast. */
const STORE = {
  storeBuffer: async (buffer) => ({
    size: buffer.byteLength,
    sha256: `sha-${buffer.toString("utf8")}`
  }),
  makeStoragePath: (fileName) => `uploads/${fileName}`
};

function makeDb() {
  const rows = [];
  return {
    rows,
    userDocument: {
      findFirst: async ({ where }) =>
        rows.find(
          (row) =>
            row.ownerId === where.ownerId && row.kind === where.kind && row.sha256 === where.sha256
        ) || null,
      create: async ({ data }) => {
        const row = { id: `doc-${rows.length + 1}`, ...data };
        rows.push(row);
        return { id: row.id };
      },
      update: async ({ where, data }) => {
        const row = rows.find((item) => item.id === where.id);
        Object.assign(row, data);
        return row;
      }
    }
  };
}

const BASE = {
  userId: "user-1",
  month: "2026-07",
  template: "A_TIMESHEET",
  format: "csv",
  kovName: "Harku vald",
  fileName: "teenuspaevik-a-2026-07-harku.csv",
  mime: "text/csv",
  entryCount: 12,
  generatedAt: "2026-08-02T10:00:00.000Z"
};

test("esitatud aruanne salvestub omaniku dokumendiks", async () => {
  const db = makeDb();
  const result = await archiveMonthlyReport({ ...BASE, body: "klient;tunnid\nMari;12" }, { db, ...STORE });

  assert.equal(result.ok, true);
  assert.equal(result.reused, false);
  const [row] = db.rows;
  assert.equal(row.kind, SERVICE_LOG_REPORT_KIND);
  assert.equal(row.ownerId, "user-1");
  assert.equal(row.agentAllowed, false, "aruanne kannab klientide nimesid — jagatud otsingusse ta ei lähe");
  assert.equal(row.metadata.month, "2026-07");
  assert.equal(row.metadata.entryCount, 12);
  assert.equal(row.metadata.issuedCount, 1);
  assert.equal(row.metadata.retentionBasis, "RPS_12");
});

test("kaks vajutust „Laadi alla” ei tee kahte aruannet", async () => {
  const db = makeDb();
  const body = "klient;tunnid\nMari;12";
  const first = await archiveMonthlyReport({ ...BASE, body }, { db, ...STORE });
  const second = await archiveMonthlyReport({ ...BASE, body }, { db, ...STORE });

  assert.equal(db.rows.length, 1, "samad bait'id on sama esitis");
  assert.equal(second.documentId, first.documentId);
  assert.equal(second.reused, true);
  assert.equal(db.rows[0].metadata.issuedCount, 2, "kordusväljastus on fakt, mitte müra");
});

/* Parandatud kuu annab teised bait'id. Just see ongi see, mida hiljem vaja
   näha: aruandest on kaks versiooni ja mõlemad on alles. */
test("parandatud kuu annab UUE aruande, vana jääb alles", async () => {
  const db = makeDb();
  await archiveMonthlyReport({ ...BASE, body: "klient;tunnid\nMari;12" }, { db, ...STORE });
  await archiveMonthlyReport({ ...BASE, body: "klient;tunnid\nMari;14" }, { db, ...STORE });
  assert.equal(db.rows.length, 2);
});

test("säilitus tuleb raamatupidamise seadusest, mitte dokumendiperest", () => {
  const end = computeReportRetentionEnd(new Date("2026-08-02T10:00:00.000Z"));
  assert.equal(end.toISOString().slice(0, 10), "2033-12-31", "väljastamise majandusaasta lõpp + 7 a");
});

test("pealkiri ütleb perioodi ja saaja — just neid otsitakse", () => {
  const title = buildReportTitle({ month: "2026-07", kovName: "Harku vald", template: "A_TIMESHEET" });
  assert.ok(title.includes("2026-07"));
  assert.ok(title.includes("Harku vald"));
});

/* ALLALAADIMINE ON TÄHTSAM KUI TEMA KOOPIA. Töötajal on tähtaeg; täis ketas ei
   tohi teda tühja kohta jätta. Puudumine peab olema NÄHTAV — seepärast
   `{ ok:false, reason }`, mitte visatud viga. */
test("andmebaasi tõrge ei viska, vaid annab põhjuse", async () => {
  const db = {
    userDocument: {
      findFirst: async () => {
        throw new Error("connection lost");
      }
    }
  };
  const result = await archiveMonthlyReport({ ...BASE, body: "x" }, { db, ...STORE });
  assert.equal(result.ok, false);
  assert.equal(result.reason, ARCHIVE_SKIP_REASON.FAILED);
});

test("tühi keha ega puuduv kasutaja ei tekita tühja dokumenti", async () => {
  const db = makeDb();
  assert.equal((await archiveMonthlyReport({ ...BASE, body: "" }, { db, ...STORE })).ok, false);
  assert.equal((await archiveMonthlyReport({ ...BASE, userId: null, body: "x" }, { db, ...STORE })).ok, false);
  assert.equal(db.rows.length, 0);
});
