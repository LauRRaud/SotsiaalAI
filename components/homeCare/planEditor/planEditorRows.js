/**
 * Hoolduskava koostamise reeglid ilma joonistamiseta: kava mustandi algseis,
 * päringu sisu, mis seisab ridadel, mis nupud on lubatud ja mis takistab edasi
 * minekut.
 *
 * Muudetakse MUSTANDIT; kehtiv kava jääb samaks, kuni mustand kehtestatakse.
 * Kehtestamine asendab kehtiva kava ja eelmine jääb alles varasemate kavade
 * loendis. Toimingud tulevad asutuse kataloogist. Olek ja päringud on konksus
 * ./usePlanEditor.js, vaated on ühised (../client/PartViews.jsx), kokku paneb
 * need ./PlanEditor.jsx.
 */

import { CARE_ACTIVITY_DOMAINS, CARE_ACTIVITY_GROUP_DOMAIN, CARE_PLAN_FREQUENCIES, CARE_PLAN_MODES, CarePlanFrequency, CarePlanMode } from "@/lib/homeCare/constants";

import { planFrequencyLabel } from "../plan/planRows";

/** Mitu toimingut on valimise vaates korraga enne nuppu „Näita veel". */
export const PICK_PAGE = 6;

/** Uue rea vaikeväärtused: kord nädalas, teeme koos. Hooldusjuht muudab need kohe sobivaks. */
export const NEW_LINE = Object.freeze({
  frequencyKind: CarePlanFrequency.WEEKLY,
  frequencyCount: "1",
  frequencyNote: "",
  mode: CarePlanMode.TOGETHER,
  critical: false,
  note: ""
});

/** Vormi algseis: mustand, kui see on; muidu kehtiv kava lähtekohana; muidu tühi. */
export function startFrom(plan, activities) {
  const known = new Set(activities.map((activity) => activity.id));
  const lines = {};
  for (const line of plan?.lines || []) {
    /* Arhiveeritud toimingut uude kavasse kaasa ei võeta. */
    if (!line.activityId || !known.has(line.activityId)) continue;
    lines[line.activityId] = {
      frequencyKind: line.frequencyKind,
      frequencyCount: line.frequencyCount ? String(line.frequencyCount) : "1",
      frequencyNote: line.frequencyNote || "",
      mode: line.mode,
      critical: Boolean(line.critical),
      note: line.note || ""
    };
  }
  return { goals: plan?.goals || "", reviewOn: plan?.reviewOn || "", note: plan?.note || "", lines };
}

/** Päringu sisu: vorm kataloogi järjekorras ridadena. */
export function planBody(form, activities, draft) {
  return {
    version: draft?.version,
    goals: form.goals,
    reviewOn: form.reviewOn || null,
    note: form.note,
    /* Ridade järjekord on kataloogi järjekord. */
    lines: activities
      .filter((activity) => form.lines[activity.id])
      .map((activity) => {
        const line = form.lines[activity.id];
        return {
          activityId: activity.id,
          frequencyKind: line.frequencyKind,
          frequencyCount: line.frequencyKind === CarePlanFrequency.AS_NEEDED ? null : Number(line.frequencyCount),
          frequencyNote: line.frequencyNote,
          mode: line.mode,
          critical: line.critical,
          note: line.note
        };
      })
  };
}

/** Mitu toimingut on kavas. */
export function chosenCount(form) {
  return Object.keys(form.lines).length;
}

/** Mida inimene kavaga teha tohib: koostab hooldusjuht, kui kataloogis on toiminguid. */
export function editorRights({ canEdit, activities }) {
  return { edit: Boolean(canEdit) && activities.length > 0, catalogueEmpty: activities.length === 0 };
}

/** Nupud: mustandi salvestamine, kehtestamine ja mustandi äraviskamine; mis on lubatud ja kas on nähtav. */
export function editorButtons({ form, draft, dirty, busy }) {
  const chosen = chosenCount(form);
  return {
    save: { disabled: busy || (!dirty && Boolean(draft)) },
    activate: { disabled: busy || chosen === 0 || (!dirty && !draft) },
    discard: { visible: Boolean(draft) || dirty, disabled: busy }
  };
}

/** Toimingud, mis kavas on, kataloogi järjekorras: `[{ key, title, chip, line }]`; kriitiline toiming on märgitud. */
export function lineRows(form, activities, { t }) {
  return activities
    .filter((activity) => form.lines[activity.id])
    .map((activity) => {
      const line = form.lines[activity.id];
      return {
        key: activity.id,
        title: activity.name,
        chip: line.critical ? { text: t("home_care.plan.critical_badge"), tone: "wait" } : null,
        line: [planFrequencyLabel(t, line), t(`home_care.plan.modes.${line.mode}`)].join(" · ")
      };
    });
}

/** Valdkonnad, kus on toiminguid: `[{ key, title, line }]`; real on, mitu toimingut sellest valdkonnast on kavas. */
export function domainRows(form, activities, { t }) {
  return CARE_ACTIVITY_DOMAINS.map((domain) => {
    const items = activities.filter((activity) => CARE_ACTIVITY_GROUP_DOMAIN[activity.group] === domain);
    const picked = items.filter((activity) => form.lines[activity.id]).length;
    return { key: domain, title: t(`home_care.activities.domains.${domain}`), line: t("home_care.plan.chosen", { count: picked }), count: items.length };
  }).filter((row) => row.count > 0);
}

/** Ühe valdkonna toimingud: `[{ key, title, line, chip }]`; valitud toiming on märgitud. */
export function pickRows(domain, form, activities, { t }) {
  return activities
    .filter((activity) => CARE_ACTIVITY_GROUP_DOMAIN[activity.group] === domain)
    .map((activity) => ({
      key: activity.id,
      title: activity.name,
      line: t(`home_care.activities.groups.${activity.group}`),
      chip: form.lines[activity.id] ? { text: t("home_care.parts.picked"), tone: "ok" } : null
    }));
}

/** Varasemad kavad ridadena: `[{ key, title, open }]`; real on kava number, kehtivuse aeg ja toimingute arv. */
export function historyRows(history, { t, moment }) {
  return (history || []).map((item) => ({
    key: item.id,
    title: t("home_care.plan.history_line", { number: item.number, from: moment(item.activatedAt), to: moment(item.replacedAt), count: item.lineCount }),
    open: false
  }));
}

/** Rea sageduse valik: `[{ value, label }]`. */
export function frequencyChoices(t) {
  return CARE_PLAN_FREQUENCIES.map((value) => ({ value, label: t(`home_care.plan.frequency.${value}`) }));
}

/** Rea tegemise viisi valik: `[{ value, label }]`. */
export function modeChoices(t) {
  return CARE_PLAN_MODES.map((value) => ({ value, label: t(`home_care.plan.modes.${value}`) }));
}

/** Sagedust küsitakse (kui palju kordi), kui toiming ei ole „vajadusel". */
export function needsCount(line) {
  return line.frequencyKind !== CarePlanFrequency.AS_NEEDED;
}

/** Rea esimene vaade on valmis, kui sagedus on olemas (arv vajab vähemalt ühte kordagi). */
export function lineReady(line) {
  return !needsCount(line) || Number(line.frequencyCount) >= 1;
}
