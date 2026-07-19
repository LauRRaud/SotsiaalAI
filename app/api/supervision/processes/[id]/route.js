import { json } from "@/lib/documents/server";
import { getProcessDetail, updateProcess } from "@/lib/supervision/service";
import {
  getSupervisionSession,
  supervisionErrorResponse,
  supervisionLocale
} from "@/lib/supervision/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request, context) {
  const locale = supervisionLocale(request);
  try {
    const session = await getSupervisionSession();
    const params = await context?.params;
    const process = await getProcessDetail({ processId: String(params?.id || "").trim(), session });
    return json({ ok: true, process });
  } catch (error) {
    return supervisionErrorResponse(error, locale, "[supervision] process detail failed", "supervision.errors.load_failed");
  }
}

export async function PATCH(request, context) {
  const locale = supervisionLocale(request);
  try {
    const session = await getSupervisionSession();
    const params = await context?.params;
    const body = await request.json().catch(() => ({}));
    const process = await updateProcess({ processId: String(params?.id || "").trim(), session, input: body });
    return json({ ok: true, process });
  } catch (error) {
    return supervisionErrorResponse(error, locale, "[supervision] process update failed", "supervision.errors.save_failed");
  }
}
