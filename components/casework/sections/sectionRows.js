/**
 * JTA-V1 — juhtumi kolme sektsiooni (kohtumise ettevalmistus, kohtumise märge,
 * STAR2 järjekord koos ülekandega) vaadete otsused ILMA JSX-ita: sõnastikud,
 * sakkide loendid, read, valikud ja seisu sõnad.
 *
 * MIKS OMA FAIL. Sama põhjus mis `caseViews.js`-il ja `transferFlow.js`-il:
 * JSX-failis elavat otsust ei saa selle projekti testijooksjaga tõendada. Siin
 * on puhtad funktsioonid; sektsioonid (`../MeetingPrepSection.jsx` jt) hoiavad
 * andmeid ja päringuid, vaated (`./*.jsx`) ainult joonistavad.
 *
 * SIIN ON KA NEED LOENDID, MIS PEAVAD SERVERIGA KOKKU MINEMA (ettevalmistuse
 * väljad, küsimuse liigid, märkme kihid, mustandi tüübid, lubatud siirded).
 * Varem seisid need JSX-failides ja kommentaar lubas testi, mida ei olnud:
 * teenuskihti ei saa pinnale importida (ta toob Prisma kliendi) ja JSX-faili ei
 * saa testi importida. Nüüd võrdleb `tests/casework-sections-views.test.mjs`
 * neid serveri failidega.
 *
 * TOORES VÄÄRTUS EI LÄHE EKRAANILE. Seis, liik, kiht ja päritolu jõuavad pinnale
 * ainult kataloogi sõnana; tundmatu väärtuse kohta öeldakse „tundmatu", mitte ei
 * näidata enum'i nime ega tõlkevõtit. Ainus erand on mustandi välja võti: see on
 * töötaja enda kirjutatud nimi, mitte platvormi sisemine väärtus, ja sama tekst
 * läheb STAR2 plokki.
 */

import { PROVENANCE, PROVENANCES, provenanceLabelKey } from "@/lib/workspaces/provenance";

import { dateText, timeText } from "../caseViews";

/* ────────────────────────────────────────────────────────────────────────────
   ÜHINE
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Kataloogi sõna või tühi. `t(võti, "")` annab puuduva võtme korral võtme enda
 * tagasi: enum'ist kokku pandud võti jõuaks nii tundmatu väärtusega ekraanile.
 */
function word(t, key) {
  const text = t(key, "");
  return text && text !== key ? text : "";
}

const list = (value) => (Array.isArray(value) ? value : []);

/** Päritolu sõnana. Tundmatu väärtus ütleb, et päritolu on tundmatu. */
export function provenanceText(value, t) {
  return t(provenanceLabelKey(value) || "casework.errors.provenance_unknown", "");
}

/** Kõik kaheksa päritolu valikuks. Vaikimisi valikut ei ole (L4). */
export function provenanceOptions(t) {
  return PROVENANCES.map((value) => ({ value, label: t(provenanceLabelKey(value), "") }));
}

/**
 * Märgised, milleks AI mustandi saab kinnitada.
 *
 * `AI_MUSTAND` ise puudub loendist ja see ei ole väljajätt: tagasitee masina
 * märgise juurde kirjutaks inimese kinnituse ümber ja server annab 400.
 */
export const CONFIRM_TARGETS = Object.freeze(PROVENANCES.filter((value) => value !== PROVENANCE.AI_MUSTAND));

export function confirmTargetOptions(t) {
  return CONFIRM_TARGETS.map((value) => ({ value, label: t(provenanceLabelKey(value), "") }));
}

/** Kas rida kannab masina märgist ja ootab inimese kinnitust. */
export function isAiDraft(value) {
  return value === PROVENANCE.AI_MUSTAND;
}

/* Tsiteeritud tekst, mis on sellest pikem või millel on rohkem ridu, näidatakse
   esialgu kahe reaga (avaneb kohapeal): muidu lükkab pikk väli valiku ja nupud
   paneelist välja. */
const QUOTE_SHORT_CHARS = 140;
const QUOTE_SHORT_LINES = 2;

