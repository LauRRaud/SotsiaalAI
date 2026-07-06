import { createQuickCheckRecordForUser } from "@/lib/wellbeing/records";
import { safeError } from "@/lib/privacy/safeError";
import { requireWellbeingApiUser, wellbeingJson } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request) {
  const auth = await requireWellbeingApiUser(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const record = await createQuickCheckRecordForUser(auth.userId, body);
    return wellbeingJson({ ok: true, record }, 201);
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) {
      console.error("[wellbeing] quick-check save failed", safeError(error));
    }
    return wellbeingJson({
      ok: false,
      message: error?.message || "wellbeing.errors.save_failed",
      details: error?.details
    }, status);
  }
}
