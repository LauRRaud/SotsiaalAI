"use client";

import dynamic from "next/dynamic";
import { useI18n } from "@/components/i18n/I18nProvider";
import UsageAdminPanel from "@/components/admin/usage/UsageAdminPanel";
import DeletionJobsPanel from "@/components/admin/usage/DeletionJobsPanel";
import NotificationOperationsPanel from "@/components/admin/NotificationOperationsPanel";

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
  return <>
      <AnalyticsDashboard />
      <UsageAdminPanel />
      <DeletionJobsPanel />
      <NotificationOperationsPanel />
    </>;
}
