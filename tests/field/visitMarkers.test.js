import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  applyLocalMarker,
  classifyMarkerResponse,
  FIELD_MARKER,
  FIELD_MARKER_REASON,
  FIELD_MARKER_STATE,
  FIELD_PACK_SCHEMA_VERSION,
  flushVisitMarkers,
  readPackMarkers
} from "../../lib/field/visitMarkers.js";

/**
 * SOL-FIELD-04 — SAABUMISE JA LAHKUMISE MARKER EI TOHI VAIKSELT KADUDA.
 *
 * Vana kood ütles „salvestatud" ja kaotas markeri kolmel eri viisil: paketi
 * kinnine väljaloend ei kopeerinud teda, sama kutse kirjutas üle terve
 * ettevalmistuspaketi, ja flush eemaldas ta PÄRAST IGA täidetud päringut —
 * vastuse staatust vaatamata. Need testid mõõdavad kõiki kolme.
 */

const NOW = new Date("2026-08-10T09:00:00.000Z");
const later = (minutes) => new Date(NOW.getTime() + minutes * 60000);

const packPayload = (overrides = {}) => ({
  goal: "Kodukülastus",
  locationText: "Näidise tänav 1",
  packKeyQuestions: ["Kas küte töötab?"],
  safety: { contactEmail: "kolleeg@näidis.test" },
  version: 4,
  ...overrides
});

function fakeStore(pack) {
  const packs = new Map();
  if (pack) packs.set(pack.visitId, JSON.parse(JSON.stringify(pack)));
  return {
    packs,
    getPack: async (id) => {
      const row = packs.get(String(id));
      return row ? JSON.parse(JSON.stringify(row)) : null;
    },
    putPack: async (row) => {
      packs.set(String(row.visitId), JSON.parse(JSON.stringify(row)));
    }
  };
}

const storedPack = (payload) => ({
  visitId: "visit-1",
  takenAt: NOW.toISOString(),
  plannedEndAt: null,
  status: "IN_PROGRESS",
  payload
});

/** Salvestatud päringud + skriptitud vastused. */
function fakeFetch(script) {
  const calls = [];
  const impl = async (url, init = {}) => {
    const method = init.method || "GET";
    calls.push({ url, method, body: init.body ? JSON.parse(init.body) : null });
    const next = script.shift();
    if (typeof next === "function") return next();
    return {
      status: next.status,
      json: async () => next.body ?? {}
    };
  };
  impl.calls = calls;
  return impl;
}

const visitBody = (visit) => ({ status: 200, body: { visit } });

test("kohalik marker on PENDING ega puutu paketi sisu", () => {
  const payload = applyLocalMarker(packPayload(), FIELD_MARKER.ARRIVAL, NOW);

  const markers = readPackMarkers(payload);
  assert.equal(markers.arrival.at, NOW.toISOString());
  assert.equal(markers.arrival.state, FIELD_MARKER_STATE.PENDING);
  assert.equal(markers.departure, null);
  assert.equal(payload.schemaVersion, FIELD_PACK_SCHEMA_VERSION);

  /* SEE OLI TEINE, RAPORTIS NIMETAMATA TAGAJÄRG: vana rada andis `storePack`-ile
     võltsvisiidi ja kirjutas seetõttu üle eesmärgi, asukoha ja OHUTUSINFO. */
  assert.equal(payload.goal, "Kodukülastus");
  assert.equal(payload.safety.contactEmail, "kolleeg@näidis.test");
  assert.deepEqual(payload.packKeyQuestions, ["Kas küte töötab?"]);
});

test("teine vajutus EI liiguta aega — esimene „ma olen kohal” on tõde", () => {
  const first = applyLocalMarker(packPayload(), FIELD_MARKER.ARRIVAL, NOW);
  const second = applyLocalMarker(first, FIELD_MARKER.ARRIVAL, later(30));

  assert.equal(readPackMarkers(second).arrival.at, NOW.toISOString());
});

test("vana lahtine väli tõstetakse uude skeemi, mitte ei visata ära", () => {
  const markers = readPackMarkers({ localArrivalAt: NOW.toISOString() });
  assert.equal(markers.arrival.at, NOW.toISOString());
  assert.equal(markers.arrival.state, FIELD_MARKER_STATE.PENDING);
});

