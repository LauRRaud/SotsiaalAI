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
 * `storage` käib parameetrina sisse (sama muster mis `outbox.js`): nii on see
 * loogika testitav ilma brauserita ja `localStorage`-i puudumine ei ole erand,
 * mida iga kutsuja eraldi meeles peaks pidama.
 */

export const DRAFT_KEY = "sotsiaalai.service_log.visit_draft";

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

const asText = (value) => (typeof value === "string" ? value : "");
const asObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

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
export function readVisitDraft(storage, now = Date.now()) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const savedAt = Number(parsed.savedAt);
    if (!Number.isFinite(savedAt) || now - savedAt > DRAFT_MAX_AGE_MS) {
      storage.removeItem(DRAFT_KEY);
      return null;
    }

    const draft = {
      stamps: asObject(parsed.stamps),
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

export function writeVisitDraft(storage, draft, now = Date.now()) {
  if (!storage) return;
  try {
    if (!draftHasWork(draft)) {
      storage.removeItem(DRAFT_KEY);
      return;
    }
    storage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, savedAt: now }));
  } catch {}
}

export function clearVisitDraft(storage) {
  if (!storage) return;
  try {
    storage.removeItem(DRAFT_KEY);
  } catch {}
}
