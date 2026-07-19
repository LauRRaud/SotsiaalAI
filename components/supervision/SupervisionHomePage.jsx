"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import { localizePath } from "@/lib/localizePath";
import PrivacyBadge from "./PrivacyBadge";
import styles from "./SupervisionPage.module.css";
import { supervisionMessage, supervisionRequest } from "./supervisionClient";

/** Vaade 1 „Minu protsessid" (Q2.6). Kerge loend — EI kanna protsessi sisu. */
export default function SupervisionHomePage() {
  const { t, locale } = useI18n();
  const [processes, setProcesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const formatter = useMemo(
    () => new Intl.DateTimeFormat(locale || "et", { dateStyle: "medium" }),
    [locale]
  );
  const formatDate = useCallback((value) => {
    if (!value) return "";
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? formatter.format(date) : "";
  }, [formatter]);

  const load = useCallback(async (signal) => {
    setLoadError("");
    try {
      const { ok, status, payload } = await supervisionRequest("/api/supervision/processes", { signal });
      if (!ok) {
        setLoadError(supervisionMessage({ status, payload, t }));
        setProcesses([]);
        return;
      }
      setProcesses(payload?.processes || []);
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
        <SubpageHeader title={t("supervision.home.title")} />
        <p className={styles.lead}>{t("supervision.home.subtitle")}</p>

        <div className={styles.actions}>
          <Button as="a" href={localizePath("/supervisioon/uus", locale)} size="sm">
            {t("supervision.home.newProcess")}
          </Button>
          <Button as="a" href={localizePath("/supervisioon/valjundid", locale)} size="sm" variant="secondary">
            {t("supervision.outcome.list")}
          </Button>
        </div>

        {loading ? <p className={styles.loading}>{t("supervision.common.loading")}</p> : null}

        {loadError ? (
          <div aria-live="polite" className={styles.loadError} role="status">
            <p>{loadError}</p>
            <Button variant="secondary" onClick={() => { setLoading(true); void load(); }}>
              {t("supervision.common.retry")}
            </Button>
          </div>
        ) : null}

        {!loading && !loadError && !processes.length ? (
          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <h2>{t("supervision.home.emptyTitle")}</h2>
              <p>{t("supervision.home.emptyBody")}</p>
            </div>
          </section>
        ) : null}

        {!loading && !loadError && processes.length ? (
          <section className={styles.section}>
            <div className={styles.cards}>
              {processes.map((process) => (
                <article key={process.id} className={styles.card}>
                  <h2 className={styles.cardTitle}>{process.title}</h2>
                  <div className={styles.badgeRow}>
                    <span className={styles.badge}>
                      {t("supervision.home.roleLabel")}
                      {": "}
                      {t(`supervision.roles.${process.viewerRole}`)}
                    </span>
                    <span className={styles.badge}>{t(`supervision.status.${process.status}`)}</span>
                    <span className={styles.badge}>{t(`supervision.type.${process.type}`)}</span>
                  </div>
                  {process.viewerRole === "KUT" ? <PrivacyBadge scope="invited" /> : null}
                  <p className={styles.cardMeta}>{process.supervisorName}</p>
                  <p className={styles.cardMeta}>{formatDate(process.lastActivityAt)}</p>
                  <div className={styles.actions}>
                    <Button
                      as="a"
                      href={localizePath(`/supervisioon/${process.id}`, locale)}
                      size="sm"
                      variant="secondary"
                    >
                      {t("supervision.home.open")}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
