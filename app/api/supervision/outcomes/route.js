import { json } from "@/lib/documents/server";
import { listOutcomes } from "@/lib/supervision/outcomes";
import {
  getSupervisionSession,
  supervisionErrorResponse,
  supervisionLocale
} from "@/lib/supervision/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  const locale = supervisionLocale(request);
  try {
    const session = await getSupervisionSession();
    const result = await listOutcomes({ session });
    return json({ ok: true, ...result });
  } catch (error) {
    return supervisionErrorResponse(error, locale, "[supervision] outcomes list failed", "supervision.errors.load_failed");
  }
}