test("vastuse klassifikatsioon: AINULT 2xx tähendab „kustuta”", () => {
  assert.equal(classifyMarkerResponse(200).ok, true);
  assert.equal(classifyMarkerResponse(204).ok, true);
  for (const [status, reason] of [
    [401, FIELD_MARKER_REASON.AUTH],
    [403, FIELD_MARKER_REASON.AUTH],
    [409, FIELD_MARKER_REASON.CONFLICT],
    [429, FIELD_MARKER_REASON.RATE_LIMIT],
    [500, FIELD_MARKER_REASON.SERVER],
    [503, FIELD_MARKER_REASON.SERVER],
    [418, FIELD_MARKER_REASON.SERVER],
    [0, FIELD_MARKER_REASON.NETWORK]
  ]) {
    const decision = classifyMarkerResponse(status);
    assert.equal(decision.ok, false, `${status} ei tohi tähendada edu`);
    assert.equal(decision.reason, reason, `${status} põhjus`);
  }
});

test("edukas flush: marker kaob alles serveri 2xx järel", async () => {
  const store = fakeStore(storedPack(applyLocalMarker(packPayload(), FIELD_MARKER.ARRIVAL, NOW)));
  const fetchImpl = fakeFetch([
    visitBody({ id: "visit-1", version: 4, arrivedConfirmedAt: null, departedConfirmedAt: null }),
    { status: 200, body: { visit: { id: "visit-1", version: 5, arrivedConfirmedAt: NOW.toISOString() } } }
  ]);

  const outcome = await flushVisitMarkers({ store, visitId: "visit-1", fetchImpl, now: later(10) });

  assert.deepEqual(outcome.confirmed, [FIELD_MARKER.ARRIVAL]);
  assert.deepEqual(outcome.kept, []);
  assert.equal(readPackMarkers((await store.getPack("visit-1")).payload).arrival, null);
  assert.equal(fetchImpl.calls[1].method, "PATCH");
  assert.deepEqual(fetchImpl.calls[1].body, { action: "confirm_arrival", version: 4 });
});

test("detail tõendab sama sündmust — PATCH-i ei tehta ja marker on ausalt üle antud", async () => {
  const store = fakeStore(storedPack(applyLocalMarker(packPayload(), FIELD_MARKER.ARRIVAL, NOW)));
  const fetchImpl = fakeFetch([
    visitBody({ id: "visit-1", version: 4, arrivedConfirmedAt: NOW.toISOString(), departedConfirmedAt: null })
  ]);

  const outcome = await flushVisitMarkers({ store, visitId: "visit-1", fetchImpl, now: later(10) });

  assert.deepEqual(outcome.confirmed, [FIELD_MARKER.ARRIVAL]);
  assert.equal(fetchImpl.calls.length, 1, "teist päringut ei tohi teha");
  assert.equal(readPackMarkers((await store.getPack("visit-1")).payload).arrival, null);
});

/* SEE ON LEID ISE. Iga rida siin oleks vana koodiga tõendi kustutanud. */
for (const [status, reason] of [
  [401, FIELD_MARKER_REASON.AUTH],
  [403, FIELD_MARKER_REASON.AUTH],
  [409, FIELD_MARKER_REASON.CONFLICT],
  [429, FIELD_MARKER_REASON.RATE_LIMIT],
  [500, FIELD_MARKER_REASON.SERVER]
]) {
  test(`PATCH ${status}: marker JÄÄB alles, seisuga FAILED ja põhjusega ${reason}`, async () => {
    const store = fakeStore(storedPack(applyLocalMarker(packPayload(), FIELD_MARKER.ARRIVAL, NOW)));
    const fetchImpl = fakeFetch([
      visitBody({ id: "visit-1", version: 4, arrivedConfirmedAt: null }),
      { status, body: {} }
    ]);

    const outcome = await flushVisitMarkers({ store, visitId: "visit-1", fetchImpl, now: later(10) });

    assert.deepEqual(outcome.confirmed, []);
    assert.deepEqual(outcome.kept, [FIELD_MARKER.ARRIVAL]);
    const marker = readPackMarkers((await store.getPack("visit-1")).payload).arrival;
    assert.equal(marker.at, NOW.toISOString(), "aeg on tõend — teda ei tohi muuta");
    assert.equal(marker.state, FIELD_MARKER_STATE.FAILED);
    assert.equal(marker.reason, reason);
    assert.equal(marker.attempts, 1);
    assert.equal(marker.lastTriedAt, later(10).toISOString());
  });
}

