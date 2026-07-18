"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";

export default function NotificationOperationsPanel() {
  const { t } = useI18n();
  const [state, setState] = useState({ status: "loading", rows: [] });

  const load = useCallback(async (signal) => {
    try {
      const response = await fetch("/api/admin/notifications", {
        cache: "no-store", headers: { Accept: "application/json" }, signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok !== true) throw new Error("load_failed");
      setState({ status: "ready", rows: Array.isArray(payload.rows) ? payload.rows : [] });
    } catch (error) {
      if (error?.name !== "AbortError") setState({ status: "error", rows: [] });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const requeue = useCallback(async (eventId) => {
    setState((current) => ({ ...current, status: "saving" }));
    try {
      const response = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ eventId })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok !== true) throw new Error("requeue_failed");
      setState((current) => ({ status: "ready", rows: current.rows.filter((row) => row.id !== eventId) }));
    } catch {
      setState((current) => ({ ...current, status: "error" }));
    }
  }, []);

  return (
    <section className="mt-8 rounded-xl border border-white/15 bg-black/10 p-5" aria-labelledby="notification-ops-title">
      <h2 id="notification-ops-title" className="m-0 text-xl font-semibold">
        {t("admin.notifications.title")}
      </h2>
      <p className="mt-2 opacity-70">{t("admin.notifications.description")}</p>
      {state.status === "loading" ? <p role="status">{t("admin.common.loading_data")}</p>
        : state.status === "error" ? <p role="alert">{t("admin.notifications.load_failed")}</p>
          : state.rows.length ? (
            <ul className="mt-4 grid list-none gap-2 p-0">
              {state.rows.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 p-3">
                  <span><strong>{row.emailStatus}</strong> · {row.type} · {row.emailLastErrorCode || "—"}</span>
                  <button type="button" disabled={state.status === "saving"} onClick={() => requeue(row.id)}>
                    {t("admin.notifications.requeue")}
                  </button>
                </li>
              ))}
            </ul>
          ) : <p>{t("admin.notifications.empty")}</p>}
    </section>
  );
}
