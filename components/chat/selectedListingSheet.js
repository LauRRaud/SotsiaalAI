/**
 * Avatud abikuulutus ILMA JSX-ita: milline vaade on ees, mida kuulutus ütleb
 * (tekst, märgid, faktid), ühendamise valik ja muutmise vormi reeglid.
 *
 * MIKS OMA FAIL. Vana avatud kuulutus (`./SelectedListingContext.jsx`) otsustas
 * kõike JSX-i sees: kategooriate ja sihtrühmade nimed seisid koodis
 * eestikeelsete sõnedena (inglise ja vene keeles nägi inimene eesti keelt),
 * seisu ja minu kuulutuse märgi vahel oli paljas „|" ning seda, mida ekraanile
 * jõudis, ei saanud testida. Siin on puhtad funktsioonid; vaated
 * (`./SelectedListingViews.jsx`) ainult joonistavad. Andmed, päringud ja olek
 * on kasutajal (`components/alalehed/ChatBody.jsx`).
 */

import { HELP_LISTING_TEXT_LIMITS } from "@/lib/help/listingLimits";

/** Vaated, millel on kataloogis nimi ja lühinimi (`chat.help.opened.views.<võti>`). */
export const LISTING_VIEW_KEYS = Object.freeze(["read", "connect", "edit"]);

/** Muutmise vormi osad (`chat.help.opened.editParts.<võti>`). Üks salvestamine katab kõik. */
export const EDIT_PART_KEYS = Object.freeze(["text", "category", "form", "terms"]);

/** Kategooriad: sama loend ja järjekord mis serveri algandmetes (src/server/data/help-categories.json). */
export const HELP_CATEGORY_CODES = Object.freeze([
  "TRANSPORT",
  "DAILY_TASKS",
  "HOME_HELP",
  "DIGITAL_HELP",
  "CARE_SUPPORT",
  "CHILD_YOUTH_SUPPORT",
  "LEARNING_GUIDANCE",
  "SOCIAL_SUPPORT",
  "ADMIN_FORM_HELP",
  "OTHER"
]);

/**
 * Sihtrühmad, mida vormis valida saab: vanuserühmad. Serveri loendis on ka
 * DISABILITY, aga seda kuulutusel ei näidata (lib/help/listingViews.js) ja vana
 * vorm seda ei pakkunud.
 */
export const TARGET_GROUP_CODES = Object.freeze(["CHILD", "YOUTH", "ADULT", "ELDER"]);
export const HELP_TYPE_CODES = Object.freeze(["VOLUNTARY", "PAID", "MIXED"]);
export const TIME_TYPE_CODES = Object.freeze(["ONE_TIME", "RECURRING", "FLEXIBLE"]);

/** Väljade pikkused: samad piirid, mille järgi server salvestamisel keeldub. */
export const EDIT_LIMITS = HELP_LISTING_TEXT_LIMITS;

/* Lühim vahe kahe vajutuse vahel, mis ei tohi olla üks liigutus (topeltklõps),
   ja aeg, mille järel teise vajutuse ootus aegub. Samad arvud mis failis
   components/casework/ConfirmButton.jsx. */
export const MIN_GAP_MS = 400;
export const CONFIRM_MS = 8000;

/* Tähemärkide loendur ilmub siis, kui väli on sellest osast täis. */
const COUNTER_FROM = 0.8;

function plain(value) {
  return String(value ?? "").trim();
}

