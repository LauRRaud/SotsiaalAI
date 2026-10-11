"use client";

import { useCallback, useMemo, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { AuditBoard } from "./audit/AuditViews";
import { auditRow } from "./audit/auditRules";
import OrgPart from "./OrgPart";

/**
 * Organisatsiooni audit.
 *
 * Vaade näitab organisatsiooni ENDA haldustoiminguid: mitte ühegi liikme
 * tegevust. Ridadel ei ole IP-d, seadet ega ühtegi sisuvälja.
 *
 * KUJU (11.10). Tabeli asemel madalad read, kus toiming on lause, mitte sisemine
 * nimi (`./audit/AuditViews.jsx`, `./audit/auditRules.js`).
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

  const rows = useMemo(() => events.map((event) => auditRow(event, { t })), [events, t]);

  return (
    <OrgPart context={context} part="audit">
      <AuditBoard
        t={t}
        rows={rows}
        shown={t("org.audit.shown", { shown: rows.length, total: Math.max(total, rows.length) })}
        more={hasMore ? { busy, onMore: loadMore } : null}
        notice={error ? { tone: "risk", text: error } : null}
      />
    </OrgPart>
  );
}
