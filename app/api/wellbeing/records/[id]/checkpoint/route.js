import {
  clearWellbeingCheckpointForUser,
  setWellbeingCheckpointForUser
} from "@/lib/wellbeing/checkpoint";
import { safeError } from "@/lib/privacy/safeError";
import { requireWellbeingApiUser, wellbeingJson } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function readId(context) {
  const params = await context?.params;
  return String(params?.id || "");
}

function fail(error, fallbackMessage) {
  const status = Number(error?.status) || 500;
  if (status >= 500) {
    console.error("[wellbeing] checkpoint failed", safeError(error));
  }
  return wellbeingJson({
    ok: false,
    message: error?.message || fallbackMessage,
    ...(error?.details ? { details: error.details } : {})
  }, status);
}

/* PUT, mitte POST: kontrollpunkt on kirje küljes ÜKS kokkulepe, mitte kogum.
   Uus plaan asendab vana (ja nullib vana järelmärke — vt checkpoint.js). */
export async function PUT(request, context) {
  const auth = await requireWellbeingApiUser(request);
  if (!auth.ok) return auth.response;

  try {
    const id = await readId(context);
    const body = await request.json().catch(() => ({}));
    await setWellbeingCheckpointForUser(auth.userId, id, body);
    return wellbeingJson({ ok: true });
  } catch (error) {
    return fail(error, "wellbeing.errors.checkpoint_failed");
  }
}

export async function DELETE(request, context) {
  const auth = await requireWellbeingApiUser(request);
  if (!auth.ok) return auth.response;

  try {
    const id = await readId(context);
    await clearWellbeingCheckpointForUser(auth.userId, id);
    return wellbeingJson({ ok: true });
  } catch (error) {
    return fail(error, "wellbeing.errors.checkpoint_failed");
  }
}