/** Kas tsiteeritud tekst vajab lühendamist (pikk või mitmerealine). */
export function quoteIsLong(text) {
  const value = String(text || "");
  return value.length > QUOTE_SHORT_CHARS || value.split("\n").length > QUOTE_SHORT_LINES;
}

/**
 * Uue rea (küsimus, märkme kirje, mustandi väli) saab saata alles siis, kui
 * tekst on kirjutatud JA päritolu valitud (L4: märgis, mille inimene ei
 * valinud, ei ole märgis). Server keeldub tühjast; nupp ei lase enne saata.
 */
export function canAddRow({ text, provenance }) {
  return Boolean(String(text || "").trim()) && PROVENANCES.includes(provenance);
}

/* ────────────────────────────────────────────────────────────────────────────
   KOHTUMISE ETTEVALMISTUS
   ──────────────────────────────────────────────────────────────────────────── */

/** Sama hulk mis `CaseWorkPrepFieldKey` skeemis ja `PREP_FIELD_KEYS` teenuskihis. */
export const PREP_FIELD_KEYS = Object.freeze(["GOAL", "REQUIRED_DOCUMENTS", "LIFE_DOMAINS", "AGENDA", "PLAIN_LANGUAGE_NOTES"]);

/** Sama hulk mis `QUESTION_KINDS` teenuskihis. */
export const QUESTION_KINDS = Object.freeze(["CLARIFYING_QUESTION", "CLAIM_TO_VERIFY"]);

/** Avatud ettevalmistuse vaated: ülevaade, viis välja ja küsimused. */
export const PREP_TABS = Object.freeze(["overview", ...PREP_FIELD_KEYS, "questions"]);

function meetingTitle(row, { t, locale }, emptyKey) {
  return timeText(row?.meetingAt, locale) || t(emptyKey, "");
}

/** Ettevalmistuse nimi on tema kohtumise aeg; ajata ettevalmistus ütleb seda sõnadega. */
export function prepTitle(prep, context) {
  return meetingTitle(prep, context, "casework.prep.no_meeting_time");
}

/**
 * Ettevalmistuste loendi read. `purged` (O-JTA-6): arhiveeritud sisuga
 * ettevalmistus peab olema loendis TÜHJAST ERISTATAV.
 */
export function prepRows(preps, context) {
  return list(preps)
    .filter((row) => row?.id)
    .map((row) => ({ id: String(row.id), title: prepTitle(row, context), purged: Boolean(row.contentPurgedAt) }));
}

function prepFieldRow(prep, fieldKey) {
  return list(prep?.fields).find((row) => row?.fieldKey === fieldKey) || null;
}

/** Välja salvestatud tekst (tühi, kui välja ei ole veel salvestatud). */
export function prepFieldText(prep, fieldKey) {
  return String(prepFieldRow(prep, fieldKey)?.text || "");
}

/** Mitu rida (väli või küsimus) kannab veel masina märgist. */
function aiPendingCount(prep) {
  return [...list(prep?.fields), ...list(prep?.questions)].filter((row) => isAiDraft(row?.provenance)).length;
}

/**
 * Avatud ettevalmistuse sakid. Välja sakk ütleb, kas väli on täidetud
 * (`done`/`empty`), küsimuste sakk kannab arvu; `pending` märgib saki, kus
 * mõni rida ootab AI mustandi kinnitamist.
 */
export function prepTabs(prep, { t }) {
  const questions = list(prep?.questions);
  return PREP_TABS.map((key) => {
    if (key === "overview") {
      return { key, label: t("casework.prep.tabs.overview", ""), title: t("casework.prep.overview_title", "") };
    }
    if (key === "questions") {
      return {
        key,
        label: t("casework.prep.tabs.questions", ""),
        title: t("casework.prep.questions_title", ""),
        count: questions.length,
        pending: questions.some((row) => isAiDraft(row?.provenance))
      };
    }
    const row = prepFieldRow(prep, key);
    return {
      key,
      label: t(`casework.prep.tabs.${key}`, ""),
      title: t(`casework.prep.field_${key}`, ""),
      state: row?.text ? "done" : "empty",
      pending: isAiDraft(row?.provenance)
    };
  });
}

