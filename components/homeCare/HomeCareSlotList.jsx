"use client";

import { useI18n } from "@/components/i18n/I18nProvider";

import { minutesLabel } from "./HomeCareDecisionView";
import { planDayLabel } from "./HomeCarePlanView";

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
 * Kliendi käigumuster lugemiseks: korduvad käigud nädalapäevade kaupa.
 * Kasutusel kliendi lehel (kogu meeskonnale).
 */
export default function HomeCareSlotList({ slots, today }) {
  const { t } = useI18n();
  if (!slots?.length) return <p className="hc-hint">{t("home_care.slots.none")}</p>;
  return (
    <ul className="hc-list hc-list--plain">
      {WEEKDAYS.filter((weekday) => slots.some((slot) => slot.weekday === weekday)).map((weekday) => (
        <li key={weekday}>
          <span>{t(`home_care.slots.weekdays_long.${weekday}`)}</span>
          {slots
            .filter((slot) => slot.weekday === weekday)
            .map((slot) => (
              <span className="hc-entry__meta" key={slot.id}>
                {" "}
                {slotLine(t, slot, today)}
                {slot.worker && !slot.worker.active ? (
                  <>
                    {" "}
                    <span className="hc-badge hc-badge--warn">{t("home_care.slots.worker_inactive")}</span>
                  </>
                ) : null}
              </span>
            ))}
        </li>
      ))}
    </ul>
  );
}
