import { serverT } from "@/lib/i18n/serverMessages";

import RagAdminLandingWorkspace from "@/components/admin/rag/RagAdminLandingWorkspace";

import { requireAdminRagAccess } from "./pageHelpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export const metadata = {
  title: serverT("en", "admin.pages.rag.meta_title", undefined, "RAG Admin - SotsiaalAI"),
  description: serverT("en", "admin.pages.rag.meta_description", undefined, "Upload and manage RAG materials."),
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
};

export default async function AdminRagLandingPage() {
  const { locale } = await requireAdminRagAccess("/admin/rag");
  return <RagAdminLandingWorkspace locale={locale} />;
}