/**
 * Ettevalmistuse ülevaade: aeg, mitu välja on täidetud, mitu küsimust on ja
 * mitu rida ootab kinnitamist. `purged` on lause arhiveerimise kuupäevaga.
 */
export function prepOverview(prep, { t, locale }) {
  const filled = PREP_FIELD_KEYS.filter((key) => prepFieldRow(prep, key)?.text).length;
  const pending = aiPendingCount(prep);
  return {
    time: prepTitle(prep, { t, locale }),
    purged: prep?.contentPurgedAt
      ? t("casework.prep.content_purged", "").replace("{date}", dateText(prep.contentPurgedAt, locale))
      : "",
    fields: t("casework.prep.overview_fields", "")
      .replace("{filled}", String(filled))
      .replace("{total}", String(PREP_FIELD_KEYS.length)),
    questions: t("casework.prep.overview_questions", "").replace("{count}", String(list(prep?.questions).length)),
    pending: pending > 0 ? t("casework.prep.overview_ai_pending", "").replace("{count}", String(pending)) : ""
  };
}

/**
 * Ühe välja seis vaate jaoks. `row` on `null`, kui välja ei ole veel
 * salvestatud: siis küsib vaade päritolu. Olemasoleval real päritolu enam ei
 * küsita (server eirab saadetud väärtust) ja märgist muudab ainult kinnitamine.
 */
export function prepFieldModel(prep, fieldKey, { t }) {
  const row = prepFieldRow(prep, fieldKey);
  return {
    key: fieldKey,
    label: t(`casework.prep.field_${fieldKey}`, ""),
    saved: Boolean(row),
    savedText: String(row?.text || ""),
    provenance: row ? row.provenance : "",
    provenanceText: row ? provenanceText(row.provenance, t) : "",
    ai: isAiDraft(row?.provenance)
  };
}

/**
 * Välja saab salvestada, kui tekst on olemas ja uuel real on päritolu valitud.
 * Olemasoleva rea päritolu ei küsita: seda teksti salvestamine ei muuda.
 */
export function canSavePrepField({ text, saved, provenance }) {
  if (!String(text || "").trim()) return false;
  return saved ? true : PROVENANCES.includes(provenance);
}

function questionKindText(kind, t) {
  return word(t, `casework.prep.kind_${kind}`) || t("casework.errors.question_kind_unknown", "");
}

export function questionKindOptions(t) {
  return QUESTION_KINDS.map((value) => ({ value, label: t(`casework.prep.kind_${value}`, "") }));
}

/** Küsimuste ja väidete read. `provenance` on juhtimiseks (kinnitamise lähtekoht), mitte kuvamiseks. */
export function questionRows(prep, { t }) {
  return list(prep?.questions)
    .filter((row) => row?.id)
    .map((row) => ({
      id: String(row.id),
      text: String(row.text || ""),
      kindText: questionKindText(row.kind, t),
      provenance: row.provenance,
      provenanceText: provenanceText(row.provenance, t),
      ai: isAiDraft(row.provenance)
    }));
}

/* ────────────────────────────────────────────────────────────────────────────
   KOHTUMISE MÄRGE
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Ptk 4.4 kaheksa kihti, sama järjekord mis teenuskihis (`NOTE_LAYERS`):
 * kliendi oma sõnad ees, töötaja tõlgendus nende järel ja privaatne
 * refleksioon kõige lõpus.
 */
export const NOTE_LAYER_ORDER = Object.freeze([
  "KLIENDI_VAADE",
  "FAKTID",
  "TOOTAJA_TAHELEPANEK",
  "KONTROLLIMATA",
  "KOKKULEPPED",
  "JARGMISED_SAMMUD",
  "STAR2_KANTAV",
  "PRIVAATNE_REFLEKSIOON"
]);

export const PRIVATE_LAYER = "PRIVAATNE_REFLEKSIOON";

