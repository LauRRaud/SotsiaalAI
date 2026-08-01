"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import AdminHelpButton from "@/components/admin/AdminHelpButton";

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
    // Kujundus tuleb admin-analytics.css aa-* süsteemist, mitte Tailwindi
    // utiliitidest: utilities-kiht võidab components-kihi, nii et kohalikud
    // mt-8/rounded-xl/bg-black/10 lõid lehe rütmi ja pinna ainsana katki.
    <section className="aa-card aa-notifops" aria-labelledby="notification-ops-title">
      <div className="aa-card-body">
        <div className="aa-section-head">
          <div>
            <h2 id="notification-ops-title">{t("admin.notifications.title")}</h2>
            <p className="aa-section-sub">{t("admin.notifications.description")}</p>
          </div>
          <AdminHelpButton
            label={t("admin.analytics.help.aria")}
            text={t("admin.analytics.help.section_notifications")}
          />
        </div>
        {state.status === "loading" ? <p className="aa-alert aa-alert--info" role="status">{t("admin.common.loading_data")}</p>
          : state.status === "error" ? <p className="aa-alert aa-alert--error" role="alert">{t("admin.notifications.load_failed")}</p>
            : state.rows.length ? (
              <ul className="aa-notifops-list">
                {state.rows.map((row) => (
                  <li key={row.id} className="aa-notifops-row">
                    <span><strong>{row.emailStatus}</strong> · {row.type} · {row.emailLastErrorCode || "—"}</span>
                    <button type="button" data-variant="default" data-size="sm" disabled={state.status === "saving"} onClick={() => requeue(row.id)}>
                      {t("admin.notifications.requeue")}
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="aa-section-sub">{t("admin.notifications.empty")}</p>}
      </div>
    </section>
  );
}
