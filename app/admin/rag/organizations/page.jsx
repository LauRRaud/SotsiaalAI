import { serverT } from "@/lib/i18n/serverMessages";

import RagAdminOrganizationsView from "@/components/admin/rag/RagAdminOrganizationsView";
import RagAdminPageFrame from "@/components/admin/rag/RagAdminPageFrame";
import { getRagAdminCopy } from "@/components/admin/rag/ragAdminCopy";
import { listOrganizationAdminEntries } from "@/lib/admin/rag/organizations/service";

import { requireAdminRagAccess } from "../pageHelpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export const metadata = {
  title: serverT("en", "admin.pages.rag.meta_title", undefined, "RAG Organizations - SotsiaalAI"),
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
};

export default async function AdminRagOrganizationsPage() {
  const { locale } = await requireAdminRagAccess("/admin/rag/organizations");
  const copy = getRagAdminCopy(locale);
  const initialItems = await listOrganizationAdminEntries();

  return (
    <RagAdminPageFrame
      locale={locale}
      activeKey="organizations"
      title={copy.pages.organizations.title}
      subtitle={copy.pages.organizations.subtitle}
    >
      <RagAdminOrganizationsView locale={locale} initialItems={initialItems} />
    </RagAdminPageFrame>
  );
}
