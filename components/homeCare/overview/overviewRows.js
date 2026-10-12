/**
 * Hooldusjuhi ülevaate reeglid ilma joonistamiseta: mis kirjed on kolmes loendis
 * ja kuidas seisu muutus neis kajastub.
 *
 * Kolm küsimust, millele juht hommikul vastust vajab: millised erijuhtumid on
 * lahtised, millised teated järgmisele ei ole ühegi hooldajani jõudnud ja mida on
 * kirjutatud pärast eilset. Järjekord on tegutsemise järjekord: lahtine erijuhtum
 * enne lugemata teadet ja see enne tavalist kirjete voogu. Kirje parandamine käib
 * kliendi lehel. Olek on lehel (./Overview.jsx), vaated on ühised
 * (../client/PartViews.jsx) ja avatud kirje (../diary/EntryOpen.jsx).
 */

import { CareIncidentStatus } from "@/lib/homeCare/constants";

import { diaryRows } from "../diary/diaryRows";

/** Mitu kirjet on loendis vaates enne nuppu „Näita veel". */
export const ENTRIES_PAGE = 4;

/**
 * Kirjed mitme kliendi loendi ridadena: `[{ key, title, chips, lines }]`. Real on kliendi nimi, aeg ja autor,
 * teksti algus ja märgid (liik, erijuhtumi seis). Sama kuju kasutab erijuhtumite leht.
 */
export function clientEntryRows(items, { t, moment, today }) {
  const rows = diaryRows(items, { t, moment, today });
  return (items || []).map((entry, index) => ({
    key: entry.id,
    title: entry.client?.displayName || "—",
    chips: rows[index].chips.map((chip) => ({ text: chip.text, tone: chip.wait ? "wait" : "" })),
    lines: [[rows[index].when, rows[index].who].filter(Boolean).join(" · "), rows[index].line.text].filter(Boolean)
  }));
}

/**
 * Seisu muutus peab kajastuma mõlemas loendis: sama erijuhtum võib olla nii lahtiste kui ka eilsest saadik
 * kirjutatute seas. Suletud juhtum läheb lahtiste seast välja; uuesti avatud juhtum tuleb lahtiste hulka tagasi
 * (klient võetakse reast, kust nuppu vajutati). Tagastab uued `{ openIncidents, recent }`.
 */
export function mergeIncident(state, entry) {
  const merge = (item) => (item.id === entry.id ? { ...item, ...entry, client: item.client } : item);
  const isOpen = entry.incident && !entry.retractedAt && entry.incident.status !== CareIncidentStatus.CLOSED;
  const next = state.openIncidents.map(merge).filter((item) => item.incident?.status !== CareIncidentStatus.CLOSED);
  if (isOpen && !next.some((item) => item.id === entry.id)) {
    const source = state.recent.find((item) => item.id === entry.id);
    if (source) {
      next.push({ ...source, ...entry, client: source.client });
      next.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0));
    }
  }
  return { openIncidents: next, recent: state.recent.map(merge) };
}

/** Kolm loendit esimese vaate ridadena: `[{ key, title, line, tone }]`; lahtised erijuhtumid on tugevama pealkirjaga. */
export function overviewRows({ openIncidents, unread, recent }, { t }) {
  return [
    { key: "incidents", title: `${t("home_care.overview.incidents_title")} (${openIncidents.length})`, line: openIncidents.length ? "" : t("home_care.overview.incidents_empty"), tone: openIncidents.length ? "risk" : "" },
    { key: "unread", title: `${t("home_care.overview.unread_title")} (${unread.length})`, line: unread.length ? "" : t("home_care.overview.unread_empty"), tone: unread.length ? "risk" : "" },
    { key: "recent", title: `${t("home_care.overview.recent_title")} (${recent.length})`, line: recent.length ? "" : t("home_care.overview.recent_empty") }
  ];
}
