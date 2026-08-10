/**
 * TEENUSPÄEVIK — seadme kohalik salvestus on KONTO oma (SOL-SLOG-01, P0).
 *
 * Leid oli konkreetne: jagatud arvutis kontot vahetades nägi järgmine töötaja
 * eelmise kliendi nime ja märkust, ja võrgujärjekord SAATIS need kirjed uue
 * töötaja profiili teenuskirjeteks. Seepärast on siin iga positiivse testi
 * kõrval NEGATIIVKONTROLL — kontrollitakse, et B ei näe A oma, mitte ainult
 * seda, et A näeb enda oma.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  DEVICE_ROW,
  deviceRowKey,
  openDeviceStore,
  purgeUnscopedRows
} from "../../lib/serviceLog/deviceStore.js";
import { enqueue, outboxCount, readOutbox } from "../../lib/serviceLog/outbox.js";
import { readVisitDraft, writeVisitDraft } from "../../lib/serviceLog/visitDraft.js";

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    keys: () => [...map.keys()],
    size: () => map.size
  };
}

test("kaks kontot samas brauseris ei näe teineteise järjekorda", () => {
  const device = fakeStorage();
  const a = openDeviceStore(device, "user-a");
  const b = openDeviceStore(device, "user-b");

  enqueue(a, { clientRequestId: "a1", clientDisplayName: "Helvi Sarapuu" });

  /* NEGATIIVKONTROLL: ilma temata mõõdaks ülemine rida ainult seda, et
     kirjutamine üldse töötab. */
  assert.equal(outboxCount(b), 0, "B ei tohi näha A tehtud tööd");
  assert.deepEqual(readOutbox(b), []);

  enqueue(b, { clientRequestId: "b1", clientDisplayName: "Mart Tamm" });
  assert.deepEqual(
    readOutbox(a).map((item) => item.clientDisplayName),
    ["Helvi Sarapuu"],
    "B kirje ei tohi sattuda A järjekorda"
  );
  assert.equal(readOutbox(b)[0].clientDisplayName, "Mart Tamm");
});

test("kaks kontot samas brauseris ei näe teineteise mustandit", () => {
  const device = fakeStorage();
  const a = openDeviceStore(device, "user-a");
  const b = openDeviceStore(device, "user-b");

  writeVisitDraft(a, { clientName: "Helvi Sarapuu", note: "Ravimid said otsa." }, 1_000);

  assert.equal(readVisitDraft(b, 1_000), null, "B ei tohi näha A kliendi nime");
  assert.equal(readVisitDraft(a, 1_000).clientName, "Helvi Sarapuu");
});

/* Ilma omanikuta on seade LUKUS, mitte lahti vale omaniku peale: sessiooni
   laadimise ja väljalogitud oleku ajal ei loeta ega kirjutata midagi. */
test("omanikuta ei loeta ega kirjutata midagi", () => {
  const device = fakeStorage();
  const a = openDeviceStore(device, "user-a");
  enqueue(a, { clientRequestId: "a1", clientDisplayName: "Helvi Sarapuu" });

  for (const missing of ["", "   ", null, undefined]) {
    const store = openDeviceStore(device, missing);
    assert.equal(store, null, `omanik ${JSON.stringify(missing)} ei tohi anda salvestust`);
    assert.deepEqual(readOutbox(store), [], "lukus seade ei anna kirjeid saatmiseks");
    assert.equal(readVisitDraft(store, 1_000), null);
  }

  /* Ja lukus seade ei tohi ka midagi ÄRA kaotada. */
  assert.equal(outboxCount(openDeviceStore(device, "user-a")), 1);
});

test("salvestuseta keskkond (server-render) ei viska ega valeta", () => {
  assert.equal(openDeviceStore(null, "user-a"), null);
  assert.equal(deviceRowKey(DEVICE_ROW.OUTBOX, ""), null);
  assert.equal(deviceRowKey("", "user-a"), null);
  assert.doesNotThrow(() => writeVisitDraft(openDeviceStore(null, "user-a"), { clientName: "X" }));
});

/**
 * VANA SILDISTAMATA RIDA. Teda ei saa omistada — payload'is on kliendi nimi,
 * mitte töötaja. Kolmest valikust (anna esimesele avajale / jäta seisma /
 * kustuta) on ainus lekkevaba viimane.
 */
test("vana ühine rida kustutatakse, mitte ei anta järgmisele kasutajale", () => {
  const device = fakeStorage({
    [DEVICE_ROW.OUTBOX]: JSON.stringify([{ clientRequestId: "vana", clientDisplayName: "Helvi" }]),
    [DEVICE_ROW.VISIT_DRAFT]: JSON.stringify({ clientName: "Helvi", savedAt: 1_000 })
  });

  const removed = purgeUnscopedRows(device);

  assert.deepEqual(removed.sort(), [DEVICE_ROW.OUTBOX, DEVICE_ROW.VISIT_DRAFT].sort());
  assert.equal(device.size(), 0, "kliendi nimi ei tohi jääda omanikuta seadmesse seisma");
  assert.deepEqual(readOutbox(openDeviceStore(device, "user-b")), [], "B ei peri vana rida");
});

test("koristus ei puuduta kellegi konto ridu", () => {
  const device = fakeStorage();
  const a = openDeviceStore(device, "user-a");
  enqueue(a, { clientRequestId: "a1" });
  writeVisitDraft(a, { clientName: "Helvi Sarapuu" }, 1_000);

  assert.deepEqual(purgeUnscopedRows(device), [], "sildistamata ridu ei olnud");
  assert.equal(outboxCount(a), 1, "saatmata töö ei tohi koristusest kaduda");
  assert.equal(readVisitDraft(a, 1_000).clientName, "Helvi Sarapuu");
});

/* Võti peab olema loetav ka silmaga: tugiolukorras vaadatakse `localStorage`-i
   ja „kelle rida see on" ei tohi olla arvamise küsimus. */
test("võtmes on alusnimi ja omanik", () => {
  const device = fakeStorage();
  enqueue(openDeviceStore(device, "user-a"), { clientRequestId: "a1" });
  assert.deepEqual(device.keys(), [`${DEVICE_ROW.OUTBOX}::user-a`]);
});
