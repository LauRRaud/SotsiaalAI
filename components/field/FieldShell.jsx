"use client";

/**
 * FIELD-V1 shell (doc ptk 7.1 areas 1 + 5): visit list, "Valmista külastus
 * ette" form and the always-visible connection state. Mobile-first, one
 * column, all primary actions inside the thumb zone. Camera/voice/effects are
 * never required — this page is plain text and buttons.
 *
 * KUJU (09.10, kujundusaudit K04 ja omaniku reeglid). Leht on lame ja ühes
 * veerus, nagu välitöö leping nõuab (FIELD-A0 ptk 7.2: loend on põhivorm,
 * liikumisefekte ei ole), seepärast ei ole siin sammulava. Muutunud on:
 *  - ühenduse seis ei ole enam sisu kohal kleepuv riba, mis vormi katab, vaid
 *    märk kiirmenüüs ja vajadusel tavaline teade sisu alguses (FieldConnection);
 *  - paneelil ei ole lehe pealkirja (nimi on kiirmenüüs);
 *  - korraga on ees üks asi: kas külastuste loend või uue külastuse vorm;
 *  - põhitegevus on all servas (pöidla ulatuses) ja nii lai kui tekst vajab.
 *
 * Kujundus: fieldShell.module.css (selle faili kõrval).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useI18n } from "@/components/i18n/I18nProvider";
import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";
import Form from "@/components/ui/Form";
import Input from "@/components/ui/Input";
import { FIELD_VISIT_STATUS } from "@/lib/field/constants";
import FieldConnection from "./FieldConnection";
import styles from "./fieldShell.module.css";
import { useFieldSync } from "./useFieldSync";

const OPEN_STATUSES = new Set([
  FIELD_VISIT_STATUS.DRAFT,
  FIELD_VISIT_STATUS.PLANNED,
  FIELD_VISIT_STATUS.IN_PROGRESS,
  FIELD_VISIT_STATUS.WRAP_UP
]);

function VisitRow({ visit, muted, t }) {
  const armed = visit.safety?.armedAt && !visit.safety?.cancelledAt;
  return (
    <li>
      <Link className={styles.row} data-muted={muted ? "true" : undefined} href={`/valitoo/${encodeURIComponent(visit.id)}`}>
        <span className={styles.rowTitle}>{visit.goal || t("field.visit.untitled")}</span>
        <span className={styles.rowMeta}>
          <span className={styles.chip}>{t(`field.status.${visit.status}`)}</span>
          {armed ? (
            <span className={styles.chip} data-tone="wait">
              {t("field.safety.armedBadge")}
            </span>
          ) : null}
        </span>
      </Link>
    </li>
  );
}

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
      event?.preventDefault?.();
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

  /* Lehe nimi on kiirmenüüs; pealkiri jääb ekraanilugejale. */
  const heading = <h1 className="sr-only">{t("field.title")}</h1>;

  if (sessionStatus === "loading") {
    return <div className={styles.page}><p className={styles.quiet}>{t("field.loading")}</p></div>;
  }
  if (!userId) {
    return (
      <div className={styles.page}>
        {heading}
        <p className={styles.quiet}>{t("field.loginRequired")}</p>
      </div>
    );
  }
  if (!allowed) {
    return (
      <div className={styles.page}>
        {heading}
        <p className={styles.quiet}>{t("field.roleRequired")}</p>
      </div>
    );
  }

  const loadFailed = loadError ? (
    <div className={styles.alert} role="alert">
      <p>{t("field.errors.loadFailed")}</p>
      <Button variant="secondary" size="sm" onClick={() => loadVisits()}>{t("field.retry")}</Button>
    </div>
  ) : null;

  return (
    <div className={styles.page}>
      {heading}
      <FieldConnection t={t} online={sync.online} pendingCount={sync.pendingCount} needsLogin={sync.needsLogin} />

      {showForm ? (
        /* Uue külastuse vorm on omaette vaade: loend ei ole samal ajal ees. */
        <Form className={styles.view} onSubmit={createVisit}>
          <StepPanel
            title={t("field.prepare.title")}
            question={t("field.prepare.title")}
            note={!sync.online ? t("field.prepare.needsOnline") : ""}
            actions={
              <>
                <Button type="submit" disabled={creating || !sync.online}>
                  {creating ? t("field.saving") : t("field.prepare.create")}
                </Button>
                <Button variant="secondary" onClick={() => setShowForm(false)}>{t("field.cancel")}</Button>
              </>
            }
          >
            <div className={styles.stack}>
              {loadFailed}
              <TextAreaField label={t("field.prepare.goal")} value={goal} onChange={setGoal} rows={3} maxLength={4000} />
              <label className={styles.field} htmlFor="fld-location">
                <span className={styles.fieldLabel}>{t("field.prepare.location")}</span>
                <span className={styles.fieldHint} id="fld-location-hint">{t("field.prepare.locationHint")}</span>
                <Input
                  id="fld-location"
                  value={locationText}
                  onChange={(event) => setLocationText(event.target.value)}
                  maxLength={400}
                  autoComplete="off"
                  aria-describedby="fld-location-hint"
                />
              </label>
            </div>
          </StepPanel>
        </Form>
      ) : (
        <div className={styles.view}>
          <StepPanel
            title={t("field.title")}
            actions={<Button onClick={() => setShowForm(true)}>{t("field.prepare.open")}</Button>}
          >
            <div className={styles.stack}>
              {!sync.supported ? <p className={styles.notice}>{t("field.storeUnsupported")}</p> : null}

              {/*
                SOL-FIELD-01 — SAATMATA SISU EI KAO VAIKSELT.

                Varem kasvatas hoiatuste loendurit taustal jooksev säilituskäik ja mitte
                ükski komponent ei kuvanud teda: „kolm hoiatust" tähendas päriselt
                „rakendus avati kolmel eri päeval". Siin on hoiatus NÄHTAV ja tema
                kinnitus on eraldi tegevus — alles see loeb hoiatuseks.
              */}
              {sync.retentionWarnings.length ? (
                <section className={styles.alert} role="alert" aria-label={t("field.retention.warnTitle")}>
                  <h2 className={styles.alertTitle}>{t("field.retention.warnTitle")}</h2>
                  <p>{t("field.retention.warnBody")}</p>
                  <ul className={styles.rows}>
                    {sync.retentionWarnings.map((item) => (
                      <li key={item.clientItemId} className={styles.item}>
                        <span className={styles.itemText}>
                          <span className={styles.rowTitle}>{item.payload?.body?.slice(0, 80) || t("field.retention.unnamedItem")}</span>
                          <span className={styles.itemMeta}>
                            {t("field.retention.warnCount")
                              .replace("{seen}", String(Number(item.warnCount || 0)))
                              .replace("{needed}", "3")}
                          </span>
                        </span>
                        <Button variant="secondary" size="sm" onClick={() => sync.acknowledgeWarning(item.clientItemId)}>
                          {t("field.retention.acknowledge")}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {/* Kolm nähtud hoiatust ütlevad „ma tean"; kustutamine vajab eraldi „kustuta". */}
              {sync.retentionAwaitingConfirmation.length ? (
                <section className={styles.alert} role="alert" aria-label={t("field.retention.confirmTitle")}>
                  <h2 className={styles.alertTitle}>{t("field.retention.confirmTitle")}</h2>
                  <p>{t("field.retention.confirmBody")}</p>
                  <ul className={styles.rows}>
                    {sync.retentionAwaitingConfirmation.map((item) => (
                      <li key={item.clientItemId} className={styles.item}>
                        <span className={styles.rowTitle}>{item.payload?.body?.slice(0, 80) || t("field.retention.unnamedItem")}</span>
                        <Button variant="secondary" size="sm" onClick={() => sync.confirmPurge(item.clientItemId)}>
                          {t("field.retention.confirmDelete")}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {loadFailed}

              <section className={styles.group} aria-label={t("field.list.open")}>
                <h2 className={styles.groupTitle}>
                  {t("field.list.open")} <span className={styles.groupCount}>{counts.open || openVisits.length}</span>
                </h2>
                {visits === null ? (
                  <p className={styles.quiet}>{t("field.loading")}</p>
                ) : openVisits.length === 0 ? (
                  <p className={styles.quiet}>{t("field.list.empty")}</p>
                ) : (
                  <ul className={styles.rows}>
                    {openVisits.map((visit) => (
                      <VisitRow key={visit.id} visit={visit} t={t} />
                    ))}
                  </ul>
                )}
              </section>

              {closedVisits.length ? (
                <section className={styles.group} aria-label={t("field.list.closed")}>
                  <h2 className={styles.groupTitle}>
                    {t("field.list.closed")} <span className={styles.groupCount}>{counts.closed || closedVisits.length}</span>
                  </h2>
                  <ul className={styles.rows}>
                    {closedVisits.map((visit) => (
                      <VisitRow key={visit.id} visit={visit} muted t={t} />
                    ))}
                  </ul>
                </section>
              ) : null}
              {nextCursor ? (
                <Button variant="secondary" size="sm" className={styles.more} onClick={() => loadVisits({ append: true })}>
                  {t("field.list.loadMore")}
                </Button>
              ) : null}
            </div>
          </StepPanel>
        </div>
      )}
    </div>
  );
}
