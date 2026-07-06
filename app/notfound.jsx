"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import { localizePath } from "@/lib/localizePath";
import { pushWithTransition } from "@/lib/routeTransition";
export default function NotFound() {
  const router = useRouter();
  const {
    t,
    locale
  } = useI18n();
  return <div>
      <h1>{t("notFound.title")}</h1>
      <p>{t("notFound.description")}</p>
      <div>
        <button type="button" onClick={() => pushWithTransition(router, localizePath("/", locale))} aria-label={t("buttons.back_home")} />
      </div>
    </div>;
}
