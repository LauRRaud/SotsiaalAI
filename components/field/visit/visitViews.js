/**
 * Külastuse vaate jaotus ja väikesed reeglid ilma JSX-ita, et neid saaks testida.
 *
 * Külastusel on kolm faasi (ettevalmistus, kohapeal, järeltöö) ja igas faasis
 * kaks kuni kolm vaadet. Korraga on ees üks vaade: nii mahub see telefoni
 * ekraanile ja tegevus on all servas pöidla ulatuses. Faasi esimene vaade on
 * see, mida selles faasis kõige rohkem tehakse (kohapeal: märge).
 */
import { FIELD_ITEM_STATE, FIELD_VISIT_STATUS } from "@/lib/field/constants";

export const VISIT_PHASES = Object.freeze(["prep", "on_site", "follow_up"]);

export const VISIT_VIEWS = Object.freeze({
  prep: Object.freeze(["pack", "safety"]),
  on_site: Object.freeze(["note", "capture", "consent"]),
  follow_up: Object.freeze(["review", "handover", "finish"])
});

export function phaseForStatus(status) {
  if (status === FIELD_VISIT_STATUS.IN_PROGRESS) return "on_site";
  if (status === FIELD_VISIT_STATUS.WRAP_UP || status === FIELD_VISIT_STATUS.CLOSED) return "follow_up";
  return "prep";
}

export function mainViewOf(phase) {
  return (VISIT_VIEWS[phase] || VISIT_VIEWS.prep)[0];
}

/**
 * Vaated, mida selles seisus saab avada. Suletud või ära jäänud külastusel ei
 * ole turvasignaali ega üleandmist; üleandmine vajab ka serveri külastust
 * (võrguta, ainult paketi pealt, seda teha ei saa).
 *
 * Pildilt loetud või transkribeeritud tekst (`hasDraft`) on järeltöös omaette
 * vaade kontrolli kõrval, kuni inimene selle kinnitab või sellest loobub.
 * Teised vaated jäävad samal ajal avatavaks.
 */
export function availableViews(phase, { readOnly = false, hasVisit = true, hasDraft = false } = {}) {
  const views = (VISIT_VIEWS[phase] || []).filter((view) => {
    if (view === "safety") return !readOnly;
    if (view === "handover") return !readOnly && hasVisit;
    return true;
  });
  if (phase === "follow_up" && hasDraft) views.splice(1, 0, "aiDraft");
  return views;
}

/**
 * Kus inimene on pärast seda, kui serverist tuli külastuse värske olek.
 * Faas järgib olekut ainult seni, kuni inimene ei ole faasi ega vaadet ise
 * valinud (`picked`) ja on veel ettevalmistuses. Varem viis iga laadimine
 * ettevalmistusest ära, ka kohe pärast turvasignaali sisselülitamist seal.
 */
export function placeAfterLoad(current, status) {
  if (current.picked || current.phase !== "prep") return current;
  const next = phaseForStatus(status);
  return next === current.phase ? current : { phase: next, view: mainViewOf(next), picked: false };
}

/**
 * Teise vajutuse reegel. Esimene vajutus paneb tegevuse ootele, teine vajutus
 * SAMAL tegevusel käivitab selle; vajutus teisel tegevusel paneb ootele selle
 * teise (eelmine ei käivitu kunagi).
 */
export function nextConfirm(confirming, key) {
  return confirming === key ? { fire: true, confirming: "" } : { fire: false, confirming: key };
}

export function safetyArmed(safety) {
  return Boolean(safety?.armedAt && !safety?.cancelledAt);
}

/** Turvasignaali hoiatuste tekstivõtmed selles järjekorras, nagu neid näidatakse. */
export function safetyWarnings(safety) {
  const keys = [];
  if (safety?.escalatedAt) keys.push("field.safety.escalated");
  if (safety?.escalationStatus === "FAILED") keys.push("field.safety.escalationFailed");
  if (safety?.escalationStatus === "UNKNOWN") keys.push("field.safety.deliveryUnknown");
  if (safety?.resolvedNoticeStatus === "FAILED") keys.push("field.safety.resolvedFailed");
  return keys;
}

/**
 * Foto vajab alust: kas talletatud nõusolekut või kliendi enda dokumendipalvet
 * koos põhjusega. Ilma aluseta nupp ei avane.
 */
export function photoAllowed({ readOnly = false, hasConsent = false, documentRequested = false, reason = "" } = {}) {
  if (readOnly) return false;
  return Boolean(hasConsent || (documentRequested && String(reason || "").trim()));
}

/** Sulgeda saab ainult järeltöö olekus külastust, võrgus ja siis, kui midagi ei ole saatmata. */
export function closeAllowed({ offline = false, blocked = false, status = "" } = {}) {
  return !offline && !blocked && status === FIELD_VISIT_STATUS.WRAP_UP;
}

export function recordingClock(seconds) {
  const total = Math.max(0, Math.trunc(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Seadmes oleva üksuse tegevused selle seisu järgi. „Eemalda" on alati viimane
 * ja küsib teist vajutust (seda teeb vaade).
 */
export function deviceItemActions(item) {
  const actions = [];
  if (item?.state === FIELD_ITEM_STATE.DEVICE_ONLY) actions.push("approve");
  if (item?.state === FIELD_ITEM_STATE.FAILED) {
    actions.push("retry");
    if (item.lastError === "field.errors.visit_read_only") actions.push("recovery");
  }
  if (item?.state === FIELD_ITEM_STATE.QUEUED) actions.push("cancel");
  if (item?.state === FIELD_ITEM_STATE.CONFLICT) actions.push("keepDevice", "keepServer");
  actions.push("remove");
  return actions;
}

/** Üksuse liigi tekstivõti: manusel roll (foto, heli), märkmel liik. */
export function deviceItemTypeKey(item) {
  if (item?.itemType === "attachment") return `field.item.${item.payload?.role || "photo"}`;
  return `field.item.${item?.payload?.kind || "note"}`;
}

/** Seisu märgi toon: mis ootab inimest, mis on katki, mis on korras. */
export function itemStateTone(state) {
  if (state === FIELD_ITEM_STATE.FAILED || state === FIELD_ITEM_STATE.CONFLICT) return "alert";
  if (state === FIELD_ITEM_STATE.SYNCED) return "ok";
  if (
    state === FIELD_ITEM_STATE.DEVICE_ONLY ||
    state === FIELD_ITEM_STATE.QUEUED ||
    state === FIELD_ITEM_STATE.UPLOADING
  ) {
    return "wait";
  }
  return "";
}
