"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import { CareDecisionKind, CareDecisionState, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { planDayLabel } from "./HomeCarePlanView";

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

/**
 * Üks otsus lugemiseks: liik, number ja otsustaja; kehtivus; maht; tasu; märkus.
 * Kasutusel kliendi lehel (täna kehtiv otsus kogu meeskonnale) ja otsuste lehel.
 */
export default function HomeCareDecisionView({ decision }) {
  const { t } = useI18n();
  if (!decision) return null;
  const head = [
    t(`home_care.decision.kinds.${decision.kind}`),
    decision.documentNumber ? t("home_care.decision.number", { number: decision.documentNumber }) : null,
    decision.issuerName
  ].filter(Boolean);
  const volume = decisionVolumeLabel(t, decision);
  /* Lepingu allkirja märge ja originaali hoiukoht (K6-h). Märkimata allkiri on näha ainult
     halduslepingul, mis ei ole tühistatud. */
  const signMark =
    decision.kind !== CareDecisionKind.CONTRACT
      ? null
      : decision.signState
        ? `${t(`home_care.decision.sign_states.${decision.signState}`)}${decision.signedOn ? ` ${planDayLabel(decision.signedOn)}` : ""}`
        : decision.state === CareDecisionState.RETRACTED
          ? null
          : t("home_care.decision.sign_missing");
  const signLine = [signMark, decision.originalKept ? t("home_care.decision.original_line", { place: decision.originalKept }) : null].filter(Boolean).join(" · ");
  const endsSoon =
    decision.state === CareDecisionState.IN_FORCE &&
    decision.daysLeft !== null &&
    decision.daysLeft <= HOME_CARE_LIMITS.DEADLINE_LATER_DAYS;

  return (
    <>
      <p>
        <span>{head.join(", ")}</span>
        {decision.state !== CareDecisionState.IN_FORCE ? (
          <>
            {" "}
            <span className="hc-badge">{t(`home_care.decision.states.${decision.state}`)}</span>
          </>
        ) : null}
        {endsSoon ? (
          <>
            {" "}
            <span className="hc-badge hc-badge--warn">
              {t("home_care.decision.ends", { when: daysLabel(t, decision.daysLeft) })}
            </span>
          </>
        ) : null}
      </p>
      <p className="hc-entry__meta">
        {[
          decisionPeriodLabel(t, decision),
          volume || t("home_care.decision.volume_missing"),
          decision.feeNote
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {signLine ? <p className="hc-entry__meta">{signLine}</p> : null}
      {decision.note ? <p className="hc-sub hc-sub--pre">{decision.note}</p> : null}
    </>
  );
}
