import { json } from "@/lib/documents/server";
import { createContractVersion } from "@/lib/supervision/service";
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
    const result = await createContractVersion({ processId: String(params?.id || "").trim(), session, input: body });
    return json({ ok: true, ...result }, 201);
  } catch (error) {
    return supervisionErrorResponse(error, locale, "[supervision] contract version create failed", "supervision.errors.save_failed");
  }
}
