import { serverT } from "@/lib/i18n/serverMessages";

import RagAdminPageFrame from "@/components/admin/rag/RagAdminPageFrame";
import RagAdminSourcePackagesScreen from "@/components/admin/rag/RagAdminSourcePackagesScreen";
import { getRagAdminCopy } from "@/components/admin/rag/ragAdminCopy";

import { requireAdminRagAccess } from "../pageHelpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export const metadata = {
  title: serverT("en", "admin.pages.rag.meta_title", undefined, "RAG Source packages - SotsiaalAI"),
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
};

export default async function AdminRagSourcePackagesPage() {
  const { locale } = await requireAdminRagAccess("/admin/rag/source-packages");
  const copy = getRagAdminCopy(locale);

  return (
    <RagAdminPageFrame
      locale={locale}
      activeKey="sourcePackages"
      maxWidthClassName="max-w-[88rem]"
      title={copy.pages.sourcePackages.title}
      subtitle={copy.pages.sourcePackages.subtitle}
    >
      <RagAdminSourcePackagesScreen locale={locale} />
    </RagAdminPageFrame>
  );
}
