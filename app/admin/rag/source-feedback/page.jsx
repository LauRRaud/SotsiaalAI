import RagAdminPageFrame from "@/components/admin/rag/RagAdminPageFrame";
import RagAdminSourceFeedbackScreen from "@/components/admin/rag/RagAdminSourceFeedbackScreen";
import { getRagAdminCopy } from "@/components/admin/rag/ragAdminCopy";
import { requireAdminRagAccess } from "../pageHelpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export const metadata = {
  title: "Source feedback - SotsiaalAI",
  robots: { index: false, follow: false, nocache: true }
};

export default async function AdminSourceFeedbackPage() {
  const { locale } = await requireAdminRagAccess("/admin/rag/source-feedback");
  const copy = getRagAdminCopy(locale);
  return (
    <RagAdminPageFrame locale={locale} activeKey="sourceFeedback" title={copy.pages.sourceFeedback.title} subtitle={copy.pages.sourceFeedback.subtitle}>
      <RagAdminSourceFeedbackScreen locale={locale} />
    </RagAdminPageFrame>
  );
}
