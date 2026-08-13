"use client";

/**
 * FIELD-V1 shell (doc ptk 7.1 areas 1 + 5): visit list, "Valmista külastus
 * ette" form and the always-visible connection banner. Mobile-first, one
 * column, all primary actions inside the thumb zone. Camera/voice/effects are
 * never required — this page is plain text and buttons.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Form from "@/components/ui/Form";
import Input from "@/components/ui/Input";
import { FIELD_VISIT_STATUS } from "@/lib/field/constants";
import { useFieldSync } from "./useFieldSync";

const OPEN_STATUSES = new Set([
  FIELD_VISIT_STATUS.DRAFT,
  FIELD_VISIT_STATUS.PLANNED,
  FIELD_VISIT_STATUS.IN_PROGRESS,
  FIELD_VISIT_STATUS.WRAP_UP
]);

export default function FieldShell() {
  const { t } = useI18n();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const userId = session?.user?.id || null;
  const role = String(session?.user?.role || "").toUpperCase();
  const allowed = ["ADMIN", "SOCIAL_WORKER", "SERVICE_PROVIDER"].includes(role);

  const sync = useFieldSync({ userId });
  const [visits, setVisits] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [goal, setGoal] = useState("");
  const [locationText, setLocationText] = useState("");
  const [nextCursor, setNextCursor] = useState(null);
  const [counts, setCounts] = useState({ open: 0, closed: 0 });

  const loadVisits = useCallback(async ({ append = false } = {}) => {
    if (!navigator.onLine) {
      setVisits(sync.localVisits);
      setNextCursor(null);
      return;
    }
    try {
      setLoadError(false);
      const cursor = append ? nextCursor : null;
      const response = await fetch(`/api/field/visits${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
      if (!response.ok) throw new Error("load_failed");
      const body = await response.json();
      const page = Array.isArray(body.visits) ? body.visits : [];
      setVisits((current) => (append ? [...(current || []), ...page] : page));
      setNextCursor(body.nextCursor || null);
      setCounts(body.counts || { open: page.filter((visit) => OPEN_STATUSES.has(visit.status)).length, closed: 0 });
    } catch {
      setLoadError(true);
      // Browsers may report navigator.onLine=true while every request is already
      // disconnected. The encrypted packs are still the honest fallback.
      setVisits(sync.localVisits);
      setNextCursor(null);
    }
  }, [nextCursor, sync.localVisits]);

  useEffect(() => {
    if (userId && allowed) loadVisits();
  }, [userId, allowed, loadVisits]);

  const createVisit = useCallback(
    async (event) => {
      event.preventDefault();
      if (creating) return;
      setCreating(true);
      try {
        const response = await fetch("/api/field/visits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ goal, locationText })
        });
        const body = await response.json().catch(() => ({}));
        if (response.ok && body?.visit?.id) {
          router.push(`/valitoo/${encodeURIComponent(body.visit.id)}`);
          return;
        }
        setLoadError(true);
      } catch {
        setLoadError(true);
      } finally {
        setCreating(false);
      }
    },
    [creating, goal, locationText, router]
  );

  const openVisits = useMemo(
    () => (visits || []).filter((visit) => OPEN_STATUSES.has(visit.status)),
    [visits]
  );
  const closedVisits = useMemo(
    () => (visits || []).filter((visit) => !OPEN_STATUSES.has(visit.status)),
    [visits]
  );

  if (sessionStatus === "loading") {
    return <main className="fld-page"><p className="fld-muted">{t("field.loading")}</p></main>;
  }
  if (!userId) {
    return (
      <main className="fld-page">
        <h1 className="fld-title">{t("field.title")}</h1>
        <p className="fld-muted">{t("field.loginRequired")}</p>
      </main>
    );
  }
  if (!allowed) {
    return (
      <main className="fld-page">
        <h1 className="fld-title">{t("field.title")}</h1>
        <p className="fld-muted">{t("field.roleRequired")}</p>
      </main>
    );
  }

  return (
    <main className="fld-page">
      <div
        className={`fld-connection ${sync.online ? "fld-connection--online" : "fld-connection--offline"}`}
        role="status"
        aria-live="polite"
      >
        {sync.online
          ? sync.pendingCount
            ? t("field.sync.onlinePending").replace("{count}", String(sync.pendingCount))
            : t("field.sync.online")
          : t("field.sync.offline")}
        {sync.needsLogin ? ` · ${t("field.sync.needsLogin")}` : ""}
      </div>

      <h1 className="fld-title">{t("field.title")}</h1>
      <p className="fld-lead">{t("field.lead")}</p>

      {!sync.supported ? <p className="fld-warn">{t("field.storeUnsupported")}</p> : null}

      {/*
        SOL-FIELD-01 — SAATMATA SISU EI KAO VAIKSELT.

        Varem kasvatas hoiatuste loendurit taustal jooksev säilituskäik ja mitte
        ükski komponent ei kuvanud teda: „kolm hoiatust" tähendas päriselt
        „rakendus avati kolmel eri päeval". Siin on hoiatus NÄHTAV ja tema
        kinnitus on eraldi tegevus — alles see loeb hoiatuseks.
      */}
      {sync.retentionWarnings.length ? (
        <section className="fld-error" role="alert" aria-label={t("field.retention.warnTitle")}>
          <h2 className="fld-h2">{t("field.retention.warnTitle")}</h2>
          <p>{t("field.retention.warnBody")}</p>
          <ul className="fld-list">
            {sync.retentionWarnings.map((item) => (
              <li key={item.clientItemId}>
                <span className="fld-card__title">
                  {item.payload?.body?.slice(0, 80) || t("field.retention.unnamedItem")}
                </span>
                <span className="fld-card__meta">
                  {t("field.retention.warnCount")
                    .replace("{seen}", String(Number(item.warnCount || 0)))
                    .replace("{needed}", "3")}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => sync.acknowledgeWarning(item.clientItemId)}
                >
                  {t("field.retention.acknowledge")}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Kolm nähtud hoiatust ütlevad „ma tean"; kustutamine vajab eraldi „kustuta". */}
      {sync.retentionAwaitingConfirmation.length ? (
        <section className="fld-error" role="alert" aria-label={t("field.retention.confirmTitle")}>
          <h2 className="fld-h2">{t("field.retention.confirmTitle")}</h2>
          <p>{t("field.retention.confirmBody")}</p>
          <ul className="fld-list">
            {sync.retentionAwaitingConfirmation.map((item) => (
              <li key={item.clientItemId}>
                <span className="fld-card__title">
                  {item.payload?.body?.slice(0, 80) || t("field.retention.unnamedItem")}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => sync.confirmPurge(item.clientItemId)}
                >
                  {t("field.retention.confirmDelete")}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {loadError ? (
        <div className="fld-error" role="alert">
          <p>{t("field.errors.loadFailed")}</p>
          <Button variant="secondary" size="sm" onClick={loadVisits}>{t("field.retry")}</Button>
        </div>
      ) : null}

      <section className="fld-section" aria-label={t("field.prepare.title")}>
        {showForm ? (
          <Form className="fld-form" onSubmit={createVisit}>
            <h2 className="fld-h2">{t("field.prepare.title")}</h2>
            <label className="fld-label" htmlFor="fld-goal">{t("field.prepare.goal")}</label>
            <textarea
              id="fld-goal"
              className="fld-input"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              rows={2}
              maxLength={4000}
            />
            <label className="fld-label" htmlFor="fld-location">{t("field.prepare.location")}</label>
            <Input
              id="fld-location"
              className="fld-input"
              value={locationText}
              onChange={(event) => setLocationText(event.target.value)}
              maxLength={400}
              autoComplete="off"
            />
            <p className="fld-hint">{t("field.prepare.locationHint")}</p>
            <div className="fld-actions">
              <Button type="submit" disabled={creating || !sync.online}>
                {creating ? t("field.saving") : t("field.prepare.create")}
              </Button>
              <Button variant="secondary" onClick={() => setShowForm(false)}>{t("field.cancel")}</Button>
            </div>
            {!sync.online ? <p className="fld-hint">{t("field.prepare.needsOnline")}</p> : null}
          </Form>
        ) : (
          <Button fullWidth onClick={() => setShowForm(true)}>{t("field.prepare.open")}</Button>
        )}
      </section>

      <section className="fld-section" aria-label={t("field.list.open")}>
          <h2 className="fld-h2">{t("field.list.open")} ({counts.open || openVisits.length})</h2>
        {visits === null ? (
          <p className="fld-muted">{t("field.loading")}</p>
        ) : openVisits.length === 0 ? (
          <p className="fld-muted">{t("field.list.empty")}</p>
        ) : (
          <ul className="fld-list">
            {openVisits.map((visit) => (
              <li key={visit.id}>
                <Link className="fld-card" href={`/valitoo/${encodeURIComponent(visit.id)}`}>
                  <span className="fld-card__title">{visit.goal || t("field.visit.untitled")}</span>
                  <span className="fld-card__meta">
                    {t(`field.status.${visit.status}`)}
                    {visit.safety?.armedAt && !visit.safety?.cancelledAt
                      ? ` · ${t("field.safety.armedBadge")}`
                      : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {closedVisits.length ? (
        <section className="fld-section" aria-label={t("field.list.closed")}>
          <h2 className="fld-h2">{t("field.list.closed")} ({counts.closed || closedVisits.length})</h2>
          <ul className="fld-list">
            {closedVisits.map((visit) => (
              <li key={visit.id}>
                <Link className="fld-card fld-card--muted" href={`/valitoo/${encodeURIComponent(visit.id)}`}>
                  <span className="fld-card__title">{visit.goal || t("field.visit.untitled")}</span>
                  <span className="fld-card__meta">{t(`field.status.${visit.status}`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {nextCursor ? (
        <Button variant="secondary" fullWidth onClick={() => loadVisits({ append: true })}>
          {t("field.list.loadMore")}
        </Button>
      ) : null}
    </main>
  );
}
