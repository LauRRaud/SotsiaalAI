/**
 * Kliendi lehe osa „Ohutus" reeglid ilma joonistamiseta: mis teemad osas on,
 * kes mida näeb ja muuta tohib ning mis seisab teema real ja vaates.
 *
 * Teemad: eeltingimused enne teenuse algust (K4-a), ohutuskaart (K5-n),
 * tavaline seis (K5-a), töö iseloom (K3-g) ja kriisivalmidus (K5-b). Olek ja
 * päringud on konksudes (./useSafetyParts.js), vaated failis ./SafetyViews.jsx,
 * kokku paneb need ./ClientSafety.jsx.
 */

import { CARE_CHANGE_AREAS, CARE_SAFETY_TOPICS } from "@/lib/homeCare/constants";

import { daysLabel } from "../decision/decisionRows";
import { planDayLabel } from "../plan/planRows";

/** Teemad selles järjekorras, nagu need osas on: mis takistab teenust, on ees. */
export const SAFETY_TOPICS = Object.freeze(["preconditions", "card", "usual", "work", "crisis"]);

const TITLES = Object.freeze({
  preconditions: "home_care.precondition.title",
  card: "home_care.safety.title",
  usual: "home_care.usual.title",
  work: "home_care.work_nature.title",
  crisis: "home_care.crisis.title"
});

/** Teema nime võti. */
export function topicTitleKey(topic) {
  return TITLES[topic] || "";
}

/**
 * Kes mida muuta tohib. Eeltingimused, töö iseloom ja kriisivalmidus on
 * hooldusjuhi teha; ohutuskaarti ja tavalist seisu täidavad meeskond ja hooldusjuht.
 */
export function safetyRights(who) {
  return { coordinator: Boolean(who.canWrite && who.isCoordinator), team: Boolean(who.canWrite && who.isTeam) };
}

/* Teema, kus ei ole midagi kirjas, on näha ainult sellele, kes saab selle täita. */
const SEE = Object.freeze({
  preconditions: (state, rights) => state.preconditions.length > 0 || rights.coordinator,
  card: (state, rights) => state.card.items.length > 0 || rights.team,
  usual: (state, rights) => state.usual.length > 0 || rights.team,
  work: (state, rights) => Boolean(state.work) || rights.coordinator,
  crisis: (state, rights) => Boolean(state.crisis) || rights.coordinator
});

export function topicVisible(topic, state, rights) {
  return Boolean(SEE[topic]?.(state, rights));
}

const answered = (card, answer) => card.items.filter((item) => item.answer === answer);

const LINES = Object.freeze({
  /* Täitmata eeltingimus tähendab, et teenust ei alustata: see rida on tugevam. */
  preconditions: (state, { t }) =>
    state.preconditions.length
      ? { line: t("home_care.parts.lines.safety_preconditions", { count: state.preconditions.length }), wait: true }
      : { line: t("home_care.safety_part.lines.preconditions_none") },
  card: (state, { t }) => {
    const { card } = state;
    if (!card.items.length) return { line: t("home_care.safety_part.lines.card_none") };
    const yes = answered(card, "YES");
    const open = CARE_SAFETY_TOPICS.length - card.items.length;
    return {
      line: yes.length
        ? yes.map((item) => t(`home_care.safety.topics.${item.topic}`)).join(", ")
        : open > 0
          ? t("home_care.safety.open_line", { count: open })
          : t("home_care.safety_part.lines.card_clear"),
      chip: card.reviewDue ? t("home_care.safety.review_due") : ""
    };
  },
  usual: (state, { t }) => ({ line: state.usual.length ? state.usual[0].text : t("home_care.safety_part.lines.usual_none") }),
  work: (state, { t }) => ({
    line: state.work ? state.work.kinds.map((kind) => t(`home_care.work_nature.kinds.${kind}`)).join(", ") : t("home_care.safety_part.lines.work_none")
  }),
  crisis: (state, { t }) => ({ line: state.crisis ? t(`home_care.crisis.levels.${state.crisis.level}`) : t("home_care.crisis.unset_title") })
});

/**
 * Osa esimese vaate read: `[{ key, title, line, wait, chip }]`. `state` on
 * `{ preconditions, card, usual, work, crisis }` konksude seisust.
 */
export function safetyTopics(state, rights, { t }) {
  return SAFETY_TOPICS.filter((topic) => topicVisible(topic, state, rights)).map((topic) => {
    const row = LINES[topic](state, { t });
    return { key: topic, title: t(TITLES[topic]), line: row.line, wait: Boolean(row.wait), chip: row.chip || "" };
  });
}

/* --- Eeltingimused -------------------------------------------------------------- */

/** Üks rida: mis peab korras olema, kes korraldab ja mis ajaks. Sama tekst kliendi lehel ja tähtaegade lehel. */
export function preconditionLine(t, item) {
  return [
    item.note ? `${t(`home_care.precondition.kinds.${item.kind}`)}: ${item.note}` : t(`home_care.precondition.kinds.${item.kind}`),
    t("home_care.precondition.arranged_by", { name: item.responsible }),
    item.dueOn
      ? t("home_care.precondition.due_on", { date: planDayLabel(item.dueOn), when: daysLabel(t, item.daysLeft) })
      : t("home_care.precondition.no_due")
  ].join(" · ");
}

