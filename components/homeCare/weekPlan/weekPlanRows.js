/**
 * Hooldusjuhi nädalaplaani (K3-f) reeglid ilma joonistamiseta: seitse päeva
 * ühel real, iga töötaja kohta käikude arv päeva kaupa ja nädala plaanitud aeg.
 * Puudumise päev ja päev, kus on katmata või määramata käike, on märgitud
 * sõnaga, mitte ainult värviga. Iga lahter viib selle päeva plaani, kus käigu
 * saab ümber tõsta või ära jätta; siin midagi ei muudeta. Olek ja päring on
 * konksus ./useWeekPlan.js, vaated failis ./WeekViews.jsx, kokku paneb need
 * ./WeekPlan.jsx.
 */

import { minutesLabel } from "../decision/decisionRows";
import { planDayLabel } from "../plan/planRows";

/** Nädala pealkiri: number ja esmaspäevast pühapäevani. */
export function weekHeading(t, data) {
  return t("home_care.week.heading", { week: data.week, from: planDayLabel(data.monday), to: planDayLabel(data.sunday) });
}

/** Nädala kokkuvõte ühe lausena. */
export function weekTotals(t, data) {
  return t("home_care.week.totals", { visits: data.totals.visits, amount: minutesLabel(t, data.totals.minutes), unassigned: data.totals.unassigned, uncovered: data.totals.uncovered });
}

/** Nädalal ei ole midagi. */
export function weekEmpty(data) {
  return data.totals.visits === 0 && data.totals.uncovered === 0;
}

/** Päeva link päevaplaani. */
export function dayHref(organizationId, day) {
  return `/org/${organizationId}/koduteenus/paev?paev=${encodeURIComponent(day)}`;
}

function dayName(t, data, day) {
  const weekday = data.days.find((item) => item.day === day)?.weekday;
  return `${t(`home_care.slots.weekdays_long.${weekday}`)} ${planDayLabel(day)}`;
}

/** Üks lahter: `{ key, day, weekday, count, note, tone, label, today }`; `label` on ekraanilugejale terve lause. */
function cell(t, data, key, day, { count, note = "", tone = "", label }) {
  const weekday = data.days.find((item) => item.day === day)?.weekday;
  return { key, day, letter: t(`home_care.slots.weekdays.${weekday}`), count, note, tone, label, today: day === data.today };
}

/** Päevad: kõik käigud kokku; sõna ütleb, kui päeval on katmata või määramata käike. */
export function daysCells(data, { t }) {
  return data.days.map((day) => {
    const open = day.unassigned + day.uncovered;
    return cell(t, data, day.day, day.day, {
      count: day.visits,
      note: open ? t("home_care.week.open_short", { count: open }) : "",
      tone: open ? "danger" : day.visits ? "" : "off",
      label: t("home_care.week.day_cell", { day: dayName(t, data, day.day), visits: day.visits, unassigned: day.unassigned, uncovered: day.uncovered })
    });
  });
}

/** Määramata käigud päeva kaupa. */
export function unassignedCells(data, { t }) {
  return data.unassigned.days.map((day) =>
    cell(t, data, `u-${day.day}`, day.day, {
      count: day.visits,
      tone: day.visits ? "danger" : "off",
      label: t("home_care.week.cell", { day: dayName(t, data, day.day), visits: day.visits, amount: minutesLabel(t, day.minutes) })
    })
  );
}

/** Töötaja päevad: puudumise päev on märgitud sõnaga. */
export function workerCells(worker, data, { t }) {
  return worker.days.map((day) =>
    cell(t, data, `${worker.membershipId}-${day.day}`, day.day, {
      count: day.absent ? (day.uncovered ? day.uncovered : "–") : day.visits,
      note: day.absent ? t("home_care.week.absent_short") : "",
      tone: day.absent ? (day.uncovered ? "danger" : "warn") : day.visits ? "" : "off",
      label: day.absent ? t("home_care.week.cell_absent", { day: dayName(t, data, day.day), uncovered: day.uncovered }) : t("home_care.week.cell", { day: dayName(t, data, day.day), visits: day.visits, amount: minutesLabel(t, day.minutes) })
    })
  );
}

/** Töötaja nädala rida: käigud ja aeg, rasked käigud ja katmata käigud. */
export function workerTotals(t, worker) {
  return `${t("home_care.week.worker_total", { visits: worker.visits, amount: minutesLabel(t, worker.minutes) })}${worker.heavy ? ` · ${t("home_care.work_nature.heavy_visits", { count: worker.heavy })}` : ""}${worker.uncovered ? ` · ${t("home_care.week.worker_uncovered", { count: worker.uncovered })}` : ""}`;
}

/** Töötajad esimese vaate ridadena: `[{ key, title, chip, line, tone }]`; määramata käigud on ees. */
export function weekRows(data, { t }) {
  return [
    data.unassigned.visits
      ? { key: "unassigned", title: t("home_care.day.unassigned_title"), line: t("home_care.week.worker_total", { visits: data.unassigned.visits, amount: minutesLabel(t, data.unassigned.minutes) }), tone: "risk" }
      : null,
    ...data.workers.map((worker) => ({
      key: worker.membershipId,
      title: worker.name || "—",
      chip: worker.active ? null : { text: t("home_care.slots.worker_inactive"), tone: "wait" },
      line: workerTotals(t, worker),
      tone: worker.uncovered ? "risk" : ""
    }))
  ].filter(Boolean);
}
