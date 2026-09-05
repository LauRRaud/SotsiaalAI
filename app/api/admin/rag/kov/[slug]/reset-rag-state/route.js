import { errorJson, requireKovAdminSession } from "@/lib/admin/rag/kov/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export async function POST(request) {
  const auth = await requireKovAdminSession(request);
  if (!auth.ok) return auth.response;
  return errorJson("api.rag.retired", 503, auth.locale);
}
