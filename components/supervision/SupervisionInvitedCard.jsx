"use client";

import { useCallback, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import { localizePath } from "@/lib/localizePath";
import PrivacyBadge from "./PrivacyBadge";
import styles from "./SupervisionPage.module.css";
import { isConflict, supervisionMessage, supervisionRequest } from "./supervisionClient";

/**
 * Vaade 3b „Kutsutu vastamisvaade" (Q2.6). Kutsutu näeb AINULT pealkirja,
 * superviisori nime, tüüpi ja aktiivset kontraktiteksti — see piir tuleb
 * serveri KUT-serializer'ist, siin seda ei laiendata. Aegunud versioon → 409
 * ja UUS tekst laetakse enne, kui kasutaja saab uuesti kinnitada.
 */
export default function SupervisionInvitedCard({ process, onDone }) {
  const { t, locale } = useI18n();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [declined, setDeclined] = useState(process?.myParticipation?.status === "DECLINED");

  const respond = useCallback(async (action) => {
    setBusy(action);
    setMessage("");
    try {
      const { ok, status, payload } = await supervisionRequest(
        `/api/supervision/participations/${encodeURIComponent(process.myParticipation.id)}/respond`,
        {
          method: "POST",
          body: action === "accept"
            ? { action, contractVersionId: process.activeContract?.id || "" }
            : { action }
        }
      );
      if (!ok) {
        setMessage(
          isConflict(status)
            ? t("supervision.common.conflictReload")
            : supervisionMessage({ status, payload, t, fallbackKey: "supervision.errors.save_failed" })
        );
        // Konflikt = kontraktiversioon vahetus: too värske tekst kohe.
        if (isConflict(status)) await onDone?.();
        return;
      }
      if (action === "decline") setDeclined(true);
      await onDone?.();
    } catch {
      setMessage(t("supervision.errors.save_failed"));
    } finally {
      setBusy("");
    }
  }, [onDone, process, t]);

  return (
    <main className={styles.page}>
      <div className={styles.shell} data-glass-back-anchor="">
        <SubpageHeader title={t("supervision.invited.title")} />

        <div className={styles.badgeRow}>
          <span className={styles.badge}>{t(`supervision.type.${process.type}`)}</span>
        </div>
        <PrivacyBadge scope="invited" />

        <p className={styles.cardMeta}>{process.title}</p>
        <p className={styles.cardMeta}>{process.supervisorName}</p>

        <p aria-live="polite" className={styles.liveRegion} role="status" tabIndex={-1}>
          {message}
        </p>

        {declined ? (
          <p className={styles.statusLine}>{t("supervision.invited.declined")}</p>
        ) : (
          <>
            <section className={styles.section}>
              <div className={styles.sectionHeading}>
                <h2>{t("supervision.contract.activeVersion")}</h2>
                <p>{t("supervision.invited.readContract")}</p>
              </div>
              {process.activeContract ? (
                <div className={styles.item}>
                  <span className={styles.badge}>
                    {t("supervision.contract.versionN", { n: process.activeContract.versionNumber })}
                  </span>
                  <p className={styles.itemBody}>{process.activeContract.body}</p>
                </div>
              ) : (
                <p className={styles.empty}>{t("supervision.contract.noActive")}</p>
              )}
            </section>

            <div className={styles.actions}>
              <Button
                disabled={Boolean(busy) || !process.activeContract}
                onClick={() => respond("accept")}
              >
                {busy === "accept" ? t("supervision.common.saving") : t("supervision.invited.accept")}
              </Button>
              <Button disabled={Boolean(busy)} onClick={() => respond("decline")} variant="secondary">
                {t("supervision.invited.decline")}
              </Button>
            </div>
          </>
        )}

        <div className={styles.backRow}>
          <Button as="a" href={localizePath("/supervisioon", locale)} size="sm" variant="secondary">
            {t("supervision.common.back")}
          </Button>
        </div>
      </div>
    </main>
  );
}
