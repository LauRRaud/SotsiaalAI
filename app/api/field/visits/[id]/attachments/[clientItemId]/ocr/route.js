export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { requestFieldOcr, isFieldOcrConfigured } from "@/lib/field/ocr";
import { fieldErrorResponse, fieldJson, requireFieldUser } from "@/lib/field/routeAuth";
import { safeError } from "@/lib/privacy/safeError";

/**
 * User-commanded OCR over a synced photo attachment. The result is an
 * UNSAVED AI_MUSTAND draft; nothing persists until the user confirms it as a
 * note. Owner-scoped: a foreign visit or attachment is a 404.
 */
export async function POST(request, context) {
  const auth = await requireFieldUser();
  if (!auth.ok) return fieldJson({ ok: false, message: auth.message }, auth.status);
  try {
    if (!isFieldOcrConfigured()) {
      return fieldJson({ ok: false, message: "field.errors.ocr_unavailable" }, 503);
    }
    const params = await context?.params;
    const ipAddress = String(request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown")
      .split(",")[0]
      .trim();
    const result = await requestFieldOcr({
      ownerUserId: auth.userId,
      visitId: String(params?.id || "").trim(),
      clientItemId: String(params?.clientItemId || "").trim(),
      ipAddress
    });
    return fieldJson({
      ok: true,
      jobId: result.jobId,
      cached: result.cached,
      status: result.status,
      draft: result.text,
      truncated: result.truncated,
      provenance: "AI_MUSTAND"
    });
  } catch (error) {
    if (Number(error?.status) >= 500 || !error?.status) {
      console.error("[field] ocr failed", safeError(error));
    }
    return fieldErrorResponse(error, "field.errors.ocr_failed");
  }
}
