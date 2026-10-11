"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import { CARE_ACTIVITY_DOMAINS, CARE_ACTIVITY_GROUPS, CARE_ACTIVITY_GROUP_DOMAIN, CarePlanFrequency } from "@/lib/homeCare/constants";

/** `2026-11-15` → `15.11.2026`. Käsitsi, et server ja brauser annaksid sama kuju. */
export function planDayLabel(day) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day || ""));
  return match ? `${match[3]}.${match[2]}.${match[1]}` : "";
}

/** „3× nädalas" või „vajadusel"; täpsustus oma sõnadega järel. */
export function planFrequencyLabel(t, line) {
  const base =
    line.frequencyKind === CarePlanFrequency.AS_NEEDED
      ? t("home_care.plan.frequency.AS_NEEDED")
      : t(`home_care.plan.frequency_count.${line.frequencyKind}`, { count: line.frequencyCount });
  return line.frequencyNote ? `${base}, ${line.frequencyNote}` : base;
}

/**
 * Hoolduskava lugemiseks: eesmärgid, toimingud määruse poolte kaupa (koduabi,
 * isikuabi) koos sageduse ja tegemise viisiga, ülevaatuse päev.
 *
 * Kasutusel kliendi lehel (kehtiv kava kogu meeskonnale) ja kava koostamise lehel.
 */
export default function HomeCarePlanView({ plan }) {
  const { t } = useI18n();
  if (!plan) return null;
  const order = new Map(CARE_ACTIVITY_GROUPS.map((group, index) => [group, index]));
  const lines = [...plan.lines].sort(
    (a, b) => (order.get(a.activityGroup) ?? 99) - (order.get(b.activityGroup) ?? 99) || a.position - b.position
  );

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
