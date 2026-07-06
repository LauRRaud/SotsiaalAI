import { buildWellbeingOverviewForUser } from "@/lib/wellbeing/overview";
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
    const overview = await buildWellbeingOverviewForUser(auth.userId, {
      period: requestUrl.searchParams.get("period"),
      periodStart: requestUrl.searchParams.get("periodStart"),
      periodEnd: requestUrl.searchParams.get("periodEnd")
    });
    return wellbeingJson({ ok: true, overview });
  } catch (error) {
    console.error("[wellbeing] overview failed", safeError(error));
    return wellbeingJson({ ok: false, message: "wellbeing.errors.overview_failed" }, 500);
  }
}
