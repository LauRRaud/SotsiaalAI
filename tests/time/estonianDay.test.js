import test from "node:test";
import assert from "node:assert/strict";

import { estonianDayBounds, localDateTimeToUtc } from "../../lib/time/estonianDay.js";

/**
 * REGRESSIOONILEPING. Kaks viga, mille see moodul asendas, olid mõlemad
 * nähtamatud arendusmasinal, mille ajavöönd on `Europe/Tallinn`:
 *
 *   1. päeva algus arvutati SERVERI lokaalse parsinguga → UTC-serveris nihkus
 *      Eesti päev suvel 3 tundi;
 *   2. päeva lõpp oli `algus + 24 h` → DST-päevadel vale tund.
 *
 * Seepärast on siin nii fikseeritud ISO-väärtused KUI ajavööndi-vahetus.
 */

const HOUR = 3_600_000;

function hours({ start, end }) {
  return (end.getTime() - start.getTime()) / HOUR;
}

test("tavaline suvepäev on UTC+3 ja 24 tundi", () => {
  const day = estonianDayBounds(new Date("2026-08-08T09:00:00.000Z"));

  assert.equal(day.isoDay, "2026-08-08");
  assert.equal(day.start.toISOString(), "2026-08-07T21:00:00.000Z");
  assert.equal(day.end.toISOString(), "2026-08-08T21:00:00.000Z");
  assert.equal(hours(day), 24);
});

test("tavaline talvepäev on UTC+2 ja 24 tundi", () => {
  const day = estonianDayBounds(new Date("2026-01-15T09:00:00.000Z"));

  assert.equal(day.isoDay, "2026-01-15");
  assert.equal(day.start.toISOString(), "2026-01-14T22:00:00.000Z");
  assert.equal(day.end.toISOString(), "2026-01-15T22:00:00.000Z");
  assert.equal(hours(day), 24);
});

test("29.03.2026 — kevadine üleminek, päev on 23 tundi", () => {
  /* Kell keeratakse 03:00 → 04:00. Päev ALGAB veel EET-is (UTC+2) ja LÕPEB
     juba EEST-is (UTC+3), seega `algus + 24 h` annaks tunni liiga hilja. */
  const day = estonianDayBounds(new Date("2026-03-29T10:00:00.000Z"));

  assert.equal(day.isoDay, "2026-03-29");
  assert.equal(day.start.toISOString(), "2026-03-28T22:00:00.000Z");
  assert.equal(day.end.toISOString(), "2026-03-29T21:00:00.000Z");
  assert.equal(hours(day), 23);
});

test("25.10.2026 — sügisene üleminek, päev on 25 tundi", () => {
  const day = estonianDayBounds(new Date("2026-10-25T10:00:00.000Z"));

  assert.equal(day.isoDay, "2026-10-25");
  assert.equal(day.start.toISOString(), "2026-10-24T21:00:00.000Z");
  assert.equal(day.end.toISOString(), "2026-10-25T22:00:00.000Z");
  assert.equal(hours(day), 25);
});

test("päev on sama, mis ka poleks SERVERI ajavöönd", () => {
  /* SEE ON SELLE FAILI PÕHITEST. Vana teostus läbis kõik ülejäänud siinsed
     kontrollid masinal, mille `TZ=Europe/Tallinn` — ja andis UTC-serveris
     valed piirid. Kui keegi toob serveri-lokaalse parsingu tagasi, kukub
     TÄPSELT see test, mitte alles toodang. */
  const at = new Date("2026-08-08T09:00:00.000Z");
  const previous = process.env.TZ;
  const seen = new Set();

  try {
    for (const zone of ["UTC", "Europe/Tallinn", "America/Los_Angeles", "Pacific/Kiritimati"]) {
      process.env.TZ = zone;
      const day = estonianDayBounds(at);
      seen.add(`${day.isoDay}|${day.start.toISOString()}|${day.end.toISOString()}`);
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }

  assert.equal(seen.size, 1, `ajavöönd muutis tulemust: ${[...seen].join(" / ")}`);
  assert.equal([...seen][0], "2026-08-08|2026-08-07T21:00:00.000Z|2026-08-08T21:00:00.000Z");
});

test("kesköö ümberarvutus tabab ka olematut ja topelt-tundi", () => {
  /* 29.03 kell 03:30 Eesti aja järgi EI EKSISTEERI (kell hüppab 03:00 → 04:00).
     Iteratsioon peab andma määratud vastuse, mitte jooksma lõputult. */
  const missing = localDateTimeToUtc({ year: 2026, month: 3, day: 29, hour: 3, minute: 30 });
  assert.ok(missing instanceof Date && !Number.isNaN(missing.getTime()));

  /* 25.10 kell 03:30 esineb KAKS korda; vastus peab olema üks kindel hetk. */
  const doubled = localDateTimeToUtc({ year: 2026, month: 10, day: 25, hour: 3, minute: 30 });
  assert.equal(doubled.toISOString(), "2026-10-25T01:30:00.000Z");
});

test("vigane sisend annab TypeError'i, mitte vaikselt Invalid Date piirid", () => {
  assert.throws(() => estonianDayBounds("mitte kuupäev"), TypeError);
});
