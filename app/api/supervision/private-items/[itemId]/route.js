import { json } from "@/lib/documents/server";
import { deletePrivateItem, updatePrivateItem } from "@/lib/supervision/privateItems";
import {
  getSupervisionSession,
  supervisionErrorResponse,
  supervisionLocale
} from "@/lib/supervision/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(request, context) {
  const locale = supervisionLocale(request);
  try {
    const session = await getSupervisionSession();
    const params = await context?.params;
    const body = await request.json().catch(() => ({}));
    const result = await updatePrivateItem({ itemId: String(params?.itemId || "").trim(), session, input: body });
    return json({ ok: true, ...result });
  } catch (error) {
    return supervisionErrorResponse(error, locale, "[supervision] private item update failed", "supervision.errors.save_failed");
  }
}

export async function DELETE(request, context) {
  const locale = supervisionLocale(request);
  try {
    const session = await getSupervisionSession();
    const params = await context?.params;
    const result = await deletePrivateItem({ itemId: String(params?.itemId || "").trim(), session });
    return json({ ok: true, ...result });
  } catch (error) {
    return supervisionErrorResponse(error, locale, "[supervision] private item delete failed", "supervision.errors.save_failed");
  }
}
