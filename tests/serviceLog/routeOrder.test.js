/**
 * TEENUSPÄEVIK — päeva järjestuse soovitus.
 *
 * Kaks reeglit käivad ENNE geograafiat ja testid hoiavad neid: fikseeritud aeg
 * on fikseeritud, tehtud tööd ei järjestata ümber. Alles siis lähedus.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { orderDistanceKm, suggestOrder } from "../../lib/serviceLog/routeOrder.js";

/* Neli päris kohta, et kaugused oleksid tähenduslikud. */
const KOHT = {
  tabasalu: { lat: 59.4324, lng: 24.5234 },
  harku: { lat: 59.3936, lng: 24.5619 },
  kopli: { lat: 59.4544, lng: 24.7136 },
  viimsi: { lat: 59.5053, lng: 24.8043 }
};

function visit(id, place, { status = "PLANNED", planned = null } = {}) {
  return {
    id,
    status,
    plannedStartAt: planned,
    addressLat: place?.lat ?? null,
    addressLng: place?.lng ?? null
  };
}

test("ilma fikseeritud aegadeta järjestatakse läheduse järgi", () => {
  /* Sisend on tahtlikult halvas järjekorras: Tabasalu → Viimsi → Harku → Kopli
     tähendaks kaks korda üle linna sõitmist. */
  const visits = [
    visit("tabasalu", KOHT.tabasalu),
    visit("viimsi", KOHT.viimsi),
    visit("harku", KOHT.harku),
    visit("kopli", KOHT.kopli)
  ];
  const before = orderDistanceKm(visits);
  const result = suggestOrder(visits);

  assert.equal(result.changed, true);
  assert.ok(result.km < before, `soovitus (${result.km} km) peab olema lühem kui praegune (${before} km)`);
  /* Ahne naaber algab esimesest ja võtab alati lähima: Tabasalu → Harku →
     Kopli → Viimsi. */
  assert.deepEqual(result.order, ["tabasalu", "harku", "kopli", "viimsi"]);
});

/* RAVIM KELL 9 EI LIIGU. Lähedus ei ole argument fikseeritud aja vastu ja see
   on kogu järjestuse juures kõige olulisem reegel. */
test("fikseeritud ajad jäävad ajalisse järjekorda", () => {
  const visits = [
    visit("kopli-9", KOHT.kopli, { planned: "2026-08-03T09:00:00Z" }),
    visit("tabasalu-12", KOHT.tabasalu, { planned: "2026-08-03T12:00:00Z" }),
    visit("viimsi-15", KOHT.viimsi, { planned: "2026-08-03T15:00:00Z" })
  ];
  const result = suggestOrder(visits);
  assert.deepEqual(result.order, ["kopli-9", "tabasalu-12", "viimsi-15"]);
  assert.equal(result.changed, false, "midagi ei tohi liikuda");
});

test("vaba külastus lisatakse sinna, kus ta lisab kõige vähem sõitu", () => {
  const visits = [
    visit("kopli-9", KOHT.kopli, { planned: "2026-08-03T09:00:00Z" }),
    visit("viimsi-15", KOHT.viimsi, { planned: "2026-08-03T15:00:00Z" }),
    /* Harku on Kopli ja Viimsi vahel geograafiliselt kõrval — teda ei tohi
       kahe fikseeritud vahele toppida, kui see teeb sõidu pikemaks. */
    visit("harku-vaba", KOHT.harku)
  ];
  const result = suggestOrder(visits);
  const kopli = result.order.indexOf("kopli-9");
  const viimsi = result.order.indexOf("viimsi-15");
  assert.ok(kopli < viimsi, "fikseeritud ajad jäävad omavahel järjekorda");
  assert.equal(result.order.length, 3);
});

/* TEHTUD TÖÖD EI JÄRJESTATA ÜMBER. Lõpetatud külastus jääb sinna, kus ta on —
   tema ümbertõstmine muudaks juba juhtunud päeva. */
test("lõpetatud ja käigus olev külastus jäävad ette ja paigale", () => {
  const visits = [
    visit("tehtud", KOHT.kopli, { status: "COMPLETED" }),
    visit("kaigus", KOHT.viimsi, { status: "ARRIVED" }),
    visit("b", KOHT.viimsi),
    visit("a", KOHT.tabasalu)
  ];
  const result = suggestOrder(visits);
  assert.equal(result.order[0], "tehtud");
  assert.equal(result.order[1], "kaigus");
  assert.deepEqual(result.order.slice(2).sort(), ["a", "b"]);
});

test("alla kahe liigutatava külastuse ei ole midagi soovitada", () => {
  const one = suggestOrder([visit("a", KOHT.tabasalu)]);
  assert.equal(one.changed, false);
  assert.deepEqual(one.order, ["a"]);
  assert.deepEqual(suggestOrder([]).order, []);
});

/* Koordinaadita külastus ei tohi kaduda ega ahelat lõhkuda: ta jääb lihtsalt
   lõppu, sest tema kohta ei ole midagi teada. */
test("koordinaadita külastus jääb alles", () => {
  const visits = [
    visit("tabasalu", KOHT.tabasalu),
    visit("teadmata", null),
    visit("harku", KOHT.harku)
  ];
  const result = suggestOrder(visits);
  assert.equal(result.order.length, 3);
  assert.ok(result.order.includes("teadmata"));
});

test("algpunkt mõjutab esimest peatust", () => {
  const visits = [visit("kopli", KOHT.kopli), visit("tabasalu", KOHT.tabasalu)];
  const fromTabasalu = suggestOrder(visits, { startPoint: KOHT.tabasalu });
  assert.equal(fromTabasalu.order[0], "tabasalu", "lähim algpunktile tuleb esimesena");
});
