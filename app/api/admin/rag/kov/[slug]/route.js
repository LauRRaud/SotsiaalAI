import { getKovAdminEntryBySlug, serializeKovAdminWithRepositoryFallback, updateKovAdminEntryBySlug } from "@/lib/admin/rag/kov/service";
import { errorJson, json, requireKovAdminSession } from "@/lib/admin/rag/kov/api";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function resolveSlug(paramsLike) {
  const params = await paramsLike;
  return String(params?.slug || "").trim().toLowerCase();
}

export async function GET(request, { params }) {
  const auth = await requireKovAdminSession(request);
  if (!auth.ok) return auth.response;

  const slug = await resolveSlug(params);
  if (!slug) return errorJson("api.common.bad_request", 400, auth.locale);

  try {
    const row = await getKovAdminEntryBySlug(slug);
    if (!row) {
      return errorJson("api.common.not_found", 404, auth.locale);
    }

    return json({
      ok: true,
      item: await serializeKovAdminWithRepositoryFallback(row)
    });
  } catch (error) {
    console.error("[kov-admin] get failed", safeError(error));
    return errorJson("api.admin.kov.detail_failed", 500, auth.locale);
  }
}

export async function PATCH(request, { params }) {
  const auth = await requireKovAdminSession(request);
  if (!auth.ok) return auth.response;

  const slug = await resolveSlug(params);
  if (!slug) return errorJson("api.common.bad_request", 400, auth.locale);

  let body = {};
  try {
    body = await request.json();
  } catch {
    return errorJson("api.common.bad_request", 400, auth.locale);
  }

  try {
    const item = await updateKovAdminEntryBySlug(slug, body);
    if (!item) {
      return errorJson("api.common.not_found", 404, auth.locale);
    }

    return json({
      ok: true,
      item
    });
  } catch (error) {
    console.error("[kov-admin] patch failed", safeError(error));
    return errorJson("api.admin.kov.update_failed", 500, auth.locale);
  }
}

export async function PUT(request, context) {
  return PATCH(request, context);
}
