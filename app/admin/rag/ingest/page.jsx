import { redirect } from "next/navigation";
import { localizePath } from "@/lib/localizePath";
import { requireAdminRagAccess } from "../pageHelpers";
export const dynamic = "force-dynamic";
export default async function RetiredRagPage() {
  const { locale } = await requireAdminRagAccess("/admin/rag/ingest");
  redirect(localizePath("/admin/rag", locale));
}
