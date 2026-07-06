import { ingestOrganizationEntryBySlug } from "@/lib/admin/rag/organizations/service";
import { errorJson, json, requireOrganizationAdminSession } from "@/lib/admin/rag/organizations/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function resolveSlug(paramsLike) {
  const params = await paramsLike;
  return String(params?.slug || "").trim().toLowerCase();
}

export async function POST(request, { params }) {
  const auth = await requireOrganizationAdminSession(request);
  if (!auth.ok) return auth.response;

  const slug = await resolveSlug(params);
  if (!slug) return errorJson("api.common.bad_request", 400, auth.locale);

  try {
    const item = await ingestOrganizationEntryBySlug(slug);
    if (!item) return errorJson("api.common.not_found", 404, auth.locale);

    return json({
      ok: true,
      item
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    return errorJson(status === 500 ? "api.common.server_error" : "api.admin.organizations.ingest_failed", status, auth.locale, {
      debug: process.env.NODE_ENV !== "production" ? String(error?.message || error) : undefined
    });
  }
}
