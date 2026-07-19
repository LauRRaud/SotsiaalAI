"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import { localizePath } from "@/lib/localizePath";
import PrivacyBadge from "./PrivacyBadge";
import styles from "./SupervisionPage.module.css";
import { supervisionMessage, supervisionRequest } from "./supervisionClient";

/**
 * „Minu paketid" (M12 loend). Isiklikud püsiväljundid elavad protsessist ÜLE —
 * seepärast on neil oma marsruut, mitte ainult link suletud protsessist.
 */
export default function SupervisionOutcomeListPage() {
  const { t, locale } = useI18n();
  const [outcomes, setOutcomes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const formatter = useMemo(
    () => new Intl.DateTimeFormat(locale || "et", { dateStyle: "medium" }),
    [locale]
  );

  const load = useCallback(async (signal) => {
    setLoadError("");
    try {
      const { ok, status, payload } = await supervisionRequest("/api/supervision/outcomes", { signal });
      if (!ok) {
        setLoadError(supervisionMessage({ status, payload, t }));
        return;
      }
      setOutcomes(payload?.outcomes || []);
    } catch (error) {
      if (error?.name === "AbortError") return;
      setLoadError(t("supervision.errors.load_failed"));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <main className={styles.page}>
      <div className={styles.shell} data-glass-back-anchor="">
        <SubpageHeader title={t("supervision.outcome.list")} />
        <PrivacyBadge scope="private" />

        {loading ? <p className={styles.loading}>{t("supervision.common.loading")}</p> : null}

        {loadError ? (
          <div aria-live="polite" className={styles.loadError} role="status">
            <p>{loadError}</p>
            <Button onClick={() => { setLoading(true); void load(); }} variant="secondary">
              {t("supervision.common.retry")}
            </Button>
          </div>
        ) : null}

        {!loading && !loadError && !outcomes.length ? (
          <p className={styles.empty}>{t("supervision.outcome.empty")}</p>
        ) : null}

        {!loading && !loadError && outcomes.length ? (
          <div className={styles.cards}>
            {outcomes.map((outcome) => (
              <article key={outcome.id} className={styles.card}>
                <h2 className={styles.cardTitle}>{outcome.processTitleGeneralized}</h2>
                <p className={styles.cardMeta}>
                  {outcome.createdAt ? formatter.format(new Date(outcome.createdAt)) : ""}
                </p>
                <div className={styles.actions}>
                  <Button
                    as="a"
                    href={localizePath(`/supervisioon/valjundid/${outcome.id}`, locale)}
                    size="sm"
                    variant="secondary"
                  >
                    {t("supervision.home.open")}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        <div className={styles.backRow}>
          <Button as="a" href={localizePath("/supervisioon", locale)} size="sm" variant="secondary">
            {t("supervision.common.back")}
          </Button>
        </div>
      </div>
    </main>
  );
}