test("võrguviga PATCH-il jätab markeri alles võrgu-põhjusega", async () => {
  const store = fakeStore(storedPack(applyLocalMarker(packPayload(), FIELD_MARKER.ARRIVAL, NOW)));
  const fetchImpl = fakeFetch([
    visitBody({ id: "visit-1", version: 4, arrivedConfirmedAt: null }),
    () => {
      throw new Error("network down");
    }
  ]);

  const outcome = await flushVisitMarkers({ store, visitId: "visit-1", fetchImpl, now: later(10) });

  assert.deepEqual(outcome.kept, [FIELD_MARKER.ARRIVAL]);
  assert.equal(outcome.reasons.arrival, FIELD_MARKER_REASON.NETWORK);
  assert.ok(readPackMarkers((await store.getPack("visit-1")).payload).arrival);
});

test("kui juba külastuse lugemine kukub, jäävad KÕIK ootel markerid alles", async () => {
  let payload = applyLocalMarker(packPayload(), FIELD_MARKER.ARRIVAL, NOW);
  payload = applyLocalMarker(payload, FIELD_MARKER.DEPARTURE, later(60));
  const store = fakeStore(storedPack(payload));
  const fetchImpl = fakeFetch([{ status: 401, body: {} }]);

  const outcome = await flushVisitMarkers({ store, visitId: "visit-1", fetchImpl, now: later(90) });

  assert.deepEqual(outcome.kept, [FIELD_MARKER.ARRIVAL, FIELD_MARKER.DEPARTURE]);
  const markers = readPackMarkers((await store.getPack("visit-1")).payload);
  assert.equal(markers.arrival.reason, FIELD_MARKER_REASON.AUTH);
  assert.equal(markers.departure.reason, FIELD_MARKER_REASON.AUTH);
  assert.equal(fetchImpl.calls.length, 1, "ilma värske külastuseta ei tohi PATCH-i teha");
});

/* Kaks markerit ühes käigus: esimene edu liigutab versiooni ja teine PATCH peab
   kasutama UUT — muidu saab ta 409 iseenda eelkäija pärast. */
test("kaks markerit järjest: teine kasutab esimese vastusest saadud versiooni", async () => {
  let payload = applyLocalMarker(packPayload(), FIELD_MARKER.ARRIVAL, NOW);
  payload = applyLocalMarker(payload, FIELD_MARKER.DEPARTURE, later(60));
  const store = fakeStore(storedPack(payload));
  const fetchImpl = fakeFetch([
    visitBody({ id: "visit-1", version: 4, arrivedConfirmedAt: null, departedConfirmedAt: null }),
    { status: 200, body: { visit: { id: "visit-1", version: 5, arrivedConfirmedAt: NOW.toISOString() } } },
    { status: 200, body: { visit: { id: "visit-1", version: 6 } } }
  ]);

  const outcome = await flushVisitMarkers({ store, visitId: "visit-1", fetchImpl, now: later(90) });

  assert.deepEqual(outcome.confirmed, [FIELD_MARKER.ARRIVAL, FIELD_MARKER.DEPARTURE]);
  assert.deepEqual(fetchImpl.calls[1].body, { action: "confirm_arrival", version: 4 });
  assert.deepEqual(fetchImpl.calls[2].body, { action: "confirm_departure", version: 5 });
});

test("üks kukub, teine läheb läbi — ja täpselt nii jääb ka kettale", async () => {
  let payload = applyLocalMarker(packPayload(), FIELD_MARKER.ARRIVAL, NOW);
  payload = applyLocalMarker(payload, FIELD_MARKER.DEPARTURE, later(60));
  const store = fakeStore(storedPack(payload));
  const fetchImpl = fakeFetch([
    visitBody({ id: "visit-1", version: 4, arrivedConfirmedAt: null, departedConfirmedAt: null }),
    { status: 200, body: { visit: { id: "visit-1", version: 5 } } },
    { status: 500, body: {} }
  ]);

  const outcome = await flushVisitMarkers({ store, visitId: "visit-1", fetchImpl, now: later(90) });

  assert.deepEqual(outcome.confirmed, [FIELD_MARKER.ARRIVAL]);
  assert.deepEqual(outcome.kept, [FIELD_MARKER.DEPARTURE]);
  const markers = readPackMarkers((await store.getPack("visit-1")).payload);
  assert.equal(markers.arrival, null);
  assert.equal(markers.departure.state, FIELD_MARKER_STATE.FAILED);
});

