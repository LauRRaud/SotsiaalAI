export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { handoverFieldVisit } from "@/lib/field/service";
import { fieldErrorResponse, fieldJson, requireFieldUser } from "@/lib/field/routeAuth";
import { safeError } from "@/lib/privacy/safeError";

/**
 * Handover into EXISTING carriers (doc 2.1 step 16): a CASE_SUMMARY draft
 * artifact and/or an appended receiver note on the linked pre-inquiry. Each
 * target is transactional on its own and repeatable — no half-handed-over
 * state exists.
 */
export async function POST(request, context) {
  const auth = await requireFieldUser();
  if (!auth.ok) return fieldJson({ ok: false, message: auth.message }, auth.status);
  try {
    const params = await context?.params;
    const body = await request.json().catch(() => ({}));
    const result = await handoverFieldVisit(auth.userId, String(params?.id || "").trim(), body);
    return fieldJson({ ok: true, ...result });
  } catch (error) {
    if (Number(error?.status) >= 500 || !error?.status) {
      console.error("[field] handover failed", safeError(error));
    }
    return fieldErrorResponse(error, "field.errors.handover_failed");
  }
}