function comparable(value) {
  return plain(value)
    .toLowerCase()
    .replace(/[|·•]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesComparable(haystack, needle) {
  const left = comparable(haystack);
  const right = comparable(needle);
  return Boolean(left && right && left.includes(right));
}

/* Serveri silt on sõna kuulutuse keeles. Kui server sõna ei leidnud, annab ta
   sildi kohal koodi enda („DAILY_TASKS"): koodi ekraanile ei kirjutata. */
const CODE_SHAPE = /^[A-Z0-9]+(?:_[A-Z0-9]+)*$/;

function wordOnly(value) {
  const text = plain(value);
  return CODE_SHAPE.test(text) ? "" : text;
}

/**
 * Kategooria sõna: serveri silt; kui seda ei ole (või selle kohal on kood),
 * siis kataloogi sõna kuulutuse kategooria koodi järgi.
 */
export function categoryWord(listing = {}, t) {
  const label = wordOnly(listing?.categoryLabel);
  if (label) return label;
  const code = [listing?.primaryCategoryCode, listing?.categoryLabel].map((value) => plain(value).toUpperCase()).find((value) => HELP_CATEGORY_CODES.includes(value));
  return code && typeof t === "function" ? t(`chat.help.categories.${code}`) : "";
}

/**
 * Milline vaade on ees. Tühi vastus tähendab, et kuulutust ei ole avatud.
 * Laadimine on enne kõike muud: ka siis, kui eelmine kuulutus on veel olekus.
 */
export function listingViewKey({ loading = false, listing = null, error = "", editState = null, isOwn = false, connectOpen = false } = {}) {
  if (loading) return "loading";
  if (!listing) return error ? "missing" : "";
  if (editState) return "edit";
  if (connectOpen && !isOwn) return "connect";
  return "read";
}

/* Vestluses loodud kuulutuse kirjelduse lõppu kirjutab server struktuuriread
   („Põhikategooria: …", „Omavalitsus: …"; lib/help/chatWorkflow.js). Need on
   alati eesti keeles ja kordavad seda, mis kuulutusel on eraldi väljadena
   olemas, seepärast lõigatakse need lugemise vaates ära. Sama lõige oli vanas
   komponendis; õige parandus on serveris (read ei peaks kirjelduse sees olema). */
const APPENDED_LINES = /\b(?:Põhikategooria|Omavalitsus|Täpsem asukoht|Sihtrühm|Abi vorm|Tasu info|Ajalisus|Saadavus\s*\/\s*algus|Lisatingimused|Tingimused|Oskused või taust):/iu;

export function cleanDescription(listing = {}) {
  const text = plain(listing?.description);
  if (!text) return "";
  const match = text.match(APPENDED_LINES);
  return (match?.index > 0 ? text.slice(0, match.index) : text).trim();
}

/**
 * Kuulutuse tekst lugemise vaates. Võõra kuulutuse „kirjeldus" on serveris sama
 * märksõnade rida mis kokkuvõte (avalik projektsioon vabateksti ei anna): seda
 * ei korrata, sest samad sõnad on faktidena kohe all.
 */
export function listingText(listing = {}) {
  const text = cleanDescription(listing);
  if (!text) return "";
  if (comparable(text) === comparable(listing?.summary) || comparable(text) === comparable(listing?.title)) return "";
  return text;
}

/** Kuulutuse liik sõnana: serveri silt, kui kuulutus seda kannab, muidu kataloogist. */
export function listingKindWord(listing = {}, t) {
  const fromServer = plain(listing?.kindLabel);
  if (fromServer) return fromServer;
  return plain(listing?.kind).toLowerCase() === "offer" ? t("chat.help.opened.kindOffer") : t("chat.help.opened.kindRequest");
}

/**
 * Märgid avatud kuulutuse päises: liik, minu kuulutus ja seis.
 *
 * LIIGIMÄRK on ainult oma kuulutusel. Võõra kuulutuse pealkirja paneb server
 * ise kokku liigist, kategooriast ja omavalitsusest („Abipakkumine: Transport -
 * Tallinn"; avalik projektsioon failis lib/help/listingViews.js): märk kordaks
 * pealkirja esimest sõna. Oma kuulutuse pealkiri on inimese enda tekst ja liiki
 * ei pruugi öelda.
 *
 * SEISUMÄRK. Sõna annab server kuulutuse keeles (`statusLabel`). Avatud
 * kuulutuse kohta märki ei ole: loendid näitavad ainult avatud kuulutusi ja
 * „Aktiivne" ei ütleks midagi. Toorest seisu koodi ekraanile ei kirjutata:
 * kui server sõna ei andnud, märki ei ole.
 */
export function listingChips(listing = {}, { t, ui = {}, isOwn = false } = {}) {
  const status = plain(listing?.status).toUpperCase();
  const statusLabel = wordOnly(listing?.statusLabel);
  return [
    ...(isOwn ? [{ key: "kind", text: listingKindWord(listing, t), tone: "quiet" }, { key: "own", text: ui.ownListing, tone: "own" }] : []),
    ...(statusLabel && status !== "OPEN" ? [{ key: "status", text: statusLabel, tone: "quiet" }] : [])
  ].filter((chip) => chip.text);
}

/**
 * Faktid nimetuse ja väärtuse paaridena. Väärtused on serveri sildid kuulutuse
 * keeles; pikk vabatekst (`wide`) saab oma rea.
 *
 * Täpsem asukoht jääb välja, kui omavalitsuse nimi seda juba ütleb (vana lehe
 * reegel). Vana leht jättis välja ka need faktid, mis olid märksõnade real;
 * seda rida enam ei ole, seega on kõik faktid siin.
 */
export function listingFacts(listing = {}, ui = {}, t) {
  const groups = Array.isArray(listing?.targetGroupLabels) ? listing.targetGroupLabels.map(wordOnly).filter(Boolean) : [];
  const place = plain(listing?.rawPlace);
  return [
    { key: "category", label: ui.category, value: categoryWord(listing, t) },
    { key: "municipality", label: ui.municipality, value: plain(listing?.municipalityLabel) },
    { key: "location", label: ui.location, value: includesComparable(listing?.municipalityLabel, place) ? "" : place },
    { key: "targetGroups", label: ui.targetGroups, value: groups.join(", ") },
    { key: "helpType", label: ui.helpType, value: wordOnly(listing?.helpTypeLabel) },
    { key: "timeType", label: ui.timeType, value: wordOnly(listing?.timeTypeLabel) },
    { key: "availabilityOrStart", label: ui.availabilityOrStart, value: plain(listing?.availabilityOrStart), wide: true },
    { key: "compensationDetails", label: ui.compensationDetails, value: plain(listing?.compensationDetails), wide: true },
    { key: "conditions", label: ui.conditions, value: plain(listing?.conditions), wide: true }
  ].filter((fact) => fact.value);
}

/** Kõik, mida lugemise vaade joonistab. */
export function listingSheet(listing = {}, { t, ui = {}, isOwn = false } = {}) {
  const kindWord = listingKindWord(listing, t);
  return {
    title: plain(listing?.title) || kindWord,
    kindWord,
    chips: listingChips(listing, { t, ui, isOwn }),
    text: listingText(listing),
    facts: listingFacts(listing, ui, t),
    closed: plain(listing?.status).toUpperCase() === "CLOSED",
    /* Abisoovile pakutakse abi, abipakkumise tegijaga võetakse ühendust. */
    connectLabel: plain(listing?.kind).toLowerCase() === "request" ? ui.offerHelp : ui.contact
  };
}

/**
 * Lehe teade. Kasutaja hoiab ühte teksti (`error`) nii tõrke kui ka selle
 * jaoks, et nõusolekupäring läks teele: viimane ei ole tõrge ja seda näidatakse
 * rahulikus toonis.
 */
export function listingNotice(error, ui = {}) {
  const text = plain(error);
  if (!text) return { text: "", tone: "", sent: false };
  const sent = text === plain(ui.connectPending);
  return { text, tone: sent ? "info" : "risk", sent };
}

/**
 * Ühendamise valik: minu avatud vastaskuulutused (abisoovi juures minu
 * abipakkumised ja vastupidi). Kui neid ei ole, ütleb `none`, mida on vaja.
 * `failed`: minu kuulutuste loend jäi laadimata; siis ei väideta, et neid ei
 * ole, vaid öeldakse, et loendit ei saanud laadida.
 */
export function connectChoice({ listing = {}, options = [], selectedId = "", failed = false, t } = {}) {
  const toRequest = plain(listing?.kind).toLowerCase() === "request";
  const fallback = toRequest ? t("chat.help.opened.kindOffer") : t("chat.help.opened.kindRequest");
  const rows = (Array.isArray(options) ? options : [])
    .map((item) => ({ value: plain(item?.id), label: plain(item?.title) || fallback }))
    .filter((option) => option.value);
  const selected = plain(selectedId);
  const none = failed ? t("chat.help.opened.connectOptionsFailed") : toRequest ? t("chat.help.opened.connectNoneRequest") : t("chat.help.opened.connectNoneOffer");
  return {
    question: toRequest ? t("chat.help.opened.connectRequestQuestion") : t("chat.help.opened.connectOfferQuestion"),
    none: rows.length ? "" : none,
    options: rows,
    value: rows.some((option) => option.value === selected) ? selected : "",
    columns: Math.min(Math.max(rows.length, 1), 2)
  };
}

/** Muutmise vormi osad sakkidena. */
export function editPartOptions(t) {
  return [
    { value: "text", label: t("chat.help.opened.editParts.text") },
    { value: "category", label: t("chat.help.opened.editParts.category") },
    { value: "form", label: t("chat.help.opened.editParts.form") },
    { value: "terms", label: t("chat.help.opened.editParts.terms") }
  ];
}

/** Kategooriate valik: sõnad kataloogist (`chat.help.categories.<kood>`). */
export function categoryOptions(t) {
  return HELP_CATEGORY_CODES.map((code) => ({ value: code, label: t(`chat.help.categories.${code}`) }));
}

/** Sihtrühmade valik: sõnad kataloogist (`chat.help.targetGroupOptions.<kood>`). */
export function targetGroupOptions(t) {
  return TARGET_GROUP_CODES.map((code) => ({ value: code, label: t(`chat.help.targetGroupOptions.${code}`) }));
}

/* Abi liigi ja ajalisuse võib jätta määramata: tühi väärtus on oma lahter, sest
   ühe valikuga rida ei saa muidu tagasi tühjaks. */
export function helpTypeOptions(ui = {}, t) {
  return [
    { value: "", label: t("chat.help.opened.notSet") },
    { value: "VOLUNTARY", label: ui.voluntaryLabel },
    { value: "PAID", label: ui.paidLabel },
    { value: "MIXED", label: ui.mixedLabel }
  ];
}

export function timeTypeOptions(ui = {}, t) {
  return [
    { value: "", label: t("chat.help.opened.notSet") },
    { value: "ONE_TIME", label: ui.oneTimeLabel },
    { value: "RECURRING", label: ui.recurringLabel },
    { value: "FLEXIBLE", label: ui.flexibleLabel }
  ];
}

/**
 * Vormi väljade väärtused: muudetud väärtus, selle puudumisel kuulutuse oma.
 * Sama järjekord mis vanas komponendis. Sihtrühmadest jäävad alles need, mida
 * vorm pakub.
 */
export function editValues(listing = null, editState = null) {
  const codes = Array.isArray(editState?.targetGroupCodes)
    ? editState.targetGroupCodes
    : Array.isArray(listing?.targetGroupCodes)
      ? listing.targetGroupCodes
      : [];
  return {
    title: editState?.title ?? "",
    description: editState?.description ?? listing?.editableDescription ?? listing?.description ?? "",
    primaryCategoryCode: editState?.primaryCategoryCode ?? listing?.primaryCategoryCode ?? "",
    helpType: editState?.helpType ?? listing?.helpType ?? "",
    timeType: editState?.timeType ?? listing?.timeType ?? "",
    targetGroupCodes: codes.filter((code) => TARGET_GROUP_CODES.includes(code)),
    rawPlace: editState?.rawPlace ?? listing?.editableRawPlace ?? listing?.rawPlace ?? "",
    availabilityOrStart: editState?.availabilityOrStart ?? listing?.editableAvailabilityOrStart ?? listing?.availabilityOrStart ?? "",
    compensationDetails: editState?.compensationDetails ?? listing?.editableCompensationDetails ?? listing?.compensationDetails ?? "",
    conditions: editState?.conditions ?? listing?.editableConditions ?? listing?.conditions ?? ""
  };
}

/** Sihtrühma märkimine ja märke eemaldamine: tagastab uue koodide loendi. */
export function toggleTargetGroup(codes, code) {
  const selected = Array.isArray(codes) ? codes : [];
  return selected.includes(code) ? selected.filter((item) => item !== code) : [...selected, code];
}

/** See, mis salvestamisel kasutajale antakse: sama kuju mis vanas komponendis. */
export function saveEditPayload(editState, values) {
  return { ...editState, targetGroupCodes: values.targetGroupCodes };
}

/**
 * Vormi sisu ühe sõnena: selle järgi otsustatakse, kas midagi on muudetud.
 * Sihtrühmade järjekord ei loe.
 */
export function editSnapshot(values = {}) {
  return JSON.stringify([
    values.title,
    values.description,
    values.primaryCategoryCode,
    values.helpType,
    values.timeType,
    [...(values.targetGroupCodes || [])].sort(),
    values.rawPlace,
    values.availabilityOrStart,
    values.compensationDetails,
    values.conditions
  ]);
}

/**
 * Mis takistab salvestamist. Server nõuab kirjeldust
 * (`HELP_REQUEST_DESCRIPTION_REQUIRED`): tühja kirjeldusega päringut ei saadeta.
 * Tagastab kataloogi võtme või tühja sõne.
 */
export function editProblem(values = {}) {
  return plain(values.description) ? "" : "chat.help.opened.descriptionRequired";
}

/** Tähemärkide loendur: ilmub alles siis, kui väli hakkab täis saama. */
export function counterText(value, max, t) {
  const count = String(value ?? "").length;
  if (!max || count < max * COUNTER_FROM) return "";
  return t("chat.help.opened.charsUsed", { count, max });
}

/** Kas vajutus tuli liiga ruttu pärast seda, kui vaade või nupu teine aste ilmus. */
export function pressTooSoon(shownAt, now = Date.now()) {
  return now - Number(shownAt || 0) < MIN_GAP_MS;
}
