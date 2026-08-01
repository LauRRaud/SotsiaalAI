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
/* Kõik neli plokki on ÜHE lehe sektsioonid, mitte neli iseseisvat vidinat:
   ühine .aa-shell annab neile sama rütmi, sama pinna ja sama juhtelementide
   mõõdu (app/styles/admin-analytics.css). */
export default function AdminAnalyticsClient() {
  return (
    <div className="aa-shell">
      <AnalyticsDashboard />
      <UsageAdminPanel />
      <DeletionJobsPanel />
      <NotificationOperationsPanel />
    </div>
  );
}
