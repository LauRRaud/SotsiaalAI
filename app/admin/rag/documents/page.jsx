import { serverT } from "@/lib/i18n/serverMessages";

import RagAdminDocumentsScreen from "@/components/admin/rag/RagAdminDocumentsScreen";
import RagAdminPageFrame from "@/components/admin/rag/RagAdminPageFrame";
import { getRagAdminCopy } from "@/components/admin/rag/ragAdminCopy";

import { requireAdminRagAccess } from "../pageHelpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export const metadata = {
  title: serverT("en", "admin.pages.rag.meta_title", undefined, "RAG Documents - SotsiaalAI"),
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
};

export default async function AdminRagDocumentsPage() {
  const { locale } = await requireAdminRagAccess("/admin/rag/documents");
  const copy = getRagAdminCopy(locale);

  return (
    <RagAdminPageFrame
      locale={locale}
      activeKey="documents"
      title={copy.pages.documents.title}
      subtitle={copy.pages.documents.subtitle}
    >
      <RagAdminDocumentsScreen />
    </RagAdminPageFrame>
  );
}
