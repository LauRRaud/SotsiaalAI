import { serverT } from "@/lib/i18n/serverMessages";

import RagAdminKovView from "@/components/admin/rag/RagAdminKovView";
import RagAdminPageFrame from "@/components/admin/rag/RagAdminPageFrame";
import { getRagAdminCopy } from "@/components/admin/rag/ragAdminCopy";
import { listKovAdminEntries } from "@/lib/admin/rag/kov/service";

import { requireAdminRagAccess } from "../pageHelpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export const metadata = {
  title: serverT("en", "admin.pages.rag.meta_title", undefined, "RAG KOV - SotsiaalAI"),
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
};

export default async function AdminRagKovPage() {
  const { locale } = await requireAdminRagAccess("/admin/rag/kov");
  const copy = getRagAdminCopy(locale);
  const initialItems = await listKovAdminEntries();

  return (
    <RagAdminPageFrame locale={locale} activeKey="kov" title={copy.pages.kov.title} subtitle={copy.pages.kov.subtitle}>
      <RagAdminKovView locale={locale} initialItems={initialItems} />
    </RagAdminPageFrame>
  );
}
