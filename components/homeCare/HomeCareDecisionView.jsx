"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import { CareDecisionKind, CareDecisionState, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { daysLabel, decisionPeriodLabel, decisionVolumeLabel, minutesLabel } from "./decision/decisionRows";
import { planDayLabel } from "./plan/planRows";

/* Aja, mahu ja kehtivuse sõnad on reeglite failis; siit võtavad need vana kihi lehed. */
export { daysLabel, decisionPeriodLabel, decisionVolumeLabel, minutesLabel };

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