/** Avatud märkme vaated: kaheksa kihti ja paranduste ajalugu. */
export const NOTE_TABS = Object.freeze([...NOTE_LAYER_ORDER, "history"]);

export function noteTitle(note, context) {
  return meetingTitle(note, context, "casework.note.no_meeting_time");
}

export function noteRows(notes, context) {
  return list(notes)
    .filter((row) => row?.id)
    .map((row) => ({ id: String(row.id), title: noteTitle(row, context), linkedPrep: Boolean(row.meetingPrepId) }));
}

/**
 * Avatud märkme sakid. Sakk ütleb heledusega, kas kihis on KEHTIVAID kirjeid
 * (`done`) või mitte (`empty`): tagasi võetud rida jääb kihi loendisse alles
 * (SOL-CW-15), aga kehtivaks kirjeks ta ei loe. Ajaloo sakk on hele, kui
 * parandusi või tagasivõtmisi on. Arvu sakil ei ole: üheksa sakki peavad
 * mahtuma kahte ritta ja iga nimi ühele reale.
 */
export function noteTabs(note, revisions, { t }) {
  const entries = list(note?.entries);
  return NOTE_TABS.map((key) => {
    if (key === "history") {
      return {
        key,
        label: t("casework.note.tabs.history", ""),
        title: t("casework.note.history_title", ""),
        state: list(revisions).length ? "done" : "empty"
      };
    }
    return {
      key,
      label: t(`casework.note.tabs.${key}`, ""),
      title: t(`casework.note.layer_${key}`, ""),
      state: entries.some((entry) => entry?.layer === key && !entry.retractedAt) ? "done" : "empty"
    };
  });
}

/**
 * Ühe kihi kirjed.
 *
 * TÜHISTATUD RIDA JÄÄB LOENDISSE (SOL-CW-15), aga ei kanna oma teksti: server
 * saadab `text: null`. Rea kadumine tähendaks tühja konteinerit, mis näib
 * puutumata; teksti alles jätmine tähendaks, et tühistus ei tee midagi. Sisu on
 * paranduste ajaloos. Parandatud rida ütleb seda VÄLJA (`revised`).
 */
export function entryRows(note, layer, { t }) {
  return list(note?.entries)
    .filter((entry) => entry?.id && entry.layer === layer)
    .map((entry) => {
      const retracted = Boolean(entry.retractedAt);
      return {
        id: String(entry.id),
        retracted,
        text: retracted ? "" : String(entry.text || ""),
        provenanceText: provenanceText(entry.provenance, t),
        revised:
          Number(entry.revision) > 1
            ? t("casework.note.revision_count", "").replace("{count}", String(Number(entry.revision) - 1))
            : ""
      };
    });
}

/**
 * Salvestatud kirje parandus läheb teele, kui uus tekst on olemas ja erineb
 * salvestatust ning põhjus on kirjutatud (server nõuab põhjust: parandus ilma
 * põhjuseta ei erista eksituse parandamist sisu ümberkirjutamisest).
 */
export function canCorrectEntry({ text, saved, reason }) {
  const next = String(text || "").trim();
  return Boolean(next) && next !== String(saved || "").trim() && Boolean(String(reason || "").trim());
}

/**
 * Paranduste ja tühistuste ajalugu (SOL-CW-15). ASENDATUD TEKST ON SIIN NÄHTAV:
 * see ongi tõend. Põhjus on kasutaja enda tekst ja rea mõte.
 */
export function revisionRows(revisions, { t, locale }) {
  return list(revisions)
    .filter((item) => item?.id)
    .map((item) => ({
      id: String(item.id),
      text: String(item.text || ""),
      kindText: word(t, `casework.note.revision_kind_${item.kind}`) || t("casework.page.target_unknown", ""),
      layerText: word(t, `casework.note.layer_${item.layer}`) || t("casework.errors.note_layer_unknown", ""),
      time: timeText(item.createdAt, locale),
      reason: String(item.reason || "")
    }));
}

/* ────────────────────────────────────────────────────────────────────────────
   STAR2 JÄRJEKORD JA ÜLEKANNE
   ──────────────────────────────────────────────────────────────────────────── */

