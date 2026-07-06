"use client";

import dynamic from "next/dynamic";
import { useI18n } from "@/components/i18n/I18nProvider";

function LoadingFallback() {
  const { t } = useI18n();
  return <div style={{ opacity: 0.75 }}>{t("admin.common.loading_data", "Loading...")}</div>;
}

const FrameworkAcceptancesAdmin = dynamic(
  () => import("@/components/admin/FrameworkAcceptancesAdmin"),
  {
    ssr: false,
    loading: () => <LoadingFallback />
  }
);

export default function AdminFrameworkAcceptancesClient() {
  return <FrameworkAcceptancesAdmin />;
}
