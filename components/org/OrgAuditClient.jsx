"use client";

import { useCallback, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";

import OrgHeader from "./OrgHeader";

/**
 * Organisatsiooni auditivaade. Näitab HALDUSTOIMINGUID — mitte inimeste
 * tegevust. Ridadel ei ole IP-d, seadet ega ühtegi sisuvälja.
 */
export default function OrgAuditClient({ context, initialPage }) {
  const { t } = useI18n();
  const [events, setEvents] = useState(initialPage?.items || []);
  const [nextCursor, setNextCursor] = useState(initialPage?.nextCursor || null);
  const [hasMore, setHasMore] = useState(Boolean(initialPage?.hasMore));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const total = Number(initialPage?.total) || 0;
  const organizationId = context.organization.id;

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || busy) return;
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams({ take: "100", cursor: nextCursor });
      const response = await fetch(`/api/org/${organizationId}/audit?${params.toString()}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        setError(t("org.audit.loadFailed"));
        return;
      }
      setEvents((current) => {
        const known = new Set(current.map((event) => event.id));
        return [...current, ...(payload.items || []).filter((event) => !known.has(event.id))];
      });
      setNextCursor(payload.nextCursor || null);
      setHasMore(Boolean(payload.hasMore));
    } catch {
      setError(t("org.audit.loadFailed"));
    } finally {
      setBusy(false);
    }
  }, [busy, hasMore, nextCursor, organizationId, t]);

  return (
    <section className="ow-shell">
      <OrgHeader context={context} />

      <div className="ow-card">
        <h2 className="ow-title" style={{ fontSize: "1.125rem" }}>
          {t("org.audit.heading")}
        </h2>
        <p className="ow-notice ow-notice--privacy">{t("org.audit.intro")}</p>
        <p className="ow-subtitle">{t("org.audit.total", { count: String(total) })}</p>
      </div>

      {events.length === 0 ? (
        <p className="ow-empty">{t("org.audit.empty")}</p>
      ) : (
        <div className="ow-tablewrap">
          <table className="ow-table">
            <caption>{t("org.audit.heading")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("org.audit.time")}</th>
                <th scope="col">{t("org.audit.action")}</th>
                <th scope="col">{t("org.audit.resource")}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td data-label={t("org.audit.time")}>
                    {new Date(event.createdAt).toISOString().replace("T", " ").slice(0, 16)}
                  </td>
                  <td data-label={t("org.audit.action")}>{event.action}</td>
                  <td data-label={t("org.audit.resource")}>{event.resourceType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasMore ? (
        <div className="ow-actions">
          <Button type="button" variant="secondary" disabled={busy} onClick={loadMore}>
            {t("org.audit.loadMore")}
          </Button>
        </div>
      ) : null}
      {error ? (
        <p className="ow-notice ow-notice--warning" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
