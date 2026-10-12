"use client";

import { useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { RowsView } from "../client/PartViews";
import { useScreenFocus } from "../client/useScreenFocus";
import EntryOpen from "../diary/EntryOpen";
import { formatDateTime } from "../homeCareClient";
import SubPage from "../page/SubPage";
import { ENTRIES_PAGE, clientEntryRows, mergeIncident, overviewRows } from "./overviewRows";

/**
 * Hooldusjuhi ülevaate leht: ees on üks vaade korraga: kolm loendit (lahtised
 * erijuhtumid, lugemata teated järgmisele, kirjed pärast eilset), üks loend
 * ridadena või üks avatud kirje (erijuhtumi seis, vastutaja ja täiendused käivad
 * seal; kirje parandamine käib kliendi lehel).
 *
 * Seisu muutus kajastub kõigis loendites: sama erijuhtum võib olla nii lahtiste kui
 * ka eilsest saadik kirjutatute seas. Leht hoiab loendeid, nii et vaate vahetus ei
 * kaota midagi.
 *
 * `overview`: { openIncidents, unreadHandovers, recent, recentHasMore, today }.
 */
export default function Overview({ context, overview }) {
  const { t } = useI18n();
  const organizationId = context.organization.id;
  const timeZone = context.organization.timezone || "Europe/Tallinn";
  const canWrite = Boolean(context.writable);
  const [lists, setLists] = useState({ openIncidents: overview?.openIncidents || [], recent: overview?.recent || [] });
  const unread = overview?.unreadHandovers || [];
  /* "" (kolm loendit), "incidents", "unread", "recent" või "entry:<loend>:<id>". */
  const [screen, setScreen] = useState("");
  const [expanded, setExpanded] = useState({});
  const rootRef = useScreenFocus(screen);

  const onIncidentChange = (entry) => setLists((current) => mergeIncident(current, entry));
  const moment = (value) => formatDateTime(value, timeZone);
  const wrap = (view) => (
    <SubPage context={context} label={t("home_care.overview.title")} onDesk={screen ? () => setScreen("") : undefined} notice={screen === ""}>
      <div ref={rootRef}>{view}</div>
    </SubPage>
  );
  const sources = { incidents: lists.openIncidents, unread, recent: lists.recent };
  const [kind, from, id] = screen.split(":");

  /* --- Avatud kirje --- */
  const entry = kind === "entry" ? [...(sources[from] || []), ...lists.recent, ...lists.openIncidents, ...unread].find((item) => item.id === id) : null;
  if (entry) {
    return wrap(
      <EntryOpen
        organizationId={organizationId}
        entry={entry}
        timeZone={timeZone}
        canWrite={canWrite}
        isCoordinator
        showClient
        back={{ label: t("home_care.parts.back"), onBack: () => setScreen(from) }}
        onChange={onIncidentChange}
      />
    );
  }

  /* --- Üks loend --- */
  if (sources[screen]) {
    const rows = clientEntryRows(sources[screen], { t, moment, today: overview?.today || "" });
    const shown = expanded[screen] ? rows : rows.slice(0, ENTRIES_PAGE);
    const titles = { incidents: "home_care.overview.incidents_title", unread: "home_care.overview.unread_title", recent: "home_care.overview.recent_title" };
    return wrap(
      <RowsView
        title={t("home_care.overview.title")}
        question={`${t(titles[screen])} (${rows.length})`}
        lead={screen === "unread" ? t("home_care.overview.unread_hint") : ""}
        rows={shown}
        onOpen={(key) => setScreen(`entry:${screen}:${key}`)}
        empty={t(screen === "incidents" ? "home_care.overview.incidents_empty" : screen === "unread" ? "home_care.overview.unread_empty" : "home_care.overview.recent_empty")}
        hint={screen === "recent" && overview?.recentHasMore ? t("home_care.overview.recent_more") : ""}
        more={!expanded[screen] && rows.length > ENTRIES_PAGE ? { label: t("home_care.home.more"), onMore: () => setExpanded((now) => ({ ...now, [screen]: true })) } : null}
        back={{ label: t("home_care.parts.back"), onBack: () => setScreen("") }}
        mark={`overview-${screen}`}
      />
    );
  }

  /* --- Kolm loendit --- */
  return wrap(
    <RowsView
      title={t("home_care.overview.title")}
      question={t("home_care.overview.title")}
      rows={overviewRows({ openIncidents: lists.openIncidents, unread, recent: lists.recent }, { t })}
      onOpen={setScreen}
      links={[{ key: "incidents", title: t("home_care.incidents.link"), href: `/org/${organizationId}/koduteenus/erijuhtumid` }]}
      mark="overview"
    />
  );
}
