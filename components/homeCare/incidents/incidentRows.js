/**
 * Erijuhtumite registri reeglid ilma joonistamiseta: millised vaated registris on,
 * mis seisab seisu- ja filtrireal ning mis loendisse kuulub.
 *
 * Erijuhtumite register hooldusjuhile: lahtised ees, suletud ja kõik eraldi
 * vaates, filter liigi ja ajavahemiku järgi. Kaebused ja tänud on samas registris
 * oma liigina. Seisu muutmine, vastutaja ja täiendused käivad avatud kirje vaates;
 * kirje teksti parandamine käib kliendi lehel, kus on olemas kaart ja meeskond.
 * Olek ja päringud on konksus ./useIncidents.js, vaated on ühised
 * (../client/PartViews.jsx) ja avatud kirje (../diary/EntryOpen.jsx), kokku paneb
 * need ./Incidents.jsx.
 */

import { CARE_INCIDENT_TYPES, CareIncidentFilter } from "@/lib/homeCare/constants";

import { clientEntryRows } from "../overview/overviewRows";
import { formatDay } from "../releases/releaseRows";

/** Mitu rida lisandub loendisse nupust „Näita veel". */
export const INCIDENTS_PAGE = 4;

export const EMPTY_PAGE = Object.freeze({ items: [], hasMore: false, nextCursor: null, counts: { OPEN: 0, IN_REVIEW: 0, CLOSED: 0 } });

/** Tühi filter. */
export const EMPTY_FILTER = Object.freeze({ type: "", from: "", to: "" });

/** Filter on peal. */
export function filterActive(applied) {
  return Boolean(applied.type || applied.from || applied.to);
}

/** Seisu vaated: `[{ key, label }]`; lahtiste ja suletute arv on sildil. */
export function statusTabs(t, counts) {
  return [
    { key: CareIncidentFilter.ACTIVE, label: t("home_care.incidents.tab_active", { count: counts.OPEN + counts.IN_REVIEW }) },
    { key: CareIncidentFilter.CLOSED, label: t("home_care.incidents.tab_closed", { count: counts.CLOSED }) },
    { key: CareIncidentFilter.ALL, label: t("home_care.incidents.tab_all") }
  ];
}

/** Filter ühe lausena (liik, alates, kuni) või tühi. */
export function filterSummary(t, applied) {
  return [
    applied.type ? t(`home_care.incident.types.${applied.type}`) : "",
    applied.from ? `${t("home_care.filter.from")} ${formatDay(applied.from)}` : "",
    applied.to ? `${t("home_care.filter.to")} ${formatDay(applied.to)}` : ""
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Registri esimene vaade: teavitusest avatud juhtum (kui on), seisu vaated ja filter. */
export function incidentMainRows(t, { counts, focused, applied }) {
  const tabs = statusTabs(t, counts);
  return [
    focused ? { key: "focused", title: t("home_care.incidents.focused"), line: focused.client?.displayName || "" } : null,
    ...tabs.map((tab) => ({ key: tab.key, title: tab.label, tone: tab.key === CareIncidentFilter.ACTIVE && counts.OPEN + counts.IN_REVIEW > 0 ? "risk" : "" })),
    { key: "filter", title: t("home_care.incidents.filter_title"), line: filterSummary(t, applied) || t("home_care.incidents.filter_none") }
  ].filter(Boolean);
}

/** Loendi rida: kliendi nimi, aeg ja autor, teksti algus ning märgid (liik, erijuhtumi seis). Teavitusest avatud juhtumit loendis teist korda ei näidata. */
export function incidentListRows(items, focused, { t, moment }) {
  const listed = focused ? items.filter((item) => item.id !== focused.id) : items;
  return clientEntryRows(listed, { t, moment, today: "" });
}

/** Liigid valikuna (esimene on „kõik liigid"): `[{ value, label }]`. */
export function typeChoices(t) {
  return [{ value: "", label: t("home_care.incidents.type_all") }, ...CARE_INCIDENT_TYPES.map((value) => ({ value, label: t(`home_care.incident.types.${value}`) }))];
}

/** Muudetud kirje sama juhtumi kohal: kliendi nimi jääb. */
export function mergeEntry(current, entry) {
  return current && current.id === entry.id ? { ...current, ...entry, client: current.client } : current;
}
