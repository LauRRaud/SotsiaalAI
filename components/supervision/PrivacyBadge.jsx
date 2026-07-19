"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import styles from "./SupervisionPage.module.css";

/**
 * PÜSIELEMENT, mitte tooltip (Q2.6 ühisreegel + SUP-P10 invariant): iga vaade,
 * mis kannab sisu, näitab nähtavalt, KES seda näeb. Nelja sisukategooria
 * (Q2.6 „sisu neljane jaotus") märgised elavad ühes kohas, et ükski vaade ei
 * saaks neid vaikselt lahku triivida.
 */
export default function PrivacyBadge({ scope, count = 0 }) {
  const { t } = useI18n();

  if (scope === "private") {
    return (
      <span className={`${styles.privacy} ${styles.privacyPrivate}`} data-privacy="private">
        {t("supervision.privacy.onlyYou")}
      </span>
    );
  }
  if (scope === "supervisor") {
    return (
      <span className={`${styles.privacy} ${styles.privacyShared}`} data-privacy="supervisor">
        {t("supervision.privacy.seenBySupervisor")}
      </span>
    );
  }
  if (scope === "process") {
    return (
      <span className={`${styles.privacy} ${styles.privacyShared}`} data-privacy="process">
        {t("supervision.privacy.seenByProcess", { count })}
      </span>
    );
  }
  if (scope === "persistent") {
    return (
      <span className={`${styles.privacy} ${styles.privacyPersistent}`} data-privacy="persistent">
        {t("supervision.privacy.persistent")}
      </span>
    );
  }
  if (scope === "invited") {
    return (
      <span className={`${styles.privacy} ${styles.privacyShared}`} data-privacy="invited">
        {t("supervision.privacy.invitedHint")}
      </span>
    );
  }
  return null;
}
