/**
 * Kriisinimekirja reeglid ilma joonistamiseta: mis seisab esimese vaate, arvude ja
 * kliendi real.
 *
 * Kriisinimekiri hooldusjuhile (K5-b): kelle juurde peab kriisis jõudma iga päev,
 * kelle juurde kord või kaks nädalas ja kes saab varudega ise hakkama. Iga rühma
 * juures on klientide arv ja nädala plaanitud käiguaeg. Nimekirja saab tabelifailina
 * alla laadida ja välja printida, sest kriisis ei pruugi rakendus töötada. Faili
 * allalaadimine on konksus ./useCrisisSheet.js, vaated on ühised
 * (../client/PartViews.jsx), kokku paneb need ./CrisisList.jsx.
 */

import { minutesLabel } from "../decision/decisionRows";
import { clientHref } from "../homeCareClient";

/** Mitu rida on loendis vaates enne nuppu „Näita veel". */
export const CRISIS_PAGE = 4;

/** Esimene vaade: arvud riskianalüüsi jaoks (kui on), kolm rühma ja hindamata kliendid. */
export function crisisMainRows(t, list) {
  return [
    list.figures && list.clientCount ? { key: "figures", title: t("home_care.crisis.figures.title") } : null,
    ...list.groups.map((group) => ({
      key: group.level,
      title: `${t(`home_care.crisis.levels.${group.level}`)}${group.clients.length ? ` · ${group.clients.length}` : ""}`,
      line: group.clients.length ? "" : t("home_care.crisis.group_empty")
    })),
    {
      key: "unset",
      title: `${t("home_care.crisis.unset_title")}${list.unset.length ? ` · ${list.unset.length}` : ""}`,
      line: list.unset.length ? "" : t("home_care.crisis.unset_empty"),
      tone: list.unset.length ? "risk" : ""
    }
  ].filter(Boolean);
}

/** Rühma nädala plaanitud käiguaeg ühe lausena. */
export function groupTimeLine(t, group) {
  return t("home_care.crisis.group_time", { time: minutesLabel(t, group.weeklyMinutes) });
}

/** Arvud omavalitsuse riskianalüüsi jaoks (K6-j): laused `[{ key, text }]`; samad arvud on ka tabelifaili lõpus. */
export function figureNotices(t, list) {
  const figures = list.figures;
  const depends = Object.entries(figures.dependencies)
    .filter(([, count]) => count)
    .map(([code, count]) => `${t(`home_care.crisis.dependencies.${code}`)} ${count}`)
    .join(", ");
  return [
    {
      key: "clients",
      text: t("home_care.crisis.figures.clients_line", {
        clients: figures.clients,
        daily: figures.byLevel.DAILY || 0,
        weekly: figures.byLevel.WEEKLY || 0,
        self: figures.byLevel.SELF || 0,
        unset: figures.unset
      })
    },
    depends ? { key: "depends", text: `${t("home_care.crisis.figures.depends_label")}: ${depends}` } : null,
    {
      key: "critical",
      text: figures.criticalWeeklyMinutes
        ? t("home_care.crisis.figures.critical_line", { clients: figures.criticalClients, time: minutesLabel(t, figures.criticalWeeklyMinutes), staff: figures.minStaff })
        : t("home_care.crisis.figures.critical_none")
    },
    figures.workers !== null && figures.workers !== undefined ? { key: "workers", text: t("home_care.crisis.figures.workers_line", { count: figures.workers }) } : null,
    figures.vehicles ? { key: "vehicles", text: t("home_care.crisis.figures.vehicles_line", { own: figures.vehicles.ownDrivers, org: figures.vehicles.orgPlates }) } : null
  ].filter(Boolean);
}

/** Kliendi rida: aadress, telefon, mille külge ta on seotud, abistaja, märkus ja nädala käiguaeg. */
export function crisisClientLine(t, item) {
  return [
    item.address,
    item.phone,
    item.crisis?.dependencies?.length ? t("home_care.crisis.depends_on", { list: item.crisis.dependencies.map((code) => t(`home_care.crisis.dependencies.${code}`)).join(", ") }) : null,
    item.crisis?.helper ? t("home_care.crisis.helper_line", { name: item.crisis.helper }) : null,
    item.crisis?.note,
    item.weeklyMinutes ? t("home_care.crisis.weekly", { time: minutesLabel(t, item.weeklyMinutes) }) : t("home_care.crisis.no_visits")
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Kliendid link-ridadena kliendi lehele (lingid ei eellaadi): `[{ key, title, line, href }]`. */
export function crisisLinks(items, { t, organizationId }) {
  return items.map((item) => ({ key: item.client.id, title: item.client.displayName, line: crisisClientLine(t, item), href: clientHref(organizationId, item.client.id) }));
}
