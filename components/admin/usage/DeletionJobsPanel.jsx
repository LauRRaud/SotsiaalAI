"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { useI18n } from "@/components/i18n/I18nProvider";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";

export default function DeletionJobsPanel() {
  const { t, locale } = useI18n();
  const [filter, setFilter] = useState("active");
  const [payload, setPayload] = useState({ jobs: [], counts: {} });
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/usage/deletion-jobs?status=${filter}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.ok === false) throw new Error(resolveApiMessage({ payload: body, t }));
      setPayload(body);
    } catch (loadError) {
      setError(loadError?.message || t("admin.usage.errors.deletion_jobs_load"));
    } finally {
      setLoading(false);
    }
  }, [filter, t]);

  useEffect(() => { void load(); }, [load]);

  const retry = async jobId => {
    setRetryingId(jobId);
    setError("");
    try {
      const response = await fetch("/api/admin/usage/deletion-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept-Language": locale },
        body: JSON.stringify({ jobId })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.ok === false) throw new Error(resolveApiMessage({ payload: body, t }));
      await load();
    } catch (retryError) {
      setError(retryError?.message || t("admin.usage.errors.deletion_job_retry"));
    } finally {
      setRetryingId("");
    }
  };

  const formatDate = value => value
    ? new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
    : "-";

  return (
    <section className="usage-admin usage-admin--jobs" id="admin-deletion-jobs" aria-labelledby="admin-deletion-jobs-title">
      <header className="usage-admin__header">
        <div><p>{t("admin.usage.background_eyebrow")}</p><h2 id="admin-deletion-jobs-title">{t("admin.usage.deletion_jobs_title")}</h2></div>
        <div className="usage-admin__job-toolbar">
          <select data-variant value={filter} onChange={event => setFilter(event.target.value)} aria-label={t("admin.usage.job_filter")}>
            <option value="active">{t("admin.usage.jobs_active")}</option>
            <option value="all">{t("admin.usage.jobs_all")}</option>
          </select>
          <Button type="button" onClick={load} disabled={loading}>{t("admin.common.refresh")}</Button>
        </div>
      </header>
      <div className="usage-admin__job-counts">
        {Object.entries(payload.counts || {}).map(([status, count]) => <span key={status} data-status={status}>{t(`admin.usage.job_status.${status}`, status)}: {count}</span>)}
      </div>
      {error ? <div className="usage-admin__notice" data-tone="error" role="alert">{error}</div> : null}
      <div className="usage-admin__jobs" aria-busy={loading ? "true" : "false"}>
        {(payload.jobs || []).map(job => (
          <article key={job.id} data-status={job.status}>
            <div><strong>{job.action}</strong><span>{job.resourceType} · {job.resourceId || job.externalRef || "-"}</span></div>
            <div><span>{t(`admin.usage.job_status.${job.status}`, job.status)}</span><span>{t("admin.usage.attempts", { count: job.attempts })}</span></div>
            <div><span>{formatDate(job.updatedAt)}</span>{job.lastError ? <code>{job.lastError}</code> : null}</div>
            {job.status === "failed" || job.status === "pending" ? <Button type="button" onClick={() => retry(job.id)} disabled={Boolean(retryingId)}>{retryingId === job.id ? t("admin.common.loading") : t("admin.usage.retry_job")}</Button> : null}
          </article>
        ))}
        {!loading && !(payload.jobs || []).length ? <p>{t("admin.usage.no_deletion_jobs")}</p> : null}
      </div>
    </section>
  );
}
