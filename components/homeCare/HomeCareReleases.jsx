"use client";

import Link from "next/link";
import { useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import OrgHeader from "@/components/org/OrgHeader";

import { clientHref, formatDateTime, homeCareBase, useHomeCareApi } from "./homeCareClient";

/** AAAA-KK-PP → PP.KK.AAAA. */
function formatDay(isoDay) {
  const parts = String(isoDay || "").split("-");
  return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : String(isoDay || "");
}

/**
 * Väljastuste tööloend hooldusjuhile: mis kronoloogia, kellele, mis alusel ja
 * kes koostas. Loend EI näita dokumendi sisu; sisu avaneb dokumendist endast.
 * Ametlik register on asutuse dokumendihaldus, see loend on tööloend.
 */
export default function HomeCareReleases({ context, initial }) {
  const { t } = useI18n();
  const { call, busy, error } = useHomeCareApi();
  const organizationId = context.organization.id;
  const timeZone = context.organization.timezone || "Europe/Tallinn";
  const [page, setPage] = useState(initial || { items: [], hasMore: false, nextCursor: null });

  const loadMore = async () => {
    if (!page.nextCursor) return;
    const result = await call(
      `${homeCareBase(organizationId)}/valjastused?cursor=${encodeURIComponent(page.nextCursor)}`,
      { fallbackKey: "home_care.errors.list_failed" }
    );
    if (!result.ok) return;
    setPage((current) => {
      const known = new Set(current.items.map((item) => item.id));
      return {
        ...result.data.releases,
        items: [...current.items, ...result.data.releases.items.filter((item) => !known.has(item.id))]
      };
    });
  };

  return (
    <section className="ow-shell hc-shell">
      <OrgHeader context={context} />

      <div className="hc-head">
        <Link className="hc-back" href={`/org/${organizationId}/koduteenus`}>
          {t("home_care.releases.back")}
        </Link>
        <h2 className="hc-title">{t("home_care.releases.title")}</h2>
        <p className="hc-sub">{t("home_care.releases.intro")}</p>
      </div>

      <section className="hc-section">
        {page.items.length === 0 ? (
          <p className="hc-sub">{t("home_care.releases.empty")}</p>
        ) : (
          <ul className="hc-list hc-list--plain">
            {page.items.map((release) => (
              <li key={release.id} className="hc-entry">
                <div className="hc-entry__head">
                  <Link className="hc-entry__link" href={clientHref(organizationId, release.clientId)} prefetch={false}>
                    {release.clientName}
                  </Link>
                  <time className="hc-entry__time" dateTime={release.createdAt}>
                    {formatDateTime(release.createdAt, timeZone)}
                  </time>
                </div>
                <p className="hc-entry__meta">
                  {t("home_care.releases.period", {
                    from: formatDay(release.periodFromDay),
                    to: formatDay(release.periodToDay)
                  })}
                  {" · "}
                  {t("home_care.releases.entries", { count: release.entryCount })}
                  {" · "}
                  {t("home_care.releases.compiled", { name: release.createdByName })}
                </p>
                <p className="hc-entry__meta">{t("home_care.releases.requester", { value: release.requester })}</p>
                <p className="hc-entry__meta">{t("home_care.releases.basis", { value: release.basis })}</p>
                {release.registryRef ? (
                  <p className="hc-entry__meta">{t("home_care.releases.registry_ref", { value: release.registryRef })}</p>
                ) : null}
                <p className="hc-entry__meta">{t("home_care.releases.hash", { value: release.contentSha256 })}</p>
                <div className="hc-row">
                  <a
                    className="hc-btn hc-btn--quiet hc-btn--link"
                    href={`${homeCareBase(organizationId)}/valjastused/${release.id}/dokument`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("home_care.chronology.open_document")}
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
        {error ? (
          <p className="hc-error" role="alert">
            {error}
          </p>
        ) : null}
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
