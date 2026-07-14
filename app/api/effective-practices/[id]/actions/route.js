import { json } from "@/lib/documents/server";
import { actOnEffectivePractice } from "@/lib/effectivePractices";
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

export async function POST(request, context) {
  const locale = effectivePracticeLocale(request);
  try {
    const auth = await requireEffectivePracticeAuth();
    const body = await request.json().catch(() => ({}));
    const result = await actOnEffectivePractice(auth, await readId(context), body);
    return json({ ok: true, ...result });
  } catch (error) {
    return effectivePracticeErrorResponse(error, locale, "[effective-practices] workflow action failed");
  }
}
