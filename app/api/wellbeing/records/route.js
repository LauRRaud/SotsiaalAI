import { listWellbeingRecordsForUser } from "@/lib/wellbeing/records";
import { safeError } from "@/lib/privacy/safeError";
import { requireWellbeingApiUser, wellbeingJson } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  const auth = await requireWellbeingApiUser(request);
  if (!auth.ok) return auth.response;

  const requestUrl = new URL(request.url);
  try {
    const records = await listWellbeingRecordsForUser(auth.userId, {
      workflowType: requestUrl.searchParams.get("workflowType"),
      periodStart: requestUrl.searchParams.get("periodStart"),
      periodEnd: requestUrl.searchParams.get("periodEnd"),
      take: requestUrl.searchParams.get("take")
    });
    return wellbeingJson({ ok: true, records });
  } catch (error) {
    console.error("[wellbeing] records list failed", safeError(error));
    return wellbeingJson({ ok: false, message: "wellbeing.errors.records_failed" }, 500);
  }
}
