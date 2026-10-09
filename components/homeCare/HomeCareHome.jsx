"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import OrgHeader from "@/components/org/OrgHeader";

import HomeCareClientForm from "./HomeCareClientForm";
import { minutesLabel } from "./HomeCareDecisionView";
import HomeCareOutbox from "./HomeCareOutbox";
import { clientHref, homeCareBase, useHomeCareApi } from "./homeCareClient";

/**
 * Koduteenuse avaleht: minu kliendid (hooldaja) või kõik kliendid (hooldusjuht).
 *
 * LINGID KLIENDI LEHELE ON `prefetch={false}`. Kliendi lehe avamine jätab
 * avamislogisse rea; ette laadimine kirjutaks sinna avamisi, mida inimene ei
 * teinud.
 *
 * OTSING näitab ainult nime ja seisu. Meeskonnast väljas oleva kliendi leht
 * küsib avamisel põhjust (asendaja tee).
 */
export default function HomeCareHome({ context, initial, unitOptions, myDay = null }) {
  const { t } = useI18n();
  const router = useRouter();
  const organizationId = context.organization.id;
  const list = useHomeCareApi();
  const search = useHomeCareApi();
  const searchId = useId();

  const isCoordinator = Boolean(initial?.isCoordinator);
  const canSearch = Boolean(initial?.canSearch);
  const [clients, setClients] = useState(initial?.clients || []);
  const [showEnded, setShowEnded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);

  const loadClients = async (ended) => {
    const url = `${homeCareBase(organizationId)}/kliendid${ended ? "?status=ENDED" : ""}`;
    const result = await list.call(url, { fallbackKey: "home_care.errors.list_failed" });
    if (result.ok) {
      setClients(result.data.clients || []);
      setShowEnded(ended);
    }
  };

  const runSearch = async (event) => {
    event.preventDefault();
    const result = await search.call(`${homeCareBase(organizationId)}/kliendid/otsing`, {
      method: "POST",
      body: { q: query },
      fallbackKey: "home_care.errors.search_failed"
    });
    setResults(result.ok ? result.data.clients || [] : null);
  };

  return (
    <section className="ow-shell hc-shell">
      <OrgHeader context={context} />

      <div className="hc-head">
        <h2 className="hc-title">{t("home_care.home.title")}</h2>
        <p className="hc-sub">
          {isCoordinator ? t("home_care.home.intro_coordinator") : t("home_care.home.intro_worker")}
        </p>
      </div>

      <HomeCareOutbox
        ownerId={context.membership?.id || ""}
        timeZone={context.organization.timezone || "Europe/Tallinn"}
      />

      {/* Tänane päev (K3-a): sulle määratud tänased käigud kellaaja järjekorras. */}
      {myDay?.visits?.length ? (
        <div className="hc-section">
          <h3 className="hc-section-title">{t("home_care.slots.today_title")}</h3>
          <ul className="hc-list">
            {myDay.visits.map((visit) => (
              <li key={visit.slotId}>
                <Link className="hc-client" href={clientHref(organizationId, visit.client.id)} prefetch={false}>
                  <span className="hc-client__name">
                    {visit.startTime} {visit.client.displayName}
                    {visit.done ? (
                      <>
                        {" "}
                        <span className="hc-badge">{t("home_care.slots.done_badge")}</span>
                      </>
                    ) : null}
                  </span>
                  <span className="hc-client__meta">
                    {[minutesLabel(t, visit.plannedMinutes), visit.client.address, visit.note].filter(Boolean).join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {isCoordinator ? (
        <div className="hc-row">
          <Link className="hc-btn hc-btn--link" href={`/org/${organizationId}/koduteenus/ulevaade`}>
            {t("home_care.home.overview_link")}
          </Link>
          <Link className="hc-btn hc-btn--link" href={`/org/${organizationId}/koduteenus/erijuhtumid`}>
            {t("home_care.incidents.link")}
          </Link>
          <Link className="hc-btn hc-btn--link" href={`/org/${organizationId}/koduteenus/tahtajad`}>
            {t("home_care.deadlines.link")}
          </Link>
          <Link className="hc-btn hc-btn--link" href={`/org/${organizationId}/koduteenus/kuu`}>
            {t("home_care.month.link")}
          </Link>
          <Link className="hc-btn hc-btn--link" href={`/org/${organizationId}/koduteenus/valjastused`}>
            {t("home_care.releases.link")}
          </Link>
          <Link className="hc-btn hc-btn--link" href={`/org/${organizationId}/koduteenus/koned`}>
            {t("home_care.calls.link")}
          </Link>
          <Link className="hc-btn hc-btn--link" href={`/org/${organizationId}/koduteenus/toimingud`}>
            {t("home_care.activities.link")}
          </Link>
          {initial?.canExport ? (
            <Link className="hc-btn hc-btn--link" href={`/org/${organizationId}/koduteenus/valjavote`}>
              {t("home_care.export.link")}
            </Link>
          ) : null}
          {context.writable ? (
            <Link className="hc-btn hc-btn--link" href={`/org/${organizationId}/koduteenus/sissetoomine`}>
              {t("home_care.import.link")}
            </Link>
          ) : null}
          {context.writable && !adding ? (
            <button className="hc-btn hc-btn--primary" type="button" onClick={() => setAdding(true)}>
              {t("home_care.home.add_client")}
            </button>
          ) : null}
        </div>
      ) : null}

      {adding ? (
        <div className="hc-section">
          <h3 className="hc-section-title">{t("home_care.client.create_title")}</h3>
          <HomeCareClientForm
            organizationId={organizationId}
            unitOptions={unitOptions}
            onCancel={() => setAdding(false)}
            onSaved={(client) => {
              setAdding(false);
              router.push(clientHref(organizationId, client.id));
            }}
          />
        </div>
      ) : null}

      {canSearch ? (
        <div className="hc-section">
          <form className="hc-form" onSubmit={runSearch} role="search">
            <div className="hc-field">
              <label className="hc-label" htmlFor={searchId}>
                {t("home_care.home.search_label")}
              </label>
              <div className="hc-row hc-row--search">
                <input
                  id={searchId}
                  className="hc-input"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  minLength={2}
                  maxLength={80}
                  autoComplete="off"
                  enterKeyHint="search"
                />
                <button className="hc-btn" type="submit" disabled={search.busy || query.trim().length < 2}>
                  {t("home_care.home.search_button")}
                </button>
              </div>
            </div>
          </form>
          <p className="hc-hint">{t("home_care.home.search_hint")}</p>
          {isCoordinator ? <p className="hc-hint">{t("home_care.home.search_phone_hint")}</p> : null}
          {search.error ? (
            <p className="hc-error" role="alert">
              {search.error}
            </p>
          ) : null}
          {results ? (
            results.length === 0 ? (
              <p className="hc-sub" role="status">
                {t("home_care.home.search_empty")}
              </p>
            ) : (
              <ul className="hc-list" aria-live="polite">
                {results.map((client) => (
                  <li key={client.id}>
                    <Link className="hc-client" href={clientHref(organizationId, client.id)} prefetch={false}>
                      <span className="hc-client__name">{client.displayName}</span>
                      <span className="hc-client__meta">
                        {client.status !== "ACTIVE" ? `${t(`home_care.status.${client.status}`)} · ` : ""}
                        {client.matchedPhone
                          ? t("home_care.home.matched_phone")
                          : client.needsReason
                            ? t("home_care.home.needs_reason")
                            : t("home_care.client.basis.TEAM")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </div>
      ) : null}

      <div className="hc-section">
        <div className="hc-row hc-row--between">
          <h3 className="hc-section-title">
            {isCoordinator ? t("home_care.home.all_clients") : t("home_care.home.my_clients")}
            {showEnded ? ` · ${t("home_care.status.ENDED")}` : ""}
          </h3>
          {isCoordinator ? (
            <button
              className="hc-btn hc-btn--quiet"
              type="button"
              onClick={() => loadClients(!showEnded)}
              disabled={list.busy}
            >
              {showEnded ? t("home_care.home.show_active") : t("home_care.home.show_ended")}
            </button>
          ) : null}
        </div>
        {list.error ? (
          <p className="hc-error" role="alert">
            {list.error}
          </p>
        ) : null}
        {clients.length === 0 ? (
          <p className="hc-sub">
            {showEnded
              ? t("home_care.home.empty_ended")
              : isCoordinator
                ? t("home_care.home.empty_coordinator")
                : t("home_care.home.empty_worker")}
          </p>
        ) : (
          <ul className="hc-list">
            {clients.map((client) => (
              <li key={client.id}>
                <Link className="hc-client" href={clientHref(organizationId, client.id)} prefetch={false}>
                  <span className="hc-client__name">
                    {client.displayName}
                    {client.status === "AWAY" ? (
                      <>
                        {" "}
                        <span className="hc-badge hc-badge--warn">{t("home_care.status.AWAY")}</span>
                      </>
                    ) : null}
                  </span>
                  {client.address || client.statusNote || client.statusReason ? (
                    <span className="hc-client__meta">
                      {[
                        client.address,
                        client.status !== "ACTIVE" && client.statusReason
                          ? t(`home_care.status_reason.${client.status}.${client.statusReason}`)
                          : null,
                        client.status !== "ACTIVE" ? client.statusNote : null
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
