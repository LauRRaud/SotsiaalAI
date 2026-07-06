import { revalidateKovEntryBySlug } from "@/lib/admin/rag/kov/service";
import { errorJson, json, requireKovAdminSession } from "@/lib/admin/rag/kov/api";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function resolveSlug(paramsLike) {
  const params = await paramsLike;
  return String(params?.slug || "").trim().toLowerCase();
}

export async function POST(request, { params }) {
  const auth = await requireKovAdminSession(request);
  if (!auth.ok) return auth.response;

  const slug = await resolveSlug(params);
  if (!slug) return errorJson("api.common.bad_request", 400, auth.locale);

  try {
    const item = await revalidateKovEntryBySlug(slug);
    if (!item) return errorJson("api.common.not_found", 404, auth.locale);

    return json({
      ok: true,
      item
    });
  } catch (error) {
    console.error("[kov-admin] single revalidate failed", safeError(error));
    return errorJson("api.admin.kov.update_failed", 500, auth.locale);
  }
}
