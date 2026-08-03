/**
 * TEENUSPÄEVIK — päris teepikkus ise majutatud marsruudimootorist.
 *
 * MIKS ISE MAJUTATUD: marsruudi küsimine tähendab KLIENTIDE KODUKOORDINAATIDE
 * saatmist. OSRM töötab meie serveris ja ükski koordinaat ei lahku masinast.
 *
 * Testid hoiavad kolme asja: koordinaadipaari JÄRJEKORDA (vahetatud lng/lat
 * annab vastuse, mis on lihtsalt vale), tõrke käitumist (varuvariant, mitte
 * viga) ja seda, et mootorita käitub kõik täpselt nagu enne.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { isRoutingEnabled, osrmBaseUrl, routeBetween, routeDay } from "../../lib/serviceLog/routing.js";

const ENV = { SERVICE_LOG_OSRM_URL: "http://127.0.0.1:5000" };
const TABASALU = { lat: 59.4324, lng: 24.5234 };
const HARKU = { lat: 59.3936, lng: 24.5619 };

function fakeFetch(payload, { ok = true } = {}) {
  const calls = [];
  const impl = async (url) => {
    calls.push(url);
    return { ok, json: async () => payload };
  };
  impl.calls = calls;
  return impl;
}

const ROUTE = {
  routes: [
    {
      distance: 8420,
      duration: 654,
      geometry: { coordinates: [[24.5234, 59.4324], [24.5619, 59.3936]] },
      legs: [{ distance: 8420, duration: 654 }]
    }
  ]
};

test("mootorita käitub kõik täpselt nagu enne", async () => {
  assert.equal(isRoutingEnabled({}), false);
  assert.equal(osrmBaseUrl({}), null);
  assert.equal(await routeBetween(TABASALU, HARKU, { env: {} }), null);
  assert.equal(await routeDay([TABASALU, HARKU], { env: {} }), null);
});

/* KOORDINAADIPAARI JÄRJEKORD on siin klassikaline vaikne viga: OSRM ootab
   LNG,LAT — vastupidi sellele, kuidas inimesed koordinaate ütlevad. Vahetatud
   paar ei anna veateadet, vaid vastuse, mis on lihtsalt vale. */
test("koordinaadid lähevad OSRM-i järjekorras lng,lat", async () => {
  const impl = fakeFetch(ROUTE);
  await routeBetween(TABASALU, HARKU, { env: ENV, fetchImpl: impl });
  const url = impl.calls[0];
  assert.ok(url.includes("24.5234,59.4324;24.5619,59.3936"), `vale järjekord: ${url}`);
  assert.ok(url.startsWith("http://127.0.0.1:5000/route/v1/driving/"), "peab minema MEIE mootorisse");
});

test("päris teepikkus tuleb kilomeetrites ja minutites", async () => {
  const result = await routeBetween(TABASALU, HARKU, { env: ENV, fetchImpl: fakeFetch(ROUTE) });
  assert.equal(result.km, 8.4, "8420 m → 8,4 km");
  assert.equal(result.minutes, 11, "654 s → 11 min");
  assert.equal(result.geometry.length, 2, "joon kaardile tuleb kaasa");
});

/* TÕRGE EI OLE VIGA, VAID VARUVARIANT: sõidupäevik ei tohi kaduda sellepärast,
   et üks abiteenus on maas. Kutsuja jääb linnulennulise hinnangu juurde. */
test("mootori tõrge annab null, mitte viga", async () => {
  assert.equal(await routeBetween(TABASALU, HARKU, { env: ENV, fetchImpl: fakeFetch({}, { ok: false }) }), null);
  const throwing = async () => {
    throw new Error("connection refused");
  };
  assert.equal(await routeBetween(TABASALU, HARKU, { env: ENV, fetchImpl: throwing }), null);
  assert.equal(await routeBetween(TABASALU, HARKU, { env: ENV, fetchImpl: fakeFetch({ routes: [] }) }), null);
});

test("vigane koordinaat ei jõua päringusse", async () => {
  const impl = fakeFetch(ROUTE);
  assert.equal(await routeBetween(TABASALU, { lat: "ei ole", lng: 24 }, { env: ENV, fetchImpl: impl }), null);
  assert.equal(await routeBetween(null, HARKU, { env: ENV, fetchImpl: impl }), null);
  assert.equal(impl.calls.length, 0, "katkise sisendiga ei tohi mootorit üldse tülitada");
});

/* ÜKS PÄRING, MITTE N TÜKKI: kümme järjestikust päringut tähendaks kümme
   ajapiirangut ja päeva vaate, mis laeb sekundeid. */
test("terve päev küsitakse ühe päringuga", async () => {
  const impl = fakeFetch({
    routes: [
      {
        distance: 20100,
        duration: 1500,
        geometry: { coordinates: [] },
        legs: [
          { distance: 8420, duration: 654 },
          { distance: 11680, duration: 846 }
        ]
      }
    ]
  });
  const day = await routeDay([TABASALU, HARKU, { lat: 59.44, lng: 24.75 }], { env: ENV, fetchImpl: impl });
  assert.equal(impl.calls.length, 1, "üks päring kogu päeva kohta");
  assert.equal(day.legs.length, 2);
  assert.equal(day.legs[0].km, 8.4);
  assert.equal(day.km, 20.1);
  assert.ok(impl.calls[0].includes(";"), "punktid on ühes marsruudis");
});

test("alla kahe punktiga ei ole marsruuti", async () => {
  const impl = fakeFetch(ROUTE);
  assert.equal(await routeDay([TABASALU], { env: ENV, fetchImpl: impl }), null);
  assert.equal(impl.calls.length, 0);
});
