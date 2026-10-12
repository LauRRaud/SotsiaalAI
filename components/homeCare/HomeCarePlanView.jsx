"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import { CARE_ACTIVITY_DOMAINS, CARE_ACTIVITY_GROUP_DOMAIN } from "@/lib/homeCare/constants";

import { planDayLabel, planFrequencyLabel, planLines } from "./plan/planRows";

/* Päeva ja sageduse sõnad on reeglite failis; siit võtavad need vana kihi lehed. */
export { planDayLabel, planFrequencyLabel };

/**
 * Hoolduskava lugemiseks vanal kihil: eesmärgid, toimingud määruse poolte kaupa
 * (koduabi, isikuabi) koos sageduse ja tegemise viisiga, ülevaatuse päev.
 *
 * Kasutusel kava koostamise lehel. Kliendi lehel on kehtiv kava uuel kihil
 * (./plan/PlanViews.jsx).
 */
export default function HomeCarePlanView({ plan }) {
  const { t } = useI18n();
  if (!plan) return null;
  const lines = planLines(plan);

  return (
    <>
      {plan.goals ? (
        <div className="hc-field">
          <h3 className="hc-label">{t("home_care.plan.goals")}</h3>
          <p className="hc-sub hc-sub--pre">{plan.goals}</p>
        </div>
      ) : null}

      {CARE_ACTIVITY_DOMAINS.map((domain) => {
        const items = lines.filter((line) => CARE_ACTIVITY_GROUP_DOMAIN[line.activityGroup] === domain);
        if (!items.length) return null;
        return (
          <div className="hc-field" key={domain}>
            <h3 className="hc-label">{t(`home_care.activities.domains.${domain}`)}</h3>
            <ul className="hc-list hc-list--plain">
              {items.map((line) => (
                <li key={line.id}>
                  <span>{line.activityName}</span>
                  {line.critical ? (
                    <>
                      {" "}
                      <span className="hc-badge hc-badge--warn">{t("home_care.plan.critical_badge")}</span>
                    </>
                  ) : null}
                  <span className="hc-entry__meta">
                    {" "}
                    {[planFrequencyLabel(t, line), t(`home_care.plan.modes.${line.mode}`)].join(" · ")}
                  </span>
                  {line.note ? <span className="hc-sub"> {line.note}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {plan.note ? <p className="hc-sub hc-sub--pre">{plan.note}</p> : null}
      <p className="hc-hint">
        {[
          plan.activatedAt ? t("home_care.plan.number", { number: plan.number }) : null,
          plan.reviewOn ? t("home_care.plan.review_on", { date: planDayLabel(plan.reviewOn) }) : t("home_care.plan.review_missing")
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </>
  );
}
