/**
 * TEENUSPÄEVIK-V1 E2 — kontrolli leidude regressioonitestid.
 *
 * Iga test siin vastab ühele leiule, mis jõudis koodi VÄLJA. Nad on kirjutatud
 * nii, et nad kukuksid vana koodi peal — muidu ei tõenda nad midagi.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  RETENTION_YEARS,
  computeRetentionEnd,
  isEntryDeletable,
  sanitizeLocationStamps
} from "../../lib/serviceLog/entries.js";
import { deriveServiceSelection } from "../../lib/serviceLog/entryDerivation.js";
import { ENTRY_STATUS, SERVICE_UNIT, VISIT_STAMP } from "../../lib/serviceLog/constants.js";

/* --- P1: ühik ei tohi vaikimisi HOUR-iks muutuda ------------------------ */

test("üheainsa SESSION-teenuse puhul EI tule vaikeühikuks HOUR", () => {
  // Vana kood kirjutas siia kõvasti SERVICE_UNIT.HOUR. Kord-põhine teenus
  // oleks vaikselt muutunud tunnipõhiseks ja kogus oleks arvutatud kestusest.
  const result = deriveServiceSelection({
    providerServices: [{ id: "svc-1", defaultUnit: SERVICE_UNIT.SESSION }]
  });
  assert.equal(result.unit, SERVICE_UNIT.SESSION);
  assert.notEqual(result.unit, SERVICE_UNIT.HOUR);
});

test("viimati kasutatud ühik tuleb teenusega kaasa", () => {
  const result = deriveServiceSelection({
    providerServices: [{ id: "svc-1" }, { id: "svc-2" }],
    lastUsedServiceId: "svc-2",
    lastUsedUnit: SERVICE_UNIT.SESSION
  });
  assert.equal(result.serviceId, "svc-2");
  assert.equal(result.unit, SERVICE_UNIT.SESSION);
});

test("kui ühikut ei ole kuskilt võtta, jääb ta KÜSIMUSEKS, mitte HOUR-iks", () => {
  const result = deriveServiceSelection({
    providerServices: [{ id: "svc-1" }]
  });
  assert.equal(result.unit, null);
  assert.equal(result.askUnit, true);
});

test("suunamise ühik on siduv", () => {
  const result = deriveServiceSelection({
    activeReferrals: [{ id: "ref-1", serviceId: "svc-1", unit: SERVICE_UNIT.DAY }]
  });
  assert.equal(result.unit, SERVICE_UNIT.DAY);
  assert.equal(result.askUnit, false);
});

/* --- P1: asukohatemplid on punktid, mitte jada -------------------------- */

test("tundmatud võtmed ja lisaväljad ei jõua salvestusse", () => {
  const clean = sanitizeLocationStamps({
    [VISIT_STAMP.ARRIVED]: { lat: 59.4, lng: 24.7, acc: 12, at: "2026-08-02T09:00:00Z", speed: 42, deviceId: "x" },
    trail: [{ lat: 59.1, lng: 24.1 }],
    someFutureField: "midagi"
  });
  assert.deepEqual(Object.keys(clean), [VISIT_STAMP.ARRIVED]);
  assert.deepEqual(Object.keys(clean[VISIT_STAMP.ARRIVED]).sort(), ["acc", "at", "lat", "lng"]);
});

test("massiiv punkti asemel EI ole jada, vaid kaob", () => {
  // See on kogu lubaduse tuum: „punktid, mitte jada". Massiivi vastuvõtmine
  // tähendaks, et klient saab saata terve tööpäeva asukohajälje.
  const clean = sanitizeLocationStamps({
    [VISIT_STAMP.ARRIVED]: [
      { lat: 59.4, lng: 24.7 },
      { lat: 59.5, lng: 24.8 }
    ]
  });
  assert.equal(clean, null);
});

test("vahemikust väljas koordinaat ei salvestu", () => {
  assert.equal(sanitizeLocationStamps({ [VISIT_STAMP.ARRIVED]: { lat: 999, lng: 24.7 } }), null);
  assert.equal(sanitizeLocationStamps({ [VISIT_STAMP.ARRIVED]: { lat: 59.4, lng: 999 } }), null);
  assert.equal(sanitizeLocationStamps({ [VISIT_STAMP.ARRIVED]: { lat: "kuskil", lng: 24.7 } }), null);
});

test("iga tempel kannab ÜHTE punkti ja neid on kõige rohkem neli", () => {
  const clean = sanitizeLocationStamps({
    [VISIT_STAMP.DEPARTED]: { lat: 59.1, lng: 24.1 },
    [VISIT_STAMP.ARRIVED]: { lat: 59.2, lng: 24.2 },
    [VISIT_STAMP.LEFT]: { lat: 59.3, lng: 24.3 },
    [VISIT_STAMP.RETURNED]: { lat: 59.4, lng: 24.4 }
  });
  assert.equal(Object.keys(clean).length, 4);
  for (const point of Object.values(clean)) {
    assert.equal(Array.isArray(point), false);
    assert.equal(typeof point.lat, "number");
  }
});

test("katkine sisend ei kuku, vaid annab null", () => {
  for (const broken of [null, undefined, "string", 42, [], {}]) {
    assert.equal(sanitizeLocationStamps(broken), null);
  }
});

/* --- P1: säilitusankur RPS § 12 ja elutsükkel ---------------------------- */

test("säilitustähtaeg algab KIRJENDAMISE majandusaasta lõpust, mitte teenuse kuupäevast", () => {
  /* Vana kood arvutas `teenuse kuupäev + 7 aastat`. Detsembris osutatud ja
     jaanuaris kirjendatud teenuse puhul lubas see kustutamise ligi AASTA
     liiga vara. */
  const entry = {
    date: new Date("2026-12-20T00:00:00Z"),
    recordedFiscalYear: 2027,
    status: ENTRY_STATUS.FINAL
  };
  const end = computeRetentionEnd(entry);
  // Majandusaasta 2027 lõpp + 7 aastat -> 2035-01-01.
  assert.equal(end.toISOString().slice(0, 10), "2035-01-01");

  // Vana ankur oleks andnud 2033 — kaks aastat varem.
  assert.ok(end.getUTCFullYear() > new Date(entry.date).getUTCFullYear() + RETENTION_YEARS);
});

test("kinnitatud kirje ei ole kustutatav enne tähtaega", () => {
  const entry = { status: ENTRY_STATUS.FINAL, recordedFiscalYear: 2026 };
  assert.equal(isEntryDeletable(entry, { now: new Date("2033-06-01T00:00:00Z") }), false);
  assert.equal(isEntryDeletable(entry, { now: new Date("2034-01-02T00:00:00Z") }), true);
});

test("MUSTAND on kustutatav kohe — ta ei ole veel millegi alus", () => {
  // Omaniku otsus 02.08: eksisisestuse kustutamine peab olema võimalik.
  assert.equal(
    isEntryDeletable({ status: ENTRY_STATUS.DRAFT, date: new Date() }, { now: new Date() }),
    true
  );
});

test("ilma kirjendamisaastata ei arvutata tähtaega mälust", () => {
  assert.equal(computeRetentionEnd({}), null);
  assert.equal(isEntryDeletable({ status: ENTRY_STATUS.FINAL }, { now: new Date("2099-01-01") }), false);
});
