/**
 * TEENUSPÄEVIK E12 — kerge sõidupäevik ilma odomeetrita.
 *
 * Omaniku otsus 03.08: „Siin ma ütlesin stop sellele, et inimene peab odomeetri
 * pealt sõitu jälgima, seda ei saa kindlasti lubada." Testid hoiavad kolme asja:
 * kaugus tuleb PUNKTIDEST, hinnang on MÄRGISTATUD, ja puuduv punkt annab
 * `null`-i, mitte nulli.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  ROAD_FACTOR,
  buildLegs,
  buildDayNavigationUrl,
  buildNavigationUrl,
  buildWazeUrl,
  haversineKm,
  summarizeMileage
} from "../../lib/serviceLog/mileage.js";

const TABASALU = { lat: 59.432534, lng: 24.523420 };
const KOPLI = { lat: 59.4544, lng: 24.7136 };

function visit(id, { at, done, point, client, address } = {}) {
  return {
    id,
    clientDisplayName: client || id,
    address: address || null,
    enRouteAt: at || null,
    arrivedAt: at || null,
    completedAt: done || null,
    locationStamps: point ? { arrivedAt: point } : null
  };
}

test("kaugus tuleb punktidest, mitte odomeetrist", () => {
  const straight = haversineKm(TABASALU, KOPLI);
  assert.ok(straight > 10 && straight < 13, `Tabasalu–Kopli linnulennult ~11 km, saadi ${straight}`);
});

test("puuduv punkt annab null, mitte nulli", () => {
  assert.equal(haversineKm(TABASALU, null), null);
  assert.equal(haversineKm(null, null), null);
  assert.equal(haversineKm(TABASALU, { lat: "ei ole number", lng: 24 }), null);
});

test("lõik tekib kahe järjestikuse külastuse vahele", () => {
  const legs = buildLegs([
    visit("a", { at: "2026-08-03T08:15:00Z", done: "2026-08-03T09:00:00Z", point: TABASALU, client: "Aino" }),
    visit("b", { at: "2026-08-03T09:25:00Z", point: KOPLI, client: "Vello" })
  ]);
  assert.equal(legs.length, 1);
  const [leg] = legs;
  assert.equal(leg.fromClient, "Aino");
  assert.equal(leg.toClient, "Vello");
  assert.equal(leg.minutes, 25, "lõpetamisest järgmise saabumiseni");
  assert.equal(leg.source, "gps");
  assert.equal(leg.estimated, true, "linnulennult mõõdetud kaugus EI OLE mõõdetud sõit");
  /* Teed mööda on alati pikem kui linnulennult — tegur on nähtav ja konstantne. */
  assert.ok(leg.km > haversineKm(TABASALU, KOPLI), "teekonnategur peab kaugust kasvatama");
  assert.equal(leg.km, Math.round(haversineKm(TABASALU, KOPLI) * ROAD_FACTOR * 10) / 10);
});

/* ILMA PUNKTITA EI OLE KAUGUST. Väljamõeldud number oleks halvem kui puuduv,
   sest tema järgi makstakse. */
test("ilma asukohapunktita jääb lõik mõõtmata", () => {
  const legs = buildLegs([
    visit("a", { at: "2026-08-03T08:15:00Z", done: "2026-08-03T09:00:00Z" }),
    visit("b", { at: "2026-08-03T09:25:00Z" })
  ]);
  assert.equal(legs[0].km, null, "null tähendab „ei tea”, 0 tähendaks „ei sõitnud”");
  assert.equal(legs[0].source, "unknown");
  assert.equal(legs[0].minutes, 25, "aeg on ikka teada — tema ei sõltu GPS-ist");
});

/* Parandus on VABATAHTLIK ja käib kilomeetrites. See EI OLE odomeetri lugem,
   vaid „see arv on vale, õige on umbes selline". */
