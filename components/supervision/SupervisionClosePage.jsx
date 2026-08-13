"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import { localizePath } from "@/lib/localizePath";
import styles from "./SupervisionPage.module.css";
import { isConflict, supervisionMessage, supervisionRequest } from "./supervisionClient";

/**
 * Vaade 9 „Sulgemise eelvaade" (Q2.6). Sulgemine on PÖÖRDUMATU: jagatud
 * toorsisu kustub ühes tehingus. Seepärast on siin LOEND, mitte lause — kaks
 * selgelt eristatud tulpa „Kustub" / „Jääb" — ja kinnitus on kaheastmeline
 * koos üldistatud pealkirja sisestusega (see asendab praeguse pealkirja).
 *
 * 409-d on eristatud: ootel kokkuvõtted annavad OTSELINGID nende juurde;
 * juba suletud protsess suunab suletud vaatesse (mitte veateate taha).
 */
export default function SupervisionClosePage({ processId }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [preview, setPreview] = useState(null);
  const [process, setProcess] = useState(null);
  const [generalizedTitle, setGeneralizedTitle] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pendingIds, setPendingIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (signal) => {
    setLoadError("");
    try {
      const [previewResult, detail] = await Promise.all([
        supervisionRequest(
          `/api/supervision/processes/${encodeURIComponent(processId)}/close-preview`,
          { signal }
        ),
        supervisionRequest(`/api/supervision/processes/${encodeURIComponent(processId)}`, { signal })
      ]);
      if (!previewResult.ok) {
        setLoadError(supervisionMessage({ status: previewResult.status, payload: previewResult.payload, t }));
        return;
      }
      setPreview(previewResult.payload?.preview || null);
      setPendingIds(previewResult.payload?.preview?.pendingSummaryIds || []);
      if (detail.ok) setProcess(detail.payload?.process || null);
      if (previewResult.payload?.preview?.alreadyClosed) {
        router.replace(localizePath(`/supervisioon/${processId}`, locale));
      }
    } catch (error) {
      if (error?.name === "AbortError") return;
      setLoadError(t("supervision.errors.load_failed"));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [locale, processId, router, t]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const close = useCallback(async () => {
    const title = generalizedTitle.trim();
    if (!title || !process) return;
    setSaving(true);
    setMessage("");
    try {
      const { ok, status, payload } = await supervisionRequest(
        `/api/supervision/processes/${encodeURIComponent(processId)}/close`,
        { method: "POST", body: { expectedVersion: process.version, generalizedTitle: title } }
      );
      if (!ok) {
        if (isConflict(status) && payload?.messageKey === "supervision.errors.already_closed") {
          router.replace(localizePath(`/supervisioon/${processId}`, locale));
          return;
        }
        if (isConflict(status) && payload?.messageKey === "supervision.errors.pending_summaries") {
          setConfirming(false);
          await load();
          setMessage(t("supervision.close.pendingBlock"));
          return;
        }
        setConfirming(false);
        setMessage(supervisionMessage({ status, payload, t, fallbackKey: "supervision.errors.save_failed" }));
        return;
      }
      router.replace(localizePath(`/supervisioon/${processId}`, locale));
    } catch {
      setMessage(t("supervision.errors.save_failed"));
    } finally {
      setSaving(false);
    }
  }, [generalizedTitle, load, locale, process, processId, router, t]);

  const backHref = localizePath(`/supervisioon/${processId}`, locale);

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.shell} data-glass-back-anchor="">
          <p className={styles.loading}>{t("supervision.common.loading")}</p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell} data-glass-back-anchor="">
        <SubpageHeader title={t("supervision.close.title")} />
        <p className={styles.lead}>{t("supervision.close.intro")}</p>

        <p aria-live="polite" className={styles.liveRegion} role="status" tabIndex={-1}>
          {message}
        </p>

        {loadError ? (
          <div className={styles.loadError}>
            <p>{loadError}</p>
            <Button as="a" href={backHref} variant="secondary">
              {t("supervision.common.back")}
            </Button>
          </div>
        ) : null}

        {!loadError && preview ? (
          <>
            <div className={styles.keepPurgeGrid}>
              <div className={styles.purgeCol}>
                <h2 className={styles.colHeading}>{t("supervision.close.willDelete")}</h2>
                <ul className={styles.colList}>
                  <li>
                    {t("supervision.close.sharedTopics")}
                    {": "}
                    {preview.willDelete?.sharedTopics ?? 0}
                  </li>
                  <li>
                    {t("supervision.close.draftSummaries")}
                    {": "}
                    {preview.willDelete?.draftSummaries ?? 0}
                  </li>
                  <li>
                    {t("supervision.close.meetingNotes")}
                    {": "}
                    {preview.willDelete?.meetingNotes ?? 0}
                  </li>
                </ul>
              </div>

              <div className={styles.keepCol}>
                <h2 className={styles.colHeading}>{t("supervision.close.willKeep")}</h2>
                <ul className={styles.colList}>
                  <li>
                    {t("supervision.close.approvedSummaries")}
                    {": "}
                    {preview.willKeep?.approvedSummaries ?? 0}
                  </li>
                  <li>
                    {t("supervision.close.meetingFacts")}
                    {": "}
                    {preview.willKeep?.meetings ?? 0}
                  </li>
                  <li>{t("supervision.close.contractVersions", { count: preview.willKeep?.contractVersions ?? 0 })}</li>
                  <li>{t("supervision.close.contractAcceptances", { count: preview.willKeep?.contractAcceptances ?? 0 })}</li>
                  <li>{t("supervision.close.auditTrail", { count: preview.willKeep?.auditEvents ?? 0 })}</li>
                  <li>{t("supervision.close.closureFacts")}</li>
                  <li>{t("supervision.close.privateItems")}</li>
                  <li>{t("supervision.close.personalOutcomes", { count: preview.willKeep?.personalOutcomes ?? 0 })}</li>
                </ul>
              </div>
            </div>

            {pendingIds.length ? (
              <div className={styles.conflict} role="status">
                <p>{t("supervision.close.pendingBlock")}</p>
                <div className={styles.actions}>
                  {pendingIds.map((sid) => (
                    <Button
                      key={sid}
                      as="a"
                      href={localizePath(
                        `/supervisioon/${processId}?ala=kokkuvotted&summary=${encodeURIComponent(sid)}`,
                        locale
                      )}
                      size="sm"
                      variant="secondary"
                    >
                      {t("supervision.summaries.title")}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            {!preview.canClose && !pendingIds.length ? (
              <p className={styles.statusLine}>{t("supervision.close.onlySupervisor")}</p>
            ) : null}

            {preview.canClose ? (
              <div className={styles.dangerZone}>
                <div className={styles.form}>
                  <label>
                    {t("supervision.close.generalizedTitleLabel")}
                    <Input
                      maxLength={200}
                      onChange={(event) => setGeneralizedTitle(event.target.value)}
                      required
                      value={generalizedTitle}
                    />
                  </label>
                </div>

                <div className={styles.actions}>
                  {confirming ? (
                    <>
                      <Button disabled={saving || !generalizedTitle.trim()} onClick={close}>
                        {saving ? t("supervision.common.saving") : t("supervision.common.confirm")}
                      </Button>
                      <Button onClick={() => setConfirming(false)} variant="secondary">
                        {t("supervision.common.cancel")}
                      </Button>
                    </>
                  ) : (
                    <Button
                      disabled={!generalizedTitle.trim()}
                      onClick={() => setConfirming(true)}
                    >
                      {t("supervision.close.confirm")}
                    </Button>
                  )}
                  <Button as="a" href={backHref} variant="secondary">
                    {t("supervision.common.back")}
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
