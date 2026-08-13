import { json } from "@/lib/documents/server";
import { respondToInvite } from "@/lib/supervision/service";
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
    const body = await request.json().catch(() => ({}));
    const result = await (deps.respondToInvite || respondToInvite)(
      { participationId: String(params?.id || "").trim(), session, input: body },
      { db: deps.db, now: deps.now }
    );
    return json({ ok: true, ...result });
  } catch (error) {
    return supervisionErrorResponse(error, locale, "[supervision] respond failed", "supervision.errors.save_failed");
  }
}