/** Ptk 4.5 kaheksa elementi, sama järjekord mis teenuskihis (`DRAFT_TYPES`). */
export const DRAFT_TYPE_ORDER = Object.freeze([
  "POORDUMISE_KOKKUVOTE",
  "ABIVAJADUSE_HINDAMINE",
  "ELUVALDKONNA_KIRJELDUS",
  "EESMARGI_SONASTUS",
  "TEGEVUS",
  "VASTUTAJA_JA_TAHTAEG",
  "KOHTUMISE_MARGE",
  "TEENUSE_SUUNAMISE_ALUS"
]);

/**
 * Lubatud siirded: sama kaart mis `STAR2_TRANSFER_TRANSITIONS`
 * `lib/workspaces/provenance.js`-is, MIINUS `ULE_KANTUD` (L19).
 *
 * `VALMIS_ULEKANDEKS` juurest jääb liidesesse ainult `EI_KANTA`, ja see on
 * õige: ülekantuks märkimine on eraldi tegu eraldi marsruudil.
 */
export const ALLOWED_TRANSITIONS = Object.freeze({
  MUSTAND: Object.freeze(["VAJAB_KONTROLLI", "EI_KANTA"]),
  VAJAB_KONTROLLI: Object.freeze(["KONTROLLITUD", "EI_KANTA"]),
  KONTROLLITUD: Object.freeze(["VALMIS_ULEKANDEKS", "EI_KANTA"]),
  VALMIS_ULEKANDEKS: Object.freeze(["EI_KANTA"]),
  ULE_KANTUD: Object.freeze([]),
  EI_KANTA: Object.freeze([])
});

/** `VAJAB_KONTROLLI` täpsustus. Sama hulk mis `STAR2_REVIEW_KINDS`. */
export const REVIEW_KINDS = Object.freeze(["KLIENDIGA", "DOKUMENDIGA"]);

/** Avatud elemendi vaated: väljad, seis ja STAR2-sse viimine. */
export const DRAFT_TABS = Object.freeze(["fields", "state", "transfer"]);

const DRAFT_STATE_TONES = Object.freeze({ VAJAB_KONTROLLI: "wait", VALMIS_ULEKANDEKS: "ok", ULE_KANTUD: "ok" });

/** Seis, kust edasi ei saa. Ka tundmatu seis on kinni: vorm, mis ei tea, kuhu minna, ei paku midagi. */
export function isTerminalState(state) {
  return (ALLOWED_TRANSITIONS[state] || []).length === 0;
}

export function draftTypeText(type, t) {
  return word(t, `casework.draft.type_${type}`) || t("casework.errors.draft_type_unknown", "");
}

export function transferStateText(state, t) {
  return word(t, `casework.star2.${state}`) || t("casework.errors.transfer_state_unknown", "");
}

function reviewKindText(kind, t) {
  if (!kind) return "";
  return word(t, `casework.star2.${kind}`) || t("casework.errors.review_kind_unknown", "");
}

export function draftTypeOptions(t) {
  return DRAFT_TYPE_ORDER.map((value) => ({ value, label: t(`casework.draft.type_${value}`, "") }));
}

/**
 * Elementide loendi read: tüüp, seis ja kontrollimise viis sõnadena. `pending`
 * märgib elemendi, mille kopeerimise jälg on veel salvestamata (L8: tõendi
 * vaikne kadu on halvem kui nähtav).
 */
export function draftRows(drafts, { t, pendingAudits = null }) {
  return list(drafts)
    .filter((row) => row?.id)
    .map((row) => ({
      id: String(row.id),
      title: draftTypeText(row.draftType, t),
      state: transferStateText(row.transferState, t),
      tone: DRAFT_STATE_TONES[row.transferState] || "quiet",
      review: reviewKindText(row.reviewKind, t),
      pending: list(pendingAudits?.[row.id]).length > 0,
      /* Kustutatud sisuga element on loendis TÜHJAST ERISTATAV, nagu ettevalmistus. */
      purgedText: draftPurge(row) ? t(draftPurge(row).chipKey, "") : ""
    }));
}

