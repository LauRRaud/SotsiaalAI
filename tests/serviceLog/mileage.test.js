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
  buildNavigationUrl,
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
