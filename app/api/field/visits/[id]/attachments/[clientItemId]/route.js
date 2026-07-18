export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import {
  confirmFieldTranscript,
  deleteFieldVisitAttachment,
  putFieldVisitAttachment
} from "@/lib/field/attachments";
import { fieldErrorResponse, fieldJson, requireFieldUser } from "@/lib/field/routeAuth";
import { enforceDocumentsRateLimit, readDocumentsRateLimit } from "@/lib/documents/rateLimit";
import { safeError } from "@/lib/privacy/safeError";

const RATE_LIMIT_WINDOW_MS = readDocumentsRateLimit(process.env.DOCUMENTS_RATE_LIMIT_WINDOW_MS, 60_000, 1000);
const FIELD_UPLOAD_RATE_LIMIT_MAX = readDocumentsRateLimit(process.env.FIELD_UPLOAD_RATE_LIMIT_MAX, 12);

async function ids(context) {
  const params = await context?.params;
  return {
    visitId: String(params?.id || "").trim(),
    clientItemId: String(params?.clientItemId || "").trim()
  };
}

/** Multipart PUT: photo/audio upload, or JSON `{ confirmTranscript: true }`. */
export async function PUT(request, context) {
  const auth = await requireFieldUser();
  if (!auth.ok) return fieldJson({ ok: false, message: auth.message }, auth.status);
  try {
    const { visitId, clientItemId } = await ids(context);
    const contentType = String(request.headers.get("content-type") || "");
    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
      if (body.confirmTranscript) {
        const result = await confirmFieldTranscript(auth.userId, visitId, clientItemId);
        return fieldJson({ ok: true, ...result });
      }
      return fieldJson({ ok: false, message: "field.errors.file_required" }, 400);
    }
    const limited = enforceDocumentsRateLimit(request, {
      scope: "field_attachment_upload",
      userId: auth.userId,
      limit: FIELD_UPLOAD_RATE_LIMIT_MAX,
      windowMs: RATE_LIMIT_WINDOW_MS
    });
    if (limited) return limited;
    let formData;
    try {
      formData = await request.formData();
    } catch {
      return fieldJson({ ok: false, message: "documents.errors.multipart_required" }, 400);
    }
    const result = await putFieldVisitAttachment(
      auth.userId,
      visitId,
      clientItemId,
      {
        file: formData.get("file"),
        role: formData.get("role"),
        consentClientItemId: formData.get("consentClientItemId"),
        documentOnly: String(formData.get("documentOnly") || "") === "true"
      },
      { session: auth.session }
    );
    return fieldJson({ ok: true, ...result }, result.created ? 201 : 200);
  } catch (error) {
    if (Number(error?.status) >= 500 || !error?.status) {
      console.error("[field] attachment put failed", safeError(error));
    }
    return fieldErrorResponse(error, "field.errors.save_failed");
  }
}

export async function DELETE(_request, context) {
  const auth = await requireFieldUser();
  if (!auth.ok) return fieldJson({ ok: false, message: auth.message }, auth.status);
  try {
    const { visitId, clientItemId } = await ids(context);
    const result = await deleteFieldVisitAttachment(auth.userId, visitId, clientItemId);
    return fieldJson({ ok: true, ...result });
  } catch (error) {
    if (Number(error?.status) >= 500 || !error?.status) {
      console.error("[field] attachment delete failed", safeError(error));
    }
    return fieldErrorResponse(error, "field.errors.delete_failed");
  }
}
