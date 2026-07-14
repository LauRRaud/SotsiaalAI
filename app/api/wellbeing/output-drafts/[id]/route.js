import {
  confirmWellbeingOutputDraftForUser,
  saveWellbeingOutputDraftForUser,
  wellbeingOutputDraftPublicError,
  wellbeingOutputDraftSavePublicError
} from "@/lib/wellbeing/supportDrafts";
import { safeError } from "@/lib/privacy/safeError";
import { requireWellbeingApiUser, wellbeingJson } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function readId(context) {
  const params = await context?.params;
  return String(params?.id || "");
}

export async function PATCH(request, context) {
  const auth = await requireWellbeingApiUser(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const draft = await confirmWellbeingOutputDraftForUser(auth.userId, await readId(context), body);
    return wellbeingJson({ ok: true, draft });
  } catch (error) {
    const { messageKey, status } = wellbeingOutputDraftPublicError(error);
    if (status >= 500) {
      console.error("[wellbeing] output draft confirm failed", safeError(error));
    }
    return wellbeingJson({
      ok: false,
      message: messageKey
    }, status);
  }
}

export async function PUT(request, context) {
  const auth = await requireWellbeingApiUser(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const draft = await saveWellbeingOutputDraftForUser(auth.userId, await readId(context), body);
    return wellbeingJson({ ok: true, draft });
  } catch (error) {
    const { messageKey, status } = wellbeingOutputDraftSavePublicError(error);
    if (status >= 500) {
      console.error("[wellbeing] output draft save failed", safeError(error));
    }
    return wellbeingJson({
      ok: false,
      message: messageKey
    }, status);
  }
}
