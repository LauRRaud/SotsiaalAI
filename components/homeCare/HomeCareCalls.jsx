"use client";

import Link from "next/link";
import { useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import OrgHeader from "@/components/org/OrgHeader";
import { CARE_CALL_CALLERS, CARE_CALL_TOPICS } from "@/lib/homeCare/constants";

import HomeCareOutbox from "./HomeCareOutbox";
import { homeCareBase, useHomeCareApi } from "./homeCareClient";

/** `AAAA-KK` → `KK.AAAA`. Käsitsi, et server ja brauser annaksid sama kuju. */
function monthLabel(month) {
  const [year, number] = String(month || "").split("-");
  return year && number ? `${number}.${year}` : "";
}

/**
 * Kõnede loendur hooldusjuhile: millest ja kes helistab, kuu kaupa.
 *
 * Loendur näitab ARVE. Üksikud kõned on kliendi päevikus kõnemärkena; siin ei
 * ole ühtegi nime ega teksti. Võrdlus eelmise kuuga on iga rea juures.
 */
export default function HomeCareCalls({ context, initial }) {
  const { t } = useI18n();
  const { call, busy, error } = useHomeCareApi();
  const organizationId = context.organization.id;
  const timeZone = context.organization.timezone || "Europe/Tallinn";
  const [data, setData] = useState(initial);

  const load = async (month) => {
    if (!month) return;
    const result = await call(`${homeCareBase(organizationId)}/koned?kuu=${encodeURIComponent(month)}`, {
      fallbackKey: "home_care.errors.list_failed"
    });
    if (result.ok) setData(result.data);
  };

  const row = (label, count, before) => (
    <li key={label} className="hc-entry__meta">
      {t("home_care.calls.row", { label, count, before })}
    </li>
  );

  return (
    <section className="ow-shell hc-shell">
      <OrgHeader context={context} />
      <HomeCareOutbox ownerId={context.membership?.id || ""} timeZone={timeZone} />

      <div className="hc-head">
        <Link className="hc-back" href={`/org/${organizationId}/koduteenus`}>
          {t("home_care.client.back")}
        </Link>
        <h2 className="hc-title">{t("home_care.calls.title")}</h2>
        <p className="hc-sub">{t("home_care.calls.intro")}</p>
      </div>

      <section className="hc-section" aria-live="polite">
        <div className="hc-row hc-row--between">
          <button className="hc-btn hc-btn--quiet" type="button" onClick={() => load(data.previousMonth)} disabled={busy}>
            {t("home_care.calls.previous")}
          </button>
          <h3 className="hc-section-title">{monthLabel(data.month)}</h3>
          <button
            className="hc-btn hc-btn--quiet"
            type="button"
            onClick={() => load(data.nextMonth)}
            disabled={busy || !data.nextMonth}
          >
            {t("home_care.calls.next")}
          </button>
        </div>

        {error ? (
          <p className="hc-error" role="alert">
            {error}
          </p>
        ) : null}

        <p className="hc-sub">
          {t("home_care.calls.total", { count: data.counts.total, before: data.previous.total })}
        </p>
        {data.counts.total === 0 && data.previous.total === 0 ? (
          <p className="hc-hint">{t("home_care.calls.empty")}</p>
        ) : (
          <>
            <h4 className="hc-label">{t("home_care.calls.by_topic")}</h4>
            <ul className="hc-list hc-list--plain">
              {CARE_CALL_TOPICS.map((topic) =>
                row(t(`home_care.call.topics.${topic}`), data.counts.byTopic[topic], data.previous.byTopic[topic])
              )}
            </ul>
            <h4 className="hc-label">{t("home_care.calls.by_caller")}</h4>
            <ul className="hc-list hc-list--plain">
              {CARE_CALL_CALLERS.map((caller) =>
                row(t(`home_care.call.callers.${caller}`), data.counts.byCaller[caller], data.previous.byCaller[caller])
              )}
            </ul>
          </>
        )}
        <p className="hc-hint">{t("home_care.calls.how")}</p>
      </section>
    </section>
  );
}
