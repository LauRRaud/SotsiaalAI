import { runKovRtLightChecksBySlugs } from "@/lib/admin/rag/kov/service";
import { errorJson, json, requireKovAdminSession } from "@/lib/admin/rag/kov/api";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request) {
  const auth = await requireKovAdminSession(request);
  if (!auth.ok) return auth.response;

  let body = {};
  try {
    body = await request.json();
  } catch {
    return errorJson("api.common.bad_request", 400, auth.locale);
  }

  const slugs = Array.isArray(body?.slugs) ? body.slugs : [];
  if (!slugs.length) return errorJson("api.common.bad_request", 400, auth.locale);

  try {
    const items = await runKovRtLightChecksBySlugs(slugs);
    return json({
      ok: true,
      items,
      count: items.length
    });
  } catch (error) {
    console.error("[kov-admin] bulk rt light check failed", safeError(error));
    return errorJson("api.admin.kov.update_failed", 500, auth.locale);
  }
}
