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
  LOCATION_MAX_USEFUL_ACCURACY_M,
  LOCATION_TIMEOUT_MS,
  LOCATION_TRUSTED_ACCURACY_M,
  LOCATION_REASON,
  captureLocationPoint,
  isTrustedAccuracy
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

/**
 * SEE TEST ON ÜMBER PÖÖRATUD ja tema vana kuju oli VIGA.
 *
 * Varem nõudis ta „ajapiirang on lühike" (≤10 s) ja lubas vahemälu kuni minut.
 * Mõlemad lähtusid kannatusest, mitte tõendist. Omanik mõõtis 02.08 päris
 * seadmes: leht ütles Kopli, tegelik koht oli Tabasalu. Vastus tuli kohe —
 * vahemälust — ja oli täiesti vale.
 *
 * Ootamist ei maksa karta, sest asukohta küsitakse ALLES PÄRAST ajatempli
 * kirjapanekut: mitte keegi ei seisa ukse taga ja ei oota GPS-i. Vale punkt
 * seevastu jõuab arve alusdokumendile.
 */
test("asukohta MÕÕDETAKSE, vahemälust vastust ei võeta", () => {
  assert.equal(LOCATION_MAX_AGE_MS, 0, "vahemälu andis Tabasalu asemel Kopli");
  assert.ok(LOCATION_TIMEOUT_MS >= 15_000, "külm GPS ei jõua 8 sekundiga täpse fixini");
});

test("täpsus otsustab, kas punkt tõendab kohalolekut", () => {
  assert.equal(isTrustedAccuracy(12), true);
  assert.equal(isTrustedAccuracy(LOCATION_TRUSTED_ACCURACY_M), true, "lävi ise on veel usaldatav");
  assert.equal(isTrustedAccuracy(2500), false, "±2,5 km ütleb ainult „kuskil linnas”");
  assert.equal(isTrustedAccuracy(undefined), false, "teadmata täpsus ei ole hea täpsus");
  assert.equal(isTrustedAccuracy(-1), false);
});

test("mõõdetud punkt kannab täpsust ja otsust kaasas", async () => {
  const point = await captureLocationPoint(
    fakeNavigator((success) => success({ coords: { latitude: 59.43, longitude: 24.52, accuracy: 18.4 } }))
  );
  assert.equal(point.acc, 18, "täpsus ümardatakse meetriteks");
  assert.equal(point.trusted, true);
});

test("jäme punkt tuleb kaasa, aga MÄRGISTATUNA", async () => {
  const point = await captureLocationPoint(
    fakeNavigator((success) => success({ coords: { latitude: 59.44, longitude: 24.75, accuracy: 3200 } }))
  );
  assert.ok(point, "±3,2 km ei ole vale mõõtmine — ta on jäme mõõtmine");
  assert.equal(point.trusted, false, "ilma selleta näeks ta ekraanil välja nagu tõend");
});

/* IP-põhine määrang annab kümneid kilomeetreid. Rida, mis näeb välja nagu
   asukoht, aga ei ütle midagi, on halvem kui puuduv rida: teda hakatakse
   hiljem kaardil vaatama ja ta valetab vaikselt. */
test("kasutu täpsusega punkt ei jõua kirjele üldse", async () => {
  const point = await captureLocationPoint(
    fakeNavigator((success) =>
      success({ coords: { latitude: 59.1, longitude: 24.1, accuracy: LOCATION_MAX_USEFUL_ACCURACY_M + 1 } })
    )
  );
  assert.equal(point, null);
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

/**
 * PÕHJUS ON OSA VASTUSEST. Üks ja sama lause iga tõrke peale jättis kasutaja
 * teadmatusse, kas ta peaks midagi ette võtma: keelatud luba on parandatav ühe
 * klikiga, aegumine tähendab „proovi akna juures", toetuseta seade mitte midagi.
 */
test("tõrke põhjus jõuab kutsujani, tempel jääb ikka kirja", async () => {
  const seen = [];
  const point = await captureLocationPoint(
    fakeNavigator((success, error) => error({ code: 1 })),
    { onReason: (reason) => seen.push(reason) }
  );
  assert.equal(point, null, "tõrge ei anna punkti");
  assert.deepEqual(seen, [LOCATION_REASON.DENIED], "keelatud luba on parandatav — seda peab ütlema");
});

test("iga veakood saab oma põhjuse", async () => {
  const collect = async (code) => {
    let reason = null;
    await captureLocationPoint(fakeNavigator((success, error) => error({ code })), {
      onReason: (value) => {
        reason = value;
      }
    });
    return reason;
  };
  assert.equal(await collect(2), LOCATION_REASON.UNAVAILABLE);
  assert.equal(await collect(3), LOCATION_REASON.TIMEOUT);
  assert.equal(await collect(99), LOCATION_REASON.UNAVAILABLE, "tundmatu kood ei tohi vaikida");
});

test("liiga jäme punkt ütleb VÄLJA, miks teda ei salvestatud", async () => {
  let reason = null;
  await captureLocationPoint(
    fakeNavigator((success) => success({ coords: { latitude: 59, longitude: 24, accuracy: 40_000 } })),
    { onReason: (value) => (reason = value) }
  );
  assert.equal(reason, LOCATION_REASON.TOO_COARSE);
});

test("asukohata seade ütleb seda kohe, mitte ei vaiki", async () => {
  let reason = null;
  const point = await captureLocationPoint({}, { onReason: (value) => (reason = value) });
  assert.equal(point, null);
  assert.equal(reason, LOCATION_REASON.UNSUPPORTED);
});

/* Teavituse enda viga ei tohi punkti ega ajatemplit ära kaotada. */
test("katkine teavituskutse ei lõhu asukohapäringut", async () => {
  const point = await captureLocationPoint(
    fakeNavigator((success) => success({ coords: { latitude: 59.4, longitude: 24.5, accuracy: 10 } })),
    {
      onReason: () => {
        throw new Error("kutsuja viga");
      }
    }
  );
  assert.equal(point.lat, 59.4);
});
