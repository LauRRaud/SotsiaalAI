"use client";

/* „Loe, aga ära loo" riba aegunud tellimusega kontole (KÕVA REEGEL,
   SotsiaalAI.md: oma andmete lugemine ja kustutamine ei sõltu tellimusest;
   loomine ja AI-kulu küll). Renderdatakse lehe tasandil fikseeritud ribana
   paneeli kohale, et mitte muuta töökihi-komponentide sisemist struktuuri. */

import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";

export default function SubscriptionReadOnlyBanner() {
  const { t } = useI18n();
  return (
    <div
      role="status"
      style={{
        position: "fixed",
        top: "calc(env(safe-area-inset-top, 0px) + 10px)",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 60,
        maxWidth: "min(92vw, 560px)",
        padding: "0.55rem 0.9rem",
        borderRadius: "0.75rem",
        border: "1px solid rgba(255,255,255,0.16)",
        background: "rgba(10,12,16,0.82)",
        WebkitBackdropFilter: "blur(10px)",
        backdropFilter: "blur(10px)",
        fontSize: "0.85rem",
        lineHeight: 1.35,
        textAlign: "center"
      }}
    >
      <strong>{t("subscriptionGate.readonly_title")}</strong>{" "}
      {t("subscriptionGate.readonly_body")}{" "}
      <Link href="/tellimus">{t("subscriptionGate.readonly_cta")}</Link>
    </div>
  );
}
