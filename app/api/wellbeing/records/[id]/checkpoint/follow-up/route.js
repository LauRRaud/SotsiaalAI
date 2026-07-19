import { recordWellbeingCheckpointFollowUpForUser } from "@/lib/wellbeing/checkpoint";
import { safeError } from "@/lib/privacy/safeError";
import { requireWellbeingApiUser, wellbeingJson } from "../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function readId(context) {
  const params = await context?.params;
  return String(params?.id || "");
}

/* „Kas pidas?" — kolm ausat olekut, ilma skoorita. Vahelejätmine on võrdväärne
   tulemus: vastamata jätmine ei tekita võlga ega hoiatust. */
export async function POST(request, context) {
  const auth = await requireWellbeingApiUser(request);
  if (!auth.ok) return auth.response;

  try {
    const id = await readId(context);
    const body = await request.json().catch(() => ({}));
    await recordWellbeingCheckpointFollowUpForUser(auth.userId, id, body);
    return wellbeingJson({ ok: true });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) {
      console.error("[wellbeing] checkpoint follow-up failed", safeError(error));
    }
    return wellbeingJson({
      ok: false,
      message: error?.message || "wellbeing.errors.checkpoint_follow_up_failed",
      ...(error?.details ? { details: error.details } : {})
    }, status);
  }
}
