import { json } from "@/lib/documents/server";
import { updateMeeting } from "@/lib/supervision/meetings";
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
    const result = await updateMeeting({ meetingId: String(params?.id || "").trim(), session, input: body });
    return json({ ok: true, ...result });
  } catch (error) {
    return supervisionErrorResponse(error, locale, "[supervision] meeting update failed", "supervision.errors.save_failed");
  }
}
