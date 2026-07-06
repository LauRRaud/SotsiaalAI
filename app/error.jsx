"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import { localizePath } from "@/lib/localizePath";
import { pushWithTransition } from "@/lib/routeTransition";
import BackButton from "@/components/ui/BackButton";
import Button from "@/components/ui/Button";
export default function Error({
  error,
  reset
}) {
  const router = useRouter();
  const {
    t,
    locale
  } = useI18n();
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);
  const backLabel = t("buttons.back_previous");
  const handleBack = () => {
    try {
      if (typeof window !== "undefined" && window.history.length > 1) return router.back();
    } catch {}
    return pushWithTransition(router, localizePath("/", locale));
  };
  return <section>
      <BackButton onClick={handleBack} ariaLabel={backLabel} />
      <div>
        <h1>{t("errors.title")}</h1>
        <p>{t("errors.description")}</p>
      </div>
      <Button type="button" onClick={() => reset()}>
        {t("errors.retry")}
      </Button>
    </section>;
}
