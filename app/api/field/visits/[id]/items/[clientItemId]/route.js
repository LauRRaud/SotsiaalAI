export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { deleteFieldVisitNote, putFieldVisitNote } from "@/lib/field/service";
import { fieldErrorResponse, fieldJson, requireFieldUser } from "@/lib/field/routeAuth";
import { safeError } from "@/lib/privacy/safeError";

async function ids(context) {
  const params = await context?.params;
  return {
    visitId: String(params?.id || "").trim(),
    clientItemId: String(params?.clientItemId || "").trim()
  };
}

/**
 * Idempotent item PUT (doc ptk 3.3). A replay returns 200 `existing`; a
 * revision divergence returns 409 with both versions so the device can show
 * the conflict — nothing is lost, nothing overwritten silently.
 */
export async function PUT(request, context) {
  const auth = await requireFieldUser();
  if (!auth.ok) return fieldJson({ ok: false, message: auth.message }, auth.status);
  try {
    const { visitId, clientItemId } = await ids(context);
    const body = await request.json().catch(() => ({}));
    const result = await putFieldVisitNote(auth.userId, visitId, clientItemId, body);
    return fieldJson({ ok: true, ...result }, result.created ? 201 : 200);
  } catch (error) {
    if (Number(error?.status) >= 500 || !error?.status) {
      console.error("[field] item put failed", safeError(error));
    }
    return fieldErrorResponse(error, "field.errors.save_failed");
  }
}

export async function DELETE(_request, context) {
  const auth = await requireFieldUser();
  if (!auth.ok) return fieldJson({ ok: false, message: auth.message }, auth.status);
  try {
    const { visitId, clientItemId } = await ids(context);
    const result = await deleteFieldVisitNote(auth.userId, visitId, clientItemId);
    return fieldJson({ ok: true, ...result });
  } catch (error) {
    if (Number(error?.status) >= 500 || !error?.status) {
      console.error("[field] item delete failed", safeError(error));
    }
    return fieldErrorResponse(error, "field.errors.delete_failed");
  }
}
