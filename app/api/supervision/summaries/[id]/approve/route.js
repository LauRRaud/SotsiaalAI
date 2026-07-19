import { json } from "@/lib/documents/server";
import { approveSummary } from "@/lib/supervision/summaries";
import {
  getSupervisionSession,
  supervisionErrorResponse,
  supervisionLocale
} from "@/lib/supervision/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request, context) {
  const locale = supervisionLocale(request);
  try {
    const session = await getSupervisionSession();
    const params = await context?.params;
    const result = await approveSummary({ summaryId: String(params?.id || "").trim(), session });
    return json({ ok: true, ...result });
  } catch (error) {
    return supervisionErrorResponse(error, locale, "[supervision] summary approve failed", "supervision.errors.save_failed");
  }
}
