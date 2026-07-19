import { json } from "@/lib/documents/server";
import { createPrivateItem, listPrivateItems } from "@/lib/supervision/privateItems";
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
    const result = await listPrivateItems({ processId: String(params?.id || "").trim(), session });
    return json({ ok: true, ...result });
  } catch (error) {
    return supervisionErrorResponse(error, locale, "[supervision] private items list failed", "supervision.errors.load_failed");
  }
}

export async function POST(request, context) {
  const locale = supervisionLocale(request);
  try {
    const session = await getSupervisionSession();
    const params = await context?.params;
    const body = await request.json().catch(() => ({}));
    const result = await createPrivateItem({ processId: String(params?.id || "").trim(), session, input: body });
    return json({ ok: true, ...result }, 201);
  } catch (error) {
    return supervisionErrorResponse(error, locale, "[supervision] private item create failed", "supervision.errors.save_failed");
  }
}
