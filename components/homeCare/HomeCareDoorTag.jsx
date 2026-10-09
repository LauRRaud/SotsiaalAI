"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { clientHref, formatDateTime, homeCareBase, useHomeCareApi } from "./homeCareClient";

/**
 * Uksesildi haldus hooldusjuhile.
 *
 * Silt on QR-kood kliendi ukse kõrval (seespool): hooldaja skannib selle ja
 * jõuab otse õige kliendi lehele. Silt ei anna ligipääsu, leht avaneb ikka
 * ainult sisse logitud töötajale, kes klienti näeb.
 *
 * Kliendil on üks kehtiv silt. Uue tegemine ja tühistamine on kahe sammuga,
 * sest mõlemad teevad seinal oleva sildi kasutuks.
 */
export default function HomeCareDoorTag({ context, client, initialTag }) {
  const { t } = useI18n();
  const { call, busy, error } = useHomeCareApi();
  const fieldId = useId();
  const organizationId = context.organization.id;
  const timeZone = context.organization.timezone || "Europe/Tallinn";
  const base = `${homeCareBase(organizationId)}/kliendid/${client.id}/silt`;
  const canWrite = Boolean(context.writable);

  const [tag, setTag] = useState(initialTag || null);
  /* "" | "issue" | "revoke": mida parajasti kinnitatakse. */
  const [confirming, setConfirming] = useState("");
  const [copied, setCopied] = useState(false);

  const issue = async () => {
    setConfirming("");
    setCopied(false);
    const result = await call(base, { method: "POST", fallbackKey: "home_care.errors.save_failed" });
    if (result.ok) setTag(result.data.tag);
  };

  const revoke = async () => {
    setConfirming("");
    const result = await call(base, { method: "DELETE", fallbackKey: "home_care.errors.save_failed" });
    if (result.ok) setTag(null);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tag.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="hc-shell">
      <Link className="hc-back" href={clientHref(organizationId, client.id)} prefetch={false}>
        {t("home_care.chronology.back")}
      </Link>

      <header className="hc-head">
        <h1 className="hc-title">{t("home_care.door_tag.title")}</h1>
        <p className="hc-sub">{client.displayName}</p>
        <p className="hc-sub">{t("home_care.door_tag.intro")}</p>
        <p className="hc-hint">{t("home_care.door_tag.safe")}</p>
      </header>

      {tag ? (
        <section className="hc-section hc-section--card">
          <svg
            className="hc-qr"
            xmlns="http://www.w3.org/2000/svg"
            viewBox={`0 0 ${tag.qr.side} ${tag.qr.side}`}
            shapeRendering="crispEdges"
            role="img"
            aria-label={t("home_care.door_tag.qr_label")}
            width="220"
            height="220"
          >
            <rect width={tag.qr.side} height={tag.qr.side} fill="#fff" />
            <path d={tag.qr.d} fill="#000" />
          </svg>
          <p className="hc-entry__meta">
            {t("home_care.door_tag.made_at", { time: formatDateTime(tag.createdAt, timeZone) })}
          </p>

          <div className="hc-row">
            <a
              className="hc-btn hc-btn--primary hc-btn--link"
              href={`${base}/dokument`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("home_care.door_tag.open_print")}
            </a>
          </div>
          <p className="hc-hint">{t("home_care.door_tag.print_hint")}</p>

          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-url`}>
              {t("home_care.door_tag.url_label")}
            </label>
            <div className="hc-row hc-row--search">
              <input id={`${fieldId}-url`} className="hc-input" value={tag.url} readOnly onFocus={(event) => event.target.select()} />
              <button className="hc-btn" type="button" onClick={copy}>
                {copied ? t("home_care.door_tag.copied") : t("home_care.door_tag.copy")}
              </button>
            </div>
            <p className="hc-hint">{t("home_care.door_tag.nfc_hint")}</p>
          </div>
        </section>
      ) : (
        <section className="hc-section">
          <p className="hc-sub">{t("home_care.door_tag.none")}</p>
        </section>
      )}

      {error ? (
        <p className="hc-error" role="alert">
          {error}
        </p>
      ) : null}

      {canWrite ? (
        <section className="hc-section">
          {confirming === "issue" ? (
            <div className="hc-row">
              <button className="hc-btn hc-btn--danger" type="button" onClick={issue} disabled={busy}>
                {t("home_care.door_tag.replace_confirm")}
              </button>
              <button className="hc-btn" type="button" onClick={() => setConfirming("")}>
                {t("home_care.entry.cancel")}
              </button>
            </div>
          ) : confirming === "revoke" ? (
            <div className="hc-row">
              <button className="hc-btn hc-btn--danger" type="button" onClick={revoke} disabled={busy}>
                {t("home_care.door_tag.revoke_confirm")}
              </button>
              <button className="hc-btn" type="button" onClick={() => setConfirming("")}>
                {t("home_care.entry.cancel")}
              </button>
            </div>
          ) : (
            <div className="hc-row">
              <button
                className={`hc-btn${tag ? " hc-btn--quiet" : " hc-btn--primary"}`}
                type="button"
                onClick={tag ? () => setConfirming("issue") : issue}
                disabled={busy}
              >
                {tag ? t("home_care.door_tag.replace") : t("home_care.door_tag.make")}
              </button>
              {tag ? (
                <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setConfirming("revoke")} disabled={busy}>
                  {t("home_care.door_tag.revoke")}
                </button>
              ) : null}
            </div>
          )}
        </section>
      ) : (
        <p className="hc-hint">{t("home_care.client.read_only")}</p>
      )}
    </section>
  );
}
