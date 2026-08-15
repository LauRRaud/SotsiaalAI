/**
 * TEENUSPÄEVIK — pooleli olev külastus elab telefoni lukustumise üle.
 *
 * Omaniku nõue 02.08, sõna-sõnalt: „Kindlasti peab säilima kliendi nimi kui
 * telefon lukustub ja uuesti lahti teha, muidu läheb meelest, kellega tegu ja
 * võib panna vale kliendi nime."
 *
 * Testid katavad KOLM asja, mis kõik on tasakaalu kaks otsa:
 *   1. nimi PÜSIB (muidu kirjutatakse mälu järgi ja eksitakse),
 *   2. nimi EI PÜSI IGAVESTI (isikuandmed ei tohi seadmes seista),
 *   3. salvestatud kirje kustutab mustandi kohe.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  DRAFT_ROW,
  DRAFT_MAX_AGE_MS,
  clearVisitDraft,
  draftHasWork,
  readVisitDraft,
  writeVisitDraft
} from "../../lib/serviceLog/visitDraft.js";
import { deviceRowKey, openDeviceStore } from "../../lib/serviceLog/deviceStore.js";

/**
 * Mustand EI ELA enam brauseri ühises võtmes, vaid konto omas (SOL-SLOG-01).
 * Testid käivad sama teed, mis komponent.
 */
const OWNER = "user-a";
const DRAFT_KEY = deviceRowKey(DRAFT_ROW, OWNER);

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  const store = openDeviceStore(
    {
      getItem: (key) => (map.has(key) ? map.get(key) : null),
      setItem: (key, value) => map.set(key, String(value)),
      removeItem: (key) => map.delete(key)
    },
    OWNER
  );
  /* `raw` läheb VÕTMEST otse mööda skoopimisest: nii saab tõendada, et
     kliendi nimi kadus päris salvestusest, mitte ainult lugeja silmist. */
  return Object.assign(store, {
    raw: (key) => (map.has(key) ? map.get(key) : null),
    size: () => map.size
  });
}

const VISIT = {
  stamps: { arrivedAt: "2026-08-02T16:24:00.000Z" },
  locationStamps: { arrivedAt: { lat: 59.43, lng: 24.52, acc: 14, at: "2026-08-02T16:24:03.000Z" } },
  withTravel: true,
  clientName: "Helvi Sarapuu",
  note: "Ütles, et ravimid said otsa.",
  noteProvenance: "KLIENDI_OELDUD",
  quantity: "1.5",
  unit: "HOUR",
  referralId: "ref-1",
  date: "2026-08-02"
};

test("telefon läks lukku ja tuli lahti: klient on ikka sama", () => {
  const storage = fakeStorage();
  writeVisitDraft(storage, VISIT, 1_000);
  const restored = readVisitDraft(storage, 1_000 + 45 * 60 * 1000);
  assert.equal(restored.clientName, "Helvi Sarapuu", "just see nimi läheks muidu meelest");
  assert.equal(restored.note, VISIT.note);
  assert.equal(restored.noteProvenance, "KLIENDI_OELDUD", "päritolu on osa märkusest");
  assert.equal(restored.quantity, "1.5");
  assert.equal(restored.unit, "HOUR");
  assert.equal(restored.referralId, "ref-1", "vale suunamine tähendaks valet KOV-i");
  assert.equal(restored.date, "2026-08-02");
  assert.equal(restored.withTravel, true);
  assert.deepEqual(restored.stamps, VISIT.stamps);
  assert.deepEqual(restored.locationStamps, VISIT.locationStamps, "asukoht ei tohi lukustumisel kaduda");
});

test("üleöö seisnud mustand kustutatakse LUGEMISEL, mitte ei jäeta vahele", () => {
  const storage = fakeStorage();
  writeVisitDraft(storage, VISIT, 0);
  assert.equal(readVisitDraft(storage, DRAFT_MAX_AGE_MS + 1), null);
  assert.equal(storage.raw(DRAFT_KEY), null, "nimi ei tohi seadmesse seisma jääda");
});

test("ajatempliga sassi läinud mustand ei jää igaveseks", () => {
  const storage = fakeStorage({ [DRAFT_KEY]: JSON.stringify({ clientName: "Keegi" }) });
  assert.equal(readVisitDraft(storage, 5_000), null, "ilma `savedAt`-ita ei saa iga hinnata");
  assert.equal(storage.raw(DRAFT_KEY), null);
});

test("salvestatud kirje kustutab mustandi kohe", () => {
  const storage = fakeStorage();
  writeVisitDraft(storage, VISIT, 1_000);
  clearVisitDraft(storage);
  assert.equal(storage.size(), 0);
});

/* Nimi ilma tempelita on samuti pooleli töö: töötaja kirjutas nime enne, kui
   uksele jõudis. Vana reegel („salvesta ainult templite olemasolul") oleks
   just selle kaotanud. */
test("nimi ilma ühegi tempelita on pooleli töö", () => {
  assert.equal(draftHasWork({ clientName: "Helvi Sarapuu" }), true);
  assert.equal(draftHasWork({ note: "märkus" }), true);
  assert.equal(draftHasWork({ quantity: "2" }), true);
  assert.equal(draftHasWork({ stamps: { arrivedAt: "x" } }), true);
});

test("tühi vorm ei jäta seadmesse midagi", () => {
  const storage = fakeStorage();
  writeVisitDraft(storage, VISIT, 1_000);
  writeVisitDraft(storage, { stamps: {}, clientName: "", note: "", quantity: "" }, 2_000);
  assert.equal(storage.size(), 0, "tühjaks tehtud vorm kustutab ka vana mustandi");
});

test("rikutud sisu ega puuduv salvestusruum ei katkesta külastust", () => {
  const storage = fakeStorage({ [DRAFT_KEY]: "{ see ei ole JSON" });
  assert.equal(readVisitDraft(storage, 1), null);
  assert.equal(readVisitDraft(null, 1), null);
  assert.doesNotThrow(() => writeVisitDraft(null, VISIT));
  assert.doesNotThrow(() => clearVisitDraft(null));
});

test("seadmesse istutatud väljad ei pääse ajatemplite kaudu POST payload'i", () => {
  const storage = fakeStorage({
    [DRAFT_KEY]: JSON.stringify({
      savedAt: 1_000,
      stamps: {
        arrivedAt: "2026-08-02T16:24:00.000Z",
        clientDisplayName: "Istutatud nimi",
        date: "2031-12-25",
        quantity: 999
      }
    })
  });

  assert.deepEqual(readVisitDraft(storage, 1_000).stamps, {
    arrivedAt: "2026-08-02T16:24:00.000Z"
  });
});

/* Täis `localStorage` viskab `QuotaExceededError`. Külastuse märkimine ei tohi
   sellest sõltuda — tempel on tähtsam kui tema koopia. */
test("täis salvestusruum ei viska kasutaja peale viga", () => {
  const storage = {
    getItem: () => null,
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
    removeItem: () => {}
  };
  assert.doesNotThrow(() => writeVisitDraft(storage, VISIT));
});
