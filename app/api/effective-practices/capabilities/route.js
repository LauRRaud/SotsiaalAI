import { json } from "@/lib/documents/server";
import {
  listEffectivePracticeCapabilities,
  manageEffectivePracticeCapability
} from "@/lib/effectivePractices";
import {
  effectivePracticeErrorResponse,
  effectivePracticeLocale,
  requireEffectivePracticeAuth
} from "@/lib/effectivePracticeApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  const locale = effectivePracticeLocale(request);
  try {
    const auth = await requireEffectivePracticeAuth();
    const capabilities = await listEffectivePracticeCapabilities(auth);
    return json({ ok: true, capabilities });
  } catch (error) {
    return effectivePracticeErrorResponse(error, locale, "[effective-practices] capability list failed");
  }
}

export async function POST(request) {
  const locale = effectivePracticeLocale(request);
  try {
    const auth = await requireEffectivePracticeAuth();
    const body = await request.json().catch(() => ({}));
    const capability = await manageEffectivePracticeCapability(auth, body);
    return json({ ok: true, capability });
  } catch (error) {
    return effectivePracticeErrorResponse(error, locale, "[effective-practices] capability change failed");
  }
}
