import { serverT } from "@/lib/i18n/serverMessages";

import RagAdminIngestScreen from "@/components/admin/rag/RagAdminIngestScreen";
import RagAdminPageFrame from "@/components/admin/rag/RagAdminPageFrame";
import { getRagAdminCopy } from "@/components/admin/rag/ragAdminCopy";

import { requireAdminRagAccess } from "../pageHelpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export const metadata = {
  title: serverT("en", "admin.pages.rag.meta_title", undefined, "RAG Ingest - SotsiaalAI"),
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
};

export default async function AdminRagIngestPage() {
  const { locale } = await requireAdminRagAccess("/admin/rag/ingest");
  const copy = getRagAdminCopy(locale);

  return (
    <RagAdminPageFrame
      locale={locale}
      activeKey="ingest"
      title={copy.pages.ingest.title}
      subtitle={copy.pages.ingest.subtitle}
    >
      <RagAdminIngestScreen />
    </RagAdminPageFrame>
  );
}
