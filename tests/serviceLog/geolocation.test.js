/**
 * TEENUSPÄEVIK E2b — ühekordne asukohapunkt (DoD 10).
 *
 * DoD 10 sõnastus on kitsas: „GPS-lipp sees tähendab maksimaalselt üht punkti
 * teadliku sündmuse kohta; `watchPosition`/taustajälg puudub ja GPS-i tõrge ei
 * blokeeri ajatemplit."
 *
 * Kaks esimest on kontrollitavad KOODI kohta, mitte ainult käitumise kohta —
 * seepärast on siin ka lähtekoodi kontroll. Ta ei asenda käitumistesti, vaid
 * katab selle, mida käitumistest ei näe: et vale funktsioon EI OLE koodis üldse
 * olemas.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  LOCATION_MAX_AGE_MS,
  LOCATION_TIMEOUT_MS,
  captureLocationPoint
} from "../../lib/serviceLog/geolocation.js";

function fakeNavigator(impl) {
  return { geolocation: { getCurrentPosition: impl } };
}

test("õnnestunud päring annab ühe punkti koos täpsusega", async () => {
  const point = await captureLocationPoint(
    fakeNavigator((success) =>
      success({ coords: { latitude: 58.38, longitude: 26.72, accuracy: 12.4 } })
    )
  );
  assert.equal(point.lat, 58.38);
  assert.equal(point.lng, 26.72);
  assert.equal(point.acc, 12, "täpsus ümardatakse meetriks");
  assert.ok(point.at, "punkt kannab oma aega");
});

/* TÕRGE EI TOHI VISATA. Kutsuja on ajatempli juba kirja pannud ja unustatud
   `catch` ei tohi seda ära kaotada. */
test("loa puudumine, GPS-i viga ja puuduv API annavad kõik null", async () => {
  assert.equal(await captureLocationPoint(fakeNavigator((_s, error) => error({ code: 1 }))), null);
  assert.equal(
    await captureLocationPoint(
      fakeNavigator(() => {
        throw new Error("SecurityError");
      })
    ),
    null
  );
  assert.equal(await captureLocationPoint({}), null);
  assert.equal(await captureLocationPoint(null), null);
});

test("vigased koordinaadid ei jõua punktiks", async () => {
  const point = await captureLocationPoint(
    fakeNavigator((success) => success({ coords: { latitude: "ei ole number", longitude: 26.72 } }))
  );
  assert.equal(point, null);
});

/* Kaks vastust ühele küsimusele (nt callback JA meie taimer) ei tohi anda kahte
   punkti — üks teadlik sündmus, üks punkt. */
test("topeltvastus annab ikka ühe tulemuse", async () => {
  const point = await captureLocationPoint(
    fakeNavigator((success, error) => {
      success({ coords: { latitude: 58.38, longitude: 26.72, accuracy: 5 } });
      success({ coords: { latitude: 1, longitude: 1, accuracy: 5 } });
      error({ code: 3 });
    })
  );
  assert.equal(point.lat, 58.38, "esimene vastus jääb kehtima");
});

test("ajapiirang on lühike ja vahemälu vana punkti ei kõlba", () => {
  assert.ok(LOCATION_TIMEOUT_MS <= 10_000, "uksel seisev inimene ei oota kaua");
  assert.ok(LOCATION_MAX_AGE_MS <= 60_000, "eilne punkt oleks vale tõend");
});

/* DoD 10 KOODIKONTROLL. Käitumistest ei näe kunagi seda, mida koodis EI OLE —
   ja just see on siin nõue. */
/**
 * KOMMENTAARID EEMALDATAKSE ENNE KONTROLLI. Reegel käib KUTSETE kohta, mitte
 * teksti kohta: „`getCurrentPosition`, MITTE `watchPosition`" on just see
 * selgitus, mis hoiab reeglit elus, ja tema keelamine sunniks põhjust maha
 * vaikima. Esimene versioon kukkus täpselt oma dokumentatsiooni peale.
 */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("teenuspäeviku koodis ei ole watchPosition ega taustajälge", () => {
  const files = ["lib/serviceLog/geolocation.js", "components/serviceLog/ServiceLogDay.jsx"];
  for (const file of files) {
    const code = stripComments(readFileSync(path.join(process.cwd(), file), "utf8"));
    assert.ok(!code.includes("watchPosition"), `${file} ei tohi KUTSUDA watchPosition`);
    assert.ok(!code.includes("clearWatch"), `${file} ei tohi KUTSUDA clearWatch`);
  }
});

/* Kontrollija ise peab ka töötama: kui `stripComments` sööks liiga palju, läheks
   test roheliseks põhjusel, millel ei ole koodiga pistmist. */
test("kommentaari-eemaldaja ei söö päris koodi", () => {
  assert.ok(stripComments("/* watchPosition */ const a = 1;").includes("const a = 1;"));
  assert.ok(!stripComments("/* watchPosition */ const a = 1;").includes("watchPosition"));
  assert.ok(stripComments("navigator.geolocation.watchPosition(fn)").includes("watchPosition"));
  assert.ok(stripComments("const url = 'https://example.test';").includes("https://example.test"));
});
