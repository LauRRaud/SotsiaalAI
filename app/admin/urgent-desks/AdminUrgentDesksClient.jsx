"use client";

import { useCallback, useEffect, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";

function dateTime(value, locale) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

/**
 * Takistuse kood on kujul `urgent_desk.never_verified`. Tõlkevõtmes elab ta
 * ilma prefiksita, sest punkt on tõlkefailis eraldaja.
 */
function reasonLabel(t, code) {
  const key = String(code || "").replace(/^urgent_desk\./, "");
  return t(`admin.urgent_desks.block_reasons.${key}`);
}

export default function AdminUrgentDesksClient() {
  const { t, locale } = useI18n();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/urgent-desks", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || t("admin.urgent_desks.errors.load_failed"));
      setRows(Array.isArray(payload?.desks) ? payload.desks : []);
    } catch (loadError) {
      setRows([]);
      setError(loadError?.message || t("admin.urgent_desks.errors.load_failed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(deskId, path, body) {
    if (busyId) return;
    setBusyId(deskId);
    setError("");
    try {
      const response = await fetch(`/api/admin/urgent-desks/${encodeURIComponent(deskId)}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {})
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || t("admin.urgent_desks.errors.save_failed"));
      await load();
    } catch (saveError) {
      setError(saveError?.message || t("admin.urgent_desks.errors.save_failed"));
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="space-y-6 py-8" aria-labelledby="urgent-desks-admin-title">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-800">
          {t("admin.urgent_desks.eyebrow")}
        </p>
        <h1 id="urgent-desks-admin-title" className="text-3xl font-semibold">
          {t("admin.urgent_desks.title")}
        </h1>
        <p className="max-w-3xl text-sm opacity-80">{t("admin.urgent_desks.lead")}</p>
        <p className="max-w-3xl text-sm opacity-80">{t("admin.urgent_desks.conditions_note")}</p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button type="button" onClick={() => void load()} disabled={loading}>
            {t("admin.common.refresh")}
          </Button>
        </div>
      </header>

      {error ? <p role="alert" className="rounded-xl border border-red-700 bg-red-50 p-3">{error}</p> : null}

      {loading ? (
        <p role="status">{t("admin.common.loading_data")}</p>
      ) : rows.length ? (
        <div className="overflow-x-auto rounded-2xl border border-stone-300 bg-white/90 text-stone-900 shadow-sm">
          <table className="w-full border-collapse text-left text-sm text-stone-900">
            <caption className="sr-only">{t("admin.urgent_desks.table_caption")}</caption>
            <thead className="bg-stone-100/90">
              <tr className="border-b border-stone-300">
                <th scope="col" className="p-3">{t("admin.urgent_desks.columns.municipality")}</th>
                <th scope="col" className="p-3">{t("admin.urgent_desks.columns.public_name")}</th>
                <th scope="col" className="p-3">{t("admin.urgent_desks.columns.reading_time")}</th>
                <th scope="col" className="p-3">{t("admin.urgent_desks.columns.state")}</th>
                <th scope="col" className="p-3">{t("admin.urgent_desks.columns.verified")}</th>
                <th scope="col" className="p-3">{t("admin.urgent_desks.columns.members")}</th>
                <th scope="col" className="p-3">{t("admin.urgent_desks.columns.blockers")}</th>
                <th scope="col" className="p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-stone-200 align-top">
                  <td className="p-3">{row.municipalityName || row.municipalityId}</td>
                  <td className="p-3">{row.publicName}</td>
                  <td className="p-3">{row.readingTimePromise}</td>
                  <td className="p-3">
                    <span className={row.ready ? "font-semibold text-emerald-800" : "font-semibold text-stone-600"}>
                      {row.ready ? t("admin.urgent_desks.state.open") : t("admin.urgent_desks.state.closed")}
                    </span>
                  </td>
                  <td className="p-3">
                    {dateTime(row.lastVerifiedAt, locale) || t("admin.urgent_desks.verified_never")}
                  </td>
                  <td className="p-3">{row.activeMemberCount}</td>
                  <td className="p-3">
                    {row.blockReasons?.length ? (
                      <ul className="space-y-1">
                        {row.blockReasons.map((code) => (
                          <li key={code}>{reasonLabel(t, code)}</li>
                        ))}
                      </ul>
                    ) : null}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={() => void post(row.id, "/verify")}
                        disabled={busyId === row.id}
                      >
                        {t("admin.urgent_desks.actions.verify")}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => void post(row.id, "/activation", { isActive: !row.isActive })}
                        disabled={busyId === row.id}
                      >
                        {row.isActive
                          ? t("admin.urgent_desks.actions.deactivate")
                          : t("admin.urgent_desks.actions.activate")}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p role="status" className="max-w-3xl rounded-xl border border-stone-300 bg-white/80 p-4 text-sm">
          {t("admin.urgent_desks.empty")}
        </p>
      )}
    </main>
  );
}
