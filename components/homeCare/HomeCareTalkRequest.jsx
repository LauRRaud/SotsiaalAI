"use client";

import Link from "next/link";
import { useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { formatDateTime, homeCareBase, useHomeCareApi } from "./homeCareClient";

/**
 * „Soovin sellest rääkida" (K6-k) raske erijuhtumi juures. Autor annab ühe puudutusega teada,
 * et soovib juhtumist rääkida; teksti ei küsita. Soovi näevad ainult tema ise ja hooldusjuht.
 * Hooldusjuht märgib, et rääkimine on toimunud; mida räägiti, ei kirjutata.
 */
export default function HomeCareTalkRequest({ organizationId, clientId, entryId, initial = null, canAsk = false, canHandle = false, timeZone }) {
  const { t } = useI18n();
  const { call, busy, error } = useHomeCareApi();
  const [talk, setTalk] = useState(initial);

  const entryBase = `${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(clientId)}/kirjed/${encodeURIComponent(entryId)}/raagime`;
  const run = async (url, method) => {
    const result = await call(url, { method, fallbackKey: "home_care.errors.save_failed" });
    if (result.ok) setTalk(result.data.talk || null);
  };

  if (!talk && !canAsk) return null;

  return (
    <div className="hc-field">
      {!talk ? (
        <>
          <div className="hc-row">
            <button className="hc-btn hc-btn--quiet" type="button" onClick={() => run(entryBase, "POST")} disabled={busy}>
              {t("home_care.talk.ask")}
            </button>
          </div>
          <p className="hc-hint">
            {t("home_care.talk.ask_hint")}{" "}
            <Link href="/kovisioon" prefetch={false}>
              {t("home_care.talk.covision_link")}
            </Link>
          </p>
        </>
      ) : talk.state === "HANDLED" ? (
        <p className="hc-entry__meta">{t("home_care.talk.handled_line", { date: formatDateTime(talk.handledAt, timeZone), name: talk.handledByName || "—" })}</p>
      ) : talk.mine ? (
        <>
          <p className="hc-notice">{t("home_care.talk.sent_line", { date: formatDateTime(talk.requestedAt, timeZone) })}</p>
          <div className="hc-row">
            <button className="hc-btn hc-btn--quiet" type="button" onClick={() => run(entryBase, "DELETE")} disabled={busy}>
              {t("home_care.talk.withdraw")}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="hc-notice hc-notice--warn">
            {t("home_care.talk.wants_line", { name: talk.requesterName || "—", date: formatDateTime(talk.requestedAt, timeZone) })}
          </p>
          {canHandle ? (
            <div className="hc-row">
              <button
                className="hc-btn hc-btn--quiet"
                type="button"
                onClick={() => run(`${homeCareBase(organizationId)}/raagime/${encodeURIComponent(talk.id)}`, "PATCH")}
                disabled={busy}
              >
                {t("home_care.talk.handled")}
              </button>
            </div>
          ) : null}
        </>
      )}
      {error ? (
        <p className="hc-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