test("töötaja parandus võidab mõõtmise", () => {
  const legs = buildLegs(
    [
      visit("a", { at: "2026-08-03T08:15:00Z", done: "2026-08-03T09:00:00Z", point: TABASALU }),
      visit("b", { at: "2026-08-03T09:25:00Z", point: KOPLI })
    ],
    { corrections: { b: 18.4 } }
  );
  assert.equal(legs[0].km, 18.4);
  assert.equal(legs[0].source, "manual");
  assert.equal(legs[0].estimated, false, "inimese kinnitatud arv ei ole hinnang");
});

test("koond ütleb VÄLJA, mitu lõiku jäi mõõtmata", () => {
  const summary = summarizeMileage([
    { km: 12.5, minutes: 20 },
    { km: null, minutes: 15 },
    { km: 3.2, minutes: 8 }
  ]);
  assert.equal(summary.legs, 3);
  assert.equal(summary.km, 15.7);
  assert.equal(summary.minutes, 43);
  assert.equal(summary.missing, 1, "kui see number on suur, ei ole päev esitamiskõlblik");
});

/* E11: aadress viib UKSENI, koordinaat viib punkti, mille täpsus võib olla
   sadu meetreid. Seepärast aadress võidab. */
test("navigatsioon eelistab aadressi koordinaadile", () => {
  const withAddress = buildNavigationUrl(visit("a", { point: TABASALU, address: "Tabasalu, Kolde tn 6" }));
  assert.ok(withAddress.includes(encodeURIComponent("Tabasalu, Kolde tn 6")));
  assert.ok(!withAddress.includes("59.43"), "aadressi olemasolul koordinaati ei kasutata");

  const withoutAddress = buildNavigationUrl(visit("b", { point: TABASALU }));
  assert.ok(withoutAddress.includes("59.432534,24.52342"));

  assert.equal(buildNavigationUrl(visit("c")), null, "kuhugi navigeerida ei ole — nuppu ei kuvata");
});

/* TERVE PÄEV NAVIGAATORIS. Meie kaart on ülevaade; sõites vajab inimene päris
   navigaatorit hääljuhiste ja liiklusinfoga. Üleandmine kannab nüüd tervet
   päeva, mitte ühte aadressi korraga. */
test("päeva link viib järelejäänud külastused ühe marsruudina", () => {
  const day = [
    { id: "a", status: "COMPLETED", address: "Tehtud tn 1" },
    { id: "b", status: "PLANNED", address: "Kolde tn 6, Tabasalu" },
    { id: "c", status: "PLANNED", address: "Instituudi tee 2, Harku" },
    { id: "d", status: "PLANNED", address: "Sõle tn 40, Tallinn" }
  ];
  const nav = buildDayNavigationUrl(day);
  assert.equal(nav.stops, 3, "tehtud külastus ei tohi marsruudile jõuda");
  assert.ok(nav.url.includes(encodeURIComponent("Sõle tn 40, Tallinn")), "viimane on sihtkoht");
  assert.ok(nav.url.includes("waypoints="), "vahepeatused on olemas");
  assert.equal(nav.truncated, false);
});

test("tehtud päev ei anna marsruuti", () => {
  assert.equal(buildDayNavigationUrl([{ id: "a", status: "COMPLETED", address: "x" }]), null);
  assert.equal(buildDayNavigationUrl([]), null);
});

/* Google lubab URL-is kuni 9 vahepeatust. Rohkem EI kärbita vaikselt. */
test("üle piiri minev päev märgitakse kärbituks", () => {
  const many = Array.from({ length: 14 }, (_, index) => ({
    id: `v${index}`,
    status: "PLANNED",
    address: `Tee ${index}, Tallinn`
  }));
  const nav = buildDayNavigationUrl(many);
  assert.equal(nav.stops, 14);
  assert.equal(nav.truncated, true, "vaikne kärpimine jätaks kliendi vahele");
});

/* Waze mitut peatust ei toeta — seda ei varjata, nupp on külastuse juures. */
test("Waze link on ühe külastuse oma", () => {
  assert.ok(buildWazeUrl({ address: "Kolde tn 6" }).includes("navigate=yes"));
  assert.ok(buildWazeUrl({ addressLat: 59.43, addressLng: 24.52 }).includes("59.43%2C24.52"));
  assert.equal(buildWazeUrl({}), null);
});
