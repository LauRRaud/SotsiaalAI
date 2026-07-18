export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createFieldVisit, listFieldVisits } from "@/lib/field/service";
import { fieldErrorResponse, fieldJson, requireFieldUser } from "@/lib/field/routeAuth";
import { safeError } from "@/lib/privacy/safeError";

export async function GET() {
  const auth = await requireFieldUser();
  if (!auth.ok) return fieldJson({ ok: false, message: auth.message }, auth.status);
  try {
    const visits = await listFieldVisits(auth.userId);
    return fieldJson({ ok: true, visits });
  } catch (error) {
    if (Number(error?.status) >= 500 || !error?.status) {
      console.error("[field] list failed", safeError(error));
    }
    return fieldErrorResponse(error, "field.errors.load_failed");
  }
}

export async function POST(request) {
  const auth = await requireFieldUser();
  if (!auth.ok) return fieldJson({ ok: false, message: auth.message }, auth.status);
  try {
    const body = await request.json().catch(() => ({}));
    const visit = await createFieldVisit(auth.userId, body);
    return fieldJson({ ok: true, visit }, 201);
  } catch (error) {
    if (Number(error?.status) >= 500 || !error?.status) {
      console.error("[field] create failed", safeError(error));
    }
    return fieldErrorResponse(error, "field.errors.save_failed");
  }
}