/**
 * Kustutatud sisuga mustand: märk ja lause põhjuse järgi. Töötaja enda
 * arhiveeritud töömaterjali kohta ei kehti lause säilitustähtajast ega alles
 * jäänud ülekande faktist: ülekannet ei olnud ja väljad on läinud.
 * Tagastab `null`, kui sisu on alles.
 */
export function draftPurge(draft) {
  if (!draft?.contentPurgedAt) return null;
  return draft.contentPurgeReason === "WORKER_ARCHIVED_WORKING_MATERIAL"
    ? { chipKey: "casework.prep.purged_chip", noteKey: "casework.transfer.content_archived" }
    : { chipKey: "casework.draft.purged_chip_retention", noteKey: "casework.transfer.content_purged" };
}

/** Avatud elemendi päis: mis element see on ja mis seisus. */
export function draftHead(draft, { t }) {
  return {
    title: draftTypeText(draft?.draftType, t),
    state: transferStateText(draft?.transferState, t),
    tone: DRAFT_STATE_TONES[draft?.transferState] || "quiet",
    review: reviewKindText(draft?.reviewKind, t)
  };
}

/**
 * Avatud elemendi sakid. `pendingAudits`: kui kopeerimise jälg on salvestamata,
 * kannab STAR2-sse viimise sakk märki, et hoiatus ei jääks teise saki taha.
 */
export function draftTabs(draft, { t, pendingAudits = 0 }) {
  return DRAFT_TABS.map((key) => {
    if (key === "fields") {
      return {
        key,
        label: t("casework.draft.tabs.fields", ""),
        title: t("casework.draft.fields_title", ""),
        count: list(draft?.fields).length
      };
    }
    if (key === "state") {
      return { key, label: t("casework.draft.tabs.state", ""), title: t("casework.draft.state_title", "") };
    }
    return {
      key,
      label: t("casework.draft.tabs.transfer", ""),
      title: t("casework.transfer.actions_title", ""),
      pending: Number(pendingAudits) > 0
    };
  });
}

/**
 * Elemendi väljad. `key` on töötaja enda antud välja võti: see on rea nimi ja
 * läheb samal kujul STAR2 plokki, seepärast seda ei tõlgita ega peideta.
 */
export function draftFieldRows(draft, { t }) {
  return list(draft?.fields)
    .filter((field) => field?.fieldKey)
    .map((field) => ({
      key: String(field.fieldKey),
      text: String(field.text || ""),
      provenance: field.provenance,
      provenanceText: provenanceText(field.provenance, t)
    }));
}

/** Uue välja saab saata, kui võti, tekst ja päritolu on kõik olemas. */
export function canAddDraftField({ fieldKey, text, provenance }) {
  return Boolean(String(fieldKey || "").trim()) && canAddRow({ text, provenance });
}

/**
 * Seisu vaate otsused.
 *
 * OLEKUTEE ON NÄHTAV, MITTE PEIDETUD: `targets` on AINULT need siirded, mida
 * olekumasin siit lubab. `ULE_KANTUD` ei ole siin valik (L19): sinna viib ainult
 * „Märgi üle kantuks", ja `awaitingMark` laseb vaatel seda välja öelda, et
 * puuduv valik ei näeks välja nagu puudujääk.
 * `purgeDue` (L7): SISU kustub, rida ja ülekande tõend jäävad. Kuupäev tuleb
 * serverist, mitte ei arvutata pinnal.
 */
export function draftStateModel(draft, { t, locale }) {
  const state = draft?.transferState;
  const transferred = timeText(draft?.transferredAt, locale);
  const due = draft?.purgeDueAt && !draft?.contentPurgedAt ? dateText(draft.purgeDueAt, locale) : "";
  return {
    stateText: transferStateText(state, t),
    tone: DRAFT_STATE_TONES[state] || "quiet",
    reviewText: reviewKindText(draft?.reviewKind, t),
    terminal: isTerminalState(state),
    awaitingMark: state === "VALMIS_ULEKANDEKS",
    transferredAt: transferred,
    purgeDue: due ? t("casework.draft.purge_due_at", "").replace("{date}", due) : "",
    targets: (ALLOWED_TRANSITIONS[state] || []).map((value) => ({ value, label: transferStateText(value, t) }))
  };
}

