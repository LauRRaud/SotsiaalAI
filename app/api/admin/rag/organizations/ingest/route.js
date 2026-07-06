import { ingestOrganizationEntriesBySlugs } from "@/lib/admin/rag/organizations/service";
import { errorJson, json, requireOrganizationAdminSession } from "@/lib/admin/rag/organizations/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request) {
  const auth = await requireOrganizationAdminSession(request);
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
    const items = await ingestOrganizationEntriesBySlugs(slugs);
    return json({
      ok: true,
      items,
      total: items.length
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    return errorJson(status === 500 ? "api.common.server_error" : "api.admin.organizations.ingest_failed", status, auth.locale, {
      debug: process.env.NODE_ENV !== "production" ? String(error?.message || error) : undefined
    });
  }
}
