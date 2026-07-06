import { json } from "@/lib/documents/server";
import {
  getVisibleCovisionCase,
  serializeCovisionCase,
  updateCovisionCase
} from "@/lib/covision";
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

export async function GET(request, context) {
  const locale = covisionLocale(request);
  try {
    const auth = await requireCovisionAuth();
    const covisionCase = await getVisibleCovisionCase(auth, await readId(context));
    if (!covisionCase) {
      return covisionErrorResponse({ message: "api.common.not_found", status: 404 }, locale);
    }
    return json({
      ok: true,
      case: serializeCovisionCase(covisionCase, auth)
    });
  } catch (error) {
    return covisionErrorResponse(error, locale, "[covision] detail load failed", "covision.errors.load_failed");
  }
}

export async function PATCH(request, context) {
  const locale = covisionLocale(request);
  try {
    const auth = await requireCovisionAuth();
    const body = await request.json().catch(() => ({}));
    const covisionCase = await updateCovisionCase(auth, await readId(context), body);
    return json({
      ok: true,
      case: covisionCase
    });
  } catch (error) {
    return covisionErrorResponse(error, locale, "[covision] update failed", "covision.errors.save_failed");
  }
}
