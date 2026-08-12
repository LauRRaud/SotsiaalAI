import {
  confirmWellbeingOutputDraftForUser,
  deleteWellbeingOutputDraftForUser,
  getWellbeingOutputDraftForUser,
  saveWellbeingOutputDraftForUser,
  wellbeingOutputDraftPublicError,
  wellbeingOutputDraftSavePublicError
} from "@/lib/wellbeing/supportDrafts";
import { safeError } from "@/lib/privacy/safeError";
import { requireWellbeingApiUser, wellbeingErrorResponse, wellbeingJson } from "../../_shared";

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

/* SOL-WB-16: mustandi avamine. Ilma selleta nägi kasutaja pärast lehelt
   lahkumist ainult seda, ET mustand on olemas — teksti tagasi ei saanud. */
export async function GET(request, context) {
  const auth = await requireWellbeingApiUser(request);
  if (!auth.ok) return auth.response;

  try {
    const draft = await getWellbeingOutputDraftForUser(auth.userId, await readId(context));
    if (!draft) {
      return wellbeingJson({ ok: false, message: "wellbeing.errors.output_draft_not_found" }, 404);
    }
    return wellbeingJson({ ok: true, draft });
  } catch (error) {
    return wellbeingErrorResponse(error, { label: "output draft detail failed" });
  }
}

/* SOL-WB-16: kustutamine on idempotentne ja ütleb välja, kas mustand oli üle
   antud — jagatud kovisiooni juhtum ei kao selle kustutusega. */
export async function DELETE(request, context) {
  const auth = await requireWellbeingApiUser(request);
  if (!auth.ok) return auth.response;

  try {
    const result = await deleteWellbeingOutputDraftForUser(auth.userId, await readId(context));
    if (!result.deleted) {
      return wellbeingJson({ ok: false, message: "wellbeing.errors.output_draft_not_found" }, 404);
    }
    return wellbeingJson({ ok: true, deleted: true, handedOff: result.handedOff });
  } catch (error) {
    return wellbeingErrorResponse(error, { label: "output draft delete failed" });
  }
}
