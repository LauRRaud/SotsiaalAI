"use client";

import { useCallback, useEffect, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import { serviceAvailabilityPresentation } from "@/lib/serviceAvailabilityUi";

function dateTime(value, locale) {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function AdminServiceAvailabilityClient() {
  const { t, locale } = useI18n();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dispatching, setDispatching] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/service-availability", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || t("admin.service_availability.errors.load_failed"));
      setRows(Array.isArray(payload?.rows) ? payload.rows : []);
    } catch (loadError) {
      setRows([]);
      setError(loadError?.message || t("admin.service_availability.errors.load_failed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function dispatchReminders() {
    if (dispatching) return;
    setDispatching(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/service-availability", { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || t("admin.service_availability.errors.dispatch_failed"));
      setMessage(t("admin.service_availability.dispatch_result", {
        sent: payload?.summary?.sent || 0,
        notSent: payload?.summary?.notSent || 0,
        skipped: payload?.summary?.skipped || 0
      }));
      await load();
    } catch (dispatchError) {
      setError(dispatchError?.message || t("admin.service_availability.errors.dispatch_failed"));
    } finally {
      setDispatching(false);
    }
  }

  return (
    <main className="space-y-6 py-8" aria-labelledby="service-availability-admin-title">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-800">
          {t("admin.service_availability.eyebrow")}
        </p>
        <h1 id="service-availability-admin-title" className="text-3xl font-semibold">
          {t("admin.service_availability.title")}
        </h1>
        <p className="max-w-3xl text-sm opacity-80">{t("admin.service_availability.lead")}</p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button type="button" onClick={() => void load()} disabled={loading}>{t("admin.common.refresh")}</Button>
          <Button type="button" onClick={dispatchReminders} disabled={dispatching}>
            {dispatching ? t("admin.service_availability.dispatching") : t("admin.service_availability.dispatch")}
          </Button>
        </div>
      </header>

      {message ? <p role="status" className="rounded-xl border border-emerald-700 bg-emerald-50 p-3">{message}</p> : null}
      {error ? <p role="alert" className="rounded-xl border border-red-700 bg-red-50 p-3">{error}</p> : null}

      {loading ? <p role="status">{t("admin.common.loading_data")}</p> : rows.length ? (
        <div className="overflow-x-auto rounded-2xl border border-stone-300 bg-white/90 text-stone-900 shadow-sm">
          <table className="w-full border-collapse text-left text-sm text-stone-900">
            <caption className="sr-only">{t("admin.service_availability.table_caption")}</caption>
            <thead className="bg-stone-100/90">
              <tr className="border-b border-stone-300">
                <th scope="col" className="p-3" style={{ color: "#292524" }}>{t("admin.service_availability.columns.service")}</th>
                <th scope="col" className="p-3" style={{ color: "#292524" }}>{t("admin.service_availability.columns.owner")}</th>
                <th scope="col" className="p-3" style={{ color: "#292524" }}>{t("admin.service_availability.columns.state")}</th>
                <th scope="col" className="p-3" style={{ color: "#292524" }}>{t("admin.service_availability.columns.checked")}</th>
                <th scope="col" className="p-3" style={{ color: "#292524" }}>{t("admin.service_availability.columns.reason")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const presentation = serviceAvailabilityPresentation(t, row.availability);
                return (
                  <tr key={row.id} className="border-b border-stone-200 align-top last:border-0">
                    <td className="p-3"><strong>{row.name}</strong><br /><span>{row.organizationName}</span></td>
                    <td className="p-3">{row.ownerEmail || row.ownerId}</td>
                    <td className="p-3"><span aria-hidden="true">{presentation.icon}</span> {presentation.label}</td>
                    <td className="p-3">{dateTime(row.availability?.checkedAt, locale)}<br /><span>{presentation.ageText}</span></td>
                    <td className="p-3">{presentation.warning || t("admin.service_availability.reason_unknown")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <p>{t("admin.service_availability.empty")}</p>}

      <p className="text-sm opacity-75">{t("admin.service_availability.read_only_note")}</p>
    </main>
  );
}
