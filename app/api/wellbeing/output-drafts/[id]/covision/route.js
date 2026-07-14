import { safeError } from "@/lib/privacy/safeError";
import {
  normalizeWellbeingCovisionHandoffRequest,
  startCovisionFromWellbeingDraft,
  wellbeingCovisionHandoffPublicError
} from "@/lib/wellbeing/covisionHandoff";
import { requireWellbeingApiUser, wellbeingJson } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function readId(context) {
  const params = await context?.params;
  return String(params?.id || "").trim();
}

export async function POST(request, context) {
  const auth = await requireWellbeingApiUser(request);
  if (!auth.ok) return auth.response;

  try {
    const body = normalizeWellbeingCovisionHandoffRequest(
      await request.json().catch(() => null)
    );
    const result = await startCovisionFromWellbeingDraft({
      userId: auth.userId,
      role: auth.roleState.effectiveRole,
      isAdmin: Boolean(auth.roleState.isAdmin)
    }, await readId(context), body);
    return wellbeingJson({ ok: true, ...result }, result.created ? 201 : 200);
  } catch (error) {
    const { messageKey, status } = wellbeingCovisionHandoffPublicError(error);
    if (status >= 500) {
      console.error("[wellbeing] covision handoff failed", safeError(error));
    }
    return wellbeingJson({ ok: false, message: messageKey }, status);
  }
}