/** Eeltingimus loendi real: `{ key, title, line, overdue }`. Pealkiri on see, mis peab korras olema. */
export function preconditionRow(item, { t }) {
  return {
    key: item.id,
    title: item.note ? `${t(`home_care.precondition.kinds.${item.kind}`)}: ${item.note}` : t(`home_care.precondition.kinds.${item.kind}`),
    line: [
      t("home_care.precondition.arranged_by", { name: item.responsible }),
      item.dueOn ? t("home_care.precondition.due_on", { date: planDayLabel(item.dueOn), when: daysLabel(t, item.daysLeft) }) : t("home_care.precondition.no_due")
    ].join(" · "),
    overdue: Boolean(item.overdue)
  };
}

/** Mis takistab eeltingimuse salvestamist: liik ja korraldaja on kohustuslikud, liigi „muu" puhul ka täpsustus. */
export function preconditionReady(form) {
  return Boolean(form.kind && form.responsible.trim() && (form.kind !== "OTHER" || form.note.trim()));
}

/* --- Ohutuskaart ------------------------------------------------------------------ */

/**
 * Ohutuskaart lugemiseks: ees on „jah"-vastused (see, mida peab enne minekut
 * teadma); „ei"-vastused on kokku võetud ühele reale.
 * `{ rows: [{ key, name, text }], notes: [lause] }`.
 */
export function cardSheet(card, { t }) {
  const no = answered(card, "NO");
  const open = CARE_SAFETY_TOPICS.length - card.items.length;
  return {
    rows: answered(card, "YES").map((item) => ({ key: item.topic, name: t(`home_care.safety.topics.${item.topic}`), text: item.note || "" })),
    notes: [
      no.length ? t("home_care.safety.no_line", { list: no.map((item) => t(`home_care.safety.topics.${item.topic}`)).join(", ") }) : null,
      open > 0 ? t("home_care.safety.open_line", { count: open }) : null,
      card.assessedOn ? t("home_care.safety.assessed_on", { date: planDayLabel(card.assessedOn) }) : null
    ].filter(Boolean)
  };
}

/** Kaardi küsimused täitmisel: `[{ key, name, question, answer, note }]` kaardi järjekorras. */
export function cardQuestions(form, { t }) {
  return CARE_SAFETY_TOPICS.map((topic) => ({
    key: topic,
    name: t(`home_care.safety.topics.${topic}`),
    question: t(`home_care.safety.questions.${topic}`),
    answer: form[topic]?.answer || "",
    note: form[topic]?.note || ""
  }));
}

/** Järgmine küsimus kaardi järjekorras; tühi sõne, kui see oli viimane. */
export function nextQuestion(topic) {
  const index = CARE_SAFETY_TOPICS.indexOf(topic);
  return index >= 0 && index < CARE_SAFETY_TOPICS.length - 1 ? CARE_SAFETY_TOPICS[index + 1] : "";
}

/* --- Tavaline seis ----------------------------------------------------------------- */

/** Tavaline seis lugemiseks: `[{ key, label, value }]`. */
export function usualRows(items, { t }) {
  return items.map((item) => ({ key: item.area, label: t(`home_care.change.areas.${item.area}`), value: item.text }));
}

/** Tavalise seisu väljad: `[{ key, label, example, value }]` kuue valdkonna kaupa. */
export function usualFields(form, { t }) {
  return CARE_CHANGE_AREAS.map((area) => ({ key: area, label: t(`home_care.change.areas.${area}`), example: t(`home_care.usual.examples.${area}`), value: form[area] || "" }));
}

/* --- Töö iseloom ja kriisivalmidus ---------------------------------------------------- */

/** Töö iseloomu märge lugemiseks: `{ chips, reason, meta }`. */
export function workSheet(mark, { t }) {
  return {
    chips: mark.kinds.map((kind) => ({ key: kind, text: t(`home_care.work_nature.kinds.${kind}`) })),
    reason: mark.reason || "",
    meta: [mark.reviewOn ? t("home_care.work_nature.review_on", { date: planDayLabel(mark.reviewOn) }) : null, mark.setByName ? t("home_care.work_nature.set_by", { name: mark.setByName }) : null]
      .filter(Boolean)
      .join(" · ")
  };
}

/** Kriisivalmiduse hinnang lugemiseks: `{ level, lines }`. */
export function crisisSheet(crisis, { t }) {
  return {
    level: t(`home_care.crisis.levels.${crisis.level}`),
    lines: [
      crisis.dependencies.length ? t("home_care.crisis.depends_on", { list: crisis.dependencies.map((code) => t(`home_care.crisis.dependencies.${code}`)).join(", ") }) : null,
      crisis.helper ? t("home_care.crisis.helper_line", { name: crisis.helper }) : null,
      crisis.note || null
    ].filter(Boolean)
  };
}
