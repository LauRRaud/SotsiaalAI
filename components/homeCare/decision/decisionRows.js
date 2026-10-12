/**
 * Otsuse ja mahu reeglid ilma joonistamiseta: mis seisab otsuse vaates, mida
 * ütleb osutatud aeg ja püsivuse näit. Aja, mahu ja kehtivuse sõnu (aeg
 * tundides ja minutites, mitu päeva on jäänud) kasutavad paljud koduteenuse
 * lehed (käigud, päevaplaan, kuu kokkuvõte, tähtajad).
 *
 * Vaade on failis ./DecisionViews.jsx, andmed lehel (`../HomeCareClientPage.jsx`).
 */

import { CareDecisionKind, CareDecisionState, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

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

/**
 * Üks otsus vaate jaoks: `{ head, chips, facts, note }` või `null`, kui otsust ei ole.
 *  - `head`  liik, number ja otsustaja ühe reana
 *  - `chips` seis, kui otsus ei kehti, ja „lõpeb …", kui lõpp on lähedal
 *  - `facts` kehtivus, maht, tasu, lepingu allkiri ja originaali hoiukoht (K6-h);
 *            märkimata allkiri on näha ainult halduslepingul, mis ei ole tühistatud
 */
export function decisionSheet(decision, { t }) {
  if (!decision) return null;
  const volume = decisionVolumeLabel(t, decision);
  const signMark =
    decision.kind !== CareDecisionKind.CONTRACT
      ? ""
      : decision.signState
        ? `${t(`home_care.decision.sign_states.${decision.signState}`)}${decision.signedOn ? ` ${planDayLabel(decision.signedOn)}` : ""}`
        : decision.state === CareDecisionState.RETRACTED
          ? ""
          : t("home_care.decision.sign_missing");
  const endsSoon = decision.state === CareDecisionState.IN_FORCE && decision.daysLeft !== null && decision.daysLeft <= HOME_CARE_LIMITS.DEADLINE_LATER_DAYS;
  return {
    head: [t(`home_care.decision.kinds.${decision.kind}`), decision.documentNumber ? t("home_care.decision.number", { number: decision.documentNumber }) : null, decision.issuerName]
      .filter(Boolean)
      .join(", "),
    chips: [
      decision.state !== CareDecisionState.IN_FORCE ? { key: "state", text: t(`home_care.decision.states.${decision.state}`) } : null,
      endsSoon ? { key: "ends", text: t("home_care.decision.ends", { when: daysLabel(t, decision.daysLeft) }), wait: true } : null
    ].filter(Boolean),
    facts: [
      {
        key: "period",
        label: t("home_care.decision.facts.period"),
        value: decision.validUntil
          ? t("home_care.decision.facts.period_fixed", { from: planDayLabel(decision.validFrom), until: planDayLabel(decision.validUntil) })
          : t("home_care.decision.facts.period_open", { from: planDayLabel(decision.validFrom) })
      },
      { key: "volume", label: t("home_care.decision.facts.volume"), value: volume || t("home_care.decision.volume_missing"), quiet: !volume },
      { key: "fee", label: t("home_care.decision.facts.fee"), value: decision.feeNote || "" },
      { key: "sign", label: t("home_care.decision.facts.sign"), value: signMark },
      { key: "original", label: t("home_care.decision.facts.original"), value: decision.originalKept || "" }
    ],
    note: decision.note || ""
  };
}

/** Osutatud aeg (K2-e): selle nädala ja selle kuu käigu kirjed lausetena. `[{ key, text }]`. */
export function providedLines(provided, { t }) {
  if (!provided) return [];
  return ["week", "month"].map((period) => {
    const sums = provided[period];
    return {
      key: period,
      text:
        sums.visits === 0
          ? t(`home_care.provided.${period}_none`)
          : [t(`home_care.provided.${period}`, { visits: sums.visits, amount: minutesLabel(t, sums.minutes) }), sums.withoutLength ? t("home_care.provided.without_length", { count: sums.withoutLength }) : null]
              .filter(Boolean)
              .join(" · ")
    };
  });
}

/** Püsivuse näit (K5-f): mitu eri töötajat tegi viimase nelja nädala käigud. Tühi, kui näitu ei ole. */
export function continuityLine(continuity, { t }) {
  if (!continuity) return "";
  return continuity.workers === 1
    ? t("home_care.continuity.one", { visits: continuity.visits })
    : t("home_care.continuity.many", { workers: continuity.workers, top: continuity.topWorkers, percent: continuity.topPercent, visits: continuity.visits });
}
