import { json } from "@/lib/documents/server";
import { leaveProcess } from "@/lib/supervision/service";
import {
  getSupervisionSession,
  supervisionErrorResponse,
  supervisionLocale
} from "@/lib/supervision/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request, context, deps = {}) {
  const locale = supervisionLocale(request);
  try {
    const session = deps.session ?? await getSupervisionSession();
    const params = await context?.params;
    const result = await (deps.leaveProcess || leaveProcess)(
      { participationId: String(params?.id || "").trim(), session },
      { db: deps.db, now: deps.now }
    );
    return json({ ok: true, ...result });
  } catch (error) {
    return supervisionErrorResponse(error, locale, "[supervision] leave failed", "supervision.errors.save_failed");
  }
}
