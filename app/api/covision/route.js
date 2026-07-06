import { json } from "@/lib/documents/server";
import {
  createCovisionCase,
  listCovisionWorkspace
} from "@/lib/covision";
import {
  covisionErrorResponse,
  covisionLocale,
  requireCovisionAuth
} from "@/lib/covisionApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  const locale = covisionLocale(request);
  try {
    const auth = await requireCovisionAuth();
    const workspace = await listCovisionWorkspace(auth);
    return json({
      ok: true,
      ...workspace
    });
  } catch (error) {
    return covisionErrorResponse(error, locale, "[covision] workspace load failed", "covision.errors.load_failed");
  }
}

export async function POST(request) {
  const locale = covisionLocale(request);
  try {
    const auth = await requireCovisionAuth();
    const body = await request.json().catch(() => ({}));
    const covisionCase = await createCovisionCase(auth, body);
    return json({
      ok: true,
      case: covisionCase
    }, 201);
  } catch (error) {
    return covisionErrorResponse(error, locale, "[covision] create failed", "covision.errors.save_failed");
  }
}
