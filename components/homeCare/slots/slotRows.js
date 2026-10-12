/**
 * Kliendi käikude reeglid ilma joonistamiseta: mis seisab korduva käigu real,
 * mida ütleb eilne ja tänane käik ja mis lehti saab kliendi koju printida.
 *
 * Vaated on failis ./SlotsViews.jsx, kokku paneb need ./ClientSlots.jsx.
 * Käigu rea sõnu kasutab ka käikude muutmise leht.
 */

import { minutesLabel } from "../decision/decisionRows";
import { planDayLabel } from "../plan/planRows";

export const WEEKDAYS = Object.freeze([1, 2, 3, 4, 5, 6, 7]);

/** „09:00 · 45 min · Anu Hooldaja" või „… · määramata"; kehtivuse algus ja lõpp, kui need erinevad tavalisest. */
export function slotLine(t, slot, today) {
  return [
    slot.startTime,
    minutesLabel(t, slot.plannedMinutes),
    slot.worker ? slot.worker.name || "—" : t("home_care.slots.unassigned"),
    /* Tähtsus on näha, kui see erineb tavalisest (B). */
    slot.priority && slot.priority !== "B" ? t(`home_care.priority.short.${slot.priority}`) : null,
    slot.validFrom > today ? t("home_care.slots.from", { date: planDayLabel(slot.validFrom) }) : null,
    slot.validUntil ? t("home_care.slots.until", { date: planDayLabel(slot.validUntil) }) : null,
    slot.note
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Eilne ja tänane käik seisuga (K5-l): vastus küsimusele „kas käidi?" ühe
 * pilguga. `[{ key, label, value }]`; tühi, kui server neid ei andnud.
 */
export function recentRows(recentVisits, { t }) {
  return (recentVisits || []).map((item, index) => ({
    key: item.day,
    label: t(index === 0 ? "home_care.recent.yesterday" : "home_care.recent.today"),
    value: item.away
      ? t("home_care.recent.away")
      : item.visits.length
        ? item.visits.map((visit) => `${visit.startTime} ${t(`home_care.day.states.${visit.state}`)}`).join(", ")
        : t("home_care.recent.none")
  }));
}

/**
 * Käigumuster (K3-a) nädalapäevade kaupa: `[{ key, name, rows: [{ key, line, inactive }] }]`.
 * `inactive`: käik on määratud töötajale, kelle liikmesus enam ei kehti.
 */
export function slotDays(slots, today, { t }) {
  const list = slots || [];
  return WEEKDAYS.filter((weekday) => list.some((slot) => slot.weekday === weekday)).map((weekday) => ({
    key: weekday,
    name: t(`home_care.slots.weekdays_long.${weekday}`),
    rows: list.filter((slot) => slot.weekday === weekday).map((slot) => ({ key: slot.id, line: slotLine(t, slot, today), inactive: Boolean(slot.worker && !slot.worker.active) }))
  }));
}

/**
 * Lehed kliendi koju. Külmkapileht (K5-g) on meeskonnale ja hooldusjuhile ning
 * vajab käigumustrit; kliendi kuuleht (K6-e) on hooldusjuhi teha, ka ilma
 * käigumustrita.
 */
export function sheetRights(who, data) {
  return { fridge: Boolean(who.isTeam && data?.slots?.length), statement: Boolean(who.isCoordinator) };
}
