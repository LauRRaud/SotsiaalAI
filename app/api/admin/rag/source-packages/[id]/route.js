import { requireKovAdminSession, json, errorJson } from "@/lib/admin/rag/kov/api";
import { getSourcePackageSnapshot } from "@/lib/admin/rag/sourcePackages/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request, { params }) {
  const auth = await requireKovAdminSession(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const item = await getSourcePackageSnapshot(id);
  if (!item) return errorJson("api.common.not_found", 404, auth.locale);
  return json({ ok: true, item });
}
