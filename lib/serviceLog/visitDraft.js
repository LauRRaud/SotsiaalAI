/**
 * TEENUSPÄEVIK — POOLELI OLEV KÜLASTUS SEADMES.
 *
 * MIKS SEE FAIL OLEMAS ON. Külastuse ajal on telefon taskus. Ekraan läheb
 * lukku, töötaja teeb tööd, siis võtab telefoni uuesti — ja brauser on vahepeal
 * lehe mälust välja visanud. Kõik, mis elas ainult komponendi olekus, on kadunud.
 *
 * VARASEM REEGEL OLI VALE. Siin püsisid teadlikult ainult ajatemplid,
 * põhjendusega „`localStorage` ei ole isikuandmete koht". Kaks viga korraga:
 *
 *   1. Ta ei olnud järjekindel. Võrguta järjekord (`outbox.js`) hoiab kliendi
 *      nimesid samas `localStorage`-is juba ammu — seda me pidasime õigeks.
 *   2. Ta kaalus valesti. Kadunud nimi tuleb kirjutada mälu järgi, ja eksitus
 *      tähendab VALE KLIENDI NIME arve alusdokumendil. Kellegi teise nimi
 *      kellegi teise teenuse peal on raskem viga kui nimi, mis seisis tund aega
 *      töötaja enda lukustatud telefonis.
 *
 * KAITSE ON SEEGA IGA, MITTE VÄLJAJÄTT: mustand kustub kirje salvestamisel ja
 * `DRAFT_MAX_AGE_MS` möödudes ka lugemisel. Külastus ei kesta üle öö — hommikul
 * alles olev mustand ei ole pooleli töö, vaid unustatud jäänuk.
 *
 * `store` käib parameetrina sisse (sama muster mis `outbox.js`): nii on see
 * loogika testitav ilma brauserita ja salvestuse puudumine ei ole erand, mida
 * iga kutsuja eraldi meeles peaks pidama.
 *
 * SEE EI OLE `localStorage`, VAID KONTO SALVESTUS (`openDeviceStore`,
 * SOL-SLOG-01). Mustandis on kliendi nimi; ühine brauserivõti andis ta
 * kontovahetusel järgmisele töötajale. Omanikuta `store` on `null` ja siinne
 * „salvestust ei ole" haru lukustab seadme, kuni identiteet on teada.
 */

import { DEVICE_ROW } from "./deviceStore.js";

export const DRAFT_ROW = DEVICE_ROW.VISIT_DRAFT;

/** 18 tundi: pikem kui ükski vahetus, lühem kui üks öö. */
export const DRAFT_MAX_AGE_MS = 18 * 60 * 60 * 1000;

const TEXT_FIELDS = [
  "clientName",
  "note",
  "noteProvenance",
  "quantity",
  "unit",
  "referralId",
  "date"
];

const STAMP_FIELDS = ["departedForVisitAt", "arrivedAt", "leftAt", "returnedFromVisitAt"];

const asText = (value) => (typeof value === "string" ? value : "");
const asObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};
const readStamps = (value) => {
  const source = asObject(value);
  return Object.fromEntries(
    STAMP_FIELDS.filter((field) => typeof source[field] === "string").map((field) => [
      field,
      source[field]
    ])
  );
};

/**
 * „Midagi on pooleli" EI OLE ainult tempel. Nimi ilma tempelita on samuti töö,
 * mille kadumine sunniks mälu järgi kirjutama — täpselt see, mida väldime.
 */
export function draftHasWork(draft) {
  if (!draft) return false;
  if (Object.keys(asObject(draft.stamps)).length > 0) return true;
  return Boolean(draft.clientName || draft.note || draft.quantity);
}

/**
 * @returns mustand või `null`. AEGUNU KUSTUTATAKSE, mitte ei jäeta vahele:
 *   muidu jääks kliendi nimi seadmesse seisma seni, kuni keegi juhtub uut
 *   külastust alustama.
 */
export function readVisitDraft(store, now = Date.now()) {
  if (!store) return null;
  try {
    const raw = store.getItem(DRAFT_ROW);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const savedAt = Number(parsed.savedAt);
    if (!Number.isFinite(savedAt) || now - savedAt > DRAFT_MAX_AGE_MS) {
      store.removeItem(DRAFT_ROW);
      return null;
    }

    const draft = {
      /* Mustand on kliendi juhitav salvestus. Ajatemplite nimekiri peab olema
         suletud, sest komponent lisab need POST payload'i väljadena. */
      stamps: readStamps(parsed.stamps),
      locationStamps: asObject(parsed.locationStamps),
      withTravel: Boolean(parsed.withTravel)
    };
    for (const field of TEXT_FIELDS) draft[field] = asText(parsed[field]);
    return draft;
  } catch {
    /* Rikutud või täis salvestusruum ei tohi külastust katkestada. */
    return null;
  }
}

export function writeVisitDraft(store, draft, now = Date.now()) {
  if (!store) return;
  try {
    if (!draftHasWork(draft)) {
      store.removeItem(DRAFT_ROW);
      return;
    }
    store.setItem(DRAFT_ROW, JSON.stringify({ ...draft, savedAt: now }));
  } catch {}
}

export function clearVisitDraft(store) {
  if (!store) return;
  try {
    store.removeItem(DRAFT_ROW);
  } catch {}
}
