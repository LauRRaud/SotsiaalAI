"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Button from "@/components/ui/Button";
import { useI18n } from "@/components/i18n/I18nProvider";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";

function formatDate(value, locale) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(locale === "et" ? "et-EE" : locale === "ru" ? "ru-RU" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function DataExportPanel({ active = true }) {
  const { t, locale } = useI18n();
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const pinId = `${baseId}-pin`;
  const [jobs, setJobs] = useState([]);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/data-export", { cache: "no-store", headers: { "Accept-Language": locale } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) throw new Error(resolveApiMessage({ payload, t, fallbackKey: "profile.data_export.load_failed" }));
      setJobs(Array.isArray(payload.jobs) ? payload.jobs : []);
    } catch (loadError) { setError(loadError?.message || t("profile.data_export.load_failed")); }
    finally { setLoading(false); }
  }, [locale, t]);

  useEffect(() => { if (active) void load(); }, [active, load]);

  const request = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/data-export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: pin, locale }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) throw new Error(resolveApiMessage({ payload, t, fallbackKey: "profile.data_export.request_failed" }));
      setPin("");
      await load();
    } catch (requestError) { setError(requestError?.message || t("profile.data_export.request_failed")); }
    finally { setBusy(false); }
  };

  const cancel = async id => {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/data-export/${encodeURIComponent(id)}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) throw new Error(resolveApiMessage({ payload, t, fallbackKey: "profile.data_export.cancel_failed" }));
      await load();
    } catch (cancelError) { setError(cancelError?.message || t("profile.data_export.cancel_failed")); }
    finally { setBusy(false); }
  };

  return (
    <section className="konto-actions" aria-labelledby={titleId}>
      <div>
        <h2 id={titleId}>{t("profile.data_export.title")}</h2>
        <p>{t("profile.data_export.description")}</p>
        <p>{t("profile.data_export.included")}</p>
        <p>{t("profile.data_export.excluded")}</p>
        <label htmlFor={pinId}>{t("profile.current_pin_label")}</label>
        <input id={pinId} type="password" inputMode="numeric" autoComplete="current-password" value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, "").slice(0, 8))} />
        <p>{t("profile.data_export.pin_hint")}</p>
        <Button type="button" onClick={request} disabled={busy}>{busy ? t("profile.data_export.requesting") : t("profile.data_export.request")}</Button>
        {error ? <p role="alert">{error}</p> : null}
        {loading ? <p role="status">{t("profile.loading")}</p> : null}
        {jobs.map(job => (
          <article key={job.id} aria-live="polite">
            <p>{t(`profile.data_export.${job.status}`)}</p>
            {job.status === "ready" && job.expiresAt ? <p>{t("profile.data_export.ready", { date: formatDate(job.expiresAt, locale) })}</p> : null}
            {job.canDownload ? <Button type="button" onClick={() => { window.location.assign(`/api/data-export/${encodeURIComponent(job.id)}/download`); }}>{t("profile.data_export.download")}</Button> : null}
            {job.canCancel ? <Button type="button" onClick={() => cancel(job.id)} disabled={busy}>{t("profile.data_export.cancel")}</Button> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
