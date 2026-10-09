"use client";

import Link from "next/link";
import { useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import OrgHeader from "@/components/org/OrgHeader";
import { CareIncidentStatus } from "@/lib/homeCare/constants";

import HomeCareEntryItem from "./HomeCareEntryItem";

/**
 * Hooldusjuhi ülevaade: kolm küsimust, millele juht hommikul vastust vajab.
 *   1. Millised erijuhtumid on lahtised?
 *   2. Millised teated järgmisele ei ole ühegi hooldajani jõudnud?
 *   3. Mida on kirjutatud pärast eilset?
 *
 * Järjekord on tegutsemise järjekord: lahtine erijuhtum enne lugemata teadet
 * ja see enne tavalist kirjete voogu. Kirje parandamine käib kliendi lehel.
 */
export default function HomeCareOverview({ context, overview }) {
  const { t } = useI18n();
  const organizationId = context.organization.id;
  const timeZone = context.organization.timezone || "Europe/Tallinn";
  const canWrite = Boolean(context.writable);

  const [openIncidents, setOpenIncidents] = useState(overview?.openIncidents || []);
  const [recent, setRecent] = useState(overview?.recent || []);
  const unreadHandovers = overview?.unreadHandovers || [];

  /* Seisu muutus peab kajastuma mõlemas loendis: sama erijuhtum võib olla nii
     lahtiste kui ka eilsest saadik kirjutatute seas. */
  const onIncidentChange = (entry) => {
    const merge = (item) => (item.id === entry.id ? { ...item, ...entry, client: item.client } : item);
    const isOpen = entry.incident && !entry.retractedAt && entry.incident.status !== CareIncidentStatus.CLOSED;
    setOpenIncidents((current) => {
      const next = current.map(merge).filter((item) => item.incident?.status !== CareIncidentStatus.CLOSED);
      /* Uuesti avatud juhtum tuleb lahtiste hulka tagasi: klient võetakse reast,
         kust nuppu vajutati (kirjed pärast eilset). */
      if (isOpen && !next.some((item) => item.id === entry.id)) {
        const source = recent.find((item) => item.id === entry.id);
        if (source) {
          next.push({ ...source, ...entry, client: source.client });
          next.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0));
        }
      }
      return next;
    });
    setRecent((current) => current.map(merge));
  };

  const renderList = (items, emptyKey) =>
    items.length === 0 ? (
      <p className="hc-sub">{t(emptyKey)}</p>
    ) : (
      <ul className="hc-list hc-list--plain">
        {items.map((entry) => (
          <HomeCareEntryItem
            key={entry.id}
            organizationId={organizationId}
            entry={entry}
            timeZone={timeZone}
            canWrite={canWrite}
            isCoordinator
            showClient
            onChange={onIncidentChange}
          />
        ))}
      </ul>
    );

  return (
    <section className="ow-shell hc-shell">
      <OrgHeader context={context} />

      <div className="hc-head">
        <Link className="hc-back" href={`/org/${organizationId}/koduteenus`}>
          {t("home_care.overview.back")}
        </Link>
        <h2 className="hc-title">{t("home_care.overview.title")}</h2>
      </div>

      <section className="hc-section">
        <h3 className="hc-section-title">
          {t("home_care.overview.incidents_title")} ({openIncidents.length})
        </h3>
        {renderList(openIncidents, "home_care.overview.incidents_empty")}
      </section>

      <section className="hc-section">
        <h3 className="hc-section-title">
          {t("home_care.overview.unread_title")} ({unreadHandovers.length})
        </h3>
        <p className="hc-hint">{t("home_care.overview.unread_hint")}</p>
        {renderList(unreadHandovers, "home_care.overview.unread_empty")}
      </section>

      <section className="hc-section">
        <h3 className="hc-section-title">
          {t("home_care.overview.recent_title")} ({recent.length})
        </h3>
        {renderList(recent, "home_care.overview.recent_empty")}
        {overview?.recentHasMore ? <p className="hc-hint">{t("home_care.overview.recent_more")}</p> : null}
      </section>
    </section>
  );
}
