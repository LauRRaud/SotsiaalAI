"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import PrivacyBadge from "./PrivacyBadge";
import styles from "./SupervisionPage.module.css";

/**
 * Vaade 8 „Kinnitatud väljundite kapp" (Q2.6). Puhas lugemisvaade: kinnitatud
 * kokkuvõtted + kehtiv kontrakt. Märgis ütleb, MIKS need siin on — need jäävad
 * alles ka pärast sulgemist (erinevalt jagatud toorsisust, mis kustub).
 */
export default function KappPanel({ process }) {
  const { t } = useI18n();
  const approved = (process.summaries || []).filter((summary) => summary.status === "APPROVED");
  const hasContent = approved.length > 0 || Boolean(process.activeContract);

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <h2>{t("supervision.kapp.title")}</h2>
        <p>{t("supervision.kapp.intro")}</p>
      </div>

      <PrivacyBadge scope="persistent" />

      {!hasContent ? <p className={styles.empty}>{t("supervision.kapp.empty")}</p> : null}

      {hasContent ? (
        <div className={styles.itemList}>
          {process.activeContract ? (
            <article className={styles.item}>
              <div className={styles.badgeRow}>
                <span className={styles.badge}>
                  {t("supervision.contract.versionN", { n: process.activeContract.versionNumber })}
                </span>
              </div>
              <h3 className={styles.itemTitle}>{t("supervision.outcome.contract")}</h3>
              <p className={styles.itemBody}>{process.activeContract.body}</p>
            </article>
          ) : null}

          {approved.map((summary) => (
            <article key={summary.id} className={styles.item}>
              <div className={styles.badgeRow}>
                <span className={styles.badge}>
                  {t(`supervision.summaries.${summary.kind === "FINAL" ? "final" : "meeting"}`)}
                </span>
              </div>
              <p className={styles.itemBody}>{summary.body}</p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
