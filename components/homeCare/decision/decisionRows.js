/**
 * Otsuse ja mahu sõnad ilma joonistamiseta: aeg tundides ja minutites, otsuse
 * maht ja kehtivus, mitu päeva on jäänud. Neid kasutavad paljud koduteenuse
 * lehed (käigud, päevaplaan, kuu kokkuvõte, tähtajad).
 */

import { planDayLabel } from "../plan/planRows";

/** Minutid kujul „6 h 30 min"; ümmargune tund ilma minutiteta. */
export function minutesLabel(t, minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return t("home_care.decision.amount_minutes", { minutes: rest });
  if (!rest) return t("home_care.decision.amount_hours", { hours });
  return t("home_care.decision.amount_hours_minutes", { hours, minutes: rest });
}

/** „6 h 30 min nädalas" või tühi, kui otsuses mahtu ei ole. */
export function decisionVolumeLabel(t, decision) {
  if (!decision?.volumeMinutes || !decision.volumePeriod) return "";
  return t(`home_care.decision.volume.${decision.volumePeriod}`, { amount: minutesLabel(t, decision.volumeMinutes) });
}

/** „kehtib 01.09.2026 kuni 31.08.2027" või „kehtib alates 01.09.2026, tähtajatu". */
export function decisionPeriodLabel(t, decision) {
  return decision.validUntil
    ? t("home_care.decision.period_fixed", { from: planDayLabel(decision.validFrom), until: planDayLabel(decision.validUntil) })
    : t("home_care.decision.period_open", { from: planDayLabel(decision.validFrom) });
}

/** „täna", „homme" või „N päeva pärast"; möödunud päeva kohta „N päeva tagasi". */
export function daysLabel(t, days) {
  if (days === 0) return t("home_care.deadlines.days.today");
  if (days === 1) return t("home_care.deadlines.days.tomorrow");
  if (days > 1) return t("home_care.deadlines.days.in", { count: days });
  if (days === -1) return t("home_care.deadlines.days.yesterday");
  return t("home_care.deadlines.days.ago", { count: -days });
}
