import { json } from "@/lib/documents/server";
import { discardSummary, updateSummary } from "@/lib/supervision/summaries";
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
    const result = await updateSummary({ summaryId: String(params?.id || "").trim(), session, input: body });
    return json({ ok: true, ...result });
  } catch (error) {
    return supervisionErrorResponse(error, locale, "[supervision] summary update failed", "supervision.errors.save_failed");
  }
}

export async function DELETE(request, context) {
  const locale = supervisionLocale(request);
  try {
    const session = await getSupervisionSession();
    const params = await context?.params;
    const result = await discardSummary({ summaryId: String(params?.id || "").trim(), session });
    return json({ ok: true, ...result });
  } catch (error) {
    return supervisionErrorResponse(error, locale, "[supervision] summary discard failed", "supervision.errors.save_failed");
  }
}
