import {
  clearWellbeingCheckpointForUser,
  setWellbeingCheckpointForUser
} from "@/lib/wellbeing/checkpoint";
import { requireWellbeingApiUser, wellbeingErrorResponse, wellbeingJson } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function readId(context) {
  const params = await context?.params;
  return String(params?.id || "");
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
    return wellbeingErrorResponse(error, { label: "checkpoint failed" });
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
    return wellbeingErrorResponse(error, { label: "checkpoint failed" });
  }
}
