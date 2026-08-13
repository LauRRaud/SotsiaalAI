"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import { localizePath } from "@/lib/localizePath";
import ContractPanel from "./ContractPanel";
import EeskamberPanel from "./EeskamberPanel";
import KappPanel from "./KappPanel";
import MeetingsPanel from "./MeetingsPanel";
import PrivacyBadge from "./PrivacyBadge";
import SummariesPanel from "./SummariesPanel";
import SupervisionInvitedCard from "./SupervisionInvitedCard";
import styles from "./SupervisionPage.module.css";
import {
  SUPERVISION_AREAS,
  SUPERVISION_AREA_LIST,
  SUPERVISION_AREA_NAV_KEYS,
  isConflict,
  normalizeArea,
  supervisionMessage,
  supervisionRequest
} from "./supervisionClient";

/**
 * Protsessi kest (Q2.6 vaated 3/3b/4/6/7/8/10). `?ala=` on PÜSIANKUR —
 * otselingitav, brauseri tagasi/edasi töötab (useSearchParams + router.push).
 * KUT-vaataja saab piiratud kaardi (server annab KUT-serializer'i), CLOSED
 * protsess suletud vaate.
 */
export default function SupervisionProcessPage({ processId }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const area = normalizeArea(searchParams.get("ala"));
  const summaryId = searchParams.get("summary") || "";

  const [process, setProcess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [outcomeId, setOutcomeId] = useState("");
  const [leaveConfirming, setLeaveConfirming] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);

  const load = useCallback(async (signal) => {
    setLoadError("");
    try {
      const { ok, status, payload } = await supervisionRequest(
        `/api/supervision/processes/${encodeURIComponent(processId)}`,
        { signal }
      );
      if (!ok) {
        setProcess(null);
        setLoadError(supervisionMessage({ status, payload, t }));
        return;
      }
      setProcess(payload?.process || null);
    } catch (error) {
      if (error?.name === "AbortError") return;
      setLoadError(t("supervision.errors.load_failed"));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [processId, t]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  /** 409 = keegi muutis vahepeal: ütle seda ja lae uuesti (Q2.6 konfliktiseis). */
  const handleConflict = useCallback(async () => {
    setNotice(t("supervision.common.conflictReload"));
    await load();
  }, [load, t]);

  const isClosed = process?.status === "CLOSED";

  // Kokkuvõtete kinnitused on grupitöö: nähtaval lehel värskendame mõõdukalt,
  // taustal ja suletud protsessis ei tee päringuid. Fookusesse naasmine
  // sünkroonib seisu kohe.
  useEffect(() => {
    if (area !== SUPERVISION_AREAS.KOKKUVOTTED || isClosed) return undefined;
    let inFlight = false;
    const refresh = async () => {
      if (document.visibilityState !== "visible" || inFlight) return;
      inFlight = true;
      try { await load(); } finally { inFlight = false; }
    };
    const onVisibilityChange = () => { if (document.visibilityState === "visible") void refresh(); };
    const timer = window.setInterval(() => { void refresh(); }, 10_000);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [area, isClosed, load]);

  // M12 pakk on PRIVAATNE ega tule protsessi vastusega — suletud vaates
  // otsime OMA pakkide loendist selle protsessi oma (Q2.6 vaade 10).
  useEffect(() => {
    if (!isClosed) return undefined;
    const controller = new AbortController();
    void (async () => {
      const { ok, payload } = await supervisionRequest("/api/supervision/outcomes", { signal: controller.signal })
        .catch(() => ({ ok: false, payload: {} }));
      if (!ok) return;
      const mine = (payload?.outcomes || []).find((row) => row.processId === processId);
      if (mine?.id) setOutcomeId(mine.id);
    })();
    return () => controller.abort();
  }, [isClosed, processId]);

  const selectArea = useCallback((next) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("ala", next);
    params.delete("summary");
    router.push(`${localizePath(`/supervisioon/${processId}`, locale)}?${params.toString()}`, { scroll: false });
  }, [locale, processId, router, searchParams]);

  const participantCount = useMemo(
    () => (process?.participants || []).filter((row) => row.status === "ACCEPTED").length,
    [process]
  );

  const leave = useCallback(async () => {
    const participationId = process?.myParticipation?.id;
    if (!participationId || leaveBusy) return;
    if (!leaveConfirming) {
      setLeaveConfirming(true);
      setNotice(t("supervision.leave.confirmHint"));
      return;
    }
    setLeaveBusy(true);
    setNotice("");
    try {
      const { ok, status, payload } = await supervisionRequest(
        `/api/supervision/participations/${encodeURIComponent(participationId)}/leave`,
        { method: "POST" }
      );
      if (!ok) {
        if (isConflict(status)) {
          await handleConflict();
          return;
        }
        setNotice(supervisionMessage({ status, payload, t, fallbackKey: "supervision.errors.save_failed" }));
        return;
      }
      setLeaveConfirming(false);
      setNotice(t("supervision.leave.done"));
      await load();
    } catch {
      setNotice(t("supervision.errors.save_failed"));
    } finally {
      setLeaveBusy(false);
    }
  }, [handleConflict, leaveBusy, leaveConfirming, load, process?.myParticipation?.id, t]);

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.shell} data-glass-back-anchor="">
          <p className={styles.loading}>{t("supervision.common.loading")}</p>
        </div>
      </main>
    );
  }

  if (loadError || !process) {
    return (
      <main className={styles.page}>
        <div className={styles.shell} data-glass-back-anchor="">
          <div className={styles.loadError}>
            <p>{loadError || t("supervision.common.notFound")}</p>
            <div className={styles.actions}>
              <Button variant="secondary" onClick={() => { setLoading(true); void load(); }}>
                {t("supervision.common.retry")}
              </Button>
              <Button as="a" href={localizePath("/supervisioon", locale)} variant="secondary">
                {t("supervision.common.back")}
              </Button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Vaade 3b: kutsutu näeb AINULT kontrakti (KUT-serializer).
  if (process.viewerRole === "KUT") {
    return <SupervisionInvitedCard onDone={load} process={process} />;
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell} data-glass-back-anchor="">
        <SubpageHeader title={process.title} />

        <div className={styles.badgeRow}>
          <span className={styles.badge}>{t(`supervision.roles.${process.viewerRole}`)}</span>
          <span className={styles.badge}>{t(`supervision.status.${process.status}`)}</span>
          <span className={styles.badge}>{t(`supervision.type.${process.type}`)}</span>
        </div>

        <p aria-live="polite" className={styles.liveRegion} role="status" tabIndex={-1}>
          {notice}
        </p>

        {isClosed ? (
          <div className={styles.closedBanner}>
            <p>{t("supervision.closed.banner")}</p>
            {process.closure?.purgeReport ? (
              <p className={styles.statusLine}>
                {t("supervision.closed.purged", {
                  topics: process.closure.purgeReport.sharedTopics ?? 0,
                  drafts: process.closure.purgeReport.draftSummaries ?? 0,
                  notes: process.closure.purgeReport.meetingNotes ?? 0
                })}
              </p>
            ) : null}
            {outcomeId ? (
              <div className={styles.actions}>
                <Button
                  as="a"
                  href={localizePath(`/supervisioon/valjundid/${outcomeId}`, locale)}
                  size="sm"
                >
                  {t("supervision.closed.openPack")}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {process.myParticipation && !process.myParticipation.hasAcceptedActiveContract && !isClosed ? (
          <div className={styles.conflict} role="status">
            <p>{t("supervision.contract.pendingContract")}</p>
          </div>
        ) : null}

        <nav className={styles.tabs}>
          {SUPERVISION_AREA_LIST.map((key) => (
            <button
              key={key}
              aria-current={area === key ? "page" : undefined}
              className={`${styles.tab} ${area === key ? styles.tabActive : ""}`}
              onClick={() => selectArea(key)}
              type="button"
            >
              {t(`supervision.nav.${SUPERVISION_AREA_NAV_KEYS[key]}`)}
            </button>
          ))}
        </nav>

        {area === SUPERVISION_AREAS.KONTRAKT ? (
          <ContractPanel onConflict={handleConflict} onReload={load} process={process} />
        ) : null}
        {/* Eeskamber hoiab OMA kirjeloendit ja lahendab CAS-konflikti ise —
            protsessi vastust see ei puuduta, seega onConflict siia ei kuulu. */}
        {area === SUPERVISION_AREAS.EESKAMBER ? <EeskamberPanel process={process} /> : null}
        {area === SUPERVISION_AREAS.KOHTUMISED ? (
          <MeetingsPanel onConflict={handleConflict} onReload={load} process={process} />
        ) : null}
        {area === SUPERVISION_AREAS.KOKKUVOTTED ? (
          <SummariesPanel
            onConflict={handleConflict}
            onReload={load}
            participantCount={participantCount}
            process={process}
            selectedSummaryId={summaryId}
          />
        ) : null}
        {area === SUPERVISION_AREAS.KAPP ? <KappPanel process={process} /> : null}

        {process.capabilities?.canClose ? (
          <div className={styles.dangerZone}>
            <PrivacyBadge scope="persistent" />
            <div className={styles.actions}>
              <Button
                as="a"
                href={localizePath(`/supervisioon/${processId}/sulge`, locale)}
                size="sm"
                variant="secondary"
              >
                {t("supervision.close.title")}
              </Button>
            </div>
          </div>
        ) : null}

        {process.capabilities?.canLeave ? (
          <div className={styles.dangerZone}>
            <p>{leaveConfirming ? t("supervision.leave.confirmHint") : t("supervision.leave.hint")}</p>
            <div className={styles.actions}>
              <Button disabled={leaveBusy} onClick={leave} size="sm" variant="secondary">
                {leaveBusy
                  ? t("supervision.common.saving")
                  : leaveConfirming
                    ? t("supervision.leave.confirm")
                    : t("supervision.leave.action")}
              </Button>
              {leaveConfirming ? (
                <Button
                  disabled={leaveBusy}
                  onClick={() => { setLeaveConfirming(false); setNotice(""); }}
                  size="sm"
                  variant="secondary"
                >
                  {t("supervision.common.cancel")}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
