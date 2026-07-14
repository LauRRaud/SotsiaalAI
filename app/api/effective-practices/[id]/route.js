import { json } from "@/lib/documents/server";
import {
  getEffectivePracticeDetail,
  updateEffectivePracticeCandidate
} from "@/lib/effectivePractices";
import {
  effectivePracticeErrorResponse,
  effectivePracticeLocale,
  requireEffectivePracticeAuth
} from "@/lib/effectivePracticeApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function readId(context) {
  const params = await context?.params;
  return String(params?.id || "").trim();
}

export async function GET(request, context) {
  const locale = effectivePracticeLocale(request);
  try {
    const auth = await requireEffectivePracticeAuth();
    const detail = await getEffectivePracticeDetail(auth, await readId(context));
    return json({ ok: true, ...detail });
  } catch (error) {
    return effectivePracticeErrorResponse(error, locale, "[effective-practices] detail load failed");
  }
}

export async function PATCH(request, context) {
  const locale = effectivePracticeLocale(request);
  try {
    const auth = await requireEffectivePracticeAuth();
    const body = await request.json().catch(() => ({}));
    const candidate = await updateEffectivePracticeCandidate(auth, await readId(context), body);
    return json({ ok: true, candidate });
  } catch (error) {
    return effectivePracticeErrorResponse(error, locale, "[effective-practices] candidate update failed");
  }
}
