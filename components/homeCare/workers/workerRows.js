/**
 * Töötajate kaartide reeglid ilma joonistamiseta: mis seisab töötaja ja kaardi rea
 * peal, mis puudub ja mis takistab salvestamist.
 *
 * Töötajate kaardid (K5-e): iga hooldaja taustakontrolli ja koolituste read. Ainult
 * kogu asutuse hooldusjuhile. Taustakontrolli juures on ainult kuupäev: tulemust ega
 * sisu siin ei hoita. Olek ja päringud on konksus ./useWorkers.js, vaated on ühised
 * (../client/PartViews.jsx), kokku paneb need ./Workers.jsx.
 */

import { CARE_WORKER_RECORD_KINDS, CareWorkerRecordKind } from "@/lib/homeCare/constants";

import { daysLabel } from "../decision/decisionRows";
import { planDayLabel } from "../plan/planRows";

/** Mitu rida on loendis vaates enne nuppu „Näita veel". */
export const WORKERS_PAGE = 4;

/** Üks rida töötaja kaardilt: mis, millal ja kaua kehtib. Sama tekst kaardil ja tähtaegade lehel. */
export function workerRecordLine(t, record) {
  const name =
    record.kind === CareWorkerRecordKind.TRAINING
      ? `${t("home_care.workers.kinds.TRAINING")}: ${record.title}`
      : record.kind === "MISSING_BACKGROUND"
        ? t("home_care.workers.background_missing")
        : t(`home_care.workers.kinds.${record.kind}`);
  return [
    name,
    record.doneOn ? t("home_care.workers.done_on", { date: planDayLabel(record.doneOn) }) : null,
    record.validUntil ? t("home_care.workers.valid_until", { date: planDayLabel(record.validUntil), when: daysLabel(t, record.daysLeft) }) : null
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Uue rea algseis: liik valimata, tehtud täna, kehtivust ei ole. */
export function emptyRecordForm(today) {
  return { kind: "", title: "", doneOn: today, validUntil: "" };
}

/** Koolitus vajab teemat. */
export function isTraining(form) {
  return form.kind === CareWorkerRecordKind.TRAINING;
}

/** Esimene samm (liik ja koolituse teema) on valmis. */
export function kindReady(form) {
  return Boolean(form.kind) && (!isTraining(form) || Boolean(form.title.trim()));
}

/** Rida on salvestatav: liik, vajadusel teema ja tehtud päev. */
export function recordReady(form) {
  return kindReady(form) && Boolean(form.doneOn);
}

/** Liigid valikuna: `[{ value, label }]`. */
export function kindChoices(t) {
  return CARE_WORKER_RECORD_KINDS.map((value) => ({ value, label: t(`home_care.workers.kinds.${value}`) }));
}

/** Märk: aegunud rida. */
export function expiredChip(t, record) {
  return record.expired ? { text: t("home_care.workers.expired"), tone: "wait" } : null;
}

/** Töötajad loendi ridadena: `[{ key, title, chips, line }]`; taustakontrolli rea puudumine on märk nime kõrval. */
export function workerRows(t, workers) {
  return workers.map((worker) => ({
    key: worker.membershipId,
    title: worker.name,
    chips: worker.backgroundMissing ? [{ text: t("home_care.workers.background_missing"), tone: "wait" }] : [],
    line: worker.records.length ? t("home_care.parts.count", { count: worker.records.length }) : t("home_care.workers.no_records")
  }));
}

/** Töötaja kaardi read: `[{ key, title, chip, open }]`; avatav on rida, mida hooldusjuht tohib eemaldada. */
export function recordRows(t, worker, { canEdit }) {
  return worker.records.map((record) => ({ key: record.id, title: workerRecordLine(t, record), chip: expiredChip(t, record), open: canEdit }));
}
