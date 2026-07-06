import { json } from "@/lib/documents/server";
import { upsertCovisionSummary } from "@/lib/covision";
import {
  covisionErrorResponse,
  covisionLocale,
  requireCovisionAuth
} from "@/lib/covisionApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function readId(context) {
  const params = await context?.params;
  return String(params?.id || "").trim();
}

export async function POST(request, context) {
  const locale = covisionLocale(request);
  try {
    const auth = await requireCovisionAuth();
    const body = await request.json().catch(() => ({}));
    const summary = await upsertCovisionSummary(auth, await readId(context), body);
    return json({
      ok: true,
      summary
    });
  } catch (error) {
    return covisionErrorResponse(error, locale, "[covision] summary save failed", "covision.errors.summary_failed");
  }
}
