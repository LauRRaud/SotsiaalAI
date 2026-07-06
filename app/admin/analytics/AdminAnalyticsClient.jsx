"use client";

import dynamic from "next/dynamic";
import { useI18n } from "@/components/i18n/I18nProvider";

function LoadingFallback() {
  const { t } = useI18n();
  return (
    <div
      style={{
        opacity: 0.75
      }}
    >
      {t("admin.common.loading_data")}
    </div>
  );
}

const AnalyticsDashboard = dynamic(() => import("@/components/admin/AnalyticsDashboard"), {
  ssr: false,
  loading: () => <LoadingFallback />
});
export default function AdminAnalyticsClient() {
  return <AnalyticsDashboard />;
}
