/**
 * Kliendi otsuste reeglid ilma joonistamiseta: vormi algseis ja päringu sisu,
 * mis seisab otsuse real, kes mida teha tohib ja mis takistab edasi minekut.
 *
 * Siia kirjutatakse, mida omavalitsus on otsustanud; otsuse dokument jääb sinna,
 * kus see on. Ekslikult sisestatud otsus tühistatakse, mitte ei kustutata. Olek
 * ja päringud on konksus ./useDecisions.js, vaated on ühised
 * (../client/PartViews.jsx), kokku paneb need ./Decisions.jsx.
 */

import { CARE_DECISION_KINDS, CARE_SIGNED_STATES, CARE_SIGN_STATES, CARE_VOLUME_PERIODS, CareDecisionKind, CareDecisionState, CareVolumePeriod } from "@/lib/homeCare/constants";

import { decisionPeriodLabel, decisionSheet, decisionVolumeLabel } from "../decision/decisionRows";
import { planDayLabel } from "../plan/planRows";

/** Mitu otsust on loendis vaates enne nuppu „Näita veel". */
export const DECISIONS_PAGE = 4;

/** Minutid tundidena sisestusväljale: 390 → „6,5", 380 → „6,33". */
export function hoursText(minutes) {
  if (!minutes) return "";
  return String(Math.round((minutes / 60) * 100) / 100).replace(".", ",");
}

/** Uue otsuse vorm: haldusakt, kehtib tänasest. */
export function emptyForm(today) {
  return {
    kind: CareDecisionKind.ACT,
    issuerName: "",
    documentNumber: "",
    decidedOn: "",
    validFrom: today || "",
    validUntil: "",
    volumeHours: "",
    volumePeriod: CareVolumePeriod.WEEK,
    feeNote: "",
    note: "",
    signState: "",
    signedOn: "",
    originalKept: ""
  };
}

/** Olemasoleva otsuse vorm. */
export function formFrom(decision) {
  return {
    kind: decision.kind,
    issuerName: decision.issuerName || "",
    documentNumber: decision.documentNumber || "",
    decidedOn: decision.decidedOn || "",
    validFrom: decision.validFrom,
    validUntil: decision.validUntil || "",
    volumeHours: hoursText(decision.volumeMinutes),
    volumePeriod: decision.volumePeriod || CareVolumePeriod.WEEK,
    feeNote: decision.feeNote || "",
    note: decision.note || "",
    signState: decision.signState || "",
    signedOn: decision.signedOn || "",
    originalKept: decision.originalKept || ""
  };
}

/**
 * Päringu sisu. Allkirja märge käib ainult halduslepinguga ja päev ainult
 * allkirjastatud seisuga: muu jäetakse saatmata.
 */
export function decisionBody(form) {
  const signState = form.kind === CareDecisionKind.CONTRACT ? form.signState || null : null;
  return {
    ...form,
    validUntil: form.validUntil || null,
    decidedOn: form.decidedOn || null,
    signState,
    signedOn: CARE_SIGNED_STATES.includes(signState) ? form.signedOn || null : null
  };
}

/** Mida inimene otsusega teha tohib: lisab, muudab ja tühistab hooldusjuht; tühistatud otsust ei muudeta. */
export function decisionRights(decision, { canEdit }) {
  return { edit: Boolean(canEdit && decision.state !== CareDecisionState.RETRACTED), retract: Boolean(canEdit && decision.state !== CareDecisionState.RETRACTED) };
}

/** Halduslepingul on allkirja märge. */
export function isContract(form) {
  return form.kind === CareDecisionKind.CONTRACT;
}

/** Allkirjastatud seisuga käib allkirjastamise päev. */
export function hasSignedState(form) {
  return isContract(form) && CARE_SIGNED_STATES.includes(form.signState);
}

/** Vormi teine vaade on valmis, kui kehtivuse algus on olemas. */
export function validityReady(form) {
  return Boolean(form.validFrom);
}

/** Otsuse märgid: seis, kui otsus ei kehti, ja „lõpeb …"; `[{ text, tone }]`. */
export function decisionChips(decision, { t }) {
  return (decisionSheet(decision, { t })?.chips || []).map((chip) => ({ text: chip.text, tone: chip.wait ? "wait" : "" }));
}

/** Otsused loendi ridadena: `[{ key, title, chip, lines }]`; real on kehtivus ja maht. */
export function decisionRows(decisions, { t }) {
  return (decisions || []).map((decision) => {
    const sheet = decisionSheet(decision, { t });
    return {
      key: decision.id,
      title: sheet.head,
      chips: decisionChips(decision, { t }),
      lines: [decisionPeriodLabel(t, decision), decisionVolumeLabel(t, decision)].filter(Boolean)
    };
  });
}

/** Otsuse lisainfo: millal otsustati, kes sisestas ja kes tühistas; üks lause. */
export function decisionMeta(decision, { t, moment }) {
  return [
    decision.decidedOn ? t("home_care.decision.decided_on", { date: planDayLabel(decision.decidedOn) }) : null,
    decision.createdByName ? t("home_care.decision.created_by", { name: decision.createdByName }) : null,
    decision.retractedAt ? t("home_care.decision.retracted_by", { name: decision.retractedByName || "", date: moment(decision.retractedAt) }) : null
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Valikud: liik, periood ja allkirja seis. */
export function kindChoices(t) {
  return CARE_DECISION_KINDS.map((value) => ({ value, label: t(`home_care.decision.kinds.${value}`) }));
}
export function periodChoices(t) {
  return CARE_VOLUME_PERIODS.map((value) => ({ value, label: t(`home_care.decision.periods.${value}`) }));
}
export function signChoices(t) {
  return CARE_SIGN_STATES.map((value) => ({ value, label: t(`home_care.decision.sign_states.${value}`) }));
}
