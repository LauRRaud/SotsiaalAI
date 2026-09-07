import { requireAdminRagAccess } from "../pageHelpers";
import RagAdminIntakeWorkspace from "@/components/admin/rag/RagAdminIntakeWorkspace";
export const dynamic = "force-dynamic";
export default async function RagIntakePage() {
  const { locale } = await requireAdminRagAccess("/admin/rag/ingest");
  return <RagAdminIntakeWorkspace locale={locale} />;
}
