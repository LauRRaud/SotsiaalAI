import { errorJson, json, requireKovAdminSession } from "@/lib/admin/rag/kov/api";
import { RAG_RESET_PARTIAL } from "@/lib/admin/rag/kov/ragResetProtocol";
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

    /* SOL-RAGADMIN-02: osaline reset EI OLE `ok: true`. Vastus kannab kaasas, mis
       kustutati, mis jäi alles ja mis läks järjekorda — muidu peaks admin
       ainsa eduteate põhjal arvama. */
    if (error?.code === RAG_RESET_PARTIAL) {
      return errorJson("api.admin.kov.rag_reset_partial", status, auth.locale, {
        execution: error.execution
      });
    }

    return errorJson(status === 404 ? "api.common.not_found" : "api.admin.kov.update_failed", status, auth.locale);
  }
}