/** `reviewKind` on AINULT `VAJAB_KONTROLLI` täpsustus: mujal ei küsita ja server nullib ta niikuinii. */
export function asksReviewKind(to) {
  return to === "VAJAB_KONTROLLI";
}

/** Kontrollimise viis on vabatahtlik: esimene valik jätab selle määramata. */
export function reviewKindOptions(t) {
  return [
    { value: "", label: t("casework.draft.review_kind_none", "") },
    ...REVIEW_KINDS.map((value) => ({ value, label: t(`casework.star2.${value}`, "") }))
  ];
}

/**
 * Siire lõppseisu („Ei kanta") küsib teist vajutust: sealt tagasiteed ei ole ja
 * elemendi sisu enam ei muudeta. Teised siirded viivad tööd edasi ja käivad ühe
 * vajutusega pärast seisu valimist.
 */
export function transitionNeedsConfirm(to) {
  return Boolean(to) && isTerminalState(to);
}

/**
 * Juhtumi ülekandeajaloo read.
 *
 * SISU SIIN EI OLE: rida kannab tegu, elemendi tüüpi, aega ja VÄLJADE VÕTMEID
 * (L8). Võtmed on eraldi loendina, mitte komadega kokku liidetud tekstina.
 */
export function transferRows(events, { t, locale }) {
  return list(events)
    .filter((event) => event?.id)
    .map((event) => ({
      id: String(event.id),
      /* Tundmatu teo kohta öeldakse „tundmatu"; tundmatu tüüp jääb reast välja. */
      title: [
        word(t, `casework.transfer.kind_${event.kind}`) || t("casework.page.target_unknown", ""),
        word(t, `casework.draft.type_${event.draftType}`)
      ]
        .filter(Boolean)
        .join(" · "),
      time: timeText(event.createdAt, locale),
      keys: list(event.fieldKeys).map((key) => String(key))
    }));
}

/* ────────────────────────────────────────────────────────────────────────────
   SALVESTAMATA TEKST
   Avatud kirje sulgemine, juhtumist lahkumine ja Esc küsivad enne üle, kui
   ekraanil on teksti, mida serveris ei ole. „Salvestamata” otsustatakse
   võrreldes sellega, mis on salvestatud, mitte selle järgi, kas välja puudutati:
   tagasi kirjutatud tekst ei ole enam muudatus.
   ──────────────────────────────────────────────────────────────────────────── */

function typed(value) {
  return Boolean(String(value ?? "").trim());
}

/** Avatud ettevalmistus: mõne välja tekst erineb salvestatust või küsimus on pooleli. */
export function prepUnsaved(prep, texts, question) {
  if (typed(question?.text)) return true;
  return PREP_FIELD_KEYS.some((key) => String(texts?.[key] ?? "").trim() !== prepFieldText(prep, key).trim());
}

/** Avatud märge: mõne kihi pooleli rida, tagasivõtmise põhjus või pooleli parandus. */
export function noteUnsaved(drafts, reasons, corrections) {
  if (Object.values(drafts || {}).some((draft) => typed(draft?.text))) return true;
  if (Object.values(reasons || {}).some(typed)) return true;
  return Object.values(corrections || {}).some((item) => typed(item?.text) || typed(item?.reason));
}

/** Avatud mustand: pooleli uus väli või avatud välja parandus, mis erineb salvestatust. */
export function draftUnsaved(draft, newField, edits) {
  if (typed(newField?.text) || typed(newField?.fieldKey)) return true;
  const saved = new Map(list(draft?.fields).map((field) => [String(field?.fieldKey || ""), String(field?.text || "")]));
  return Object.entries(edits || {}).some(([key, text]) => saved.has(key) && String(text ?? "").trim() !== saved.get(key).trim());
}
