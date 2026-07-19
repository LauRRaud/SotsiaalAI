import { json } from "@/lib/documents/server";
import { closeProcess } from "@/lib/supervision/closure";
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
    const body = await request.json().catch(() => ({}));
    const process = await closeProcess({ processId: String(params?.id || "").trim(), session, input: body });
    return json({ ok: true, process });
  } catch (error) {
    return supervisionErrorResponse(error, locale, "[supervision] process close failed", "supervision.errors.save_failed");
  }
}
