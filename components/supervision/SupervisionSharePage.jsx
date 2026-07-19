"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import { localizePath } from "@/lib/localizePath";
import PrivacyBadge from "./PrivacyBadge";
import styles from "./SupervisionPage.module.css";
import { isConflict, supervisionMessage, supervisionRequest } from "./supervisionClient";

/**
 * Vaade 5 „Jagamise eelvaade" = LÄVI (Q2.6). Kaheastmeline TEADLIK värav:
 * eelvaade näitab TÄPSELT need väljad, mis serverisse lähevad (pealkiri, sisu,
 * audience — shareTopic allowlist), ja nimeliselt selle, KES neid pärast näeb.
 * Ükski väli ei jõua siit edasi vaikselt: manifest ON kirje ise (külmutatud
 * koopia), seega mida siin näed, seda jagad.
 */
export default function SupervisionSharePage({ processId }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const itemId = searchParams.get("item") || "";

  const [process, setProcess] = useState(null);
  const [item, setItem] = useState(null);
  const [audience, setAudience] = useState("SUPERVISOR_ONLY");
  const [step, setStep] = useState("preview");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [notReady, setNotReady] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (signal) => {
    setLoadError("");
    try {
      const [detail, privateItems] = await Promise.all([
        supervisionRequest(`/api/supervision/processes/${encodeURIComponent(processId)}`, { signal }),
        supervisionRequest(
          `/api/supervision/processes/${encodeURIComponent(processId)}/private-items`,
          { signal }
        )
      ]);
      if (!detail.ok) {
        setLoadError(supervisionMessage({ status: detail.status, payload: detail.payload, t }));
        return;
      }
      setProcess(detail.payload?.process || null);
      if (!detail.payload?.process?.capabilities?.canShareTopic) setNotReady(true);
      if (privateItems.ok) {
        const found = (privateItems.payload?.items || []).find((row) => row.id === itemId);
        setItem(found || null);
        if (!found) setLoadError(t("supervision.common.notFound"));
      } else {
        setLoadError(supervisionMessage({ status: privateItems.status, payload: privateItems.payload, t }));
      }
    } catch (error) {
      if (error?.name === "AbortError") return;
      setLoadError(t("supervision.errors.load_failed"));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [itemId, processId, t]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  /** Kes NÄEVAD pärast jagamist — nimeliselt, mitte „osalejad" üldiselt. */
  const audienceNames = useMemo(() => {
    if (!process) return [];
    const supervisor = process.supervisorName ? [process.supervisorName] : [];
    if (audience === "SUPERVISOR_ONLY") return supervisor;
    const members = (process.participants || [])
      .filter((row) => row.status === "ACCEPTED" && row.name)
      .map((row) => row.name);
    return [...supervisor, ...members];
  }, [audience, process]);

  /**
   * Server NÕUAB pealkirja; pealkirjata eeskambri kirjel tuletame selle sisust.
   * Tuletus toimub ÜHES kohas ja eelvaade näitab TÄPSELT seda väärtust — muidu
   * näeks kasutaja tühja pealkirja ja jagaks tegelikult tuletatut.
   */
  const shareTitle = useMemo(
    () => (item ? (item.title || item.body.slice(0, 200)) : ""),
    [item]
  );

  const share = useCallback(async () => {
    if (!item) return;
    setSaving(true);
    setMessage("");
    try {
      const { ok, status, payload } = await supervisionRequest(
        `/api/supervision/processes/${encodeURIComponent(processId)}/topics`,
        {
          method: "POST",
          body: { title: shareTitle, body: item.body, audience, sourcePrivateItemId: item.id }
        }
      );
      if (!ok) {
        // 409 CONTRACT_NOT_ACCEPTED (OS†) on OMA olek: kasutaja peab enne
        // kehtiva kontraktiversiooni kinnitama, mitte „proovi uuesti".
        if (isConflict(status) && payload?.messageKey === "supervision.errors.contract_not_accepted") {
          setNotReady(true);
          return;
        }
        setMessage(supervisionMessage({ status, payload, t, fallbackKey: "supervision.errors.save_failed" }));
        return;
      }
      router.push(localizePath(`/supervisioon/${processId}?ala=eeskamber`, locale));
    } catch {
      setMessage(t("supervision.errors.save_failed"));
    } finally {
      setSaving(false);
    }
  }, [audience, item, locale, processId, router, shareTitle, t]);

  const backHref = localizePath(`/supervisioon/${processId}?ala=eeskamber`, locale);

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
        <SubpageHeader title={t("supervision.share.title")} />
        <p className={styles.lead}>{t("supervision.share.intro")}</p>

        <p aria-live="polite" className={styles.liveRegion} role="status" tabIndex={-1}>
          {message}
        </p>

        {loadError ? (
          <div className={styles.loadError}>
            <p>{loadError}</p>
            <Button as="a" href={backHref} variant="secondary">
              {t("supervision.share.back")}
            </Button>
          </div>
        ) : null}

        {!loadError && notReady ? (
          <div className={styles.conflict} role="status">
            <p>{t("supervision.share.notReady")}</p>
            <div className={styles.actions}>
              <Button as="a" href={localizePath(`/supervisioon/${processId}?ala=kontrakt`, locale)} size="sm">
                {t("supervision.nav.contract")}
              </Button>
              <Button as="a" href={backHref} size="sm" variant="secondary">
                {t("supervision.share.back")}
              </Button>
            </div>
          </div>
        ) : null}

        {!loadError && !notReady && item ? (
          <>
            {step === "preview" ? (
              <section className={styles.section}>
                <label className={styles.form}>
                  {t("supervision.share.audienceLabel")}
                  <select onChange={(event) => setAudience(event.target.value)} value={audience}>
                    <option value="SUPERVISOR_ONLY">{t("supervision.share.audience_SUPERVISOR_ONLY")}</option>
                    <option value="PROCESS">{t("supervision.share.audience_PROCESS")}</option>
                  </select>
                </label>
              </section>
            ) : null}

            {/* Manifest = TÄPSELT need väljad, mis serverisse lähevad. */}
            <div className={styles.manifest}>
              <div className={styles.manifestRow}>
                <span className={styles.manifestKey}>{t("supervision.eeskamber.titleLabel")}</span>
                <p className={styles.manifestValue}>{shareTitle}</p>
              </div>
              <div className={styles.manifestRow}>
                <span className={styles.manifestKey}>{t("supervision.eeskamber.bodyLabel")}</span>
                <p className={styles.manifestValue}>{item.body}</p>
              </div>
              <div className={styles.manifestRow}>
                <span className={styles.manifestKey}>{t("supervision.share.audienceLabel")}</span>
                <p className={styles.manifestValue}>{t(`supervision.share.audience_${audience}`)}</p>
              </div>
              <div className={styles.manifestRow}>
                <span className={styles.manifestKey}>{t("supervision.share.willSee")}</span>
                <p className={styles.manifestValue}>{audienceNames.join(", ")}</p>
              </div>
            </div>

            <PrivacyBadge
              count={Math.max(audienceNames.length - 1, 0)}
              scope={audience === "SUPERVISOR_ONLY" ? "supervisor" : "process"}
            />

            <div className={styles.actions}>
              {step === "preview" ? (
                <Button onClick={() => setStep("confirm")}>{t("supervision.share.confirm")}</Button>
              ) : (
                <Button disabled={saving} onClick={share}>
                  {saving ? t("supervision.common.saving") : t("supervision.common.confirm")}
                </Button>
              )}
              {step === "confirm" ? (
                <Button onClick={() => setStep("preview")} variant="secondary">
                  {t("supervision.common.back")}
                </Button>
              ) : null}
              <Button as="a" href={backHref} variant="secondary">
                {t("supervision.share.back")}
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
