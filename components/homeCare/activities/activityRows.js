/**
 * Asutuse toimingute kataloogi reeglid ilma joonistamiseta: mis seisab
 * pool-, rühma- ja toimingurea peal, mida inimene tohib ja millal vorm on valmis.
 *
 * Ülemine tase on määruse nr 40 kuusteist toimingurühma (kuus koduabi, kümme
 * isikuabi) ja seda siin ei muudeta. Selle all on asutuse enda toimingud tema enda
 * sõnadega. Loevad kõik hooldajad; lisab, muudab ja arhiveerib kogu asutuse
 * hooldusjuht. Olek ja päringud on konksus ./useActivities.js, vaated on ühised
 * (../client/PartViews.jsx), kokku paneb need ./Activities.jsx.
 */

import { CARE_ACTIVITY_DOMAINS, CARE_ACTIVITY_GROUPS, CARE_ACTIVITY_GROUP_DOMAIN } from "@/lib/homeCare/constants";

/** Mitu rida on loendis vaates enne nuppu „Näita veel". */
export const ACTIVITIES_PAGE = 4;

/** Pooled (koduabi, isikuabi) samas järjekorras nagu määruses. */
export const DOMAINS = CARE_ACTIVITY_DOMAINS;

/** Mida inimene toimingutega teha tohib: lisab, muudab ja arhiveerib hooldusjuht, kui asutus on kirjutatav. */
export function activityRights({ canEdit, writable }) {
  return { edit: Boolean(canEdit) && Boolean(writable) };
}

/** Kehtivad ja arhiveeritud toimingud eraldi. */
export function splitActivities(activities) {
  return { active: activities.filter((item) => !item.archivedAt), archived: activities.filter((item) => item.archivedAt) };
}

/** Rühm on määruse rühm. */
export function isGroup(value) {
  return CARE_ACTIVITY_GROUPS.includes(value);
}

/** Pool, kuhu rühm kuulub. */
export function domainOfGroup(value) {
  return CARE_ACTIVITY_GROUP_DOMAIN[value];
}

/** Poole rühmad määruse järjekorras. */
export function groupsOf(domain) {
  return CARE_ACTIVITY_GROUPS.filter((value) => CARE_ACTIVITY_GROUP_DOMAIN[value] === domain);
}

/** Poole kehtivad toimingud. */
export function activitiesOfDomain(active, domain) {
  return active.filter((item) => domainOfGroup(item.group) === domain);
}

/** Rühma nimi. */
export function groupLabel(t, value) {
  return t(`home_care.activities.groups.${value}`);
}

/** Pooled ridadena: `[{ key, title, line }]`; real on toimingute arv. */
export function domainRows(active, { t }) {
  return DOMAINS.map((domain) => ({
    key: domain,
    title: t(`home_care.activities.domains.${domain}`),
    line: t("home_care.activities.count", { count: activitiesOfDomain(active, domain).length })
  }));
}

/** Poole rühmad ridadena: `[{ key, title, line }]`; tühja rühma real on selgitus, mitte arv. */
export function groupRows(domain, active, { t }) {
  return groupsOf(domain).map((value) => {
    const count = active.filter((item) => item.group === value).length;
    return { key: value, title: groupLabel(t, value), line: count ? t("home_care.activities.count", { count }) : t("home_care.activities.group_empty") };
  });
}

/** Rühma toimingud ridadena: `[{ key, title, line, open }]`; real on selgitus hooldajale. Ainult lugeja näeb loetavaid ridu. */
export function activityRows(items, { canEdit }) {
  return items.map((item) => ({ key: item.id, title: item.name, line: item.note || "", open: canEdit }));
}

/** Arhiveeritud toimingud ridadena: `[{ key, title, line }]`; real on rühm. */
export function archivedRows(items, { t }) {
  return items.map((item) => ({ key: item.id, title: item.name, line: groupLabel(t, item.group) }));
}

/** Rühmad valikuna (toimingu viimine teise rühma): `[{ value, label }]`. */
export function groupChoices(t) {
  return CARE_ACTIVITY_GROUPS.map((value) => ({ value, label: groupLabel(t, value) }));
}

/** Vorm on valmis, kui nimi ei ole tühi. */
export function activityReady(name) {
  return Boolean(String(name || "").trim());
}
