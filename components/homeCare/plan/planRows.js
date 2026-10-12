/**
 * Hoolduskava reeglid ilma joonistamiseta: mis seisab kava real, mis järjekorras
 * toimingud on ja mis read kava all käivad (käigud ilma erandita, abi nihe).
 *
 * Vaade on failis ./PlanViews.jsx, olek ja päringud lehel
 * (`../HomeCareClientPage.jsx`). Päeva ja sageduse sõnu kasutavad ka teised
 * koduteenuse lehed.
 */

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

/** Kava read määruse rühmade järjekorras, rühma sees kava enda järjekorras. */
export function planLines(plan) {
  const order = new Map(CARE_ACTIVITY_GROUPS.map((group, index) => [group, index]));
  return [...(plan?.lines || [])].sort((a, b) => (order.get(a.activityGroup) ?? 99) - (order.get(b.activityGroup) ?? 99) || a.position - b.position);
}

/**
 * Kehtiv kava vaate jaoks: eesmärgid, toimingud määruse poolte kaupa (koduabi,
 * isikuabi), märkus ja rida kliendi nime kõrval (kava number ja ülevaatuse päev).
 * `null`, kui kava ei ole. Rida: `{ key, name, must, how, note }`; `must` on
 * toiming, mis peab toimuma.
 */
export function planSheet(plan, { t }) {
  if (!plan) return null;
  const lines = planLines(plan);
  return {
    goals: plan.goals || "",
    groups: CARE_ACTIVITY_DOMAINS.map((domain) => ({
      key: domain,
      title: t(`home_care.activities.domains.${domain}`),
      rows: lines
        .filter((line) => CARE_ACTIVITY_GROUP_DOMAIN[line.activityGroup] === domain)
        .map((line) => ({
          key: line.id,
          name: line.activityName,
          must: Boolean(line.critical),
          how: [planFrequencyLabel(t, line), t(`home_care.plan.modes.${line.mode}`)].join(" · "),
          note: line.note || ""
        }))
    })).filter((group) => group.rows.length),
    note: plan.note || "",
    foot: [
      plan.activatedAt ? t("home_care.plan.number", { number: plan.number }) : null,
      plan.reviewOn ? t("home_care.plan.review_on", { date: planDayLabel(plan.reviewOn) }) : t("home_care.plan.review_missing")
    ]
      .filter(Boolean)
      .join(" · ")
  };
}

/**
 * Read kava all: `[{ key, text, wait }]`.
 *  - `streak` käigud ilma ühegi erandita (K6-g): märge kliendi, mitte töötaja
 *    kohta; server annab selle ainult hooldusjuhile
 *  - `drift`  abi rohkem või vähem kui kavas (K6-d); kui kava on aeg üle
 *    vaadata, ütleb rida ka, kelle teha see on
 * `moment` vormindab ajahetke.
 */
export function planSignals(data, who, { t, moment }) {
  const streak = data?.exceptionStreak;
  const drift = data?.helpDrift;
  return [
    streak ? { key: "streak", text: t("home_care.exception_streak.line", { count: streak.visits, date: moment(streak.since) }), wait: true } : null,
    drift && drift.more + drift.less > 0
      ? {
          key: "drift",
          text: [
            t("home_care.help_drift.line", { more: drift.more, less: drift.less, total: drift.total }),
            drift.due ? t(who.isCoordinator ? "home_care.help_drift.due_coordinator" : "home_care.help_drift.due_team") : null
          ]
            .filter(Boolean)
            .join(" "),
          wait: Boolean(drift.due)
        }
      : null
  ].filter(Boolean);
}
