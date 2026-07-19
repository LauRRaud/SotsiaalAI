"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import { localizePath } from "@/lib/localizePath";
import PrivacyBadge from "./PrivacyBadge";
import styles from "./SupervisionPage.module.css";
import { supervisionMessage, supervisionRequest } from "./supervisionClient";

/**
 * Vaade 10 (isiklik pool) „Minu isiklik pakk" (M12). Kuulub AINULT omanikule —
 * ka superviisor ei näe teiste omi (server: 404). Sisu on KÜLMUTATUD koopia
 * sulgemishetkest, seega siin ei ole ühtegi muutmisteed.
 */
export default function SupervisionOutcomePage({ outcomeId }) {
  const { t, locale } = useI18n();
  const [outcome, setOutcome] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async (signal) => {
    setLoadError("");
    try {
      const { ok, status, payload } = await supervisionRequest(
        `/api/supervision/outcomes/${encodeURIComponent(outcomeId)}`,
        { signal }
      );
      if (!ok) {
        setLoadError(supervisionMessage({ status, payload, t }));
        return;
      }
      setOutcome(payload?.outcome || null);
    } catch (error) {
      if (error?.name === "AbortError") return;
      setLoadError(t("supervision.errors.load_failed"));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [outcomeId, t]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const summaries = outcome?.content?.approvedSummaries || [];
  const contractBody = outcome?.content?.lastAcceptedContractBody || "";

  return (
    <main className={styles.page}>
      <div className={styles.shell} data-glass-back-anchor="">
        <SubpageHeader title={t("supervision.outcome.title")} />
        <p className={styles.lead}>{t("supervision.outcome.intro")}</p>

        <PrivacyBadge scope="private" />

        {loading ? <p className={styles.loading}>{t("supervision.common.loading")}</p> : null}

        {loadError ? (
          <div aria-live="polite" className={styles.loadError} role="status">
            <p>{loadError}</p>
            <Button as="a" href={localizePath("/supervisioon/valjundid", locale)} variant="secondary">
              {t("supervision.common.back")}
            </Button>
          </div>
        ) : null}

        {!loading && !loadError && outcome ? (
          <>
            <p className={styles.cardMeta}>{outcome.processTitleGeneralized}</p>

            {contractBody ? (
              <section className={styles.section}>
                <div className={styles.sectionHeading}>
                  <h2>{t("supervision.outcome.contract")}</h2>
                </div>
                <div className={styles.item}>
                  <p className={styles.itemBody}>{contractBody}</p>
                </div>
              </section>
            ) : null}

            <section className={styles.section}>
              <div className={styles.sectionHeading}>
                <h2>{t("supervision.outcome.summaries")}</h2>
              </div>
              {summaries.length ? (
                <div className={styles.itemList}>
                  {summaries.map((summary, index) => (
                    <article key={`${summary.kind}-${summary.meetingId || index}`} className={styles.item}>
                      <div className={styles.badgeRow}>
                        <span className={styles.badge}>
                          {t(`supervision.summaries.${summary.kind === "FINAL" ? "final" : "meeting"}`)}
                        </span>
                      </div>
                      <p className={styles.itemBody}>{summary.body}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className={styles.empty}>{t("supervision.kapp.empty")}</p>
              )}
            </section>
          </>
        ) : null}

        <div className={styles.backRow}>
          <Button as="a" href={localizePath("/supervisioon/valjundid", locale)} size="sm" variant="secondary">
            {t("supervision.common.back")}
          </Button>
        </div>
      </div>
    </main>
  );
}
