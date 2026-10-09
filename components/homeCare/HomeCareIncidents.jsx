"use client";

import Link from "next/link";
import { useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import OrgHeader from "@/components/org/OrgHeader";
import DateField from "@/components/ui/DateField";
import Dropdown from "@/components/ui/Dropdown";
import { CARE_INCIDENT_TYPES, CareIncidentFilter } from "@/lib/homeCare/constants";

import HomeCareEntryItem from "./HomeCareEntryItem";
import { homeCareBase, useHomeCareApi } from "./homeCareClient";

const EMPTY_PAGE = Object.freeze({ items: [], hasMore: false, nextCursor: null, counts: { OPEN: 0, IN_REVIEW: 0, CLOSED: 0 } });

/**
 * Erijuhtumite register hooldusjuhile: lahtised ees, suletud ja kõik eraldi
 * vaates, filter liigi ja ajavahemiku järgi. Kaebused ja tänud on samas
 * registris oma liigina.
 *
 * Seisu muutmine, vastutaja ja täiendused käivad siinsamas real; kirje teksti
 * parandamine käib kliendi lehel, kus on olemas kaart ja meeskond.
 *
 * Pärast iga muudatust laaditakse nähtav leht uuesti: seis otsustab, millisesse
 * vaatesse juhtum kuulub, ja loendurid peavad jääma õigeks.
 */
export default function HomeCareIncidents({ context, initial, focused: initialFocused }) {
  const { t } = useI18n();
  const { call, busy, error } = useHomeCareApi();
  const organizationId = context.organization.id;
  const timeZone = context.organization.timezone || "Europe/Tallinn";
  const canWrite = Boolean(context.writable);

  const [page, setPage] = useState(initial || EMPTY_PAGE);
  const [focused, setFocused] = useState(initialFocused || null);
  const [status, setStatus] = useState(initial?.filter || CareIncidentFilter.ACTIVE);
  const [draft, setDraft] = useState({ type: "", from: "", to: "" });
  const [applied, setApplied] = useState({ type: "", from: "", to: "" });

  const url = (nextStatus, query, cursor, take) => {
    const params = new URLSearchParams({ status: nextStatus });
    if (query.type) params.set("type", query.type);
    if (query.from) params.set("from", query.from);
    if (query.to) params.set("to", query.to);
    if (cursor) params.set("cursor", cursor);
    if (take) params.set("take", String(take));
    return `${homeCareBase(organizationId)}/erijuhtumid?${params.toString()}`;
  };

  const load = async (nextStatus, query, take) => {
    const result = await call(url(nextStatus, query, null, take), { fallbackKey: "home_care.errors.list_failed" });
    if (!result.ok) return;
    setPage(result.data.incidents);
    setStatus(nextStatus);
    setApplied(query);
    setDraft(query);
  };

  const loadMore = async () => {
    if (!page.nextCursor) return;
    const result = await call(url(status, applied, page.nextCursor), { fallbackKey: "home_care.errors.list_failed" });
    if (!result.ok) return;
    setPage((current) => {
      const known = new Set(current.items.map((item) => item.id));
      return {
        ...result.data.incidents,
        items: [...current.items, ...result.data.incidents.items.filter((item) => !known.has(item.id))]
      };
    });
  };

  /* Pärast muudatust laaditakse uuesti NII PALJU RIDU, kui parajasti näha on
     (server piirab saja reaga): „näita vanemaid" kaudu avatud read ja lahtine
     käik ei tohi muudatuse järel eest kaduda. */
  const onChange = (entry) => {
    setFocused((current) => (current && current.id === entry.id ? { ...current, ...entry, client: current.client } : current));
    load(status, applied, Math.max(page.items.length, 1));
  };

  const counts = page.counts || EMPTY_PAGE.counts;
  const tabs = [
    { key: CareIncidentFilter.ACTIVE, label: t("home_care.incidents.tab_active", { count: counts.OPEN + counts.IN_REVIEW }) },
    { key: CareIncidentFilter.CLOSED, label: t("home_care.incidents.tab_closed", { count: counts.CLOSED }) },
    { key: CareIncidentFilter.ALL, label: t("home_care.incidents.tab_all") }
  ];
  const filterActive = Boolean(applied.type || applied.from || applied.to);
  /* Teavitusest avatud juhtum on üleval eraldi; loendis teda teist korda ei näidata. */
  const listed = focused ? page.items.filter((item) => item.id !== focused.id) : page.items;
  const renderItem = (entry) => (
    <HomeCareEntryItem
      key={entry.id}
      organizationId={organizationId}
      entry={entry}
      timeZone={timeZone}
      canWrite={canWrite}
      isCoordinator
      showClient
      onChange={onChange}
    />
  );

  return (
    <section className="ow-shell hc-shell">
      <OrgHeader context={context} />

      <div className="hc-head">
        <Link className="hc-back" href={`/org/${organizationId}/koduteenus`}>
          {t("home_care.incidents.back")}
        </Link>
        <h2 className="hc-title">{t("home_care.incidents.title")}</h2>
        <p className="hc-sub">{t("home_care.incidents.intro")}</p>
      </div>

      {focused ? (
        <section className="hc-section hc-section--card">
          <h3 className="hc-section-title">{t("home_care.incidents.focused")}</h3>
          <ul className="hc-list hc-list--plain">{renderItem(focused)}</ul>
        </section>
      ) : null}

      <section className="hc-section">
        <div className="hc-chips" role="group" aria-label={t("home_care.incidents.title")}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className="hc-chip"
              aria-pressed={status === tab.key}
              onClick={() => load(tab.key, applied)}
              disabled={busy}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form
          className="hc-filter"
          onSubmit={(event) => {
            event.preventDefault();
            load(status, draft);
          }}
        >
          <div className="hc-field">
            <span className="hc-label">{t("home_care.incident.type_label")}</span>
            <Dropdown
              value={draft.type}
              onChange={(value) => setDraft((current) => ({ ...current, type: value }))}
              ariaLabel={t("home_care.incident.type_label")}
              options={[
                { value: "", label: t("home_care.incidents.type_all") },
                ...CARE_INCIDENT_TYPES.map((value) => ({ value, label: t(`home_care.incident.types.${value}`) }))
              ]}
            />
          </div>
          <div className="hc-field">
            <span className="hc-label">{t("home_care.filter.from")}</span>
            <DateField
              name="from"
              value={draft.from}
              onChange={(value) => setDraft((current) => ({ ...current, from: value || "" }))}
              ariaLabel={t("home_care.filter.from")}
            />
          </div>
          <div className="hc-field">
            <span className="hc-label">{t("home_care.filter.to")}</span>
            <DateField
              name="to"
              value={draft.to}
              onChange={(value) => setDraft((current) => ({ ...current, to: value || "" }))}
              ariaLabel={t("home_care.filter.to")}
            />
          </div>
          <div className="hc-row">
            <button className="hc-btn" type="submit" disabled={busy}>
              {t("home_care.filter.apply")}
            </button>
            {filterActive ? (
              <button
                className="hc-btn hc-btn--quiet"
                type="button"
                onClick={() => load(status, { type: "", from: "", to: "" })}
                disabled={busy}
              >
                {t("home_care.filter.clear")}
              </button>
            ) : null}
          </div>
        </form>

        {error ? (
          <p className="hc-error" role="alert">
            {error}
          </p>
        ) : null}

        {listed.length === 0 ? (
          <p className="hc-sub">{focused ? t("home_care.incidents.empty_other") : t("home_care.incidents.empty")}</p>
        ) : (
          <ul className="hc-list hc-list--plain">{listed.map(renderItem)}</ul>
        )}
        {page.hasMore ? (
          <div className="hc-row">
            <button className="hc-btn" type="button" onClick={loadMore} disabled={busy}>
              {t("home_care.filter.more")}
            </button>
          </div>
        ) : null}
      </section>
    </section>
  );
}
