import { requireKovAdminSession, json } from "@/lib/admin/rag/kov/api";
import { listSourcePackageSnapshots } from "@/lib/admin/rag/sourcePackages/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  const auth = await requireKovAdminSession(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const result = await listSourcePackageSnapshots(params);
  return json({ ok: true, ...result });
}
