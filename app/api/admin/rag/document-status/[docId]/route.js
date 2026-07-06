import { errorJson, json, requireKovAdminSession } from "@/lib/admin/rag/kov/api";
import { buildRagHeaders, ragServiceRequest } from "@/lib/documents/ragService";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function resolveDocId(paramsLike) {
  const params = await paramsLike;
  return String(params?.docId || "").trim();
}

function buildMissingDocument(docId) {
  return {
    docId,
    exists: false,
    chunks: 0,
    title: "",
    status: "",
    updatedAt: null,
    lastIngested: null,
    error: ""
  };
}

export async function GET(request, { params }) {
  const auth = await requireKovAdminSession(request);
  if (!auth.ok) return auth.response;

  const docId = await resolveDocId(params);
  if (!docId) return errorJson("api.common.bad_request", 400, auth.locale);

  try {
    const headers = buildRagHeaders(null, {
      route: "api/admin/rag/document-status",
      stage: "document_status"
    });
    headers.set("x-ui-locale", auth.locale);

    const payload = await ragServiceRequest(
      `/documents/${encodeURIComponent(docId)}`,
      {
        method: "GET",
        headers
      },
      "api.rag.document_status_failed"
    );

    return json({
      ok: true,
      item: {
        docId: String(payload?.docId || payload?.id || docId).trim() || docId,
        exists: true,
        chunks: Number.isFinite(Number(payload?.chunks)) ? Number(payload.chunks) : 0,
        title: String(payload?.title || "").trim(),
        status: String(payload?.status || "").trim() || "COMPLETED",
        updatedAt: payload?.updatedAt || null,
        lastIngested: payload?.lastIngested || null,
        error: ""
      }
    });
  } catch (error) {
    const status = Number(error?.status || 500);
    if (status === 404) {
      return json({
        ok: true,
        item: buildMissingDocument(docId)
      });
    }

    if (status === 401) {
      console.error("[rag-admin] document status RAG auth failed", {
        docId,
        status,
        error: safeError(error)
      });
      return errorJson("api.rag.document_status_auth_failed", 502, auth.locale, {
        debugCode: "RAG_DOCUMENT_STATUS_AUTH_FAILED",
        debug: process.env.NODE_ENV !== "production" ? String(error?.message || error) : undefined
      });
    }

    console.error("[rag-admin] document status fetch failed", {
      docId,
      status,
      error: safeError(error)
    });
    return errorJson("api.rag.document_status_failed", status, auth.locale, {
      debug: process.env.NODE_ENV !== "production" ? String(error?.message || error) : undefined
    });
  }
}
