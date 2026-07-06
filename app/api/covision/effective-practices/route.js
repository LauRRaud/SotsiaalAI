import { json } from "@/lib/documents/server";
import {
  createEffectivePractice,
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
      practices: workspace.practices
    });
  } catch (error) {
    return covisionErrorResponse(error, locale, "[covision] practice load failed", "covision.errors.practice_load_failed");
  }
}

export async function POST(request) {
  const locale = covisionLocale(request);
  try {
    const auth = await requireCovisionAuth();
    const body = await request.json().catch(() => ({}));
    const practice = await createEffectivePractice(auth, body);
    return json({
      ok: true,
      practice
    }, 201);
  } catch (error) {
    return covisionErrorResponse(error, locale, "[covision] practice create failed", "covision.errors.practice_save_failed");
  }
}
