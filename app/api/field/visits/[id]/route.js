export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import {
  getFieldVisitDetail,
  performFieldVisitAction,
  updateFieldVisitFields
} from "@/lib/field/service";
import { fieldErrorResponse, fieldJson, requireFieldUser } from "@/lib/field/routeAuth";
import { safeError } from "@/lib/privacy/safeError";

async function visitId(context) {
  const params = await context?.params;
  return String(params?.id || "").trim();
}

export async function GET(_request, context) {
  const auth = await requireFieldUser();
  if (!auth.ok) return fieldJson({ ok: false, message: auth.message }, auth.status);
  try {
    const detail = await getFieldVisitDetail(auth.userId, await visitId(context));
    return fieldJson({ ok: true, ...detail });
  } catch (error) {
    if (Number(error?.status) >= 500 || !error?.status) {
      console.error("[field] detail failed", safeError(error));
    }
    return fieldErrorResponse(error, "field.errors.load_failed");
  }
}

/**
 * PATCH body: either `{ action, version, ...payload }` for lifecycle/safety
 * actions or `{ version, ...fields }` for pack/meta edits. Both are CAS-
 * guarded by `version` — a stale device gets a 409, never a silent overwrite.
 */
export async function PATCH(request, context) {
  const auth = await requireFieldUser();
  if (!auth.ok) return fieldJson({ ok: false, message: auth.message }, auth.status);
  try {
    const id = await visitId(context);
    const body = await request.json().catch(() => ({}));
    const visit = body.action
      ? await performFieldVisitAction(auth.userId, id, body.action, body)
      : await updateFieldVisitFields(auth.userId, id, body);
    return fieldJson({ ok: true, visit });
  } catch (error) {
    if (Number(error?.status) >= 500 || !error?.status) {
      console.error("[field] patch failed", safeError(error));
    }
    return fieldErrorResponse(error, "field.errors.save_failed");
  }
}
