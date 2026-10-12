/**
 * Töötajate puudumiste reeglid ilma joonistamiseta: vormi algseis ja päringu
 * sisu, mis seisab puudumise real ja mis takistab salvestamist.
 *
 * Puudumine on töötaja, päevad ja liik (plaaniline või ootamatu). Põhjust ei
 * küsita ja vaba teksti välja ei ole. Päevaplaan tõstab puudumise põhjal esile
 * käigud, mille tegija puudub, ega paku puudujat asendajaks. Olek ja päringud on
 * konksus ./useAbsences.js, vaated on ühised (../client/PartViews.jsx), kokku
 * paneb need ./Absences.jsx.
 */

import { CARE_ABSENCE_KINDS, CareAbsenceKind } from "@/lib/homeCare/constants";

import { planDayLabel } from "../plan/planRows";

/** Mitu puudumist on loendis vaates enne nuppu „Näita veel". */
export const ABSENCES_PAGE = 4;

/** Uue puudumise vorm: täna, ootamatu. */
export function emptyForm(today) {
  return { membershipId: "", fromDay: today, toDay: today, kind: CareAbsenceKind.SUDDEN };
}

/** Olemasoleva puudumise vorm. */
export function formFrom(absence) {
  return { membershipId: absence.membershipId, fromDay: absence.fromDay, toDay: absence.toDay, kind: absence.kind };
}

/** Päringu sisu, mis on uuel ja muudetaval puudumisel ühine. */
export function absenceBody(form) {
  return { fromDay: form.fromDay, toDay: form.toDay, kind: form.kind };
}

/** Puudumise rida: päev või ajavahemik ja liik. */
export function absenceLine(t, absence) {
  return [
    absence.fromDay === absence.toDay ? planDayLabel(absence.fromDay) : t("home_care.absences.period", { from: planDayLabel(absence.fromDay), to: planDayLabel(absence.toDay), days: absence.days }),
    t(`home_care.absences.kinds.${absence.kind}`)
  ].join(" · ");
}

/** Puudumised loendi ridadena: `[{ key, title, chip, line }]`; kehtiv puudumine on märgitud. */
export function absenceRows(absences, { t }) {
  return (absences || []).map((absence) => ({
    key: absence.id,
    title: absence.name || "—",
    chip: absence.current ? { text: t("home_care.absences.current_badge"), tone: "wait" } : null,
    line: absenceLine(t, absence)
  }));
}

/** Mida inimene puudumistega teha tohib: lisab, muudab ja kustutab hooldusjuht; lisada saab, kui on töötajaid. */
export function absenceRights({ canEdit }, workers) {
  return { edit: Boolean(canEdit), add: Boolean(canEdit) && workers.length > 0, noWorkers: Boolean(canEdit) && workers.length === 0 };
}

/** Töötajad valikuna: `[{ value, label }]`. */
export function workerChoices(workers) {
  return workers.map((worker) => ({ value: worker.membershipId, label: worker.name || "—" }));
}

/** Liigid valikuna: `[{ value, label }]`. */
export function kindChoices(t) {
  return CARE_ABSENCE_KINDS.map((value) => ({ value, label: t(`home_care.absences.kinds.${value}`) }));
}

/** Mis takistab salvestamist: päevad on vajalikud ja uuel puudumisel ka töötaja. */
export function absenceReady(editing, form) {
  return Boolean(form.fromDay) && Boolean(form.toDay) && !(editing?.mode === "add" && !form.membershipId);
}
