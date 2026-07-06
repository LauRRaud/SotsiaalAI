import { errorJson, json, requireKovAdminSession } from "@/lib/admin/rag/kov/api";
import {
  executeKovRagStateResetBySlug,
  planKovRagStateResetBySlug
} from "@/lib/admin/rag/kov/resetState";
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

  let body = {};
  try {
    body = await request.json();
  } catch {}

  const confirmReset = body?.confirmReset === true;

  try {
    const result = confirmReset
      ? await executeKovRagStateResetBySlug(slug)
      : await planKovRagStateResetBySlug(slug);

    return json({
      ok: true,
      ...result
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    console.error("[kov-admin] reset rag state failed", safeError(error));
    return errorJson(status === 404 ? "api.common.not_found" : "api.admin.kov.update_failed", status, auth.locale);
  }
}
