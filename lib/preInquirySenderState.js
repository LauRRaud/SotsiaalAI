/**
 * Mida pöörduja oma eelpöördumise seisu kohta loendis „Minu eelpöördumised" näeb.
 *
 * Andmebaasi olek (`status`) on pärast saatmist VASTUVÕTJA töövoo seis ja
 * pöördujale eksitav: kui vastuvõtja märgib pöördumise vastuvõetuks, saab oleku
 * väärtuseks READY, mida pöörduja nägi sõnadega „valmis ülevaatamiseks", nagu
 * ootaks asi veel tema enda järel; vastuvõtja arhiveerimine paistaks talle kui
 * „arhiveeritud".
 *
 * SEISU REEGEL ON ÜKS ja elab failis `lib/journey/linkedPreInquiryState.js`
 * (Teekond näitab sama pöördumist sama reegli järgi). Siin lisandub ainult see,
 * mida loend juurde ütleb: mitu päeva on oodatud ja millal vastu võeti.
 *
 * Väljad annab server autorile niikuinii (`serializePreInquiry` failis
 * lib/preInquiries.js): status, deliveryChannel, sentAt, openedAt, recalledAt,
 * supersededById, externalSendConfirmedAt.
 *
 * Tagastab `{ key, at?, days? }`:
 *  - draft          koostamisel
 *  - ready          salvestatud, saatmata
 *  - downloaded     alla laaditud
 *  - sent_waiting   saadetud platvormis, vastu võtmata; `days` = mitu täispäeva oodanud
 *  - accepted       vastuvõtja on vastu võtnud; `at` = millal
 *  - answered       vastuvõtja on ühises ruumis vastanud (kui rida kannab `replyCount`)
 *  - sent_external  saadetud väljaspool platvormi; platvorm vastuvõttu ei näe
 *  - recalled       saatja võttis tagasi
 *  - replaced       asendatud parandusega
 *  - archived       saatmata ja arhiveeritud
 *  - declined       asutus lükkas pöördumise tagasi; `at` = millal
 *  - work_closed    asutus lõpetas pöördumisega töö; `at` = millal
 *
 * ASUTUSE OTSUS (kaks viimast) tuleb väljalt `organizationOutcome`, mille server lisab pöörduja
 * enda ridadele, kui asutuse vastuvõtulaud on tööga lõpetanud (`lib/preInquiryOutcome.js`).
 * See on rea värskeim seis ja läheb ette sellest, et pöördumine võeti vastu või sellele
 * vastati: muidu seisaks tagasi lükatud pöördumise juures endiselt „vastu võetud" ja inimene
 * jääks abi ootama. Teekond näitab sama fakti oma real eraldi (`workClosedAt`).
 */

import { LinkedPreInquiryState, linkedPreInquiryState } from "./journey/linkedPreInquiryState.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const KEY_BY_STATE = Object.freeze({
  [LinkedPreInquiryState.DRAFT]: "draft",
  [LinkedPreInquiryState.READY]: "ready",
  [LinkedPreInquiryState.DOWNLOADED]: "downloaded",
  [LinkedPreInquiryState.SENT]: "sent_waiting",
  [LinkedPreInquiryState.SENT_OUTSIDE]: "sent_external",
  [LinkedPreInquiryState.OPENED]: "accepted",
  [LinkedPreInquiryState.ANSWERED]: "answered",
  [LinkedPreInquiryState.RECALLED]: "recalled",
  [LinkedPreInquiryState.REPLACED]: "replaced",
  [LinkedPreInquiryState.ARCHIVED]: "archived"
});

/* Asutuse otsus (`organizationOutcome.kind`) → seisuvõti. */
const KEY_BY_OUTCOME = Object.freeze({ declined: "declined", closed: "work_closed" });

export const PRE_INQUIRY_SENDER_STATE_KEYS = Object.freeze([...Object.values(KEY_BY_STATE), ...Object.values(KEY_BY_OUTCOME)]);

/**
 * Asutuse otsus pöörduja real või `null`. Tagasi võetud ja parandusega asendatud pöördumisel
 * otsust ei näidata: see ei ole enam pöördumine, mida asutus luges.
 */
export function organizationOutcomeOf(inquiry) {
  const outcome = inquiry?.organizationOutcome;
  if (!outcome || !KEY_BY_OUTCOME[outcome.kind]) return null;
  if (!inquiry.sentAt || inquiry.recalledAt || inquiry.supersededById) return null;
  return outcome;
}

function toTime(value) {
  if (!value) return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function preInquirySenderState(inquiry, { now = Date.now() } = {}) {
  if (!inquiry) return { key: "draft" };
  const outcome = organizationOutcomeOf(inquiry);
  if (outcome) return { key: KEY_BY_OUTCOME[outcome.kind], at: outcome.at || null };
  let key = KEY_BY_STATE[linkedPreInquiryState(inquiry)] || "draft";
  /* E-kirjaga saadetu vastuvõttu platvorm ei näe: „ootab vastuvõtmist" oleks vale lubadus. */
  if (key === "sent_waiting" && inquiry.deliveryChannel === "EXTERNAL_EMAIL") key = "sent_external";

  if (key === "recalled") return { key, at: inquiry.recalledAt };
  if (key === "accepted") return { key, at: inquiry.openedAt };
  if (key === "sent_external") return { key, at: inquiry.externalSendConfirmedAt || inquiry.sentAt || null };
  if (key === "sent_waiting") {
    const sentAt = toTime(inquiry.sentAt);
    const nowTime = toTime(now) ?? Date.now();
    return { key, at: inquiry.sentAt || null, days: sentAt ? Math.max(0, Math.floor((nowTime - sentAt) / DAY_MS)) : 0 };
  }
  return { key };
}

/** Toon seisu märgile: ok (vastu võetud või vastatud), wait (ootab), quiet (muu). */
export function preInquirySenderTone(key) {
  if (key === "accepted" || key === "answered") return "ok";
  if (key === "sent_waiting" || key === "sent_external") return "wait";
  return "quiet";
}