/**
 * NEGATIIVKONTROLL — mida vana reegel samas olukorras teinuks.
 *
 * SOL-FIELD-02 ja -03 sai vana koodi vastu jooksutada, sest neil oli moodulipiir
 * olemas. Siin seda EI OLE: vana loogika elas React-i `useCallback`-i sees ja
 * kadus koos temaga. Seepärast on siin vana reegel ÜMBER KIRJUTATUD (tema kaks
 * rida: „pärast täidetud fetch'i eemalda marker") ja tema vastu jooksevad SAMAD
 * väited. Kui see test läheb roheliseks, ei mõõda ükski ülalolev midagi.
 *
 * Aus silt: see on minu transkriptsioon vanast reeglist, mitte vana kood ise.
 */
test("vana reegel oleks sama 500 peale tõendi kustutanud", async () => {
  const payload = applyLocalMarker(packPayload(), FIELD_MARKER.ARRIVAL, NOW);

  // Vana rada: staatust ei vaadatud, marker eemaldati iga täidetud päringu järel.
  const oldFlush = async (input, response) => {
    const next = { ...input };
    if (response) delete next.markers;
    return next;
  };

  const afterOld = await oldFlush(payload, { status: 500 });
  assert.equal(readPackMarkers(afterOld).arrival, null, "vana reegel kaotas tõendi");

  const store = fakeStore(storedPack(payload));
  const fetchImpl = fakeFetch([
    visitBody({ id: "visit-1", version: 4, arrivedConfirmedAt: null }),
    { status: 500, body: {} }
  ]);
  await flushVisitMarkers({ store, visitId: "visit-1", fetchImpl, now: later(10) });
  assert.ok(
    readPackMarkers((await store.getPack("visit-1")).payload).arrival,
    "uus reegel peab sama olukorra tõendi ALLES jätma"
  );
});

test("paketita külastus ei kuku ega leiuta markerit", async () => {
  const store = fakeStore(null);
  const fetchImpl = fakeFetch([]);
  const outcome = await flushVisitMarkers({ store, visitId: "visit-1", fetchImpl, now: NOW });
  assert.deepEqual(outcome, { confirmed: [], kept: [], reasons: {} });
  assert.equal(fetchImpl.calls.length, 0);
});

/**
 * Kesta ja mootori SIDE, mida ühiktest renderdada ei saa. Ta kukub, kui keegi
 * viib markeri tagasi `storePack`-i võltsvisiidi rajale või eemaldab
 * tõrkebänneri.
 */
test("kest kasutab markerite rada ja kuvab tõrkeseisu", () => {
  const room = readFileSync(new URL("../../components/field/FieldVisitRoom.jsx", import.meta.url), "utf8");
  assert.ok(/sync\.recordMarker\(/.test(room), "võrguta kinnitus peab käima markerite raja kaudu");
  assert.equal(
    /storePack\(\{\s*\n?\s*id: visitId/.test(room),
    false,
    "võltsvisiit `storePack`-i ei tohi tagasi tulla — ta kirjutas üle terve paketi"
  );
  assert.ok(/field\.markers\.failedTitle/.test(room), "tõrkeseis peab olema NÄHTAV");
  assert.ok(/field\.markers\.retry/.test(room), "korduskatse peab olema pakutud");

  const hook = readFileSync(new URL("../../components/field/useFieldSync.js", import.meta.url), "utf8");
  assert.ok(hook.includes("flushVisitMarkers"), "flush peab käima jagatud poliitika kaudu");
  assert.ok(
    /markers: readPackMarkers\(existing\?\.payload\)/.test(hook),
    "paketi ümberehitus peab markerid EDASI KANDMA — see oli leiu esimene pool"
  );

  for (const locale of ["et", "en", "ru"]) {
    const messages = JSON.parse(readFileSync(new URL(`../../messages/${locale}.json`, import.meta.url), "utf8"));
    for (const key of ["failedTitle", "retry", "needsPack", "storedOffline", "pendingSync"]) {
      assert.equal(typeof messages.field?.markers?.[key], "string", `${locale}: field.markers.${key}`);
    }
    for (const reason of Object.values(FIELD_MARKER_REASON)) {
      assert.equal(
        typeof messages.field?.markers?.reason?.[reason],
        "string",
        `${locale}: field.markers.reason.${reason}`
      );
    }
  }
});
